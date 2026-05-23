import { Component, signal, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { MessengerService } from '../../core/services/messenger.service';
import { LoyaltyService } from '../../core/services/loyalty.service';
import { EventType } from '../../core/models/event.model';
import { Booking } from '../../core/models/booking.model';
import { ChatThread } from '../../core/models/message.model';
import { ToastService } from '../../core/services/toast.service';
import { catchError, of } from 'rxjs';

import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-customer-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerDashboard implements OnInit {
  private auth = inject(AuthService);
  private dashboardService = inject(DashboardService);
  private messenger = inject(MessengerService);
  private loyaltyService = inject(LoyaltyService);

  user = this.auth.currentUser;
  loading = signal<boolean>(true);
  eventTypes = signal<EventType[]>([]);
  bookings = signal<Booking[]>([]);
  customerProfile = signal<any>(null);
  loyaltyBalance = signal<any>(null);
  recentMessages = signal<ChatThread[]>([]);
  private toast = inject(ToastService);
  private router = inject(Router);

  readonly stats = signal([
    { label: 'Upcoming Events', value: '0', icon: 'bi-calendar-event', gradient: 'linear-gradient(135deg,#FF6B35,#F59E0B)', iconBg: 'rgba(255,107,53,0.12)', iconColor: 'var(--primary)', route: '/bookings' },
    { label: 'Active Bookings', value: '0', icon: 'bi-journal-check', gradient: 'linear-gradient(135deg,#6B21A8,#9333EA)', iconBg: 'rgba(107,33,168,0.12)', iconColor: 'var(--secondary)', route: '/bookings' },
    { label: 'RFP Requests', value: '0', icon: 'bi-file-earmark-text', gradient: 'linear-gradient(135deg,#16A34A,#0EA5E9)', iconBg: 'rgba(22,163,74,0.12)', iconColor: 'var(--success)', route: '/rfp' },
    { label: 'Loyalty Points', value: '0', icon: 'bi-star-half', gradient: 'linear-gradient(135deg,#F59E0B,#FF6B35)', iconBg: 'rgba(245,158,11,0.12)', iconColor: 'var(--accent)', route: '/rewards' },
  ]);

  ngOnInit() {
    this.loading.set(true);
    
    this.dashboardService.getEventCategories().subscribe(t => this.eventTypes.set(t));
    
    const user = this.auth.currentUser();
    const userId = user?.id ?? 'c1';

    this.dashboardService.getBookings().subscribe(b => {
      this.bookings.set(b);
      const upcoming = b.filter(book => book.status === 'confirmed' || book.status === 'pending' || book.status === 'in_progress').length;
      const active = b.filter(book => book.status === 'confirmed' || book.status === 'in_progress').length;
      
      this.stats.update(s => {
        const updated = [...s];
        updated[0].value = upcoming.toString();
        updated[1].value = active.toString();
        return updated;
      });
      this.loading.set(false);
    });

    this.dashboardService.getRfps().subscribe(rfps => {
      this.stats.update(s => {
        const updated = [...s];
        updated[2].value = rfps.length.toString();
        return updated;
      });
    });

    this.dashboardService.getCustomerProfile().subscribe(customer => {
      if (customer) {
        this.customerProfile.set(customer);
      }
    });

    if (userId && userId !== 'c1') {
      this.loyaltyService.getBalance(userId).subscribe(bal => {
        this.loyaltyBalance.set(bal);
        this.stats.update(s => {
          const updated = [...s];
          updated[3].value = bal.points.toLocaleString();
          return updated;
        });
      });
    }

    this.messenger.getChatThreads(userId).pipe(
      catchError(err => {
        if (err.status !== 401) {
          console.error('Failed to load recent messages on dashboard:', err);
        }
        return of([]);
      })
    ).subscribe(threads => {
      const validThreads = (threads || []).filter(t => t && t.lastMessage);
      this.recentMessages.set(validThreads.slice(0, 3));
      const unread = validThreads.filter(t => t.unreadCount > 0).length;
      if (unread > 0) {
        this.toast.info(`You have ${unread} unread message(s) waiting!`);
      }
    });
  }

  getStatusBadgeClass(status: string): string {
    const map: Record<string, string> = { pending: 'ee-badge-warning', advance_paid: 'ee-badge-info', confirmed: 'ee-badge-secondary', in_progress: 'ee-badge-primary', completed: 'ee-badge-success', settled: 'ee-badge-success', cancelled: 'ee-badge-danger' };
    return map[status] || 'ee-badge-primary';
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = { pending: 'Pending', advance_paid: 'Advance Paid', confirmed: 'Confirmed', in_progress: 'In Progress', completed: 'Completed', settled: 'Settled', cancelled: 'Cancelled' };
    return map[status] || status;
  }

  getGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  goToVendors(category: string) {
    const cleanCategory = (category || '').toLowerCase();
    this.router.navigateByUrl(`/events/vendors?${cleanCategory}`);
  }
}
