import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../core/services/toast.service';
import { CommissionService } from '../../core/services/commission.service';
import { PlatformFeeBreakdown } from '../../core/models/commission.model';

@Component({
  selector: 'app-vendor-finance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vendor-finance.html',
  styleUrl: './vendor-finance.css'
})
export class VendorFinance implements OnInit {
  private toast = inject(ToastService);
  private commissionService = inject(CommissionService);

  isSaving = signal(false);
  isEditing = signal(false);
  activeTab = signal<'payout' | 'history'>('payout');
  
  bankingInfo = {
    businessName: 'Spice Garden Catering',
    businessAddress: 'Plot 45, Jubilee Hills, Hyderabad, 500033',
    gstNumber: '36AABCU9603R1ZX',
    mobileNumber: '+91 91234 56789',
    accountHolder: 'Amit Sharma',
    bankName: 'HDFC Bank',
    branchName: 'Madhapur',
    accountNumber: '501004523689',
    ifscCode: 'HDFC0001234',
    upiId: 'amit.spicegarden@okhdfc'
  };

  invoices = signal([
    { id: 'INV-001', bookingId: 'bk001', customer: 'Rajesh Kumar', date: '2025-10-15', grossAmount: 25000, platformFee: 2000, tds: 250, netPayout: 22750, status: 'paid', downloadUrl: '#' },
    { id: 'INV-002', bookingId: 'bk002', customer: 'Rajesh Kumar', date: '2025-11-20', grossAmount: 12000, platformFee: 960, tds: 120, netPayout: 10920, status: 'paid', downloadUrl: '#' },
    { id: 'INV-003', bookingId: 'bk004', customer: 'Sunita Patel', date: '2026-04-05', grossAmount: 40000, platformFee: 3200, tds: 400, netPayout: 36400, status: 'pending', downloadUrl: '#' },
  ]);

  totalPlatformFees = signal(6160);
  totalTdsDeducted = signal(770);

  ngOnInit() {
    // Initial data loading if needed
  }

  saveBankingDetails() {
    this.isSaving.set(true);
    setTimeout(() => {
      this.isSaving.set(false);
      this.isEditing.set(false);
      this.toast.success('Banking details updated successfully!');
    }, 1500);
  }
}
