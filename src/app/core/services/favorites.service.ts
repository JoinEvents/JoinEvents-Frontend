import { Injectable, signal } from '@angular/core';

export interface FavoriteItem {
  id: string;
  name: string;
  type: 'package' | 'event' | 'vendor' | 'service';
  subtitle?: string;
  imageUrl?: string;
  routeUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FavoritesService {
  private STORAGE_KEY = 'joinevents_favorites';
  
  favorites = signal<FavoriteItem[]>([]);

  constructor() {
    this.loadFavorites();
  }

  private loadFavorites() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.favorites.set(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load favorites from localStorage', e);
    }
  }

  private saveFavorites(items: FavoriteItem[]) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save favorites to localStorage', e);
    }
  }

  toggleFavorite(item: FavoriteItem) {
    const current = this.favorites();
    const existsIndex = current.findIndex(fav => fav.id === item.id);
    
    let updated: FavoriteItem[];
    if (existsIndex > -1) {
      updated = current.filter(fav => fav.id !== item.id);
    } else {
      updated = [...current, item];
    }
    
    this.favorites.set(updated);
    this.saveFavorites(updated);
  }

  removeFavorite(id: string) {
    const updated = this.favorites().filter(fav => fav.id !== id);
    this.favorites.set(updated);
    this.saveFavorites(updated);
  }

  isFavorite(id: string): boolean {
    return this.favorites().some(fav => fav.id === id);
  }
}
