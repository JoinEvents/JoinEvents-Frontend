import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Vendor } from '../../core/models/vendor.model';
import { ConfirmService } from '../../shared/components/confirm-dialog';
import { AuthService } from '../../core/services/auth.service';
import { RouterLink } from '@angular/router';

@Component({ selector: 'app-admin-vendors', standalone: true, imports: [TitleCasePipe, RouterLink], templateUrl: './admin-vendors.html', styleUrl: './admin-vendors.css' })
export class AdminVendors implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private confirm = inject(ConfirmService);
  private auth = inject(AuthService);
  private pollInterval?: any;
  
  isAdmin = computed(() => this.auth.getRole() === 'admin');
  
  localVendors = signal<Vendor[]>([
    { id: 'v1', name: 'Amit Sharma', businessName: 'Spice Garden Catering', email: 'vendor@demo.com', phone: '+91 91234 56789', city: 'Hyderabad', services: ['catering'], isVerified: true, sustainabilityTags: ['Zero Waste Catering', 'Local Sourced'], verificationStatus: 'verified', verificationDocs: [{ type: 'FSSAI License', name: 'fssai.pdf', uploadedAt: '2025-01-10', status: 'approved' },{ type: 'GST Certificate', name: 'gst.pdf', uploadedAt: '2025-01-10', status: 'approved' }], rating: 4.8, totalReviews: 245, totalEarnings: 850000, joinedDate: '2025-01-01', gstNumber: '36AABCU9603R1ZX', accountStatus: 'active' },
    { id: 'v2', name: 'Meera Krishnan', businessName: 'Blooms & Bliss Decor', email: 'meera@blooms.com', phone: '+91 92345 67890', city: 'Hyderabad', services: ['decoration'], isVerified: true, sustainabilityTags: ['Eco-friendly Decor', 'Reusable Materials'], verificationStatus: 'verified', verificationDocs: [{ type: 'Business Registration', name: 'reg.pdf', uploadedAt: '2025-02-15', status: 'approved' }], rating: 4.9, totalReviews: 312, totalEarnings: 650000, joinedDate: '2025-02-01', accountStatus: 'active' },
    { id: 'v3', name: 'Ravi Shankar', businessName: 'Palace Grounds Venue', email: 'ravi@palace.com', phone: '+91 93456 78901', city: 'Bangalore', services: ['venue'], isVerified: false, sustainabilityTags: ['LEED Certified'], verificationStatus: 'under_review', verificationDocs: [{ type: 'Property Documents', name: 'prop.pdf', uploadedAt: '2026-04-01', status: 'pending' },{ type: 'Fire NOC', name: 'noc.pdf', uploadedAt: '2026-04-01', status: 'pending' }], rating: 0, totalReviews: 0, totalEarnings: 0, joinedDate: '2026-04-01', accountStatus: 'active' },
    { id: 'v4', name: 'Pandu Subramanian', businessName: 'Royal Fleet Transport', email: 'pandu@royalfleet.com', phone: '+91 94567 89012', city: 'Chennai', services: ['transport'], verificationStatus: 'pending', verificationDocs: [], rating: 0, totalReviews: 0, totalEarnings: 0, joinedDate: '2026-04-18', accountStatus: 'active' },
    { id: 'v5', name: 'Pandit Gopal Das', businessName: 'Vedic Rituals', email: 'gopaldas@vedic.com', phone: '+91 95678 90123', city: 'Hyderabad', services: ['priest'], verificationStatus: 'verified', verificationDocs: [{ type: 'Certificate', name: 'vedic.pdf', uploadedAt: '2025-06-01', status: 'approved' }], rating: 4.7, totalReviews: 180, totalEarnings: 320000, joinedDate: '2025-06-01', accountStatus: 'suspended' },
  ]);

  vendors = this.localVendors;
  
  searchQuery = signal('');
  statusFilter = signal('all');

  countAll = computed(() => this.vendors().length);
  countVerified = computed(() => this.vendors().filter(v => v.verificationStatus === 'verified').length);
  countUnderReview = computed(() => this.vendors().filter(v => v.verificationStatus === 'under_review').length);
  countPending = computed(() => this.vendors().filter(v => v.verificationStatus === 'pending' || v.verificationStatus === 'action_required').length);
  countSuspended = computed(() => this.vendors().filter(v => v.accountStatus === 'suspended').length);
  countBanned = computed(() => this.vendors().filter(v => v.accountStatus === 'banned').length);

  ngOnInit() {
    this.loadVendors();
    this.startPolling();
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  startPolling() {
    this.pollInterval = window.setInterval(() => {
      this.loadVendors();
    }, 10000);
  }

  stopPolling() {
    if (this.pollInterval) {
      window.clearInterval(this.pollInterval);
    }
  }

  loadVendors() {
    this.http.get<Vendor[]>(`${environment.apiUrl}/admin/vendors`, { headers: { 'X-Suppress-Errors': 'true' } }).pipe(
      catchError(() => of(this.localVendors()))
    ).subscribe(list => {
      this.localVendors.set(list);
    });
  }

  moderateVendor(vendorId: string, action: 'suspend' | 'ban' | 'reactivate', reason?: string, duration?: string): Observable<boolean> {
    this.localVendors.update(vendors => 
      vendors.map(v => {
        if (v.id === vendorId) {
          const status = action === 'suspend' ? 'suspended' : action === 'ban' ? 'banned' : 'active';
          return { 
            ...v, 
            accountStatus: status,
            suspensionReason: action !== 'reactivate' ? reason : undefined,
            suspensionDuration: action === 'suspend' ? duration : undefined
          };
        }
        return v;
      })
    );

    return this.http.post<any>(`${environment.apiUrl}/admin/vendors/${vendorId}/moderate`, { action, reason, duration }, { headers: { 'X-Suppress-Errors': 'true' } }).pipe(
      map(() => true),
      catchError(() => of(true))
    );
  }

  filteredVendors = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const filter = this.statusFilter();
    
    return this.vendors().filter(v => {
      const matchesSearch = !query || 
        v.businessName.toLowerCase().includes(query) || 
        v.name.toLowerCase().includes(query) || 
        v.email.toLowerCase().includes(query);
        
      const matchesFilter = filter === 'all' || 
        (filter === 'suspended' && v.accountStatus === 'suspended') ||
        (filter === 'banned' && v.accountStatus === 'banned') ||
        (filter === 'verified' && v.verificationStatus === 'verified') ||
        (filter === 'under_review' && v.verificationStatus === 'under_review') ||
        (filter === 'pending' && (v.verificationStatus === 'pending' || v.verificationStatus === 'action_required'));
        
      return matchesSearch && matchesFilter;
    });
  });

  suspendingVendor = signal<Vendor | null>(null);
  suspendReason = signal('');
  suspendDuration = signal('1_week');

  openSuspendForm(vendor: Vendor) {
    this.suspendingVendor.set(vendor);
    this.suspendReason.set('');
    this.suspendDuration.set('1_week');
  }

  cancelSuspend() {
    this.suspendingVendor.set(null);
  }

  confirmSuspend() {
    const v = this.suspendingVendor();
    if (v && this.suspendReason().trim()) {
      this.moderateVendor(v.id, 'suspend', this.suspendReason(), this.suspendDuration()).subscribe(() => {
        this.suspendingVendor.set(null);
        this.loadVendors();
      });
    }
  }

  async banVendor(vendorId: string, name: string) {
    const confirmed = await this.confirm.ask({
      title: 'Ban Vendor',
      message: `Are you sure you want to permanently BAN ${name}? This action is severe and cannot be easily undone.`,
      confirmText: 'Ban Vendor',
      type: 'danger'
    });
    if (confirmed) {
      this.moderateVendor(vendorId, 'ban').subscribe(() => {
        this.loadVendors();
      });
    }
  }

  async reactivateVendor(vendorId: string, name: string) {
    const confirmed = await this.confirm.ask({
      title: 'Reactivate Vendor',
      message: `Are you sure you want to restore active status for ${name}?`,
      confirmText: 'Reactivate',
      type: 'primary'
    });
    if (confirmed) {
      this.moderateVendor(vendorId, 'reactivate').subscribe(() => {
        this.loadVendors();
      });
    }
  }

  statusColor(s: string): string { const m: Record<string,string> = { verified:'ee-badge-success', under_review:'ee-badge-warning', pending:'ee-badge-info', action_required:'ee-badge-warning-orange', rejected:'ee-badge-danger' }; return m[s] || 'ee-badge-primary'; }
  statusLabel(s: string): string { const m: Record<string,string> = { verified:'Verified', under_review:'Under Review', pending:'Pending', action_required:'Action Required', rejected:'Rejected' }; return m[s] || s; }

  copyToClipboard(text: string, event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    navigator.clipboard.writeText(text).then(() => {
      if (target) {
        const icon = target.querySelector('.copy-icon');
        if (icon) {
          icon.className = 'bi bi-check-lg text-success copy-icon';
          setTimeout(() => {
            icon.className = 'bi bi-clipboard copy-icon';
          }, 1500);
        }
      }
    });
  }
}
