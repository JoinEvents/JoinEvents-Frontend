import { Component, signal, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CalendarDay } from '../../core/models/vendor.model';
import { VendorService } from '../../core/services/vendor.service';
import { ToastService } from '../../core/services/toast.service';

@Component({ 
  selector: 'app-vendor-calendar', 
  imports: [RouterLink], 
  templateUrl: './vendor-calendar.html', 
  styleUrl: './vendor-calendar.css' 
})
export class VendorCalendar implements OnInit {
  private vendorService = inject(VendorService);
  private toast = inject(ToastService);

  days = signal<CalendarDay[]>([]);
  currentMonth = new Date().getMonth() + 1;
  currentYear = new Date().getFullYear();
  selectedDay = signal<CalendarDay | null>(null);
  selectedDates = signal<string[]>([]);
  selectionMode = signal<boolean>(false);
  selectedBookedDay = signal<CalendarDay | null>(null);
  readonly weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  readonly months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  ngOnInit() { 
    this.loadCalendar(); 
  }

  loadCalendar() { 
    this.vendorService.getCalendar(this.currentMonth, this.currentYear).subscribe({
      next: (d) => this.days.set(d),
      error: (err) => {
        console.error('Failed to load calendar:', err);
        this.toast.error('Failed to load availability calendar.');
      }
    });
  }

  prevMonth() { 
    if (this.currentMonth === 1) { 
      this.currentMonth = 12; 
      this.currentYear--; 
    } else { 
      this.currentMonth--; 
    } 
    this.loadCalendar(); 
  }

  nextMonth() { 
    if (this.currentMonth === 12) { 
      this.currentMonth = 1; 
      this.currentYear++; 
    } else { 
      this.currentMonth++; 
    } 
    this.loadCalendar(); 
  }

  getFirstDayOfWeek(): number { 
    return new Date(this.currentYear, this.currentMonth - 1, 1).getDay(); 
  }

  getMonthLabel(): string { 
    return `${this.months[this.currentMonth - 1]} ${this.currentYear}`; 
  }

  toggleSelectionMode() {
    this.selectionMode.update(mode => !mode);
    this.clearSelection();
  }

  clearSelection() {
    this.selectedDates.set([]);
    this.selectedDay.set(null);
    this.selectedBookedDay.set(null);
  }

  goToday() {
    const today = new Date();
    this.currentMonth = today.getMonth() + 1;
    this.currentYear = today.getFullYear();
    this.clearSelection();
    this.loadCalendar();
  }

  toggleDay(day: CalendarDay) {
    if (day.status === 'booked') {
      this.selectedBookedDay.set(day);
      return;
    }
    this.selectedBookedDay.set(null);

    if (this.selectionMode()) {
      const currentSelected = this.selectedDates();
      if (currentSelected.includes(day.date)) {
        this.selectedDates.set(currentSelected.filter(d => d !== day.date));
      } else {
        this.selectedDates.set([...currentSelected, day.date]);
      }
    } else {
      this.vendorService.toggleCalendarDay(day.date).subscribe({
        next: (updatedDay) => {
          this.days.update(ds => ds.map(d => d.date === day.date ? { ...d, status: updatedDay.status } : d));
          this.selectedDay.set(updatedDay);
          this.toast.success(`Date ${day.date} is now ${updatedDay.status === 'blocked' ? 'Blocked' : 'Available'}.`);
        },
        error: (err) => {
          console.error('Failed to toggle calendar day:', err);
          this.toast.error(err.error?.error || 'Failed to update date status.');
        }
      });
    }
  }

  blockSelectedDates() {
    const dates = this.selectedDates();
    if (dates.length === 0) return;

    this.vendorService.bulkBlockDates(dates).subscribe({
      next: (updatedDays) => {
        this.days.update(ds => {
          const map = new Map(updatedDays.map(ud => [ud.date, ud.status]));
          return ds.map(d => map.has(d.date) ? { ...d, status: map.get(d.date)! } : d);
        });
        this.toast.success(`Successfully blocked ${dates.length} dates.`);
        this.selectionMode.set(false);
        this.clearSelection();
      },
      error: (err) => {
        console.error('Failed to bulk block dates:', err);
        this.toast.error(err.error?.error || 'Failed to block selected dates.');
      }
    });
  }

  releaseSelectedDates() {
    const dates = this.selectedDates();
    if (dates.length === 0) return;

    this.vendorService.bulkReleaseDates(dates).subscribe({
      next: (updatedDays) => {
        this.days.update(ds => {
          const map = new Map(updatedDays.map(ud => [ud.date, ud.status]));
          return ds.map(d => map.has(d.date) ? { ...d, status: map.get(d.date)! } : d);
        });
        this.toast.success(`Successfully released ${dates.length} dates.`);
        this.selectionMode.set(false);
        this.clearSelection();
      },
      error: (err) => {
        console.error('Failed to bulk release dates:', err);
        this.toast.error(err.error?.error || 'Failed to release selected dates.');
      }
    });
  }

  getStatusColor(status: string): string {
    const map: Record<string, string> = { 
      available: 'rgba(22,163,74,0.15)', 
      booked: 'rgba(220,38,38,0.12)', 
      blocked: 'rgba(148,163,184,0.25)', 
      unavailable: 'rgba(0,0,0,0.05)' 
    };
    return map[status] || '';
  }

  isToday(dateStr: string): boolean {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return dateStr === `${y}-${m}-${d}`;
  }

  get stats() {
    const d = this.days();
    return { 
      available: d.filter(x => x.status === 'available').length, 
      booked: d.filter(x => x.status === 'booked').length, 
      blocked: d.filter(x => x.status === 'blocked').length 
    };
  }
}
