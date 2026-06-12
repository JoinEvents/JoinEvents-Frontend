import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { TitleCasePipe, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BookingService } from '../../core/services/booking.service';
import { ToastService } from '../../core/services/toast.service';
import { Booking, BookingStatus } from '../../core/models/booking.model';

@Component({
  selector: 'app-admin-bookings',
  standalone: true,
  imports: [CommonModule, TitleCasePipe, FormsModule],
  templateUrl: './admin-bookings.html',
  styleUrl: './admin-bookings.css'
})
export class AdminBookings implements OnInit {
  private bookingService = inject(BookingService);
  private toast = inject(ToastService);

  bookings = this.bookingService.globalBookings;
  filter = signal('all'); // Booking status filter
  searchQuery = signal('');
  assigneeFilter = signal('all');
  selectedBooking = signal<Booking | null>(null);
  newSupportNote = signal('');
  damageAmount = signal<number | null>(null);
  damageNotes = signal('');
  showDamageForm = signal(false);
  loading = signal(true);
  overrideRefundAmount = signal<number | null>(null);
  overrideCancellationFee = signal<number | null>(null);

  readonly statuses = ['all', 'pending', 'advance_paid', 'confirmed', 'in_progress', 'completed', 'settled', 'cancelled', 'disputed'];
  readonly statusColors: Record<string, string> = {
    pending: 'ee-badge-warning',
    advance_paid: 'ee-badge-info',
    confirmed: 'ee-badge-secondary',
    in_progress: 'ee-badge-primary',
    completed: 'ee-badge-success',
    settled: 'ee-badge-success',
    cancelled: 'ee-badge-danger',
    disputed: 'ee-badge-danger'
  };
  readonly statusLabels: Record<string, string> = {
    pending: 'Pending',
    advance_paid: 'Advance Paid',
    confirmed: 'Confirmed',
    in_progress: 'In Progress',
    completed: 'Completed',
    settled: 'Settled',
    cancelled: 'Cancelled',
    disputed: 'Disputed'
  };

  readonly supportAgents = ['Priya Nair', 'Rahul Support', 'Kavitha Reddy', 'Vikram Singh', 'Deepa Sharma'];

  ngOnInit() {
    this.loadBookings();
  }

  loadBookings() {
    this.loading.set(true);
    this.bookingService.getAdminBookings().subscribe({
      next: (bookings) => {
        // Signal is updated by the service via tap(); data reflects automatically
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Failed to load bookings from API');
      }
    });
  }

  // --- Computeds for filtering ---
  filtered = computed(() => {
    let list = this.bookings();
    const sf = this.filter();
    const sq = this.searchQuery().trim().toLowerCase();
    const af = this.assigneeFilter();

    if (sf !== 'all') {
      list = list.filter(b => b.status === sf);
    }

    if (af !== 'all') {
      if (af === 'unassigned') {
        list = list.filter(b => !b.assignedTo);
      } else {
        list = list.filter(b => b.assignedTo === af);
      }
    }

    if (sq) {
      list = list.filter(b => 
        b.bookingNumber.toLowerCase().includes(sq) ||
        b.customerName.toLowerCase().includes(sq) ||
        b.customerPhone.toLowerCase().includes(sq) ||
        b.eventName.toLowerCase().includes(sq) ||
        (b.city && b.city.toLowerCase().includes(sq))
      );
    }

    return list;
  });

  // --- Stats Computeds ---
  totalBookingsCount = computed(() => this.bookings().length);
  
  actionRequiredCount = computed(() => 
    this.bookings().filter(b => b.status === 'pending' || b.status === 'disputed' || b.status === 'cancelled').length
  );
  
  activeOperationsCount = computed(() => 
    this.bookings().filter(b => b.status === 'confirmed' || b.status === 'in_progress').length
  );
  
  totalPlatformRevenue = computed(() => 
    this.bookings().reduce((sum, b) => sum + b.totalAmount, 0)
  );

  // --- Dynamic counts for filter chips ---
  getStatusCount(status: string) {
    if (status === 'all') return this.bookings().length;
    return this.bookings().filter(b => b.status === status).length;
  }

  // --- Operations ---
  updateStatus(bookingId: string, newStatus: string) {
    this.bookingService.updateBookingStatus(bookingId, newStatus as BookingStatus).subscribe({
      next: () => {
        this.toast.success(`Booking status updated to ${this.statusLabels[newStatus]}`);
        
        // Refresh detail modal view if open
        const currentSelected = this.selectedBooking();
        if (currentSelected && currentSelected.id === bookingId) {
          const updated = this.bookings().find(b => b.id === bookingId);
          if (updated) this.selectedBooking.set(updated);
        }
      },
      error: () => this.toast.error('Failed to update booking status')
    });
  }

  assignSupportAgent(bookingId: string, event: Event) {
    const select = event.target as HTMLSelectElement;
    const agent = select.value;
    
    this.bookingService.assignBooking(bookingId, agent).subscribe({
      next: () => {
        if (agent) {
          this.toast.success(`Booking assigned to ${agent}`);
        } else {
          this.toast.success('Booking unassigned successfully');
        }
      },
      error: () => this.toast.error('Failed to assign booking')
    });
  }

