import { Component, signal, computed, OnInit, OnDestroy, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PackageService } from '../../core/services/package.service';
import { EventPackage } from '../../core/models/event.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-customer-booking',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './booking.html',
  styleUrl: './booking.css'
})
export class CustomerBooking implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(PackageService);
  private auth = inject(AuthService);

  userRole = computed(() => this.auth.currentUser()?.role);

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
  
  private slideshowInterval: any;

  constructor() {
    effect(() => {
      const isModalOpen = !!this.selectedServiceDetail();
      if (isModalOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'auto';
      }
    });
  }

  ngOnInit() {
    const pkgId = this.route.snapshot.paramMap.get('packageId');
    if (pkgId) {
      this.loadPackage(pkgId);
    }
  }

  ngOnDestroy() {
    this.stopSlideshow();
    document.body.style.overflow = 'auto'; // Ensure scroll is restored when leaving page
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
    this.isLoading.set(true);
    setTimeout(() => {
      this.isLoading.set(false);
      this.bookingSuccess.set(true);
    }, 1500);
  }

  handleImageFallback(event: Event, fallbackUrl: string) {
    const img = event.target as HTMLImageElement;
    if (img.src !== fallbackUrl) {
      img.src = fallbackUrl;
    }
  }
}
