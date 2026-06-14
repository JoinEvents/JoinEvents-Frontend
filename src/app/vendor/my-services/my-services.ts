import { Component, signal, OnInit, OnDestroy, inject, computed } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { VendorPackageService } from '../../core/services/vendor-package.service';
import { VendorService, ServiceCategoryDef } from '../../core/models/service.model';

@Component({
  selector: 'app-vendor-my-services',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './my-services.html',
  styleUrl: './my-services.css'
})
export class VendorMyServices implements OnInit, OnDestroy {
  private api = inject(VendorPackageService);
  private router = inject(Router);
  
  services = signal<VendorService[]>([]);
  categories = signal<ServiceCategoryDef[]>([]);
  
  // Filter Signals
  filterStatus = signal<'all' | 'verified' | 'pending'>('all');
  liveFilter = signal<'all' | 'live' | 'paused'>('all');
  searchQuery = signal<string>('');
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  selectedPreview = signal<VendorService | null>(null);
  private carouselInterval: any;

  openPreview(svc: VendorService) {
    if (!environment.production) { console.log('Opening preview for service:', svc.id, svc.name); }
    this.router.navigate(['/book', svc.id]);
  }

  closePreview() {
    this.selectedPreview.set(null);
    document.body.style.overflow = 'auto';
  }

  servicesStats = signal({
    total: 0,
    verified: 0,
    active: 0,
    reviews: 0
  });

  // Reactive Filtered List
  filteredServices = computed(() => {
    const list = this.services();
    const status = this.filterStatus();
    const live = this.liveFilter();
    const query = this.searchQuery().toLowerCase();
 
    return list.filter(s => {
      const matchesStatus = status === 'all' || 
                           (status === 'verified' && s.isVerified) || 
                           (status === 'pending' && !s.isVerified);
      
      const matchesLive = live === 'all' ||
                          (live === 'live' && s.isActive) ||
                          (live === 'paused' && !s.isActive);

      const matchesSearch = !query || 
                           s.name.toLowerCase().includes(query) || 
                           s.category.toLowerCase().includes(query) ||
                           s.city.toLowerCase().includes(query);
 
      return matchesStatus && matchesLive && matchesSearch;
    });
  });
  
  ngOnInit() {
    this.loadServices();
    this.api.getServiceCategories().subscribe((res: any) => {
      if (res && res.categories) {
        this.categories.set(res.categories);
      } else if (Array.isArray(res)) {
        this.categories.set(res);
      } else {
        this.categories.set([]);
      }
    });

    // Start auto-scrolling image carousel for all cards
    this.carouselInterval = setInterval(() => {
      this.services.update(list => list.map(svc => {
        if (svc.images && svc.images.length > 1) {
          return { ...svc, activeImageIndex: ((svc.activeImageIndex || 0) + 1) % svc.images.length };
        }
        return svc;
      }));
    }, 3500);
  }

  ngOnDestroy() {
    if (this.carouselInterval) {
      clearInterval(this.carouselInterval);
    }
  }

  loadServices() {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    
    const timeout = setTimeout(() => {
      if (this.isLoading()) {
        this.isLoading.set(false);
        this.errorMessage.set('Request timed out. Please try again.');
      }
    }, 10000);

    this.api.getMyPackages().subscribe({
      next: (res: any) => {
        clearTimeout(timeout);
        if (!environment.production) { console.log('API Response for MyPackages:', res); }
        
        // Defensive: Check for both 'packages' and 'Packages'
        const rawPackages = res?.packages || res?.Packages || (Array.isArray(res) ? res : []);
        if (!environment.production) { console.log('Processing raw packages:', rawPackages); }
        
        const mappedServices: VendorService[] = rawPackages.map((p: any) => ({
          id: p.id || p.Id,
          vendorId: p.vendorId || p.VendorId,
          vendorName: p.vendorName || p.VendorName || '',
          category: p.category || p.Category,
          name: p.name || p.Name,
          description: (() => {
            const rawDesc = p.description || p.Description || '';
            if (rawDesc.includes('\n\n---INCLUSION_DETAILS---\n')) {
              return rawDesc.split('\n\n---INCLUSION_DETAILS---\n')[0];
            }
            return rawDesc;
          })(),
          pricePerUnit: (() => {
            const pricing = p.pricing || p.Pricing || {};
            const basePrice = pricing.basePrice || pricing.BasePrice || 0;
            const vegPrice = pricing.vegPrice || pricing.VegPrice || 0;
            const rent = pricing.rent || pricing.Rent || 0;
            const rawUnit = (pricing.unit || pricing.Unit || '').toLowerCase();
            
            if (rawUnit === 'per plate') {
              return vegPrice || basePrice || rent || 0;
            }
            if (rawUnit === 'per day' || rawUnit === 'per hour') {
              return rent || basePrice || 0;
            }
            return basePrice || rent || vegPrice || 0;
          })(),
          unit: (() => {
            const pricing = p.pricing || p.Pricing || {};
            const rawUnit = (pricing.unit || pricing.Unit || 'per event').toLowerCase();
            return rawUnit.startsWith('per ') ? rawUnit.substring(4) : rawUnit;
          })(),
          minGuests: 0,
          maxGuests: p.capacity?.maxGuests || p.capacity?.MaxGuests || 0,
          city: p.city || p.City || p.address?.city || p.address?.City || '',
          images: p.images || p.Images || [],
          rating: p.rating || p.Rating || 0,
          totalReviews: p.totalReviews || p.TotalReviews || 0,
          isActive: p.isActive !== undefined ? p.isActive : p.IsActive,
          isVerified: p.isVerified !== undefined ? p.isVerified : p.IsVerified,
          activeImageIndex: 0,
          verificationStatus: p.verificationStatus || p.VerificationStatus || 'Pending',
          verificationComment: p.verificationComment || p.VerificationComment || null
        }));
        
        this.services.set(mappedServices);
        this.servicesStats.set({
          total: mappedServices.length,
          verified: mappedServices.filter(x => x.isVerified).length,
          active: mappedServices.filter(x => x.isActive).length,
          reviews: mappedServices.reduce((sum, x) => sum + x.totalReviews, 0)
        });
        this.isLoading.set(false);
      },
      error: (err) => {
        clearTimeout(timeout);
        if (!environment.production) { console.error('Error loading services:', err); }
        this.errorMessage.set('Failed to load your services. Please check your connection and try again.');
        this.isLoading.set(false);
      }
    });
  }

  editService(id: string) {
    this.router.navigate(['/vendor/edit-service', id]);
  }

  manageGallery(id: string) {
    // Navigate to photos step directly if we had a way, for now just navigate to edit
    this.router.navigate(['/vendor/edit-service', id]);
  }

  toggleServiceStatus(svc: VendorService) {
    const newStatus = !svc.isActive;
    this.api.toggleStatus(svc.id, newStatus).subscribe({
      next: () => {
        svc.isActive = newStatus;
        // Update stats
        this.servicesStats.update(s => ({
          ...s,
          active: this.services().filter(x => x.isActive).length
        }));
      },
      error: (err) => { if (!environment.production) { console.error('Failed to toggle status', err); } }
    });
  }

  deleteService(id: string) {
    if (confirm('Are you sure you want to delete this service?')) {
      this.api.deletePackage(id).subscribe({
        next: () => {
          this.services.update(s => s.filter(x => x.id !== id));
          this.servicesStats.update(s => ({
            ...s,
            total: this.services().length
          }));
        },
        error: (err) => { if (!environment.production) { console.error('Failed to delete service', err); } }
      });
    }
  }
}
