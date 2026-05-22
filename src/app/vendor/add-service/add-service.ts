import { Component, signal, OnInit, inject, computed, ViewChild, ElementRef, NgZone, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { VendorPackageService } from '../../core/services/vendor-package.service';
import { EventCategoryService } from '../../core/services/event-category.service';
import { ServiceCategoryDef } from '../../core/models/service.model';

declare var google: any;

@Component({
  selector: 'app-vendor-add-service',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-service.html',
  styleUrl: './add-service.css'
})
export class VendorAddService implements OnInit {
  private api = inject(VendorPackageService);
  private eventCategoryService = inject(EventCategoryService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private ngZone = inject(NgZone);

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

    // Spaces
    spaces: [
      { name: 'Main Hall', type: 'Indoor', seating: 0, floating: 0 }
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

  availableThemes = [
    'Standard',
    'Premium',
    'Luxury',
    'Elite',
    'Budget',
    'Custom'
  ];

  ngOnInit() {
    this.eventCategoryService.getAll().subscribe((res: any) => {
      this.categories.set(res);
      if (this.formData.category) {
        this.updateInclusionsForCategory(this.formData.category);
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
        
        this.formData.description = svc.description || svc.Description || '';
        this.formData.theme = svc.theme || svc.Theme || '';
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
    if (this.currentStep() < 5) {
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
    this.formData.spaces.push({ name: '', type: 'Indoor', seating: 0, floating: 0 });
  }

  removeSpace(index: number) {
    this.formData.spaces.splice(index, 1);
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
    }, 10);
  }

  removeInclude(index: number) {
    this.formData.includes.splice(index, 1);
  }

  onCategoryChange(categoryKey: string) {
    this.updateInclusionsForCategory(categoryKey);
    // Completely clear selected inclusions when the category changes
    this.formData.includes = [];
  }

  updateInclusionsForCategory(categoryKey: string) {
    if (!categoryKey || !this.categories().length) {
      this.availableInclusions.set([]);
      return;
    }
    const cat = this.categories().find((c: any) => c.category === categoryKey);
    this.availableInclusions.set(cat ? cat.popularServices || [] : []);
  }

  triggerFileUpload() {
    // Mock photo upload
    const mockPhotos = [
      'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400',
      'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400',
      'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=400'
    ];
    if (this.uploadedPhotos().length < 6) {
      this.uploadedPhotos.update(p => [...p, mockPhotos[p.length % 3]]);
    }
  }

  removePhoto(index: number) {
    this.uploadedPhotos.update(p => p.filter((_, i) => i !== index));
  }

  saveService() {
    this.showVerificationModal.set(true);
  }

  cancelSaveService() {
    this.showVerificationModal.set(false);
  }

  confirmSaveService() {
    this.showVerificationModal.set(false);
    this.isSubmitting.set(true);

    const payload = {
      category: this.formData.category,
      name: this.formData.name,
      description: this.formData.description,
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
