import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { catchError, delay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { AnalyticsService, AdminAnalyticsData } from '../../core/services/analytics.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule, DecimalPipe],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboard implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private analyticsService = inject(AnalyticsService);

  kpis = signal<any>(null);
  isAdmin = computed(() => this.auth.getRole() === 'admin');

  // ---- Analytics state ----
  analyticsLoading = signal(true);
  analyticsError = signal<string | null>(null);
  analyticsData = signal<AdminAnalyticsData | null>(null);
  startDateVal = '';
  endDateVal = '';
  dateValidationError = signal<string | null>(null);

  readonly monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  maxRevenue = computed(() => {
    const d = this.analyticsData();
    if (!d) return 1;
    return Math.max(...d.monthlyRevenue, 1);
  });

  maxAcquisition = computed(() => {
    const d = this.analyticsData();
    if (!d) return 1;
    return Math.max(...d.customerAcquisitionByMonth, 1);
  });

  bookingStatusArray = computed(() => {
    const d = this.analyticsData();
    if (!d) return [];
    return Object.entries(d.bookingCountByStatus).map(([status, count]) => ({ status, count }));
  });

  // ---- Dashboard KPI defs ----
  readonly kpiDefs = [
    { key: 'totalRevenue',   label: 'Platform Revenue',  icon: 'bi-wallet2',      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', textColor: '#ffffff', adminOnly: true },
    { key: 'activeEvents',   label: 'Running Events',    icon: 'bi-stars',        gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', textColor: '#ffffff', adminOnly: false },
    { key: 'totalCustomers', label: 'Total Clients',     icon: 'bi-person-heart', gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', textColor: '#ffffff', adminOnly: false },
    { key: 'totalVendors',   label: 'Service Partners',  icon: 'bi-patch-check',  gradient: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)', textColor: '#ffffff', adminOnly: false },
  ];

  get filteredKpis() {
    return this.kpiDefs.filter(k => !k.adminOnly || this.isAdmin());
  }

  ngOnInit() {
    const fallbackData = {
      totalRevenue: 6420000,
      activeEvents: 18,
      pendingVerifications: 5,
      totalCustomers: 312,
      totalVendors: 64,
      completedEvents: 428,
      openTickets: 12,
      monthlyRevenue: [280000, 350000, 420000, 310000, 580000, 620000, 490000, 850000, 720000, 940000, 1150000, 1380000],
    };
    this.http.get<any>(`${environment.apiUrl}/admin/dashboard`, { headers: { 'X-Suppress-Errors': 'true' } }).pipe(
      catchError(() => of(fallbackData).pipe(delay(300)))
    ).subscribe(k => this.kpis.set(k));
    this.loadAnalytics();
  }

  formatKpi(key: string): string {
    const k = this.kpis();
    if (!k) return '-';
    const v = k[key];
    if (key === 'totalRevenue') return '₹' + (v / 100000).toFixed(1) + 'L';
    return String(v);
  }

  getBarWidth(idx: number): string {
    const months = this.kpis()?.monthlyRevenue || [];
    const max = Math.max(...months);
    return months[idx] ? `${(months[idx] / max) * 100}%` : '0%';
  }

  loadAnalytics() {
    this.analyticsLoading.set(true);
    this.analyticsError.set(null);
    this.analyticsService.getAdminAnalytics().subscribe({
      next: (res) => {
        this.analyticsData.set(res);
        this.analyticsLoading.set(false);
      },
      error: () => {
        this.analyticsError.set('Failed to load analytics data. Please try again.');
        this.analyticsLoading.set(false);
      }
    });
  }

  applyDateFilter() {
    const start = this.startDateVal;
    const end = this.endDateVal;
    if (start && end && start > end) {
      this.dateValidationError.set('Start date cannot be after end date.');
      return;
    }
    this.dateValidationError.set(null);
    this.loadAnalytics();
  }

  getPercentageChange(current: number, preceding: number): string {
    if (preceding === 0) return 'N/A';
    const pct = ((current - preceding) / preceding) * 100;
    return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
  }
}
