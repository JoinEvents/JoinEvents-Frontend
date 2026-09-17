import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon, IonSpinner
} from '@ionic/angular/standalone';

import { VendorService, CalendarDay } from '../../core/services/vendor.service';
import { ToastService } from '../../core/services/toast.service';

interface Cell {
  date: string;
  day: number;
  inMonth: boolean;
  isPast: boolean;
  isToday: boolean;
  isBlocked: boolean;
  isBooked: boolean;
}

/**
 * Availability calendar. Tapping a date blocks or releases it; long-running
 * closures are handled by selecting a span and blocking it in one go.
 */
@Component({
  selector: 'app-vendor-calendar',
  standalone: true,
  imports: [
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonIcon, IonSpinner
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/vendor/tabs/dashboard" text="" />
        </ion-buttons>
        <ion-title>Availability</ion-title>
        <ion-buttons slot="end">
          <ion-button [disabled]="!selection().length" (click)="clearSelection()">Clear</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="je-section">
        <!-- Month switcher ------------------------------------------- -->
        <div class="je-card monthbar">
          <ion-button fill="clear" size="small" (click)="shiftMonth(-1)">
            <ion-icon slot="icon-only" name="chevron-back" />
          </ion-button>
          <strong>{{ monthLabel() }}</strong>
          <ion-button fill="clear" size="small" (click)="shiftMonth(1)">
            <ion-icon slot="icon-only" name="chevron-forward" />
          </ion-button>
        </div>

        @if (loading()) {
          <div class="center"><ion-spinner name="crescent" /></div>
        } @else {
          <div class="je-card grid-card">
            <div class="weekdays">
              @for (label of weekdays; track label) { <span>{{ label }}</span> }
            </div>
            <div class="grid">
              @for (cell of cells(); track cell.date) {
                <button class="cell"
                        [class.cell--out]="!cell.inMonth"
                        [class.cell--past]="cell.isPast"
                        [class.cell--today]="cell.isToday"
                        [class.cell--blocked]="cell.isBlocked"
                        [class.cell--booked]="cell.isBooked"
                        [class.cell--picked]="selection().includes(cell.date)"
                        [disabled]="cell.isPast || cell.isBooked || !cell.inMonth"
                        (click)="pick(cell)">
                  {{ cell.day }}
                </button>
              }
            </div>
          </div>

          <div class="legend">
            <span><i class="dot dot--free"></i> Available</span>
            <span><i class="dot dot--blocked"></i> Blocked</span>
            <span><i class="dot dot--booked"></i> Booked</span>
          </div>
        }
      </div>

      @if (selection().length) {
        <div class="je-action-bar">
          <span class="je-sm je-bold count">{{ selection().length }} selected</span>
          <ion-button size="small" fill="outline" (click)="release()">Make available</ion-button>
          <ion-button size="small" class="je-btn-gradient" (click)="block()">Block</ion-button>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .center { display: grid; place-items: center; padding: 60px 0; }
    .monthbar { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; padding: 6px 10px; }
    .monthbar strong { font-family: var(--je-font-heading); font-size: var(--je-fs-md); }

    .grid-card { padding: 14px 10px; }
    .weekdays { display: grid; grid-template-columns: repeat(7, 1fr); margin-bottom: 8px; }
    .weekdays span { text-align: center; font-size: 10px; font-weight: 700;
                     text-transform: uppercase; color: var(--je-text-soft); }
    .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }

    .cell { aspect-ratio: 1; border: none; border-radius: var(--je-radius-sm);
            background: transparent; color: var(--je-text-main);
            font-size: var(--je-fs-sm); font-weight: 600; }
    .cell--out { visibility: hidden; }
    .cell--past { color: var(--je-text-soft); opacity: 0.45; }
    .cell--today { box-shadow: inset 0 0 0 2px var(--je-primary); }
    .cell--blocked { background: rgba(220, 38, 38, 0.12); color: var(--je-danger); }
    .cell--booked { background: rgba(22, 163, 74, 0.14); color: var(--je-success); }
    .cell--picked { background: var(--je-primary); color: #fff; }

    .legend { display: flex; justify-content: center; gap: 18px; margin-top: 16px;
              font-size: var(--je-fs-xs); color: var(--je-text-muted); }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .dot { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
    .dot--free { background: var(--je-bg-light); border: 1px solid var(--je-border-color); }
    .dot--blocked { background: rgba(220, 38, 38, 0.4); }
    .dot--booked { background: rgba(22, 163, 74, 0.5); }

    .count { flex: 1; }
  `]
})
export class VendorCalendarPage implements OnInit {
  private vendorService = inject(VendorService);
  private toast = inject(ToastService);

  readonly weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  readonly loading = signal(true);
  readonly days = signal<CalendarDay[]>([]);
  readonly selection = signal<string[]>([]);
  readonly cursor = signal(new Date());

  readonly monthLabel = computed(() =>
    this.cursor().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  );

  /**
   * Builds a six-week grid. Leading blanks pad the month to its first weekday
   * so the columns line up with the weekday header.
   */
  readonly cells = computed<Cell[]>(() => {
    const cursor = this.cursor();
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const byDate = new Map(this.days().map(day => [day.date.slice(0, 10), day]));
    const todayKey = this.toKey(new Date());
    const cells: Cell[] = [];

    for (let i = 0; i < firstWeekday; i++) {
      cells.push({ date: `pad-${i}`, day: 0, inMonth: false, isPast: true, isToday: false, isBlocked: false, isBooked: false });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = this.toKey(new Date(year, month, day));
      const record = byDate.get(date);
      cells.push({
        date,
        day,
        inMonth: true,
        isPast: date < todayKey,
        isToday: date === todayKey,
        isBlocked: Boolean(record?.isBlocked),
        isBooked: Boolean(record?.isBooked)
      });
    }

    return cells;
  });

  ngOnInit(): void {
    this.load();
  }

  shiftMonth(delta: number): void {
    const next = new Date(this.cursor());
    next.setMonth(next.getMonth() + delta);
    this.cursor.set(next);
    this.clearSelection();
    this.load();
  }

  pick(cell: Cell): void {
    this.selection.update(list =>
      list.includes(cell.date) ? list.filter(d => d !== cell.date) : [...list, cell.date]
    );
  }

  clearSelection(): void {
    this.selection.set([]);
  }

  async block(): Promise<void> {
    const reason = await this.toast.prompt('Block these dates', 'Reason (optional) — e.g. maintenance');
    this.vendorService.bulkBlock(this.selection(), reason ?? undefined).subscribe(success => {
      this.finish(success, 'Dates blocked.');
    });
  }

  release(): void {
    this.vendorService.bulkRelease(this.selection()).subscribe(success => {
      this.finish(success, 'Dates are available again.');
    });
  }

  private finish(success: boolean, message: string): void {
    if (!success) {
      void this.toast.error('Could not update the calendar. Please try again.');
      return;
    }
    void this.toast.success(message);
    this.clearSelection();
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    const cursor = this.cursor();
    this.vendorService.getCalendar(cursor.getMonth() + 1, cursor.getFullYear()).subscribe(days => {
      this.days.set(days);
      this.loading.set(false);
    });
  }

  /** Local-date key; toISOString would shift the day for timezones behind UTC. */
  private toKey(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }
}
