import { Component, signal, OnInit, inject, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { VendorDashboardService } from '../../core/services/vendor-dashboard.service';
import { BookingService } from '../../core/services/booking.service';
import { ToastService } from '../../core/services/toast.service';
import { VendorAnalyticsData } from '../../core/services/analytics.service';

@Component({ 
  selector: 'app-vendor-dashboard', 
  standalone: true,
  imports: [CommonModule, RouterLink], 
  templateUrl: './vendor-dashboard.html', 
  styleUrl: './vendor-dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VendorDashboard implements OnInit {
  private api = inject(VendorDashboardService);
  private bookingService = inject(BookingService);
  toast = inject(ToastService);
  dashboard = signal<any>(null);
  vendorProfile = signal<any>(null);
  shareProfileLink = signal('https://joinevents.com/v/spice-garden-catering');
  
  analyticsData = signal<VendorAnalyticsData | null>(null);

  maxEarnings = computed(() => {
    const d = this.analyticsData();
    if (!d || !d.monthlyEarnings || !Array.isArray(d.monthlyEarnings) || d.monthlyEarnings.length === 0) return 1;
    return Math.max(...d.monthlyEarnings, 1);
  });

  readonly monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Dynamic signals updated from API
  recentEnquiries = signal<any[]>([]);
  topServices = signal<any[]>([]);
  revenueTarget = signal<any>({ current: 0, target: 1, percentage: 0 });
  vendorLevel = signal<any>({ current: '', next: '', points: 0, needed: 1 });
  pendingTasks = signal<any[]>([]);
  esgScore = signal<any>({ score: 0, offset: '0 Tons', trend: '0%' });
  pendingCollaborations = signal<any[]>([]);

  /** The trend is 0 for months before the first review; nothing to plot until there is one. */
  hasRatings = computed(() => (this.analyticsData()?.averageRatingTrend ?? []).some(r => r > 0));

  stats = computed(() => {
    const data = this.analyticsData();
    const earnings = data ? `₹${((data.totalEarnings || 0) / 100000).toFixed(1)}L` : '₹0.0L';
    // Paid bookings waiting for this vendor to confirm them.
    const toConfirm = data?.bookingCountByStatus?.['toConfirm']?.toString() ?? '0';
    const upcoming = data?.bookingCountByStatus?.['accepted']?.toString() ?? '0';
    const rating = this.dashboard()?.rating;
    
    return [
      { label: 'Total Earnings', value: earnings, icon: 'bi-currency-rupee', color: 'var(--success)', bg: 'rgba(22,163,74,0.1)' },
      { label: 'Bookings to Confirm', value: toConfirm, icon: 'bi-clock-history', color: 'var(--warning)', bg: 'rgba(217,119,6,0.1)' },
      { label: 'Upcoming Jobs', value: upcoming, icon: 'bi-calendar-check', color: 'var(--secondary)', bg: 'rgba(107,33,168,0.1)' },
      { label: 'Overall Rating', value: rating ? `${rating} ★` : 'No reviews yet', icon: 'bi-star-half', color: 'var(--accent)', bg: 'rgba(245,158,11,0.1)' },
    ];
  });

  ngOnInit() { 
    this.api.getDashboardData().subscribe(d => {
      this.dashboard.set(d);
      this.vendorProfile.set({ isVerified: d.isVerified });
    });
    this.api.getDashboardTasks().subscribe(tasks => {
      const filtered = (tasks || []).filter(t => t.id !== 't2' && t.link !== '/vendor/verification');
      this.pendingTasks.set(filtered);
    });
    this.api.getAnalytics().subscribe(res => {
      this.analyticsData.set(res);
    });
    this.api.getPendingCollaborations().subscribe(collabs => {
      this.pendingCollaborations.set(collabs);
    });
    this.api.getCustomerEnquiries().subscribe(enquiries => {
      this.recentEnquiries.set(enquiries);
    });
    this.api.getLoyaltyStatus().subscribe(loyalty => {
      this.vendorLevel.set(loyalty);
    });
    this.api.getRevenueTarget().subscribe(rev => {
      this.revenueTarget.set(rev);
    });
    this.api.getEsgSnapshot().subscribe(esg => {
      this.esgScore.set(esg);
    });
  }

  copyProfileLink() {
    navigator.clipboard.writeText(this.shareProfileLink());
    this.toast.success('Profile link copied to clipboard!');
  }

  shareVia(platform: string) {
    const link = encodeURIComponent(this.shareProfileLink());
    const text = encodeURIComponent('Check out my professional portfolio on JoinEvents! ');
    let url = '';

    switch(platform) {
      case 'whatsapp': url = `https://wa.me/?text=${text}${link}`; break;
      case 'facebook': url = `https://www.facebook.com/sharer/sharer.php?u=${link}`; break;
      case 'twitter':  url = `https://twitter.com/intent/tweet?text=${text}&url=${link}`; break;
      case 'linkedin': url = `https://www.linkedin.com/sharing/share-offsite/?url=${link}`; break;
    }

    if (url) window.open(url, '_blank', 'width=600,height=400');
  }

  /** Confirms a paid booking (Paid → Confirmed); the customer is notified. */
  confirmRequest(id: string) {
    this.bookingService.updateBookingStatus(id, 'confirmed').subscribe({
      next: () => {
        this.toast.success('Booking confirmed. The customer has been notified.');
        this.refreshAfterAction();
      },
      error: err => this.toast.error(err?.status < 500 && err?.error?.error ? err.error.error : 'Could not confirm the booking. Please try again.')
    });
  }

  private refreshAfterAction() {
    this.api.getDashboardData().subscribe(d => this.dashboard.set(d));
    this.api.getAnalytics().subscribe(res => this.analyticsData.set(res));
  }

  acceptCollaboration(id: string) {
    this.api.acceptCollaboration(id).subscribe((success) => {
      if (success) {
        this.toast.success('Collaboration invitation accepted!');
        this.api.getPendingCollaborations().subscribe(collabs => {
          this.pendingCollaborations.set(collabs);
        });
      }
    });
  }

  sendQuickReply(id: string, replyType: string = 'Acknowledgement') {
    this.api.sendEnquiryReply(id, replyType).subscribe((success) => {
      if (success) {
        this.toast.success(`"${replyType}" reply sent!`);
      }
    });
  }
}
