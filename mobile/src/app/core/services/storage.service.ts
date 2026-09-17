import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Persistent key/value storage.
 *
 * The web app reads and writes `localStorage` synchronously. On a device that
 * is the wrong primitive: a WebView's localStorage can be evicted under
 * storage pressure, and it is not available to native code. Capacitor's
 * Preferences plugin maps onto SharedPreferences (Android) and
 * NSUserDefaults (iOS), which survive eviction and app upgrades.
 *
 * Preferences is asynchronous, so this service also keeps a synchronous
 * in-memory mirror. `hydrate()` fills the mirror once at startup before the
 * first route is resolved, which lets guards and interceptors read the token
 * synchronously exactly as they do on the web.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private cache = new Map<string, string>();
  private hydrated = false;

  /** Keys mirrored into memory at startup. */
  private static readonly MIRRORED_KEYS = [
    'joinevents_user',
    'joinevents_theme',
    'joinevents_favorites',
    'joinevents_city',
    'joinevents_onboarded',
    'joinevents_device_token'
  ];

  async hydrate(): Promise<void> {
    if (this.hydrated) return;
    const entries = await Promise.all(
      StorageService.MIRRORED_KEYS.map(async key => {
        const { value } = await Preferences.get({ key });
        return [key, value] as const;
      })
    );
    for (const [key, value] of entries) {
      if (value !== null) this.cache.set(key, value);
    }
    this.hydrated = true;
  }

  /** Synchronous read from the in-memory mirror. */
  get(key: string): string | null {
    return this.cache.get(key) ?? null;
  }

  getObject<T>(key: string): T | null {
    const raw = this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  /** Writes the mirror immediately and persists in the background. */
  set(key: string, value: string): void {
    this.cache.set(key, value);
    void Preferences.set({ key, value });
  }

  setObject(key: string, value: unknown): void {
    this.set(key, JSON.stringify(value));
  }

  remove(key: string): void {
    this.cache.delete(key);
    void Preferences.remove({ key });
  }

  async clear(): Promise<void> {
    this.cache.clear();
    await Preferences.clear();
  }
}
