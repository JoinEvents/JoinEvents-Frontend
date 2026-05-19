import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { PackageService } from '../../core/services/package.service';

@Component({
  selector: 'app-support-dashboard',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="support-welcome-banner">
      <div>
        <div style="color:inherit;font-family:var(--font-heading);font-size:1.5rem;font-weight:800;letter-spacing:-0.5px;">Support Hub 🎧</div>
        <div style="color:inherit;opacity:0.85;font-size:0.9rem;margin-top:6px;max-width:500px;">You're doing great! There are <span style="font-weight:700">8 open tickets</span> and <span style="font-weight:700">14 active chats</span> currently in queue.</div>
      </div>
      <div class="d-flex gap-2">
        <a routerLink="/support/tickets" class="btn-support-action">
          <i class="bi bi-headset"></i> View Helpdesk
        </a>
        <a routerLink="/support/verifications" class="btn-support-action" style="background: rgba(255, 255, 255, 0.15); border-color: rgba(255, 255, 255, 0.25);">
          <i class="bi bi-shield-check"></i> Verifications Portal
        </a>
      </div>
    </div>

    <!-- Support KPIs -->
    <div class="row g-3 mb-4">
      @for (kpi of supportKpis; track kpi.label) {
        <div class="col-6 col-md-3">
          @if (kpi.link) {
            <a [routerLink]="kpi.link" [queryParams]="kpi.queryParams" class="premium-stat-card text-decoration-none d-block" style="cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
              <div class="stat-inner">
                <div class="stat-details">
                  <div class="stat-label">{{ kpi.label }} <i class="bi bi-arrow-right-short text-muted"></i></div>
                  <div class="stat-value">{{ kpi.value }}</div>
                </div>
                <div class="stat-icon-box" [style.background]="kpi.gradient">
                  <i class="bi {{ kpi.icon }}"></i>
                </div>
              </div>
              <div class="stat-progress-bar">
                <div class="progress-fill" [style.background]="kpi.gradient" style="width: 70%"></div>
              </div>
            </a>
          } @else {
            <div class="premium-stat-card">
              <div class="stat-inner">
                <div class="stat-details">
                  <div class="stat-label">{{ kpi.label }}</div>
                  <div class="stat-value">{{ kpi.value }}</div>
                </div>
                <div class="stat-icon-box" [style.background]="kpi.gradient">
                  <i class="bi {{ kpi.icon }}"></i>
                </div>
              </div>
              <div class="stat-progress-bar">
                <div class="progress-fill" [style.background]="kpi.gradient" style="width: 70%"></div>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <div class="row g-4">
      <div class="col-12 col-lg-8">
        <div class="ee-card p-4">
          <h6 class="chart-title"><i class="bi bi-clock-history me-2 text-warning"></i>Ticket Response Times (Last 24h)</h6>
          <div class="ticket-chart-container">
            @for (h of [2, 4, 8, 10, 12, 14, 16, 18, 20, 22]; track h) {
              <div class="bar-group">
                <div class="bar-wrap">
                  <div class="ticket-bar" [style.height]="(h * 4) + '%'" style="background: linear-gradient(to top, #F59E0B, #D97706)"></div>
                </div>
                <div class="bar-label">{{ h }}h</div>
              </div>
            }
          </div>
        </div>
      </div>
      <div class="col-12 col-lg-4">
        <div class="ee-card p-4">
          <h6 class="chart-title"><i class="bi bi-lightning-charge me-2 text-warning"></i>Priority Distribution</h6>
          <div class="quick-stats-list">
            <div class="qs-item">
              <span class="qs-label"><span class="status-dot bg-danger"></span>Critical / Urgent</span>
              <span class="qs-val">2</span>
            </div>
            <div class="qs-item">
              <span class="qs-label"><span class="status-dot bg-warning"></span>High Priority</span>
              <span class="qs-val">5</span>
            </div>
            <div class="qs-item">
              <span class="qs-label"><span class="status-dot bg-info"></span>Medium / Low</span>
              <span class="qs-val">12</span>
            </div>
            <div class="qs-item border-top mt-2 pt-3">
              <span class="qs-label">Avg Resolution Time</span>
              <span class="qs-val">4.2h</span>
            </div>
            <div class="qs-item">
              <span class="qs-label">Satisfaction Score</span>
              <span class="qs-val text-accent">4.8 ★</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrl: './support-dashboard.css'
})
export class SupportDashboard implements OnInit {
  private auth = inject(AuthService);
  private packageService = inject(PackageService);
  user = this.auth.currentUser;

  supportKpis = [
    { label: 'Open Tickets', value: '8', icon: 'bi-headset', gradient: 'linear-gradient(135deg,#F59E0B,#D97706)', link: '/support/tickets', queryParams: null as any },
    { label: 'Active Chats', value: '14', icon: 'bi-chat-dots', gradient: 'linear-gradient(135deg,#0EA5E9,#2563EB)', link: null as any, queryParams: null as any },
    { label: 'Pending Reviews', value: '0', icon: 'bi-flag', gradient: 'linear-gradient(135deg,#EF4444,#B91C1C)', link: '/support/verifications', queryParams: { tab: 'packages' } },
    { label: 'Today Resolves', value: '23', icon: 'bi-check2-circle', gradient: 'linear-gradient(135deg,#10B981,#059669)', link: null as any, queryParams: null as any },
  ];

  ngOnInit() {
    this.packageService.getPendingPackages().subscribe(packages => {
      const kpi = this.supportKpis.find(k => k.label === 'Pending Reviews');
      if (kpi) {
        kpi.value = packages.length.toString();
      }
    });
  }
}
