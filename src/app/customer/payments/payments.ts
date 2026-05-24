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

  gst(b: Booking) {
    return Math.round((b.baseAmount + b.extraServicesAmount) * 0.18);
  }

  balance(b: Booking) {
    return b.totalAmount - b.advanceAmount;
  }

  payBalance(b: Booking) {
    // Navigate to checkout space
    this.router.navigate(['/checkout', b.packageId || 'custom'], {
      state: {
        bookingDetails: {
          id: b.id,
          packageId: b.packageId,
          packageName: b.packageName,
          vendorId: b.services?.[0]?.vendorId || '',
          basePrice: b.baseAmount,
          addonsTotal: b.extraServicesAmount,
          gstAmount: this.gst(b),
          totalAmount: b.totalAmount,
          advanceAmount: b.advanceAmount,
          payableAmount: this.balance(b),
          isBalancePayment: true
        }
      }
    });
  }

  readonly statusColors: Record<string, string> = { pending:'ee-badge-warning', advance_paid:'ee-badge-info', confirmed:'ee-badge-secondary', in_progress:'ee-badge-primary', completed:'ee-badge-success', settled:'ee-badge-success', cancelled:'ee-badge-danger' };
  readonly statusLabels: Record<string, string> = { pending:'Pending', advance_paid:'Advance Paid', confirmed:'Confirmed', in_progress:'In Progress', completed:'Completed', settled:'Settled', cancelled:'Cancelled' };
}
