import { Component, signal, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RfpService } from '../../core/services/rfp.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { EventRfp } from '../../core/models/rfp.model';
import { EventCategoryService } from '../../core/services/event-category.service';

@Component({
  selector: 'app-customer-rfp',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer-rfp.html',
  styleUrl: './customer-rfp.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerRfp implements OnInit {
  private rfpService = inject(RfpService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private eventCategoryService = inject(EventCategoryService);

  rfps = signal<EventRfp[]>([]);
  eventTypes = signal<any[]>([]);
  loading = signal(true);
  showForm = signal(false);
  selectedRfp = signal<EventRfp | null>(null);
  submitting = signal(false);

  serviceOptions = ['Venue', 'Catering', 'Decoration', 'Photography', 'Music', 'Transport', 'Manpower', 'Priest'];

  form = {
    title: '',
    eventTypeId: '',
    eventTypeName: '',
    eventDate: '',
    city: '',
    guestCount: 100,
    budgetMin: 100000,
    budgetMax: 500000,
    requirements: '',
    servicesNeeded: [] as string[]
  };

  ngOnInit() {
    const user = this.auth.currentUser();
    if (user) {
      this.rfpService.getRfps(user.id).subscribe(data => {
        this.rfps.set(data);
        this.loading.set(false);
      });
    }
    this.eventCategoryService.getAll().subscribe(types => this.eventTypes.set(types));
  }

  toggleService(svc: string) {
    const current = this.form.servicesNeeded;
    if (current.includes(svc)) {
      this.form.servicesNeeded = current.filter(s => s !== svc);
    } else {
      this.form.servicesNeeded = [...current, svc];
    }
  }

  onEventTypeChange() {
    const type = this.eventTypes().find(t => t.id === this.form.eventTypeId);
    if (type) this.form.eventTypeName = type.name;
  }

  submitRfp() {
    if (!this.form.title || !this.form.eventTypeId || !this.form.eventDate || !this.form.city) {
      this.toast.error('Please fill in all required fields.');
      return;
    }
    this.submitting.set(true);
    const user = this.auth.currentUser()!;
    this.rfpService.createRfp({ ...this.form, customerId: user.id, customerName: user.name }).subscribe(newRfp => {
      this.rfps.update(list => [newRfp, ...list]);
      this.showForm.set(false);
      this.submitting.set(false);
      this.form = { title: '', eventTypeId: '', eventTypeName: '', eventDate: '', city: '', guestCount: 100, budgetMin: 100000, budgetMax: 500000, requirements: '', servicesNeeded: [] };
      this.toast.success('Your event RFP is live! Vendors will start bidding shortly.');
    });
  }

  selectRfp(rfp: EventRfp) {
    this.selectedRfp.set(rfp);
  }

  acceptBid(rfpId: string, bidId: string) {
    this.rfpService.acceptBid(rfpId, bidId).subscribe(() => {
      this.rfps.update(list => list.map(r => r.id === rfpId ? {
        ...r,
        status: 'bid_selected' as const,
        bids: r.bids.map(b => ({ ...b, status: (b.id === bidId ? 'accepted' : 'rejected') as any }))
      } : r));
      this.selectedRfp.update(r => r ? { ...r, status: 'bid_selected' as const, bids: r.bids.map(b => ({ ...b, status: (b.id === bidId ? 'accepted' : 'rejected') as any })) } : null);
      this.toast.success('Bid accepted! The vendor will be in touch shortly.');
    });
  }

  getStatusLabel(status: string) {
    const map: Record<string, string> = {
      open: 'Open',
      receiving_bids: 'Receiving Bids',
      bid_selected: 'Bid Selected',
      closed: 'Closed'
    };
    return map[status] || status;
  }

  getStatusClass(status: string) {
    const map: Record<string, string> = {
      open: 'pill-info',
      receiving_bids: 'pill-primary',
      bid_selected: 'pill-success',
      closed: 'pill-muted'
    };
    return map[status] || '';
  }

  getDaysLeft(expiresAt: string) {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  getClosedCount() {
    return this.rfps().filter(r => r.status === 'bid_selected').length;
  }

  getTotalBids() {
    return this.rfps().reduce((sum, r) => sum + r.bids.length, 0);
  }

  formatCurrency(n: number) {
    if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
    if (n >= 1000) return '₹' + (n / 1000).toFixed(0) + 'K';
    return '₹' + n;
  }
}
