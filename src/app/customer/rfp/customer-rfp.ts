import { Component, signal, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { RfpService } from '../../core/services/rfp.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { EventRfp } from '../../core/models/rfp.model';
import { EventTierService } from '../../core/services/event-tier.service';

@Component({
  selector: 'app-customer-rfp',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './customer-rfp.html',
  styleUrl: './customer-rfp.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerRfp implements OnInit {
  private rfpService = inject(RfpService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);
  public eventTierService = inject(EventTierService);

  rfps = signal<EventRfp[]>([]);
  loading = signal(true);
  selectedRfp = signal<EventRfp | null>(null);

  clearSelection() {
    this.selectedRfp.set(null);
  }

  editRfp(id: string) {
    this.router.navigate(['/get-quotes/edit', id]);
  }

  deleteRfp(id: string) {
    if (confirm('Are you sure you want to cancel this quote request? This action cannot be undone and all active offers will be deleted.')) {
      this.rfpService.deleteRfp(id).subscribe(success => {
        if (success) {
          this.toast.success('Your quote request was successfully cancelled.');
          this.rfps.update(list => list.filter(r => r.id !== id));
          this.selectedRfp.set(null);
        } else {
          this.toast.error('Failed to cancel quote request. Please try again.');
        }
      });
    }
  }

  getTierFromRequirements(requirements?: string): string | null {
    if (!requirements) return null;
    const match = requirements.match(/\[Preferred Quality Tier:\s*([^\]]+)\]/);
    return match ? match[1].trim() : null;
  }

  getCleanedRequirements(requirements?: string): string {
    if (!requirements) return '';
    return requirements.replace(/\[Preferred Quality Tier:\s*([^\]]+)\]\n\n?/, '').trim();
  }

  getGradientForTier(tier: string): string {
    return this.eventTierService.getGradientForTier(tier);
  }

  getIconForTier(tier: string): string {
    return this.eventTierService.getIconForTier(tier);
  }

  ngOnInit() {
    this.eventTierService.loadAll().subscribe();
    const user = this.auth.currentUser();
    if (user) {
      this.rfpService.getRfps(user.id).subscribe(data => {
        this.rfps.set(data);
        this.loading.set(false);
      });
    }
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
