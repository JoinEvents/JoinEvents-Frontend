import { Component, inject, input, model, output, signal } from '@angular/core';
import { IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { CameraResultType, CameraSource } from '@capacitor/camera';

import { MediaService } from '../../../core/services/media.service';
import { ToastService } from '../../../core/services/toast.service';
import { cropToLandscape, pickPhoto } from '../../../core/utils/camera.util';

/**
 * Photos for a package or one of its services. Each pick is framed 4:3 (as
 * the web cropper does) and uploaded straight away, so the form only ever
 * holds permanent URLs — the same thing the web console saves.
 */
@Component({
  selector: 'app-photo-grid',
  standalone: true,
  imports: [IonIcon, IonSpinner],
  template: `
    <div class="grid">
      @for (url of photos(); track url; let i = $index) {
        <div class="photo">
          <img [src]="url" alt="" loading="lazy" />
          @if (i === 0 && coverLabel()) { <span class="cover">{{ coverLabel() }}</span> }
          <button type="button" class="photo__x" (click)="remove(i)" aria-label="Remove photo">
            <ion-icon name="close" />
          </button>
        </div>
      }
      @if (uploading()) {
        <div class="photo photo--busy"><ion-spinner name="crescent" /></div>
      } @else if (photos().length < max()) {
        <button type="button" class="photo photo--add" (click)="add()">
          <ion-icon name="camera-outline" />
          <span class="je-xs">Add</span>
        </button>
      }
    </div>
    <p class="je-xs je-soft count">{{ photos().length }} / {{ max() }} photos</p>
  `,
  styles: [`
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .photo { position: relative; aspect-ratio: 4 / 3; border-radius: var(--je-radius-sm); overflow: hidden; }
    .photo img { width: 100%; height: 100%; object-fit: cover; }
    .photo__x { position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; border: none;
                border-radius: 50%; background: rgba(0,0,0,0.6); color: #fff; display: grid; place-items: center; }
    .cover { position: absolute; left: 4px; bottom: 4px; padding: 1px 6px; border-radius: 6px;
             background: rgba(0,0,0,0.6); color: #fff; font-size: 10px; font-weight: 700; }
    .photo--add, .photo--busy { display: flex; flex-direction: column; align-items: center; justify-content: center;
                  gap: 4px; background: var(--je-bg-light); border: 1px dashed var(--je-border-color);
                  color: var(--je-text-muted); }
    .photo--add ion-icon { font-size: 22px; }
    .count { margin: 6px 2px 0; }
  `]
})
export class PhotoGridComponent {
  private media = inject(MediaService);
  private toast = inject(ToastService);

  readonly photos = model<string[]>([]);
  readonly max = input(5);
  readonly coverLabel = input('');
  /** Lets the form hold Next/Save while an upload is in flight. */
  readonly busy = output<boolean>();

  readonly uploading = signal(false);

  async add(): Promise<void> {
    if (this.photos().length >= this.max()) return;
    let photo;
    try {
      photo = await pickPhoto({
        quality: 85,
        width: 1600,
        resultType: CameraResultType.Base64,
        source: CameraSource.Prompt,
        promptLabelHeader: 'Add photo',
        promptLabelPhoto: 'Choose from gallery',
        promptLabelPicture: 'Take a photo'
      });
    } catch (error) {
      void this.toast.error((error as Error).message);
      return;
    }
    if (!photo?.base64String) return;

    this.setBusy(true);
    const blob = await cropToLandscape(photo.base64String, `image/${photo.format || 'jpeg'}`);
    if (!blob) {
      this.setBusy(false);
      void this.toast.error('That photo could not be read. Try another one.');
      return;
    }
    this.media.uploadImage(blob, `photo-${Date.now()}.jpg`).subscribe(result => {
      this.setBusy(false);
      if (result.error || !result.url) {
        void this.toast.error(result.error ?? 'The photo could not be uploaded.');
        return;
      }
      if (this.photos().length < this.max()) this.photos.set([...this.photos(), result.url]);
    });
  }

  remove(index: number): void {
    this.photos.set(this.photos().filter((_, i) => i !== index));
  }

  private setBusy(value: boolean): void {
    this.uploading.set(value);
    this.busy.emit(value);
  }
}
