import { computed, inject, Injectable, signal } from '@angular/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StorageService } from './storage.service';

export interface FavoriteItem {
  id: string;
  name: string;
  image?: string;
  price?: number;
  vendorName?: string;
  routeUrl: string;
  savedAt: string;
}

const KEY = 'joinevents_favorites';

/**
 * Saved packages. Kept on the device rather than the server because the web
 * app does the same, so the two stay behaviourally identical; moving it behind
 * an endpoint later would sync across devices.
 */
@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private storage = inject(StorageService);

  readonly items = signal<FavoriteItem[]>([]);
  readonly count = computed(() => this.items().length);

  init(): void {
    this.items.set(this.storage.getObject<FavoriteItem[]>(KEY) ?? []);
  }

  isFavorite(id: string): boolean {
    return this.items().some(f => f.id === id);
  }

  /** Returns the resulting state so callers can phrase their confirmation. */
  toggle(item: Omit<FavoriteItem, 'savedAt'>): boolean {
    const exists = this.isFavorite(item.id);
    const next = exists
      ? this.items().filter(f => f.id !== item.id)
      : [{ ...item, savedAt: new Date().toISOString() }, ...this.items()];

    this.items.set(next);
    this.storage.setObject(KEY, next);
    void Haptics.impact({ style: ImpactStyle.Light }).catch(() => void 0);
    return !exists;
  }

  remove(id: string): void {
    const next = this.items().filter(f => f.id !== id);
    this.items.set(next);
    this.storage.setObject(KEY, next);
  }

  clear(): void {
    this.items.set([]);
    this.storage.remove(KEY);
  }
}
