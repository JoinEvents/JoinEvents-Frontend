import { Component, signal, computed, OnInit, OnDestroy, inject, effect, Input, SimpleChanges, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PackageService } from '../../core/services/package.service';
import { EventPackage } from '../../core/models/event.model';
import { AuthService } from '../../core/services/auth.service';
import { ReviewService } from '../../core/services/review.service';
import { ToastService } from '../../core/services/toast.service';
import { BookingService } from '../../core/services/booking.service';
import { Booking } from '../../core/models/booking.model';

@Component({
  selector: 'app-customer-booking',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './booking.html',
  styleUrl: './booking.css'
})
export class CustomerBooking implements OnInit, OnDestroy, OnChanges {
  @Input() packageId?: string;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(PackageService);
  private auth = inject(AuthService);
  private reviewService = inject(ReviewService);
  private toast = inject(ToastService);
  private bookingService = inject(BookingService);

  userRole = computed(() => this.auth.currentUser()?.role);

  localReviews = signal<any[]>([
    { 
      id: 'rev1', 
      bookingId: 'bk002', 
      vendorId: 'v1', 
      customerName: 'Rajesh Kumar', 
      eventName: "Daughter's Birthday", 
      rating: 5, 
      comment: "Fantastic service! The decor was exactly as requested and the food was delicious. Highly recommend this vendor.", 
      date: '2025-11-22',
      status: 'published',
      disputeReason: ''
    },
    { 
      id: 'rev2', 
      bookingId: 'bk009', 
      vendorId: 'v1', 
      customerName: 'Anita Singh', 
      eventName: "Corporate Gala", 
      rating: 1, 
      comment: "Worst service ever. They didn't show up on time and the food was cold. Completely ruined the event.", 
      date: '2026-02-14',
      status: 'flagged', 
      disputeReason: 'Fake review. This customer cancelled the booking 2 days prior and we never provided service.'
    }
  ]);

  vendorReviews = computed(() => {
    const pkg = this.selectedPackage();
    if (!pkg || !pkg.vendorId) return [];
    return this.localReviews().filter(r => r.vendorId === pkg.vendorId && r.status === 'published');
  });

  showAllReviews = signal(false);

  displayedReviews = computed(() => {
    const reviews = this.vendorReviews();
    return this.showAllReviews() ? reviews : reviews.slice(0, 3);
  });

  averageRating = computed(() => {
    const reviews = this.vendorReviews();
    if (reviews.length === 0) return 4.8; // Fallback to package rating/default if no reviews
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return sum / reviews.length;
  });

  ratingDistribution = computed(() => {
    const reviews = this.vendorReviews();
    const dist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(r => {
      const rating = Math.round(r.rating);
      if (dist[rating] !== undefined) {
        dist[rating]++;
      }
    });
    return dist;
  });

  selectedPackage = signal<any | null>(null);
  similarPackages = signal<any[]>([]);
  selectedAddons = signal<any[]>([]);
  includeInsurance = signal(false);
  bookingDate = '';
  bookingCity = '';
  bookingGuests = '';
  couponCode = '';
  discountAmount = signal(0);
  bookingSuccess = signal(false);
  isLoading = signal(false);
  minDate = new Date().toISOString().split('T')[0];
  showMobileBooking = signal(false);
  selectedServiceDetail = signal<any | null>(null);
  selectedImage = signal<string | null>(null);

  userBookings = signal<Booking[]>([]);

  completedBookingForPackage = computed(() => {
    const pkg = this.selectedPackage();
    const bookings = this.userBookings();
    if (!pkg || !bookings || bookings.length === 0) return null;
    return bookings.find(b => b.packageId === pkg.id && (b.status === 'completed' || b.status === 'settled')) || null;
  });

  existingReview = computed(() => {
    const booking = this.completedBookingForPackage();
    if (!booking) return null;
    return this.localReviews().find(r => r.bookingId === booking.id) || null;
  });

  showReviewForm = signal(false);
  newRating = signal(5);
  newComment = '';
  newReviewEventName = '';

