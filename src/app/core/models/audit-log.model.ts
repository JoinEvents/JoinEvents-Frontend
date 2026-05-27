export type AuditSeverity = 'info' | 'warning' | 'critical';

export type AuditEntityType =
  | 'booking'
  | 'vendor'
  | 'customer'
  | 'employee'
  | 'category'
  | 'payment'
  | 'auth'
  | 'system';

export type AuditActorRole = 'admin' | 'support' | 'system';

export interface AuditLogMeta {
  before?: Record<string, any>;
  after?: Record<string, any>;
  reason?: string;
  duration?: string;
  amount?: number;
  extra?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;           // ISO 8601
  actorId: string;
  actorName: string;
  actorRole: AuditActorRole;
  action: string;              // Short: "Vendor Suspended"
  description: string;         // Full sentence
  entityType: AuditEntityType;
  entityId: string;
  entityName: string;          // Booking number / vendor name / customer name
  severity: AuditSeverity;
  metadata?: AuditLogMeta;
}

export interface AuditStats {
  totalToday: number;
  totalThisWeek: number;
  totalThisMonth: number;
  criticalCount: number;
  mostActiveActor: string;
}
