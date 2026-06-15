import { Component, signal, computed, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { inject } from '@angular/core';
import { EventCategoryService } from '../../core/services/event-category.service';
import { PackageService } from '../../core/services/package.service';
import { AuthService } from '../../core/services/auth.service';
import { EventType } from '../../core/models/event.model';

import { FormsModule } from '@angular/forms';
import { AiPlanner } from '../../customer/ai-planner/ai-planner';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-get-start',
  standalone: true,
  imports: [RouterLink, FormsModule, AiPlanner],
  templateUrl: './get-start.html',
  styleUrl: './get-start.css'
})
export class GetStart implements OnInit {
  private eventCategoryService = inject(EventCategoryService);
  private packageService = inject(PackageService);
  private auth = inject(AuthService);
  private router = inject(Router);
  public theme = inject(ThemeService);

  eventTypes = signal<EventType[]>([]);
  currentSlide = signal(0);
  searchQuery = signal('');
  
  readonly quickCategories = [
    { id: 'wedding', name: 'Weddings', icon: 'bi-hearts', color: '#FF6B35' },
    { id: 'birthday', name: 'Birthdays', icon: 'bi-balloon-heart', color: '#6B21A8' },
    { id: 'corporate', name: 'Corporate', icon: 'bi-briefcase', color: '#0EA5E9' },
    { id: 'beauty', name: 'Beauty', icon: 'bi-brush', color: '#D946EF' },
    { id: 'travel', name: 'Travel', icon: 'bi-car-front-fill', color: '#10B981' },
    { id: 'shopping', name: 'Shopping', icon: 'bi-bag-heart-fill', color: '#F59E0B' }
  ];

