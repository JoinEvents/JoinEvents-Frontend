import { Component, Input, Output, EventEmitter, signal, ViewChild, ElementRef, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProfileService } from '../../core/services/profile.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-avatar-cropper',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="avatar-uploader-container">
      <div class="avatar-container" (click)="fileInput.click()" [title]="'Click to upload profile picture'">
        @if (currentAvatar) {
          <img [src]="currentAvatar" alt="Profile avatar" class="profile-avatar-img" />
        } @else {
          <div class="profile-avatar-initials">{{ initials }}</div>
        }
        <div class="avatar-overlay-hover">
          <i class="bi bi-camera-fill"></i>
          <span>Change Photo</span>
        </div>
      </div>
      <input #fileInput type="file" (change)="onFileSelected($event)" accept="image/*" style="display: none;" />

      <!-- Crop Modal Overlay -->
      @if (showCropModal()) {
        <div class="modal-overlay" (click)="$event.stopPropagation()">
          <div class="modal-custom-width cropper-modal-card">
            <div class="cropper-header">
              <h5>Crop Profile Photo</h5>
              <button class="btn-close-custom" (click)="cancelCrop()"><i class="bi bi-x-lg"></i></button>
            </div>
            
            <div class="cropper-body modal-body">
              <div class="crop-viewport-wrapper">
                <div class="crop-viewport"
                     (mousedown)="startDrag($event)"
                     (touchstart)="startDrag($event)">
                  <img #cropImage
                       [src]="imageSrc() || ''"
                       [style.width.px]="imageWidth()"
                       [style.height.px]="imageHeight()"
                       [style.transform]="'translate(' + translateX() + 'px, ' + translateY() + 'px) scale(' + zoom() + ')'"
                       class="crop-image"
                       (load)="onImageLoaded($event)"
                       draggable="false" />
                  <div class="crop-circle-overlay"></div>
                </div>
              </div>

              <div class="cropper-controls">
                <div class="zoom-control">
                  <i class="bi bi-zoom-out"></i>
                  <input type="range" min="1" max="4" step="0.05" [(ngModel)]="zoomValue" (input)="onZoomChange()" />
                  <i class="bi bi-zoom-in"></i>
                </div>
                <p class="crop-instruction">Drag to reposition, use slider to zoom</p>
              </div>
            </div>

            <div class="cropper-footer">
              <button class="btn btn-outline-secondary px-4 border-0" (click)="cancelCrop()" [disabled]="uploading()">Cancel</button>
              <button class="btn btn-primary px-4 bg-primary-ee border-0" (click)="saveCrop()" [disabled]="uploading()">
                @if (uploading()) {
                  <span class="spinner-border spinner-border-sm me-2"></span>Uploading...
                } @else {
                  Save Photo
                }
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .avatar-uploader-container {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .avatar-container {
      width: 140px;
      height: 140px;
      border-radius: 50%;
      position: relative;
      cursor: pointer;
      overflow: hidden;
      border: 4px solid var(--bg-card);
      box-shadow: var(--shadow-lg);
      background: var(--gradient-primary);
      transition: all 0.3s ease;
    }
    .avatar-container:hover {
      transform: scale(1.03);
      box-shadow: var(--shadow-xl);
    }
    .profile-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .profile-avatar-initials {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 2.5rem;
      font-weight: 800;
      font-family: var(--font-heading);
    }
    .avatar-overlay-hover {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.75);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
      opacity: 0;
      transition: opacity 0.25s ease;
      gap: 6px;
    }
    .avatar-container:hover .avatar-overlay-hover {
      opacity: 1;
    }
    .avatar-overlay-hover i {
      font-size: 1.5rem;
    }
    .avatar-overlay-hover span {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    /* Cropper Modal */
    .cropper-modal-card {
      max-width: 450px !important;
    }
    .cropper-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .cropper-header h5 {
      margin: 0;
      font-family: var(--font-heading);
      font-weight: 800;
      color: var(--text-main);
    }
    .cropper-body {
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      background: var(--bg-light);
    }
    .crop-viewport-wrapper {
      width: 260px;
      height: 260px;
      position: relative;
      background: #000;
      border-radius: var(--radius-md);
      box-shadow: inset 0 0 20px rgba(0,0,0,0.5);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .crop-viewport {
      width: 250px;
      height: 250px;
      position: relative;
      cursor: move;
      overflow: hidden;
    }
    .crop-image {
      position: absolute;
      top: 0;
      left: 0;
      transform-origin: 0 0;
      max-width: none !important;
    }
    .crop-circle-overlay {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      box-shadow: 0 0 0 999px rgba(15, 23, 42, 0.6);
      border: 2px dashed rgba(255, 255, 255, 0.7);
      pointer-events: none;
    }
    .cropper-controls {
      width: 100%;
      margin-top: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }
    .zoom-control {
      width: 80%;
      display: flex;
      align-items: center;
      gap: 12px;
      color: var(--text-soft);
    }
    .zoom-control input[type="range"] {
      flex: 1;
      height: 6px;
      border-radius: 3px;
      background: var(--border-color);
      outline: none;
      -webkit-appearance: none;
    }
    .zoom-control input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--primary);
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    }
    .crop-instruction {
      margin: 0;
      font-size: 0.8rem;
      color: var(--text-soft);
      font-weight: 500;
    }
    .cropper-footer {
      padding: 16px 20px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }
  `]
})
export class AvatarCropperComponent {
  private profileService = inject(ProfileService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);

  @Input() currentAvatar: string | undefined = '';
  @Input() initials: string = '';
  @Output() uploadSuccess = new EventEmitter<string>();

  @ViewChild('cropImage') cropImageRef!: ElementRef<HTMLImageElement>;

  showCropModal = signal(false);
  imageSrc = signal<string | null>(null);
  uploading = signal(false);

  // Zoom and Dragging states
  zoom = signal<number>(1.0);
  zoomValue = 1.0;
  private prevZoom = 1.0;
  translateX = signal<number>(0);
  translateY = signal<number>(0);
  imageWidth = signal<number>(0);
  imageHeight = signal<number>(0);

  private dragStartPos = { x: 0, y: 0 };
  private isDragging = false;

  // Image meta
  private imgOriginalWidth = 0;
  private imgOriginalHeight = 0;
  private fittedScale = 1.0;

  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent): void {
    if (this.isDragging) {
      this.drag(event);
    }
  }

  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    if (this.isDragging) {
      this.endDrag();
    }
  }

  @HostListener('document:touchmove', ['$event'])
  onDocumentTouchMove(event: TouchEvent): void {
    if (this.isDragging) {
      this.drag(event);
    }
  }

  @HostListener('document:touchend')
  onDocumentTouchEnd(): void {
    if (this.isDragging) {
      this.endDrag();
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.toast.error('Please select a valid image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const dataUrl = e.target.result;

      const tempImg = new Image();
      tempImg.onload = () => {
        this.imgOriginalWidth = tempImg.naturalWidth;
        this.imgOriginalHeight = tempImg.naturalHeight;

        if (!this.imgOriginalWidth || !this.imgOriginalHeight) {
          this.toast.error('Failed to load image properties.');
          return;
        }

        const minSide = Math.min(this.imgOriginalWidth, this.imgOriginalHeight);
        this.fittedScale = 250 / minSide;

        this.imageSrc.set(dataUrl);
        this.zoom.set(1.0);
        this.zoomValue = 1.0;
        this.prevZoom = 1.0;

        const startX = (250 - this.imgOriginalWidth * this.fittedScale) / 2;
        const startY = (250 - this.imgOriginalHeight * this.fittedScale) / 2;
        
        this.imageWidth.set(this.imgOriginalWidth * this.fittedScale);
        this.imageHeight.set(this.imgOriginalHeight * this.fittedScale);
        this.translateX.set(startX);
        this.translateY.set(startY);
        
        this.showCropModal.set(true);
        document.body.classList.add('modal-open');
        this.boundPosition();
      };
      tempImg.src = dataUrl;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  onImageLoaded(event: Event): void {
    const img = event.target as HTMLImageElement;
    this.imgOriginalWidth = img.naturalWidth;
    this.imgOriginalHeight = img.naturalHeight;

    if (!this.imgOriginalWidth || !this.imgOriginalHeight) return;

    const minSide = Math.min(this.imgOriginalWidth, this.imgOriginalHeight);
    this.fittedScale = 250 / minSide;

    this.imageWidth.set(this.imgOriginalWidth * this.fittedScale);
    this.imageHeight.set(this.imgOriginalHeight * this.fittedScale);

    const startX = (250 - this.imgOriginalWidth * this.fittedScale) / 2;
    const startY = (250 - this.imgOriginalHeight * this.fittedScale) / 2;
    this.translateX.set(startX);
    this.translateY.set(startY);
    this.boundPosition();
  }

  onZoomChange(): void {
    const oldZoom = this.prevZoom;
    const newZoom = this.zoomValue;
    this.prevZoom = newZoom;

    const oldScale = this.fittedScale * oldZoom;
    const newScale = this.fittedScale * newZoom;

    const viewCenterX = 125;
    const viewCenterY = 125;

    const tx = this.translateX();
    const ty = this.translateY();

    const newTx = viewCenterX - ((viewCenterX - tx) / oldScale) * newScale;
    const newTy = viewCenterY - ((viewCenterY - ty) / oldScale) * newScale;

    this.translateX.set(newTx);
    this.translateY.set(newTy);
    this.zoom.set(newZoom);
    this.boundPosition();
  }

  startDrag(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    this.isDragging = true;
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    this.dragStartPos = { x: clientX, y: clientY };
  }

  private drag(event: MouseEvent | TouchEvent): void {
    if (!this.isDragging) return;
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

    const deltaX = clientX - this.dragStartPos.x;
    const deltaY = clientY - this.dragStartPos.y;

    this.translateX.set(this.translateX() + deltaX);
    this.translateY.set(this.translateY() + deltaY);
    this.boundPosition();

    this.dragStartPos = { x: clientX, y: clientY };
  }

  private endDrag(): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.boundPosition();
  }

  private boundPosition(): void {
    const scale = this.fittedScale * this.zoom();
    const w = this.imgOriginalWidth * scale;
    const h = this.imgOriginalHeight * scale;

    let tx = this.translateX();
    let ty = this.translateY();

    if (w >= 250) {
      if (tx > 0) tx = 0;
      if (tx < 250 - w) tx = 250 - w;
    } else {
      tx = (250 - w) / 2;
    }

    if (h >= 250) {
      if (ty > 0) ty = 0;
      if (ty < 250 - h) ty = 250 - h;
    } else {
      ty = (250 - h) / 2;
    }

    this.translateX.set(tx);
    this.translateY.set(ty);
  }

  cancelCrop(): void {
    this.showCropModal.set(false);
    this.imageSrc.set(null);
    this.fittedScale = 1.0;
    this.imgOriginalWidth = 0;
    this.imgOriginalHeight = 0;
    document.body.classList.remove('modal-open');
  }

  saveCrop(): void {
    if (this.uploading()) return;
    this.uploading.set(true);

    const img = this.cropImageRef.nativeElement;
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      this.toast.error('Failed to crop image.');
      this.uploading.set(false);
      return;
    }

    const ratio = 300 / 250;
    const scale = this.fittedScale * this.zoom();

    const destW = this.imgOriginalWidth * scale * ratio;
    const destH = this.imgOriginalHeight * scale * ratio;
    const destX = this.translateX() * ratio;
    const destY = this.translateY() * ratio;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 300, 300);
    ctx.drawImage(img, destX, destY, destW, destH);

    canvas.toBlob((blob) => {
      if (!blob) {
        this.toast.error('Failed to prepare crop blob.');
        this.uploading.set(false);
        return;
      }

      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      this.profileService.uploadAvatar(file).subscribe({
        next: (res) => {
          this.uploading.set(false);
          if (res && res.avatarUrl) {
            this.toast.success('Profile photo updated successfully! 📸');
            
            const cacheBustedUrl = res.avatarUrl + '?t=' + new Date().getTime();
            const currentUser = this.authService.currentUser();
            if (currentUser) {
              const updatedUser = { ...currentUser, avatar: cacheBustedUrl };
              localStorage.setItem('joinevents_user', JSON.stringify(updatedUser));
              this.authService.currentUser.set(updatedUser);
            }

            this.uploadSuccess.emit(cacheBustedUrl);
            this.cancelCrop();
          } else {
            this.toast.error(res?.error || 'Failed to upload photo.');
          }
        },
        error: (err) => {
          this.uploading.set(false);
          this.toast.error('An error occurred during upload.');
          console.error(err);
        }
      });
    }, 'image/jpeg', 0.9);
  }
}
