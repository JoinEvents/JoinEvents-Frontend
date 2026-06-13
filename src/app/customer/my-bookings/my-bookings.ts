import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReviewService } from '../../core/services/review.service';
import { BookingService } from '../../core/services/booking.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { Booking } from '../../core/models/booking.model';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LoyaltyService } from '../../core/services/loyalty.service';

@Component({
  selector: 'app-my-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './my-bookings.html',
  styleUrl: './my-bookings.css'
})
export class MyBookings implements OnInit {
  private reviewService = inject(ReviewService);
  private bookingService = inject(BookingService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private loyaltyService = inject(LoyaltyService);
  bookings = this.bookingService.globalBookings;
  selectedBooking = signal<Booking | null>(null);
  activeFilter = signal<string>('all');

  setFilter(filter: string) {
    this.activeFilter.set(filter);
    const list = this.filteredBookings();
    this.selectedBooking.set(list.length ? list[0] : null);
  }

  setSort(sort: string) {
    this.sortBy.set(sort);
    const list = this.filteredBookings();
    this.selectedBooking.set(list.length ? list[0] : null);
  }

  cancellationPreview = computed(() => {
    const b = this.selectedBooking();
    if (!b) return null;
    return this.bookingService.calculateCancellation(b, 'customer');
  });

  // UI States
  showCancelPrompt = signal(false);
  showDisputePrompt = signal(false);
  cancelReason = signal('');
  disputeReason = signal('');
  
  // Review State
  showReviewForm = signal(false);
  submittingReview = signal(false);
  reviewForm = { rating: 5, comment: '' };
  submittedReviews = computed(() => {
    const revs: Record<string, {rating: number, comment: string, status: string}> = {};
    this.bookings().forEach(b => {
      if (b.review) {
        revs[b.id] = { rating: b.review.rating, comment: b.review.comment, status: 'published' };
      }
    });
    return revs;
  });

  readonly statusSteps = ['pending','advance_paid','confirmed','in_progress','completed','settled'];
  readonly filterTabs = [
    { key: 'pending', label: 'Pending' },
    { key: 'confirmed', label: 'Active' },
    { key: 'settled', label: 'Settled' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  readonly statusLabels: Record<string, string> = {
    pending: 'Pending', advance_paid: 'Advance Paid', confirmed: 'Confirmed',
    in_progress: 'In Progress', completed: 'Completed', settled: 'Fully Settled', cancelled: 'Cancelled'
  };

  readonly statusColors: Record<string, string> = {
    pending: 'pill-warning', advance_paid: 'pill-info', confirmed: 'pill-purple',
    in_progress: 'pill-primary', completed: 'pill-success', settled: 'pill-success', cancelled: 'pill-danger'
  };

  sortBy = signal<string>('date-desc');

  filteredBookings = computed(() => {
    const filter = this.activeFilter();
    const all = this.bookings();
    const sort = this.sortBy();
    
    // 1. Filter
    let result = [...all];
    if (filter === 'confirmed') {
      result = all.filter(b => ['confirmed','in_progress','completed','advance_paid'].includes(b.status));
    } else if (filter !== 'all') {
      result = all.filter(b => b.status === filter);
    }
    
    // 2. Sort
    result.sort((x, y) => {
      const tx = x.createdAt ? new Date(x.createdAt).getTime() : 0;
      const ty = y.createdAt ? new Date(y.createdAt).getTime() : 0;
      
      if (sort === 'date-desc') return ty - tx;
      if (sort === 'date-asc') return tx - ty;
      if (sort === 'price-desc') return y.totalAmount - x.totalAmount;
      if (sort === 'price-asc') return x.totalAmount - y.totalAmount;
      return 0;
    });
    
    return result;
  });

  ngOnInit() {
    const userId = this.auth.currentUser()?.id || 'c1';
    this.bookingService.getBookings(userId).subscribe(b => {
      this.bookings.set(b);
      const bookingId = this.route.snapshot.queryParams['bookingId'];
      if (bookingId) {
        const found = b.find(item => item.id === bookingId);
        if (found) {
          this.selectedBooking.set(found);
          return;
        }
      }
      if (b.length) this.selectedBooking.set(b[0]);
    });
  }

  selectBooking(b: Booking | null) { 
    this.selectedBooking.set(b); 
    this.showReviewForm.set(false); // Reset review form state when switching bookings
    this.reviewForm = { rating: 5, comment: '' }; // Reset form
  }
  getStepIndex(status: string) { return this.statusSteps.indexOf(status); }
  getCurrentStepIndex() { const s = this.selectedBooking(); return s ? this.getStepIndex(s.status) : 0; }

  getCountByStatus(key: string): number {
    const all = this.bookings();
    if (key === 'confirmed') return all.filter(b => ['confirmed','in_progress','completed','advance_paid'].includes(b.status)).length;
    return all.filter(b => b.status === key).length;
  }

  downloadInvoice(booking: Booking, type: 'advance' | 'proforma' | 'final') {
    const doc = this.generateInvoiceHTML(booking, type);
    const blob = new Blob([doc], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(doc);
      win.document.close();
      setTimeout(() => { win.print(); }, 600);
    }
  }

  // --- Review Methods ---
  setRating(val: number) {
    this.reviewForm.rating = val;
  }

  submitReview() {
    const b = this.selectedBooking();
    if (!b) return;

    if (!this.reviewForm.comment.trim()) {
      this.toast.error('Please write a brief review before submitting.');
      return;
    }

    this.submittingReview.set(true);

    const vendorId = b.services?.length ? b.services[0].vendorId : 'v1';
    const userId = this.auth.currentUser()?.id || 'c1';

    const reviewPayload = {
      bookingId: b.id,
      vendorId: vendorId,
      customerName: b.customerName || 'Customer',
      eventName: b.eventName || 'Event',
      rating: this.reviewForm.rating,
      comment: this.reviewForm.comment.trim()
    };

    this.reviewService.submitReview(reviewPayload)
      .subscribe(() => {
        // Optimistically update frontend booking state
        this.bookings.update(bs => bs.map(item => item.id === b.id ? { ...item, review: { rating: this.reviewForm.rating, comment: this.reviewForm.comment.trim() } } : item));
        this.selectedBooking.update(item => item ? { ...item, review: { rating: this.reviewForm.rating, comment: this.reviewForm.comment.trim() } } : null);

        // Claim review bonus points
        this.loyaltyService.claimReviewBonus(userId, b.id).subscribe({
          next: () => {
            this.submittingReview.set(false);
            this.showReviewForm.set(false);
            this.toast.success('Thank you! Your review has been submitted and 50 points have been credited to your rewards!');
          },
          error: (err) => {
            console.error('Failed to claim review points', err);
            this.submittingReview.set(false);
            this.showReviewForm.set(false);
            this.toast.success('Thank you! Your review has been submitted successfully.');
          }
        });
      });
  }

  // --- Cancellation & Dispute Actions ---
  cancelBooking() {
    const b = this.selectedBooking();
    if (!b) return;
    if (!this.cancelReason().trim()) {
      this.toast.error('Please provide a reason for cancellation.');
      return;
    }
    this.bookingService.cancelBooking(b.id, this.cancelReason(), 'customer').subscribe(() => {
      const updated = this.bookings().find(item => item.id === b.id);
      if (updated) this.selectedBooking.set(updated);
      this.showCancelPrompt.set(false);
      this.toast.warning('Booking has been cancelled.');
    });
  }

  approveDamageCharges() {
    const b = this.selectedBooking();
    if (!b) return;
    this.bookingService.updateBookingStatus(b.id, 'confirmed').subscribe(() => {
      const updated = this.bookings().find(item => item.id === b.id);
      if (updated) this.selectedBooking.set(updated);
      this.toast.success('Damage charges approved and added to your final bill.');
    });
  }

  submitDispute() {
    const b = this.selectedBooking();
    if (!b) return;
    if (!this.disputeReason().trim()) {
      this.toast.error('Please describe your dispute.');
      return;
    }
    this.bookingService.raiseDispute(b.id, this.disputeReason()).subscribe(() => {
      const updated = this.bookings().find(item => item.id === b.id);
      if (updated) this.selectedBooking.set(updated);
      this.showDisputePrompt.set(false);
      this.toast.info('Dispute raised. Our support team will review this shortly.');
    });
  }

  private generateInvoiceHTML(b: Booking, type: 'advance' | 'proforma' | 'final'): string {
    const title = type === 'advance' ? 'Advance Payment Receipt' : type === 'proforma' ? 'Proforma Invoice' : 'Final Invoice & Settlement';
    const invoiceNo = type === 'advance' ? `ADV-${b.bookingNumber}` : type === 'proforma' ? `PRO-${b.bookingNumber}` : `INV-${b.bookingNumber}`;
    const gstAmt = Math.round((b.baseAmount + b.extraServicesAmount) * (b.gstPercent / 100));
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    let amountSection = '';
    if (type === 'advance') {
      amountSection = `
        <tr><td>Advance Amount Paid</td><td style="text-align:right;font-weight:700">₹${b.advanceAmount.toLocaleString('en-IN')}</td></tr>
        <tr class="total"><td>Balance Remaining</td><td style="text-align:right">₹${(b.totalAmount - b.advanceAmount).toLocaleString('en-IN')}</td></tr>`;
    } else {
      amountSection = `
        <tr><td>Base Amount</td><td style="text-align:right">₹${b.baseAmount.toLocaleString('en-IN')}</td></tr>
        <tr><td>Extra Services</td><td style="text-align:right">₹${b.extraServicesAmount.toLocaleString('en-IN')}</td></tr>
        ${b.damageCharges ? `<tr><td>Damage Charges</td><td style="text-align:right;color:#DC2626">₹${b.damageCharges.toLocaleString('en-IN')}</td></tr>` : ''}
        <tr><td>GST (${b.gstPercent}%)</td><td style="text-align:right">₹${gstAmt.toLocaleString('en-IN')}</td></tr>
        <tr class="total"><td>Total Amount</td><td style="text-align:right">₹${b.totalAmount.toLocaleString('en-IN')}</td></tr>
        ${b.advanceAmount > 0 ? `<tr style="color:#16A34A"><td>Advance Paid</td><td style="text-align:right">- ₹${b.advanceAmount.toLocaleString('en-IN')}</td></tr>` : ''}
        ${type === 'final' && b.finalPaidAmount ? `<tr style="color:#16A34A"><td>Final Settlement Paid</td><td style="text-align:right">- ₹${(b.finalPaidAmount - b.advanceAmount).toLocaleString('en-IN')}</td></tr>
        <tr class="total" style="color:#16A34A"><td>Balance Due</td><td style="text-align:right">₹0 — Fully Settled ✓</td></tr>` : 
        `<tr class="total"><td>Balance Due</td><td style="text-align:right;color:#FF6B35">₹${(b.totalAmount - b.advanceAmount).toLocaleString('en-IN')}</td></tr>`}`;
    }

    return `<!DOCTYPE html>
<html><head><title>${title} — ${b.bookingNumber}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',system-ui,sans-serif; color:#1E293B; padding:40px; max-width:800px; margin:0 auto; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:40px; padding-bottom:24px; border-bottom:3px solid #FF6B35; }
  .logo { font-size:1.5rem; font-weight:800; }
  .logo .join { color:#FF6B35; } .logo .events { color:#6B21A8; }
  .inv-type { font-size:1.1rem; font-weight:700; color:#FF6B35; margin-top:8px; }
  .inv-meta { text-align:right; font-size:0.85rem; color:#475569; line-height:1.8; }
  .inv-meta strong { color:#0F172A; }
  .section { margin-bottom:30px; }
  .section-title { font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#94A3B8; margin-bottom:12px; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .info-box label { display:block; font-size:0.72rem; font-weight:600; color:#94A3B8; text-transform:uppercase; }
  .info-box span { font-size:0.95rem; font-weight:600; color:#0F172A; }
  table { width:100%; border-collapse:collapse; margin-top:8px; }
  td { padding:12px 0; border-bottom:1px solid #E2E8F0; font-size:0.9rem; }
  .total td { border-top:2px solid #0F172A; border-bottom:none; font-weight:800; font-size:1rem; padding-top:16px; }
  .footer { margin-top:50px; padding-top:20px; border-top:1px solid #E2E8F0; text-align:center; font-size:0.75rem; color:#94A3B8; }
  .stamp { display:inline-block; border:2px solid #16A34A; color:#16A34A; font-weight:800; padding:8px 24px; border-radius:8px; font-size:0.85rem; margin-top:20px; transform:rotate(-5deg); }
  @media print { body { padding:20px; } }
</style></head>
<body>
  <div class="header">
    <div>
      <div class="logo"><span class="join">Join</span><span class="events">Events</span></div>
      <div class="inv-type">${title}</div>
    </div>
    <div class="inv-meta">
      <div>Invoice: <strong>${invoiceNo}</strong></div>
      <div>Date: <strong>${today}</strong></div>
      <div>Status: <strong>${type === 'final' ? 'SETTLED' : type === 'advance' ? 'ADVANCE PAID' : 'PENDING'}</strong></div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Booking Details</div>
    <div class="info-grid">
      <div class="info-box"><label>Customer</label><span>${b.customerName}</span></div>
      <div class="info-box"><label>Phone</label><span>${b.customerPhone}</span></div>
      <div class="info-box"><label>Event</label><span>${b.eventName}</span></div>
      <div class="info-box"><label>Date</label><span>${b.eventDate}</span></div>
      <div class="info-box"><label>Venue</label><span>${b.venue}, ${b.city}</span></div>
      <div class="info-box"><label>Guests</label><span>${b.guestCount}</span></div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Payment Breakdown</div>
    <table>${amountSection}</table>
  </div>
  ${type === 'final' ? '<div style="text-align:center"><div class="stamp">✓ FULLY SETTLED</div></div>' : ''}
  <div class="footer">
    <p>This is a computer-generated document from JoinEvents. No signature required.</p>
    <p style="margin-top:4px">For queries, contact support&#64;joinevents.in | +91 1800-123-4567</p>
  </div>
</body></html>`;
  }
}
