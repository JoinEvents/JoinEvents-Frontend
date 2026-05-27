// TODO: Replace MockApiService with real AdminEmployeeService when backend CRUD endpoints exist
// Currently uses local in-memory fallback since no backend employee CRUD endpoints exist yet
import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { of, Observable } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Employee, EmployeeRole, EmployeeStatus } from '../../core/models/employee.model';
import { ConfirmService } from '../../shared/components/confirm-dialog';

@Component({
  selector: 'app-admin-employees',
  standalone: true,
  imports: [CommonModule, FormsModule, TitleCasePipe],
  templateUrl: './admin-employees.html',
  styleUrl: './admin-employees.css'
})
export class AdminEmployees {
  private confirm = inject(ConfirmService);

  employees = signal<Employee[]>([
    { id: 'e1', name: 'Priya Nair', email: 'admin@demo.com', phone: '+91 99887 76655', employeeId: 'ADM-0001', role: 'admin', department: 'Platform Operations', designation: 'Chief Administrator', shift: 'General (9 AM – 6 PM)', joinedDate: '2024-06-15', status: 'active', lastLogin: '2026-05-02 09:15 AM', ticketsResolved: 0, performanceScore: 98 },
    { id: 'e2', name: 'Rahul Support', email: 'support@demo.com', phone: '+91 99000 11223', employeeId: 'SUP-7729', role: 'support', department: 'Customer Satisfaction', designation: 'Support Officer', shift: 'General (9 AM – 6 PM)', joinedDate: '2025-03-10', status: 'active', lastLogin: '2026-05-02 08:47 AM', ticketsResolved: 347, performanceScore: 92 },
    { id: 'e3', name: 'Kavitha Reddy', email: 'kavitha@joinevents.com', phone: '+91 98112 33445', employeeId: 'SUP-7730', role: 'support', department: 'Customer Satisfaction', designation: 'Senior Support Agent', shift: 'Evening (2 PM – 10 PM)', joinedDate: '2025-01-20', status: 'active', lastLogin: '2026-05-01 09:58 PM', ticketsResolved: 512, performanceScore: 96 },
    { id: 'e4', name: 'Arun Mehta', email: 'arun@joinevents.com', phone: '+91 97001 22334', employeeId: 'MOD-4401', role: 'moderator', department: 'Content & Trust', designation: 'Content Moderator', shift: 'General (9 AM – 6 PM)', joinedDate: '2025-06-05', status: 'active', lastLogin: '2026-05-01 06:12 PM', ticketsResolved: 180, performanceScore: 88 },
    { id: 'e5', name: 'Deepa Sharma', email: 'deepa@joinevents.com', phone: '+91 96223 44556', employeeId: 'FIN-3301', role: 'finance', department: 'Finance & Settlements', designation: 'Finance Analyst', shift: 'General (9 AM – 6 PM)', joinedDate: '2025-02-14', status: 'active', lastLogin: '2026-05-02 10:02 AM', ticketsResolved: 0, performanceScore: 94 },
    { id: 'e6', name: 'Vikram Singh', email: 'vikram@joinevents.com', phone: '+91 95334 55667', employeeId: 'SUP-7731', role: 'support', department: 'Customer Satisfaction', designation: 'Night Shift Support', shift: 'Night (10 PM – 6 AM)', joinedDate: '2025-08-22', status: 'on_leave', lastLogin: '2026-04-28 05:55 AM', ticketsResolved: 203, performanceScore: 85 },
    { id: 'e7', name: 'Neha Gupta', email: 'neha@joinevents.com', phone: '+91 94445 66778', employeeId: 'MOD-4402', role: 'moderator', department: 'Content & Trust', designation: 'Review Moderator', shift: 'General (9 AM – 6 PM)', joinedDate: '2025-09-01', status: 'suspended', lastLogin: '2026-04-15 11:30 AM', ticketsResolved: 94, performanceScore: 62, suspensionReason: 'Policy violation — unauthorized data export' },
    { id: 'e8', name: 'Sanjay Patel', email: 'sanjay@joinevents.com', phone: '+91 93556 77889', employeeId: 'ADM-0002', role: 'admin', department: 'Platform Operations', designation: 'Operations Manager', shift: 'General (9 AM – 6 PM)', joinedDate: '2024-11-01', status: 'active', lastLogin: '2026-05-02 08:30 AM', ticketsResolved: 0, performanceScore: 95 },
  ]);

