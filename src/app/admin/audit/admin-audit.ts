import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditService } from '../../core/services/audit.service';
import { AuditLog, AuditStats, AuditEntityType, AuditSeverity } from '../../core/models/audit-log.model';

const PAGE_SIZE = 15;

@Component({
  selector: 'app-admin-audit',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './admin-audit.html',
  styleUrl: './admin-audit.css'
})
export class AdminAudit implements OnInit {
  private auditService = inject(AuditService);

  // ── State ──────────────────────────────────────────────────────────────────
  allLogs   = signal<AuditLog[]>([]);
  stats     = signal<AuditStats | null>(null);
  loading   = signal(true);
  error     = signal<string | null>(null);

  // ── Filters ────────────────────────────────────────────────────────────────
  search       = signal('');
  entityFilter = signal<AuditEntityType | 'all'>('all');
  severityFilter = signal<AuditSeverity | 'all'>('all');
  actorFilter  = signal<'all' | 'admin' | 'support' | 'system'>('all');
  dateFrom     = signal('');
  dateTo       = signal('');
  currentPage  = signal(1);

  // ── Expanded detail rows ───────────────────────────────────────────────────
  expandedIds  = signal<Set<string>>(new Set());

  // ── Computed ───────────────────────────────────────────────────────────────
  filteredLogs = computed(() => {
    const q    = this.search().toLowerCase().trim();
    const ent  = this.entityFilter();
    const sev  = this.severityFilter();
    const act  = this.actorFilter();
    const from = this.dateFrom() ? new Date(this.dateFrom()).getTime() : 0;
    const to   = this.dateTo()   ? new Date(this.dateTo()).getTime() + 86399999 : Infinity;

    return this.allLogs().filter(l => {
      if (ent !== 'all' && l.entityType !== ent) return false;
      if (sev !== 'all' && l.severity   !== sev) return false;
      if (act !== 'all' && l.actorRole  !== act) return false;
      const ts = new Date(l.timestamp).getTime();
      if (ts < from || ts > to) return false;
      if (q && !l.actorName.toLowerCase().includes(q) &&
               !l.action.toLowerCase().includes(q) &&
               !l.description.toLowerCase().includes(q) &&
               !l.entityName.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredLogs().length / PAGE_SIZE)));

  pagedLogs = computed(() => {
    const p = this.currentPage();
    return this.filteredLogs().slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
  });

  pageNumbers = computed(() => {
    const total = this.totalPages();
    const cur   = this.currentPage();
    const pages: number[] = [];
    const start = Math.max(1, cur - 2);
    const end   = Math.min(total, start + 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit() {
    this.auditService.getAuditLogs().subscribe({
      next: logs => { this.allLogs.set(logs); this.loading.set(false); },
      error: ()  => { this.error.set('Failed to load audit logs.'); this.loading.set(false); }
    });
    this.auditService.getAuditStats().subscribe(s => this.stats.set(s));
  }

  // ── Filter helpers ─────────────────────────────────────────────────────────
  onFilterChange() { this.currentPage.set(1); }

  resetFilters() {
    this.search.set('');
    this.entityFilter.set('all');
    this.severityFilter.set('all');
    this.actorFilter.set('all');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.currentPage.set(1);
  }

  goToPage(p: number) {
    if (p >= 1 && p <= this.totalPages()) this.currentPage.set(p);
  }

  // ── Expand/collapse detail panel ───────────────────────────────────────────
  toggleDetail(id: string) {
    const s = new Set(this.expandedIds());
    if (s.has(id)) s.delete(id); else s.add(id);
    this.expandedIds.set(s);
  }

  isExpanded(id: string): boolean { return this.expandedIds().has(id); }

  hasMeta(log: AuditLog): boolean {
    const m = log.metadata;
    return !!(m && (m.before || m.after || m.reason || m.amount || m.extra));
  }

  metaKeys(obj: Record<string, any>): string[] { return Object.keys(obj); }

  // ── Styling helpers ────────────────────────────────────────────────────────
  severityClass(s: AuditSeverity): string {
    return { info: 'sev-info', warning: 'sev-warning', critical: 'sev-critical' }[s] || 'sev-info';
  }

  entityClass(e: AuditEntityType): string {
    const map: Record<AuditEntityType, string> = {
      booking: 'ent-booking', vendor: 'ent-vendor', customer: 'ent-customer',
      employee: 'ent-employee', category: 'ent-category',
      payment: 'ent-payment', auth: 'ent-auth', system: 'ent-system'
    };
    return map[e] || 'ent-system';
  }

  entityIcon(e: AuditEntityType): string {
    const map: Record<AuditEntityType, string> = {
      booking: 'bi-journal-check', vendor: 'bi-patch-check',
      customer: 'bi-person-heart', employee: 'bi-person-badge',
      category: 'bi-tag', payment: 'bi-cash-stack',
      auth: 'bi-shield-lock', system: 'bi-cpu'
    };
    return map[e] || 'bi-circle';
  }

  actorRoleLabel(role: string): string {
    return { admin: 'Admin', support: 'Support', system: 'System' }[role] || role;
  }

  actorRoleClass(role: string): string {
    return { admin: 'role-admin', support: 'role-support', system: 'role-system' }[role] || 'role-system';
  }

  relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  <  1)  return 'Just now';
    if (mins  < 60)  return `${mins}m ago`;
    if (hours < 24)  return `${hours}h ago`;
    if (days  <  7)  return `${days}d ago`;
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  formatValue(v: any): string {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'number') return v.toLocaleString('en-IN');
    return String(v);
  }

  // ── CSV Export ────────────────────────────────────────────────────────────
  exportCSV() {
    const logs = this.filteredLogs();
    const header = ['ID', 'Timestamp', 'Actor', 'Actor Role', 'Action', 'Description', 'Entity Type', 'Entity', 'Severity'];
    const rows = logs.map(l => [
      l.id,
      l.timestamp,
      l.actorName,
      l.actorRole,
      `"${l.action}"`,
      `"${l.description.replace(/"/g, "'")}"`,
      l.entityType,
      `"${l.entityName}"`,
      l.severity
    ]);
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
