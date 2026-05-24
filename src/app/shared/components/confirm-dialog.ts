import { Component, inject, signal, Injectable, effect } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'primary' | 'danger' | 'warning';
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  options = signal<ConfirmOptions | null>(null);
  private resolveCallback: ((value: boolean) => void) | null = null;

  ask(opts: ConfirmOptions): Promise<boolean> {
    this.options.set({ type: 'primary', ...opts });
    return new Promise((resolve) => {
      this.resolveCallback = resolve;
    });
  }

  resolve(value: boolean) {
    if (this.resolveCallback) {
      this.resolveCallback(value);
      this.resolveCallback = null;
      this.options.set(null);
    }
  }
}

@Component({
  selector: 'app-global-confirm',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (options()) {
    <div class="confirm-overlay">
      <div class="confirm-modal slide-in-bottom">
        <div class="confirm-icon" [class]="options()?.type">
          <i class="bi" [class.bi-question-circle]="options()?.type !== 'danger'" [class.bi-exclamation-triangle]="options()?.type === 'danger'"></i>
        </div>
        <h4 class="confirm-title">{{ options()?.title || 'Are you sure?' }}</h4>
        <p class="confirm-message">{{ options()?.message }}</p>
        <div class="confirm-actions">
          <button class="btn-cancel" (click)="cancel()">{{ options()?.cancelText || 'Cancel' }}</button>
          <button class="btn-confirm" [class]="options()?.type" (click)="confirm()">{{ options()?.confirmText || 'Confirm' }}</button>
        </div>
      </div>
    </div>
    }
  `,
  styles: [`
    .confirm-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999; animation: fadeIn 0.3s ease;
    }
    .confirm-modal {
      width: 90%; max-width: 400px;
      background: var(--bg-card); border-radius: 32px;
      padding: 40px; text-align: center;
      box-shadow: var(--shadow-xl); border: 1px solid var(--border-color);
    }
    .confirm-icon {
      width: 70px; height: 70px; border-radius: 24px;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 24px; font-size: 2rem;
    }
    .confirm-icon.primary { background: rgba(255,107,53,0.1); color: var(--primary); }
    .confirm-icon.danger { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
    .confirm-icon.warning { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }

    .confirm-title { font-weight: 900; color: var(--text-main); margin-bottom: 12px; font-family: var(--font-heading); }
    .confirm-message { color: var(--text-soft); font-size: 0.95rem; margin-bottom: 32px; line-height: 1.5; }
    
    .confirm-actions { display: flex; gap: 12px; }
    .confirm-actions button {
      flex: 1; padding: 14px; border-radius: 16px; font-weight: 800;
      transition: all 0.2s; border: none;
    }
    .btn-cancel { background: var(--bg-light); color: var(--text-main); }
    .btn-cancel:hover { background: var(--border-color); }
    
    .btn-confirm.primary { background: var(--gradient-primary); color: white; }
    .btn-confirm.danger { background: #ef4444; color: white; }
    .btn-confirm.warning { background: #f59e0b; color: white; }
    .btn-confirm:hover { transform: translateY(-2px); filter: brightness(1.1); }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideInBottom { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  `]
})
export class GlobalConfirmComponent {
  confirmService = inject(ConfirmService);
  options = this.confirmService.options;

  constructor() {
    effect(() => {
      document.body.classList.toggle('modal-open', !!this.options());
    });
  }

  confirm() { this.confirmService.resolve(true); }
  cancel() { this.confirmService.resolve(false); }
}