  addEmployee(emp: Omit<Employee, 'id'>): Observable<Employee> {
    const newEmp: Employee = { ...emp, id: 'e' + Math.floor(Math.random() * 100000) } as Employee;
    this.employees.update(list => [...list, newEmp]);
    return of(newEmp).pipe(delay(200));
  }

  updateEmployee(id: string, updates: Partial<Employee>): Observable<boolean> {
    this.employees.update(list =>
      list.map(e => e.id === id ? { ...e, ...updates } : e)
    );
    return of(true).pipe(delay(200));
  }

  updateEmployeeStatus(id: string, status: EmployeeStatus, reason?: string): Observable<boolean> {
    this.employees.update(list =>
      list.map(e => {
        if (e.id === id) {
          return { ...e, status, suspensionReason: status === 'suspended' ? reason : undefined };
        }
        return e;
      })
    );
    return of(true).pipe(delay(200));
  }

  searchQuery = signal('');
  roleFilter = signal('all');
  statusFilter = signal('all');

  // Add/Edit Form
  showForm = signal(false);
  editingEmployee = signal<Employee | null>(null);
  formData = signal<Partial<Employee>>({
    name: '', email: '', phone: '', employeeId: '', role: 'support',
    department: '', designation: '', shift: 'General (9 AM – 6 PM)',
    joinedDate: new Date().toISOString().split('T')[0], status: 'active',
    ticketsResolved: 0, performanceScore: 0
  });

  errors = signal<Record<string, string>>({});

  // Suspension form
  suspendingEmployee = signal<Employee | null>(null);
  suspendReason = signal('');

  readonly roles: EmployeeRole[] = ['admin', 'support', 'moderator', 'finance'];
  readonly shifts = ['General (9 AM – 6 PM)', 'Evening (2 PM – 10 PM)', 'Night (10 PM – 6 AM)', 'Rotational'];

  filteredEmployees = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const role = this.roleFilter();
    const status = this.statusFilter();

