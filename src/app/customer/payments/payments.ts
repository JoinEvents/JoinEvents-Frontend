import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BookingService } from '../../core/services/booking.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { Booking } from '../../core/models/booking.model';

@Component({
  selector: 'app-customer-payments',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payments.html',
  styleUrl: './payments.css'
})
export class CustomerPayments implements OnInit {
  private bookingService = inject(BookingService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  bookings = signal<Booking[]>([]);
  selected = signal<Booking | null>(null);

  ngOnInit() {
    this.loadBookings();
  }

  loadBookings() {
    const user = this.auth.currentUser();
    if (!user) {
      this.toast.error('Authentication session expired. Please log in.');
      return;
    }
    this.bookingService.getBookings(user.id).subscribe({
      next: (b) => {
        this.bookings.set(b);
        const currentSelected = this.selected();
        if (currentSelected) {
          const updated = b.find(x => x.id === currentSelected.id);
          this.selected.set(updated || (b.length ? b[0] : null));
        } else if (b.length) {
          this.selected.set(b[0]);
        }
      },
      error: (err) => {
        console.error('Failed to load bookings', err);
        this.toast.error('Failed to load bookings from database.');
      }
    });
  }

  select(b: Booking) {
    this.selected.set(b);
  }

  /** The GST share of the total, as the server priced it. */
  gst(b: Booking) {
    return Math.max(0, Math.round((b.totalAmount - b.damageCharges - b.baseAmount) * 100) / 100);
  }

  /** What has been paid so far, from confirmed payments. */
  paid(b: Booking) {
    return b.amountPaid ?? (b.status === 'pending' ? 0 : b.advanceAmount);
  }

  balance(b: Booking) {
    return b.balanceDue ?? Math.max(0, b.totalAmount - this.paid(b));
  }

  canPay(b: Booking) {
    return this.balance(b) > 0 && !['cancelled', 'rejected', 'disputed'].includes(b.status);
  }

  /** Checkout loads the booking from the server and charges whatever is still due. */
  payBalance(b: Booking) {
    this.router.navigate(['/checkout', b.id], { state: { bookingId: b.id } });
  }

  readonly statusColors: Record<string, string> = { pending:'ee-badge-warning', advance_paid:'ee-badge-info', confirmed:'ee-badge-secondary', in_progress:'ee-badge-primary', completed:'ee-badge-success', settled:'ee-badge-success', cancelled:'ee-badge-danger' };
  readonly statusLabels: Record<string, string> = { pending:'Pending', advance_paid:'Advance Paid', confirmed:'Confirmed', in_progress:'In Progress', completed:'Completed', settled:'Settled', cancelled:'Cancelled' };
}
