import { Component, inject, signal } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon, IonButton, IonSpinner
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';

import { VendorService } from '../../core/services/vendor.service';
import { ToastService } from '../../core/services/toast.service';

interface DocumentSlot {
  type: string;
  label: string;
  detail: string;
  icon: string;
}

const REQUIRED_DOCUMENTS: DocumentSlot[] = [
  { type: 'gst', label: 'GST certificate', detail: 'Required if your turnover crosses the GST threshold', icon: 'receipt-outline' },
  { type: 'pan', label: 'PAN card', detail: 'Used for TDS and payouts', icon: 'card-outline' },
  { type: 'business_proof', label: 'Business registration', detail: 'Shop licence, incorporation or Udyam certificate', icon: 'business-outline' },
  { type: 'address_proof', label: 'Address proof', detail: 'Utility bill or rent agreement for your premises', icon: 'home-outline' },
  { type: 'bank', label: 'Cancelled cheque', detail: 'So payouts reach the right account', icon: 'wallet-outline' }
];

/**
 * KYC upload. Documents are photographed in place rather than picked from a
 * file system — a vendor with a paper GST certificate can complete this
 * without a scanner.
 */
@Component({
  selector: 'app-vendor-verification',
  standalone: true,
  imports: [
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon, IonButton, IonSpinner
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/vendor/tabs/more" text="" />
        </ion-buttons>
        <ion-title>Verification</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="je-section">
        <!-- Overall status ------------------------------------------- -->
        <div class="je-card status" [class]="'status--' + overallStatus()">
          <ion-icon [name]="statusIcon()" />
          <div class="status__body">
            <strong>{{ statusTitle() }}</strong>
            <p class="je-sm">{{ statusMessage() }}</p>
          </div>
        </div>

        <div class="je-section-head"><h2>Documents</h2></div>
        @for (doc of documents; track doc.type) {
          <div class="je-card doc">
            <span class="doc__icon" [class.doc__icon--done]="stateOf(doc.type) === 'approved'">
              <ion-icon [name]="stateOf(doc.type) === 'approved' ? 'checkmark' : doc.icon" />
            </span>

            <div class="doc__body">
              <strong class="je-sm">{{ doc.label }}</strong>
              <span class="je-xs je-muted">{{ doc.detail }}</span>
              @if (stateOf(doc.type) === 'rejected' && remarkOf(doc.type); as remark) {
                <span class="je-xs reject">{{ remark }}</span>
              }
            </div>

            <div class="doc__action">
              @if (uploading() === doc.type) {
                <ion-spinner name="crescent" />
              } @else if (stateOf(doc.type) === 'approved') {
                <span class="je-pill je-pill--confirmed">Verified</span>
              } @else if (stateOf(doc.type) === 'pending') {
                <span class="je-pill je-pill--pending">In review</span>
              } @else {
                <ion-button size="small" fill="outline" (click)="upload(doc)">
                  {{ stateOf(doc.type) === 'rejected' ? 'Re-upload' : 'Upload' }}
                </ion-button>
              }
            </div>
          </div>
        }

        <p class="je-xs je-soft note">
          Documents are reviewed by the JoinEvents support team, normally within two working days.
          You will be notified as soon as each one is checked.
        </p>
      </div>
    </ion-content>
  `,
  styles: [`
    .status { display: flex; gap: 14px; align-items: flex-start; margin-top: 6px; }
    .status > ion-icon { font-size: 28px; flex-shrink: 0; }
    .status__body { flex: 1; }
    .status__body strong { display: block; font-family: var(--je-font-heading);
                           font-size: var(--je-fs-md); margin-bottom: 4px; }
    .status__body p { margin: 0; color: var(--je-text-muted); line-height: 1.55; }
    .status--verified { border-color: rgba(22,163,74,0.3); background: rgba(22,163,74,0.06); }
    .status--verified > ion-icon { color: var(--je-success); }
    .status--pending, .status--under_review { border-color: rgba(217,119,6,0.3); background: rgba(217,119,6,0.06); }
    .status--pending > ion-icon, .status--under_review > ion-icon { color: var(--je-warning); }
    .status--rejected { border-color: rgba(220,38,38,0.3); background: rgba(220,38,38,0.06); }
    .status--rejected > ion-icon { color: var(--je-danger); }

    .doc { display: flex; align-items: center; gap: 13px; }
    .doc__icon { width: 40px; height: 40px; flex-shrink: 0; display: grid; place-items: center;
                 border-radius: var(--je-radius-sm); background: var(--je-bg-light);
                 color: var(--je-text-muted); }
    .doc__icon--done { background: rgba(22,163,74,0.14); color: var(--je-success); }
    .doc__icon ion-icon { font-size: 18px; }
    .doc__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .doc__action { flex-shrink: 0; }
    .reject { color: var(--je-danger); }
    .note { margin-top: 16px; line-height: 1.6; padding-bottom: 20px; }
  `]
})
export class VendorVerificationPage implements ViewWillEnter {
  private vendorService = inject(VendorService);
  private toast = inject(ToastService);

  readonly documents = REQUIRED_DOCUMENTS;
  readonly uploading = signal<string | null>(null);
  readonly status = signal<Record<string, unknown> | null>(null);

  ionViewWillEnter(): void {
    this.load();
  }

  private load(): void {
    this.vendorService.getVerificationStatus().subscribe(status => this.status.set(status));
  }

  overallStatus(): string {
    return String(this.status()?.['status'] ?? 'pending');
  }

  /** Per-document state, defaulting to "not uploaded" when the API says nothing. */
  stateOf(type: string): 'missing' | 'pending' | 'approved' | 'rejected' {
    const docs = (this.status()?.['documents'] as Record<string, unknown>[]) ?? [];
    const record = docs.find(d => d['documentType'] === type || d['type'] === type);
    if (!record) return 'missing';
    const state = String(record['status'] ?? 'pending').toLowerCase();
    if (state === 'approved' || state === 'verified') return 'approved';
    if (state === 'rejected') return 'rejected';
    return 'pending';
  }

  remarkOf(type: string): string | null {
    const docs = (this.status()?.['documents'] as Record<string, unknown>[]) ?? [];
    const record = docs.find(d => d['documentType'] === type || d['type'] === type);
    return (record?.['remarks'] as string) ?? null;
  }

  statusIcon(): string {
    switch (this.overallStatus()) {
      case 'verified': return 'shield-checkmark';
      case 'rejected': return 'close-circle';
      default: return 'hourglass';
    }
  }

  statusTitle(): string {
    switch (this.overallStatus()) {
      case 'verified': return "You're verified";
      case 'under_review': return 'Under review';
      case 'rejected': return 'Action needed';
      default: return 'Verification pending';
    }
  }

  statusMessage(): string {
    switch (this.overallStatus()) {
      case 'verified': return 'Your listings rank higher and you can accept bookings without limits.';
      case 'under_review': return 'Our team is checking your documents. This usually takes two working days.';
      case 'rejected': return 'One or more documents were not accepted. Re-upload them below.';
      default: return 'Upload the documents below so customers know you are a verified business.';
    }
  }

  async upload(doc: DocumentSlot): Promise<void> {
    try {
      const photo = await Camera.getPhoto({
        quality: 85,
        width: 2000,
        resultType: CameraResultType.Base64,
        source: CameraSource.Prompt,
        promptLabelHeader: doc.label,
        promptLabelPhoto: 'Choose a file',
        promptLabelPicture: 'Photograph the document'
      });
      if (!photo.base64String) return;

      this.uploading.set(doc.type);
      const format = photo.format || 'jpeg';
      const blob = this.base64ToBlob(photo.base64String, `image/${format}`);

      this.vendorService.uploadVerificationDocument(blob, `${doc.type}.${format}`, doc.type).subscribe(success => {
        this.uploading.set(null);
        if (!success) {
          void this.toast.error('Upload failed. Please try again.');
          return;
        }
        void this.toast.success(`${doc.label} uploaded for review.`);
        this.load();
      });
    } catch {
      this.uploading.set(null);
    }
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    const bytes = atob(base64);
    const buffer = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
    return new Blob([buffer], { type: mimeType });
  }
}