  toggleReviewForm() {
    const show = !this.showReviewForm();
    this.showReviewForm.set(show);
    if (show) {
      const existing = this.existingReview();
      const booking = this.completedBookingForPackage();
      if (existing) {
        this.newRating.set(existing.rating);
        this.newComment = existing.comment;
        this.newReviewEventName = existing.eventName || booking?.eventName || 'Event Celebration';
      } else {
        this.newRating.set(5);
        this.newComment = '';
        this.newReviewEventName = booking?.eventName || 'Event Celebration';
      }
    }
  }
  
  private slideshowInterval: any;

  constructor() {
    effect(() => {
      const isModalOpen = !!this.selectedServiceDetail() || this.showMobileBooking() || this.bookingSuccess();
      document.body.classList.toggle('modal-open', isModalOpen);
    });
  }

  ngOnInit() {
    const pkgId = this.packageId || this.route.snapshot.paramMap.get('packageId');
    if (pkgId) {
      this.loadPackage(pkgId);
    }
    this.loadUserBookings();
  }

  loadUserBookings() {
    const user = this.auth.currentUser();
    if (user && user.role === 'customer') {
      this.bookingService.getBookings(user.id).subscribe({
        next: (bookings) => {
          this.userBookings.set(bookings || []);
        },
        error: (err) => {
          console.error('Error loading user bookings:', err);
          this.userBookings.set([]);
        }
      });
    } else {
      this.userBookings.set([]);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['packageId'] && !changes['packageId'].isFirstChange()) {
      if (this.packageId) {
        this.loadPackage(this.packageId);
      }
    }
  }

  ngOnDestroy() {
    this.stopSlideshow();
    document.body.classList.remove('modal-open');
  }

