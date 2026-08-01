import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { of, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Employee, EmployeeRole, EmployeeStatus } from '../../core/models/employee.model';
import { ConfirmService } from '../../shared/components/confirm-dialog';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-admin-employees',
  standalone: true,
  imports: [CommonModule, FormsModule, TitleCasePipe],
  templateUrl: './admin-employees.html',
  styleUrl: './admin-employees.css'
})
export class AdminEmployees implements OnInit {
  private confirm = inject(ConfirmService);
  private http = inject(HttpClient);

  employees = signal<Employee[]>([]);

  ngOnInit() {
    this.loadEmployees();
  }

  loadEmployees() {
    this.http.get<Employee[]>(`${environment.apiUrl}/admin/users/employees`).subscribe(data => {
      this.employees.set(data || []);
    });
  }

  addEmployee(emp: Omit<Employee, 'id'>): Observable<Employee> {
    return this.http.post<Employee>(`${environment.apiUrl}/admin/users/employees`, emp).pipe(
      tap(() => this.loadEmployees())
    );
  }

  updateEmployee(id: string, updates: Partial<Employee>): Observable<boolean> {
    return this.http.put<boolean>(`${environment.apiUrl}/admin/users/employees/${id}`, updates).pipe(
      tap(() => this.loadEmployees())
    );
  }

  updateEmployeeStatus(id: string, status: EmployeeStatus, reason?: string): Observable<boolean> {
    return this.http.post<boolean>(`${environment.apiUrl}/admin/users/employees/${id}/status`, {
      status,
      reason
    }).pipe(
      tap(() => this.loadEmployees())
    );
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
