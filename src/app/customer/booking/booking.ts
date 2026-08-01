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
import { Booking } from '../../core/models/booking.model';
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
  selectedAddons = signal<any[]>([]);
  includeInsurance = signal(false);
  bookingDate = '';
  isDateAvailable = signal<boolean>(true);
  checkingAvailability = signal<boolean>(false);
  bookingCity = '';
  bookingGuests = '';
  couponCode = '';
  discountAmount = signal(0);
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

  openServiceDetail(serviceName: string) {
    this.selectedModalImage.set(null);
    const pkg = this.selectedPackage();

    const lowerName = serviceName.toLowerCase();
    if (lowerName.includes('catering') || lowerName.includes('dinner') || lowerName.includes('food') || lowerName.includes('feast') || lowerName.includes('meal') || lowerName.includes('buffet') || lowerName.includes('veg')) {
      const features = ['Professional Service', 'JoinEvents Verified'];
      
      let cuisineText = 'Not Specified';
      if (pkg?.pricing?.cuisineType === 'mixed' || (pkg?.pricing?.vegPrice && pkg?.pricing?.nonVegPrice)) {
        cuisineText = 'Veg & Non-Veg (Mixed)';
      } else if (pkg?.pricing?.cuisineType === 'veg' || pkg?.pricing?.vegPrice) {
        cuisineText = 'Pure Veg';
      } else if (pkg?.pricing?.cuisineType === 'nonveg' || pkg?.pricing?.nonVegPrice) {
        cuisineText = 'Non-Veg Only';
      }
      
      if (pkg?.pricing?.cuisine) {
        features.push(`Cuisine: ${pkg.pricing.cuisine}`);
      }
      features.push(`Cuisine Type: ${cuisineText}`);
      
      if (pkg?.pricing?.vegPrice) {
        features.push(`Veg Menu Price: ₹${pkg.pricing.vegPrice} per plate`);
      }
      if (pkg?.pricing?.nonVegPrice) {
        features.push(`Non-Veg Menu Price: ₹${pkg.pricing.nonVegPrice} per plate`);
      }
      if (pkg?.policies?.cateringPolicy) {
        features.push(`Catering Policy: ${pkg.policies.cateringPolicy}`);
      }
      
      this.selectedServiceDetail.set({
        name: serviceName,
        description: `Delight your guests with a customized culinary experience. We offer premium menu choices prepared by expert chefs under strict hygiene standards.`,
        images: [
          'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&q=80&w=800',
          'https://images.unsplash.com/photo-1530103043960-ef38714abb15?auto=format&fit=crop&q=80&w=800'
        ],
        features: features,
        priceRange: pkg?.pricing?.vegPrice || pkg?.pricing?.nonVegPrice
          ? `Starting from ₹${pkg?.pricing?.cuisineType === 'nonveg' ? pkg?.pricing?.nonVegPrice : pkg?.pricing?.vegPrice} / Plate`
          : undefined
      });
      return;
    }

    // Check if the service has customized inclusion details in the package's inclusionDetails
    const customDetails = pkg?.inclusionDetails?.[serviceName];
    if (customDetails) {
      let features: string[] = [];
      if (Array.isArray(customDetails.keyFeatures)) {
        features = [...customDetails.keyFeatures];
      } else if (typeof customDetails.keyFeatures === 'string' && customDetails.keyFeatures) {
        features = customDetails.keyFeatures.split(',').map((f: string) => f.trim()).filter((f: string) => f);
      }

      if (Array.isArray(customDetails.inclusions)) {
        features = [...features, ...customDetails.inclusions];
      } else if (typeof customDetails.inclusions === 'string' && customDetails.inclusions) {
        const incls = customDetails.inclusions.split(',').map((i: string) => i.trim()).filter((i: string) => i);
        features = [...features, ...incls];
      }

      let priceRangeStr = '';
      if (customDetails.minPrice && customDetails.maxPrice) {
        if (customDetails.minPrice === customDetails.maxPrice) {
          priceRangeStr = `₹${customDetails.minPrice.toLocaleString()}`;
        } else {
          priceRangeStr = `₹${customDetails.minPrice.toLocaleString()} - ₹${customDetails.maxPrice.toLocaleString()}`;
        }
      } else if (customDetails.minPrice) {
        priceRangeStr = `Starts from ₹${customDetails.minPrice.toLocaleString()}`;
      }

      this.selectedServiceDetail.set({
        name: serviceName,
        description: customDetails.description || `Premium ${serviceName} details provided by our verified partners.`,
        images: (customDetails.images && customDetails.images.length > 0)
          ? customDetails.images
          : (customDetails.imageUrl
            ? [customDetails.imageUrl]
            : ['https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=800']),
        features: features.length > 0 ? features : ['Professional Service', 'JoinEvents Verified', 'Quality Guaranteed'],
        priceRange: priceRangeStr
      });
      return;
    }

    // Database-driven dynamic fallback details based on standard inclusions
    let description = `Comprehensive ${serviceName} services provided by our verified professional partners, ensuring top-tier quality and reliability for your event.`;
    let features = ['Professional Service', 'JoinEvents Verified', 'Quality Guaranteed'];
    let images = ['https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=800'];

    if (lowerName.includes('venue') || lowerName.includes('suite') || lowerName.includes('hall') || lowerName.includes('banquet') || lowerName.includes('space') || lowerName.includes('room')) {
      description = `Premium venue space with capacity for up to ${pkg?.maxGuests || 300} guests. Fully managed and configured to fit your event requirements.`;
      features = [
        `Capacity: ${pkg?.maxGuests || 300} Guests`,
        `Rooms Included: ${pkg?.roomCount || 0}`,
        `AC: ${pkg?.amenities?.hasAc ? 'Yes' : 'No'}`,
        `Power Backup: ${pkg?.amenities?.hasPowerBackup ? 'Yes' : 'No'}`,
        `Valet Parking: ${pkg?.amenities?.hasParking ? 'Available' : 'No'}`
      ];
      images = ['https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=800'];
    } else if (lowerName.includes('decor') || lowerName.includes('stage') || lowerName.includes('flower') || lowerName.includes('theme')) {
      description = `Bespoke decoration setup styled under the theme of the event package.`;
      features = [
        `Theme: ${pkg?.theme || 'Premium'}`,
        `Decor Policy: ${pkg?.policies?.decorPolicy || 'Flexible'}`,
        `Custom floral & lighting setup`
      ];
      images = ['https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&q=80&w=800'];
    }

    this.selectedServiceDetail.set({
      name: serviceName,
      description: description,
      images: images,
      features: features
    });
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

    if (!this.bookingDate) {
      this.toast.error('Please select an event date.');
      return;
    }

    if (!this.isDateAvailable()) {
      this.toast.error('The selected date is no longer available. Please select another date.');
      return;
    }

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
