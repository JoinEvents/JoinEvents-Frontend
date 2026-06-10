import { Component, signal, inject, OnInit, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { RfpService } from '../../../core/services/rfp.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { EventCategoryService } from '../../../core/services/event-category.service';
import { EventTierService } from '../../../core/services/event-tier.service';
import { LocationService } from '../../../core/services/location.service';

@Component({
  selector: 'app-create-rfp',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-rfp.html',
  styleUrl: './create-rfp.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreateRfp implements OnInit {
  private rfpService = inject(RfpService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private eventCategoryService = inject(EventCategoryService);
  public eventTierService = inject(EventTierService);
  private locationService = inject(LocationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  cities = signal<any[]>([]);
  eventTypes = signal<any[]>([]);
  submitting = signal(false);
  isEditMode = signal(false);
  rfpId = signal<string | null>(null);

  minDate = (() => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 7);
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  })();

  // Wizard state
  activeStep = signal(1);
  selectedCategoryKey = signal('');
  selectedTierName = signal('');

  filteredTiers = computed(() => {
    const categoryKey = this.selectedCategoryKey();
    if (!categoryKey) return [];
    const catDef = this.eventTypes().find(c => c.id === categoryKey);
    const catId = catDef?.id || categoryKey;
    const tiersList = this.eventTierService.tiers().filter(t => t.categoryId === catId || t.categoryId === categoryKey);
    const orderMap: Record<string, number> = {
      'silver': 1,
      'gold': 2,
      'platinum': 3
    };
    return [...tiersList].sort((a, b) => {
      const orderA = orderMap[a.name.toLowerCase().trim()] || 99;
      const orderB = orderMap[b.name.toLowerCase().trim()] || 99;
      return orderA - orderB;
    });
  });

  selectedTierObject = computed(() => {
    const tierName = this.selectedTierName();
    if (!tierName) return null;
    return this.filteredTiers().find(t => t.name === tierName) || null;
  });

  // Service Estimator Category details
  categories = signal<any[]>([
    { id: 'venue', name: 'Venue', icon: 'bi-building', description: 'Banquet halls, lawns, resorts & farmhouses' },
    { id: 'catering', name: 'Catering', icon: 'bi-egg-fried', description: 'Veg, non-veg & live food counters' },
    { id: 'decoration', name: 'Decoration', icon: 'bi-flower1', description: 'Floral, theme & stage decoration' },
    { id: 'transport', name: 'Transport', icon: 'bi-car-front', description: 'Buses, cars & luxury fleets' },
    { id: 'priest', name: 'Priest', icon: 'bi-fire', description: 'Vedic priests for all rituals' },
    { id: 'manpower', name: 'Manpower', icon: 'bi-people', description: 'Event staff, waiters & security' },
    { id: 'photography', name: 'Photography', icon: 'bi-camera', description: 'Professional photos & videos' },
    { id: 'music', name: 'Music & DJ', icon: 'bi-music-note-beamed', description: 'DJs, live bands & sound systems' }
  ]);

  selectedServices = signal<any[]>([]);

  form = {
    title: '',
    eventTypeId: '',
    eventTypeName: '',
    eventDate: '',
    city: '',
    venueStatus: 'not_booked' as 'booked' | 'not_booked',
    venueName: '',
    locality: '',
    pincode: '',
    guestCount: 100,
    budgetMin: 100000,
    budgetMax: 500000,
    requirements: '',
    servicesNeeded: [] as string[]
  };

  ngOnInit() {
    this.locationService.getCities().subscribe(citiesList => {
      this.cities.set(citiesList);
    });

    this.eventCategoryService.getAll().subscribe(types => {
      this.eventTypes.set(types);
      
      const id = this.route.snapshot.paramMap.get('id');
      if (id) {
        this.eventTierService.loadAll().subscribe(tiers => {
          this.rfpService.getRfpById(id).subscribe(rfp => {
            if (rfp) {
              this.isEditMode.set(true);
              this.rfpId.set(rfp.id);
              
              this.form.title = rfp.title;
              this.form.eventTypeId = rfp.eventTypeId;
              this.form.eventTypeName = rfp.eventTypeName;
              this.form.eventDate = rfp.eventDate;
              this.form.city = rfp.city;
              this.form.venueStatus = rfp.venueStatus || 'not_booked';
              this.form.venueName = rfp.venueName || '';
              this.form.locality = rfp.locality || '';
              this.form.pincode = rfp.pincode || '';
              this.form.guestCount = rfp.guestCount;
              this.form.budgetMin = rfp.budgetMin;
              this.form.budgetMax = rfp.budgetMax;
              
              const rawReq = rfp.requirements || '';
              let cleanedReq = rawReq;
              let tier = '';
              const match = rawReq.match(/\[Preferred Quality Tier:\s*([^\]]+)\]/);
              if (match) {
                tier = match[1].trim();
                cleanedReq = rawReq.replace(/\[Preferred Quality Tier:\s*([^\]]+)\]\n\n?/, '').trim();
              }
              this.form.requirements = cleanedReq;
              this.selectedCategoryKey.set(rfp.eventTypeId);
              this.selectedTierName.set(tier);
              
              const mapped = rfp.servicesNeeded.map(name => {
                const cat = this.categories().find(c => c.name.toLowerCase() === name.toLowerCase() || c.id.toLowerCase() === name.toLowerCase());
                const catId = cat ? cat.id : name.toLowerCase();
                const price = this.getServicePriceForTier(catId);
                return { category: catId, name, price, qty: 1 };
              });
              this.selectedServices.set(mapped);
            }
          });
        });
      } else {
        this.eventTierService.loadAll().subscribe();
      }
    });
  }

  getServicePriceForTier(catId: string): number {
    const tierObj = this.selectedTierObject();
    if (tierObj && tierObj.priceRanges) {
      const catDef = this.categories().find(c => c.id === catId);
      const nameMatch = catDef ? catDef.name : catId;
      const range = tierObj.priceRanges.find(pr => pr.serviceName.toLowerCase() === nameMatch.toLowerCase() || pr.serviceName.toLowerCase() === catId.toLowerCase());
      if (range) {
        return Math.round((range.minPrice + range.maxPrice) / 2);
      }
    }
    const fallbackPrices: Record<string, number> = { venue: 50000, catering: 45000, decoration: 30000, transport: 15000, priest: 8000, manpower: 20000, photography: 25000, music: 18000 };
    return fallbackPrices[catId] ?? 10000;
  }

  getServicePriceRange(catId: string): { min: number, max: number } {
    const tierObj = this.selectedTierObject();
    if (tierObj && tierObj.priceRanges) {
      const catDef = this.categories().find(c => c.id === catId);
      const nameMatch = catDef ? catDef.name : catId;
      const range = tierObj.priceRanges.find(pr => pr.serviceName.toLowerCase() === nameMatch.toLowerCase() || pr.serviceName.toLowerCase() === catId.toLowerCase());
      if (range) {
        return { min: range.minPrice, max: range.maxPrice };
      }
    }
    const fallbackPrices: Record<string, number> = { venue: 50000, catering: 45000, decoration: 30000, transport: 15000, priest: 8000, manpower: 20000, photography: 25000, music: 18000 };
    const base = fallbackPrices[catId] ?? 10000;
    return { min: Math.round(base * 0.9), max: Math.round(base * 1.15) };
  }


  // Service toggling methods
  addService(cat: any) {
    const exists = this.selectedServices().find(s => s.category === cat.id);
    if (!exists) {
      const price = this.getServicePriceForTier(cat.id);
      this.selectedServices.update(s => [...s, { category: cat.id, name: cat.name, price, qty: 1 }]);
    }
  }

  onTierChange(tierName: string) {
    this.selectedTierName.set(tierName);
    this.updateEstimatedPrices();
  }

  updateEstimatedPrices() {
    this.selectedServices.update(services => 
      services.map(s => ({
        ...s,
        price: this.getServicePriceForTier(s.category)
      }))
    );
    // Also update budget min/max based on the new estimate if in step 3
    this.form.budgetMin = this.getMinEstimate();
    this.form.budgetMax = this.getMaxEstimate();
  }

  removeService(catId: string) {
    this.selectedServices.update(s => s.filter(x => x.category !== catId));
  }

  isAdded(catId: string) {
    return this.selectedServices().some(s => s.category === catId);
  }

  getTotal() {
    return this.selectedServices().reduce((acc, s) => acc + s.price * s.qty, 0);
  }

  getGst() {
    return Math.round(this.getTotal() * 0.18);
  }

  getEstimate() {
    return this.getTotal() + this.getGst();
  }

  getMinEstimate(): number {
    let sum = 0;
    const tierObj = this.selectedTierObject();
    const priceRanges = tierObj?.priceRanges;
    if (tierObj && priceRanges) {
      this.selectedServices().forEach(s => {
        const catDef = this.categories().find(c => c.id === s.category);
        const nameMatch = catDef ? catDef.name : s.category;
        const range = priceRanges.find(pr => pr.serviceName.toLowerCase() === nameMatch.toLowerCase() || pr.serviceName.toLowerCase() === s.category.toLowerCase());
        sum += range ? range.minPrice : (s.price * 0.9);
      });
    } else {
      sum = this.getTotal() * 0.9;
    }
    return Math.round(sum * 1.18);
  }

  getMaxEstimate(): number {
    let sum = 0;
    const tierObj = this.selectedTierObject();
    const priceRanges = tierObj?.priceRanges;
    if (tierObj && priceRanges) {
      this.selectedServices().forEach(s => {
        const catDef = this.categories().find(c => c.id === s.category);
        const nameMatch = catDef ? catDef.name : s.category;
        const range = priceRanges.find(pr => pr.serviceName.toLowerCase() === nameMatch.toLowerCase() || pr.serviceName.toLowerCase() === s.category.toLowerCase());
        sum += range ? range.maxPrice : (s.price * 1.15);
      });
    } else {
      sum = this.getTotal() * 1.15;
    }
    return Math.round(sum * 1.18);
  }

  // Wizard navigation
  nextStep() {
    if (this.activeStep() === 1) {
      if (!this.form.title || !this.form.eventTypeId || !this.form.eventDate || !this.form.city) {
        this.toast.error('Please fill in all required fields.');
        return;
      }
      this.activeStep.set(2);
    } else if (this.activeStep() === 2) {
      if (this.selectedServices().length === 0) {
        this.toast.error('Please select at least one service category.');
        return;
      }
      // Prefill budget based on estimate
      this.form.budgetMin = this.getMinEstimate();
      this.form.budgetMax = this.getMaxEstimate();
      this.activeStep.set(3);
    }
  }

  prevStep() {
    if (this.activeStep() > 1) {
      this.activeStep.update(s => s - 1);
    }
  }

  onEventTypeChange() {
    const type = this.eventTypes().find(t => t.id === this.form.eventTypeId);
    if (type) this.form.eventTypeName = type.name;
    this.selectedCategoryKey.set(this.form.eventTypeId);
    
    // Auto-select first tier
    setTimeout(() => {
      const tiers = this.filteredTiers();
      if (tiers.length > 0) {
        this.selectedTierName.set(tiers[0].name);
        this.updateEstimatedPrices();
      } else {
        this.selectedTierName.set('');
      }
    }, 50);
  }

  submitRfp() {
    if (!this.form.title || !this.form.eventTypeId || !this.form.eventDate || !this.form.city) {
      this.toast.error('Please fill in all required fields.');
      return;
    }
    if (this.form.venueStatus === 'booked' && !this.form.venueName) {
      this.toast.error('Please enter the venue name / landmark.');
      return;
    }
    if (this.form.venueStatus === 'not_booked' && !this.form.locality) {
      this.toast.error('Please enter your preferred locality / area.');
      return;
    }
    if (this.form.pincode && !/^\d{6}$/.test(this.form.pincode)) {
      this.toast.error('Please enter a valid 6-digit pincode.');
      return;
    }
    if (this.selectedServices().length === 0) {
      this.toast.error('Please select at least one service.');
      return;
    }

    const minEst = this.getMinEstimate();
    if (this.form.budgetMin < minEst) {
      this.toast.error(`Minimum target budget cannot be lower than the estimated minimum of ₹${minEst.toLocaleString('en-IN')}.`);
      return;
    }
    if (this.form.budgetMax < minEst) {
      this.toast.error(`Maximum budget limit cannot be lower than the estimated minimum of ₹${minEst.toLocaleString('en-IN')}.`);
      return;
    }
    if (this.form.budgetMax < this.form.budgetMin) {
      this.toast.error('Maximum budget limit cannot be lower than the minimum target budget.');
      return;
    }

    this.submitting.set(true);
    const user = this.auth.currentUser()!;
    
    // Set services needed from our planner selections
    this.form.servicesNeeded = this.selectedServices().map(s => s.name);

    let requirementsPayload = this.form.requirements;
    const tier = this.selectedTierName();
    if (tier) {
      requirementsPayload = `[Preferred Quality Tier: ${tier}]\n\n${requirementsPayload}`;
    }

    if (this.isEditMode()) {
      this.rfpService.updateRfp(this.rfpId()!, {
        ...this.form,
        requirements: requirementsPayload,
        servicesNeeded: this.form.servicesNeeded
      }).subscribe(() => {
        this.submitting.set(false);
        this.toast.success('Your quote request was updated successfully!');
        this.router.navigate(['/get-quotes']);
      });
    } else {
      this.rfpService.createRfp({ 
        ...this.form, 
        requirements: requirementsPayload,
        customerId: user.id, 
        customerName: user.name 
      }).subscribe(() => {
        this.submitting.set(false);
        this.toast.success('Your quote request is live! Vendors will start submitting offers shortly.');
        this.router.navigate(['/get-quotes']);
      });
    }
  }

  cancel() {
    this.router.navigate(['/get-quotes']);
  }
}
