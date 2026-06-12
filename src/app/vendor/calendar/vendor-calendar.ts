import { Component, signal, OnInit, inject } from '@angular/core';
import { CalendarDay } from '../../core/models/vendor.model';
import { VendorService } from '../../core/services/vendor.service';
import { ToastService } from '../../core/services/toast.service';

@Component({ 
  selector: 'app-vendor-calendar', 
  imports: [], 
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

  toggleDay(day: CalendarDay) {
    if (day.status === 'booked') return;

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

  getStatusColor(status: string): string {
    const map: Record<string, string> = { 
      available: 'rgba(22,163,74,0.15)', 
      booked: 'rgba(220,38,38,0.12)', 
      blocked: 'rgba(148,163,184,0.25)', 
      unavailable: 'rgba(0,0,0,0.05)' 
    };
    return map[status] || '';
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
