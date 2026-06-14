import { Injectable, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, delay, map } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuditLog, AuditStats } from '../models/audit-log.model';

// ─── Rich Mock Audit Data seeded from real platform entities ───────────────
const MOCK_AUDIT_LOGS: AuditLog[] = [
  // ── AUTH ──────────────────────────────────────────────────────────────────
  {
    id: 'al001',
    timestamp: '2026-05-27T04:30:00Z',
    actorId: 'a1', actorName: 'Priya Nair', actorRole: 'admin',
    action: 'Admin Login',
    description: 'Admin Priya Nair successfully logged into the platform.',
    entityType: 'auth', entityId: 'a1', entityName: 'Priya Nair',
    severity: 'info'
  },
  {
    id: 'al002',
    timestamp: '2026-05-27T04:28:00Z',
    actorId: 's1', actorName: 'Rahul Support', actorRole: 'support',
    action: 'Support Login',
    description: 'Support agent Rahul Support logged into the support portal.',
    entityType: 'auth', entityId: 's1', entityName: 'Rahul Support',
    severity: 'info'
  },
  {
    id: 'al003',
    timestamp: '2026-05-26T22:15:00Z',
    actorId: 'unknown', actorName: 'Unknown', actorRole: 'system',
    action: 'Failed Login Attempt',
    description: 'Failed admin login attempt detected from email: intruder@example.com.',
    entityType: 'auth', entityId: 'unknown', entityName: 'intruder@example.com',
    severity: 'critical',
    metadata: { extra: 'IP: 192.168.1.200 — 3 failed attempts in 5 minutes' }
  },

  // ── BOOKINGS ──────────────────────────────────────────────────────────────
  {
    id: 'al004',
    timestamp: '2026-05-27T03:50:00Z',
    actorId: 's1', actorName: 'Rahul Support', actorRole: 'support',
    action: 'Support Log Added',
    description: 'Support log added to booking EE-2025-001: "Welcome call done. Explained the process."',
    entityType: 'booking', entityId: 'bk001', entityName: 'EE-2025-001',
    severity: 'info',
    metadata: { extra: 'Customer: Rajesh Kumar | Event: Wedding Reception' }
  },
  {
    id: 'al005',
    timestamp: '2026-05-27T02:10:00Z',
    actorId: 'a1', actorName: 'Priya Nair', actorRole: 'admin',
    action: 'Booking Status Changed',
    description: 'Admin Priya Nair changed status of booking EE-2026-003 from advance_paid to in_progress.',
    entityType: 'booking', entityId: 'bk005', entityName: 'EE-2026-003',
    severity: 'warning',
    metadata: {
      before: { status: 'advance_paid' },
      after:  { status: 'in_progress' },
      reason: 'Event execution started'
    }
  },
  {
    id: 'al006',
    timestamp: '2026-05-26T16:30:00Z',
    actorId: 'a1', actorName: 'Priya Nair', actorRole: 'admin',
    action: 'Damage Charges Added',
    description: 'Admin Priya Nair added damage charges of ₹5,000 to booking EE-2026-003. Notes: Table cloth burns.',
    entityType: 'booking', entityId: 'bk005', entityName: 'EE-2026-003',
    severity: 'warning',
    metadata: { amount: 5000, reason: 'Table cloth burns', extra: 'Customer: Anand Reddy' }
  },
  {
    id: 'al007',
    timestamp: '2026-05-26T11:00:00Z',
    actorId: 'system', actorName: 'System', actorRole: 'system',
    action: 'Booking Created',
    description: 'New booking EE-2026-002 created by customer Sunita Patel for Annual Day Conference.',
    entityType: 'booking', entityId: 'bk004', entityName: 'EE-2026-002',
    severity: 'info',
    metadata: { amount: 265300, extra: 'Event Date: 2026-06-05 | Venue: Novotel Business Center, Bangalore' }
  },
  {
    id: 'al008',
    timestamp: '2026-05-25T14:45:00Z',
    actorId: 'system', actorName: 'System', actorRole: 'system',
    action: 'Booking Fully Settled',
    description: 'Booking EE-2025-002 marked as fully settled. Final payment of ₹82,600 confirmed.',
    entityType: 'payment', entityId: 'bk002', entityName: 'EE-2025-002',
    severity: 'info',
    metadata: { amount: 82600, extra: 'Customer: Rajesh Kumar | Event: Daughter\'s 10th Birthday' }
  },
  {
    id: 'al009',
    timestamp: '2026-05-24T09:20:00Z',
    actorId: 'a1', actorName: 'Priya Nair', actorRole: 'admin',
    action: 'Dispute Raised',
    description: 'Admin Priya Nair opened a dispute on booking EE-2025-001 — Reason: Vendor did not deliver agreed services.',
    entityType: 'booking', entityId: 'bk001', entityName: 'EE-2025-001',
    severity: 'critical',
    metadata: { reason: 'Vendor did not deliver agreed services. Customer Rajesh Kumar filed complaint.' }
  },
  {
    id: 'al010',
    timestamp: '2026-05-23T17:00:00Z',
    actorId: 'a1', actorName: 'Priya Nair', actorRole: 'admin',
    action: 'Booking Assigned',
    description: 'Booking EE-2025-001 assigned to support agent Priya Nair for follow-up.',
    entityType: 'booking', entityId: 'bk001', entityName: 'EE-2025-001',
    severity: 'info',
    metadata: { before: { assignedTo: null }, after: { assignedTo: 'Priya Nair' } }
  },

  // ── VENDORS ───────────────────────────────────────────────────────────────
  {
    id: 'al011',
    timestamp: '2026-05-27T01:15:00Z',
    actorId: 'a1', actorName: 'Priya Nair', actorRole: 'admin',
    action: 'Vendor Suspended',
    description: 'Admin Priya Nair suspended vendor Vedic Rituals (Pandit Gopal Das) for 30 days. Reason: Policy violation — pricing fraud.',
    entityType: 'vendor', entityId: 'v5', entityName: 'Vedic Rituals',
    severity: 'critical',
    metadata: {
      before: { accountStatus: 'active' },
      after:  { accountStatus: 'suspended' },
      reason: 'Pricing fraud reported by multiple customers',
      duration: '30 days'
    }
  },
  {
    id: 'al012',
    timestamp: '2026-05-26T14:00:00Z',
    actorId: 'a1', actorName: 'Priya Nair', actorRole: 'admin',
    action: 'Vendor Verified',
    description: 'Admin Priya Nair approved verification for vendor Spice Garden Catering (Amit Sharma). All documents reviewed.',
    entityType: 'vendor', entityId: 'v1', entityName: 'Spice Garden Catering',
    severity: 'info',
    metadata: {
      before: { verificationStatus: 'under_review' },
      after:  { verificationStatus: 'verified' },
      extra: 'Documents: FSSAI License, GST Certificate — both approved'
    }
  },
  {
    id: 'al013',
    timestamp: '2026-05-26T10:30:00Z',
    actorId: 'a1', actorName: 'Priya Nair', actorRole: 'admin',
    action: 'Vendor Verification Rejected',
    description: 'Admin Priya Nair rejected verification for Palace Grounds Venue. Reason: Property documents invalid.',
    entityType: 'vendor', entityId: 'v3', entityName: 'Palace Grounds Venue',
    severity: 'warning',
    metadata: {
      before: { verificationStatus: 'under_review' },
      after:  { verificationStatus: 'rejected' },
      reason: 'Property documents invalid — expired ownership certificate'
    }
  },
  {
    id: 'al014',
    timestamp: '2026-05-25T08:45:00Z',
    actorId: 'system', actorName: 'System', actorRole: 'system',
    action: 'Vendor Registered',
    description: 'New vendor Royal Fleet Transport (Pandu Subramanian) registered. Verification pending.',
    entityType: 'vendor', entityId: 'v4', entityName: 'Royal Fleet Transport',
    severity: 'info',
    metadata: { extra: 'City: Chennai | Services: Transport | Joined: 2026-04-18' }
  },
  {
    id: 'al015',
    timestamp: '2026-05-24T13:20:00Z',
    actorId: 'system', actorName: 'System', actorRole: 'system',
    action: 'Vendor Document Uploaded',
    description: 'Vendor Palace Grounds Venue uploaded new document: Fire NOC Certificate.',
    entityType: 'vendor', entityId: 'v3', entityName: 'Palace Grounds Venue',
    severity: 'info',
    metadata: { extra: 'Document: Fire NOC | Status: Pending Review' }
  },
  {
    id: 'al016',
    timestamp: '2026-05-22T11:10:00Z',
    actorId: 'a1', actorName: 'Priya Nair', actorRole: 'admin',
    action: 'Vendor Action Required',
    description: 'Admin Priya Nair flagged vendor Royal Fleet Transport — additional documents required.',
    entityType: 'vendor', entityId: 'v4', entityName: 'Royal Fleet Transport',
    severity: 'warning',
    metadata: {
      before: { verificationStatus: 'pending' },
      after:  { verificationStatus: 'action_required' },
      reason: 'Missing: Vehicle RC, Commercial License'
    }
  },

  // ── CUSTOMERS ─────────────────────────────────────────────────────────────
  {
    id: 'al017',
    timestamp: '2026-05-27T00:55:00Z',
    actorId: 'a1', actorName: 'Priya Nair', actorRole: 'admin',
    action: 'Customer Warned',
    description: 'Admin Priya Nair issued a warning to customer Anand Reddy. Strike count: 1. Reason: Frequent cancellations.',
    entityType: 'customer', entityId: 'c3', entityName: 'Anand Reddy',
    severity: 'warning',
    metadata: {
      before: { accountStatus: 'active', strikes: 0 },
      after:  { accountStatus: 'warning', strikes: 1 },
      reason: 'Frequent cancellations without valid reason'
    }
  },
  {
    id: 'al018',
    timestamp: '2026-05-26T19:40:00Z',
    actorId: 'system', actorName: 'System', actorRole: 'system',
    action: 'Customer Registered',
    description: 'New customer Meena Sharma registered on the platform from Mumbai.',
    entityType: 'customer', entityId: 'c4', entityName: 'Meena Sharma',
    severity: 'info',
    metadata: { extra: 'City: Mumbai | Email: meena@demo.com | Joined: 2026-04-18' }
  },
  {
    id: 'al019',
    timestamp: '2026-05-25T15:30:00Z',
    actorId: 'a1', actorName: 'Priya Nair', actorRole: 'admin',
    action: 'Loyalty Points Adjusted',
    description: 'Admin Priya Nair manually credited 200 loyalty points to customer Rajesh Kumar. Reason: Compensation for delayed event.',
    entityType: 'customer', entityId: 'c1', entityName: 'Rajesh Kumar',
    severity: 'info',
    metadata: {
      before: { loyaltyPoints: 250 },
      after:  { loyaltyPoints: 450 },
      amount: 200,
      reason: 'Compensation for delayed execution of bk001'
    }
  },
  {
    id: 'al020',
    timestamp: '2026-05-24T12:00:00Z',
    actorId: 'a1', actorName: 'Priya Nair', actorRole: 'admin',
    action: 'Customer Restricted',
    description: 'Admin Priya Nair restricted customer Anand Reddy from making new bookings. Reason: Pending dispute resolution.',
    entityType: 'customer', entityId: 'c3', entityName: 'Anand Reddy',
    severity: 'critical',
    metadata: {
      before: { accountStatus: 'warning' },
      after:  { accountStatus: 'restricted' },
      reason: 'Pending dispute resolution on bk005'
    }
  },

  // ── EMPLOYEES ─────────────────────────────────────────────────────────────
  {
    id: 'al021',
    timestamp: '2026-05-26T09:00:00Z',
    actorId: 'a1', actorName: 'Priya Nair', actorRole: 'admin',
    action: 'Employee Added',
    description: 'Admin Priya Nair added new employee Ravi Verma as Support Agent in the Support department.',
    entityType: 'employee', entityId: 'e5', entityName: 'Ravi Verma',
    severity: 'info',
    metadata: {
      after: { role: 'support', department: 'Support', status: 'active' },
      extra: 'Employee ID: EMP-005 | Shift: Morning'
    }
  },
  {
    id: 'al022',
    timestamp: '2026-05-23T10:15:00Z',
    actorId: 'a1', actorName: 'Priya Nair', actorRole: 'admin',
    action: 'Employee Role Changed',
    description: 'Admin Priya Nair changed role of employee Neha Patel from Moderator to Finance Analyst.',
    entityType: 'employee', entityId: 'e3', entityName: 'Neha Patel',
    severity: 'warning',
    metadata: {
      before: { role: 'moderator', designation: 'Content Moderator' },
      after:  { role: 'finance',   designation: 'Finance Analyst' }
    }
  },
  {
    id: 'al023',
    timestamp: '2026-05-21T16:50:00Z',
    actorId: 'a1', actorName: 'Priya Nair', actorRole: 'admin',
    action: 'Employee Deactivated',
    description: 'Admin Priya Nair deactivated employee Kiran Rao. Status changed from Active to Terminated.',
    entityType: 'employee', entityId: 'e4', entityName: 'Kiran Rao',
    severity: 'critical',
    metadata: {
      before: { status: 'active' },
      after:  { status: 'terminated' },
      reason: 'Contract ended. Last working day: 2026-05-21'
    }
  },

  // ── CATEGORIES ────────────────────────────────────────────────────────────
  {
    id: 'al024',
    timestamp: '2026-05-25T11:30:00Z',
    actorId: 'a1', actorName: 'Priya Nair', actorRole: 'admin',
    action: 'Category Created',
    description: 'Admin Priya Nair created a new event category: "Mehendi & Haldi" with starting price ₹15,000.',
    entityType: 'category', entityId: 'cat_mehendi', entityName: 'Mehendi & Haldi',
    severity: 'info',
    metadata: {
      after: { name: 'Mehendi & Haldi', startingPrice: 15000, icon: 'bi-flower1' }
    }
  },
  {
    id: 'al025',
    timestamp: '2026-05-22T14:20:00Z',
    actorId: 'a1', actorName: 'Priya Nair', actorRole: 'admin',
    action: 'Category Updated',
    description: 'Admin Priya Nair updated event category "Wedding" — starting price changed from ₹1,20,000 to ₹1,50,000.',
    entityType: 'category', entityId: 'wedding', entityName: 'Wedding',
    severity: 'info',
    metadata: {
      before: { startingPrice: 120000 },
      after:  { startingPrice: 150000 }
    }
  },
  {
    id: 'al026',
    timestamp: '2026-05-20T10:05:00Z',
    actorId: 'a1', actorName: 'Priya Nair', actorRole: 'admin',
    action: 'Category Deleted',
    description: 'Admin Priya Nair deleted event category "Experimental". No active packages were linked.',
    entityType: 'category', entityId: 'cat_exp', entityName: 'Experimental',
    severity: 'warning',
    metadata: { reason: 'Category unused. No vendors or packages linked.' }
  },

  // ── PAYMENTS ──────────────────────────────────────────────────────────────
  {
    id: 'al027',
    timestamp: '2026-05-26T08:00:00Z',
    actorId: 'system', actorName: 'System', actorRole: 'system',
    action: 'Advance Payment Received',
    description: 'Advance payment of ₹40,000 received for booking EE-2026-002 by Sunita Patel.',
    entityType: 'payment', entityId: 'bk004', entityName: 'EE-2026-002',
    severity: 'info',
    metadata: { amount: 40000, extra: 'Payment Method: UPI | Transaction ID: TXN-20260526-001' }
  },
  {
    id: 'al028',
    timestamp: '2026-05-24T07:30:00Z',
    actorId: 'system', actorName: 'System', actorRole: 'system',
    action: 'Refund Issued',
    description: 'Refund of ₹12,000 processed for cancelled booking EE-2025-003. Refund to original payment method.',
    entityType: 'payment', entityId: 'bk003', entityName: 'EE-2025-003',
    severity: 'warning',
    metadata: { amount: 12000, extra: 'Refund TAT: 5–7 business days | Reason: Booking cancelled by customer' }
  },

  // ── SYSTEM ────────────────────────────────────────────────────────────────
  {
    id: 'al029',
    timestamp: '2026-05-27T03:00:00Z',
    actorId: 'system', actorName: 'System', actorRole: 'system',
    action: 'Bulk Notifications Sent',
    description: 'System dispatched bulk notifications to 48 vendors regarding updated GST compliance requirements.',
    entityType: 'system', entityId: 'notif-batch-001', entityName: 'Bulk Notification',
    severity: 'info',
    metadata: { extra: 'Recipients: 48 vendors | Type: Compliance Alert | Channel: Email + In-App' }
  },
  {
    id: 'al030',
    timestamp: '2026-05-26T06:00:00Z',
    actorId: 'system', actorName: 'System', actorRole: 'system',
    action: 'Quote Request Published',
    description: 'Global Quote Request #QR-2026-012 "Corporate Annual Meet — Bangalore" published and visible to all verified vendors.',
    entityType: 'system', entityId: 'qr-2026-012', entityName: 'QR-2026-012',
    severity: 'info',
    metadata: { extra: 'Budget: ₹3,00,000 | Deadline: 2026-06-10 | Category: Corporate' }
  },
  {
    id: 'al031',
    timestamp: '2026-05-25T18:00:00Z',
    actorId: 'a1', actorName: 'Priya Nair', actorRole: 'admin',
    action: 'Review Removed',
    description: 'Admin Priya Nair removed a flagged review on vendor Blooms & Bliss Decor. Reason: Fake/spam review.',
    entityType: 'system', entityId: 'rev-045', entityName: 'Review #rev-045',
    severity: 'warning',
    metadata: { reason: 'Detected as bot-generated spam review. Rating was 1★ with no booking proof.' }
  },
  {
    id: 'al032',
    timestamp: '2026-05-23T12:00:00Z',
    actorId: 'system', actorName: 'System', actorRole: 'system',
    action: 'Scheduled Maintenance',
    description: 'System maintenance window completed. All services operational. Downtime: 12 minutes.',
    entityType: 'system', entityId: 'sys-maint-001', entityName: 'System Maintenance',
    severity: 'info',
    metadata: { extra: 'Duration: 12 minutes | Affected: API Gateway | Restored: 2026-05-23T12:12:00Z' }
  }
];

