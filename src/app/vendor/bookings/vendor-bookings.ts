import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { TitleCasePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { of, Observable } from 'rxjs';
import { delay } from 'rxjs/operators';
import { BookingService } from '../../core/services/booking.service';
import { VendorDashboardService } from '../../core/services/vendor-dashboard.service';
import { BookingStatus } from '../../core/models/booking.model';
import { ToastService } from '../../core/services/toast.service';
import { FormsModule } from '@angular/forms';

interface VendorBookingReq { id: string; bookingId: string; customerName: string; eventDate: string; eventName: string; amount: number; status: BookingStatus; review?: any; }

@Component({ selector: 'app-vendor-bookings', standalone: true, imports: [TitleCasePipe, DecimalPipe, RouterLink, FormsModule], templateUrl: './vendor-bookings.html', styleUrl: './vendor-bookings.css' })
export class VendorBookings implements OnInit {
  private bookingService = inject(BookingService);
  private vendorDashboard = inject(VendorDashboardService);
  private toast = inject(ToastService);
  requestsData = signal<VendorBookingReq[]>([]);
  filter = signal('all');

  // TODO: Replace with real ReviewService when backend GET reviews endpoints exist
  reviewsList = signal<any[]>([
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

  requests = computed(() => {
    const globalRevs = this.reviewsList();
    return this.requestsData().map(req => {
      const rev = globalRevs.find(r => r.bookingId === req.bookingId && r.vendorId === 'v1');
      return { ...req, review: rev };
    });
  });

  ngOnInit() {
    this.vendorDashboard.getDashboardData().subscribe(d => {
      const allReqs: VendorBookingReq[] = [...d.recentRequests, 
        { id: 'br3', bookingId: 'bk005', customerName: 'Anand Reddy', eventDate: '2026-07-15', eventName: 'Upanayanam Ceremony', amount: 35000, status: 'in_progress' }, 
        { id: 'br4', bookingId: 'bk002', customerName: 'Rajesh Kumar', eventDate: '2025-11-20', eventName: "Daughter's Birthday", amount: 18000, status: 'completed' },
        { id: 'br6', bookingId: 'bk001', customerName: 'Rajesh Kumar', eventDate: '2025-12-15', eventName: "Wedding Reception", amount: 250000, status: 'confirmed' }
      ];
      this.requestsData.set(allReqs);
    });
  }

  get filtered() { const f = this.filter(); return f === 'all' ? this.requests() : this.requests().filter(r => r.status === f); }

  selectedBookingId = signal<string | null>(null);
  cancelPrompt = signal<string | null>(null);

  cancellationPreview = computed(() => {
    const id = this.cancelPrompt();
    if (!id) return null;
    const booking = this.requests().find(r => r.bookingId === id || r.id === id);
    if (!booking) return null;
    const amt = booking.amount || 0;
    const penalty = Math.min(Math.round(amt * 0.10), 15000);
    return {
      amount: amt,
      penalty: penalty,
      strike: true
    };
  });

  toggleBookingDetails(id: string) {
    this.selectedBookingId.update(curr => curr === id ? null : id);
  }

  acceptRequest(id: string) { 
    this.bookingService.updateBookingStatus(id, 'advance_paid').subscribe(() => {
      this.requestsData.update(rs => rs.map(r => r.id === id ? { ...r, status: 'advance_paid' as any } : r));
      this.toast.success('Request accepted! Waiting for customer advance payment.');
    });
  }
  declineRequest(id: string) { 
    this.bookingService.updateBookingStatus(id, 'rejected').subscribe(() => {
      this.requestsData.update(rs => rs.map(r => r.id === id ? { ...r, status: 'rejected' as any } : r));
      this.toast.info('Request declined.');
    });
  }

  cancelBooking(id: string, reason: string) {
    if (!reason.trim()) {
      this.toast.error('Please provide a reason for cancellation.');
      return;
    }
    this.bookingService.cancelBooking(id, reason, 'vendor').subscribe(() => {
      this.requestsData.update(rs => rs.map(r => r.id === id ? { ...r, status: 'cancelled' as any } : r));
      this.cancelPrompt.set(null);
      this.toast.warning('Booking cancelled.');
    });
  }

  startExecution(id: string) {
    this.bookingService.updateBookingStatus(id, 'in_progress').subscribe(() => {
      this.requestsData.update(rs => rs.map(r => r.id === id ? { ...r, status: 'in_progress' as any } : r));
      this.toast.success('Event execution started!');
    });
  }

  completeBooking(id: string) {
    this.bookingService.updateBookingStatus(id, 'completed').subscribe(() => {
      this.requestsData.update(rs => rs.map(r => r.id === id ? { ...r, status: 'completed' as any } : r));
      this.toast.success('Event marked as completed.');
    });
  }

  showDamageModal = signal<string | null>(null);
  damageForm = { amount: 0, notes: '' };

  submitDamage(id: string) {
    if (this.damageForm.amount <= 0) {
      this.toast.error('Please enter a valid damage amount.');
      return;
    }
    this.bookingService.addDamageCharges(id, this.damageForm.amount, this.damageForm.notes).subscribe(() => {
      this.showDamageModal.set(null);
      this.toast.success('Damage charges reported to customer for approval.');
    });
  }

  disputingReviewId = signal<string | null>(null);
  isSubmittingDispute = signal(false);

  flagReview(reviewId: string, reason: string): Observable<boolean> {
    this.reviewsList.update(reviews => 
      reviews.map(r => r.id === reviewId ? { ...r, status: 'flagged', disputeReason: reason } : r)
    );
    return of(true).pipe(delay(200));
  }

  submitDispute(reviewId: string, reason: string) {
    if (!reason.trim()) {
      alert('Please provide a reason for the dispute.');
      return;
    }
    this.isSubmittingDispute.set(true);
    // TODO: Replace with real ReviewService.flagReview() or BookingService.raiseDispute() when backend endpoints exist
    this.flagReview(reviewId, reason).subscribe(() => {
      this.isSubmittingDispute.set(false);
      this.disputingReviewId.set(null);
    });
  }

  statusColor(s: string): string { 
    const m: Record<string,string> = { 
      pending:'ee-badge-warning', 
      advance_paid:'ee-badge-info',
      confirmed:'ee-badge-primary', 
      in_progress:'ee-badge-primary', 
      rejected:'ee-badge-danger', 
      cancelled:'ee-badge-danger', 
      completed:'ee-badge-success',
      settled: 'ee-badge-success'
    }; 
    return m[s] || 'ee-badge-primary'; 
  }
  statusLabel(s: string): string { 
    const m: Record<string,string> = { 
      pending:'Pending Request', 
      advance_paid:'Waiting for Payment',
      confirmed:'Confirmed', 
      in_progress:'In Progress', 
      rejected:'Declined', 
      cancelled:'Cancelled', 
      completed:'Completed',
      settled: 'Fully Settled'
    }; 
    return m[s] || s; 
  }
}
