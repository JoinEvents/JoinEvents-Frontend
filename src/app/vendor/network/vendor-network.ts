import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Vendor } from '../../core/models/vendor.model';
import { ToastService } from '../../core/services/toast.service';
import { environment } from '../../../environments/environment';
import { catchError, of } from 'rxjs';

type ConnectionStatus = 'none' | 'pending' | 'active';

@Component({
  selector: 'app-vendor-network',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vendor-network.html',
  styleUrl: './vendor-network.css'
})
export class VendorNetwork implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private router = inject(Router);

  vendors = signal<Vendor[]>([]);
  activeTab = signal('all'); // all, active, pending, venue, catering, decorator
  searchTerm = signal('');
  
  // Track connections: vendorId -> ConnectionStatus
  connections = signal<Record<string, ConnectionStatus>>({});

  activePartnersCount = computed(() => 
    Object.values(this.connections()).filter(s => s === 'active').length
  );

  pendingInvitesCount = computed(() => 
    Object.values(this.connections()).filter(s => s === 'pending').length
  );

  ngOnInit() {
    this.http.get<Vendor[]>(`${environment.apiUrl}/admin/vendors`).pipe(catchError(() => of([]))).subscribe(v => {
      // Exclude current logged in vendor (mocked as v1)
      const list = v.filter(vendor => vendor.id !== 'v1');
      this.vendors.set(list);

      // Initialize some mock connections for demonstration
      const initialConnections: Record<string, ConnectionStatus> = {};
      if (list.length > 0) {
        initialConnections[list[0].id] = 'active';
        if (list.length > 1) initialConnections[list[1].id] = 'pending';
        if (list.length > 2) initialConnections[list[2].id] = 'active';
      }
      this.connections.set(initialConnections);
    });
  }

  get filteredVendors() {
    let list = this.vendors();
    const tab = this.activeTab();
    const search = this.searchTerm().toLowerCase();
    
    // Apply Tab Filter
    if (tab !== 'all') {
      if (tab === 'active' || tab === 'pending') {
        list = list.filter(v => this.getConnectionStatus(v.id) === tab);
      } else {
        list = list.filter(v => {
          const cat = v.serviceCategory || (v.services && v.services[0]) || '';
          return cat.toLowerCase() === tab;
        });
      }
    }

    // Apply Search Filter
    if (search) {
      list = list.filter(v => 
        v.businessName.toLowerCase().includes(search) || 
        v.city.toLowerCase().includes(search) ||
        (v.serviceCategory || '').toLowerCase().includes(search)
      );
    }
    
    return list;
  }

  getConnectionStatus(vendorId: string): ConnectionStatus {
    return this.connections()[vendorId] || 'none';
  }

  requestCollaboration(vendor: Vendor) {
    const currentStatus = this.getConnectionStatus(vendor.id);
    
    if (currentStatus === 'none') {
      this.connections.update(c => ({ ...c, [vendor.id]: 'pending' }));
      this.toast.success(`Collaboration request sent to ${vendor.businessName}!`);
    } else if (currentStatus === 'active') {
      this.router.navigate(['/vendor/messages']);
    }
  }
}
