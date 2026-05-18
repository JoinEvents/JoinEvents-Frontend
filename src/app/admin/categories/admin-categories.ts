import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminCategoryService,
  EventCategory,
  CreateCategoryRequest
} from '../../core/services/admin-category.service';

@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-categories.html',
  styleUrl: './admin-categories.css'
})
export class AdminCategories implements OnInit {
  private svc = inject(AdminCategoryService);

  categories   = signal<EventCategory[]>([]);
  isModalOpen  = signal(false);
  editing      = signal<EventCategory | null>(null);
  isSubmitting = signal(false);
  isLoading    = signal(false);
  error        = signal<string | null>(null);

  autoSlug = signal('');
  formData: CreateCategoryRequest = this.blankForm();

  searchQuery = signal('');
  statusFilter = signal('all'); // 'all', 'active', 'inactive'

  filteredCategories = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    return this.categories().filter(cat => {
      // Filter by status
      if (status === 'active' && cat.isActive === false) return false;
      if (status === 'inactive' && cat.isActive !== false) return false;
      
      // Filter by search query
      if (!query) return true;
      return (
        cat.name.toLowerCase().includes(query) ||
        (cat.nameHindi && cat.nameHindi.toLowerCase().includes(query)) ||
        (cat.description && cat.description.toLowerCase().includes(query)) ||
        cat.categoryKey.toLowerCase().includes(query)
      );
    });
  });

  ngOnInit() { this.loadCategories(); }

  // ── DATA ─────────────────────────────────────────────────────────────────

  loadCategories() {
    this.isLoading.set(true);
    this.error.set(null);
    this.svc.getAll().subscribe({
      next: data => { this.categories.set(data); this.isLoading.set(false); },
      error: err  => {
        const status = err?.status;
        if (status === 401 || status === 403) {
          this.error.set('Session expired or insufficient permissions. Please log in again as Admin.');
        } else {
          this.error.set(err?.error?.message || 'Failed to load categories. Please try again.');
        }
        this.isLoading.set(false);
      }
    });
  }

  // ── MODAL ─────────────────────────────────────────────────────────────────

  openAddModal() {
    this.editing.set(null);
    this.formData = this.blankForm();
    this.autoSlug.set('');
    this.syncPickerFromGradient(this.formData.gradient ?? '');
    this.isModalOpen.set(true);
  }

  openEditModal(cat: EventCategory) {
    this.editing.set(cat);
    this.formData = {
      name:            cat.name,
      nameHindi:       cat.nameHindi ?? '',
      categoryKey:     cat.categoryKey,
      icon:            cat.icon,
      gradient:        cat.gradient        ?? 'linear-gradient(135deg,#6B7280,#374151)',
      colorClass:      cat.colorClass      ?? 'event-custom',
      startingPrice:   cat.startingPrice   ?? 0,
      description:     cat.description     ?? '',
      popularServices: [...(cat.popularServices ?? [])],
      isActive:        cat.isActive        ?? true
    };
    this.autoSlug.set(cat.categoryKey);
    this.syncPickerFromGradient(this.formData.gradient ?? '');
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.editing.set(null);
  }

  // ── SLUG ─────────────────────────────────────────────────────────────────

  onNameInput(name: string) {
    const slug = AdminCategoryService.toSlug(name);
    this.autoSlug.set(slug);
    this.formData.categoryKey = slug;
  }

  // ── SAVE / DELETE ─────────────────────────────────────────────────────────

  saveCategory() {
    this.isSubmitting.set(true);
    this.error.set(null);
    const id = this.editing()?.id;
    const op$ = id ? this.svc.update(id, this.formData) : this.svc.create(this.formData);
    op$.subscribe({
      next: (res) => { 
        if (id) {
          this.categories.update(arr => arr.map(c => c.id === id ? res : c));
        } else {
          this.categories.update(arr => [...arr, res]);
        }
        this.closeModal(); 
        this.isSubmitting.set(false); 
      },
      error: err => {
        const status = err?.status;
        if (status === 401 || status === 403) {
          this.error.set('Session expired or insufficient permissions. Please log in again as Admin.');
        } else {
          this.error.set(err?.error?.message || 'Save failed.');
        }
        this.isSubmitting.set(false);
      }
    });
  }

  deleteCategory(cat: EventCategory) {
    if (!confirm(`Delete "${cat.name}"? Vendors listing under this category may be affected.`)) return;
    this.svc.delete(cat.id).subscribe({
      next: () => {
        this.categories.update(arr => arr.filter(c => c.id !== cat.id));
      },
      error: err => {
        const status = err?.status;
        if (status === 401 || status === 403) {
          this.error.set('Session expired or insufficient permissions. Please log in again as Admin.');
        } else {
          this.error.set(err?.error?.message || 'Delete failed.');
        }
      }
    });
  }

  toggleCategoryActive(cat: EventCategory, isActive: boolean) {
    this.svc.toggleActive(cat.id, isActive).subscribe({
      next: (res) => {
        this.categories.update(arr => arr.map(c => c.id === cat.id ? res : c));
      },
      error: err => {
        this.error.set('Failed to toggle active state.');
        this.loadCategories();
      }
    });
  }

  // ── POPULAR SERVICES ─────────────────────────────────────────────────────

  onPopularServicesChange(value: string) {
    this.formData.popularServices = value.split(',').map(s => s.trim()).filter(Boolean);
  }

  get popularServicesString(): string {
    return (this.formData.popularServices ?? []).join(', ');
  }

  // ── GRADIENT PICKER ───────────────────────────────────────────────────────

  /** 18 named presets inspired by uigradients.com */
  readonly gradientPresets = [
    { name: 'Wedding Pink',   gradient: 'linear-gradient(135deg,#E91E8C,#FF6B6B)' },
    { name: 'Summer Dog',     gradient: 'linear-gradient(135deg,#a8ff78,#78ffd6)' },
    { name: 'Cosmic Fusion',  gradient: 'linear-gradient(135deg,#ff00cc,#333399)' },
    { name: 'Mango Pulp',     gradient: 'linear-gradient(135deg,#f09819,#edde5d)' },
    { name: 'Ocean Blue',     gradient: 'linear-gradient(135deg,#0EA5E9,#6B21A8)' },
    { name: 'Fresh Mint',     gradient: 'linear-gradient(135deg,#10B981,#059669)' },
    { name: 'Burning Orange', gradient: 'linear-gradient(135deg,#FF6B35,#F59E0B)' },
    { name: 'Purple Haze',    gradient: 'linear-gradient(135deg,#EC4899,#D946EF)' },
    { name: 'Royal Gold',     gradient: 'linear-gradient(135deg,#F59E0B,#D97706)' },
    { name: 'Steel Blue',     gradient: 'linear-gradient(135deg,#4facfe,#00f2fe)' },
    { name: 'Cherry Blossom', gradient: 'linear-gradient(135deg,#fbc2eb,#a18cd1)' },
    { name: 'Emerald City',   gradient: 'linear-gradient(135deg,#43e97b,#38f9d7)' },
    { name: 'Midnight',       gradient: 'linear-gradient(135deg,#2d3748,#1a202c)' },
    { name: 'Twilight Dusk',  gradient: 'linear-gradient(135deg,#4776E6,#8E54E9)' },
    { name: 'Flare',          gradient: 'linear-gradient(135deg,#f12711,#f5af19)' },
    { name: 'Candy Cotton',   gradient: 'linear-gradient(135deg,#f093fb,#f5576c)' },
    { name: 'Royal Purple',   gradient: 'linear-gradient(135deg,#7b4397,#dc2430)' },
    { name: 'Silver Fox',     gradient: 'linear-gradient(135deg,#bdc3c7,#2c3e50)' },
    { name: 'Electric Peacock', gradient: 'linear-gradient(135deg,#8a2387,#e94057,#f27121)' },
  ];

  /** Custom color picker state */
  pickerColor1    = '#E91E8C';
  pickerColor2    = '#FF6B6B';
  pickerDirection = '135deg';

  readonly directions = [
    { label: '→',  value: '90deg'  },
    { label: '↘',  value: '135deg' },
    { label: '↓',  value: '180deg' },
    { label: '↙',  value: '225deg' },
    { label: '↗',  value: '45deg'  },
  ];

  applyPreset(p: { name: string; gradient: string }) {
    this.formData.gradient = p.gradient;
    this.syncPickerFromGradient(p.gradient);
  }

  buildGradient() {
    this.formData.gradient =
      `linear-gradient(${this.pickerDirection},${this.pickerColor1},${this.pickerColor2})`;
  }

  changeDirection(dir: string) {
    this.pickerDirection = dir;
    if (this.formData.gradient && this.formData.gradient.startsWith('linear-gradient(')) {
      this.formData.gradient = this.formData.gradient.replace(
        /linear-gradient\(\s*[^,]+,/,
        `linear-gradient(${dir},`
      );
    }
  }

  private syncPickerFromGradient(g: string) {
    const m = g.match(/linear-gradient\(\s*([^,]+),\s*(#[\da-fA-F]{3,8}),\s*(#[\da-fA-F]{3,8})\)/);
    if (m) {
      this.pickerDirection = m[1].trim();
      this.pickerColor1    = m[2].trim();
      this.pickerColor2    = m[3].trim();
    }
  }

  isPresetActive(p: { gradient: string }): boolean {
    return this.formData.gradient === p.gradient;
  }

  // ── UTILS ─────────────────────────────────────────────────────────────────

  private blankForm(): CreateCategoryRequest {
    return {
      name: '', nameHindi: '', categoryKey: '',
      icon: 'bi-star',
      gradient: 'linear-gradient(135deg,#6B7280,#374151)',
      colorClass: 'event-custom',
      startingPrice: 0,
      description: '',
      popularServices: [],
      isActive: true
    };
  }
}