    return this.employees().filter(e => {
      const matchesSearch = !query ||
        e.name.toLowerCase().includes(query) ||
        e.email.toLowerCase().includes(query) ||
        e.employeeId.toLowerCase().includes(query) ||
        e.department.toLowerCase().includes(query);

      const matchesRole = role === 'all' || e.role === role;
      const matchesStatus = status === 'all' || e.status === status;

      return matchesSearch && matchesRole && matchesStatus;
    });
  });

  // Stats
  totalActive = computed(() => this.employees().filter(e => e.status === 'active').length);
  totalOnLeave = computed(() => this.employees().filter(e => e.status === 'on_leave').length);
  totalSuspended = computed(() => this.employees().filter(e => e.status === 'suspended').length);

  openAddForm() {
    this.editingEmployee.set(null);
    this.formData.set({
      name: '', email: '', phone: '', employeeId: '', role: 'support',
      department: 'Customer Satisfaction', designation: '', shift: 'General (9 AM – 6 PM)',
      joinedDate: new Date().toISOString().split('T')[0], status: 'active',
      ticketsResolved: 0, performanceScore: 0
    });
    this.errors.set({});
    this.showForm.set(true);
  }

  openEditForm(emp: Employee) {
    this.editingEmployee.set(emp);
    this.formData.set({ ...emp });
    this.errors.set({});
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.editingEmployee.set(null);
  }

  saveEmployee() {
    if (!this.validateAll()) return;

    const data = this.formData();
    const editing = this.editingEmployee();

    if (editing) {
      this.updateEmployee(editing.id, data).subscribe(() => this.closeForm());
    } else {
      this.addEmployee(data as Omit<Employee, 'id'>).subscribe(() => this.closeForm());
    }
  }

  validateAll(): boolean {
    const data = this.formData();
    const newErrors: Record<string, string> = {};

    if (!data.name?.trim()) newErrors['name'] = 'Full name is required';
    else if (data.name.trim().length < 3) newErrors['name'] = 'Name must be at least 3 characters';

    if (!data.employeeId?.trim()) newErrors['employeeId'] = 'Employee ID is required';
    else if (!/^[A-Z]{3}-\d{4}$/.test(data.employeeId)) newErrors['employeeId'] = 'Format must be AAA-0000';
    else if (!this.editingEmployee() && this.employees().some(e => e.employeeId === data.employeeId)) {
      newErrors['employeeId'] = 'This ID is already assigned';
    }

    if (!data.email?.trim()) newErrors['email'] = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) newErrors['email'] = 'Invalid email address';

    if (data.phone && !/^\+?\d{10,12}$/.test(data.phone.replace(/\s/g, ''))) {
      newErrors['phone'] = 'Invalid phone number format';
    }

    this.errors.set(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  openSuspendForm(emp: Employee) {
    this.suspendingEmployee.set(emp);
    this.suspendReason.set('');
  }

  closeSuspend() {
    this.suspendingEmployee.set(null);
  }

  confirmSuspend() {
    const emp = this.suspendingEmployee();
    if (emp && this.suspendReason().trim()) {
      this.updateEmployeeStatus(emp.id, 'suspended', this.suspendReason()).subscribe(() => {
        this.closeSuspend();
      });
    }
  }

  async reactivateEmployee(emp: Employee) {
    const confirmed = await this.confirm.ask({
      title: 'Reactivate Employee',
      message: `Restore active status for ${emp.name}?`,
      confirmText: 'Reactivate',
      type: 'primary'
    });
    if (confirmed) {
      this.updateEmployeeStatus(emp.id, 'active').subscribe();
    }
  }

  async terminateEmployee(emp: Employee) {
    const confirmed = await this.confirm.ask({
      title: 'Terminate Employee',
      message: `Are you sure you want to terminate ${emp.name}? This action is severe and permanent.`,
      confirmText: 'Terminate',
      type: 'danger'
    });
    if (confirmed) {
      this.updateEmployeeStatus(emp.id, 'terminated').subscribe();
    }
  }

  roleColor(role: EmployeeRole): string {
    const m: Record<string, string> = {
      admin: 'ee-badge-primary',
      support: 'ee-badge-warning',
      moderator: 'ee-badge-info',
      finance: 'ee-badge-success'
    };
    return m[role] || 'ee-badge-secondary';
  }

  statusColor(status: EmployeeStatus): string {
    const m: Record<string, string> = {
      active: 'ee-badge-success',
      on_leave: 'ee-badge-warning',
      suspended: 'ee-badge-danger',
      terminated: 'ee-badge-dark'
    };
    return m[status] || 'ee-badge-secondary';
  }

  statusLabel(status: string): string {
    const m: Record<string, string> = {
      active: 'Active', on_leave: 'On Leave', suspended: 'Suspended', terminated: 'Terminated'
    };
    return m[status] || status;
  }

  roleIcon(role: EmployeeRole): string {
    const m: Record<string, string> = {
      admin: 'bi-shield-lock-fill',
      support: 'bi-headset',
      moderator: 'bi-eye-fill',
      finance: 'bi-currency-rupee'
    };
    return m[role] || 'bi-person';
  }

  perfColor(score: number): string {
    if (score >= 90) return '#10B981';
    if (score >= 75) return '#F59E0B';
    return '#EF4444';
  }

  updateFormField(field: string, value: any) {
    this.formData.update(d => ({ ...d, [field]: value }));
    // Clear error for this field when user types
    if (this.errors()[field]) {
      this.errors.update(errs => {
        const newErrs = { ...errs };
        delete newErrs[field];
        return newErrs;
      });
    }
  }
}
