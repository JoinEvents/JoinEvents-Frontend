import { Injectable, signal } from '@angular/core';
import { of, Observable } from 'rxjs';
import { delay, catchError, map, switchMap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { EventType, EventPackage } from '../models/event.model';
import { Booking } from '../models/booking.model';
import { Vendor, CalendarDay } from '../models/vendor.model';
import { VendorService, ServiceCategoryDef } from '../models/service.model';
import { ChatThread, ChatMessage, SupportTicket } from '../models/message.model';
import { CustomerProfile } from '../models/user.model';
import { BookingStatus } from '../models/booking.model';
import { Employee, EmployeeRole, EmployeeStatus } from '../models/employee.model';

import { environment } from '../../../environments/environment';
 
const DEFAULT_INCLUSIONS: { [key: string]: string[] } = {
  wedding: ['Premium Venue', 'Gourmet Catering', 'Elegant Stage Decor', 'High-End Sound & Lighting', 'Luxury Couple Suite', 'Photography & Videography'],
  birthday: ['Vibrant Venue', 'Fun Party Catering', 'Themed Balloon Decor', 'Dynamic Party Anchor', 'Live Music & DJ'],
  birthday_party: ['Vibrant Venue', 'Fun Party Catering', 'Themed Balloon Decor', 'Dynamic Party Anchor', 'Live Music & DJ'],
  corporate: ['Conference Hall', 'Premium Buffet Catering', 'AV & Projector Setup', 'High-Speed Wi-Fi', 'Executive Lounge Access'],
  beauty: ['Professional Makeup Artists', 'Premium Hairstyling', 'Designer Bridal Wear', 'Traditional Mehendi Art'],
  travel: ['Luxury Chauffeur Services', 'Premium AC Coach Hire', 'Professional Tour Guide', 'Custom Travel Logistics'],
  shopping: ['Handcrafted Invites', 'Customized Guest Hampers', 'Traditional Indian Outfit Curation']
};

@Injectable({ providedIn: 'root' })
export class MockApiService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  // ─── EVENT TYPES ───────────────────────────────────────────────
  globalEventTypes = signal<EventType[]>([
    { id: 'wedding', name: 'Wedding', nameHindi: 'Shaadi', description: 'Grand Indian weddings with all rituals, mehendi, sangeet & reception', icon: 'bi-hearts', category: 'wedding', colorClass: 'event-wedding', gradient: 'linear-gradient(135deg,#E91E8C,#FF6B6B)', startingPrice: 150000, popularServices: ['Venue','Catering','Decoration','Photography','Music','Priest'] },
    { id: 'birthday', name: 'Birthday Party', nameHindi: 'Janmadin', description: 'Fun & vibrant birthday celebrations for all ages', icon: 'bi-balloon-heart', category: 'birthday', colorClass: 'event-birthday', gradient: 'linear-gradient(135deg,#FF6B35,#F59E0B)', startingPrice: 25000, popularServices: ['Venue','Catering','Decoration','Photography','Music'] },
    { id: 'corporate', name: 'Corporate Event', nameHindi: 'Karobar', description: 'Professional corporate meets, conferences, team outings & product launches', icon: 'bi-briefcase', category: 'corporate', colorClass: 'event-corporate', gradient: 'linear-gradient(135deg,#0EA5E9,#6B21A8)', startingPrice: 80000, popularServices: ['Venue','Catering','Transport','Manpower','Photography'] },
    { id: 'beauty', name: 'Beauty & Styling', nameHindi: 'Shringar', icon: 'bi-magic', category: 'beauty', colorClass: 'event-beauty', gradient: 'linear-gradient(135deg,#EC4899,#D946EF)', startingPrice: 5000, popularServices: ['Makeup','Hairstyle','Outfit Rental','Mehendi'] },
    { id: 'travel', name: 'Travel & Transport', nameHindi: 'Yatra', icon: 'bi-airplane-fill', category: 'travel', colorClass: 'event-travel', gradient: 'linear-gradient(135deg,#10B981,#059669)', startingPrice: 8000, popularServices: ['Luxury Cars','Bus Hire','Honeymoon Packages'] },
    { id: 'shopping', name: 'Event Shopping', nameHindi: 'Kharidari', icon: 'bi-bag-heart-fill', category: 'shopping', colorClass: 'event-shopping', gradient: 'linear-gradient(135deg,#F59E0B,#D97706)', startingPrice: 2000, popularServices: ['Invites','Gifts','Traditional Wear'] },
  ]);

  getEventTypes(): Observable<EventType[]> {
    return of(this.globalEventTypes()).pipe(delay(300));
  }

  addEventType(evt: Omit<EventType, 'id'>): Observable<EventType> {
    const newEvt: EventType = { ...evt, id: 'cat_' + Date.now() } as EventType;
    this.globalEventTypes.update(list => [...list, newEvt]);
    return of(newEvt).pipe(delay(300));
  }

  updateEventType(id: string, updates: Partial<EventType>): Observable<boolean> {
    this.globalEventTypes.update(list =>
      list.map(e => e.id === id ? { ...e, ...updates } : e)
    );
    return of(true).pipe(delay(300));
  }

  deleteEventType(id: string): Observable<boolean> {
    this.globalEventTypes.update(list => list.filter(e => e.id !== id));
    return of(true).pipe(delay(300));
  }

  // ─── PACKAGES ──────────────────────────────────────────────────
  getPackages(eventTypeId?: string): Observable<any[]> {
    const packages: any[] = [
      { 
        id: 'w-prem-1', 
        eventTypeId: 'wedding', 
        name: 'Diamond Wedding Package', 
        vendorName: 'Hotel Mansingh',
        venueName: 'The Royal Ballroom',
        location: 'Agra, Uttar Pradesh, India',
        tier: 'premium', 
        price: 5600000, 
        description: 'Luxury wedding at the heart of Agra with Taj views. Experience unparalleled elegance in our signature ballroom, featuring custom crystal chandeliers and a dedicated staff of 50 to ensure every moment is perfect.', 
        services: ['VIP Valet Parking','Gourmet 5-Course Dinner','Designer Stage Decor','Drone Photography','Live Sufi Band','Premium Bridal Suite'], 
        addons: [
          { id: 'a1', name: 'Vintage Car Entry', price: 25000 },
          { id: 'a2', name: 'Cold Fire Pyro', price: 15000 },
          { id: 'a3', name: 'Live Mehendi Artists', price: 10000 }
        ],
        maxGuests: 700, 
        durationHours: 48, 
        isPopular: true, 
        offerExpiresIn: '7 Days, 9:21:50',
        vegOnly: true,
        roomCount: 2,
        sustainabilityTags: ['Zero Waste Catering', 'Local Sourced'],
        image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=800',
        images: [
          'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=800',
          'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&q=80&w=800',
          'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=800',
          'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&q=80&w=800',
          'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?auto=format&fit=crop&q=80&w=800',
          'https://images.unsplash.com/photo-1522673607200-16488321499b?auto=format&fit=crop&q=80&w=800',
          'https://images.unsplash.com/photo-1513273159385-48995328406f?auto=format&fit=crop&q=80&w=800',
          'https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&q=80&w=800'
        ],
        experience: 5,
        rating: 4.8,
        totalReviews: 24,
        address: { country: 'India', state: 'Uttar Pradesh', city: 'Agra', locality: 'Taj East Gate', street: 'Fatehabad Road', landmark: 'Near Taj Mahal', pincode: '282001' },
        pricing: { vegPrice: 1500, nonVegPrice: 2000, roomPrice: 5000, basePrice: 200000, rent: 100000, unit: 'per event' },
        capacity: { maxGuests: 700, parkingCapacity: 150, totalRooms: 50 },
        policies: { cateringPolicy: 'Inhouse Only', decorPolicy: 'Panel Decorators Only', alcoholPolicy: 'Outside Allowed', djPolicy: 'Inhouse DJ Only' },
        spaces: [{ name: 'Grand Ballroom', type: 'Indoor', seatingCapacity: 500, floatingCapacity: 800 }, { name: 'Royal Lawns', type: 'Outdoor', seatingCapacity: 400, floatingCapacity: 700 }]
      },
      { 
        id: 'w-prem-2', 
        eventTypeId: 'wedding', 
        name: 'Royal Heritage Wedding', 
        vendorName: 'Umaid Bhawan',
        venueName: 'Heritage Courtyard',
        location: 'Jodhpur, Rajasthan, India',
        tier: 'premium', 
        price: 8500000, 
        description: 'A true royal experience in the blue city. Celebrate like royalty in the historic courtyard of Umaid Bhawan, surrounded by centuries of heritage and the finest Rajasthani hospitality.', 
        services: ['Heritage Venue','Royal Rajputana Feast','Elephant Grand Entry','Traditional Folk Music','Palace Fireworks'], 
        addons: [
          { id: 'a4', name: 'Camel Parade', price: 45000 },
          { id: 'a5', name: 'Royal Guard Welcome', price: 20000 }
        ],
        maxGuests: 500, 
        durationHours: 72, 
        offerExpiresIn: '3 Days, 4:10:00',
        vegOnly: false,
        roomCount: 50,
        image: 'https://images.unsplash.com/photo-1541010222019-15ad350bc51f?auto=format&fit=crop&q=80&w=800',
        images: [
          'https://images.unsplash.com/photo-1541010222019-15ad350bc51f?auto=format&fit=crop&q=80&w=800',
          'https://images.unsplash.com/photo-1505932794465-1475557465c9?auto=format&fit=crop&q=80&w=800'
        ],
        experience: 8,
        rating: 4.9,
        totalReviews: 45,
        address: { country: 'India', state: 'Rajasthan', city: 'Jodhpur', locality: 'Palace Road', street: 'Circuit House Rd', landmark: 'Near Circuit House', pincode: '342006' },
        pricing: { vegPrice: 2500, nonVegPrice: 3500, roomPrice: 12000, basePrice: 500000, rent: 300000, unit: 'per event' },
        capacity: { maxGuests: 500, parkingCapacity: 200, totalRooms: 64 },
        policies: { cateringPolicy: 'Inhouse Only', decorPolicy: 'Panel Decorators Only', alcoholPolicy: 'Inhouse Only', djPolicy: 'Inhouse DJ Only' },
        spaces: [{ name: 'Heritage Courtyard', type: 'Outdoor', seatingCapacity: 350, floatingCapacity: 600 }, { name: 'Durbar Hall', type: 'Indoor', seatingCapacity: 200, floatingCapacity: 300 }]
      },
      { 
        id: 'w-std-1', 
        eventTypeId: 'wedding', 
        name: 'Elegant Garden Wedding', 
        vendorName: 'Green Meadows',
        venueName: 'The Secret Garden',
        location: 'Bangalore, Karnataka, India',
        tier: 'standard', 
        price: 2500000, 
        description: 'Sustainable and beautiful garden wedding. A lush, green escape within the city, perfect for intimate gatherings and nature lovers seeking a serene celebration.', 
        services: ['Outdoor Venue','Organic Farm-to-Table Menu','Recycled Floral Decor','Acoustic Music Set'], 
        addons: [
          { id: 'a6', name: 'Flower Shower', price: 12000 }
        ],
        maxGuests: 400, 
        durationHours: 12, 
        offerExpiresIn: '5 Days, 12:00:00',
        vegOnly: true,
        roomCount: 5,
        sustainabilityTags: ['Organic Menu', 'Recycled Decor'],
        image: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&q=80&w=800',
        images: [
          'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&q=80&w=800',
          'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=800'
        ],
        experience: 3,
        rating: 4.5,
        totalReviews: 12,
        address: { country: 'India', state: 'Karnataka', city: 'Bangalore', locality: 'Whitefield', street: 'Green Meadows Road', landmark: 'Near Hope Farm Circle', pincode: '560066' },
        pricing: { vegPrice: 1000, nonVegPrice: 1500, roomPrice: 3500, basePrice: 50000, rent: 50000, unit: 'per event' },
        capacity: { maxGuests: 400, parkingCapacity: 80, totalRooms: 12 },
        policies: { cateringPolicy: 'Flexible', decorPolicy: 'Flexible', alcoholPolicy: 'Outside Allowed', djPolicy: 'Flexible' },
        spaces: [{ name: 'The Secret Garden', type: 'Outdoor', seatingCapacity: 250, floatingCapacity: 450 }]
      },
      { 
        id: 'b-basic', 
        eventTypeId: 'birthday', 
        name: 'Fun Birthday', 
        tier: 'basic', 
        price: 25000, 
        description: 'Simple & cheerful birthday party setup', 
        services: ['Venue (50 guests)','Snacks & Cake','Balloon Decoration','Photography'], 
        maxGuests: 50, 
        durationHours: 4, 
        location: 'Local Venue', 
        image: 'https://images.unsplash.com/photo-1530103862676-fa8c9d34b3b3?auto=format&fit=crop&q=80&w=800', 
        images: ['https://images.unsplash.com/photo-1530103862676-fa8c9d34b3b3?auto=format&fit=crop&q=80&w=800'],
        experience: 2,
        rating: 4.2,
        totalReviews: 8,
        address: { country: 'India', state: 'Telangana', city: 'Hyderabad', locality: 'Madhapur', street: 'Hitech City Road', landmark: 'Near Cyber Towers', pincode: '500081' },
        pricing: { vegPrice: 400, nonVegPrice: 600, roomPrice: 2000, basePrice: 10000, rent: 15000, unit: 'per event' },
        capacity: { maxGuests: 50, parkingCapacity: 15, totalRooms: 1 },
        policies: { cateringPolicy: 'Flexible', decorPolicy: 'Flexible', alcoholPolicy: 'Not Allowed', djPolicy: 'Flexible' },
        spaces: [{ name: 'Mini Hall', type: 'Indoor', seatingCapacity: 40, floatingCapacity: 60 }]
      },
    ];
    const result = eventTypeId ? packages.filter(p => p.eventTypeId === eventTypeId) : packages;
    
    // Call the real backend API, fallback to mock data on error
    // Pass category query parameter to target live category filter in backend search controller
    return this.http.get<any>(`${this.apiUrl}/packages/search${eventTypeId ? '?category=' + eventTypeId : ''}`, { headers: { 'X-Suppress-Errors': 'true' } }).pipe(
      map((res: any) => {
        let list: any[] = [];
        if (res && res.packages && Array.isArray(res.packages)) {
          list = res.packages;
        } else if (Array.isArray(res)) {
          list = res;
        }

        // Thoroughly normalize incoming API package shapes into front-end readable objects
        return list.map((p: any) => this.normalizePackage(p));
      }),
      catchError(() => of(result.map(p => this.normalizePackage(p))).pipe(delay(300)))
    );
  }

  private normalizePackage(p: any): any {
    if (!p) return null;

    // Resolve nested/flat pricing configurations
    const pr = p.Pricing || p.pricing || {};
    const priceValue = p.price || p.Price || pr.BasePrice || pr.basePrice || pr.VegPrice || pr.vegPrice || 0;

    // Resolve nested/flat capacity data
    const cp = p.Capacity || p.capacity || {};
    const guests = p.MaxGuests || p.maxGuests || cp.MaxGuests || cp.maxGuests || 100;
    const rooms = p.RoomCount || p.roomCount || cp.TotalRooms || cp.totalRooms || 0;

    // Resolve food dietary settings
    const isVegOnly = p.VegOnly !== undefined ? p.VegOnly : (p.vegOnly !== undefined ? p.vegOnly : (pr.VegPrice && !pr.NonVegPrice ? true : false));

    // Resolve included features arrays
    const inc = p.Includes || p.includes || p.Services || p.services || [];
    let finalInclusions: string[] = [];
    if (Array.isArray(inc) && inc.length > 0) {
      finalInclusions = inc;
    } else {
      const catKey = (p.Category || p.category || p.EventTypeId || p.eventTypeId || 'wedding').toString().toLowerCase();
      if (catKey.includes('wedding') || catKey.includes('shaadi')) {
        finalInclusions = DEFAULT_INCLUSIONS['wedding'];
      } else if (catKey.includes('birthday') || catKey.includes('party')) {
        finalInclusions = DEFAULT_INCLUSIONS['birthday'];
      } else if (catKey.includes('corporate')) {
        finalInclusions = DEFAULT_INCLUSIONS['corporate'];
      } else if (catKey.includes('beauty')) {
        finalInclusions = DEFAULT_INCLUSIONS['beauty'];
      } else if (catKey.includes('travel')) {
        finalInclusions = DEFAULT_INCLUSIONS['travel'];
      } else if (catKey.includes('shopping')) {
        finalInclusions = DEFAULT_INCLUSIONS['shopping'];
      } else {
        finalInclusions = p.Name || p.name ? [p.Name || p.name] : ['Professional Service'];
      }
    }

    // Resolve primary locations
    const addr = p.Address || p.address || {};
    const cityLoc = p.City || p.city || addr.City || addr.city || p.Location || p.location || 'Multiple Locations';

    // Resolve visual attachments list
    const imgs = p.Images || p.images || [];
    const primaryImg = p.Image || p.image || imgs[0] || 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=800';

    // Resolve Amenities
    const am = p.Amenities || p.amenities || {};

    return {
      id: p.id || p.Id,
      eventTypeId: p.eventTypeId || p.EventTypeId || p.Category || p.category || 'wedding',
      name: p.Name || p.name,
      vendorName: p.VendorName || p.vendorName || 'JoinEvents Partner',
      location: cityLoc,
      tier: p.Tier || p.tier || 'premium',
      price: priceValue,
      description: p.Description || p.description,
      maxGuests: guests,
      roomCount: rooms,
      vegOnly: isVegOnly,
      services: Array.isArray(finalInclusions) ? finalInclusions : [],
      addons: p.Addons || p.addons || [],
      image: primaryImg,
      images: imgs,
      sustainabilityTags: p.SustainabilityTags || p.sustainabilityTags || [],
      amenities: {
        hasAc: am.HasAc || am.hasAc || false,
        hasPowerBackup: am.HasPowerBackup || am.hasPowerBackup || false,
        hasChangingRooms: am.HasChangingRooms || am.hasChangingRooms || false,
        hasParking: am.HasParking || am.hasParking || false
      },
      experience: p.Experience !== undefined ? p.Experience : (p.experience !== undefined ? p.experience : 0),
      rating: p.Rating !== undefined ? p.Rating : (p.rating !== undefined ? p.rating : 0),
      totalReviews: p.TotalReviews !== undefined ? p.TotalReviews : (p.totalReviews !== undefined ? p.totalReviews : 0),
      address: {
        country: addr.Country || addr.country || 'India',
        state: addr.State || addr.state || '',
        city: addr.City || addr.city || cityLoc,
        locality: addr.Locality || addr.locality || '',
        street: addr.Street || addr.street || '',
        landmark: addr.Landmark || addr.landmark || '',
        pincode: addr.Pincode || addr.pincode || ''
      },
      pricing: {
        vegPrice: pr.VegPrice !== undefined ? pr.VegPrice : (pr.vegPrice !== undefined ? pr.vegPrice : (isVegOnly ? priceValue : 0)),
        nonVegPrice: pr.NonVegPrice !== undefined ? pr.NonVegPrice : (pr.nonVegPrice !== undefined ? pr.nonVegPrice : (!isVegOnly ? priceValue : 0)),
        roomPrice: pr.RoomPrice !== undefined ? pr.RoomPrice : (pr.roomPrice !== undefined ? pr.roomPrice : 0),
        basePrice: pr.BasePrice !== undefined ? pr.BasePrice : (pr.basePrice !== undefined ? pr.basePrice : 0),
        rent: pr.Rent !== undefined ? pr.Rent : (pr.rent !== undefined ? pr.rent : 0),
        unit: pr.Unit || pr.unit || 'per event'
      },
      capacity: {
        maxGuests: guests,
        parkingCapacity: cp.ParkingCapacity !== undefined ? cp.ParkingCapacity : (cp.parkingCapacity !== undefined ? cp.parkingCapacity : (p.parkingCapacity || 0)),
        totalRooms: rooms
      },
      policies: {
        cateringPolicy: p.Policies?.CateringPolicy || p.Policies?.cateringPolicy || p.policies?.CateringPolicy || p.policies?.cateringPolicy || 'Flexible',
        decorPolicy: p.Policies?.DecorPolicy || p.Policies?.decorPolicy || p.policies?.DecorPolicy || p.policies?.decorPolicy || 'Flexible',
        alcoholPolicy: p.Policies?.AlcoholPolicy || p.Policies?.alcoholPolicy || p.policies?.AlcoholPolicy || p.policies?.alcoholPolicy || 'Flexible',
        djPolicy: p.Policies?.DjPolicy || p.Policies?.djPolicy || p.policies?.DjPolicy || p.policies?.djPolicy || 'Flexible'
      },
      spaces: (p.Spaces || p.spaces || []).map((s: any) => ({
        name: s.Name || s.name || '',
        type: s.Type || s.type || 'Indoor',
        seatingCapacity: s.SeatingCapacity !== undefined ? s.SeatingCapacity : (s.seatingCapacity !== undefined ? s.seatingCapacity : 0),
        floatingCapacity: s.FloatingCapacity !== undefined ? s.FloatingCapacity : (s.floatingCapacity !== undefined ? s.floatingCapacity : 0)
      }))
    };
  }

  getPackageById(id: string): Observable<any> {
    // Try public endpoint first
    return this.http.get<any>(`${this.apiUrl}/packages/${id}`, { headers: { 'X-Suppress-Errors': 'true' } }).pipe(
      map(res => this.normalizePackage(res.data || res.package || res.Package || res)),
      catchError(() => {
        // Try vendor endpoint as fallback (for unpublished services)
        return this.http.get<any>(`${this.apiUrl}/vendor/packages/${id}`, { headers: { 'X-Suppress-Errors': 'true' } }).pipe(
          map(res => this.normalizePackage(res.data || res.package || res.Package || res)),
          catchError(() => {
            // Final fallback: check mock lists
            return this.getPackages().pipe(
              switchMap(pkgs => {
                const pkg = pkgs.find(p => p.id === id);
                if (pkg) return of(pkg);

                return this.getVendorServices().pipe(
                  map(services => {
                    const svc = services.find(s => s.id === id);
                    if (svc) return this.normalizePackage(svc);
                    return null; // Not found anywhere
                  })
                );
              })
            );
          })
        );
      })
    );
  }

  // ─── BOOKINGS ──────────────────────────────────────────────────
  getBookings(customerId?: string): Observable<Booking[]> {
    const bookings: Booking[] = [
      { id: 'bk001', bookingNumber: 'EE-2025-001', customerId: 'c1', customerName: 'Rajesh Kumar', customerPhone: '+91 98765 43210', eventTypeId: 'wedding', eventName: 'Wedding Reception', packageId: 'w-std', packageName: 'Gold Wedding', eventDate: '2025-12-15', venue: 'Raj Mahal Banquet Hall', city: 'Hyderabad', guestCount: 450, status: 'confirmed', advanceAmount: 70000, baseAmount: 350000, extraServicesAmount: 45000, damageCharges: 0, gstPercent: 18, totalAmount: 464100, services: [{ serviceId: 's1', serviceName: 'Premium Catering', category: 'catering', vendorId: 'v1', vendorName: 'Spice Garden Catering', price: 25000, status: 'confirmed' },{ serviceId: 's2', serviceName: 'Floral Decoration', category: 'decoration', vendorId: 'v2', vendorName: 'Blooms & Bliss', price: 20000, status: 'confirmed' }], createdAt: '2025-10-01', notes: 'VIP table for 20 family members' },
      { id: 'bk002', bookingNumber: 'EE-2025-002', customerId: 'c1', customerName: 'Rajesh Kumar', customerPhone: '+91 98765 43210', eventTypeId: 'birthday', eventName: "Daughter's 10th Birthday", packageId: 'b-std', packageName: 'Party Birthday', eventDate: '2025-11-20', venue: 'Fun Zone Party Hall', city: 'Hyderabad', guestCount: 80, status: 'settled', advanceAmount: 12000, baseAmount: 60000, extraServicesAmount: 8000, damageCharges: 2000, damageChargeNotes: 'Broken vase in hallway', isDamageChargeApproved: true, gstPercent: 18, totalAmount: 82600, finalPaidAmount: 82600, services: [], createdAt: '2025-09-15' },
      { id: 'bk003', bookingNumber: 'EE-2026-001', customerId: 'c1', customerName: 'Rajesh Kumar', customerPhone: '+91 98765 43210', eventTypeId: 'religious', eventName: 'Gruhapravesh Puja', packageId: 'r-std', packageName: 'Full Puja', eventDate: '2026-05-10', venue: 'Home', city: 'Hyderabad', guestCount: 40, status: 'pending', advanceAmount: 0, baseAmount: 40000, extraServicesAmount: 0, damageCharges: 0, gstPercent: 18, totalAmount: 47200, services: [], createdAt: '2026-04-20' },
      { id: 'bk005', bookingNumber: 'EE-2026-003', customerId: 'c1', customerName: 'Rajesh Kumar', customerPhone: '+91 98765 43210', eventTypeId: 'wedding', eventName: 'Engagement Ceremony', eventDate: '2026-07-15', venue: 'Grand Plaza', city: 'Hyderabad', guestCount: 150, status: 'in_progress', advanceAmount: 30000, baseAmount: 150000, extraServicesAmount: 20000, damageCharges: 5000, damageChargeNotes: 'Table cloth burns', isDamageChargeApproved: false, gstPercent: 18, totalAmount: 200600, services: [], createdAt: '2026-03-20' },
    ];
    const fallbackResult = customerId ? bookings.filter(b => b.customerId === customerId) : bookings;
    
    // Returning mock data directly since the backend /bookings endpoint does not exist yet
    return of(fallbackResult).pipe(delay(300));
  }

  getAdminBookings(): Observable<Booking[]> {
    return of<Booking[]>([
      { 
        id: 'bk001', bookingNumber: 'EE-2025-001', customerId: 'c1', customerName: 'Rajesh Kumar', customerPhone: '+91 98765 43210', eventTypeId: 'wedding', eventName: 'Wedding Reception', packageId: 'w-std', packageName: 'Gold Wedding', eventDate: '2025-12-15', venue: 'Raj Mahal Banquet Hall', city: 'Hyderabad', guestCount: 450, status: 'confirmed', advanceAmount: 70000, baseAmount: 350000, extraServicesAmount: 45000, damageCharges: 0, gstPercent: 18, totalAmount: 464100, 
        services: [
          { serviceId: 's1', serviceName: 'Premium Catering', category: 'catering', vendorId: 'v1', vendorName: 'Spice Garden Catering', price: 25000, status: 'confirmed' },
          { serviceId: 's2', serviceName: 'Floral Decoration', category: 'decoration', vendorId: 'v2', vendorName: 'Blooms & Bliss', price: 20000, status: 'confirmed' }
        ], 
        createdAt: '2025-10-01', assignedTo: 'Priya Nair',
        internalNotes: 'VIP customer, prefers floral decor in pastel shades.',
        supportLogs: [
          { date: '2025-10-02', message: 'Welcome call done. Explained the process.', actor: 'Priya' },
          { date: '2025-10-05', message: 'Vendor V1 confirmed the menu.', actor: 'Priya' }
        ]
      },
      { 
        id: 'bk002', bookingNumber: 'EE-2025-002', customerId: 'c1', customerName: 'Rajesh Kumar', customerPhone: '+91 98765 43210', eventTypeId: 'birthday', eventName: "Daughter's 10th Birthday", eventDate: '2025-11-20', venue: 'Fun Zone Party Hall', city: 'Hyderabad', guestCount: 80, status: 'settled', advanceAmount: 12000, baseAmount: 60000, extraServicesAmount: 8000, damageCharges: 2000, gstPercent: 18, totalAmount: 82600, services: [], createdAt: '2025-09-15', assignedTo: 'Rahul Support',
        supportLogs: [{ date: '2025-09-16', message: 'Payment verified.', actor: 'System' }]
      },
      { id: 'bk004', bookingNumber: 'EE-2026-002', customerId: 'c2', customerName: 'Sunita Patel', customerPhone: '+91 97654 32109', eventTypeId: 'corporate', eventName: 'Annual Day Conference', packageId: 'c-std', packageName: 'Corporate Event', eventDate: '2026-06-05', venue: 'Novotel Business Center', city: 'Bangalore', guestCount: 150, status: 'advance_paid', advanceAmount: 40000, baseAmount: 200000, extraServicesAmount: 25000, damageCharges: 0, gstPercent: 18, totalAmount: 265300, services: [], createdAt: '2026-04-01', assignedTo: 'Priya Nair' },
      { id: 'bk005', bookingNumber: 'EE-2026-003', customerId: 'c3', customerName: 'Anand Reddy', customerPhone: '+91 96543 21098', eventTypeId: 'religious', eventName: 'Upanayanam Ceremony', packageId: 'r-prem', packageName: 'Grand Hawan', eventDate: '2026-07-15', venue: 'Community Hall', city: 'Chennai', guestCount: 180, status: 'in_progress', advanceAmount: 24000, baseAmount: 120000, extraServicesAmount: 15000, damageCharges: 0, gstPercent: 18, totalAmount: 160300, services: [], createdAt: '2026-03-20', assignedTo: 'Rahul Support' },
    ]).pipe(delay(300));
  }

  addSupportLog(bookingId: string, message: string, actor: string): Observable<boolean> {
    return this.http.post<any>(`${this.apiUrl}/support/bookings/${bookingId}/logs`, { message, actor }, { headers: { 'X-Suppress-Errors': 'true' } }).pipe(
      map(() => true),
      catchError(() => of(true).pipe(delay(500)))
    );
  }

  remindVendor(vendorId: string, bookingId: string): Observable<boolean> {
    return this.http.post<any>(`${this.apiUrl}/support/reminders/vendor`, { vendorId, bookingId }, { headers: { 'X-Suppress-Errors': 'true' } }).pipe(
      map(() => true),
      catchError(() => of(true).pipe(delay(1000)))
    );
  }

  // ─── BOOKING MANAGEMENT ────────────────────────────────────────
  updateBookingStatus(bookingId: string, status: BookingStatus): Observable<boolean> {
    return this.http.patch<any>(`${this.apiUrl}/bookings/${bookingId}/status`, { status }, { headers: { 'X-Suppress-Errors': 'true' } }).pipe(
      map(() => true),
      catchError(() => of(true).pipe(delay(300)))
    );
  }

  cancelBooking(bookingId: string, reason: string, cancelledBy: 'customer' | 'vendor'): Observable<boolean> {
    return this.http.post<any>(`${this.apiUrl}/bookings/${bookingId}/cancel`, { reason, cancelledBy }, { headers: { 'X-Suppress-Errors': 'true' } }).pipe(
      map(() => true),
      catchError(() => of(true).pipe(delay(500)))
    );
  }

  addDamageCharges(bookingId: string, amount: number, notes: string): Observable<boolean> {
    return this.http.post<any>(`${this.apiUrl}/bookings/${bookingId}/damage`, { amount, notes }, { headers: { 'X-Suppress-Errors': 'true' } }).pipe(
      map(() => true),
      catchError(() => of(true).pipe(delay(500)))
    );
  }

  approveDamageCharges(bookingId: string): Observable<boolean> {
    return this.http.post<any>(`${this.apiUrl}/bookings/${bookingId}/damage/approve`, {}, { headers: { 'X-Suppress-Errors': 'true' } }).pipe(
      map(() => true),
      catchError(() => of(true).pipe(delay(300)))
    );
  }

  raiseDispute(bookingId: string, reason: string): Observable<boolean> {
    return this.http.post<any>(`${this.apiUrl}/bookings/${bookingId}/dispute`, { reason }, { headers: { 'X-Suppress-Errors': 'true' } }).pipe(
      map(() => true),
      catchError(() => of(true).pipe(delay(500)))
    );
  }

  // ─── VENDORS ───────────────────────────────────────────────────
  globalVendors = signal<Vendor[]>([
    { id: 'v1', name: 'Amit Sharma', businessName: 'Spice Garden Catering', email: 'vendor@demo.com', phone: '+91 91234 56789', city: 'Hyderabad', services: ['catering'], isVerified: true, sustainabilityTags: ['Zero Waste Catering', 'Local Sourced'], verificationStatus: 'verified', verificationDocs: [{ type: 'FSSAI License', name: 'fssai.pdf', uploadedAt: '2025-01-10', status: 'approved' },{ type: 'GST Certificate', name: 'gst.pdf', uploadedAt: '2025-01-10', status: 'approved' }], rating: 4.8, totalReviews: 245, totalEarnings: 850000, joinedDate: '2025-01-01', gstNumber: '36AABCU9603R1ZX', accountStatus: 'active' },
    { id: 'v2', name: 'Meera Krishnan', businessName: 'Blooms & Bliss Decor', email: 'meera@blooms.com', phone: '+91 92345 67890', city: 'Hyderabad', services: ['decoration'], isVerified: true, sustainabilityTags: ['Eco-friendly Decor', 'Reusable Materials'], verificationStatus: 'verified', verificationDocs: [{ type: 'Business Registration', name: 'reg.pdf', uploadedAt: '2025-02-15', status: 'approved' }], rating: 4.9, totalReviews: 312, totalEarnings: 650000, joinedDate: '2025-02-01', accountStatus: 'active' },
    { id: 'v3', name: 'Ravi Shankar', businessName: 'Palace Grounds Venue', email: 'ravi@palace.com', phone: '+91 93456 78901', city: 'Bangalore', services: ['venue'], isVerified: false, sustainabilityTags: ['LEED Certified'], verificationStatus: 'under_review', verificationDocs: [{ type: 'Property Documents', name: 'prop.pdf', uploadedAt: '2026-04-01', status: 'pending' },{ type: 'Fire NOC', name: 'noc.pdf', uploadedAt: '2026-04-01', status: 'pending' }], rating: 0, totalReviews: 0, totalEarnings: 0, joinedDate: '2026-04-01', accountStatus: 'active' },
    { id: 'v4', name: 'Pandu Subramanian', businessName: 'Royal Fleet Transport', email: 'pandu@royalfleet.com', phone: '+91 94567 89012', city: 'Chennai', services: ['transport'], verificationStatus: 'pending', verificationDocs: [], rating: 0, totalReviews: 0, totalEarnings: 0, joinedDate: '2026-04-18', accountStatus: 'active' },
    { id: 'v5', name: 'Pandit Gopal Das', businessName: 'Vedic Rituals', email: 'gopaldas@vedic.com', phone: '+91 95678 90123', city: 'Hyderabad', services: ['priest'], verificationStatus: 'verified', verificationDocs: [{ type: 'Certificate', name: 'vedic.pdf', uploadedAt: '2025-06-01', status: 'approved' }], rating: 4.7, totalReviews: 180, totalEarnings: 320000, joinedDate: '2025-06-01', accountStatus: 'suspended' },
  ]);

  getVendors(): Observable<Vendor[]> {
    return this.http.get<Vendor[]>(`${this.apiUrl}/admin/vendors`, { headers: { 'X-Suppress-Errors': 'true' } }).pipe(
      catchError(() => of(this.globalVendors()).pipe(delay(300)))
    );
  }

  moderateVendor(vendorId: string, action: 'suspend' | 'ban' | 'reactivate', reason?: string, duration?: string): Observable<boolean> {
    // Optimistic UI update
    this.globalVendors.update(vendors => 
      vendors.map(v => {
        if (v.id === vendorId) {
          const status = action === 'suspend' ? 'suspended' : action === 'ban' ? 'banned' : 'active';
          return { 
            ...v, 
            accountStatus: status,
            suspensionReason: action !== 'reactivate' ? reason : undefined,
            suspensionDuration: action === 'suspend' ? duration : undefined
          };
        }
        return v;
      })
    );
    
    // API call
    return this.http.post<any>(`${this.apiUrl}/admin/vendors/${vendorId}/moderate`, { action, reason, duration }, { headers: { 'X-Suppress-Errors': 'true' } }).pipe(
      map(() => true),
      catchError(() => of(true).pipe(delay(300)))
    );
  }

  // ─── CUSTOMERS ────────────────────────────────────────────────
  globalCustomers = signal<CustomerProfile[]>([
    { id: 'c1', name: 'Rajesh Kumar', email: 'customer@demo.com', phone: '+91 98765 43210', city: 'Hyderabad', totalBookings: 3, totalSpent: 546700, joinedDate: '2025-09-01', accountStatus: 'active', role: 'customer', loyaltyPoints: 450, strikes: 0 },
    { id: 'c2', name: 'Sunita Patel', email: 'sunita@demo.com', phone: '+91 97654 32109', city: 'Bangalore', totalBookings: 1, totalSpent: 265300, joinedDate: '2026-03-10', accountStatus: 'active', role: 'customer', loyaltyPoints: 120, strikes: 0 },
    { id: 'c3', name: 'Anand Reddy', email: 'anand@demo.com', phone: '+91 96543 21098', city: 'Chennai', totalBookings: 2, totalSpent: 307500, joinedDate: '2026-01-15', accountStatus: 'warning', role: 'customer', loyaltyPoints: 200, strikes: 1, suspensionReason: 'Frequent cancellations' },
    { id: 'c4', name: 'Meena Sharma', email: 'meena@demo.com', phone: '+91 95432 10987', city: 'Mumbai', totalBookings: 0, totalSpent: 0, joinedDate: '2026-04-18', accountStatus: 'active', role: 'customer', loyaltyPoints: 0, strikes: 0 },
  ]);

  getCustomers(): Observable<CustomerProfile[]> {
    // Returning mock data directly since the backend /admin/customers endpoint does not exist yet
    return of(this.globalCustomers()).pipe(delay(300));
  }

  moderateCustomer(customerId: string, action: 'warn' | 'restrict' | 'suspend' | 'ban' | 'reactivate', reason?: string, duration?: string): Observable<boolean> {
    this.globalCustomers.update(customers => 
      customers.map(c => {
        if (c.id === customerId) {
          let status = c.accountStatus;
          let strikes = c.strikes || 0;

          if (action === 'warn') {
            status = 'warning';
            strikes++;
          } else if (action === 'restrict') {
            status = 'restricted';
          } else if (action === 'suspend') {
            status = 'suspended';
          } else if (action === 'ban') {
            status = 'banned';
          } else if (action === 'reactivate') {
            status = 'active';
            strikes = 0;
          }

          return { 
            ...c, 
            accountStatus: status as any,
            strikes,
            suspensionReason: action !== 'reactivate' ? reason : undefined,
            suspensionDuration: action === 'suspend' ? duration : undefined
          };
        }
        return c;
      })
    );
    return of(true).pipe(delay(300));
  }
  getVendorServices(vendorId?: string): Observable<VendorService[]> {
    const services: VendorService[] = [
      { id: 'vs1', vendorId: 'v1', vendorName: 'Spice Garden Catering', category: 'catering', name: 'Premium Veg Catering', description: 'Authentic South Indian & North Indian multi-cuisine veg catering', pricePerUnit: 450, unit: 'per plate', minGuests: 100, maxGuests: 1000, city: 'Hyderabad', images: [], rating: 4.8, totalReviews: 245, isActive: true, isVerified: true },
      { id: 'vs2', vendorId: 'v1', vendorName: 'Spice Garden Catering', category: 'catering', name: 'Non-Veg Catering Deluxe', description: 'Premium non-veg multi-cuisine catering with live counters', pricePerUnit: 650, unit: 'per plate', minGuests: 50, maxGuests: 800, city: 'Hyderabad', images: [], rating: 4.7, totalReviews: 198, isActive: true, isVerified: true },
      { id: 'vs3', vendorId: 'v2', vendorName: 'Blooms & Bliss Decor', category: 'decoration', name: 'Royal Floral Decoration', description: 'Luxury floral stage & hall decoration with fresh flowers', pricePerUnit: 75000, unit: 'per event', city: 'Hyderabad', images: [], rating: 4.9, totalReviews: 312, isActive: true, isVerified: true },
      { id: 'vs4', vendorId: 'v5', vendorName: 'Vedic Rituals', category: 'priest', name: 'Wedding Priest Service', description: 'Expert Vedic priest for all wedding rituals in Telugu, Sanskrit, Hindi', pricePerUnit: 8000, unit: 'per event', city: 'Hyderabad', images: [], rating: 4.7, totalReviews: 180, isActive: true, isVerified: true },
      { id: 'vs5', vendorId: 'v1', vendorName: 'Spice Garden Catering', category: 'catering', name: 'Gourmet Dessert Counter', description: 'Premium live dessert counters with international delicacies', pricePerUnit: 150, unit: 'per plate', minGuests: 100, maxGuests: 500, city: 'Hyderabad', images: [], rating: 0, totalReviews: 0, isActive: true, isVerified: false },
    ];
    const result = vendorId ? services.filter(s => s.vendorId === vendorId) : services;
    
    if (vendorId) {
      return this.http.get<any>(`${this.apiUrl}/services/getAll?VendorId=${vendorId}`, { headers: { 'X-Suppress-Errors': 'true' } }).pipe(
        map(res => res.Services || res.services || result),
        catchError(() => of(result).pipe(delay(300)))
      );
    }
    
    return of(result).pipe(delay(300));
  }

  // ─── SERVICE CATEGORIES ────────────────────────────────────────
  getServiceCategories(): Observable<ServiceCategoryDef[]> {
    return of<ServiceCategoryDef[]>([
      { id: 'venue',       name: 'Venue',        icon: 'bi-building',      description: 'Banquet halls, lawns, resorts & farmhouses' },
      { id: 'catering',    name: 'Catering',     icon: 'bi-egg-fried',     description: 'Veg, non-veg & live food counters' },
      { id: 'decoration',  name: 'Decoration',   icon: 'bi-flower1',       description: 'Floral, theme & stage decoration' },
      { id: 'transport',   name: 'Transport',    icon: 'bi-car-front',     description: 'Buses, cars & luxury fleets' },
      { id: 'priest',      name: 'Priest',       icon: 'bi-fire',          description: 'Vedic priests for all rituals' },
      { id: 'manpower',    name: 'Manpower',     icon: 'bi-people',        description: 'Event staff, waiters & security' },
      { id: 'photography', name: 'Photography',  icon: 'bi-camera',        description: 'Professional photos & videos' },
      { id: 'music',       name: 'Music & DJ',   icon: 'bi-music-note-beamed', description: 'DJs, live bands & sound systems' },
    ]).pipe(delay(200));
  }

  // ─── CALENDAR ──────────────────────────────────────────────────
  getVendorCalendar(vendorId: string, month: number, year: number): Observable<CalendarDay[]> {
    const days: CalendarDay[] = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    const bookedDays = [3, 7, 12, 18, 24, 28];
    const blockedDays = [1, 15];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      let status: CalendarDay['status'] = 'available';
      if (bookedDays.includes(d)) status = 'booked';
      else if (blockedDays.includes(d)) status = 'blocked';
      days.push({ date: dateStr, status });
    }
    return of(days).pipe(delay(300));
  }

  // ─── MESSAGES ──────────────────────────────────────────────────
  getChatThreads(userId: string): Observable<ChatThread[]> {
    const vendorFallback: ChatThread[] = [
      { id: 'vth1', bookingId: 'bk001', participants: [{ id: 'c1', name: 'Rajesh Kumar', role: 'customer' },{ id: 'v1', name: 'Amit Sharma', role: 'vendor' }], lastMessage: 'Thank you for the quote. Can we negotiate on the dessert counter?', lastMessageTime: new Date().toISOString(), unreadCount: 1, subject: 'Wedding Catering Inquiry' },
      { id: 'vth2', bookingId: 'bk004', participants: [{ id: 'c2', name: 'Sunita Patel', role: 'customer' },{ id: 'v1', name: 'Amit Sharma', role: 'vendor' }], lastMessage: 'Is the menu finalized for the corporate event?', lastMessageTime: new Date().toISOString(), unreadCount: 0, subject: 'Annual Day Conference' },
    ];
    const customerFallback: ChatThread[] = [
      { id: 'th1', bookingId: 'bk001', participants: [{ id: 'c1', name: 'Rajesh Kumar', role: 'customer' },{ id: 'a1', name: 'Priya Nair', role: 'admin' }], lastMessage: 'We have confirmed the decoration vendor for your wedding.', lastMessageTime: '2025-10-10T14:30:00', unreadCount: 2, subject: 'EE-2025-001 | Wedding Reception' },
      { id: 'th2', bookingId: 'bk003', participants: [{ id: 'c1', name: 'Rajesh Kumar', role: 'customer' },{ id: 'a1', name: 'Priya Nair', role: 'admin' }], lastMessage: 'Your advance payment has been received. Booking confirmed!', lastMessageTime: '2026-04-20T09:15:00', unreadCount: 0, subject: 'EE-2026-001 | Gruhapravesh Puja' },
    ];
    
    let fallbackData = userId.startsWith('v') ? vendorFallback : customerFallback;
    fallbackData = fallbackData.filter(t => t.participants.some(p => p.id === userId));

    return of(fallbackData).pipe(delay(300));
  }

  getChatMessages(threadId: string): Observable<ChatMessage[]> {
    const fallback: ChatMessage[] = [
      { id: 'm1', threadId: 'th1', senderId: 'c1', senderName: 'Rajesh Kumar', senderRole: 'customer', content: 'Hello, I wanted to confirm about the decoration vendor for my wedding.', timestamp: '2025-10-10T10:00:00', isRead: true, type: 'text' },
      { id: 'm2', threadId: 'th1', senderId: 'a1', senderName: 'Priya Nair', senderRole: 'admin', content: 'Hi Rajesh! Sure, let me check the availability for your date.', timestamp: '2025-10-10T10:05:00', isRead: true, type: 'text' },
      { id: 'm3', threadId: 'th1', senderId: 'a1', senderName: 'Priya Nair', senderRole: 'admin', content: 'Great news! Blooms & Bliss is available on Dec 15. I\'ve assigned them to your booking.', timestamp: '2025-10-10T10:15:00', isRead: true, type: 'text' },
      { id: 'm4', threadId: 'th1', senderId: 'c1', senderName: 'Rajesh Kumar', senderRole: 'customer', content: 'Wonderful! Thank you so much for the quick response 🙏', timestamp: '2025-10-10T10:20:00', isRead: true, type: 'text' },
      { id: 'm5', threadId: 'th1', senderId: 'a1', senderName: 'Priya Nair', senderRole: 'admin', content: 'We have confirmed the decoration vendor for your wedding.', timestamp: '2025-10-10T14:30:00', isRead: false, type: 'text' },
    ];
    return of(fallback).pipe(delay(300));
  }

  sendMessage(msg: Partial<ChatMessage>): Observable<ChatMessage> {
    return of({ ...msg, id: 'mock-' + Date.now(), timestamp: new Date().toISOString() } as ChatMessage).pipe(delay(500));
  }

  markAsRead(threadId: string): Observable<boolean> {
    return of(true).pipe(delay(300));
  }

  // ─── SUPPORT TICKETS ───────────────────────────────────────────
  globalTickets = signal<SupportTicket[]>([
    { id: 'st1', customerId: 'c1', customerName: 'Rajesh Kumar', subject: 'Decoration vendor not responding', status: 'open', priority: 'high', createdAt: '2025-10-09T08:00:00', messages: [] },
    { id: 'st2', customerId: 'c2', customerName: 'Sunita Patel', subject: 'Need to change event date', status: 'in_progress', priority: 'medium', createdAt: '2026-04-10T11:00:00', messages: [] },
    { id: 'st3', customerId: 'c3', customerName: 'Anand Reddy', subject: 'Catering quality issue after event', status: 'resolved', priority: 'urgent', createdAt: '2026-03-28T16:00:00', messages: [] },
  ]);

  getSupportTickets(): Observable<SupportTicket[]> {
    return of(this.globalTickets()).pipe(delay(300));
  }

  createSupportTicket(subject: string, priority: string): Observable<SupportTicket> {
    const newTicket: SupportTicket = {
      id: 'st' + Math.floor(Math.random() * 10000),
      customerId: 'c1',
      customerName: 'Rajesh Kumar',
      subject,
      status: 'open',
      priority: priority as any,
      createdAt: new Date().toISOString(),
      messages: []
    };
    this.globalTickets.update(tickets => [...tickets, newTicket]);
    return of(newTicket).pipe(delay(300));
  }

  // ─── ADMIN DASHBOARD ───────────────────────────────────────────
  getAdminKPIs(): Observable<any> {
    const fallbackData = {
      totalRevenue: 6420000,
      activeEvents: 18,
      pendingVerifications: 5,
      totalCustomers: 312,
      totalVendors: 64,
      completedEvents: 428,
      openTickets: 12,
      monthlyRevenue: [280000, 350000, 420000, 310000, 580000, 620000, 490000, 850000, 720000, 940000, 1150000, 1380000],
    };
    
    return this.http.get<any>(`${this.apiUrl}/admin/dashboard`, { headers: { 'X-Suppress-Errors': 'true' } }).pipe(
      catchError(() => of(fallbackData).pipe(delay(300)))
    );
  }

  // ─── VENDOR DASHBOARD ──────────────────────────────────────────
  getVendorDashboard(vendorId: string): Observable<any> {
    return of({
      totalEarnings: 850000,
      pendingRequests: 4,
      upcomingBookings: 3,
      completedJobs: 87,
      rating: 4.8,
      thisMonthEarnings: 125000,
      recentRequests: [
        { id: 'br1', bookingId: 'bk003', customerName: 'Rajesh Kumar', eventDate: '2026-05-10', eventName: 'Gruhapravesh Puja', amount: 47200, status: 'pending' },
        { id: 'br2', bookingId: 'bk001', customerName: 'Rajesh Kumar', eventDate: '2025-12-15', eventName: 'Wedding Reception', amount: 464100, status: 'confirmed' },
      ]
    }).pipe(delay(300));
  }
  // ─── NOTIFICATIONS ─────────────────────────────────────────────
  getNotifications(): Observable<any[]> {
    const fallbackData = [
      { id: 'n1', title: 'Booking Confirmed', message: 'Your booking for Wedding Reception has been confirmed.', time: '2 mins ago', icon: 'bi-check-circle', color: '#10B981', isRead: false },
      { id: 'n2', title: 'New Message', message: 'You have a new message from Priya Nair regarding your event.', time: '1 hour ago', icon: 'bi-chat-dots', color: '#3B82F6', isRead: false },
      { id: 'n3', title: 'Payment Received', message: 'Advance payment for Gruhapravesh Puja received successfully.', time: '5 hours ago', icon: 'bi-credit-card', color: '#F59E0B', isRead: true },
      { id: 'n4', title: 'Verification Update', message: 'Your vendor verification is now in progress.', time: '1 day ago', icon: 'bi-shield-check', color: '#8B5CF6', isRead: true },
      { id: 'n5', title: 'New Customer Review', message: 'Rajesh Kumar left a 5-star review for Daughter\'s Birthday.', time: 'Just now', icon: 'bi-star-fill', color: '#F59E0B', isRead: false },
    ];
    
    return this.http.get<any[]>(`${this.apiUrl}/notifications`, { headers: { 'X-Suppress-Errors': 'true' } }).pipe(
      catchError(() => of(fallbackData).pipe(delay(300)))
    );
  }
  
  // ─── REVIEWS & MODERATION ──────────────────────────────────────────
  
  globalReviews = signal<any[]>([
    { 
      id: 'rev1', 
      bookingId: 'bk002', 
      vendorId: 'v1', 
      customerName: 'Rajesh Kumar', 
      eventName: "Daughter's Birthday", 
      rating: 5, 
      comment: "Fantastic service! The decor was exactly as requested and the food was delicious. Highly recommend this vendor.", 
      date: '2025-11-22',
      status: 'published', // 'published', 'flagged', 'removed'
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

  flagReview(reviewId: string, reason: string): Observable<boolean> {
    this.globalReviews.update(reviews => 
      reviews.map(r => r.id === reviewId ? { ...r, status: 'flagged', disputeReason: reason } : r)
    );
    return of(true).pipe(delay(500));
  }

  resolveDispute(reviewId: string, action: 'keep' | 'remove'): Observable<boolean> {
    this.globalReviews.update(reviews => 
      reviews.map(r => {
        if (r.id === reviewId) {
          return { 
            ...r, 
            status: action === 'keep' ? 'published' : 'removed',
            resolution: action,
            resolvedOn: new Date().toISOString().split('T')[0]
          };
        }
        return r;
      })
    );
    return of(true).pipe(delay(500));
  }

  submitReview(bookingId: string, vendorId: string, customerName: string, eventName: string, rating: number, comment: string): Observable<any> {
    const newRev = {
      id: 'rev' + Math.floor(Math.random() * 10000),
      bookingId,
      vendorId,
      customerName,
      eventName,
      rating,
      comment,
      date: new Date().toISOString().split('T')[0],
      status: 'published',
      disputeReason: ''
    };
    this.globalReviews.update(reviews => {
      const existingIdx = reviews.findIndex(r => r.bookingId === bookingId);
      if (existingIdx > -1) {
        const updated = [...reviews];
        updated[existingIdx] = { ...updated[existingIdx], rating, comment, status: 'published', disputeReason: '', date: newRev.date };
        return updated;
      }
      return [...reviews, newRev];
    });
    return of(newRev).pipe(delay(500));
  }

  // ─── EMPLOYEE MANAGEMENT ──────────────────────────────────────
  globalEmployees = signal<Employee[]>([
    { id: 'e1', name: 'Priya Nair', email: 'admin@demo.com', phone: '+91 99887 76655', employeeId: 'ADM-0001', role: 'admin', department: 'Platform Operations', designation: 'Chief Administrator', shift: 'General (9 AM – 6 PM)', joinedDate: '2024-06-15', status: 'active', lastLogin: '2026-05-02 09:15 AM', ticketsResolved: 0, performanceScore: 98 },
    { id: 'e2', name: 'Rahul Support', email: 'support@demo.com', phone: '+91 99000 11223', employeeId: 'SUP-7729', role: 'support', department: 'Customer Satisfaction', designation: 'Support Officer', shift: 'General (9 AM – 6 PM)', joinedDate: '2025-03-10', status: 'active', lastLogin: '2026-05-02 08:47 AM', ticketsResolved: 347, performanceScore: 92 },
    { id: 'e3', name: 'Kavitha Reddy', email: 'kavitha@joinevents.com', phone: '+91 98112 33445', employeeId: 'SUP-7730', role: 'support', department: 'Customer Satisfaction', designation: 'Senior Support Agent', shift: 'Evening (2 PM – 10 PM)', joinedDate: '2025-01-20', status: 'active', lastLogin: '2026-05-01 09:58 PM', ticketsResolved: 512, performanceScore: 96 },
    { id: 'e4', name: 'Arun Mehta', email: 'arun@joinevents.com', phone: '+91 97001 22334', employeeId: 'MOD-4401', role: 'moderator', department: 'Content & Trust', designation: 'Content Moderator', shift: 'General (9 AM – 6 PM)', joinedDate: '2025-06-05', status: 'active', lastLogin: '2026-05-01 06:12 PM', ticketsResolved: 180, performanceScore: 88 },
    { id: 'e5', name: 'Deepa Sharma', email: 'deepa@joinevents.com', phone: '+91 96223 44556', employeeId: 'FIN-3301', role: 'finance', department: 'Finance & Settlements', designation: 'Finance Analyst', shift: 'General (9 AM – 6 PM)', joinedDate: '2025-02-14', status: 'active', lastLogin: '2026-05-02 10:02 AM', ticketsResolved: 0, performanceScore: 94 },
    { id: 'e6', name: 'Vikram Singh', email: 'vikram@joinevents.com', phone: '+91 95334 55667', employeeId: 'SUP-7731', role: 'support', department: 'Customer Satisfaction', designation: 'Night Shift Support', shift: 'Night (10 PM – 6 AM)', joinedDate: '2025-08-22', status: 'on_leave', lastLogin: '2026-04-28 05:55 AM', ticketsResolved: 203, performanceScore: 85 },
    { id: 'e7', name: 'Neha Gupta', email: 'neha@joinevents.com', phone: '+91 94445 66778', employeeId: 'MOD-4402', role: 'moderator', department: 'Content & Trust', designation: 'Review Moderator', shift: 'General (9 AM – 6 PM)', joinedDate: '2025-09-01', status: 'suspended', lastLogin: '2026-04-15 11:30 AM', ticketsResolved: 94, performanceScore: 62, suspensionReason: 'Policy violation — unauthorized data export' },
    { id: 'e8', name: 'Sanjay Patel', email: 'sanjay@joinevents.com', phone: '+91 93556 77889', employeeId: 'ADM-0002', role: 'admin', department: 'Platform Operations', designation: 'Operations Manager', shift: 'General (9 AM – 6 PM)', joinedDate: '2024-11-01', status: 'active', lastLogin: '2026-05-02 08:30 AM', ticketsResolved: 0, performanceScore: 95 },
  ]);

  getEmployees(): Observable<Employee[]> {
    return this.http.get<Employee[]>(`${this.apiUrl}/admin/employees`, { headers: { 'X-Suppress-Errors': 'true' } }).pipe(
      catchError(() => of(this.globalEmployees()).pipe(delay(300)))
    );
  }

  addEmployee(emp: Omit<Employee, 'id'>): Observable<Employee> {
    const newEmp: Employee = { ...emp, id: 'e' + Math.floor(Math.random() * 100000) } as Employee;
    this.globalEmployees.update(list => [...list, newEmp]);
    return of(newEmp).pipe(delay(400));
  }

  updateEmployee(id: string, updates: Partial<Employee>): Observable<boolean> {
    this.globalEmployees.update(list =>
      list.map(e => e.id === id ? { ...e, ...updates } : e)
    );
    return of(true).pipe(delay(300));
  }

  updateEmployeeStatus(id: string, status: EmployeeStatus, reason?: string): Observable<boolean> {
    this.globalEmployees.update(list =>
      list.map(e => {
        if (e.id === id) {
          return { ...e, status, suspensionReason: status === 'suspended' ? reason : undefined };
        }
        return e;
      })
    );
    return of(true).pipe(delay(300));
  }
}
