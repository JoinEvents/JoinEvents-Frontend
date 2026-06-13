import { Component, signal, OnInit, OnDestroy, inject, computed, ViewChild, ElementRef, NgZone, AfterViewInit, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { VendorPackageService } from '../../core/services/vendor-package.service';
import { EventCategoryService } from '../../core/services/event-category.service';
import { ServiceCategoryDef } from '../../core/models/service.model';
import { EventTierService } from '../../core/services/event-tier.service';
import { SupportService } from '../../core/services/support.service';
import { environment } from '../../../environments/environment';

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
      this.addressSearchElement = content;
      setTimeout(() => this.initAutocomplete(), 150); // Provide 150ms to guarantee browser attachment and paint
    }
  }
  @ViewChild('mapContainer') set mapContainer(content: ElementRef) {
    if (content) {
      this.mapElement = content;
      setTimeout(() => this.initMap(), 150); // Provide 150ms to guarantee browser attachment and paint
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
        console.error('Failed to load tiers from API, using fallback themes:', err);
      }
    });

    // Check for edit mode
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.serviceId.set(id);
      this.loadServiceData(id);
    }

    this.loadGoogleMapsScript();
  }

  loadGoogleMapsScript() {
    if (typeof google !== 'undefined' && google.maps && google.maps.places) {
      this.initAutocomplete();
      this.initMap();
      return;
    }

    const scriptId = 'google-maps-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    if (script) {
      script.addEventListener('load', () => {
        this.ngZone.run(() => {
          this.initAutocomplete();
          this.initMap();
        });
      });
      return;
    }

    script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&libraries=places';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      this.ngZone.run(() => {
        this.initAutocomplete();
        this.initMap();
      });
    };
    script.onerror = (err) => {
      console.error('Failed to load Google Maps script dynamically:', err);
    };
    document.head.appendChild(script);
  }

  initAutocomplete() {
    if (!this.addressSearchElement || !this.addressSearchElement.nativeElement) {
      console.warn('Skipping Google Autocomplete: Element not found in DOM.');
      return;
    }
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
      console.warn('Google Maps API not loaded yet for autocomplete.');
      return;
    }
    try {
      this.autocomplete = new google.maps.places.Autocomplete(this.addressSearchElement.nativeElement, {
        componentRestrictions: { country: 'in' },
        fields: ['address_components', 'geometry']
      });

      this.autocomplete.addListener('place_changed', () => {
        this.ngZone.run(() => {
          const place = this.autocomplete.getPlace();
          if (!place.geometry || !place.geometry.location) return;

          this.updateAddressFromPlace(place);
          this.updateMapLocation(place.geometry.location);
        });
      });
    } catch (err) {
      console.error('Failed to initialize Google Autocomplete:', err);
    }
  }

  initMap() {
    if (!this.mapElement || !this.mapElement.nativeElement) {
      console.warn('Skipping Google Map: Map container element not found in DOM.');
      return;
    }
    if (typeof google === 'undefined' || !google.maps) {
      console.warn('Google Maps API not loaded yet for map.');
      return;
    }
    try {
      const defaultLoc = { lat: 17.3850, lng: 78.4867 }; // Hyderabad
      this.map = new google.maps.Map(this.mapElement.nativeElement, {
        center: defaultLoc,
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false
      });

      this.marker = new google.maps.Marker({
        position: defaultLoc,
        map: this.map,
        draggable: true
      });

      this.marker.addListener('dragend', () => {
        const pos = this.marker.getPosition();
        if (pos) {
          this.reverseGeocode(pos);
        }
      });

      this.map.addListener('click', (event: any) => {
        if (event.latLng) {
          this.updateMapLocation(event.latLng);
          this.reverseGeocode(event.latLng);
        }
      });
    } catch (err) {
      console.error('Failed to initialize Google Map:', err);
    }
  }

  updateMapLocation(location: any) {
    this.map.setCenter(location);
    this.marker.setPosition(location);
    this.map.setZoom(17);
  }

  updateAddressFromPlace(place: any) {
    const components = place.address_components || [];
    
    // Reset fields
    this.formData.state = '';
    this.formData.city = '';
    this.formData.locality = '';
    this.formData.street = '';
    this.formData.pincode = '';

    components.forEach((c: any) => {
      const types = c.types;
      if (types.includes('administrative_area_level_1')) this.formData.state = c.long_name;
      if (types.includes('locality')) this.formData.city = c.long_name;
      if (types.includes('sublocality_level_1')) this.formData.locality = c.long_name;
      if (types.includes('route')) this.formData.street = c.long_name;
      if (types.includes('postal_code')) this.formData.pincode = c.long_name;
    });
  }

  reverseGeocode(latLng: any) {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: latLng }, (results: any, status: any) => {
      if (status === 'OK' && results && results[0]) {
        this.ngZone.run(() => {
          this.updateAddressFromPlace(results[0]);
          this.addressSearchElement.nativeElement.value = results[0].formatted_address;
        });
      }
    });
  }

  loadServiceData(id: string) {
    this.api.getPackageById(id).subscribe((svc: any) => {
      if (svc) {
        console.log('Loaded service for editing:', svc);
        // Hydrate form thoroughly - handle both PascalCase and camelCase
        this.formData.name = svc.name || svc.Name || '';
        this.formData.category = svc.category || svc.Category || '';
        
        // Trigger reactive updates for category
        this.updateInclusionsForCategory(this.formData.category);
        this.selectedCategoryKey.set(this.formData.category);
        
        const rawDesc = svc.description || svc.Description || '';
        let cleanedDesc = rawDesc;
        let parsedInclusionDetails: any = {};
        if (rawDesc.includes('\n\n---INCLUSION_DETAILS---\n')) {
          const parts = rawDesc.split('\n\n---INCLUSION_DETAILS---\n');
          cleanedDesc = parts[0];
          try {
            parsedInclusionDetails = JSON.parse(parts[1]) || {};
          } catch (e) {
            console.error('Failed to parse inclusion details JSON in loadServiceData', e);
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

  nextStep() {
    if (this.currentStep() < 4) {
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
          defaultPrice = this.formData.vegPrice || 0;
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
      details.minPrice = this.formData.vegPrice || 0;
      details.maxPrice = this.formData.vegPrice || 0;
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
            console.error('Failed to upload file at index ' + index, err);
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
    // Validate all inclusion prices
    let hasError = false;
    this.formData.includes.forEach(inc => {
      if (!this.validateInclusionPrices(inc)) {
        hasError = true;
      }
    });
    if (hasError) {
      alert('Please fix the price range errors on your inclusions before saving.');
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
        vegPrice: this.formData.vegPrice,
        nonVegPrice: this.formData.nonVegPrice,
        roomPrice: this.formData.roomPrice,
        basePrice: this.formData.basePrice,
        rent: this.formData.rent,
        unit: this.formData.unit
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
          console.error('Failed to update service', err);
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
          console.error('Failed to create service', err);
          this.isSubmitting.set(false);
        }
      });
    }
  }
}
