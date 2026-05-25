import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule, TitleCasePipe, SlicePipe, DatePipe } from '@angular/common';
import { SupportService } from '../../core/services/support.service';
import { SupportTicket } from '../../core/models/message.model';

@Component({
  selector: 'app-admin-support',
  standalone: true,
  imports: [CommonModule, FormsModule, TitleCasePipe, SlicePipe, DatePipe],
  templateUrl: './admin-support.html',
  styleUrl: './admin-support.css'
})
export class AdminSupport implements OnInit {
  private api = inject(SupportService);
  private router = inject(Router);

  tickets = signal<SupportTicket[]>([]);

  // Filters
  searchQuery = signal('');
  statusFilter = signal('all');
  priorityFilter = signal('all');

  filteredTickets = computed(() => {
    let ts = this.tickets();
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
  });

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
