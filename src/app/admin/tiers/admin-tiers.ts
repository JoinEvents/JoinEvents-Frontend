import { Component, signal, computed, inject, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminTierService, Tier, TierPriceRange, CreateTierRequest } from '../../core/services/admin-tier.service';
import { AdminCategoryService, EventCategory } from '../../core/services/admin-category.service';

@Component({
  selector: 'app-admin-tiers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-tiers.html',
  styleUrl: './admin-tiers.css'
})
export class AdminTiers implements OnInit, OnDestroy {
  private svc = inject(AdminTierService);
  private catSvc = inject(AdminCategoryService);

  tiers = signal<Tier[]>([]);
  categories = signal<EventCategory[]>([]);
  isModalOpen = signal(false);
  editing = signal<Tier | null>(null);

  isSubmitting = signal(false);
  isLoading = signal(false);
  error = signal<string | null>(null);

  searchQuery = signal('');
  statusFilter = signal('all'); // 'all', 'active', 'inactive'
  categoryFilter = signal('all'); // 'all' or CategoryId

  availableIcons = [
    { value: 'bi-layers', label: 'Layers (Default)' },
    { value: 'bi-gem', label: 'Gem/Diamond' },
    { value: 'bi-star-fill', label: 'Star' },
    { value: 'bi-award', label: 'Award' },
    { value: 'bi-shield-shaded', label: 'Shield' },
    { value: 'bi-box-seam', label: 'Box/Package' },
    { value: 'bi-crown-fill', label: 'Crown' }
  ];

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

  formData = this.blankForm();

  constructor() {
    effect(() => {
      document.body.classList.toggle('modal-open', this.isModalOpen());
    });
  }

  ngOnInit() {
    this.loadData();
  }

  ngOnDestroy() {
    document.body.classList.remove('modal-open');
  }

  // ── DATA LOADING ─────────────────────────────────────────────────────────

  loadData() {
    this.isLoading.set(true);
    this.error.set(null);

    // Fetch categories first
    this.catSvc.getAll().subscribe({
      next: (cats) => {
        this.categories.set(cats);
        
        // Fetch tiers
        this.svc.getAll().subscribe({
          next: (data) => {
            this.tiers.set(data);
            this.isLoading.set(false);
          },
          error: (err) => {
            this.error.set(err?.error?.message || 'Failed to load Tiers.');
            this.isLoading.set(false);
          }
        });
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Failed to load Event Categories.');
        this.isLoading.set(false);
      }
    });
  }

  /** Display order: Silver → Gold → Platinum */
  private readonly tierOrder: Record<string, number> = {
    'silver': 1,
    'gold': 2,
    'platinum': 3
  };

  filteredTiers = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    const cat = this.categoryFilter();