@Injectable({ providedIn: 'root' })
export class AuditService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  private dynamicLogs = signal<AuditLog[]>([]);

  constructor() {
    this.initLogs();
  }

  private initLogs() {
    this.resetToMock();
  }

  private resetToMock() {
    const sorted = [...MOCK_AUDIT_LOGS].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    this.dynamicLogs.set(sorted);
  }

  logEvent(
    actorName: string,
    actorRole: 'admin' | 'support' | 'system',
    action: string,
    description: string,
    entityType: 'booking' | 'vendor' | 'customer' | 'employee' | 'category' | 'payment' | 'auth' | 'system',
    entityId: string,
    entityName: string,
    severity: 'info' | 'warning' | 'critical',
    metadata?: any
  ) {
    const newLog: AuditLog = {
      id: 'al' + Math.floor(Math.random() * 1000000),
      timestamp: new Date().toISOString(),
      actorId: actorRole === 'system' ? 'system' : (actorRole === 'admin' ? 'a1' : 's1'),
      actorName,
      actorRole,
      action,
      description,
      entityType,
      entityId,
      entityName,
      severity,
      metadata
    };

    this.dynamicLogs.update(list => [newLog, ...list]);
  }

  getAuditLogs(): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(`${this.apiUrl}/admin/audit-logs`, {
      headers: { 'X-Suppress-Errors': 'true' }
    }).pipe(
      catchError(() => of(this.dynamicLogs()).pipe(delay(400)))
    );
  }

  getAuditStats(): Observable<AuditStats> {
    return this.getAuditLogs().pipe(
      map(logs => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const weekStart = todayStart - 6 * 86400000;
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        const totalToday    = logs.filter(l => new Date(l.timestamp).getTime() >= todayStart).length;
        const totalThisWeek = logs.filter(l => new Date(l.timestamp).getTime() >= weekStart).length;
        const totalThisMonth= logs.filter(l => new Date(l.timestamp).getTime() >= monthStart).length;
        const criticalCount = logs.filter(l => l.severity === 'critical').length;

        const actorCounts: Record<string, number> = {};
        logs.forEach(l => {
          if (l.actorRole !== 'system') {
            actorCounts[l.actorName] = (actorCounts[l.actorName] || 0) + 1;
          }
        });
        const mostActiveActor = Object.keys(actorCounts).sort(
          (a, b) => actorCounts[b] - actorCounts[a]
        )[0] || 'System';

        return { totalToday, totalThisWeek, totalThisMonth, criticalCount, mostActiveActor };
      })
    );
  }
}