  openBookingDetails(booking: Booking) {
    this.selectedBooking.set(booking);
    this.showDamageForm.set(false);
    this.overrideRefundAmount.set(booking.refundAmount ?? null);
    this.overrideCancellationFee.set(booking.cancellationFee ?? null);
  }

  closeBookingDetails() {
    this.selectedBooking.set(null);
  }

  addSupportNote(bookingId: string) {
    const note = this.newSupportNote().trim();
    if (!note) return;

    this.bookingService.addSupportLog(bookingId, note, 'Priya Nair').subscribe({
      next: () => {
        this.toast.success('Support log added successfully');
        this.newSupportNote.set('');
        
        // Refresh details modal content
        const updated = this.bookings().find(b => b.id === bookingId);
        if (updated) this.selectedBooking.set(updated);
      },
      error: () => this.toast.error('Failed to add support log')
    });
  }

  recordDamageCharges(bookingId: string) {
    const amount = this.damageAmount();
    const notes = this.damageNotes().trim();

    if (amount === null || amount <= 0 || !notes) {
      this.toast.warning('Please enter a valid amount and description');
      return;
    }

    this.bookingService.addDamageCharges(bookingId, amount, notes).subscribe({
      next: () => {
        this.toast.success(`Damage charges of ₹${amount.toLocaleString('en-IN')} recorded`);
        this.damageAmount.set(null);
        this.damageNotes.set('');
        this.showDamageForm.set(false);

        // Refresh details modal content
        const updated = this.bookings().find(b => b.id === bookingId);
        if (updated) this.selectedBooking.set(updated);
      },
      error: () => this.toast.error('Failed to record damage charges')
    });
  }

  applyRefundOverride(bookingId: string) {
    const refund = this.overrideRefundAmount();
    const fee = this.overrideCancellationFee();
    if (refund === null || fee === null) {
      this.toast.warning('Please enter valid refund and fee values.');
      return;
    }

    const booking = this.bookings().find(b => b.id === bookingId);
    if (!booking) return;

    const updatedProperties = {
      refundAmount: refund,
      cancellationFee: fee,
      platformCancellationFeeRetained: Math.max(0, booking.advanceAmount - refund - fee),
      refundStatus: refund > 0 ? ('pending' as const) : ('none' as const)
    };

    this.bookingService.updateCancellationDetails(bookingId, updatedProperties).subscribe({
      next: () => {
        this.bookingService.globalBookings.update(list =>
          list.map(b => b.id === bookingId ? { ...b, ...updatedProperties } : b)
        );
        this.bookingService.addSupportLog(bookingId, `Support override applied: Refund changed to ₹${refund}, Cancellation Fee to ₹${fee}.`, 'Priya Nair').subscribe(() => {
          this.toast.success('Refund values overwritten successfully.');
          const updated = this.bookings().find(b => b.id === bookingId);
          if (updated) this.selectedBooking.set(updated);
        });
      },
      error: () => this.toast.error('Failed to override refund values on server')
    });
  }

  markRefundProcessed(bookingId: string) {
    const txnId = 'TXN-REFUND-' + Math.floor(Math.random() * 1000000);
    const updatedProperties = {
      refundStatus: 'processed' as const,
      refundTransactionId: txnId
    };
    this.bookingService.updateCancellationDetails(bookingId, updatedProperties).subscribe({
      next: () => {
        this.bookingService.globalBookings.update(list =>
          list.map(b => b.id === bookingId ? { ...b, ...updatedProperties } : b)
        );
        this.bookingService.addSupportLog(bookingId, `Refund marked as PROCESSED. Transaction ID: ${txnId}`, 'Priya Nair').subscribe(() => {
          this.toast.success('Refund status updated to Processed.');
          const updated = this.bookings().find(b => b.id === bookingId);
          if (updated) this.selectedBooking.set(updated);
        });
      },
      error: () => this.toast.error('Failed to process refund on server')
    });
  }

  markEscrowSettled(bookingId: string) {
    const updatedProperties = {
      escrowStatus: 'released' as const
    };
    this.bookingService.updateCancellationDetails(bookingId, updatedProperties).subscribe({
      next: () => {
        this.bookingService.globalBookings.update(list =>
          list.map(b => b.id === bookingId ? { ...b, ...updatedProperties } : b)
        );
        this.bookingService.addSupportLog(bookingId, `Escrow status marked as RELEASED/SETTLED.`, 'Priya Nair').subscribe(() => {
          this.toast.success('Escrow status updated.');
          const updated = this.bookings().find(b => b.id === bookingId);
          if (updated) this.selectedBooking.set(updated);
        });
      },
      error: () => this.toast.error('Failed to update escrow status on server')
    });
  }

  copyToClipboard(text: string, event: Event) {
    event.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      this.toast.show('Copied to clipboard!', 'info', 1500);
    });
  }
}