    return this.tiers().filter(t => {
      // Status Filter
      if (status === 'active' && t.isActive === false) return false;
      if (status === 'inactive' && t.isActive !== false) return false;

      // Category Filter
      if (cat !== 'all' && t.categoryId !== cat) return false;

      // Search Query
      if (!query) return true;
      return (
        t.name.toLowerCase().includes(query) ||
        (t.categoryName && t.categoryName.toLowerCase().includes(query)) ||
        (t.description && t.description.toLowerCase().includes(query))
      );
    }).sort((a, b) => {
      const orderA = this.tierOrder[a.name.toLowerCase()] ?? 99;
      const orderB = this.tierOrder[b.name.toLowerCase()] ?? 99;
      return orderA - orderB;
    });
  });

  activeCategories = computed(() => {
    return this.categories().filter(c => c.isActive !== false);
  });

  // ── MODAL OPERATIONS ──────────────────────────────────────────────────────

  openAddModal() {
    this.editing.set(null);
    this.formData = this.blankForm();
    this.syncPickerFromGradient(this.formData.gradient ?? '');
    this.isModalOpen.set(true);
  }

  openEditModal(tier: Tier) {
    this.editing.set(tier);
    this.formData = {
      name: tier.name,
      categoryId: tier.categoryId,
      description: tier.description ?? '',
      isActive: tier.isActive,
      icon: tier.icon ?? 'bi-layers',
      gradient: tier.gradient ?? 'linear-gradient(135deg,#6B7280,#374151)',
      priceRanges: tier.priceRanges.map(pr => ({ ...pr }))
    };
    this.syncPickerFromGradient(this.formData.gradient ?? '');
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.editing.set(null);
  }

  // ── TIER NAME INTERACTION ────────────────────────────────────────────────
  onTierNameChange(tierName: string) {
    if (!tierName) return;
    const lower = tierName.toLowerCase();
    if (lower === 'silver') {
      this.formData.icon = 'bi-patch-check';
      this.formData.gradient = 'linear-gradient(#3E5151,#bdc3c7,#DECBA4)';
    } else if (lower === 'gold') {
      this.formData.icon = 'bi-award';
      this.formData.gradient = 'linear-gradient(#fdbb2d,#F2C94C,#f09819)';
    } else if (lower === 'platinum') {
      this.formData.icon = 'bi-gem';
      this.formData.gradient = 'linear-gradient(135deg,#0EA5E9,#6B21A8)';
    }
    this.syncPickerFromGradient(this.formData.gradient ?? '');
  }

  // ── CATEGORY INTERACTION ──────────────────────────────────────────────────

  onCategoryChange(categoryId: string) {
    if (!categoryId) return;
    
    // Auto-populate services from the selected category's popularServices list
    const selectedCat = this.categories().find(c => c.id === categoryId);
    if (selectedCat && selectedCat.popularServices && selectedCat.popularServices.length > 0) {
      // Ask or automatically create empty ranges for popular services
      this.formData.priceRanges = selectedCat.popularServices.map(service => ({
        serviceName: service,
        minPrice: 0,
        maxPrice: 0
      }));
    } else {
      this.formData.priceRanges = [];
    }
  }

  // ── PRICE RANGES DYNAMIC ROWS ──────────────────────────────────────────────

  addPriceRangeRow() {
    this.formData.priceRanges.push({
      serviceName: '',
      minPrice: 0,
      maxPrice: 0
    });
  }

  removePriceRangeRow(index: number) {
    this.formData.priceRanges.splice(index, 1);
  }

  quickAddService(serviceName: string) {
    // Check if service already exists in current rows
    const exists = this.formData.priceRanges.some(
      r => r.serviceName.toLowerCase() === serviceName.toLowerCase()
    );
    if (!exists) {
      this.formData.priceRanges.push({
        serviceName,
        minPrice: 0,
        maxPrice: 0
      });
    }
  }

  getSelectedCategoryPopularServices(): string[] {
    if (!this.formData.categoryId) return [];
    const cat = this.categories().find(c => c.id === this.formData.categoryId);
    return cat?.popularServices || [];
  }

  // ── SAVE / DELETE / TOGGLE ────────────────────────────────────────────────

  saveTier() {
    this.isSubmitting.set(true);
    this.error.set(null);

    // Clean up empty service names
    const cleanedRanges = this.formData.priceRanges.filter(pr => pr.serviceName.trim() !== '');
    const payload = {
      ...this.formData,
      priceRanges: cleanedRanges
    };

    const id = this.editing()?.id;
    const op$ = id ? this.svc.update(id, payload) : this.svc.create(payload);

    op$.subscribe({
      next: (res) => {
        if (id) {
          this.tiers.update(arr => arr.map(t => t.id === id ? res : t));
        } else {
          this.tiers.update(arr => [...arr, res]);
        }
        this.closeModal();
        this.isSubmitting.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Failed to save Tier.');
        this.isSubmitting.set(false);
      }
    });
  }

  deleteTier(tier: Tier) {
    if (!confirm(`Are you sure you want to delete the Tier "${tier.name}"? This action cannot be undone.`)) return;

    this.svc.delete(tier.id).subscribe({
      next: () => {
        this.tiers.update(arr => arr.filter(t => t.id !== tier.id));
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Failed to delete Tier.');
      }
    });
  }

  toggleTierActive(tier: Tier, isActive: boolean) {
    this.svc.toggleActive(tier.id, isActive).subscribe({
      next: (res) => {
        this.tiers.update(arr => arr.map(t => t.id === tier.id ? res : t));
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Failed to toggle active status.');
        this.loadData();
      }
    });
  }

  // ── HELPERS ──────────────────────────────────────────────────────────────

  private blankForm(): CreateTierRequest {
    return {
      name: '',
      categoryId: '',
      description: '',
      isActive: true,
      icon: 'bi-layers',
      gradient: 'linear-gradient(135deg,#6B7280,#374151)',
      priceRanges: []
    };
  }
}
