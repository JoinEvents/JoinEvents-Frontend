import { inject, Injectable, signal } from '@angular/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { StorageService } from './storage.service';

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_KEY = 'joinevents_theme';

/**
 * Light/dark theming with the same three-way choice as the web app, plus the
 * native status bar tint — without it the status bar text stays black on the
 * dark background and becomes unreadable.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private storage = inject(StorageService);
  private media = window.matchMedia('(prefers-color-scheme: dark)');

  readonly mode = signal<ThemeMode>('system');
  readonly isDark = signal(false);

  init(): void {
    const stored = this.storage.get(THEME_KEY) as ThemeMode | null;
    this.mode.set(stored ?? 'system');
    this.apply();
    this.media.addEventListener('change', () => {
      if (this.mode() === 'system') this.apply();
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    this.storage.set(THEME_KEY, mode);
    this.apply();
  }

  toggle(): void {
    this.setMode(this.isDark() ? 'light' : 'dark');
  }

  private apply(): void {
    const dark = this.mode() === 'system' ? this.media.matches : this.mode() === 'dark';
    this.isDark.set(dark);
    document.documentElement.classList.toggle('je-dark', dark);
    document.documentElement.classList.toggle('ion-palette-dark', dark);

    if (!Capacitor.isNativePlatform()) return;
    void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => void 0);
    if (Capacitor.getPlatform() === 'android') {
      void StatusBar.setBackgroundColor({ color: dark ? '#0F172A' : '#FFFFFF' }).catch(() => void 0);
    }
  }
}
