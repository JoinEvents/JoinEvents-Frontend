import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe, DecimalPipe } from '@angular/common';
import { SupportService } from '../../core/services/support.service';
import { PackageService } from '../../core/services/package.service';
import { Vendor } from '../../core/models/vendor.model';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-admin-verifications',
  standalone: true,
  imports: [FormsModule, TitleCasePipe, DecimalPipe],
  templateUrl: './admin-verifications.html',
  styleUrl: './admin-verifications.css'
})
export class AdminVerifications implements OnInit {
  private support = inject(SupportService);
  private packageService = inject(PackageService);
  private route = inject(ActivatedRoute);

  getDocUrl(fileUrl: string | undefined | null): string {
    if (!fileUrl) return '#';
    if (fileUrl.startsWith('http')) return fileUrl;
    const base = environment.apiUrl.replace('/api/v1', '');
    return `${base}${fileUrl}`;
  }

  getAvatarUrl(avatar: string | undefined | null): string | null {
    if (!avatar) return null;
    if (avatar.startsWith('http')) return avatar;
    const base = environment.apiUrl.replace('/api/v1', '');
    return `${base}${avatar}`;
  }

  getImageUrl(url: string | undefined | null): string {
    if (!url) return 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=800';
    if (url.startsWith('http')) return url;
    const base = environment.apiUrl.replace('/api/v1', '');
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  getInclusionKeys(pkg: any): string[] {
    if (!pkg || !pkg.inclusionDetails) return [];
    return Object.keys(pkg.inclusionDetails);
  }

  toggleInclusion(key: string) {
    if (this.expandedInclusion() === key) {
      this.expandedInclusion.set(null);
    } else {
      this.expandedInclusion.set(key);
    }
  }

  activeTab = signal<'vendors' | 'packages'>('vendors');

  // Vendor profiles verifications
  vendors = signal<Vendor[]>([]);
  selectedVendor = signal<Vendor | null>(null);

  // Search & Filter
  vendorSearch = signal<string>('');
  vendorStatusFilter = signal<string>('all');

  filteredVendors = computed(() => {
    const query = this.vendorSearch().toLowerCase().trim();
    const status = this.vendorStatusFilter();
    return this.vendors().filter(v => {
      const matchesSearch = !query ||
        v.businessName?.toLowerCase().includes(query) ||
        v.name?.toLowerCase().includes(query) ||
        v.city?.toLowerCase().includes(query) ||
        v.email?.toLowerCase().includes(query);
      const matchesStatus = status === 'all' || v.verificationStatus === status;
      return matchesSearch && matchesStatus;
    });
  });

  // Packages verifications
  pendingPackages = signal<any[]>([]);
  selectedPackage = signal<any | null>(null);
  activeImage = signal<string | null>(null);
  expandedInclusion = signal<string | null>(null);

  remarks = '';
  actionDone = signal<string | null>(null);

  private selectVendorFromRoute(): boolean {
    const vendorId = this.route.snapshot.queryParams['vendorId'];
    if (vendorId && this.activeTab() === 'vendors') {
      const match = this.vendors().find(x => x.id === vendorId);
      if (match) {
        this.selectVendor(match);
        return true;
      }
    }
    return false;
  }

  ngOnInit() {
    this.loadVendors();
    this.loadPendingPackages();
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'packages') {
        this.setTab('packages');
      } else {
        const vendorId = params['vendorId'];
        if (vendorId) {
          this.activeTab.set('vendors');
          this.selectVendorFromRoute();
        }
      }
    });
  }

  loadVendors() {
    this.support.getPendingVendors().subscribe(v => {
      this.vendors.set(v.filter(x => x.verificationStatus !== 'verified'));
      
      if (this.selectVendorFromRoute()) {
        return;
      }
      
      if (this.activeTab() === 'vendors' && this.vendors().length > 0 && !this.selectedVendor()) {
        this.selectVendor(this.vendors()[0]);
      }
    });
  }

  loadPendingPackages() {
    this.support.getPendingPackages().subscribe(packages => {
      this.pendingPackages.set(packages);
      if (this.activeTab() === 'packages') {
        if (packages.length > 0) {
          const currentId = this.selectedPackage()?.id;
          const exists = packages.some(p => p.id === currentId);
          if (!exists) {
            this.selectPackage(packages[0]);
          }
        } else {
          this.selectedPackage.set(null);
        }
      }
    });
  }

  setTab(tab: 'vendors' | 'packages') {
    this.activeTab.set(tab);
    this.remarks = '';
    this.actionDone.set(null);
    if (tab === 'vendors') {
      this.selectedPackage.set(null);
      
      if (this.selectVendorFromRoute()) {
        return;
      }

      if (this.vendors().length > 0) {
        this.selectVendor(this.vendors()[0]);
      } else {
        this.selectedVendor.set(null);
      }
    } else {
      this.selectedVendor.set(null);
      if (this.pendingPackages().length > 0) {
        this.selectPackage(this.pendingPackages()[0]);
      } else {
        this.selectedPackage.set(null);
      }
    }
  }

  selectVendor(v: Vendor) {
    this.selectedVendor.set(v);
    this.remarks = '';
    this.actionDone.set(null);
  }

  selectPackage(pkg: any) {
    this.selectedPackage.set(pkg);
    this.remarks = '';
    this.actionDone.set(null);
    this.activeImage.set(null);
    this.expandedInclusion.set(null);
  }

  approve(id: string) {
    this.support.verifyVendor(id, 'verified', this.remarks).subscribe({
      next: () => {
        this.actionDone.set('approved');
        if (this.selectedVendor()?.id === id) {
          this.selectedVendor.update(v => v ? { ...v, verificationStatus: 'verified' } : v);
        }
        this.vendors.update(vs => vs.filter(v => v.id !== id));
      },
      error: (err) => console.error('Error approving vendor:', err)
    });
  }

  reject(id: string) {
    if (!this.remarks.trim()) {
      alert('Please provide rejection remarks/comments before rejecting the vendor.');
      return;
    }
    this.support.verifyVendor(id, 'rejected', this.remarks).subscribe({
      next: () => {
        this.actionDone.set('rejected');
        if (this.selectedVendor()?.id === id) {
          this.selectedVendor.update(v => v ? { ...v, verificationStatus: 'rejected' } : v);
        }
        this.vendors.update(vs => vs.map(v => v.id === id ? { ...v, verificationStatus: 'rejected' } : v));
      },
      error: (err) => console.error('Error rejecting vendor:', err)
    });
  }

  requestAction(id: string) {
    if (!this.remarks.trim()) {
      alert('Please provide remarks/comments detailing what action is required from the vendor.');
      return;
    }
    this.support.verifyVendor(id, 'action_required', this.remarks).subscribe({
      next: () => {
        this.actionDone.set('action_required');
        if (this.selectedVendor()?.id === id) {
          this.selectedVendor.update(v => v ? { ...v, verificationStatus: 'action_required' } : v);
        }
        this.vendors.update(vs => vs.map(v => v.id === id ? { ...v, verificationStatus: 'action_required' } : v));
      },
      error: (err) => console.error('Error requesting action from vendor:', err)
    });
  }

  approvePkg(id: string) {
    this.support.verifyPackage(id, 'Approved', this.remarks).subscribe({
      next: () => {
        this.actionDone.set('approved');
        this.loadPendingPackages();
      },
      error: (err) => {
        console.error('Error approving package:', err);
      }
    });
  }

  rejectPkg(id: string) {
    if (!this.remarks.trim()) {
      alert('Please provide rejection remarks/comments before rejecting the service.');
      return;
    }
    this.support.verifyPackage(id, 'Rejected', this.remarks).subscribe({
      next: () => {
        this.actionDone.set('rejected');
        this.loadPendingPackages();
      },
      error: (err) => {
        console.error('Error rejecting package:', err);
      }
    });
  }

  statusColor(s: string): string {
    const m: Record<string, string> = {
      verified: 'ee-badge-success',
      under_review: 'ee-badge-warning',
      pending: 'ee-badge-info',
      action_required: 'ee-badge-warning-orange',
      rejected: 'ee-badge-danger'
    };
    return m[s] || 'ee-badge-primary';
  }

  countByStatus(status: string): number {
    return this.vendors().filter(v => v.verificationStatus === status).length;
  }

  statusLabel(s: string): string {
    const m: Record<string, string> = {
      verified: 'Verified',
      under_review: 'Under Review',
      pending: 'Pending',
      action_required: 'Action Required',
      rejected: 'Rejected'
    };
    return m[s] || s;
  }
}
