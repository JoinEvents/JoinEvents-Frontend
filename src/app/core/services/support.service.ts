import { Injectable } from '@angular/core';
import { BaseApiService } from './base-api.service';
import { API_ROUTES } from '../constants/api.constants';
import { Observable, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { validateFileUpload } from '../utils/input-sanitizer.util';
import { SupportTicket } from '../models/message.model';
import { Vendor } from '../models/vendor.model';
import { Booking } from '../models/booking.model';

@Injectable({ providedIn: 'root' })
export class SupportService extends BaseApiService {

  private mapToSupportTicket(raw: any): SupportTicket {
    if (!raw) return null as any;
    return {
      id: raw.id ?? raw.Id ?? '',
      customerId: raw.customerId ?? raw.CustomerId ?? raw.userId ?? raw.UserId ?? '',
      customerName: raw.customerName ?? raw.CustomerName ?? 'Customer',
      customerAvatar: raw.customerAvatar ?? raw.CustomerAvatar ?? undefined,
      subject: raw.subject ?? raw.Subject ?? '',
      status: (() => {
        const s = (raw.status ?? raw.Status ?? 'open').toLowerCase();
        return s === 'inprogress' ? 'in_progress' : s;
      })() as any,
      priority: (raw.priority ?? raw.Priority ?? 'medium').toLowerCase() as any,
      createdAt: raw.createdAt ?? raw.CreatedAt ?? new Date().toISOString(),
      eventName: raw.eventName ?? raw.EventName ?? undefined,
      attachmentUrl: raw.attachmentUrl ?? raw.AttachmentUrl ?? undefined,
      bookingId: raw.bookingId ?? raw.BookingId ?? undefined,
      bookingDetails: (raw.bookingDetails ?? raw.BookingDetails) ? {
        id: (raw.bookingDetails ?? raw.BookingDetails).id ?? (raw.bookingDetails ?? raw.BookingDetails).Id ?? '',
        eventName: (raw.bookingDetails ?? raw.BookingDetails).eventName ?? (raw.bookingDetails ?? raw.BookingDetails).EventName ?? '',
        eventDate: (() => {
          const d = (raw.bookingDetails ?? raw.BookingDetails).eventDate ?? (raw.bookingDetails ?? raw.BookingDetails).EventDate ?? '';
          if (!d) return '';
          const parts = d.split(' ')[0].split('-');
          if (parts.length === 3 && parts[0].length !== 4) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
          }
          return d;
        })(),
        status: (raw.bookingDetails ?? raw.BookingDetails).status ?? (raw.bookingDetails ?? raw.BookingDetails).Status ?? '',
        totalAmount: (raw.bookingDetails ?? raw.BookingDetails).totalAmount ?? (raw.bookingDetails ?? raw.BookingDetails).TotalAmount ?? 0,
        venue: (raw.bookingDetails ?? raw.BookingDetails).venue ?? (raw.bookingDetails ?? raw.BookingDetails).Venue ?? '',
        city: (raw.bookingDetails ?? raw.BookingDetails).city ?? (raw.bookingDetails ?? raw.BookingDetails).City ?? '',
        guestCount: (raw.bookingDetails ?? raw.BookingDetails).guestCount ?? (raw.bookingDetails ?? raw.BookingDetails).GuestCount ?? 0,
      } : undefined,
      vendorContact: (raw.vendorContact ?? raw.VendorContact) ? {
        businessName: (raw.vendorContact ?? raw.VendorContact).businessName ?? (raw.vendorContact ?? raw.VendorContact).BusinessName ?? '',
        contactName: (raw.vendorContact ?? raw.VendorContact).contactName ?? (raw.vendorContact ?? raw.VendorContact).ContactName ?? '',
        email: (raw.vendorContact ?? raw.VendorContact).email ?? (raw.vendorContact ?? raw.VendorContact).Email ?? '',
        phone: (raw.vendorContact ?? raw.VendorContact).phone ?? (raw.vendorContact ?? raw.VendorContact).Phone ?? ''
      } : undefined,
      messages: (raw.messages ?? raw.Messages ?? []).map((m: any) => ({
        id: m.id ?? m.Id ?? '',
        threadId: m.threadId ?? m.ThreadId ?? '',
        senderId: m.senderId ?? m.SenderId ?? '',
        senderName: m.senderName ?? m.SenderName ?? '',
        senderRole: (m.senderRole ?? m.SenderRole ?? 'customer').toLowerCase() as any,
        content: m.content ?? m.Content ?? '',
        timestamp: m.timestamp ?? m.Timestamp ?? '',
        isRead: m.isRead ?? m.IsRead ?? false,
        type: (m.type ?? m.Type ?? 'text').toLowerCase() as any,
        isInternal: m.isInternal ?? m.IsInternal ?? false
      }))
    };
  }

  private mapToVendor(raw: any): Vendor {
    if (!raw) return null as any;
    return {
      id: raw.id ?? raw.Id ?? '',
      name: raw.name ?? raw.Name ?? 'Vendor',
      businessName: raw.businessName ?? raw.BusinessName ?? 'Business Name',
      email: raw.email ?? raw.Email ?? '',
      phone: raw.phone ?? raw.Phone ?? '',
      avatar: raw.avatar ?? raw.Avatar ?? undefined,
      city: raw.city ?? raw.City ?? 'City',
      services: raw.services ?? raw.Services ?? [],
      verificationStatus: (raw.verificationStatus ?? raw.VerificationStatus ?? 'pending').toLowerCase() as any,
      verificationDocs: raw.verificationDocs ?? raw.VerificationDocs ?? [],
      rating: raw.rating ?? raw.Rating ?? 0,
      totalReviews: raw.totalReviews ?? raw.TotalReviews ?? 0,
      totalEarnings: raw.totalEarnings ?? raw.TotalEarnings ?? 0,
      joinedDate: raw.joinedDate ?? raw.JoinedDate ?? '',
      accountStatus: (raw.accountStatus ?? raw.AccountStatus ?? 'active').toLowerCase() as any,
      gstNumber: raw.gstNumber ?? raw.GstNumber,
      notes: raw.notes ?? raw.Notes
    };
  }

  // --- Dashboard Stats ---
  getDashboardStats(): Observable<any> {
    return this.get<any>(API_ROUTES.SUPPORT.DASHBOARD_STATS, undefined, false);
  }

  // --- Tickets ---
  getTickets(): Observable<SupportTicket[]> {
    return this.get<SupportTicket[]>(API_ROUTES.SUPPORT.TICKETS_BASE, undefined, false).pipe(
      map(list => (list || []).map(t => this.mapToSupportTicket(t)))
    );
  }

  getMyTickets(): Observable<SupportTicket[]> {
    return this.get<SupportTicket[]>('/support/my-tickets', undefined, false).pipe(
      map(list => (list || []).map(t => this.mapToSupportTicket(t)))
    );
  }

  createTicket(subject: string, description: string, eventName?: string, attachmentUrl?: string, bookingId?: string): Observable<SupportTicket> {
    return this.post<SupportTicket>(API_ROUTES.SUPPORT.CREATE_TICKET, { subject, description, eventName, attachmentUrl, bookingId }, false).pipe(
      map(t => this.mapToSupportTicket(t))
    );
  }

  uploadAttachment(file: File): Observable<{ url: string }> {
    const validation = validateFileUpload(file, ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain'], 10 * 1024 * 1024);
    if (!validation.valid) {
      return throwError(() => new Error(validation.error));
    }

    const formData = new FormData();
    formData.append('file', file);
    return this.post<{ url: string }>('/support/upload', formData, false);
  }

  getTicketById(id: string): Observable<SupportTicket> {
    return this.get<SupportTicket>(API_ROUTES.SUPPORT.TICKET_BY_ID(id), undefined, false).pipe(
      map(t => this.mapToSupportTicket(t))
    );
  }

  replyToTicket(id: string, message: string, isInternal: boolean = false): Observable<SupportTicket> {
    return this.post<SupportTicket>(API_ROUTES.SUPPORT.TICKET_REPLY(id), { message, isInternal }, false).pipe(
      map(t => this.mapToSupportTicket(t))
    );
  }

  updateTicketStatus(id: string, status?: string, priority?: string): Observable<SupportTicket> {
    return this.patch<SupportTicket>(API_ROUTES.SUPPORT.TICKET_STATUS(id), { status, priority }, false).pipe(
      map(t => this.mapToSupportTicket(t))
    );
  }

  // --- Verifications ---
  getPendingVendors(): Observable<Vendor[]> {
    return this.get<Vendor[]>(API_ROUTES.SUPPORT.PENDING_VENDORS, { t: Date.now().toString() }, false).pipe(
      map(list => {
        let items: any[] = [];
        if (list && Array.isArray(list)) items = list;
        else if (list && (list as any).vendors) items = (list as any).vendors;
        else if (list && (list as any).data) items = (list as any).data;
        return items.map(v => this.mapToVendor(v));
      })
    );
  }

  verifyVendor(id: string, status: string, remarks?: string): Observable<Vendor> {
    return this.post<Vendor>(API_ROUTES.SUPPORT.VERIFY_VENDOR(id), { status, remarks }, false);
  }

  getPendingPackages(): Observable<any[]> {
    return this.get<any[]>(API_ROUTES.SUPPORT.PENDING_PACKAGES, { t: Date.now().toString() }, false).pipe(
      map(list => {
        let items: any[] = [];
        if (list && Array.isArray(list)) items = list;
        else if (list && (list as any).packages) items = (list as any).packages;
        else if (list && (list as any).data) items = (list as any).data;
        return items.map(p => this.normalizePackage(p));
      })
    );
  }

  verifyPackage(id: string, status: string, comment?: string): Observable<any> {
    return this.post<any>(API_ROUTES.SUPPORT.VERIFY_PACKAGE(id), { status, comment }, false);
  }

  // --- Bookings ---
  getSupportBookings(): Observable<Booking[]> {
    return this.get<Booking[]>(API_ROUTES.SUPPORT.BOOKINGS, undefined, false);
  }

  addBookingNote(id: string, note: string): Observable<Booking> {
    return this.post<Booking>(API_ROUTES.SUPPORT.BOOKING_NOTE(id), { note }, false);
  }

  updateUser(id: string, message: string): Observable<Booking> {
    return this.post<Booking>(API_ROUTES.SUPPORT.BOOKING_USER_UPDATE(id), { message }, false);
  }

  remindVendor(bookingId: string, vendorId: string): Observable<any> {
    return this.post<any>(API_ROUTES.SUPPORT.BOOKING_VENDOR_REMINDER(bookingId), { vendorId }, false);
  }

  // --- Reviews ---
  getFlaggedReviews(): Observable<any[]> {
    return this.get<any[]>(API_ROUTES.SUPPORT.FLAGGED_REVIEWS, undefined, false);
  }

  moderateReview(id: string, action: 'keep' | 'remove'): Observable<any> {
    return this.post<any>(API_ROUTES.SUPPORT.MODERATE_REVIEW(id), { action }, false);
  }

  private normalizePackage(p: any): any {
    if (!p) return null;

    const pr = p.Pricing || p.pricing || {};
    const priceValue = p.price || p.Price || pr.BasePrice || pr.basePrice || pr.VegPrice || pr.vegPrice || 0;

    const cp = p.Capacity || p.capacity || {};
    const guests = p.MaxGuests || p.maxGuests || cp.MaxGuests || cp.maxGuests || 100;
    const rooms = p.RoomCount || p.roomCount || cp.TotalRooms || cp.totalRooms || 0;

    const isVegOnly = p.VegOnly !== undefined ? p.VegOnly : (p.vegOnly !== undefined ? p.vegOnly : (pr.VegPrice && !pr.NonVegPrice ? true : false));

    const inc = p.Includes || p.includes || p.Services || p.services || [];
    let finalInclusions: string[] = [];
    if (Array.isArray(inc) && inc.length > 0) {
      finalInclusions = inc;
    } else {
      finalInclusions = p.Name || p.name ? [p.Name || p.name] : ['Professional Service'];
    }

    const addr = p.Address || p.address || {};
    const cityLoc = p.City || p.city || addr.City || addr.city || p.Location || p.location || 'Multiple Locations';

    const imgs = p.Images || p.images || [];
    const primaryImg = p.Image || p.image || imgs[0] || 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=800';

    const am = p.Amenities || p.amenities || {};

    return {
      id: p.id || p.Id,
      eventTypeId: p.eventTypeId || p.EventTypeId || p.Category || p.category || 'wedding',
      name: p.Name || p.name,
      vendorName: p.VendorName || p.vendorName || 'JoinEvents Partner',
      location: cityLoc,
      tier: p.Tier || p.tier || p.Theme || p.theme || 'premium',
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
        decorPolicy: p.Policies?.DecorPolicy || p.policies?.decorPolicy || p.policies?.DecorPolicy || p.policies?.decorPolicy || 'Flexible',
        alcoholPolicy: p.Policies?.AlcoholPolicy || p.policies?.alcoholPolicy || p.policies?.AlcoholPolicy || p.policies?.alcoholPolicy || 'Flexible',
        djPolicy: p.Policies?.DjPolicy || p.policies?.djPolicy || p.policies?.DjPolicy || p.policies?.djPolicy || 'Flexible'
      },
      spaces: (p.Spaces || p.spaces || []).map((s: any) => ({
        name: s.Name || s.name || '',
        type: s.Type || s.type || 'Indoor',
        seatingCapacity: s.SeatingCapacity !== undefined ? s.SeatingCapacity : (s.seatingCapacity !== undefined ? s.seatingCapacity : 0),
        floatingCapacity: s.FloatingCapacity !== undefined ? s.FloatingCapacity : (s.floatingCapacity !== undefined ? s.floatingCapacity : 0)
      }))
    };
  }
}
