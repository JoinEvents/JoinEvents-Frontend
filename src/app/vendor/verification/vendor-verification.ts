import { Component, signal, OnInit, inject } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { VendorService } from '../../core/services/vendor.service';
import { ToastService } from '../../core/services/toast.service';

@Component({ selector: 'app-vendor-verification', imports: [TitleCasePipe], templateUrl: './vendor-verification.html', styleUrl: './vendor-verification.css' })
export class VendorVerification implements OnInit {
  private api = inject(VendorService);
  private toast = inject(ToastService);

  steps = signal<any[]>([]);
  docs = signal<any[]>([]);
  isVerified = signal(false);
  status = signal<string>('pending');
  remarks = signal<string | null>(null);

  showUploadModal = signal(false);
  selectedFile = signal<File | null>(null);
  selectedDocType = signal<string>('GST Certificate');
  customDocType = signal<string>('');
  docTypeOptions = ['GST Certificate', 'FSSAI License', 'Bank Details', 'Business Registration'];

  ngOnInit() {
    this.loadStatus();
  }

  loadStatus() {
    this.api.getVerificationStatus().subscribe(res => {
      this.steps.set(res.steps);
      this.docs.set(res.docs);
      this.isVerified.set(res.isVerified);
      this.status.set(res.status || 'pending');
      this.remarks.set(res.remarks || null);
    });
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      this.selectedFile.set(file);
      this.selectedDocType.set('GST Certificate');
      this.customDocType.set('');
      this.showUploadModal.set(true);
      event.target.value = '';
    }
  }

  isValidDocType(): boolean {
    if (this.selectedDocType() === 'Other') {
      return this.customDocType().trim().length > 0;
    }
    return true;
  }

  onCustomDocTypeInput(event: any) {
    this.customDocType.set(event.target.value || '');
  }

  closeUploadModal() {
    this.showUploadModal.set(false);
    this.selectedFile.set(null);
  }

  confirmUpload() {
    const file = this.selectedFile();
    const docType = this.selectedDocType() === 'Other' ? this.customDocType() : this.selectedDocType();

    if (file && docType) {
      this.api.uploadVerificationDocument(file, docType).subscribe({
        next: (res) => {
          this.toast.success('Document uploaded successfully!');
          this.closeUploadModal();
          this.loadStatus();
        },
        error: (err) => {
          this.toast.error('Failed to upload document.');
        }
      });
    }
  }
}
