import { Component, signal, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupportService } from '../../core/services/support.service';
import { ToastService } from '../../core/services/toast.service';
import { SupportTicket } from '../../core/models/message.model';
import { BookingService } from '../../core/services/booking.service';
import { AuthService } from '../../core/services/auth.service';
import { Booking } from '../../core/models/booking.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-customer-support',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './support.html',
  styleUrl: './support.css'
})
export class CustomerSupport implements OnInit {
  private supportService = inject(SupportService);
  private bookingService = inject(BookingService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  tickets = signal<SupportTicket[]>([]);
  selectedTicket = signal<SupportTicket | null>(null);
  bookings = signal<Booking[]>([]);

  // New Ticket Form State
  showCreateModal = signal(false);
  newSubject = '';
  newPriority = 'medium';
  selectedBookingId = '';
  submitting = signal(false);
  selectedFileName = signal<string | null>(null);

  // Reply Form State
  replyText = '';
  replying = signal(false);

  // Filter and search
  searchQuery = signal('');
  activeTab = signal<'all' | 'open' | 'resolved'>('all');

  customerTickets = computed(() => {
    return this.tickets(); // Backend already filters by user
  });

  filteredTickets = computed(() => {
    let list = this.customerTickets();
    const query = this.searchQuery().toLowerCase();
    const tab = this.activeTab();

    if (query) {
      list = list.filter(t => t.subject.toLowerCase().includes(query));
    }
    if (tab === 'open') {
      list = list.filter(t => t.status === 'open' || t.status === 'in_progress');
    } else if (tab === 'resolved') {
      list = list.filter(t => t.status === 'resolved' || t.status === 'closed');
    }
    return list;
  });

  selectedFile: File | null = null;

  ngOnInit() {
    this.loadTickets();
    this.loadBookings();
  }

  loadTickets() {
    this.supportService.getMyTickets().subscribe(t => {
      this.tickets.set(t);
      if (t.length && !this.selectedTicket()) {
        this.selectedTicket.set(t[0]);
      }
    });
  }

  loadBookings() {
    const user = this.auth.currentUser();
    if (user && user.id) {
      this.bookingService.getBookings(user.id).subscribe(b => {
        this.bookings.set(b || []);
      });
    }
  }

  selectTicket(t: SupportTicket) {
    this.selectedTicket.set(t);
  }

  openCreateModal() {
    this.newSubject = '';
    this.newPriority = 'medium';
    this.selectedBookingId = '';
    this.selectedFile = null;
    this.selectedFileName.set(null);
    this.showCreateModal.set(true);
  }

  closeCreateModal() {
    this.showCreateModal.set(false);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.selectedFileName.set(input.files[0].name);
    }
  }

  removeSelectedFile(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.selectedFile = null;
    this.selectedFileName.set(null);
    const input = document.getElementById('ticketFile') as HTMLInputElement;
    if (input) input.value = '';
  }

  submitTicket() {
    if (!this.newSubject.trim()) {
      this.toast.error('Please enter a valid issue description.');
      return;
    }

    const booking = this.bookings().find(b => b.id === this.selectedBookingId);
    const eventName = booking ? booking.eventName : undefined;

    this.submitting.set(true);

    const createTicketWithUrl = (url?: string) => {
      this.supportService.createTicket(this.newSubject.trim(), this.newSubject.trim(), eventName, url, this.selectedBookingId || undefined).subscribe({
        next: (ticket) => {
          this.submitting.set(false);
          this.closeCreateModal();
          this.toast.success('Your support issue has been raised successfully!');
          this.loadTickets();
          this.selectedTicket.set(ticket);
        },
        error: () => {
          this.submitting.set(false);
        }
      });
    };

    if (this.selectedFile) {
      this.supportService.uploadAttachment(this.selectedFile).subscribe({
        next: (res) => {
          createTicketWithUrl(res.url);
        },
        error: () => {
          this.toast.error('Failed to upload file attachment. Raising ticket without it.');
          createTicketWithUrl(undefined);
        }
      });
    } else {
      createTicketWithUrl(undefined);
    }
  }

  resolveAttachmentUrl(url: string | undefined): string {
    if (!url) return '';
    const base = environment.apiUrl.replace('/api/v1', '');
    return `${base}${url}`;
  }

  sendReply() {
    const ticket = this.selectedTicket();
    if (!ticket || !this.replyText.trim()) return;

    this.replying.set(true);
    this.supportService.replyToTicket(ticket.id, this.replyText.trim()).subscribe(updated => {
      this.replying.set(false);
      this.replyText = '';
      this.selectedTicket.set(updated);
      this.tickets.update(list => list.map(t => t.id === ticket.id ? updated : t));
      this.toast.success('Reply sent successfully!');
    }, () => {
      this.replying.set(false);
    });
  }

  reopenTicket(id: string) {
    this.supportService.updateTicketStatus(id, 'open').subscribe(updated => {
      this.selectedTicket.set(updated);
      this.tickets.update(list => list.map(t => t.id === id ? updated : t));
      this.toast.success('Ticket reopened successfully! You can now send messages again.');
    });
  }

  priorityColor(p: string): string {
    const map: Record<string, string> = { low: 'bg-info', medium: 'bg-warning text-dark', high: 'bg-danger text-white', urgent: 'bg-dark text-white' };
    return map[p?.toLowerCase()] || 'bg-secondary';
  }

  statusColor(s: string): string {
    const map: Record<string, string> = { open: 'bg-danger text-white', in_progress: 'bg-warning text-dark', resolved: 'bg-success text-white', closed: 'bg-secondary text-white' };
    return map[s?.toLowerCase()] || 'bg-primary';
  }
}
