import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule, TitleCasePipe, DatePipe } from '@angular/common';
import { SupportService } from '../../core/services/support.service';
import { SupportTicket } from '../../core/models/message.model';

const PRIORITY_WEIGHT: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

@Component({
  selector: 'app-admin-support',
  standalone: true,
  imports: [CommonModule, FormsModule, TitleCasePipe, DatePipe],
  templateUrl: './admin-support.html',
  styleUrl: './admin-support.css'
})
export class AdminSupport implements OnInit {
  private api = inject(SupportService);
  private router = inject(Router);

  tickets = signal<SupportTicket[]>([]);
  showHistory = signal(false);

  // Active tickets filters
  searchQuery = signal('');

  // History-only search (separate from active filters)
  historySearchQuery = signal('');
  statusFilter = signal('all');
  priorityFilter = signal('all');

  private sortByPriorityDate(ts: SupportTicket[]): SupportTicket[] {
    return [...ts].sort((a, b) => {
      const pw = (PRIORITY_WEIGHT[a.priority?.toLowerCase() ?? 'medium'] ?? 2)
               - (PRIORITY_WEIGHT[b.priority?.toLowerCase() ?? 'medium'] ?? 2);
      if (pw !== 0) return pw;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  private applyFilters(ts: SupportTicket[]): SupportTicket[] {
    const query = this.searchQuery().toLowerCase();
    const status = this.statusFilter();
    const priority = this.priorityFilter();
    if (query) {
      ts = ts.filter(t => t.subject.toLowerCase().includes(query) || t.customerName.toLowerCase().includes(query));
    }
    if (status !== 'all') {
      ts = ts.filter(t => t.status === status);
    }
    if (priority !== 'all') {
      ts = ts.filter(t => t.priority === priority);
    }
    return ts;
  }

  // Active tickets: open, in_progress, resolved — sorted by priority then date desc
  filteredTickets = computed(() => {
    const active = this.tickets().filter(t => t.status !== 'closed');
    return this.sortByPriorityDate(this.applyFilters(active));
  });

  // Closed tickets — sorted by newest date first, filtered by their own search bar
  closedTickets = computed(() => {
    const query = this.historySearchQuery().toLowerCase();
    let closed = this.tickets().filter(t => t.status === 'closed');
    if (query) {
      closed = closed.filter(t =>
        t.subject.toLowerCase().includes(query) ||
        t.customerName.toLowerCase().includes(query)
      );
    }
    return [...closed].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  });

  // Whether any closed tickets exist (used in template to avoid arrow fn)
  hasClosedTickets = computed(() => this.tickets().some(t => t.status === 'closed'));

  toggleHistory() {
    const next = !this.showHistory();
    this.showHistory.set(next);
    if (!next) this.historySearchQuery.set('');
  }

  ngOnInit() {
    this.api.getTickets().subscribe(t => {
      this.tickets.set(t);
    });
  }

  selectTicket(t: SupportTicket) {
    this.router.navigate(['/support/tickets', t.id]);
  }

  priorityColor(p: string): string {
    const m: Record<string, string> = {
      low: 'ee-badge-info',
      medium: 'ee-badge-warning',
      high: 'ee-badge-primary',
      urgent: 'ee-badge-danger'
    };
    return m[p?.toLowerCase()] || 'ee-badge-info';
  }

  statusColor(s: string): string {
    const m: Record<string, string> = {
      open: 'ee-badge-danger',
      in_progress: 'ee-badge-warning',
      resolved: 'ee-badge-success',
      closed: 'ee-badge-secondary'
    };
    return m[s?.toLowerCase()] || 'ee-badge-primary';
  }

  priorityClass(p: string): string {
    return `priority-${(p || 'medium').toLowerCase()}`;
  }

  statusClass(s: string): string {
    return `status-${(s || 'open').toLowerCase()}`;
  }

  getCustomerColor(name: string): string {
    const gradients = [
      'linear-gradient(135deg, #FF6B35, #FF8C5A)',
      'linear-gradient(135deg, #6B21A8, #8B5CF6)',
      'linear-gradient(135deg, #0EA5E9, #38BDF8)',
      'linear-gradient(135deg, #10B981, #34D399)',
      'linear-gradient(135deg, #EF4444, #F87171)',
      'linear-gradient(135deg, #F59E0B, #FBBF24)',
    ];
    let hash = 0;
    if (name) {
      for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
      }
    }
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  }
}
