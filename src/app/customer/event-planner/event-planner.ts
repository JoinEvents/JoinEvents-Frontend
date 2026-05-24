import { Component, signal, inject, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MockApiService } from '../../core/services/mock-api.service';
import { AuthService } from '../../core/services/auth.service';
import { RfpService } from '../../core/services/rfp.service';
import { NotificationService } from '../../core/services/notification.service';
import { ServiceCategoryDef } from '../../core/models/service.model';

interface PlannerService { category: string; name: string; price: number; qty: number; }

@Component({ 
  selector: 'app-event-planner', 
  standalone: true,
  imports: [CommonModule, FormsModule], 
  templateUrl: './event-planner.html', 
  styleUrl: './event-planner.css' 
})
export class EventPlanner implements OnInit, OnDestroy {
  private api = inject(MockApiService);
  private auth = inject(AuthService);
  private rfpService = inject(RfpService);
  private notifService = inject(NotificationService);
  private router = inject(Router);

  constructor() {
    effect(() => {
      document.body.classList.toggle('modal-open', this.showSuccessModal());
    });
  }

  ngOnDestroy() {
    document.body.classList.remove('modal-open');
  }

  categories = signal<ServiceCategoryDef[]>([]);
  selectedServices = signal<PlannerService[]>([]);
  eventDate = '';
  eventCity = '';
  guestCount = 100;
  eventName = '';
  saved = false;
  showSuccessModal = signal(false);

  ngOnInit() { this.api.getServiceCategories().subscribe(c => this.categories.set(c)); }

  addService(cat: ServiceCategoryDef) {
    const exists = this.selectedServices().find(s => s.category === cat.id);
    if (!exists) {
      const prices: Record<string, number> = { venue: 50000, catering: 45000, decoration: 30000, transport: 15000, priest: 8000, manpower: 20000, photography: 25000, music: 18000 };
      this.selectedServices.update(s => [...s, { category: cat.id as string, name: cat.name, price: prices[cat.id] ?? 10000, qty: 1 }]);
    }
  }

  removeService(cat: string) { this.selectedServices.update(s => s.filter(x => x.category !== cat)); }
  isAdded(cat: string) { return this.selectedServices().some(s => s.category === cat); }
  getTotal() { return this.selectedServices().reduce((acc, s) => acc + s.price * s.qty, 0); }
  getGst() { return Math.round(this.getTotal() * 0.18); }
  getAdvance() { return Math.round(this.getTotal() * 0.2); }

  savePlan() {
    this.saved = true;
    const user = this.auth.currentUser();

    // 1. Submit as RFP for Vendors to bid
    this.rfpService.createRfp({
      customerId: user?.id || 'c1',
      customerName: user?.name || 'Rajesh Kumar',
      title: this.eventName || `${user?.name || 'My'} Custom Event Plan`,
      eventTypeId: 'custom',
      eventTypeName: 'Custom Event',
      eventDate: this.eventDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      city: this.eventCity || 'Hyderabad',
      guestCount: this.guestCount,
      budgetMin: this.getTotal(),
      budgetMax: Math.round((this.getTotal() + this.getGst()) * 1.1),
      requirements: `Customer planned customized services: ${this.selectedServices().map(s => s.name).join(', ')}. Need competitive bids.`,
      servicesNeeded: this.selectedServices().map(s => s.name)
    }).subscribe(() => {
      // 2. Trigger real-time App Notification
      this.notifService.addNotification({
        title: 'Event Plan Submitted',
        message: `Your custom plan "${this.eventName || 'Custom Event'}" has been successfully broadcasted to vendors on the RFP Board!`,
        type: 'booking',
        targetRole: 'customer',
        targetUserId: user?.id || 'c1'
      });

      // 3. Display luxury success modal
      this.showSuccessModal.set(true);
      this.saved = false;
    });
  }

  goToRfp() {
    this.showSuccessModal.set(false);
    this.router.navigate(['/rfp']);
  }

  goToDashboard() {
    this.showSuccessModal.set(false);
    this.router.navigate(['/dashboard']);
  }
}
