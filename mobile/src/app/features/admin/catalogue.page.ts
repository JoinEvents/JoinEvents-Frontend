import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonSegment, IonSegmentButton, IonLabel, IonIcon,
  IonFab, IonFabButton, IonModal, IonButtons, IonButton, IonItem, IonInput, IonTextarea,
  IonToggle, IonSpinner, IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';

import { AdminService } from '../../core/services/admin.service';
import { ToastService } from '../../core/services/toast.service';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { ListSkeletonComponent } from '../../shared/components/list-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

/**
 * Catalogue configuration: the event categories and pricing tiers every vendor
 * package is built from. Editing these changes what the whole platform offers,
 * so deletes are confirmed and never silent.
 */
@Component({
  selector: 'app-admin-catalogue',
  standalone: true,
  imports: [
    ReactiveFormsModule, CurrencyInrPipe, ListSkeletonComponent, EmptyStateComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonSegment, IonSegmentButton, IonLabel, IonIcon,
    IonFab, IonFabButton, IonModal, IonButtons, IonButton, IonItem, IonInput, IonTextarea,
    IonToggle, IonSpinner, IonRefresher, IonRefresherContent
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Catalogue</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="tab()" (ionChange)="switchTab($any($event.detail.value))">
          <ion-segment-button value="categories"><ion-label>Categories</ion-label></ion-segment-button>
          <ion-segment-button value="tiers"><ion-label>Tiers</ion-label></ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="load($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="je-section">
        @if (loading()) {
          <app-list-skeleton [count]="5" />
        } @else if (!records().length) {
          <app-empty-state
            icon="pricetags-outline"
            [title]="'No ' + tab() + ' yet'"
            message="Add one so vendors can list packages against it."
            actionLabel="Add"
            (action)="openEditor(null)" />
        } @else {
          @for (record of records(); track $any(record['id'])) {
            <div class="je-card row">
              <div class="row__body">
                <strong class="je-sm">{{ record['name'] }}</strong>
                @if (record['description']) {
                  <span class="je-xs je-muted je-clamp-2">{{ record['description'] }}</span>
                }
                @if (record['startingPrice'] || record['basePrice']) {
                  <span class="je-xs je-soft">
                    from {{ $any(record['startingPrice'] ?? record['basePrice']) | inr }}
                  </span>
                }
              </div>

              <div class="row__acts">
                <ion-toggle [checked]="$any(record['isActive']) !== false"
                            (ionChange)="toggle(record, $any($event.detail.checked))" />
                <ion-button size="small" fill="clear" (click)="openEditor(record)">
                  <ion-icon slot="icon-only" name="create-outline" />
                </ion-button>
                <ion-button size="small" fill="clear" color="danger" (click)="remove(record)">
                  <ion-icon slot="icon-only" name="trash-outline" />
                </ion-button>
              </div>
            </div>
          }
        }
      </div>

      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button class="fab" (click)="openEditor(null)"><ion-icon name="add" /></ion-fab-button>
      </ion-fab>
    </ion-content>

    <ion-modal [isOpen]="editorOpen()" (didDismiss)="editorOpen.set(false)"
               [initialBreakpoint]="0.7" [breakpoints]="[0, 0.7]">
      <ng-template>
        <ion-header class="ion-no-border">
          <ion-toolbar>
            <ion-title>{{ editingId() ? 'Edit' : 'Add' }} {{ singular() }}</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="editorOpen.set(false)">Close</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <form [formGroup]="form">
            <ion-item class="je-field" lines="none">
              <ion-input formControlName="name" [placeholder]="singular() + ' name'" />
            </ion-item>
            <ion-item class="je-field" lines="none">
              <ion-textarea formControlName="description" [rows]="3" [autoGrow]="true"
                            placeholder="Description" />
            </ion-item>
            <ion-item class="je-field" lines="none">
              <ion-input formControlName="startingPrice" type="number" inputmode="numeric"
                         placeholder="Starting price (₹)" />
            </ion-item>
            <ion-button expand="block" class="je-btn-gradient" (click)="save()" [disabled]="saving()">
              @if (saving()) { <ion-spinner name="crescent" /> } @else { Save }
            </ion-button>
          </form>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .row { display: flex; align-items: center; gap: 12px; }
    .row__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .row__acts { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
    .fab { --background: var(--je-gradient-primary); --color: #fff; }
  `]
})
export class AdminCataloguePage implements ViewWillEnter {
  private fb = inject(FormBuilder);
  private adminService = inject(AdminService);
  private toast = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly records = signal<Record<string, unknown>[]>([]);
  readonly tab = signal<'categories' | 'tiers'>('categories');
  readonly editorOpen = signal(false);
  readonly editingId = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    startingPrice: [0, Validators.min(0)]
  });

  singular(): string {
    return this.tab() === 'categories' ? 'category' : 'tier';
  }

  ionViewWillEnter(): void {
    this.load();
  }

  switchTab(tab: 'categories' | 'tiers'): void {
    this.tab.set(tab);
    this.load();
  }

  load(event?: CustomEvent): void {
    this.loading.set(true);
    const source$ = this.tab() === 'categories' ? this.adminService.getCategories() : this.adminService.getTiers();
    source$.subscribe(records => {
      this.records.set(records);
      this.loading.set(false);
      void (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    });
  }

  openEditor(record: Record<string, unknown> | null): void {
    this.editingId.set(record ? String(record['id']) : null);
    this.form.reset({
      name: String(record?.['name'] ?? ''),
      description: String(record?.['description'] ?? ''),
      startingPrice: Number(record?.['startingPrice'] ?? record?.['basePrice'] ?? 0)
    });
    this.editorOpen.set(true);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const payload = this.form.getRawValue();
    const id = this.editingId();
    const isCategory = this.tab() === 'categories';

    const request$ = id
      ? (isCategory ? this.adminService.updateCategory(id, payload) : this.adminService.updateTier(id, payload))
      : (isCategory ? this.adminService.createCategory(payload) : this.adminService.createTier(payload));

    request$.subscribe(success => {
      this.saving.set(false);
      if (!success) {
        void this.toast.error('Could not save. Please try again.');
        return;
      }
      this.editorOpen.set(false);
      void this.toast.success('Saved.');
      this.load();
    });
  }

  toggle(record: Record<string, unknown>, isActive: boolean): void {
    if (this.tab() !== 'categories') return;
    this.adminService.toggleCategory(String(record['id']), isActive).subscribe(success => {
      if (!success) {
        void this.toast.error('Could not change the status.');
        this.load();
      }
    });
  }

  async remove(record: Record<string, unknown>): Promise<void> {
    const confirmed = await this.toast.confirm(
      `Delete this ${this.singular()}?`,
      `"${record['name']}" is removed from the catalogue. Packages already using it are unaffected.`,
      'Delete',
      true
    );
    if (!confirmed) return;

    const id = String(record['id']);
    const request$ = this.tab() === 'categories'
      ? this.adminService.deleteCategory(id)
      : this.adminService.deleteTier(id);

    request$.subscribe(success => {
      if (!success) {
        void this.toast.error('Could not delete it.');
        return;
      }
      void this.toast.success('Deleted.');
      this.load();
    });
  }
}
