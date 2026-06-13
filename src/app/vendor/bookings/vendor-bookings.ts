import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { TitleCasePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BookingService } from '../../core/services/booking.service';
import { ReviewService } from '../../core/services/review.service';
import { BookingStatus } from '../../core/models/booking.model';
import { ToastService } from '../../core/services/toast.service';
import { FormsModule } from '@angular/forms';

interface VendorBookingReq { id: string; bookingId: string; customerName: string; eventDate: string; eventName: string; amount: number; status: BookingStatus; review?: any; services?: any[]; }

@Component({ selector: 'app-vendor-bookings', standalone: true, imports: [TitleCasePipe, DecimalPipe, RouterLink, FormsModule], templateUrl: './vendor-bookings.html', styleUrl: './vendor-bookings.css' })
export class VendorBookings implements OnInit {
  private bookingService = inject(BookingService);
  private reviewService = inject(ReviewService);
  private toast = inject(ToastService);
  requestsData = signal<VendorBookingReq[]>([]);
  filter = signal('all');

  requests = computed(() => {
    return this.requestsData();
  });

  ngOnInit() {
    this.bookingService.getVendorBookings().subscribe({
      next: (bookings) => {
        const mapped: VendorBookingReq[] = (bookings || []).map(b => ({
          id: b.id,
          bookingId: b.bookingNumber || `BK-${b.id.substring(0, 8).toUpperCase()}`,
          customerName: b.customerName || 'Customer',
          eventDate: b.eventDate,
          eventName: b.eventName,
          amount: b.totalAmount,
          status: b.status,
          review: b.review,
          services: b.services
        }));
        this.requestsData.set(mapped);
      },
      error: () => {
        this.toast.error('Failed to load booking requests.');
      }
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

  submitDispute(reviewId: string, reason: string) {
    if (!reason.trim()) {
      alert('Please provide a reason for the dispute.');
      return;
    }
    this.isSubmittingDispute.set(true);
    this.reviewService.flagReview(reviewId, reason).subscribe({
      next: () => {
        this.requestsData.update(rs =>
          rs.map(r => {
            if (r.review && r.review.id === reviewId) {
              return {
                ...r,
                review: {
                  ...r.review,
                  status: 'flagged',
                  disputeReason: reason
                }
              };
            }
            return r;
          })
        );
        this.isSubmittingDispute.set(false);
        this.disputingReviewId.set(null);
        this.toast.success('Review flagged for admin review.');
      },
      error: () => {
        this.isSubmittingDispute.set(false);
        this.toast.error('Failed to submit review dispute.');
      }
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

  changeServiceStatus(bookingId: string, serviceId: string, status: string) {
    this.bookingService.updateBookingServiceStatus(bookingId, serviceId, status).subscribe({
      next: () => {
        this.requestsData.update(rs => 
          rs.map(r => {
            if (r.id === bookingId && r.services) {
              const updatedServices = r.services.map((s: any) => 
                s.serviceId === serviceId ? { ...s, status } : s
              );
              return { ...r, services: updatedServices };
            }
            return r;
          })
        );
        this.toast.success(`Service status updated to ${status}.`);
      },
      error: () => {
        this.toast.error('Failed to update service status.');
      }
    });
  }
}
