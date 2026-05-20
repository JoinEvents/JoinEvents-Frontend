import { Component, signal, OnInit, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EventCategoryService } from '../../core/services/event-category.service';
import { EventType } from '../../core/models/event.model';

import { FavoritesService } from '../../core/services/favorites.service';

@Component({
  selector: 'app-customer-events',
  imports: [RouterLink, FormsModule],
  templateUrl: './events.html',
  styleUrl: './events.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerEvents implements OnInit {
  private api = inject(EventCategoryService);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  public favoritesService = inject(FavoritesService);
  events = signal<EventType[]>([]);
  filtered = signal<EventType[]>([]);
  search = '';
  selectedCategory = 'all';

  readonly categories = [
    { id: 'all', label: 'All Services' },
    { id: 'wedding', label: '💍 Weddings' },
    { id: 'birthday', label: '🎂 Birthdays' },
    { id: 'corporate', label: '💼 Corporate' },
    { id: 'beauty', label: '💄 Beauty' },
    { id: 'travel', label: '🚗 Travel' },
    { id: 'shopping', label: '🎁 Shopping' },
  ];

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['category']) {
        this.selectedCategory = params['category'];
      }
      if (this.events().length > 0) {
        this.filterEvents();
        this.cdr.markForCheck();
      }
    });

    this.api.getAll().subscribe(e => {
      this.events.set(e);
      this.filterEvents();
      this.cdr.markForCheck();
    });
  }

  filterEvents() {
    let result = this.events();
    if (this.selectedCategory !== 'all') result = result.filter(e => e.category === this.selectedCategory);
    if (this.search.trim()) result = result.filter(e => e.name.toLowerCase().includes(this.search.toLowerCase()));
    this.filtered.set(result);
  }

  isFavorite(id: string): boolean {
    return this.favoritesService.isFavorite(id);
  }

  toggleFavorite(event: Event, et: any) {
    event.stopPropagation();
    event.preventDefault();
    this.favoritesService.toggleFavorite({
      id: et.id,
      name: et.name,
      type: 'event',
      subtitle: `${et.category} • from ₹${((et.startingPrice || 0) / 1000)}k`,
      routeUrl: `/vendors/${et.id}`
    });
  }
}
