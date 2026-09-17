export type EmployeeRole = 'admin' | 'support' | 'moderator' | 'finance';
export type EmployeeStatus = 'active' | 'on_leave' | 'suspended' | 'terminated';

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  employeeId: string;
  role: EmployeeRole;
  department: string;
  designation: string;
  shift: string;
  joinedDate: string;
  status: EmployeeStatus;
  avatar?: string;
  lastLogin?: string;
  ticketsResolved?: number;
  performanceScore?: number;
  suspensionReason?: string;
}
