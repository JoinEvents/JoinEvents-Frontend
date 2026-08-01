import { Component, signal, OnInit, OnDestroy, inject, computed, ViewChild, ElementRef, NgZone, AfterViewInit, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { VendorPackageService } from '../../core/services/vendor-package.service';
import { EventCategoryService } from '../../core/services/event-category.service';
import { ServiceCategoryDef } from '../../core/models/service.model';
import { EventTierService } from '../../core/services/event-tier.service';
import { SupportService } from '../../core/services/support.service';
import { ToastService } from '../../core/services/toast.service';
import { VendorService } from '../../core/services/vendor.service';
import { ProfileService } from '../../core/services/profile.service';
import { environment } from '../../../environments/environment';
import { forkJoin } from 'rxjs';

declare var google: any;

interface InclusionDetail {
  description: string;
  minPrice: number;
  maxPrice: number;
  images: string[];
  keyFeatures: string[];
  inclusions: string[];
}

interface CropItem {
  file: File;
  dataUrl: string;
  zoom: number;
  translateX: number;
  translateY: number;
  imageWidth: number;
  imageHeight: number;
  zoomValue: number;
  prevZoom: number;
  fittedScale: number;
  imgOriginalWidth: number;
  imgOriginalHeight: number;
}

@Component({
  selector: 'app-vendor-add-service',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-service.html',
  styleUrl: './add-service.css'
})
export class VendorAddService implements OnInit, OnDestroy {
  private api = inject(VendorPackageService);
  private eventCategoryService = inject(EventCategoryService);
  private eventTierService = inject(EventTierService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private ngZone = inject(NgZone);
  private supportService = inject(SupportService);
  private toast = inject(ToastService);
  private vendorService = inject(VendorService);
  private profileService = inject(ProfileService);
  private http = inject(HttpClient);

  suggestions = signal<any[]>([]);
  searchQuery = '';

  // KYC and Profile Verification Signals
  showKycBlock = signal(false);
  missingKyc = signal(false);
  missingProfile = signal(false);
  isCheckingKyc = signal(true);

  // Cropper Fields
  @ViewChild('cropImage') cropImageRef!: ElementRef<HTMLImageElement>;
  showCropModal = signal(false);
  imageSrc = signal<string | null>(null);
  zoom = signal(1.0);
  translateX = signal(0);
  translateY = signal(0);
  imageWidth = signal(0);
  imageHeight = signal(0);
  zoomValue = 1.0;
  prevZoom = 1.0;
  cropping = signal(false);
  
  private dragStartPos = { x: 0, y: 0 };
  private isDragging = false;
  private imgOriginalWidth = 0;
  private imgOriginalHeight = 0;
  private fittedScale = 1.0;
  
  currentCropTarget = ''; // 'portfolio' or 'inclusion:Catering' etc.
  uploadQueue: File[] = [];
  cropItems: CropItem[] = [];
  currentIndex: number = 0;

  constructor() {
    effect(() => {
      document.body.classList.toggle('modal-open', this.showVerificationModal());
    });
  }

  ngOnDestroy() {
    document.body.classList.remove('modal-open');
  }

  @ViewChild('addressSearch') set addressSearch(content: ElementRef) {
    if (content) {
      if (this.addressSearchElement === content) {
        return;
      }
      this.addressSearchElement = content;
    } else {
      this.addressSearchElement = null as any;
    }
  }
  @ViewChild('mapContainer') set mapContainer(content: ElementRef) {
    if (content) {
      if (this.mapElement === content) {
        return;
      }
      this.mapElement = content;
      setTimeout(() => this.initMap(), 150);
    } else {
      this.mapElement = null as any;
      this.map = null;
      this.marker = null;
    }
  }

  addressSearchElement!: ElementRef;
  mapElement!: ElementRef;

  map: any;
  marker: any;
  autocomplete: any;
  
  categories = signal<any[]>([]);
  currentStep = signal(1);
  isSubmitting = signal(false);
  uploadedPhotos = signal<string[]>([]);
  isEditMode = signal(false);
  serviceId = signal<string | null>(null);
  showVerificationModal = signal(false);
  activeInclusionTab = signal('');
  inclusionDetails = signal<Record<string, InclusionDetail>>({});
  selectedCategoryKey = signal('');
  selectedTierName = signal('');
  inclusionPriceErrors: Record<string, string> = {};

  filteredTiers = computed(() => {
    const key = this.selectedCategoryKey();
    if (!key) return [];
    const catDef = this.categories().find(c => c.category === key);
    const catId = catDef?.id || key;
    const tiersList = this.eventTierService.tiers().filter(t => t.categoryId === catId || t.categoryId === key);
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
    const key = this.selectedCategoryKey();
    const catDef = this.categories().find(c => c.category === key);
    const catId = catDef?.id || key;
    return this.eventTierService.tiers().find(t => t.name === tierName && (t.categoryId === catId || t.categoryId === key)) || null;
  });

  // Form Data
  formData = {
    category: '',
    name: '',
    description: '',
    
    // Address Details
    country: 'India',
    state: '',
    city: '',
    locality: '',
    street: '',
    landmark: '',
    pincode: '',
    
    experience: '',
    
    // Pricing
    vegPrice: 0,
    nonVegPrice: 0,
    cuisine: '',
    cuisineType: 'veg',
    roomPrice: 0,
    basePrice: 0,
    rent: 0,
    unit: 'per event',

    // Capacity
    maxCapacity: 0,
    parkingCapacity: 0,
    totalRooms: 0,

    // Policies
    cateringPolicy: 'Inhouse Only',
    decorPolicy: 'Panel Decorators Only',
    alcoholPolicy: 'No Alcohol Allowed',
    djPolicy: 'Inhouse DJ Only',

    // Amenities
    hasAc: false,
    hasPowerBackup: false,
    hasChangingRooms: false,
    hasParking: false,

    // Spaces (repurposed for Day-wise Plan)
    spaces: [
      { name: 'Welcome & Setup', type: 'Welcome ceremony and setup details.', seating: 0, floating: 0 }
    ],

    // Package Includes
    includes: [] as string[],

    // Package Theme
    theme: ''
  };

  newIncludeItem = signal('');

  countries = ['India', 'USA', 'UK', 'UAE'];
  states = ['Telangana', 'Andhra Pradesh', 'Karnataka', 'Maharashtra', 'Delhi', 'Gujarat', 'Tamil Nadu'];
  cities = ['Hyderabad', 'Bangalore', 'Mumbai', 'Pune', 'Delhi', 'Chennai', 'Ahmedabad'];
  localities = ['Banjara Hills', 'Jubilee Hills', 'Gachibowli', 'Kondapur', 'Madhapur', 'Whitefield', 'Indiranagar', 'Andheri', 'Powai'];
  streets = ['Main Road', '2nd Cross', 'Sector 5', 'Ring Road', 'MG Road'];
  landmarks = ['Near Metro Station', 'Opposite Mall', 'Behind Hospital', 'Near City Center'];

  availableInclusions = signal<string[]>([]);

  availableThemes: string[] = [
    'Silver',
    'Gold',
    'Platinum'
  ];

  ngOnInit() {
    this.isCheckingKyc.set(true);
    forkJoin({
      verification: this.vendorService.getVerificationStatus(),
      profile: this.profileService.getProfile()
    }).subscribe({
      next: (res: any) => {
        this.isCheckingKyc.set(false);
        const isVerified = res.verification?.isVerified || false;
        const profile = res.profile;
        
        const hasBusinessName = profile?.businessName && profile.businessName.trim() !== '' && profile.businessName !== 'My Vendor Business';
        const hasDescription = profile?.description && profile.description.trim() !== '';
        const isProfileComplete = !!(hasBusinessName && hasDescription);
        
        if (!isVerified || !isProfileComplete) {
          this.showKycBlock.set(true);
          this.missingKyc.set(!isVerified);
          this.missingProfile.set(!isProfileComplete);
        }
      },
      error: (err) => {
        if (!environment.production) { console.error('Failed to verify vendor status', err); }
        this.isCheckingKyc.set(false);
      }
    });

    this.eventCategoryService.getAll().subscribe((res: any) => {
      this.categories.set(res);
      if (this.formData.category) {
        this.updateInclusionsForCategory(this.formData.category);
        this.selectedCategoryKey.set(this.formData.category);
      }
    });

    this.eventTierService.loadAll().subscribe({
      next: (tiers) => {
        if (tiers && tiers.length > 0) {
          this.availableThemes = tiers.map(t => t.name);
        }
      },
      error: (err) => {
        if (!environment.production) { console.error('Failed to load tiers from API, using fallback themes:', err); }
      }
    });

    // Check for edit mode
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.serviceId.set(id);
      this.loadServiceData(id);
    }

    this.loadLeafletScript();
  }

  loadLeafletScript() {
    if (typeof (window as any).L !== 'undefined') {
      this.initMap();
      return;
    }

    const cssId = 'leaflet-css';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const scriptId = 'leaflet-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    if (script) {
      script.addEventListener('load', () => {
        this.ngZone.run(() => {
          this.initMap();
        });
      });
      return;
    }

    script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => {
      this.ngZone.run(() => {
        this.initMap();
      });
    };
    script.onerror = (err) => {
      if (!environment.production) { console.error('Failed to load Leaflet script dynamically:', err); }
    };
    document.head.appendChild(script);
  }

  initMap() {
    if (this.map) return;
    if (!this.mapElement || !this.mapElement.nativeElement) {
      if (!environment.production) { console.warn('Skipping Leaflet Map: Map container element not found in DOM.'); }
      return;
    }
    if (!document.body.contains(this.mapElement.nativeElement) || !this.mapElement.nativeElement.parentElement) {
      if (!environment.production) { console.warn('Leaflet Map: Element is detached. Retrying in 100ms.'); }
      setTimeout(() => this.initMap(), 100);
      return;
    }
    if (typeof (window as any).L === 'undefined') {
      if (!environment.production) { console.warn('Leaflet library not loaded yet.'); }
      return;
    }
    try {
      const L = (window as any).L;
      const defaultLoc: [number, number] = [17.3850, 78.4867]; // Hyderabad
      this.map = L.map(this.mapElement.nativeElement).setView(defaultLoc, 13);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(this.map);

      // Fix default marker icon issues with CDNs
      const DefaultIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });
      L.Marker.prototype.options.icon = DefaultIcon;

      this.marker = L.marker(defaultLoc, { draggable: true }).addTo(this.map);

      this.marker.on('dragend', () => {
        const position = this.marker.getLatLng();
        if (position) {
          this.reverseGeocode(position.lat, position.lng);
        }
      });

      this.map.on('click', (event: any) => {
        if (event.latlng) {
          this.updateMapLocation(event.latlng.lat, event.latlng.lng);
          this.reverseGeocode(event.latlng.lat, event.latlng.lng);
        }
      });
    } catch (err) {
      if (!environment.production) { console.error('Failed to initialize Leaflet Map:', err); }
    }
  }

  updateMapLocation(lat: number, lng: number) {
    if (this.map) {
      this.map.setView([lat, lng], 17);
    }
    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
    }
  }

  updateAddressFromNominatim(res: any) {
    const addr = res.address || {};
    
    // Reset and map fields
    this.formData.state = addr.state || '';
    this.formData.city = addr.city || addr.town || addr.municipality || '';
    this.formData.locality = addr.suburb || addr.neighbourhood || addr.village || '';
    this.formData.street = addr.road || '';
    this.formData.pincode = addr.postcode || '';
    this.formData.country = addr.country || 'India';
  }

  reverseGeocode(lat: number, lng: number) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    this.http.get<any>(url, { headers: { 'X-Suppress-Errors': 'true' } }).subscribe({
      next: (res) => {
        if (res) {
          this.ngZone.run(() => {
            this.updateAddressFromNominatim(res);
            if (res.display_name && this.addressSearchElement && this.addressSearchElement.nativeElement) {
              this.addressSearchElement.nativeElement.value = res.display_name;
              this.searchQuery = res.display_name;
            }
          });
        }
      },
      error: (err) => {
        console.error('Nominatim reverse geocode failed:', err);
      }
    });
  }

  onSearchQueryChange(query: string) {
    this.searchQuery = query;
    if (!query || query.trim().length < 3) {
      this.suggestions.set([]);
      return;
    }
    
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=5&addressdetails=1`;
    this.http.get<any[]>(url, { headers: { 'X-Suppress-Errors': 'true' } }).subscribe({
      next: (res) => {
        this.suggestions.set(res || []);
      },
      error: (err) => {
        console.error('Nominatim search failed:', err);
      }
    });
  }

  selectSuggestion(item: any) {
    this.suggestions.set([]);
    this.searchQuery = item.display_name;
    if (this.addressSearchElement && this.addressSearchElement.nativeElement) {
      this.addressSearchElement.nativeElement.value = item.display_name;
    }
    
    this.updateAddressFromNominatim(item);
    
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    if (!isNaN(lat) && !isNaN(lon)) {
      this.updateMapLocation(lat, lon);
    }
  }

  loadServiceData(id: string) {
    this.api.getPackageById(id).subscribe((svc: any) => {
      if (svc) {
        if (!environment.production) { console.log('Loaded service for editing:', svc); }
        // Hydrate form thoroughly - handle both PascalCase and camelCase
        this.formData.name = svc.name || svc.Name || '';
        this.formData.category = svc.category || svc.Category || '';
        
        // Trigger reactive updates for category
        this.updateInclusionsForCategory(this.formData.category);
        this.selectedCategoryKey.set(this.formData.category);
        
        const rawDesc = svc.description || svc.Description || '';
        let cleanedDesc = rawDesc;
        let parsedInclusionDetails: any = {};
        if (rawDesc.includes('---INCLUSION_DETAILS---')) {
          const parts = rawDesc.split('---INCLUSION_DETAILS---');
          cleanedDesc = parts[0].trim();
          try {
            parsedInclusionDetails = JSON.parse(parts[1].trim()) || {};
          } catch (e) {
            if (!environment.production) { console.error('Failed to parse inclusion details JSON in loadServiceData', e); }
          }
        }
        this.formData.description = cleanedDesc;
        this.formData.theme = svc.theme || svc.Theme || '';
        this.selectedTierName.set(this.formData.theme);
        this.formData.experience = (svc.experience || svc.Experience)?.toString() || '';

        // Hydrate Address
        const addr = svc.address || svc.Address;
        if (addr) {
          this.formData.country = addr.country || addr.Country || 'India';
          this.formData.state = addr.state || addr.State || '';
          this.formData.city = addr.city || addr.City || '';
          this.formData.locality = addr.locality || addr.Locality || '';
          this.formData.street = addr.street || addr.Street || '';
          this.formData.landmark = addr.landmark || addr.Landmark || '';
          this.formData.pincode = addr.pincode || addr.Pincode || '';
        }

        // Hydrate Pricing
        const pricing = svc.pricing || svc.Pricing;
        if (pricing) {
          this.formData.vegPrice = pricing.vegPrice || pricing.VegPrice || 0;
          this.formData.nonVegPrice = pricing.nonVegPrice || pricing.NonVegPrice || 0;
          this.formData.roomPrice = pricing.roomPrice || pricing.RoomPrice || 0;
          this.formData.basePrice = pricing.basePrice || pricing.BasePrice || 0;
          this.formData.rent = pricing.rent || pricing.Rent || 0;
          this.formData.unit = pricing.unit || pricing.Unit || 'per event';
          this.formData.cuisine = pricing.cuisine || pricing.Cuisine || '';
          this.formData.cuisineType = pricing.cuisineType || pricing.CuisineType || 'veg';
        }

        // Hydrate Capacity
        const cap = svc.capacity || svc.Capacity;
        if (cap) {
          this.formData.maxCapacity = cap.maxGuests || cap.MaxGuests || 0;
          this.formData.parkingCapacity = cap.parkingCapacity || cap.ParkingCapacity || 0;
          this.formData.totalRooms = cap.totalRooms || cap.TotalRooms || 0;
        }

        // Hydrate Policies
        const pol = svc.policies || svc.Policies;
        if (pol) {
          this.formData.cateringPolicy = pol.cateringPolicy || pol.CateringPolicy || 'Inhouse Only';
          this.formData.decorPolicy = pol.decorPolicy || pol.DecorPolicy || 'Panel Decorators Only';
          this.formData.alcoholPolicy = pol.alcoholPolicy || pol.AlcoholPolicy || 'No Alcohol Allowed';
          this.formData.djPolicy = pol.djPolicy || pol.DjPolicy || 'Inhouse DJ Only';
        }

        // Hydrate Amenities
        const amen = svc.amenities || svc.Amenities;
        if (amen) {
          this.formData.hasAc = amen.hasAc !== undefined ? (amen.hasAc || amen.HasAc) : amen.HasAc;
          this.formData.hasPowerBackup = amen.hasPowerBackup !== undefined ? (amen.hasPowerBackup || amen.HasPowerBackup) : amen.HasPowerBackup;
          this.formData.hasChangingRooms = amen.hasChangingRooms !== undefined ? (amen.hasChangingRooms || amen.HasChangingRooms) : amen.HasChangingRooms;
          this.formData.hasParking = amen.hasParking !== undefined ? (amen.hasParking || amen.HasParking) : amen.HasParking;
        }

        // Hydrate Spaces
        const spaces = svc.spaces || svc.Spaces;
        if (spaces && spaces.length > 0) {
          this.formData.spaces = spaces.map((s: any) => ({
            name: s.name || s.Name || '',
            type: s.type || s.Type || 'Indoor',
            seating: s.seatingCapacity || s.SeatingCapacity || 0,
            floating: s.floatingCapacity || s.FloatingCapacity || 0
          }));
        }

        // Hydrate Includes
        const inc = svc.includes || svc.Includes;
        if (inc && inc.length > 0) {
          this.formData.includes = [...inc];
          
          // Rehydrate inclusionDetails from parsed JSON or default
          const details: Record<string, InclusionDetail> = {};
          inc.forEach((item: string) => {
            if (parsedInclusionDetails[item]) {
              let minVal = parsedInclusionDetails[item].minPrice || 0;
              if (item.toLowerCase() === 'catering' && this.formData.vegPrice) {
                minVal = this.formData.vegPrice;
              } else if (item.toLowerCase() === 'venue' && this.formData.rent) {
                minVal = this.formData.rent;
              }
              details[item] = {
                description: parsedInclusionDetails[item].description || '',
                minPrice: minVal,
                maxPrice: minVal,
                images: parsedInclusionDetails[item].images || [],
                keyFeatures: parsedInclusionDetails[item].keyFeatures || [],
                inclusions: parsedInclusionDetails[item].inclusions || []
              };
            } else {
              let minVal = 0;
              if (item.toLowerCase() === 'catering') {
                minVal = this.formData.vegPrice;
              } else if (item.toLowerCase() === 'venue') {
                minVal = this.formData.rent;
              }
              details[item] = {
                description: '',
                minPrice: minVal,
                maxPrice: minVal,
                images: [],
                keyFeatures: [],
                inclusions: []
              };
            }
          });
          this.inclusionDetails.set(details);
          
          if (inc.length > 0) {
            this.activeInclusionTab.set(inc[0]);
          }
        }

        // Hydrate photos
        const imgs = svc.images || svc.Images;
        if (imgs && imgs.length > 0) {
          this.uploadedPhotos.set(imgs);
        }
      }
    });
  }

  validateStep1(): boolean {
    if (!this.formData.name || !this.formData.name.trim()) {
      this.toast.error('Business / Venue Name is required.');
      return false;
    }
    if (!this.formData.category) {
      this.toast.error('Event Category is required.');
      return false;
    }
    const exp = parseInt(this.formData.experience || '0', 10);
    if (isNaN(exp) || exp < 0) {
      this.toast.error('Experience must be a valid number of years.');
      return false;
    }
    if (!this.formData.description || !this.formData.description.trim()) {
      this.toast.error('About Your Service description is required.');
      return false;
    }
    if (!this.formData.country) {
      this.toast.error('Country is required.');
      return false;
    }
    if (!this.formData.state) {
      this.toast.error('State is required.');
      return false;
    }
    if (!this.formData.city) {
      this.toast.error('City is required.');
      return false;
    }
    if (!this.formData.locality) {
      this.toast.error('Locality is required.');
      return false;
    }
    if (!this.formData.street) {
      this.toast.error('Street / Area is required.');
      return false;
    }
    if (!this.formData.pincode || !this.formData.pincode.trim()) {
      this.toast.error('Pincode is required.');
      return false;
    }
    return true;
  }

  validateStep2(): boolean {
    if (!this.formData.theme) {
      this.toast.error('Please select a Service Tier (Silver, Gold, or Platinum).');
      return false;
    }
    if (this.formData.includes.length === 0) {
      this.toast.error('Please select at least one Service Inclusion.');
      return false;
    }

    for (const inc of this.formData.includes) {
      const details = this.inclusionDetails()[inc];
      if (!details) {
        this.toast.error(`Please configure details for inclusion: ${inc}`);
        return false;
      }
      if (!details.description || !details.description.trim()) {
        this.toast.error(`Please provide a detailed description for inclusion: ${inc}`);
        this.activeInclusionTab.set(inc);
        return false;
      }

      // Check pricing
      if (inc.toLowerCase() === 'catering') {
        if (!this.formData.cuisine || !this.formData.cuisine.trim()) {
          this.toast.error('Cuisine is required.');
          this.activeInclusionTab.set(inc);
          return false;
        }
        if (this.formData.cuisineType === 'veg' || this.formData.cuisineType === 'mixed') {
          if (!this.formData.vegPrice || this.formData.vegPrice <= 0) {
            this.toast.error('Veg Price (Per Plate) is required and must be greater than ₹0.');
            this.activeInclusionTab.set(inc);
            return false;
          }
        }
        if (this.formData.cuisineType === 'nonveg' || this.formData.cuisineType === 'mixed') {
          if (!this.formData.nonVegPrice || this.formData.nonVegPrice <= 0) {
            this.toast.error('Non-Veg Price (Per Plate) is required and must be greater than ₹0.');
            this.activeInclusionTab.set(inc);
            return false;
          }
        }
      } else if (inc.toLowerCase() === 'venue') {
        if (!this.formData.rent || this.formData.rent <= 0) {
          this.toast.error('Venue Rent Amount is required and must be greater than ₹0.');
          this.activeInclusionTab.set(inc);
          return false;
        }
        if (!this.formData.maxCapacity || this.formData.maxCapacity <= 0) {
          this.toast.error('Max Guest Capacity is required for Venue.');
          this.activeInclusionTab.set(inc);
          return false;
        }
      } else {
        if (!details.minPrice || details.minPrice <= 0) {
          this.toast.error(`Price is required for inclusion: ${inc} and must be greater than ₹0.`);
          this.activeInclusionTab.set(inc);
          return false;
        }
      }

      // Validate pricing range limits
      if (!this.validateInclusionPrices(inc)) {
        this.toast.error(`Price for ${inc} violates the allowed range for tier ${this.formData.theme}.`);
        this.activeInclusionTab.set(inc);
        return false;
      }

      // Photos validation
      if (!details.images || details.images.length === 0) {
        this.toast.error(`Please upload at least 1 photo for inclusion: ${inc}`);
        this.activeInclusionTab.set(inc);
        return false;
      }

      // Highlights/Features validation
      if (!details.keyFeatures || details.keyFeatures.length === 0) {
        this.toast.error(`Please add at least 1 Key Feature/Highlight for inclusion: ${inc}`);
        this.activeInclusionTab.set(inc);
        return false;
      }
    }

    return true;
  }

  validateStep3(): boolean {
    if (this.formData.spaces.length === 0) {
      this.toast.error('Please add at least one Day Plan in your Day-wise Plan.');
      return false;
    }

    for (let i = 0; i < this.formData.spaces.length; i++) {
      const space = this.formData.spaces[i];
      if (!space.name || !space.name.trim()) {
        this.toast.error(`Please enter a Day Title for Day #${i + 1}.`);
        return false;
      }
      if (!space.type || !space.type.trim()) {
        this.toast.error(`Please describe what you will do on Day #${i + 1}.`);
        return false;
      }
    }

    return true;
  }

  nextStep() {
    if (this.currentStep() === 1) {
      if (!this.validateStep1()) return;
    } else if (this.currentStep() === 2) {
      if (!this.validateStep2()) return;
    }

    if (this.currentStep() < 3) {
      this.currentStep.update(s => s + 1);
      window.scrollTo(0, 0);
    }
  }

  prevStep() {
    if (this.currentStep() > 1) {
      this.currentStep.update(s => s - 1);
      window.scrollTo(0, 0);
    }
  }

  addSpace() {
    this.formData.spaces.push({ name: '', type: '', seating: 0, floating: 0 });
  }

  removeSpace(index: number) {
    this.formData.spaces.splice(index, 1);
  }

  initInclusionDetails() {
    const current = { ...this.inclusionDetails() };
    const includes = this.formData.includes;
    const updated: Record<string, InclusionDetail> = {};
    
    includes.forEach(inc => {
      if (current[inc]) {
        updated[inc] = current[inc];
      } else {
        let defaultPrice = 0;
        if (inc.toLowerCase() === 'catering') {
          defaultPrice = this.formData.vegPrice || this.formData.nonVegPrice || 0;
        } else if (inc.toLowerCase() === 'venue') {
          defaultPrice = this.formData.rent || 0;
        }
        updated[inc] = {
          description: '',
          minPrice: defaultPrice,
          maxPrice: defaultPrice,
          images: [],
          keyFeatures: [],
          inclusions: []
        };
      }
    });
    
    this.inclusionDetails.set(updated);
    
    // Set active tab to the first inclusion if not set or if current active tab is removed
    if (includes.length > 0) {
      if (!this.activeInclusionTab() || !includes.includes(this.activeInclusionTab())) {
        this.activeInclusionTab.set(includes[0]);
      }
    } else {
      this.activeInclusionTab.set('');
    }
  }

  toggleInclusion(item: string) {
    if (!item) return;
    const idx = this.formData.includes.indexOf(item);
    if (idx > -1) {
      this.formData.includes.splice(idx, 1);
    } else {
      this.formData.includes.push(item);
    }
    this.initInclusionDetails();
  }

  addInclude(element: any) {
    const item = element?.value;
    if (!item) return;

    // Use setTimeout to defer the array update and dropdown reset.
    // This prevents browser event locks and ensures UI responsiveness for subsequent selections.
    setTimeout(() => {
      if (item === 'SELECT_ALL') {
        this.formData.includes = [...this.availableInclusions()];
      } else {
        const val = item.trim();
        if (val && !this.formData.includes.includes(val)) {
          this.formData.includes.push(val);
        }
      }
      // Safely reset dropdown visual state
      if (element) element.value = '';
      this.initInclusionDetails();
    }, 10);
  }

  removeInclude(index: number) {
    this.formData.includes.splice(index, 1);
    this.initInclusionDetails();
  }

  removeInclusionFromSidebar(event: Event, incName: string) {
    event.stopPropagation();
    const idx = this.formData.includes.indexOf(incName);
    if (idx > -1) {
      this.removeInclude(idx);
    }
  }

  onCategoryChange(categoryKey: string) {
    this.selectedCategoryKey.set(categoryKey);
    this.updateInclusionsForCategory(categoryKey);
    // Reset selected tier when category changes
    this.formData.theme = '';
    this.selectedTierName.set('');
    // Completely clear selected inclusions when the category changes
    this.formData.includes = [];
    this.initInclusionDetails();
  }

  updateInclusionsForCategory(categoryKey: string) {
    if (!categoryKey || !this.categories().length) {
      this.availableInclusions.set([]);
      return;
    }
    const cat = this.categories().find((c: any) => c.category === categoryKey);
    this.availableInclusions.set(cat ? cat.popularServices || [] : []);
  }

  getInclusionPriceLimit(incName: string) {
    const tierObj = this.selectedTierObject();
    if (!tierObj || !tierObj.priceRanges) return null;
    return tierObj.priceRanges.find((pr: any) => pr.serviceName.toLowerCase() === incName.toLowerCase()) || null;
  }

  validateInclusionPrices(incName: string): boolean {
    const details = this.inclusionDetails()[incName];
    if (!details) return true;
    
    const val = details.minPrice || 0;
    
    if (val < 0) {
      this.inclusionPriceErrors[incName] = 'Price cannot be negative.';
      return false;
    }
    
    const limit = this.getInclusionPriceLimit(incName);
    if (limit) {
      if (val < limit.minPrice) {
        this.inclusionPriceErrors[incName] = `Price must be at least ₹${limit.minPrice.toLocaleString()}.`;
        return false;
      }
      if (val > limit.maxPrice) {
        this.inclusionPriceErrors[incName] = `Price cannot exceed ₹${limit.maxPrice.toLocaleString()}.`;
        return false;
      }
    }
    
    // Clear error if valid
    delete this.inclusionPriceErrors[incName];
    return true;
  }

  onInclusionPriceChange(incName: string) {
    const details = this.inclusionDetails()[incName];
    if (details) {
      details.maxPrice = details.minPrice;
      this.validateInclusionPrices(incName);
    }
  }

  onCateringPriceChange(incName: string) {
    const details = this.inclusionDetails()[incName];
    if (details) {
      if (this.formData.cuisineType === 'veg') {
        details.minPrice = this.formData.vegPrice || 0;
        details.maxPrice = this.formData.vegPrice || 0;
      } else if (this.formData.cuisineType === 'nonveg') {
        details.minPrice = this.formData.nonVegPrice || 0;
        details.maxPrice = this.formData.nonVegPrice || 0;
      } else { // mixed
        details.minPrice = Math.min(this.formData.vegPrice || 0, this.formData.nonVegPrice || 0);
        details.maxPrice = Math.max(this.formData.vegPrice || 0, this.formData.nonVegPrice || 0);
      }
      this.validateInclusionPrices(incName);
    }
  }

  onVenuePriceChange(incName: string) {
    const details = this.inclusionDetails()[incName];
    if (details) {
      details.minPrice = this.formData.rent || 0;
      details.maxPrice = this.formData.rent || 0;
      this.validateInclusionPrices(incName);
    }
  }

  triggerInclusionPhotoUpload(input: HTMLInputElement) {
    input.click();
  }

  onInclusionFileSelected(event: any, incName: string) {
    const details = this.inclusionDetails()[incName];
    if (!details) return;

    const files = event.target.files;
    if (!files || files.length === 0) return;

    const currentCount = details.images.length;
    const maxAllowed = 5 - currentCount;
    if (maxAllowed <= 0) {
      alert('Maximum 5 images allowed for inclusion: ' + incName);
      event.target.value = '';
      return;
    }

    const filesToUpload = Array.from(files).slice(0, maxAllowed) as File[];
    event.target.value = '';
    this.loadFilesToCrop(filesToUpload, 'inclusion:' + incName);
  }

  onPortfolioFileSelected(event: any) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const currentCount = this.uploadedPhotos().length;
    const maxAllowed = 5 - currentCount;
    if (maxAllowed <= 0) {
      alert('Maximum 5 images allowed for portfolio.');
      event.target.value = '';
      return;
    }

    const filesToUpload = Array.from(files).slice(0, maxAllowed) as File[];
    event.target.value = '';
    this.loadFilesToCrop(filesToUpload, 'portfolio');
  }

  async loadFilesToCrop(files: File[], target: string) {
    this.cropItems = [];
    this.currentIndex = 0;
    this.cropping.set(false);

    const readPromises = Array.from(files).map((file: File) => {
      return new Promise<CropItem>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          const dataUrl = e.target.result;
          
          const tempImg = new Image();
          tempImg.onload = () => {
            const originalW = tempImg.naturalWidth;
            const originalH = tempImg.naturalHeight;
            
            const scaleX = 400 / originalW;
            const scaleY = 300 / originalH;
            const fitted = Math.max(scaleX, scaleY);
            
            const w = originalW * fitted;
            const h = originalH * fitted;
            const tx = (400 - w) / 2;
            const ty = (300 - h) / 2;
            
            resolve({
              file,
              dataUrl,
              zoom: 1.0,
              translateX: tx,
              translateY: ty,
              imageWidth: w,
              imageHeight: h,
              zoomValue: 1.0,
              prevZoom: 1.0,
              fittedScale: fitted,
              imgOriginalWidth: originalW,
              imgOriginalHeight: originalH
            });
          };
          tempImg.src = dataUrl;
        };
        reader.readAsDataURL(file);
      });
    });

    const items = await Promise.all(readPromises);
    this.cropItems = items;
    
    if (this.cropItems.length > 0) {
      this.currentCropTarget = target;
      this.loadState(0);
      this.showCropModal.set(true);
      document.body.classList.add('modal-open');
    }
  }

  saveCurrentState() {
    if (this.currentIndex >= 0 && this.currentIndex < this.cropItems.length) {
      const item = this.cropItems[this.currentIndex];
      item.zoom = this.zoom();
      item.translateX = this.translateX();
      item.translateY = this.translateY();
      item.imageWidth = this.imageWidth();
      item.imageHeight = this.imageHeight();
      item.zoomValue = this.zoomValue;
      item.prevZoom = this.prevZoom;
      item.fittedScale = this.fittedScale;
      item.imgOriginalWidth = this.imgOriginalWidth;
      item.imgOriginalHeight = this.imgOriginalHeight;
    }
  }

  loadState(index: number) {
    this.currentIndex = index;
    const item = this.cropItems[index];
    this.imageSrc.set(item.dataUrl);
    this.zoom.set(item.zoom);
    this.translateX.set(item.translateX);
    this.translateY.set(item.translateY);
    this.imageWidth.set(item.imageWidth);
    this.imageHeight.set(item.imageHeight);
    this.zoomValue = item.zoomValue;
    this.prevZoom = item.prevZoom;
    this.fittedScale = item.fittedScale;
    this.imgOriginalWidth = item.imgOriginalWidth;
    this.imgOriginalHeight = item.imgOriginalHeight;
  }

  switchToImage(index: number) {
    if (index < 0 || index >= this.cropItems.length) return;
    this.saveCurrentState();
    this.loadState(index);
  }

  onCropImageLoaded(event: Event): void {
    // When the image source updates dynamically on index switch,
    // we do not want to override fittedScale if it's already calculated.
    // However, since loadState sets all variables from stored cropItems, we are safe.
  }

  onZoomChange(): void {
    const oldZoom = this.prevZoom;
    const newZoom = this.zoomValue;
    this.prevZoom = newZoom;

    const oldScale = this.fittedScale * oldZoom;
    const newScale = this.fittedScale * newZoom;

    const viewCenterX = 200;
    const viewCenterY = 150;

    const tx = this.translateX();
    const ty = this.translateY();

    const newTx = viewCenterX - ((viewCenterX - tx) / oldScale) * newScale;
    const newTy = viewCenterY - ((viewCenterY - ty) / oldScale) * newScale;

    this.translateX.set(newTx);
    this.translateY.set(newTy);
    this.zoom.set(newZoom);
    this.boundPosition();
  }

  startDrag(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    this.isDragging = true;
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    this.dragStartPos = { x: clientX, y: clientY };
  }

  private drag(event: MouseEvent | TouchEvent): void {
    if (!this.isDragging) return;
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

    const deltaX = clientX - this.dragStartPos.x;
    const deltaY = clientY - this.dragStartPos.y;

    this.translateX.set(this.translateX() + deltaX);
    this.translateY.set(this.translateY() + deltaY);
    this.boundPosition();

    this.dragStartPos = { x: clientX, y: clientY };
  }

  private endDrag(): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.boundPosition();
  }

  private boundPosition(): void {
    const scale = this.fittedScale * this.zoom();
    const w = this.imgOriginalWidth * scale;
    const h = this.imgOriginalHeight * scale;

    let tx = this.translateX();
    let ty = this.translateY();

    if (w >= 400) {
      if (tx > 0) tx = 0;
      if (tx < 400 - w) tx = 400 - w;
    } else {
      tx = (400 - w) / 2;
    }

    if (h >= 300) {
      if (ty > 0) ty = 0;
      if (ty < 300 - h) ty = 300 - h;
    } else {
      ty = (300 - h) / 2;
    }

    this.translateX.set(tx);
    this.translateY.set(ty);
  }

  cancelCrop(): void {
    this.showCropModal.set(false);
    this.imageSrc.set(null);
    this.fittedScale = 1.0;
    this.imgOriginalWidth = 0;
    this.imgOriginalHeight = 0;
    this.cropItems = [];
    this.currentIndex = 0;
    document.body.classList.remove('modal-open');
  }

  saveAllCrops() {
    this.saveCurrentState(); // Save crop settings of active image first
    this.cropping.set(true);
    this.uploadAndSaveAll(this.currentCropTarget, 0);
  }

  uploadAndSaveAll(target: string, index: number = 0) {
    if (index >= this.cropItems.length) {
      this.cropping.set(false);
      this.cancelCrop();
      return;
    }

    const item = this.cropItems[index];
    const tempImg = new Image();
    tempImg.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        this.uploadAndSaveAll(target, index + 1);
        return;
      }

      const ratio = 800 / 400;
      const scale = item.fittedScale * item.zoom;
      const destW = item.imgOriginalWidth * scale * ratio;
      const destH = item.imgOriginalHeight * scale * ratio;
      const destX = item.translateX * ratio;
      const destY = item.translateY * ratio;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 800, 600);
      ctx.drawImage(tempImg, destX, destY, destW, destH);

      canvas.toBlob((blob) => {
        if (!blob) {
          this.uploadAndSaveAll(target, index + 1);
          return;
        }

        const uniqueName = `cropped_${Date.now()}_${index}_${Math.floor(Math.random() * 10000)}.jpg`;
        const file = new File([blob], uniqueName, { type: 'image/jpeg' });

        this.supportService.uploadAttachment(file).subscribe({
          next: (res) => {
            if (res && res.url) {
              const base = environment.apiUrl.replace('/api/v1', '');
              const finalUrl = res.url.startsWith('http') ? res.url : `${base}${res.url}`;

              if (target === 'portfolio') {
                this.uploadedPhotos.update(p => [...p, finalUrl]);
              } else if (target.startsWith('inclusion:')) {
                const incName = target.split(':')[1];
                const details = this.inclusionDetails()[incName];
                if (details && details.images.length < 5) {
                  details.images.push(finalUrl);
                  this.inclusionDetails.set({ ...this.inclusionDetails() });
                }
              }
            }
            this.uploadAndSaveAll(target, index + 1);
          },
          error: (err) => {
            if (!environment.production) { console.error('Failed to upload file at index ' + index, err); }
            this.uploadAndSaveAll(target, index + 1);
          }
        });
      }, 'image/jpeg', 0.82);
    };
    tempImg.src = item.dataUrl;
  }

  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent): void {
    if (this.isDragging) {
      this.drag(event);
    }
  }

  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    if (this.isDragging) {
      this.endDrag();
    }
  }

  @HostListener('document:touchmove', ['$event'])
  onDocumentTouchMove(event: TouchEvent): void {
    if (this.isDragging) {
      this.drag(event);
    }
  }

  @HostListener('document:touchend')
  onDocumentTouchEnd(): void {
    if (this.isDragging) {
      this.endDrag();
    }
  }

  removeInclusionPhoto(incName: string, index: number) {
    const details = this.inclusionDetails()[incName];
    if (details) {
      details.images.splice(index, 1);
      this.inclusionDetails.set({ ...this.inclusionDetails() });
    }
  }

  addFeature(incName: string, inputElement: HTMLInputElement) {
    const val = inputElement.value?.trim();
    if (!val) return;
    
    const details = this.inclusionDetails()[incName];
    if (details && !details.keyFeatures.includes(val)) {
      details.keyFeatures.push(val);
      this.inclusionDetails.set({ ...this.inclusionDetails() });
      inputElement.value = '';
    }
  }

  removeFeature(incName: string, index: number) {
    const details = this.inclusionDetails()[incName];
    if (details) {
      details.keyFeatures.splice(index, 1);
      this.inclusionDetails.set({ ...this.inclusionDetails() });
    }
  }

  addInclusionItem(incName: string, inputElement: HTMLInputElement) {
    const val = inputElement.value?.trim();
    if (!val) return;
    
    const details = this.inclusionDetails()[incName];
    if (details && !details.inclusions.includes(val)) {
      details.inclusions.push(val);
      this.inclusionDetails.set({ ...this.inclusionDetails() });
      inputElement.value = '';
    }
  }

  removeInclusionItem(incName: string, index: number) {
    const details = this.inclusionDetails()[incName];
    if (details) {
      details.inclusions.splice(index, 1);
      this.inclusionDetails.set({ ...this.inclusionDetails() });
    }
  }
  

  removePhoto(index: number) {
    this.uploadedPhotos.update(p => p.filter((_, i) => i !== index));
  }

  saveService() {
    if (!this.validateStep1()) {
      this.currentStep.set(1);
      window.scrollTo(0, 0);
      return;
    }
    if (!this.validateStep2()) {
      this.currentStep.set(2);
      window.scrollTo(0, 0);
      return;
    }
    if (!this.validateStep3()) {
      this.currentStep.set(3);
      window.scrollTo(0, 0);
      return;
    }
    this.showVerificationModal.set(true);
  }

  cancelSaveService() {
    this.showVerificationModal.set(false);
  }

  confirmSaveService() {
    this.showVerificationModal.set(false);
    this.isSubmitting.set(true);

    let descriptionPayload = this.formData.description;
    const currentDetails = this.inclusionDetails();
    if (Object.keys(currentDetails).length > 0) {
      descriptionPayload += '\n\n---INCLUSION_DETAILS---\n' + JSON.stringify(currentDetails);
    }

    const payload = {
      category: this.formData.category,
      name: this.formData.name,
      description: descriptionPayload,
      theme: this.formData.theme,
      experience: parseInt(this.formData.experience) || 0,
      
      address: {
        country: this.formData.country,
        state: this.formData.state,
        city: this.formData.city,
        locality: this.formData.locality,
        street: this.formData.street,
        landmark: this.formData.landmark,
        pincode: this.formData.pincode
      },
      
      pricing: {
        vegPrice: this.formData.cuisineType === 'nonveg' ? 0 : this.formData.vegPrice,
        nonVegPrice: this.formData.cuisineType === 'veg' ? 0 : this.formData.nonVegPrice,
        roomPrice: this.formData.roomPrice,
        basePrice: this.formData.basePrice,
        rent: this.formData.rent,
        unit: this.formData.unit,
        cuisine: this.formData.cuisine,
        cuisineType: this.formData.cuisineType
      },
      
      capacity: {
        maxGuests: this.formData.maxCapacity,
        parkingCapacity: this.formData.parkingCapacity,
        totalRooms: this.formData.totalRooms
      },
      
      policies: {
        cateringPolicy: this.formData.cateringPolicy,
        decorPolicy: this.formData.decorPolicy,
        alcoholPolicy: this.formData.alcoholPolicy,
        djPolicy: this.formData.djPolicy
      },
      
      amenities: {
        hasAc: this.formData.hasAc,
        hasPowerBackup: this.formData.hasPowerBackup,
        hasChangingRooms: this.formData.hasChangingRooms,
        hasParking: this.formData.hasParking
      },
      
      spaces: this.formData.spaces.map(s => ({
        name: s.name,
        type: s.type,
        seatingCapacity: s.seating,
        floatingCapacity: s.floating
      })),
      
      includes: this.formData.includes,
      images: this.uploadedPhotos()
    };

    if (this.isEditMode() && this.serviceId()) {
      this.api.updatePackage(this.serviceId()!, payload).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.router.navigate(['/vendor/my-services']);
        },
        error: (err) => {
          if (!environment.production) { console.error('Failed to update service', err); }
          this.isSubmitting.set(false);
        }
      });
    } else {
      this.api.createPackage(payload).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.router.navigate(['/vendor/my-services']);
        },
        error: (err) => {
          if (!environment.production) { console.error('Failed to create service', err); }
          this.isSubmitting.set(false);
        }
      });
    }
  }
}
