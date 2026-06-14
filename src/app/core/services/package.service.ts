import { Injectable } from '@angular/core';
import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';
import { EventPackage, EventType } from '../models/event.model';
import { Observable, of } from 'rxjs';
import { catchError, map, delay } from 'rxjs/operators';

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
export class PackageService extends BaseApiService {

  getEventTypes(): Observable<EventType[]> {
    const fallback: EventType[] = [
      { id: 'wedding', name: 'Wedding', nameHindi: 'Shaadi', description: 'Grand Indian weddings with all rituals', icon: 'bi-hearts', category: 'wedding', colorClass: 'event-wedding', gradient: 'linear-gradient(135deg,#E91E8C,#FF6B6B)', startingPrice: 150000, popularServices: ['Venue', 'Catering', 'Decoration'] },
      { id: 'birthday', name: 'Birthday Party', nameHindi: 'Janmadin', description: 'Fun & vibrant birthday celebrations', icon: 'bi-balloon-heart', category: 'birthday', colorClass: 'event-birthday', gradient: 'linear-gradient(135deg,#FF6B35,#F59E0B)', startingPrice: 25000, popularServices: ['Venue', 'Catering', 'Decoration'] },
      { id: 'corporate', name: 'Corporate Event', nameHindi: 'Karobar', description: 'Professional corporate meets', icon: 'bi-briefcase', category: 'corporate', colorClass: 'event-corporate', gradient: 'linear-gradient(135deg,#0EA5E9,#6B21A8)', startingPrice: 80000, popularServices: ['Venue', 'Catering', 'Transport'] },
      { id: 'beauty-styling', name: 'Beauty & Styling', nameHindi: 'Saundarya', description: 'Bridal makeup, styling, and mehendi', icon: 'bi-stars', category: 'beauty', colorClass: 'event-beauty', gradient: 'linear-gradient(135deg,#D946EF,#8B5CF6)', startingPrice: 15000, popularServices: ['Makeup Artist', 'Mehendi Artist', 'Styling'] },
      { id: 'travel-transport', name: 'Travel & Transport', nameHindi: 'Yatra', description: 'Luxury cars, buses, and travel logistics', icon: 'bi-car-front-fill', category: 'travel', colorClass: 'event-travel', gradient: 'linear-gradient(135deg,#10B981,#3B82F6)', startingPrice: 10000, popularServices: ['Vintage Car', 'Transportation', 'Logistics'] },
      { id: 'event-shopping', name: 'Event Shopping', nameHindi: 'Kharidari', description: 'Wedding attire, jewelry, and return gifts', icon: 'bi-bag-heart-fill', category: 'shopping', colorClass: 'event-shopping', gradient: 'linear-gradient(135deg,#F43F5E,#F97316)', startingPrice: 50000, popularServices: ['Bridal Wear', 'Jewelry', 'Return Gifts'] },
    ];
    return of(fallback).pipe(delay(300));
  }

  getPackages(categoryKey?: string, page: number = 1, pageSize: number = 20): Observable<any[]> {
    const params: any = { page, pageSize };
    // Pass category query parameter to query packages by Event Category in backend controller
    if (categoryKey) params.category = categoryKey;

    return this.get<any>(API_ROUTES.PACKAGES.SEARCH, params, false).pipe(
      map((res: any) => {
        let list: any[] = [];
        if (res && res.packages && Array.isArray(res.packages)) {
          list = res.packages;
        } else if (res && res.Packages && Array.isArray(res.Packages)) {
          list = res.Packages;
        } else if (res && Array.isArray(res.data)) {
          list = res.data;
        } else if (Array.isArray(res)) {
          list = res;
        }

        // Map each resulting raw object through the central normalization hub
        return list.map((p: any) => this.normalizePackage(p));
      }),
      catchError(() => of([] as any[]))
    );
  }

  getPackageById(id: string): Observable<any> {
    // Perform precise public API call to retrieve specific backend package details
    return this.get<any>(`/packages/${id}`, undefined, false).pipe(
      map(res => this.normalizePackage(res.data || res.package || res.Package || res)),
      catchError(() => {
        // Dynamic fallback: check authorized vendor path in case of unpublished preview scenarios
        return this.get<any>(`/vendor/packages/${id}`, undefined, false).pipe(
          map(res => this.normalizePackage(res.data || res.package || res.Package || res)),
          catchError(() => of(null))
        );
      })
    );
  }

  getPendingPackages(): Observable<any[]> {
    const cacheBuster = new Date().getTime();
    return this.get<any[]>(`/support/packages/pending?cb=${cacheBuster}`, undefined, false).pipe(
      map(list => Array.isArray(list) ? list.map(p => this.normalizePendingPackage(p)) : []),
      catchError(() => of([]))
    );
  }