  loadPackage(pkgId: string) {
    this.isLoading.set(true);
    this.api.getPackageById(pkgId).subscribe({
      next: (pkg) => {
        this.isLoading.set(false);
        if (pkg) {
          console.log('Loaded Package Data:', pkg);
          this.selectedPackage.set(pkg);
          this.selectedImage.set(pkg.image || pkg.images?.[0]);
          
          // Load similar packages (exclude current one)
          this.api.getPackages(pkg.eventTypeId).subscribe(pkgs => {
            const similar = pkgs.filter(p => p.id !== pkgId);
            this.similarPackages.set(similar.slice(0, 3));
          });
          
          // Start slideshow if multiple images exist
          if (pkg.images?.length > 1) {
            this.startSlideshow();
          }
        } else {
          const role = this.userRole();
          const target = role === 'customer' ? '/dashboard' : `/${role}/dashboard`;
          this.router.navigate([target]);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Error loading package:', err);
        const role = this.userRole();
        const target = role === 'customer' ? '/dashboard' : `/${role}/dashboard`;
        this.router.navigate([target]);
      }
    });
  }


  submitReview() {
    const pkg = this.selectedPackage();
    const currentUser = this.auth.currentUser();
    const booking = this.completedBookingForPackage();
    if (!pkg || !pkg.vendorId) return;

    if (!currentUser) {
      this.toast.error('You must be logged in to submit a review.');
      return;
    }

    if (!booking) {
      this.toast.error('You must have a completed booking for this package to submit a review.');
      return;
    }

    if (!this.newComment.trim()) {
      this.toast.error('Please enter a comment.');
      return;
    }

    const customerName = currentUser.name || 'Anonymous User';
    const isEdit = !!this.existingReview();
    const oldReviewRating = this.existingReview()?.rating || 0;
    
    this.reviewService.submitReview({
      bookingId: booking.id,
      vendorId: pkg.vendorId,
      customerName: customerName,
      eventName: this.newReviewEventName || booking.eventName || 'Event Celebration',
      rating: this.newRating(),
      comment: this.newComment.trim()
    }).subscribe({
      next: (res) => {
        this.toast.success('Thank you! Your review has been submitted successfully.');
        
        this.localReviews.update(reviews => {
          const newRev = {
            id: 'rev_' + Date.now(),
            bookingId: booking.id,
            vendorId: pkg.vendorId,
            customerName: customerName,
            eventName: this.newReviewEventName || booking.eventName || 'Event Celebration',
            rating: this.newRating(),
            comment: this.newComment.trim(),
            date: new Date().toISOString().split('T')[0],
            status: 'published',
            disputeReason: ''
          };
          const existingIdx = reviews.findIndex(r => r.bookingId === booking.id);
          if (existingIdx > -1) {
            const updated = [...reviews];
            updated[existingIdx] = { ...updated[existingIdx], rating: newRev.rating, comment: newRev.comment, date: newRev.date };
            return updated;
          }
          return [...reviews, newRev];
        });

        this.selectedPackage.update(p => {
          if (!p) return p;
          const oldTotal = p.totalReviews || 0;
          const oldRating = p.rating || 0;
          
          let newTotal = oldTotal;
          let newRating = oldRating;
          
          if (isEdit) {
            const totalSum = (oldRating * oldTotal) - oldReviewRating + this.newRating();
            newRating = oldTotal > 0 ? (totalSum / oldTotal) : this.newRating();
          } else {
            newTotal = oldTotal + 1;
            newRating = ((oldRating * oldTotal) + this.newRating()) / newTotal;
          }
          
          return { ...p, rating: newRating, totalReviews: newTotal };
        });
        
        this.newComment = '';
        this.newRating.set(5);
        this.showReviewForm.set(false);
      },
      error: (err) => {
        this.toast.error('Failed to submit review.');
      }
    });
  }

  getUserColor(name: string): string {
    if (!name) return '#FF6B35';
    const colors = [
      'linear-gradient(135deg, #FF6B6B, #FF8E53)',
      'linear-gradient(135deg, #4E54C8, #8F94FB)',
      'linear-gradient(135deg, #11998E, #38EF7D)',
      'linear-gradient(135deg, #FC466B, #3F5EFB)',
      'linear-gradient(135deg, #FF9966, #FF5E62)',
      'linear-gradient(135deg, #7F00FF, #E100FF)'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  startSlideshow() {
    this.stopSlideshow();
    this.slideshowInterval = setInterval(() => {
      const pkg = this.selectedPackage();
      if (!pkg || !pkg.images || pkg.images.length <= 1) return;

      const currentIdx = pkg.images.indexOf(this.selectedImage());
      const nextIdx = (currentIdx + 1) % pkg.images.length;
      this.selectedImage.set(pkg.images[nextIdx]);
    }, 4000); // Change every 4 seconds
  }

  stopSlideshow() {
    if (this.slideshowInterval) {
      clearInterval(this.slideshowInterval);
    }
  }

  selectGalleryImage(img: string) {
    this.selectedImage.set(img);
    this.startSlideshow(); // Reset timer when manually clicked
  }

  openServiceDetail(serviceName: string) {
    // Mock service details based on actual package items
    const detailsMap: any = {
      'Gourmet 5-Course Dinner': {
        name: 'Gourmet 5-Course Royal Feast',
        description: 'An extraordinary culinary journey featuring appetizers, global main courses, and a signature dessert bar. Prepared live by award-winning chefs.',
        images: [
          'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&q=80&w=800',
          'https://images.unsplash.com/photo-1530103043960-ef38714abb15?auto=format&fit=crop&q=80&w=800'
        ],
        features: ['Silver Service Dining', 'Live Pasta & Sushi Counters', 'Signature Mocktail Bar', 'Customized Menu Planning']
      },
      'Premium Bridal Suite': {
        name: 'Royal Bridal & Groom Suites',
        description: 'Luxurious, fully-furnished private suites with dedicated vanity areas, lounge seating, and personalized butler service for the couple.',
        images: [
          'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=800',
          'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&q=80&w=800'
        ],
        features: ['Private En-suite Bathroom', 'Makeup & Styling Station', 'Refreshment Bar', 'Biometric Security']
      },
      'Drone Photography': {
        name: 'Cinematic Drone & 4K Coverage',
        description: 'Capture grand aerial perspectives of your celebration with our high-end drone fleet and 4K cinematography team.',
        images: [
          'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&q=80&w=800',
          'https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&q=80&w=800'
        ],
        features: ['Dual Drone Operators', 'Unedited Raw Footage', 'Cinematic Highlight Film', '4K Aerial Stills']
      },
      'Designer Stage Decor': {
        name: 'Bespoke Designer Stage',
        description: 'A grand architectural stage design featuring imported florals, custom LED backdrops, and synchronized mood lighting.',
        images: [
          'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&q=80&w=800',
          'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=800'
        ],
        features: ['Fresh Floral Chandeliers', 'Customized Backdrop', 'Ambient LED Mapping', 'Grand Entrance Decor']
      },
      'VIP Valet Parking': {
        name: 'VIP Valet & Concierge',
        description: 'Seamless arrival experience with professional uniformed valets and a dedicated guest concierge desk.',
        images: [
          'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&q=80&w=800'
        ],
        features: ['Professional Uniformed Valets', 'Express Retrieval', 'Guest Umbrella Service', 'Reserved VIP Zone']
      },
      'Live Sufi Band': {
        name: 'Soulful Live Sufi Ensemble',
        description: 'Experience divine musical harmony with a 7-piece live ensemble performing traditional and modern Sufi classics.',
        images: [
          'https://images.unsplash.com/photo-1514525253361-bee8a4874aad?auto=format&fit=crop&q=80&w=800'
        ],
        features: ['7-Piece Ensemble', 'Professional Sound System', 'Customized Setlist', 'Interactive Performance']
      }
    };

    const details = detailsMap[serviceName] || {
      name: serviceName,
      description: `Comprehensive ${serviceName} services provided by our verified professional partners, ensuring top-tier quality and reliability for your event.`,
      images: ['https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=800'],
      features: ['Professional Service', 'JoinEvents Verified', 'Quality Guaranteed']
    };

    this.selectedServiceDetail.set(details);
  }

  getGstAmount() {
    const base = (this.selectedPackage()?.price || 0) + this.getAddonsTotal();
    return Math.round(base * 0.18);
  }

  getAddonsTotal() {
    return this.selectedAddons().reduce((sum, a) => sum + a.price, 0);
  }

  getInsurancePrice() {
    return this.includeInsurance() ? (this.selectedPackage()?.insurancePrice || 0) : 0;
  }

  getAdvanceAmount() {
    const total = this.getTotalAmount();
    return Math.round(total * 0.2);
  }

  getTotalAmount() {
    const base = (this.selectedPackage()?.price || 0) + this.getAddonsTotal() + this.getGstAmount() + this.getInsurancePrice();
    return base - this.discountAmount();
  }

  toggleAddon(addon: any) {
    const current = this.selectedAddons();
    const index = current.findIndex(a => a.id === addon.id);
    if (index > -1) {
      this.selectedAddons.set(current.filter(a => a.id !== addon.id));
    } else {
      this.selectedAddons.set([...current, addon]);
    }
  }

  applyCoupon() {
    if (this.couponCode.toUpperCase() === 'WELCOME10') {
      this.discountAmount.set(Math.round((this.selectedPackage()?.price || 0) * 0.1));
    } else {
      alert('Invalid Coupon Code');
      this.discountAmount.set(0);
    }
  }

  confirmBooking() {
    const pkg = this.selectedPackage();
    if (!pkg) return;

    const bookingDetails = {
      packageId: pkg.id,
      packageName: pkg.name,
      packageCategory: pkg.category,
      vendorId: pkg.vendorId,
      bookingDate: this.bookingDate,
      bookingCity: this.bookingCity || pkg.address?.city || pkg.city || '',
      bookingGuests: this.bookingGuests || '0',
      selectedAddons: this.selectedAddons(),
      includeInsurance: this.includeInsurance(),
      couponCode: this.couponCode,
      discountAmount: this.discountAmount(),
      basePrice: pkg.price || 0,
      addonsTotal: this.getAddonsTotal(),
      gstAmount: this.getGstAmount(),
      insurancePrice: this.getInsurancePrice(),
      totalAmount: this.getTotalAmount(),
      advanceAmount: this.getAdvanceAmount()
    };

    sessionStorage.setItem('joinevents_booking_pending', JSON.stringify(bookingDetails));
    this.router.navigate(['/checkout', pkg.id]);
  }

  handleImageFallback(event: Event, fallbackUrl: string) {
    const img = event.target as HTMLImageElement;
    if (img.src !== fallbackUrl) {
      img.src = fallbackUrl;
    }
  }
}
