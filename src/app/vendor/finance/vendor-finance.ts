import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-vendor-finance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vendor-finance.html',
  styleUrl: './vendor-finance.css'
})
export class VendorFinance implements OnInit {
  private toast = inject(ToastService);

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
    { id: 'INV-001', bookingId: 'bk001', customer: 'Rajesh Kumar', date: '2025-10-15', amount: 25000, status: 'paid', downloadUrl: '#' },
    { id: 'INV-002', bookingId: 'bk002', customer: 'Rajesh Kumar', date: '2025-11-20', amount: 12000, status: 'paid', downloadUrl: '#' },
    { id: 'INV-003', bookingId: 'bk004', customer: 'Sunita Patel', date: '2026-04-05', amount: 40000, status: 'pending', downloadUrl: '#' },
  ]);

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
