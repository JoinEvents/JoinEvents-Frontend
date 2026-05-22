import { Component, signal, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe, DecimalPipe } from '@angular/common';
import { MockApiService } from '../../core/services/mock-api.service';
import { PackageService } from '../../core/services/package.service';
import { Vendor } from '../../core/models/vendor.model';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-admin-verifications',
  standalone: true,
  imports: [FormsModule, TitleCasePipe, DecimalPipe],
  templateUrl: './admin-verifications.html',
  styleUrl: './admin-verifications.css'
})
export class AdminVerifications implements OnInit {
  private api = inject(MockApiService);
  private packageService = inject(PackageService);
  private route = inject(ActivatedRoute);

  activeTab = signal<'vendors' | 'packages'>('vendors');

  // Vendor profiles verifications
  vendors = signal<Vendor[]>([]);
  selectedVendor = signal<Vendor | null>(null);

  // Packages verifications
  pendingPackages = signal<any[]>([]);
  selectedPackage = signal<any | null>(null);

  remarks = '';
  actionDone = signal<string | null>(null);

  ngOnInit() {
    this.loadVendors();
    this.loadPendingPackages();
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'packages') {
        this.setTab('packages');
      }
    });
  }

  loadVendors() {
    this.api.getVendors().subscribe(v => {
      this.vendors.set(v.filter(x => x.verificationStatus !== 'verified'));
      if (this.activeTab() === 'vendors' && this.vendors().length > 0 && !this.selectedVendor()) {
        this.selectVendor(this.vendors()[0]);
      }
    });
  }

  loadPendingPackages() {
    this.packageService.getPendingPackages().subscribe(packages => {
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
  }

  approve(id: string) {
    this.actionDone.set('approved');
    if (this.selectedVendor()?.id === id) {
      this.selectedVendor.update(v => v ? { ...v, verificationStatus: 'verified' } : v);
    }
    this.vendors.update(vs => vs.filter(v => v.id !== id));
  }

  reject(id: string) {
    this.vendors.update(vs => vs.map(v => v.id === id ? { ...v, verificationStatus: 'rejected' } : v));
    this.actionDone.set('rejected');
    if (this.selectedVendor()?.id === id) {
      this.selectedVendor.update(v => v ? { ...v, verificationStatus: 'rejected' } : v);
    }
  }

  approvePkg(id: string) {
    this.packageService.verifyPackage(id, 'Approved', this.remarks).subscribe({
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
    this.packageService.verifyPackage(id, 'Rejected', this.remarks).subscribe({
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
      rejected: 'ee-badge-danger'
    };
    return m[s] || 'ee-badge-primary';
  }

  statusLabel(s: string): string {
    const m: Record<string, string> = {
      verified: 'Verified',
      under_review: 'Under Review',
      pending: 'Pending',
      rejected: 'Rejected'
    };
    return m[s] || s;
  }
}
