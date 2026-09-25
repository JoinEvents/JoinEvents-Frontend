import { Component, signal, computed, OnInit, OnDestroy, inject, effect, Input, SimpleChanges, OnChanges } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PackageService } from '../../core/services/package.service';
import { EventPackage } from '../../core/models/event.model';
import { AuthService } from '../../core/services/auth.service';
import { ReviewService } from '../../core/services/review.service';
import { ToastService } from '../../core/services/toast.service';
import { BookingService } from '../../core/services/booking.service';
import { Booking, BookingQuote } from '../../core/models/booking.model';
import { Subscription } from 'rxjs';
import { CheckoutDraft, saveCheckoutDraft } from '../checkout/checkout-draft';
import { EventTierService } from '../../core/services/event-tier.service';

import { FavoritesService } from '../../core/services/favorites.service';
import { VendorService } from '../../core/services/vendor.service';

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
  public eventTierService = inject(EventTierService);
  public favoritesService = inject(FavoritesService);
  private vendorService = inject(VendorService);

  userRole = computed(() => this.auth.currentUser()?.role);

  localReviews = signal<any[]>([]);

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
    if (reviews.length === 0) {
      return this.selectedPackage()?.rating || 0.0;
    }
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return sum / reviews.length;
  });

  totalReviewsCount = computed(() => {
    const reviews = this.vendorReviews();
    if (reviews.length === 0) {
      return this.selectedPackage()?.totalReviews || 0;
    }
    return reviews.length;
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
  bookingDate = '';
  isDateAvailable = signal<boolean>(true);
  checkingAvailability = signal<boolean>(false);
  eventName = '';
  bookingVenue = '';
  bookingCity = '';
  bookingGuests: number | null = null;

  /** The server's price for the chosen guest count — what the booking will actually charge. */
  quote = signal<BookingQuote | null>(null);
  quoteError = signal('');
  quoting = signal(false);
  private quoteSubscription?: Subscription;
  private quoteTimer?: ReturnType<typeof setTimeout>;
  bookingSuccess = signal(false);
  isLoading = signal(false);
  minDate = new Date().toISOString().split('T')[0];
  showMobileBooking = signal(false);
  selectedServiceDetail = signal<any | null>(null);
  selectedModalImage = signal<string | null>(null);
  selectedImage = signal<string | null>(null);
  activeInclusionImages = signal<Record<string, string>>({});

  setInclusionImage(inclusionName: string, imageUrl: string) {
    this.activeInclusionImages.update(dict => ({
      ...dict,
      [inclusionName]: imageUrl
    }));
  }

  getInclusionImage(inclusionName: string, firstImageUrl: string): string {
    return this.activeInclusionImages()[inclusionName] || firstImageUrl;
  }

  includedCategories = [
    { name: 'Venue', icon: 'bi-building', key: 'venue' },
    { name: 'Catering', icon: 'bi-egg-fried', key: 'catering' },
    { name: 'Decoration', icon: 'bi-flower1', key: 'decoration' },
    { name: 'Transport', icon: 'bi-car-front-fill', key: 'transport' },
    { name: 'Priest', icon: 'bi-fire', key: 'priest' },
    { name: 'Manpower', icon: 'bi-people', key: 'manpower' },
    { name: 'Photography', icon: 'bi-camera', key: 'photography' },
    { name: 'Music & DJ', icon: 'bi-music-note-beamed', key: 'music' }
  ];

  displayedCategories = computed(() => {
    const pkg = this.selectedPackage();
    if (!pkg) return [];

    const services: string[] = pkg.services || [];
    
    // Track which services were matched
    const matchedServices = new Set<string>();
    
    const standardMatches = this.includedCategories.filter(cat => {
      const match = this.getServiceForCategory(cat.key);
      if (match) {
        matchedServices.add(match);
        return true;
      }
      return false;
    });
    
    // Find unmatched services
    const unmatchedCategories = services
      .filter(s => !matchedServices.has(s))
      .map(s => {
        // Resolve a suitable icon
        let icon = 'bi-check2-circle';
        const lower = s.toLowerCase();
        if (lower.includes('makeup') || lower.includes('salon') || lower.includes('beauty') || lower.includes('hair') || lower.includes('styling')) {
          icon = 'bi-stars';
        } else if (lower.includes('mehendi') || lower.includes('henna')) {
          icon = 'bi-brush';
        } else if (lower.includes('invite') || lower.includes('card')) {
          icon = 'bi-envelope-paper-heart';
        } else if (lower.includes('gift') || lower.includes('hamper')) {
          icon = 'bi-gift';
        } else if (lower.includes('guide') || lower.includes('tour')) {
          icon = 'bi-map';
        } else if (lower.includes('wear') || lower.includes('outfit') || lower.includes('saree') || lower.includes('sherwani') || lower.includes('clothing')) {
          icon = 'bi-tags-fill';
        }
        
        return {
          name: s,
          icon: icon,
          key: s
        };
      });
      
    return [
      ...standardMatches,
      ...unmatchedCategories
    ];
  });

  allGalleryImages = computed(() => {
    return this.getCombinedImages(this.selectedPackage());
  });

  getCombinedImages(pkg: any): string[] {
    if (!pkg) return [];
    const images = new Set<string>();
    if (pkg.image) images.add(pkg.image);
    if (Array.isArray(pkg.images)) {
      pkg.images.forEach((img: string) => images.add(img));
    }
    if (pkg.inclusionDetails) {
      Object.keys(pkg.inclusionDetails).forEach(key => {
        const details = pkg.inclusionDetails[key];
        if (details) {
          if (Array.isArray(details.images)) {
            details.images.forEach((img: string) => images.add(img));
          } else if (details.imageUrl) {
            images.add(details.imageUrl);
          }
        }
      });
    }
    return Array.from(images);
  }

  getServiceForCategory(categoryKey: string): string | null {
    const pkg = this.selectedPackage();
    if (!pkg || !pkg.services) return null;
    
    const services: string[] = pkg.services;
    const isStandard = ['venue', 'catering', 'decoration', 'transport', 'priest', 'manpower', 'photography', 'music'].includes(categoryKey.toLowerCase());
    
    if (isStandard) {
      return services.find(s => {
        const lower = s.toLowerCase();
        if (categoryKey === 'venue') return lower.includes('venue') || lower.includes('suite') || lower.includes('hall') || lower.includes('banquet') || lower.includes('space') || lower.includes('room');
        if (categoryKey === 'catering') return lower.includes('catering') || lower.includes('dinner') || lower.includes('feast') || lower.includes('food') || lower.includes('meal') || lower.includes('buffet') || lower.includes('veg');
        if (categoryKey === 'decoration') return lower.includes('decor') || lower.includes('stage') || lower.includes('flower') || lower.includes('theme');
        if (categoryKey === 'transport') return lower.includes('transport') || lower.includes('car') || lower.includes('travel') || lower.includes('coach') || lower.includes('chauffeur') || lower.includes('cab') || lower.includes('bus');
        if (categoryKey === 'priest') return lower.includes('priest') || lower.includes('pandit') || lower.includes('pujari') || lower.includes('hawan') || lower.includes('ritual') || lower.includes('vedic');
        if (categoryKey === 'manpower') return lower.includes('manpower') || lower.includes('staff') || lower.includes('security') || lower.includes('valet') || lower.includes('host') || lower.includes('anchor') || lower.includes('coordinator') || lower.includes('manager');
        if (categoryKey === 'photography') return lower.includes('photo') || lower.includes('video') || lower.includes('camera') || lower.includes('drone') || lower.includes('shoot') || lower.includes('film');
        if (categoryKey === 'music') return lower.includes('music') || lower.includes('dj') || lower.includes('sound') || lower.includes('light') || lower.includes('band') || lower.includes('av');
        return false;
      }) || null;
    }
    
    return services.find(s => s === categoryKey) || null;
  }

  hasCategory(categoryKey: string): boolean {
    return !!this.getServiceForCategory(categoryKey);
  }

  onCategoryClick(cat: any) {
    const serviceName = this.getServiceForCategory(cat.key);
    if (serviceName) {
      this.openServiceDetail(serviceName);
    } else {
      // Find a matching addon
      const pkg = this.selectedPackage();
      const matchingAddon = pkg?.addons?.find((a: any) => {
        const lower = a.name.toLowerCase();
        if (cat.key === 'venue') return lower.includes('venue') || lower.includes('hall') || lower.includes('suite');
        if (cat.key === 'catering') return lower.includes('catering') || lower.includes('food') || lower.includes('meal') || lower.includes('buffet') || lower.includes('dinner');
        if (cat.key === 'decoration') return lower.includes('decor') || lower.includes('flower') || lower.includes('stage');
        if (cat.key === 'transport') return lower.includes('transport') || lower.includes('car') || lower.includes('travel') || lower.includes('coach') || lower.includes('chauffeur');
        if (cat.key === 'priest') return lower.includes('priest') || lower.includes('pandit') || lower.includes('pujari') || lower.includes('ritual');
        if (cat.key === 'manpower') return lower.includes('manpower') || lower.includes('staff') || lower.includes('security') || lower.includes('valet') || lower.includes('host') || lower.includes('anchor');
        if (cat.key === 'photography') return lower.includes('photo') || lower.includes('video') || lower.includes('camera') || lower.includes('drone');
        if (cat.key === 'music') return lower.includes('music') || lower.includes('dj') || lower.includes('sound') || lower.includes('band');
        return false;
      });

      if (matchingAddon) {
        this.toast.info(`${cat.name} is not included in the base package, but you can add it as a customized experience below!`);
        const el = document.querySelector('.addons-grid');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        this.toast.info(`${cat.name} is not included in this package.`);
      }
    }
  }

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

  scrollToReviews() {
    const el = document.getElementById('reviews-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
          if (!environment.production) { console.error('Error loading user bookings:', err); }
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
    this.quoteSubscription?.unsubscribe();
    clearTimeout(this.quoteTimer);
    this.stopSlideshow();
    document.body.classList.remove('modal-open');
  }  loadPackage(pkgId: string) {
    this.isLoading.set(true);
    this.api.getPackageById(pkgId).subscribe({
      next: (pkg) => {
        this.isLoading.set(false);
        if (pkg) {
          if (!environment.production) { console.log('Loaded Package Data:', pkg); }
          this.selectedPackage.set(pkg);
          this.prefillBookingFields(pkg);
          const combinedImages = this.getCombinedImages(pkg);
          this.selectedImage.set(combinedImages[0] || pkg.image);
          
          this.loadReviewsForVendor(pkg.vendorId);
          
          // Load similar packages (exclude current one)
          this.api.getPackages(pkg.eventTypeId).subscribe(pkgs => {
            const similar = pkgs.filter(p => p.id !== pkgId).map(p => ({
              ...p,
              images: p.images && p.images.length > 0 ? p.images : (p.image ? [p.image] : []),
              activeImageIndex: 0
            }));
            this.similarPackages.set(similar.slice(0, 3));
          });
          
          // Start slideshow if multiple images exist
          if (combinedImages.length > 1) {
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
        if (!environment.production) { console.error('Error loading package:', err); }
        const role = this.userRole();
        const target = role === 'customer' ? '/dashboard' : `/${role}/dashboard`;
        this.router.navigate([target]);
      }
    });
  }

  /** Starts the booking form from the package's own capacity and address. */
  private prefillBookingFields(pkg: any) {
    const address = pkg.address || {};
    this.bookingCity = address.city || address.City || '';
    this.bookingVenue = [address.street || address.Street, address.locality || address.Locality, this.bookingCity]
      .filter((part: string | undefined) => !!part && part.trim())
      .join(', ');
    this.bookingGuests = pkg.maxGuests > 0 ? pkg.maxGuests : null;
    this.refreshQuote();
  }

  loadReviewsForVendor(vendorId: string) {
    if (!vendorId) return;
    this.reviewService.getReviewsByVendor(vendorId).subscribe({
      next: (reviews) => {
        if (reviews) {
          this.localReviews.set(reviews);
        }
      },
      error: (err) => {
        if (!environment.production) { console.error('Error loading vendor reviews:', err); }
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
            customerAvatar: currentUser?.avatar || null,
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
        this.loadReviewsForVendor(pkg.vendorId);
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
      const images = this.allGalleryImages();
      if (images.length <= 1) return;

      const currentVal = this.selectedImage();
      const currentIdx = currentVal ? images.indexOf(currentVal) : -1;
      const nextIdx = (currentIdx + 1) % images.length;
      this.selectedImage.set(images[nextIdx]);
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

  /**
   * Shows what the vendor entered for one service of the package: its description, photos,
   * price, key features and inclusions, plus the package facts that belong to it (cuisine and
   * catering policy for catering; capacity, rooms, amenities and policies for a venue). Nothing
   * is invented when the vendor left something out.
   */
  openServiceDetail(serviceName: string) {
    this.selectedModalImage.set(null);
    const pkg = this.selectedPackage();
    const details = pkg?.inclusionDetails?.[serviceName];
    const lower = serviceName.toLowerCase();

    const features = [...toList(details?.keyFeatures), ...toList(details?.inclusions)];

    if (lower.includes('catering')) {
      if (pkg?.pricing?.cuisine) features.push(`Cuisine: ${pkg.pricing.cuisine}`);
      const food = cuisineLabel(pkg?.pricing?.cuisineType);
      if (food) features.push(`Food: ${food}`);
      if (pkg?.policies?.cateringPolicy) features.push(`Catering policy: ${pkg.policies.cateringPolicy}`);
    } else if (lower === 'venue' || lower.includes('venue')) {
      if (pkg?.maxGuests) features.push(`Capacity: up to ${pkg.maxGuests} guests`);
      if (pkg?.roomCount) features.push(`Rooms: ${pkg.roomCount}`);
      if (pkg?.amenities?.hasAc) features.push('Air conditioning');
      if (pkg?.amenities?.hasPowerBackup) features.push('Power backup');
      if (pkg?.amenities?.hasChangingRooms) features.push('Changing rooms');
      if (pkg?.amenities?.hasParking) features.push('Parking');
      if (pkg?.policies?.alcoholPolicy) features.push(`Alcohol policy: ${pkg.policies.alcoholPolicy}`);
      if (pkg?.policies?.decorPolicy) features.push(`Decor policy: ${pkg.policies.decorPolicy}`);
      if (pkg?.policies?.djPolicy) features.push(`DJ policy: ${pkg.policies.djPolicy}`);
    }

    const images: string[] = Array.isArray(details?.images) && details.images.length
      ? details.images
      : (details?.imageUrl ? [details.imageUrl] : []);

    this.selectedServiceDetail.set({
      name: serviceName,
      description: details?.description || '',
      images,
      features,
      priceRange: priceRangeLabel(details, lower.includes('catering'))
    });
  }

  /** The total for the chosen guest count, or the package's listed price before one is chosen. */
  getTotalAmount(): number {
    return this.quote()?.totalAmount ?? (this.selectedPackage()?.price || 0);
  }

  getAdvanceAmount(): number {
    return this.quote()?.advanceAmount ?? 0;
  }

  onGuestsChange(value: number | string | null) {
    const guests = Number(value);
    this.bookingGuests = Number.isFinite(guests) && guests > 0 ? Math.floor(guests) : null;
    // Re-price once the customer stops typing.
    clearTimeout(this.quoteTimer);
    this.quoteTimer = setTimeout(() => this.refreshQuote(), 350);
  }

  /** Asks the server for the price of the current package and guest count. */
  refreshQuote() {
    const pkg = this.selectedPackage();
    this.quoteSubscription?.unsubscribe();
    this.quoteError.set('');
    if (!pkg || !this.bookingGuests) {
      this.quote.set(null);
      this.quoting.set(false);
      return;
    }
    this.quoting.set(true);
    this.quoteSubscription = this.bookingService.getQuote(pkg.id, this.bookingGuests).subscribe({
      next: quote => {
        this.quote.set(quote);
        this.quoting.set(false);
      },
      error: err => {
        this.quote.set(null);
        this.quoting.set(false);
        this.quoteError.set(err?.error?.error || 'Could not price this package. Please try again.');
      }
    });
  }

  onDateChange(date: string) {
    this.bookingDate = date;
    const pkg = this.selectedPackage();
    if (!date || !pkg || !pkg.vendorId) {
      this.isDateAvailable.set(true);
      return;
    }
    this.checkingAvailability.set(true);
    this.vendorService.checkAvailability(pkg.vendorId, date).subscribe({
      next: (res) => {
        this.isDateAvailable.set(res.available);
        this.checkingAvailability.set(false);
      },
      error: (err) => {
        if (!environment.production) { console.error('Error checking availability:', err); }
        // Fallback to true if server error, but log it
        this.isDateAvailable.set(true);
        this.checkingAvailability.set(false);
      }
    });
  }

  confirmBooking() {
    const pkg = this.selectedPackage();
    if (!pkg) return;

    if (this.userRole() && this.userRole() !== 'customer') {
      this.toast.error('Sign in with a customer account to book a package.');
      return;
    }
    if (!this.bookingDate) {
      this.toast.error('Please select an event date.');
      return;
    }
    if (!this.isDateAvailable()) {
      this.toast.error('The selected date is no longer available. Please select another date.');
      return;
    }
    if (!this.bookingGuests) {
      this.toast.error('Enter the number of guests.');
      return;
    }
    if (this.quoteError()) {
      this.toast.error(this.quoteError());
      return;
    }
    if (!this.quote() || this.quoting()) {
      this.toast.error('Please wait while we price your booking.');
      return;
    }
    if (!this.bookingCity.trim()) {
      this.toast.error('Enter the city of the event.');
      return;
    }
    if (!this.bookingVenue.trim()) {
      this.toast.error('Enter the venue of the event.');
      return;
    }

    const draft: CheckoutDraft = {
      packageId: pkg.id,
      vendorId: pkg.vendorId,
      packageName: pkg.name,
      category: pkg.category,
      eventName: this.eventName.trim() || pkg.name,
      eventDate: this.bookingDate,
      venue: this.bookingVenue.trim(),
      city: this.bookingCity.trim(),
      guestCount: this.bookingGuests
    };
    saveCheckoutDraft(draft);
    this.router.navigate(['/checkout', pkg.id], { state: { checkout: draft } });
  }

  handleImageFallback(event: Event, fallbackUrl: string) {
    const img = event.target as HTMLImageElement;
    if (img.src !== fallbackUrl) {
      img.src = fallbackUrl;
    }
  }

  isFavorite(id: string): boolean {
    return this.favoritesService.isFavorite(id);
  }

  toggleFavorite(event: Event, pkg: any) {
    event.stopPropagation();
    this.favoritesService.toggleFavorite({
      id: pkg.id,
      name: pkg.name,
      type: 'package',
      subtitle: `${pkg.location} • ₹${(pkg.price / 100000).toFixed(1)}L`,
      routeUrl: `/events/vendors?${pkg.eventTypeId || 'wedding'}=${pkg.id}`
    });
  }
}

/** A vendor list field, stored either as an array or as comma-separated text. */
function toList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(v => v.trim()).filter(Boolean);
  return [];
}

function cuisineLabel(type: string | undefined): string {
  switch (type) {
    case 'veg': return 'Veg';
    case 'nonveg': return 'Non-veg';
    case 'mixed': return 'Veg & non-veg';
    default: return '';
  }
}

/** Catering priced like a plate rate is shown per plate, as the server charges it per guest. */
const PER_PLATE_THRESHOLD = 5000;

function priceRangeLabel(details: { minPrice?: number; maxPrice?: number } | undefined, isCatering: boolean): string {
  const min = Number(details?.minPrice) || 0;
  const max = Number(details?.maxPrice) || 0;
  if (!min) return '';
  const suffix = isCatering && min < PER_PLATE_THRESHOLD ? ' per plate' : '';
  const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  return max > min ? `${money(min)} – ${money(max)}${suffix}` : `${money(min)}${suffix}`;
}