  readonly topVenues = signal([
    { id: 'v1', name: 'The Royal Grandeur', city: 'Jaipur', image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=800', capacity: '500-2000 Pax', type: 'Heritage Palace' },
    { id: 'v2', name: 'Seaside Pavilion', city: 'Goa', image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=800', capacity: '200-800 Pax', type: 'Beach Resort' },
    { id: 'v3', name: 'Emerald Meadows', city: 'Bangalore', image: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&q=80&w=800', capacity: '1000-3000 Pax', type: 'Open Lawn' }
  ]);

  readonly topPlanners = signal([
    { id: 'p1', name: 'DreamCraft Weddings', rating: '4.9', image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=800', label: 'Platinum Partner' },
    { id: 'p2', name: 'Elite Occasions', rating: '4.8', image: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&q=80&w=800', label: 'Curated' },
    { id: 'p3', name: 'Signature Events', rating: '5.0', image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=800', label: 'Top Rated' }
  ]);

  readonly premiumPackages = signal([
    { 
      id: 'pkg1', 
      name: 'The Diamond Wedding Package', 
      price: 5600000, 
      pax: '500 Pax', 
      rooms: '50 Rooms', 
      catering: 'Mix (Veg/Non-Veg)',
      image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=800',
      validity: '15 Days remaining'
    },
    { 
      id: 'pkg2', 
      name: 'Royal Heritage Celebration', 
      price: 3500000, 
      pax: '300 Pax', 
      rooms: '30 Rooms', 
      catering: 'Pure Veg',
      image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=800',
      validity: '08 Days remaining'
    }
  ]);

  filteredTopVenues = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.topVenues();
    return this.topVenues().filter(v => 
      v.name.toLowerCase().includes(q) || 
      v.city.toLowerCase().includes(q) || 
      v.type.toLowerCase().includes(q)
    );
  });

  filteredTopPlanners = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.topPlanners();
    return this.topPlanners().filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.label.toLowerCase().includes(q)
    );
  });

  filteredPremiumPackages = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.premiumPackages();
    return this.premiumPackages().filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.catering.toLowerCase().includes(q)
    );
  });

  readonly playbook = [
    { title: 'The Engagement', status: 'completed', icon: 'bi-gem', desc: 'Set the ring and the date.' },
    { title: 'Venue Booking', status: 'active', icon: 'bi-building', desc: 'Find the perfect place.' },
    { title: 'Vendor Shortlisting', status: 'pending', icon: 'bi-people', desc: 'Select top-rated professionals.' },
    { title: 'Final Execution', status: 'pending', icon: 'bi-stars', desc: 'Experience the magic seamlessly.' }
  ];

  readonly quotations = [
    { title: 'Wedding Quotation', desc: 'Planning your big day? Tell us about your vision and get a bundled quote.', icon: 'bi-heart-fill', color: '#E91E8C', bg: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&q=80&w=800' },
    { title: 'Corporate Quotation', desc: 'Hosting a seminar or product launch? We offer specialized management.', icon: 'bi-briefcase-fill', color: '#0EA5E9', bg: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&q=80&w=800' },
    { title: 'International Wedding', desc: 'Dreaming of a destination wedding? We manage logistics across borders.', icon: 'bi-globe', color: '#D97706', bg: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=800' }
  ];

  onSearch() {
    const q = this.searchQuery().trim();
    if (q) {
      this.router.navigate(['/events'], { queryParams: { q } });
    } else {
      this.router.navigate(['/events']);
    }
  }

  ngOnInit() {
    if (this.auth.isAuthenticated()) {
      const role = this.auth.getRole();
      const path = role === 'customer' ? '/dashboard' : `/${role}/dashboard`;
      this.router.navigate([path]);
    }
    this.eventCategoryService.getAll().subscribe(types => this.eventTypes.set(types));
    
    this.packageService.getPackages().subscribe({
      next: (packages) => {
        if (packages && packages.length > 0) {
          // Map premiumPackages
          const mappedPackages = packages.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            pax: p.maxGuests ? `${p.maxGuests} Pax` : '300 Pax',
            rooms: p.roomCount ? `${p.roomCount} Rooms` : '30 Rooms',
            catering: p.vegOnly ? 'Pure Veg' : 'Veg/Non-Veg',
            image: p.image || 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=800',
            validity: p.offerExpiresIn || '15 Days remaining'
          }));
          this.premiumPackages.set(mappedPackages);

          // Map topVenues: filter packages that are wedding/corporate or contain venue keywords
          const venues = packages
            .filter(p => p.name.toLowerCase().includes('hall') || p.name.toLowerCase().includes('lawn') || p.name.toLowerCase().includes('venue') || p.category === 'wedding')
            .map(p => ({
              id: p.id,
              name: p.name,
              city: p.location || 'Hyderabad',
              image: p.image || 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=800',
              capacity: p.maxGuests ? `${p.maxGuests} Pax` : '200-800 Pax',
              type: p.tier || 'Premium Venue'
            }));
          if (venues.length > 0) {
            this.topVenues.set(venues);
          }

          // Map topPlanners: extract unique vendor information
          const planners = packages.map(p => ({
            id: p.vendorId || p.id,
            name: p.vendorName && p.vendorName !== '' ? p.vendorName : (p.name ? `${p.name.replace(/package|s$/gi, '').trim()} Organizer` : 'DreamCraft Weddings'),
            rating: p.rating ? p.rating.toFixed(1) : (4.5 + Math.random() * 0.5).toFixed(1),
            image: p.image || 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=800',
            label: p.tier || 'Platinum Partner'
          }));
          
          // Remove duplicate planners by name
          const uniquePlanners = Array.from(new Map(planners.map(pl => [pl.name, pl])).values()).slice(0, 6);
          if (uniquePlanners.length > 0) {
            this.topPlanners.set(uniquePlanners);
          }
        }
      },
      error: (err) => console.error('Failed to load DB packages for index page:', err)
    });

    setInterval(() => {
      this.currentSlide.update(s => (s + 1) % 3);
    }, 4500);
  }

  readonly heroSlides = [
    { title: 'Plan Your Dream Wedding', subtitle: 'Shaadi', bg: 'linear-gradient(135deg,#1E293B 0%,#6B21A8 50%,#E91E8C 100%)' },
    { title: 'Corporate Events That Impress', subtitle: 'Karobar', bg: 'linear-gradient(135deg,#0F172A 0%,#0EA5E9 60%,#6B21A8 100%)' },
    { title: 'Sacred Rituals, Flawlessly Done', subtitle: 'Puja & Hawan', bg: 'linear-gradient(135deg,#1E293B 0%,#D97706 50%,#FF6B35 100%)' },
  ];

  readonly features = [
    { icon: 'bi-shield-check', title: 'Verified Vendors', desc: 'Every vendor goes through a strict verification process' },
    { icon: 'bi-calendar2-check', title: 'Easy Booking', desc: 'Book your event in minutes with advance payment' },
    { icon: 'bi-chat-dots', title: '24/7 Support', desc: 'Our team is always available for any assistance' },
    { icon: 'bi-graph-up', title: 'Live Tracking', desc: 'Monitor your event progress in real time' },
  ];


  handleImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    if (img.nextElementSibling) {
      (img.nextElementSibling as HTMLElement).style.display = 'block';
    }
  }
}