  private normalizePendingPackage(p: any): any {
    if (!p) return null;

    const pr = p.pricing || p.Pricing || {};
    const cap = p.capacity || p.Capacity || {};
    const am = p.amenities || p.Amenities || {};
    const pol = p.policies || p.Policies || {};
    const sp = p.spaces || p.Spaces || [];

    let rawDesc = p.description || p.Description || '';
    let cleanedDesc = rawDesc;
    let inclusionDetails = {};
    if (rawDesc.includes('\n\n---INCLUSION_DETAILS---\n')) {
      const parts = rawDesc.split('\n\n---INCLUSION_DETAILS---\n');
      cleanedDesc = parts[0];
      try {
        inclusionDetails = JSON.parse(parts[1]) || {};
      } catch (e) {
        console.error('Failed to parse inclusion details in normalizePendingPackage', e);
      }
    }

    return {
      id: p.id || p.Id,
      vendorId: p.vendorId || p.VendorId,
      vendorName: p.vendorName || p.VendorName || 'JoinEvents Partner',
      vendorDescription: p.vendorDescription || p.VendorDescription || '',
      category: p.category || p.Category || 'wedding',
      name: p.name || p.Name || 'Unnamed Package',
      description: cleanedDesc,
      inclusionDetails: inclusionDetails,
      theme: p.theme || p.Theme || '',
      experience: p.experience !== undefined ? p.experience : (p.Experience !== undefined ? p.Experience : 0),
      rating: p.rating !== undefined ? p.rating : (p.Rating !== undefined ? p.Rating : 0),
      totalReviews: p.totalReviews !== undefined ? p.totalReviews : (p.TotalReviews !== undefined ? p.TotalReviews : 0),
      isVerified: p.isVerified !== undefined ? p.isVerified : (p.IsVerified !== undefined ? p.IsVerified : false),
      isActive: p.isActive !== undefined ? p.isActive : (p.IsActive !== undefined ? p.IsActive : false),
      createdAt: p.createdAt || p.CreatedAt,
      updatedAt: p.updatedAt || p.UpdatedAt,
      images: p.images || p.Images || [],
      includes: p.includes || p.Includes || [],
      pricing: {
        unit: pr.unit || pr.Unit || 'per event',
        basePrice: pr.basePrice !== undefined ? pr.basePrice : pr.BasePrice,
        rent: pr.rent !== undefined ? pr.rent : pr.Rent,
        vegPrice: pr.vegPrice !== undefined ? pr.vegPrice : pr.VegPrice,
        nonVegPrice: pr.nonVegPrice !== undefined ? pr.nonVegPrice : pr.NonVegPrice,
      },
      capacity: {
        maxGuests: cap.maxGuests !== undefined ? cap.maxGuests : cap.MaxGuests,
        parkingCapacity: cap.parkingCapacity !== undefined ? cap.parkingCapacity : cap.ParkingCapacity,
        totalRooms: cap.totalRooms !== undefined ? cap.totalRooms : cap.TotalRooms,
      },
      amenities: {
        hasAc: am.hasAc !== undefined ? am.hasAc : am.HasAc,
        hasPowerBackup: am.hasPowerBackup !== undefined ? am.hasPowerBackup : am.HasPowerBackup,
        hasChangingRooms: am.hasChangingRooms !== undefined ? am.hasChangingRooms : am.HasChangingRooms,
        hasParking: am.hasParking !== undefined ? am.hasParking : am.HasParking,
      },
      policies: {
        cateringPolicy: pol.cateringPolicy || pol.CateringPolicy || 'Flexible',
        decorPolicy: pol.decorPolicy || pol.DecorPolicy || 'Flexible',
        alcoholPolicy: pol.alcoholPolicy || pol.AlcoholPolicy || 'Flexible',
        djPolicy: pol.djPolicy || pol.DjPolicy || 'Flexible',
      },
      spaces: sp.map((s: any) => ({
        name: s.name || s.Name || '',
        type: s.type || s.Type || '',
        seatingCapacity: s.seatingCapacity !== undefined ? s.seatingCapacity : s.SeatingCapacity,
        floatingCapacity: s.floatingCapacity !== undefined ? s.floatingCapacity : s.FloatingCapacity,
      }))
    };
  }

  verifyPackage(packageId: string, status: string, comment: string): Observable<any> {
    return this.post<any>(`/support/packages/${packageId}/verify`, { status, comment }, false);
  }

  /**
   * Centralized Normalization Engine:
   * Consolidates and flattens backend database models (handles casing & nesting variations)
   */
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

    let rawDesc = p.Description || p.description || '';
    let cleanedDesc = rawDesc;
    let inclusionDetails = {};
    if (rawDesc.includes('\n\n---INCLUSION_DETAILS---\n')) {
      const parts = rawDesc.split('\n\n---INCLUSION_DETAILS---\n');
      cleanedDesc = parts[0];
      try {
        inclusionDetails = JSON.parse(parts[1]) || {};
      } catch (e) {
        console.error('Failed to parse inclusion details in normalizePackage', e);
      }
    }

    const sp = p.Spaces || p.spaces || [];
    const spacesList = sp.map((s: any) => ({
      name: s.name || s.Name || '',
      type: s.type || s.Type || '',
      seatingCapacity: s.seatingCapacity !== undefined ? s.seatingCapacity : s.SeatingCapacity,
      floatingCapacity: s.floatingCapacity !== undefined ? s.floatingCapacity : s.FloatingCapacity,
    }));

    return {
      id: p.id || p.Id,
      eventTypeId: p.EventTypeId || p.eventTypeId || p.Category || p.category || 'wedding',
      category: p.Category || p.category || p.EventTypeId || p.eventTypeId || 'wedding',
      vendorId: p.vendorId || p.VendorId,
      name: p.Name || p.name,
      vendorName: p.VendorName || p.vendorName || 'JoinEvents Partner',
      vendorDescription: p.VendorDescription || p.vendorDescription || '',
      location: cityLoc,
      tier: p.Tier || p.tier || p.Theme || p.theme || 'premium',
      price: priceValue,
      description: cleanedDesc,
      inclusionDetails: inclusionDetails,
      maxGuests: guests,
      roomCount: rooms,
      vegOnly: isVegOnly,
      services: Array.isArray(finalInclusions) ? finalInclusions : [],
      spaces: spacesList,
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
      totalReviews: p.TotalReviews !== undefined ? p.TotalReviews : (p.totalReviews !== undefined ? p.totalReviews : 0)
    };
  }
}
