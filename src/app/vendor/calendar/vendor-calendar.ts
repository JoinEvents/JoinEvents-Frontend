import { Component, signal, OnInit, inject } from '@angular/core';
import { of, Observable } from 'rxjs';
import { CalendarDay } from '../../core/models/vendor.model';

@Component({ selector: 'app-vendor-calendar', imports: [], templateUrl: './vendor-calendar.html', styleUrl: './vendor-calendar.css' })
export class VendorCalendar implements OnInit {
  days = signal<CalendarDay[]>([]);
  currentMonth = new Date().getMonth() + 1;
  currentYear = new Date().getFullYear();
  selectedDay = signal<CalendarDay | null>(null);
  readonly weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  readonly months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // TODO: Replace with real VendorCalendarService when a backend endpoint for vendor calendar is available
  // Currently uses local in-memory fallback since no backend calendar endpoints exist yet
  getVendorCalendar(vendorId: string, month: number, year: number): Observable<CalendarDay[]> {
    const days: CalendarDay[] = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    const bookedDays = [3, 7, 12, 18, 24, 28];
    const blockedDays = [1, 15];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      let status: CalendarDay['status'] = 'available';
      if (bookedDays.includes(d)) status = 'booked';
      else if (blockedDays.includes(d)) status = 'blocked';
      days.push({ date: dateStr, status });
    }
    return of(days);
  }

  ngOnInit() { this.loadCalendar(); }
  loadCalendar() { this.getVendorCalendar('v1', this.currentMonth, this.currentYear).subscribe(d => this.days.set(d)); }

  prevMonth() { if (this.currentMonth === 1) { this.currentMonth = 12; this.currentYear--; } else { this.currentMonth--; } this.loadCalendar(); }
  nextMonth() { if (this.currentMonth === 12) { this.currentMonth = 1; this.currentYear++; } else { this.currentMonth++; } this.loadCalendar(); }

  getFirstDayOfWeek(): number { return new Date(this.currentYear, this.currentMonth - 1, 1).getDay(); }
  getMonthLabel(): string { return `${this.months[this.currentMonth - 1]} ${this.currentYear}`; }

  toggleDay(day: CalendarDay) {
    if (day.status === 'booked') return;
    const newStatus = day.status === 'available' ? 'blocked' : 'available';
    this.days.update(ds => ds.map(d => d.date === day.date ? { ...d, status: newStatus } : d));
    this.selectedDay.set({ ...day, status: newStatus });
  }

  getStatusColor(status: string): string {
    const map: Record<string, string> = { available: 'rgba(22,163,74,0.15)', booked: 'rgba(220,38,38,0.12)', blocked: 'rgba(148,163,184,0.25)', unavailable: 'rgba(0,0,0,0.05)' };
    return map[status] || '';
  }

  get stats() {
    const d = this.days();
    return { available: d.filter(x => x.status === 'available').length, booked: d.filter(x => x.status === 'booked').length, blocked: d.filter(x => x.status === 'blocked').length };
  }
}
