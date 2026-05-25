import { Component, signal, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, TitleCasePipe, DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupportService } from '../../core/services/support.service';
import { SupportTicket } from '../../core/models/message.model';
import { ToastService } from '../../core/services/toast.service';
import { environment } from '../../../environments/environment';

// Trigger build reload
@Component({
  selector: 'app-support-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TitleCasePipe, DatePipe, CurrencyPipe],
  templateUrl: './support-detail.html',
  styleUrl: './support-detail.css'
})
export class SupportDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supportService = inject(SupportService);
  private toast = inject(ToastService);

  ticket = signal<SupportTicket | null>(null);
  reply = '';
  isSending = signal(false);
  isInternalNote = signal(false);

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.loadTicket(id);
      }
    });
  }

  loadTicket(id: string) {
    this.supportService.getTicketById(id).subscribe({
      next: (t) => {
        this.ticket.set(t);
      },
      error: () => {
        this.toast.error('Failed to load ticket details.');
        this.router.navigate(['/support/tickets']);
      }
    });
  }

  closeTicket(id: string) {
    this.supportService.updateTicketStatus(id, 'resolved').subscribe(updated => {
      this.ticket.set(updated);
      this.toast.success('Ticket marked as resolved.');
    });
  }

  onPriorityChange(priority: string) {
    const currentTicket = this.ticket();
    if (!currentTicket) return;
    this.supportService.updateTicketStatus(currentTicket.id, undefined, priority).subscribe({
      next: (updated) => {
        this.ticket.set(updated);
        this.toast.success(`Priority updated to ${priority}.`);
      }
    });
  }

  onStatusChange(status: string) {
    const currentTicket = this.ticket();
    if (!currentTicket) return;
    this.supportService.updateTicketStatus(currentTicket.id, status, undefined).subscribe({
      next: (updated) => {
        this.ticket.set(updated);
        this.toast.success(`Status updated to ${status}.`);
      }
    });
  }

  sendReply() {
    const currentTicket = this.ticket();
    if (!this.reply.trim() || !currentTicket) return;

    this.isSending.set(true);
    const isInternal = this.isInternalNote();
    this.supportService.replyToTicket(currentTicket.id, this.reply, isInternal).subscribe({
      next: (updated) => {
        this.ticket.set(updated);
        this.reply = '';
        this.isSending.set(false);
        this.toast.success(isInternal ? 'Internal note added.' : 'Reply sent successfully.');
      },
      error: () => {
        this.isSending.set(false);
      }
    });
  }

  resolveAttachmentUrl(url: string | undefined): string {
    if (!url) return '';
    const base = environment.apiUrl.replace('/api/v1', '');
    return `${base}${url}`;
  }

  priorityColor(p: string): string {
    const m: Record<string, string> = { low: 'ee-badge-info', medium: 'ee-badge-warning', high: 'ee-badge-primary', urgent: 'ee-badge-danger' };
    return m[p?.toLowerCase()] || 'ee-badge-info';
  }

  statusColor(s: string): string {
    const m: Record<string, string> = { open: 'ee-badge-danger', in_progress: 'ee-badge-warning', resolved: 'ee-badge-success', closed: 'ee-badge-secondary' };
    return m[s?.toLowerCase()] || 'ee-badge-primary';
  }
}
