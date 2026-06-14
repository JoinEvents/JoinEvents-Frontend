import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BookingService } from '../../core/services/booking.service';
import { PaymentService } from '../../core/services/payment.service';
import { AuthService } from '../../core/services/auth.service';
import { PackageService } from '../../core/services/package.service';
import { ToastService } from '../../core/services/toast.service';
import { LoyaltyService } from '../../core/services/loyalty.service';
import { GuaranteeService } from '../../core/services/guarantee.service';
import { VendorService } from '../../core/services/vendor.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css'
})
export class Checkout implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private bookingService = inject(BookingService);
  private paymentService = inject(PaymentService);
  private auth = inject(AuthService);
  private packageService = inject(PackageService);
  private toast = inject(ToastService);
  private loyaltyService = inject(LoyaltyService);
  private guaranteeService = inject(GuaranteeService);
  private vendorService = inject(VendorService);

  guaranteeHighlights = this.guaranteeService.getGuaranteeHighlights();

  bookingDetails = signal<any | null>(null);
  
  // UI States
  paymentType = signal<'advance' | 'full'>('advance');
  paymentMethod = signal<'card' | 'upi' | 'netbanking' | 'emi'>('card');
  isProcessing = signal(false);
  checkoutSuccess = signal(false);
  errorMessage = signal('');
  processingStep = signal(''); // 'creating', 'initiating', 'verifying', 'done'
  
  // Input fields
  couponCode = signal('');
  appliedCoupon = signal('');
  couponError = signal('');
  couponSuccess = signal('');

  // Loyalty Signals
  availablePoints = signal(0);
  pointsToRedeem = signal(0);
  loyaltyDiscountAmount = signal(0);
  pointsError = signal('');

  // Card Form Signals
  cardNumber = signal('');
  cardHolder = signal('');
  cardExpiry = signal('');
  cardCvv = signal('');

  // UPI Signals
  upiId = signal('');

  // Net Banking Signals
  selectedBank = signal('');
  popularBanks = [
    { id: 'hdfc', name: 'HDFC Bank', logo: 'bi-bank' },
    { id: 'icici', name: 'ICICI Bank', logo: 'bi-bank2' },
    { id: 'sbi', name: 'State Bank of India', logo: 'bi-building-columns' },
    { id: 'axis', name: 'Axis Bank', logo: 'bi-bank' }
  ];

  // EMI Signals
  selectedEmiBank = signal('');
  selectedTenure = signal<number>(6); // Default 6 months
  emiBanks = [
    { id: 'sbi', name: 'State Bank of India', rate: 12 },
    { id: 'hdfc', name: 'HDFC Bank', rate: 13 },
    { id: 'icici', name: 'ICICI Bank', rate: 13.5 },
    { id: 'axis', name: 'Axis Bank', rate: 14 }
  ];

  // Calculated Pricing
  basePrice = computed(() => this.bookingDetails()?.basePrice || 0);
  addonsTotal = computed(() => this.bookingDetails()?.addonsTotal || 0);
  insurancePrice = computed(() => this.bookingDetails()?.includeInsurance ? (this.bookingDetails()?.insurancePrice || 0) : 0);
  
  discountAmount = computed(() => {
    if (this.bookingDetails()?.isBalancePayment) return 0;
    let discount = 0;
    if (this.appliedCoupon().toUpperCase() === 'WELCOME10') {
      discount += Math.round(this.basePrice() * 0.1);
    }
    // Cap loyalty discount at 5% of base price (backend enforces the actual cap)
    const maxLoyaltyDiscount = Math.round(this.basePrice() * 0.05);
    discount += Math.min(this.loyaltyDiscountAmount(), maxLoyaltyDiscount);
    return discount;
  });

  gstAmount = computed(() => {
    const details = this.bookingDetails();
    if (details?.isBalancePayment) {
      return details.gstAmount || 0;
    }
    const netBase = this.basePrice() + this.addonsTotal() - this.discountAmount();
    return Math.round(netBase * 0.18);
  });

  totalAmount = computed(() => {
    const details = this.bookingDetails();
    if (details?.isBalancePayment) {
      return details.totalAmount || 0;
    }
    return this.basePrice() + this.addonsTotal() + this.gstAmount() + this.insurancePrice() - this.discountAmount();
  });

  advanceAmount = computed(() => {
    const details = this.bookingDetails();
    if (details?.isBalancePayment) {
      return details.advanceAmount || 0;
    }
    return Math.round(this.totalAmount() * 0.2);
  });

  payableAmount = computed(() => {
    const details = this.bookingDetails();
    if (details?.isBalancePayment) {
      return details.payableAmount || 0;
    }
    return this.paymentType() === 'advance' ? this.advanceAmount() : this.totalAmount();
  });

  // EMI Calculations
  emiInterestRate = computed(() => {
    const selected = this.emiBanks.find(b => b.id === this.selectedEmiBank());
    return selected ? selected.rate / 100 : 0.14;
  });

  emiMonthlyPayment = computed(() => {
    const principal = this.payableAmount();
    const rate = this.emiInterestRate() / 12; // monthly interest rate
    const months = this.selectedTenure();
    
    if (rate === 0) return Math.round(principal / months);
    
    // Formula: EMI = [P x R x (1+R)^N]/[(1+R)^N-1]
    const emi = (principal * rate * Math.pow(1 + rate, months)) / (Math.pow(1 + rate, months) - 1);
    return Math.round(emi);
  });

  emiTotalInterest = computed(() => {
    return (this.emiMonthlyPayment() * this.selectedTenure()) - this.payableAmount();
  });

  // Card validation check
  isCardValid = computed(() => {
    const num = this.cardNumber().replace(/\s+/g, '');
    const exp = this.cardExpiry();
    const cvv = this.cardCvv();
    const holder = this.cardHolder().trim();
    return num.length >= 15 && holder.length > 2 && /^\d{2}\/\d{2}$/.test(exp) && cvv.length >= 3;
  });

  // Transaction references returned by API
  transactionId = signal('');
  paymentProviderRef = signal('');
  newlyCreatedBookingId = signal<string | null>(null);

  ngOnInit() {
    const pkgId = this.route.snapshot.paramMap.get('packageId');
    
    // Fetch Loyalty Balance
    const user = this.auth.currentUser();
    if (user) {
      this.loyaltyService.getBalance(user.id).subscribe({
        next: (bal) => this.availablePoints.set(bal.points),
        error: (err) => console.error('Failed to load points', err)
      });
    }

    // Read details from state or sessionStorage
    let details = history.state?.bookingDetails;
    if (!details) {
      const stored = sessionStorage.getItem('joinevents_booking_pending');
      if (stored) {
        details = JSON.parse(stored);
      }
    }

    if (details) {
      this.bookingDetails.set(details);
      // Pre-populate coupon if it was applied on booking page
      if (details.couponCode) {
        this.couponCode.set(details.couponCode);
        this.appliedCoupon.set(details.couponCode);
      }
    } else if (pkgId) {
      // Dynamic fallback: Load package details from API directly if session is empty
      this.isProcessing.set(true);
      this.processingStep.set('loading');
      this.packageService.getPackageById(pkgId).subscribe({
        next: (pkg) => {
          this.isProcessing.set(false);
          this.processingStep.set('');
          if (pkg) {
            const basePrice = pkg.price || 0;
            const gst = Math.round(basePrice * 0.18);
            const total = basePrice + gst;
            const advance = Math.round(total * 0.2);
            
            const fallbackDetails = {
              packageId: pkg.id,
              packageName: pkg.name,
              packageCategory: pkg.eventTypeId || pkg.category || 'wedding',
              vendorId: pkg.vendorId,
              bookingDate: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0], // 30 days from now
              bookingCity: pkg.location || 'Multiple Locations',
              bookingGuests: pkg.maxGuests || 100,
              selectedAddons: [],
              includeInsurance: false,
              couponCode: '',
              discountAmount: 0,
              basePrice: basePrice,
              addonsTotal: 0,
              gstAmount: gst,
              insurancePrice: 0,
              totalAmount: total,
              advanceAmount: advance
            };
            this.bookingDetails.set(fallbackDetails);
          } else {
            this.errorMessage.set('Package not found. Please select a valid package.');
          }
        },
        error: (err) => {
          this.isProcessing.set(false);
          this.processingStep.set('');
          this.errorMessage.set('Failed to load package details. Please navigate from the package page.');
        }
      });
    } else {
      this.errorMessage.set('No booking details found. Please navigate from the package page.');
    }
  }

  applyCoupon() {
    this.couponError.set('');
    this.couponSuccess.set('');
    
    const code = this.couponCode().trim().toUpperCase();
    if (!code) {
      this.couponError.set('Please enter a coupon code.');
      return;
    }

    if (code === 'WELCOME10') {
      this.appliedCoupon.set(code);
      this.couponSuccess.set('Coupon applied successfully! You got 10% off on base package price.');
    } else {
      this.couponError.set('Invalid coupon code. Try WELCOME10.');
    }
  }

  removeCoupon() {
    this.appliedCoupon.set('');
    this.couponCode.set('');
    this.couponSuccess.set('');
    this.couponError.set('');
  }

  applyPoints() {
    this.pointsError.set('');
    const pts = this.pointsToRedeem();
    const user = this.auth.currentUser();
    if (!user || pts <= 0) return;

    this.isProcessing.set(true);
    this.loyaltyService.calculateDiscount(user.id, pts).subscribe({
      next: (res) => {
        this.isProcessing.set(false);
        if (res.valid) {
          this.loyaltyDiscountAmount.set(res.discountAmount);
          this.toast.success(`${pts} points applied for ₹${res.discountAmount} discount!`);
        } else {
          this.pointsError.set(res.errorMessage || 'Invalid points');
          this.pointsToRedeem.set(0);
          this.loyaltyDiscountAmount.set(0);
        }
      },
      error: () => {
        this.isProcessing.set(false);
        this.pointsError.set('Failed to calculate discount.');
        this.pointsToRedeem.set(0);
        this.loyaltyDiscountAmount.set(0);
      }
    });
  }

  removePoints() {
    this.pointsToRedeem.set(0);
    this.loyaltyDiscountAmount.set(0);
    this.pointsError.set('');
  }

  // Format credit card number with spaces
  onCardNumberInput(event: any) {
    let input = event.target.value.replace(/\D/g, '');
    if (input.length > 16) {
      input = input.substring(0, 16);
    }
    const formatted = input.replace(/(\d{4})(?=\d)/g, '$1 ');
    this.cardNumber.set(formatted);
  }

  // Format expiry MM/YY
  onCardExpiryInput(event: any) {
    let input = event.target.value.replace(/\D/g, '');
    if (input.length > 4) {
      input = input.substring(0, 4);
    }
    if (input.length > 2) {
      input = input.substring(0, 2) + '/' + input.substring(2);
    }
    this.cardExpiry.set(input);
  }

  // CVV format
  onCardCvvInput(event: any) {
    let input = event.target.value.replace(/\D/g, '');
    if (input.length > 4) {
      input = input.substring(0, 4);
    }
    this.cardCvv.set(input);
  }

  autofillCardDetails() {
    if (!environment.production) {
      this.cardHolder.set('John Doe');
      this.cardNumber.set('4111 1111 1111 1111');
      this.cardExpiry.set('12/29');
      this.cardCvv.set('123');
    }
  }

  setErrorMessage(msg: string) {
    this.errorMessage.set(msg);
    if (msg) {
      this.toast.error(msg);
    }
  }

  // Helper function to extract Guid from prefixed string
  private cleanGuid(id: string): string {
    if (!id) return '';
    const hex = id.replace(/^(usr_|pkg_|bk_)/, '');
    if (hex.length === 32) {
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    return id;
  }

  // Submit payment
  payAndConfirm() {
    this.errorMessage.set('');
    
    // Form validation checks
    if (this.paymentMethod() === 'card' && !this.isCardValid()) {
      this.setErrorMessage('Please fill all card details correctly.');
      return;
    }
    if (this.paymentMethod() === 'upi' && (!this.upiId().includes('@') || this.upiId().length < 5)) {
      this.setErrorMessage('Please enter a valid UPI ID (e.g. user@paytm).');
      return;
    }
    if (this.paymentMethod() === 'netbanking' && !this.selectedBank()) {
      this.setErrorMessage('Please select your bank.');
      return;
    }
    if (this.paymentMethod() === 'emi' && !this.selectedEmiBank()) {
      this.setErrorMessage('Please select a bank for EMI.');
      return;
    }

    const currentUserId = this.auth.currentUser()?.id;
    if (!currentUserId) {
      this.setErrorMessage('User authentication session has expired. Please log in again.');
      return;
    }

    const details = this.bookingDetails();
    if (!details) return;

    this.isProcessing.set(true);

    // If this is an existing booking balance payment, skip booking creation!
    if (details.isBalancePayment && (details.id || details.bookingId)) {
      const bookingId = details.id || details.bookingId;
      this.processingStep.set('initiating');

      const paymentPayload = {
        BookingId: this.cleanGuid(bookingId),
        PaymentMethod: this.paymentMethod().toUpperCase(),
        CouponCode: undefined
      };

      this.paymentService.initiatePayment(paymentPayload).subscribe({
        next: (paymentRes) => {
          const providerRef = paymentRes.providerRef || paymentRes.ProviderRef;
          this.paymentProviderRef.set(providerRef);
          this.transactionId.set(paymentRes.paymentId || paymentRes.PaymentId);
          
          this.processingStep.set('verifying');
          setTimeout(() => {
            const confirmPayload = {
              ProviderRef: providerRef,
              Status: 'success'
            };

            this.paymentService.confirmPayment(confirmPayload).subscribe({
              next: () => {
                this.processingStep.set('done');
                this.checkoutSuccess.set(true);
                this.isProcessing.set(false);
                sessionStorage.removeItem('joinevents_booking_pending');
              },
              error: (err) => {
                console.error('Payment confirmation error', err);
                this.setErrorMessage(err.error?.error || 'Failed to confirm payment on server.');
                this.isProcessing.set(false);
              }
            });
          }, 2000);
        },
        error: (err) => {
          console.error('Payment initiation error', err);
          this.setErrorMessage(err.error?.error || 'Failed to initiate payment.');
          this.isProcessing.set(false);
        }
      });
      return;
    }

    this.processingStep.set('creating');

    // Perform real-time availability check first!
    this.vendorService.checkAvailability(details.vendorId, details.bookingDate).subscribe({
      next: (availRes) => {
        if (!availRes.available) {
          this.isProcessing.set(false);
          this.processingStep.set('');
          this.setErrorMessage('The vendor is no longer available on the selected date. Please choose another date.');
          return;
        }

        // 1. Create Booking in database (Pending Status)
        const bookingPayload = {
          UserId: this.cleanGuid(currentUserId),
          VendorId: this.cleanGuid(details.vendorId),
          EventDate: new Date(details.bookingDate).toISOString(),
          Amount: this.payableAmount(),
          TotalAmount: this.totalAmount(),
          AdvanceAmount: this.paymentType() === 'advance' ? this.advanceAmount() : this.totalAmount(),
          Status: 'Pending',
          PackageId: this.cleanGuid(details.packageId),
          PackageName: details.packageName,
          EventName: details.packageName || 'Event Celebration',
          Venue: details.bookingCity || 'Banquet Hall',
          City: details.bookingCity || 'Mumbai',
          GuestCount: parseInt(details.bookingGuests) || 100,
          ApplyPlatformFee: true,
          EscrowStatus: 'held',
          GuaranteeStatus: 'active',
        };

        this.bookingService.createBooking(bookingPayload).subscribe({
          next: (bookingRes) => {
            const bookingId = bookingRes.id || bookingRes.Id;
            this.newlyCreatedBookingId.set(bookingId);
            this.processingStep.set('initiating');

            // 2. Initiate Payment
            const paymentPayload = {
              BookingId: bookingId,
              PaymentMethod: this.paymentMethod().toUpperCase(),
              CouponCode: this.appliedCoupon() || undefined
            };

            this.paymentService.initiatePayment(paymentPayload).subscribe({
              next: (paymentRes) => {
                const providerRef = paymentRes.providerRef || paymentRes.ProviderRef;
                this.paymentProviderRef.set(providerRef);
                this.transactionId.set(paymentRes.paymentId || paymentRes.PaymentId);
                
                // Simulate visual bank response verification
                this.processingStep.set('verifying');
                setTimeout(() => {
                  
                  // 3. Confirm Payment
                  const confirmPayload = {
                    ProviderRef: providerRef,
                    Status: 'success'
                  };

                  this.paymentService.confirmPayment(confirmPayload).subscribe({
                    next: (confirmRes) => {
                      this.processingStep.set('done');
                      this.checkoutSuccess.set(true);
                      this.isProcessing.set(false);
                      
                      // Redeem points if applied
                      if (this.pointsToRedeem() > 0 && currentUserId) {
                        this.loyaltyService.redeemPoints(currentUserId, { bookingId: bookingId, pointsToRedeem: this.pointsToRedeem() }).subscribe();
                      }

                      // Clear sessionStorage since transaction is done
                      sessionStorage.removeItem('joinevents_booking_pending');
                    },
                    error: (err) => {
                      console.error('Payment confirmation error', err);
                      this.setErrorMessage(err.error?.error || 'Failed to confirm payment on server.');
                      this.isProcessing.set(false);
                    }
                  });

                }, 2000); // Visual gateway processing delay
              },
              error: (err) => {
                console.error('Payment initiation error', err);
                this.setErrorMessage(err.error?.error || 'Failed to initiate payment.');
                this.isProcessing.set(false);
              }
            });
          },
          error: (err) => {
            console.error('Booking creation error', err);
            this.setErrorMessage(err.error?.error || 'Failed to create booking.');
            this.isProcessing.set(false);
          }
        });
      },
      error: (err) => {
        console.error('Error checking availability at checkout:', err);
        this.isProcessing.set(false);
        this.processingStep.set('');
        this.setErrorMessage('Unable to verify vendor availability. Please try again.');
      }
    });
  }
}
