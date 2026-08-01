import { Component, signal, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RfpService } from '../../core/services/rfp.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { EventRfp } from '../../core/models/rfp.model';
import { EventTierService } from '../../core/services/event-tier.service';

@Component({
  selector: 'app-vendor-rfp',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vendor-rfp.html',
  styleUrl: './vendor-rfp.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VendorRfp implements OnInit {
  private rfpService = inject(RfpService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private http = inject(HttpClient);
  public eventTierService = inject(EventTierService);

  openRfps = signal<EventRfp[]>([]);
  loading = signal(true);
  selectedRfp = signal<EventRfp | null>(null);
  showBidForm = signal(false);
  submitting = signal(false);

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

  bidForm = {
    proposedAmount: 0,
    description: '',
    deliverables: [''],
    validUntil: ''
  };

  ngOnInit() {
    this.eventTierService.loadAll().subscribe();
    this.rfpService.getAllOpenRfps().subscribe(rfps => {
      this.openRfps.set(rfps);
      this.loading.set(false);
    });
  }

  selectRfp(rfp: EventRfp) {
    this.selectedRfp.set(rfp);
    this.showBidForm.set(false);
    const user = this.auth.currentUser();
    const alreadyBid = rfp.bids.some(b => b.vendorId === user?.id);
    if (alreadyBid) this.showBidForm.set(false);
  }

  clearSelection() {
    this.selectedRfp.set(null);
    this.showBidForm.set(false);
  }

  hasAlreadyBid(rfp: EventRfp): boolean {
    const user = this.auth.currentUser();
    return rfp.bids.some(b => b.vendorId === user?.id);
  }

  addDeliverable() {
    this.bidForm.deliverables = [...this.bidForm.deliverables, ''];
  }

  removeDeliverable(index: number) {
    this.bidForm.deliverables = this.bidForm.deliverables.filter((_, i) => i !== index);
  }

  updateDeliverable(index: number, value: string) {
    this.bidForm.deliverables = this.bidForm.deliverables.map((d, i) => i === index ? value : d);
  }

  submitBid() {
    const rfp = this.selectedRfp();
    if (!rfp) return;
    if (!this.bidForm.proposedAmount || !this.bidForm.description || !this.bidForm.validUntil) {
      this.toast.error('Please fill in all required fields.');
      return;
    }
    this.submitting.set(true);

    this.rfpService.submitBid(rfp.id, {
      proposedAmount: this.bidForm.proposedAmount,
      description: this.bidForm.description,
      deliverables: this.bidForm.deliverables.filter(d => d.trim()),
      validUntil: this.bidForm.validUntil
    }).subscribe(() => {
      this.submitting.set(false);
      this.showBidForm.set(false);
      this.toast.success('Your bid has been submitted successfully!');
      this.bidForm = { proposedAmount: 0, description: '', deliverables: [''], validUntil: '' };
      // Reload RFP details to see new bid
      this.rfpService.getRfpById(rfp.id).subscribe(updated => {
        this.selectedRfp.set(updated || null);
      });
    }, () => {
      this.submitting.set(false);
      this.toast.error('Failed to submit bid.');
    });
  }

  formatCurrency(n: number) {
    if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
    if (n >= 1000) return '₹' + (n / 1000).toFixed(0) + 'K';
    return '₹' + n;
  }

  getDaysLeft(expiresAt: string) {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }
}
