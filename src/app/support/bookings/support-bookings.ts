import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupportService } from '../../core/services/support.service';
import { ToastService } from '../../core/services/toast.service';
import { Booking } from '../../core/models/booking.model';

@Component({
  selector: 'app-support-bookings',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './support-bookings.html',
  styleUrl: './support-bookings.css'
})
export class SupportBookings implements OnInit {
  private support = inject(SupportService);
  private toast = inject(ToastService);

  bookings = signal<Booking[]>([]);
  selectedBooking = signal<Booking | null>(null);
  activeFilter = signal<string>('all');
  
  // Support Actions State
  newInternalNote = signal('');
  newUpdateMessage = signal('');
  searchQuery = signal('');
  isUpdating = signal(false);
  showMobileDetail = signal(false);

  readonly statusSteps = ['pending','advance_paid','confirmed','in_progress','completed','settled'];
  readonly statusLabels: Record<string, string> = {
    pending: 'Pending', advance_paid: 'Advance Paid', confirmed: 'Confirmed',
    in_progress: 'In Progress', completed: 'Completed', settled: 'Fully Settled', cancelled: 'Cancelled'
  };

  readonly statusColors: Record<string, string> = {
    pending: 'pill-warning', advance_paid: 'pill-info', confirmed: 'pill-purple',
    in_progress: 'pill-primary', completed: 'pill-success', settled: 'pill-success', cancelled: 'pill-danger'
  };

  filteredBookings = computed(() => {
    const filter = this.activeFilter();
    const query = this.searchQuery().toLowerCase();
    let result = this.bookings();
    
    if (filter !== 'all') {
      result = result.filter(b => b.status === filter);
    }
    
    if (query) {
      result = result.filter(b => 
        b.eventName.toLowerCase().includes(query) || 
        b.bookingNumber.toLowerCase().includes(query) ||
        b.customerName.toLowerCase().includes(query) ||
        b.city.toLowerCase().includes(query)
      );
    }
    
    return result;
  });

  ngOnInit() {
    this.loadBookings();
  }

  loadBookings() {
    this.support.getSupportBookings().subscribe(b => {
      this.bookings.set(b);
      if (b.length && !this.selectedBooking()) this.selectedBooking.set(b[0]);
    });
  }

  selectBooking(b: Booking) {
    this.selectedBooking.set(b);
    this.newInternalNote.set('');
    this.newUpdateMessage.set('');
    this.showMobileDetail.set(true);
  }

  getCurrentStepIndex() { 
    const s = this.selectedBooking(); 
    return s ? this.statusSteps.indexOf(s.status) : 0; 
  }

  addInternalNote() {
    const b = this.selectedBooking();
    const note = this.newInternalNote().trim();
    if (!b || !note) return;

    this.isUpdating.set(true);
    this.support.addBookingNote(b.id, note).subscribe((updatedBooking) => {
      this.toast.success('Internal note added');
      // If backend returns the fully updated booking with logs
      this.selectedBooking.set(updatedBooking);
      this.bookings.update(bs => bs.map(xb => xb.id === updatedBooking.id ? updatedBooking : xb));
      this.newInternalNote.set('');
      this.isUpdating.set(false);
    });
  }

  remindVendor(vendorId: string, vendorName: string) {
    const b = this.selectedBooking();
    if (!b) return;

    this.isUpdating.set(true);
    this.support.remindVendor(b.id, vendorId).subscribe((updatedBooking) => {
      this.toast.success(`Reminder sent to ${vendorName}`);
      if (updatedBooking) {
         this.selectedBooking.set(updatedBooking);
         this.bookings.update(bs => bs.map(xb => xb.id === updatedBooking.id ? updatedBooking : xb));
      }
      this.isUpdating.set(false);
    });
  }

  updateUser() {
    const b = this.selectedBooking();
    const msg = this.newUpdateMessage().trim();
    if (!b || !msg) return;

    this.isUpdating.set(true);
    this.support.updateUser(b.id, msg).subscribe((updatedBooking) => {
      this.toast.success('Update sent to user');
      this.selectedBooking.set(updatedBooking);
      this.bookings.update(bs => bs.map(xb => xb.id === updatedBooking.id ? updatedBooking : xb));
      this.newUpdateMessage.set('');
      this.isUpdating.set(false);
    });
  }
}
