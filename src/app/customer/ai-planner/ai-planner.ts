import { Component, signal, inject, ViewChild, ElementRef, AfterViewChecked, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { PackageService } from '../../core/services/package.service';
import { AiService } from '../../core/services/ai.service';
import { BookingService } from '../../core/services/booking.service';
import { LoyaltyService, LoyaltyBalance } from '../../core/services/loyalty.service';
import { GuaranteeService } from '../../core/services/guarantee.service';
import { RfpService } from '../../core/services/rfp.service';
import { AuthService } from '../../core/services/auth.service';
import { Booking } from '../../core/models/booking.model';
import { EventRfp } from '../../core/models/rfp.model';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  type: 'text' | 'packages' | 'bookings' | 'loyalty' | 'guarantee' | 'rfps' | 'nav-links';
  content: string;
  packages?: any[];
  bookings?: Booking[];
  loyaltyData?: LoyaltyBalance;
  rfps?: EventRfp[];
  navLinks?: NavLink[];
  timestamp: Date;
}

interface NavLink {
  label: string;
  route: string;
  icon: string;
}

interface RoshiState {
  category?: string;
  location?: string;
  maxBudget?: number;
  guests?: number;
  sustainabilityOnly?: boolean;
}



@Component({
  selector: 'app-ai-planner',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ai-planner.html',
  styleUrl: './ai-planner.css'
})
export class AiPlanner implements AfterViewChecked, OnInit {
  private packageService = inject(PackageService);
  private aiService = inject(AiService);
  private bookingService = inject(BookingService);
  private loyaltyService = inject(LoyaltyService);
  private guaranteeService = inject(GuaranteeService);
  private rfpService = inject(RfpService);
  private authService = inject(AuthService);
  private router = inject(Router);

  @ViewChild('chatContainer') private chatContainer!: ElementRef;

  isOpen = this.aiService.isOpen;
  isThinking = signal(false);
  userInput = '';

  // Conversation state tracking
  state = signal<RoshiState>({});
  
  // Cached user data
  private userBookings: Booking[] = [];
  private userLoyalty: LoyaltyBalance | null = null;
  private userRfps: EventRfp[] = [];
  private dataLoaded = false;

  // Suggestion chips
  suggestionChips = signal<string[]>([
    '🔍 Find Packages',
    '📋 My Bookings',
    '🎁 My Rewards',
    '❓ How it Works'
  ]);
  
  chatHistory = signal<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'ai',
      type: 'text',
      content: `Hey there! I'm <strong>Roshi</strong>, your JoinEvents AI concierge 🌟<br><br>
      I can help you with:<br>
      • <strong>Find event packages</strong> — venues, caterers, decorators<br>
      • <strong>Check your bookings</strong> — status, invoices, details<br>
      • <strong>Loyalty & rewards</strong> — points, tiers, referrals<br>
      • <strong>Create RFP quotes</strong> — get vendor bids<br>
      • <strong>Policies & guarantees</strong> — cancellation, refunds, trust safety<br><br>
      <em>Just type naturally or tap a suggestion below!</em>`,
      timestamp: new Date()
    }
  ]);

  ngOnInit() {
    this.loadUserData();
  }

  private loadUserData() {
    const user = this.authService.currentUser();
    if (!user || this.dataLoaded) return;

    // Fetch bookings
    this.bookingService.getBookings(user.id).subscribe({
      next: bookings => { this.userBookings = bookings || []; },
      error: () => { this.userBookings = this.bookingService.globalBookings() || []; }
    });

    // Fetch loyalty
    this.loyaltyService.getBalance(user.id).subscribe({
      next: balance => { this.userLoyalty = balance; },
      error: () => { this.userLoyalty = { points: 0, tier: 'Bronze', pointsToNextTier: 400 }; }
    });

    // Fetch RFPs
    this.rfpService.getRfps(user.id).subscribe({
      next: rfps => { this.userRfps = rfps || []; },
      error: () => { this.userRfps = []; }
    });

    this.dataLoaded = true;
  }

  toggleChat() {
    this.aiService.toggle();
    if (this.isOpen()) {
      this.loadUserData();
      this.scrollToBottom();
    }
  }

  selectChip(chip: string) {
    // Strip emoji prefix for cleaner processing
    this.userInput = chip.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*/u, '');
    this.sendMessage();
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
    this.aiService.close();
  }

  sendMessage() {
    const text = this.userInput.trim();
    if (!text) return;

    this.chatHistory.update(h => [...h, {
      id: 'msg-' + Date.now(),
      sender: 'user',
      type: 'text',
      content: text,
      timestamp: new Date()
    }]);

    this.userInput = '';
    this.isThinking.set(true);

    setTimeout(() => {
      this.processPrompt(text);
    }, 800 + Math.random() * 600);
  }

  private processPrompt(prompt: string) {
    const p = prompt.toLowerCase().trim();
    const cleanP = p.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"]/g, "").trim();

    // ── 1. Reset / Start Over ──
    if (/^(reset|start over|clear|restart|new chat)$/i.test(cleanP)) {
      this.state.set({});
      this.reply(`I've reset our conversation. What can I help you with today? 😊`);
      this.setDefaultChips();
      return;
    }

    // ── 2. Greetings ──
    if (/^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening)|yo|hola|namaste|sup|howdy)$/i.test(cleanP)) {
      const user = this.authService.currentUser();
      const name = user?.name ? `, ${user.name.split(' ')[0]}` : '';
      this.reply(`Hello${name}! 😊 How can I help you today?<br><br>You can ask me to find packages, check your bookings, view rewards, or ask about our policies!`);
      this.setDefaultChips();
      return;
    }

    // ── 3. Identity / Help ──
    if (/^(help|info|what can you do|who are you|what is your name|what are you|menu)$/i.test(cleanP)) {
      this.reply(`I am <strong>Roshi</strong>, your JoinEvents AI concierge! 🌸<br><br>
      Here's everything I can do:<br>
      🔍 <strong>Search packages</strong> — by category, city, budget, guest count<br>
      📋 <strong>Check bookings</strong> — status, upcoming events, details<br>
      🎁 <strong>Loyalty rewards</strong> — points, tier, history, referrals<br>
      📝 <strong>Create RFP quotes</strong> — get competitive vendor bids<br>
      🛡️ <strong>Guarantees & trust</strong> — escrow, no-show protection<br>
      ❌ <strong>Cancellation policy</strong> — refund calculations<br>
      💳 <strong>Payment info</strong> — methods, EMI, security<br>
      💬 <strong>Vendor messaging</strong> — how to contact vendors<br>
      ⭐ <strong>Reviews</strong> — writing, earning points<br>
      🎫 <strong>Support tickets</strong> — create & track<br>
      👤 <strong>Profile help</strong> — settings, notifications<br>
      🗺️ <strong>Navigate anywhere</strong> — links to any page`);
      this.setDefaultChips();
      return;
    }

    // ── 4. Thanks / Polite ──
    if (/^(thanks|thank you|ok|okay|cool|great|awesome|perfect|good|fine|nice|wonderful|alright|got it|understood)$/i.test(cleanP)) {
      this.reply(`You're welcome! Let me know if you need anything else. 😊`);
      this.setDefaultChips();
      return;
    }

    // ── 5. Farewell ──
    if (/^(bye|goodbye|see you|later|thats all|im done|exit|close|quit)$/i.test(cleanP)) {
      this.reply(`Goodbye! Have a wonderful day! 🌟 I'll be here whenever you need help with your events.`);
      this.setDefaultChips();
      return;
    }

    // ── 6. Booking Status & Info ──
    if (this.matchesIntent(cleanP, ['my booking', 'my bookings', 'booking status', 'my events', 'upcoming events', 'upcoming booking', 'active booking', 'show bookings', 'check booking', 'view bookings', 'booking history'])) {
      this.handleBookingQuery(cleanP);
      return;
    }

    // ── 7. Booking Flow Explanation ──
    if (this.matchesIntent(cleanP, ['how does booking work', 'booking steps', 'how to book', 'booking process', 'what are the booking steps', 'how do i book', 'how to make a booking'])) {
      this.reply(`Here's how booking works on JoinEvents:<br><br>
      <strong>Step 1:</strong> Browse & select a package<br>
      <strong>Step 2:</strong> Choose your event date, city & guest count<br>
      <strong>Step 3:</strong> Add optional services & addons<br>
      <strong>Step 4:</strong> Pay 20% advance at checkout<br>
      <strong>Step 5:</strong> Vendor confirms your booking<br>
      <strong>Step 6:</strong> Event day! 🎉<br>
      <strong>Step 7:</strong> Pay remaining balance → Settlement<br><br>
      Your money is held in <strong>escrow</strong> until the event is completed successfully.`);
      this.addNavLinks([
        { label: 'Browse Packages', route: '/events', icon: 'bi-search' },
        { label: 'My Bookings', route: '/bookings', icon: 'bi-calendar-check' }
      ]);
      this.suggestionChips.set(['What is escrow?', 'Cancellation Policy', 'Payment Methods', 'Find Packages']);
      return;
    }

    // ── 8. Booking Status Definitions ──
    if (this.matchesIntent(cleanP, ['what does pending mean', 'what does confirmed mean', 'what does advance paid mean', 'booking statuses', 'what is advance paid', 'what is in progress', 'what is settled', 'what is completed', 'status meaning', 'explain status'])) {
      this.handleStatusExplanation(cleanP);
      return;
    }

    // ── 9. Cancellation & Refund ──
    if (this.matchesIntent(cleanP, ['cancel', 'refund', 'cancellation', 'money back', 'penalty', 'strike', 'cancellation policy', 'refund policy', 'how to cancel'])) {
      this.handleCancellationFAQ(cleanP);
      return;
    }

    // ── 10. Payment & Checkout ──
    if (this.matchesIntent(cleanP, ['payment method', 'pay', 'upi', 'card', 'emi', 'net banking', 'gst', 'tax', 'coupon', 'discount', 'code', 'insurance', 'secure', 'balance payment', 'payment options', 'how to pay', 'checkout'])) {
      this.handlePaymentQuery(cleanP);
      return;
    }

    // ── 11. Loyalty & Rewards ──
    if (this.matchesIntent(cleanP, ['loyalty', 'points', 'rewards', 'tier', 'bronze', 'silver', 'gold', 'redeem', 'earn', 'refer', 'referral', 'review bonus', 'my points', 'my rewards', 'loyalty balance', 'points history'])) {
      this.handleLoyaltyQuery(cleanP);
      return;
    }

    // ── 12. Guarantee & Trust ──
    if (this.matchesIntent(cleanP, ['safe', 'trust', 'guarantee', 'escrow', 'no show', 'no-show', 'vendor verified', 'quality', 'dispute', 'claim', 'protection', 'compensation', 'is it safe', 'is my money safe', 'file a claim'])) {
      this.handleGuaranteeQuery(cleanP);
      return;
    }

    // ── 13. RFP / Get Quotes ──
    if (this.matchesIntent(cleanP, ['rfp', 'quote', 'quotes', 'bid', 'bids', 'proposal', 'get quotes', 'vendor bid', 'create rfp', 'custom quote', 'my rfps', 'my quotes', 'request for proposal'])) {
      this.handleRfpQuery(cleanP);
      return;
    }

    // ── 14. Vendor Messaging ──
    if (this.matchesIntent(cleanP, ['message vendor', 'chat with vendor', 'contact vendor', 'talk to vendor', 'vendor message', 'my messages', 'messaging', 'communicate', 'send message'])) {
      this.handleMessagingQuery(cleanP);
      return;
    }

    // ── 15. Reviews & Ratings ──
    if (this.matchesIntent(cleanP, ['review', 'rating', 'stars', 'write review', 'feedback', 'report review', 'flag', 'fake review', 'submit review', 'how to review'])) {
      this.handleReviewQuery(cleanP);
      return;
    }

    // ── 16. Support & Tickets ──
    if (this.matchesIntent(cleanP, ['support', 'ticket', 'help desk', 'contact support', 'create ticket', 'file complaint', 'issue', 'response time', 'reopen ticket', 'talk to human', 'human agent', 'customer support'])) {
      this.handleSupportQuery(cleanP);
      return;
    }

    // ── 17. Profile & Account ──
    if (this.matchesIntent(cleanP, ['profile', 'update profile', 'change password', 'avatar', 'notification settings', 'delete account', 'deactivate', 'personal info', 'account settings', 'edit profile', 'my account'])) {
      this.handleProfileQuery(cleanP);
      return;
    }

    // ── 18. Events & Browsing ──
    if (this.matchesIntent(cleanP, ['event types', 'what events', 'types of events', 'categories', 'what can i plan', 'wedding', 'birthday', 'corporate', 'beauty', 'travel', 'shopping'])) {
      this.handleEventBrowsing(cleanP);
      return;
    }

    // ── 19. Notifications ──
    if (this.matchesIntent(cleanP, ['notification', 'bell', 'alert', 'updates', 'clear notifications', 'not receiving', 'my notifications'])) {
      this.handleNotificationQuery(cleanP);
      return;
    }

    // ── 20. General Platform Info ──
    if (this.matchesIntent(cleanP, ['what is joinevents', 'about joinevents', 'how does joinevents', 'available city', 'cities', 'working hours', 'mobile app', 'minimum booking'])) {
      this.handlePlatformQuery(cleanP);
      return;
    }

    // ── 21. Navigation Help ──
    if (this.matchesIntent(cleanP, ['take me to', 'where is', 'how do i get to', 'navigate', 'go to', 'open', 'link to', 'show me the', 'find page'])) {
      this.handleNavigationQuery(cleanP);
      return;
    }

    // ── 22. Invoice / Download ──
    if (this.matchesIntent(cleanP, ['invoice', 'download', 'receipt', 'proforma', 'bill'])) {
      this.reply(`You can download invoices from your booking details:<br><br>
      📄 <strong>Advance Receipt</strong> — after advance payment<br>
      📄 <strong>Proforma Invoice</strong> — booking summary<br>
      📄 <strong>Final Invoice</strong> — after settlement<br><br>
      Go to <strong>My Bookings → Select a booking → Download Invoice</strong>.`);
      this.addNavLinks([{ label: 'My Bookings', route: '/bookings', icon: 'bi-calendar-check' }]);
      this.suggestionChips.set(['My Bookings', 'Payment History', 'Cancellation Policy', 'Help']);
      return;
    }

    // ── 23. Damage Charges ──
    if (this.matchesIntent(cleanP, ['damage', 'damage charge', 'damage charges'])) {
      this.reply(`<strong>Damage Charges</strong> may be applied by a vendor if damages occur during your event.<br><br>
      • You'll be notified of the charges<br>
      • You can <strong>review and approve</strong> or <strong>dispute</strong> them in My Bookings<br>
      • Unapproved charges won't be deducted until resolution`);
      this.addNavLinks([{ label: 'My Bookings', route: '/bookings', icon: 'bi-calendar-check' }]);
      this.suggestionChips.set(['Raise a Dispute', 'Guarantee Policy', 'My Bookings', 'Help']);
      return;
    }

    // ── 24. Favorites ──
    if (this.matchesIntent(cleanP, ['favorite', 'saved', 'wishlist', 'liked', 'heart'])) {
      this.reply(`Your <strong>Favorites</strong> are saved packages you've liked! ❤️<br><br>
      • Click the <strong>heart icon</strong> on any package to save it<br>
      • View all favorites on your <strong>Dashboard</strong><br>
      • Favorites are stored locally and sync across your session`);
      this.addNavLinks([{ label: 'Dashboard', route: '/dashboard', icon: 'bi-house' }]);
      this.suggestionChips.set(['Find Packages', 'My Bookings', 'Dashboard', 'Help']);
      return;
    }

    // ── Fallback: Try package search with entity extraction ──
    this.extractEntities(p);
    const currentState = this.state();

    if (!currentState.category) {
      this.reply(`I'm not sure I understood that. Here's what I can help with:<br><br>
      🔍 <strong>Find packages</strong> — "wedding venues in Hyderabad"<br>
      📋 <strong>My bookings</strong> — "show my bookings"<br>
      🎁 <strong>Rewards</strong> — "my loyalty points"<br>
      📝 <strong>Quotes</strong> — "create an RFP"<br>
      🛡️ <strong>Policies</strong> — "cancellation policy"<br>
      💳 <strong>Payments</strong> — "payment methods"<br><br>
      <em>Try asking in a different way or tap a suggestion below!</em>`);
      this.setDefaultChips();
      return;
    }

    // Package search with filters
    this.searchPackages(currentState);
  }

  // ═════════════════════════════════════════
  // INTENT HANDLERS
  // ═════════════════════════════════════════

  private handleBookingQuery(p: string) {
    // Refresh bookings from signal in case they were updated
    const cachedBookings = this.bookingService.globalBookings();
    if (cachedBookings.length > 0) {
      this.userBookings = cachedBookings;
    }

    if (this.userBookings.length === 0) {
      this.reply(`You don't have any bookings yet! 🎪<br><br>
      Ready to plan your first event? Browse our packages or create an RFP to get vendor quotes.`);
      this.addNavLinks([
        { label: 'Browse Events', route: '/events', icon: 'bi-search' },
        { label: 'Create RFP', route: '/get-quotes/create', icon: 'bi-pencil-square' }
      ]);
      this.suggestionChips.set(['Find Packages', 'Create RFP', 'How to Book', 'Help']);
      return;
    }

    // Check for specific status queries
    if (p.includes('upcoming') || p.includes('active') || p.includes('confirmed')) {
      const active = this.userBookings.filter(b => 
        ['confirmed', 'in_progress', 'advance_paid'].includes(b.status)
      );
      if (active.length > 0) {
        this.reply(`You have <strong>${active.length}</strong> upcoming/active booking${active.length > 1 ? 's' : ''}:`);
        this.addBookingCards(active.slice(0, 3));
      } else {
        this.reply(`You don't have any active bookings right now. Would you like to plan a new event?`);
      }
    } else if (p.includes('pending')) {
      const pending = this.userBookings.filter(b => b.status === 'pending');
      if (pending.length > 0) {
        this.reply(`You have <strong>${pending.length}</strong> pending booking${pending.length > 1 ? 's' : ''} awaiting advance payment:`);
        this.addBookingCards(pending.slice(0, 3));
      } else {
        this.reply(`No pending bookings! All your bookings are up to date. ✅`);
      }
    } else if (p.includes('cancel')) {
      const cancelled = this.userBookings.filter(b => b.status === 'cancelled');
      if (cancelled.length > 0) {
        this.reply(`You have <strong>${cancelled.length}</strong> cancelled booking${cancelled.length > 1 ? 's' : ''}:`);
        this.addBookingCards(cancelled.slice(0, 3));
      } else {
        this.reply(`You have no cancelled bookings. Great! 🎉`);
      }
    } else {
      // Show all bookings summary
      const statusCounts: Record<string, number> = {};
      this.userBookings.forEach(b => {
        statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
      });
      
      let summary = `Here's your booking overview:<br><br>`;
      const statusLabels: Record<string, string> = {
        'pending': '⏳ Pending',
        'advance_paid': '💰 Advance Paid',
        'confirmed': '✅ Confirmed',
        'in_progress': '🔄 In Progress',
        'completed': '🏁 Completed',
        'settled': '💚 Settled',
        'cancelled': '❌ Cancelled',
        'disputed': '⚠️ Disputed'
      };
      
      for (const [status, count] of Object.entries(statusCounts)) {
        summary += `${statusLabels[status] || status}: <strong>${count}</strong><br>`;
      }

      this.reply(summary);
      
      // Show latest 3 bookings
      const latest = this.userBookings.slice(0, 3);
      this.addBookingCards(latest);
    }

    this.addNavLinks([{ label: 'View All Bookings', route: '/bookings', icon: 'bi-calendar-check' }]);
    this.suggestionChips.set(['Upcoming Bookings', 'Pending Bookings', 'Cancellation Policy', 'Help']);
  }

  private handleStatusExplanation(p: string) {
    if (p.includes('pending')) {
      this.reply(`<strong>⏳ Pending</strong> means your booking has been created but the advance payment (20%) hasn't been made yet. Complete your payment to proceed!`);
    } else if (p.includes('advance') || p.includes('advance_paid')) {
      this.reply(`<strong>💰 Advance Paid</strong> means your 20% advance has been received. The vendor will review and confirm your booking shortly.`);
    } else if (p.includes('confirmed')) {
      this.reply(`<strong>✅ Confirmed</strong> means your booking is confirmed by the vendor! Your event is scheduled and funds are held securely in escrow.`);
    } else if (p.includes('in progress') || p.includes('in_progress')) {
      this.reply(`<strong>🔄 In Progress</strong> means your event is currently happening or has just started. Enjoy your event! 🎉`);
    } else if (p.includes('completed')) {
      this.reply(`<strong>🏁 Completed</strong> means the event has finished successfully. You can now write a review (earn 50 loyalty points!) and pay the remaining balance.`);
    } else if (p.includes('settled')) {
      this.reply(`<strong>💚 Settled</strong> means all payments have been cleared — the vendor has been paid out and the booking is fully closed.`);
    } else {
      this.reply(`Here are all booking statuses:<br><br>
      ⏳ <strong>Pending</strong> — Awaiting advance payment<br>
      💰 <strong>Advance Paid</strong> — Advance received, awaiting vendor confirmation<br>
      ✅ <strong>Confirmed</strong> — Vendor confirmed, event scheduled<br>
      🔄 <strong>In Progress</strong> — Event day / ongoing<br>
      🏁 <strong>Completed</strong> — Event finished, awaiting settlement<br>
      💚 <strong>Settled</strong> — All payments cleared<br>
      ❌ <strong>Cancelled</strong> — Booking cancelled<br>
      ⚠️ <strong>Disputed</strong> — Dispute raised`);
    }
    this.suggestionChips.set(['My Bookings', 'What is escrow?', 'Cancellation Policy', 'Help']);
  }

  private handleCancellationFAQ(p: string) {
    // Specific day calculation
    const dayMatch = p.match(/(\d+)\s*days?\b/i);
    if (dayMatch) {
      const days = parseInt(dayMatch[1], 10);
      let responseText = '';
      if (days > 30) {
        responseText = `Cancelling <strong>${days} days</strong> before the event:<br><br>
        ✅ <strong>~100% refund</strong> of advance paid<br>
        📌 Platform fee: 2% of total (max ₹2,500) retained<br><br>
        <em>This is the best window for cancellations!</em>`;
      } else if (days >= 15 && days <= 30) {
        responseText = `Cancelling <strong>${days} days</strong> before the event:<br><br>
        ⚠️ <strong>50% refund</strong> of advance paid<br>
        📌 50% retained as cancellation charge`;
      } else if (days >= 7 && days < 15) {
        responseText = `Cancelling <strong>${days} days</strong> before the event:<br><br>
        ⚠️ <strong>25% refund</strong> of advance paid<br>
        📌 75% retained as cancellation charge`;
      } else {
        responseText = `Cancelling <strong>${days} days</strong> before the event:<br><br>
        ❌ <strong>0% refund</strong> — 100% of advance is retained<br><br>
        <em>We recommend cancelling at least 30 days early for maximum refund.</em>`;
      }
      this.reply(responseText);
    } else if (p.includes('vendor') && (p.includes('cancel') || p.includes('cancels'))) {
      this.reply(`If a <strong>Vendor cancels</strong> your confirmed booking:<br><br>
      ✅ You get <strong>100% refund</strong> of advance paid<br>
      🔨 Vendor gets <strong>10% penalty</strong> (max ₹15,000)<br>
      ⚡ Vendor receives 1 strike on their account<br>
      📧 Multiple strikes → vendor account suspension<br><br>
      <em>You're fully protected by our guarantee system!</em>`);
    } else if (p.includes('how to cancel') || p.includes('how do i cancel')) {
      this.reply(`To cancel a booking:<br><br>
      1️⃣ Go to <strong>My Bookings</strong><br>
      2️⃣ Select the booking you want to cancel<br>
      3️⃣ Click <strong>"Cancel Booking"</strong><br>
      4️⃣ Enter your cancellation reason<br>
      5️⃣ Review the refund preview and confirm<br><br>
      <em>Note: I can't cancel bookings for you, but I can guide you there!</em>`);
      this.addNavLinks([{ label: 'My Bookings', route: '/bookings', icon: 'bi-calendar-check' }]);
    } else if (p.includes('how long') && p.includes('refund')) {
      this.reply(`Refund processing times:<br><br>
      💳 <strong>Card/Net Banking:</strong> 5-7 business days<br>
      📱 <strong>UPI:</strong> 2-3 business days<br><br>
      Refunds are processed to your original payment method.`);
    } else {
      this.reply(`Here's the JoinEvents <strong>Cancellation & Refund Policy</strong>:<br><br>
      📅 <strong>&gt; 30 days before:</strong> ~100% refund (minus 2% platform fee, max ₹2,500)<br>
      📅 <strong>15-30 days before:</strong> 50% refund<br>
      📅 <strong>7-14 days before:</strong> 25% refund<br>
      📅 <strong>&lt; 7 days before:</strong> 0% refund<br><br>
      🛡️ <strong>Vendor cancels?</strong> 100% refund + vendor penalty<br><br>
      <em>Tell me how many days are left and I'll calculate your exact refund!</em>`);
    }

    this.suggestionChips.set(['Cancel 20 days before', 'Cancel 5 days before', 'What if Vendor cancels?', 'How long for refund?']);
  }

  private handlePaymentQuery(p: string) {
    if (p.includes('emi')) {
      this.reply(`<strong>EMI Options</strong> available at checkout:<br><br>
      🏦 Banks: HDFC, ICICI, SBI, Axis<br>
      📅 Tenures: 6, 9, 12, 18, or 24 months<br>
      📊 Monthly payment calculated with interest at checkout<br><br>
      <em>Select EMI as payment method during checkout to see options!</em>`);
    } else if (p.includes('coupon') || p.includes('discount') || p.includes('code')) {
      this.reply(`💰 Available Coupon Codes:<br><br>
      🎁 <strong>WELCOME10</strong> — Get 10% off your first booking!<br><br>
      <em>Enter the code during checkout to apply the discount.</em>`);
    } else if (p.includes('gst') || p.includes('tax')) {
      this.reply(`<strong>GST (Goods & Services Tax)</strong>:<br><br>
      📊 <strong>18% GST</strong> is applied on the total booking amount<br>
      📋 GST is included in the price breakdown at checkout<br>
      📄 GST details appear on your invoice`);
    } else if (p.includes('balance') || p.includes('remaining')) {
      this.reply(`To pay your <strong>remaining balance</strong>:<br><br>
      1️⃣ Go to <strong>My Bookings</strong> or <strong>Payments</strong><br>
      2️⃣ Find the booking with outstanding balance<br>
      3️⃣ Click <strong>"Pay Balance"</strong><br>
      4️⃣ Complete payment via any available method`);
      this.addNavLinks([
        { label: 'My Payments', route: '/payments', icon: 'bi-credit-card' },
        { label: 'My Bookings', route: '/bookings', icon: 'bi-calendar-check' }
      ]);
    } else if (p.includes('secure') || p.includes('safe')) {
      this.reply(`Your payments are <strong>100% secure</strong>! 🔒<br><br>
      🛡️ <strong>Escrow Protection</strong> — funds held until event completion<br>
      🔐 <strong>Encrypted</strong> — bank-grade security<br>
      ✅ <strong>Verified vendors</strong> — KYC checked<br>
      🎯 <strong>No-Show Refund</strong> — guaranteed protection`);
    } else if (p.includes('insurance')) {
      this.reply(`<strong>Event Insurance</strong> is an optional add-on during checkout:<br><br>
      🛡️ Covers unforeseen circumstances<br>
      💰 Small additional fee<br>
      ✅ Toggle it on/off during booking<br><br>
      <em>You can add it when selecting your package!</em>`);
    } else {
      this.reply(`<strong>Payment Methods</strong> accepted on JoinEvents:<br><br>
      💳 <strong>Credit/Debit Card</strong> — Visa, Mastercard, RuPay<br>
      📱 <strong>UPI</strong> — Google Pay, PhonePe, Paytm<br>
      🏦 <strong>Net Banking</strong> — HDFC, ICICI, SBI, Axis<br>
      📅 <strong>EMI</strong> — 6 to 24 month options<br><br>
      💰 <strong>Advance:</strong> 20% at booking | <strong>Balance:</strong> before event<br>
      🎁 <strong>Coupon:</strong> Use WELCOME10 for 10% off!`);
    }
    this.suggestionChips.set(['EMI Options', 'Coupon Codes', 'Balance Payment', 'My Payments']);
  }

  private handleLoyaltyQuery(p: string) {
    if (p.includes('my points') || p.includes('my reward') || p.includes('balance') || p.includes('how many')) {
      if (this.userLoyalty) {
        this.reply(`Here's your <strong>Loyalty Summary</strong>:`);
        this.addLoyaltyCard(this.userLoyalty);
      } else {
        // Try fetching fresh
        const user = this.authService.currentUser();
        if (user) {
          this.loyaltyService.getBalance(user.id).subscribe({
            next: balance => {
              this.userLoyalty = balance;
              this.reply(`Here's your <strong>Loyalty Summary</strong>:`);
              this.addLoyaltyCard(balance);
            },
            error: () => {
              this.reply(`I couldn't fetch your loyalty data right now. Please visit the Rewards page directly.`);
              this.addNavLinks([{ label: 'My Rewards', route: '/rewards', icon: 'bi-gift' }]);
            }
          });
          return; // Wait for async
        } else {
          this.reply(`Please log in to view your loyalty points.`);
        }
      }
    } else if (p.includes('earn') || p.includes('how do i get')) {
      this.reply(`<strong>How to Earn Loyalty Points:</strong><br><br>
      🎉 <strong>Complete bookings</strong> — earn points on every event<br>
      ⭐ <strong>Write reviews</strong> — earn <strong>50 points per review</strong><br>
      👥 <strong>Refer friends</strong> — earn bonus points per referral<br><br>
      <em>Points accumulate towards higher tiers with better benefits!</em>`);
    } else if (p.includes('redeem') || p.includes('use points')) {
      this.reply(`<strong>Redeeming Loyalty Points:</strong><br><br>
      1️⃣ During checkout, enter points to redeem<br>
      2️⃣ Discount is calculated instantly<br>
      3️⃣ Maximum discount: <strong>5% of base booking price</strong><br>
      4️⃣ Applied to your total<br><br>
      <em>The more you earn, the more you save!</em>`);
    } else if (p.includes('tier') || p.includes('bronze') || p.includes('silver') || p.includes('gold')) {
      this.reply(`<strong>Loyalty Tiers:</strong><br><br>
      🥉 <strong>Bronze</strong> — 0-399 points (starting tier)<br>
      🥈 <strong>Silver</strong> — 400-999 points<br>
      🥇 <strong>Gold</strong> — 1000+ points (premium benefits)<br><br>
      <em>Higher tiers unlock exclusive perks and discounts!</em>`);
    } else if (p.includes('refer') || p.includes('referral')) {
      this.reply(`<strong>Referral Program:</strong><br><br>
      1️⃣ Go to <strong>Rewards</strong> page<br>
      2️⃣ Copy your unique referral link<br>
      3️⃣ Share with friends or enter their email<br>
      4️⃣ Both of you earn bonus points! 🎉`);
      this.addNavLinks([{ label: 'My Rewards', route: '/rewards', icon: 'bi-gift' }]);
    } else {
      this.reply(`<strong>JoinEvents Loyalty Program:</strong><br><br>
      🎁 Earn points on bookings, reviews & referrals<br>
      🏆 Three tiers: Bronze → Silver → Gold<br>
      💰 Redeem points for checkout discounts (max 5% of base)<br>
      ⭐ 50 points for every review<br>
      👥 Refer friends for bonus points<br><br>
      <em>Ask me "my points" to see your balance!</em>`);
    }
    this.addNavLinks([{ label: 'My Rewards', route: '/rewards', icon: 'bi-gift' }]);
    this.suggestionChips.set(['My Points', 'How to Earn', 'Redeem Points', 'Refer a Friend']);
  }

  private handleGuaranteeQuery(p: string) {
    if (p.includes('no show') || p.includes('no-show') || p.includes('doesnt show') || p.includes('vendor doesnt come')) {
      this.reply(`<strong>🛡️ No-Show Protection:</strong><br><br>
      If your confirmed vendor doesn't show up:<br>
      ✅ <strong>100% full refund</strong> of all payments<br>
      💰 <strong>+ ₹10,000 compensation</strong><br>
      ⏱️ Processed within <strong>48 hours</strong><br><br>
      <em>You're fully covered by our guarantee!</em>`);
    } else if (p.includes('quality') || p.includes('poor service') || p.includes('bad service')) {
      this.reply(`<strong>🛡️ Service Quality Guarantee:</strong><br><br>
      If service quality was significantly below expectations:<br>
      💰 Up to <strong>50% refund</strong> after mediation<br>
      📋 Requires evidence submission<br>
      ⏱️ Resolution within <strong>7 days (168 hours)</strong><br><br>
      <em>File a claim from My Bookings → Raise Dispute</em>`);
    } else if (p.includes('escrow') || p.includes('money safe')) {
      this.reply(`<strong>🔒 Escrow Protection:</strong><br><br>
      Your payment is <strong>NOT sent directly to the vendor</strong>.<br><br>
      💰 Funds are held securely by JoinEvents<br>
      ✅ Released to vendor only after successful event completion<br>
      🔄 100% refund if anything goes wrong<br>
      🚫 No mediation needed for escrow claims<br><br>
      <em>Your money is always safe with us!</em>`);
    } else if (p.includes('claim') || p.includes('file') || p.includes('dispute')) {
      this.reply(`<strong>How to File a Guarantee Claim:</strong><br><br>
      1️⃣ Go to <strong>My Bookings</strong><br>
      2️⃣ Select the booking<br>
      3️⃣ Click <strong>"Raise Dispute"</strong><br>
      4️⃣ Select claim type: No-Show, Quality, or Cancellation<br>
      5️⃣ Provide reason and evidence<br><br>
      <strong>Claim Status Flow:</strong> Submitted → Under Review → Approved/Rejected → Resolved`);
      this.addNavLinks([{ label: 'My Bookings', route: '/bookings', icon: 'bi-calendar-check' }]);
    } else if (p.includes('verified') || p.includes('vendor verified')) {
      this.reply(`<strong>✅ Verified Vendors:</strong><br><br>
      All JoinEvents vendors undergo:<br>
      📋 <strong>KYC verification</strong> — identity & business documents<br>
      🏢 <strong>Business verification</strong> — registration & legitimacy<br>
      ⭐ <strong>Quality checks</strong> — portfolio & service review<br><br>
      <em>Look for the ✅ verified badge on vendor profiles!</em>`);
    } else {
      this.reply(`<strong>🛡️ JoinEvents Trust & Safety Guarantees:</strong><br><br>
      🔒 <strong>Escrow Protected</strong> — Funds held until event completion<br>
      ✅ <strong>Verified Vendors</strong> — KYC & document verified<br>
      🔄 <strong>No-Show Refund</strong> — 100% refund + ₹10,000 compensation<br>
      📞 <strong>24/7 Support</strong> — Dedicated help for every event<br><br>
      <strong>Guarantee Claims:</strong><br>
      • No-Show: 100% refund + ₹10K (48 hours)<br>
      • Quality Issue: up to 50% refund (7 days)<br>
      • Escrow: 100% refund (immediate)`);
    }
    this.suggestionChips.set(['What is escrow?', 'No-Show Protection', 'File a Claim', 'Verified Vendors']);
  }

  private handleRfpQuery(p: string) {
    if (p.includes('create') || p.includes('new') || p.includes('make')) {
      this.reply(`Let me help you <strong>create an RFP</strong>! 📝<br><br>
      An RFP has 3 steps:<br>
      1️⃣ <strong>Event Details</strong> — type, date, city, guest count<br>
      2️⃣ <strong>Services Needed</strong> — venue, catering, decor, etc.<br>
      3️⃣ <strong>Budget & Submit</strong> — set budget range and requirements<br><br>
      <em>Click below to get started!</em>`);
      this.addNavLinks([{ label: 'Create New RFP', route: '/get-quotes/create', icon: 'bi-pencil-square' }]);
      this.suggestionChips.set(['What services available?', 'Quality Tiers', 'My RFPs', 'Help']);
      return;
    }

    if (p.includes('my rfp') || p.includes('my quote') || p.includes('show rfp') || p.includes('view rfp')) {
      if (this.userRfps.length > 0) {
        this.reply(`You have <strong>${this.userRfps.length}</strong> RFP${this.userRfps.length > 1 ? 's' : ''}:`);
        this.addRfpCards(this.userRfps.slice(0, 3));
      } else {
        this.reply(`You haven't created any RFPs yet. Would you like to create one and get vendor bids?`);
      }
      this.addNavLinks([
        { label: 'View All RFPs', route: '/get-quotes', icon: 'bi-list-task' },
        { label: 'Create RFP', route: '/get-quotes/create', icon: 'bi-pencil-square' }
      ]);
      this.suggestionChips.set(['Create RFP', 'How do RFPs work?', 'Find Packages', 'Help']);
      return;
    }

    if (p.includes('bid') || p.includes('accept')) {
      this.reply(`<strong>Managing RFP Bids:</strong><br><br>
      📥 Vendors submit bids with pricing, deliverables, and validity<br>
      👀 View all bids on your RFP detail page<br>
      ✅ <strong>Accept a bid</strong> → redirected to checkout for advance payment<br>
      💬 You can also message vendors to negotiate<br><br>
      <em>There's no limit on how many bids you can receive!</em>`);
      this.addNavLinks([{ label: 'My RFPs', route: '/get-quotes', icon: 'bi-list-task' }]);
    } else if (p.includes('service') || p.includes('what services')) {
      this.reply(`<strong>Services you can request in an RFP:</strong><br><br>
      🏛️ Venue | 🍽️ Catering | 🎨 Decoration | 🚗 Transport<br>
      🙏 Priest | 👷 Manpower | 📸 Photography | 🎵 Music & DJ<br><br>
      <em>Select multiple services when creating your RFP!</em>`);
    } else if (p.includes('tier') || p.includes('quality')) {
      this.reply(`<strong>Quality Tiers in RFP:</strong><br><br>
      🥈 <strong>Silver</strong> — Budget-friendly, quality essentials<br>
      🥇 <strong>Gold</strong> — Mid-range, premium features<br>
      💎 <strong>Platinum</strong> — Ultra-premium, luxury experience<br><br>
      <em>Each tier auto-fills estimated price ranges!</em>`);
    } else {
      this.reply(`<strong>What is an RFP (Request for Proposal)?</strong><br><br>
      📝 Describe your event needs in detail<br>
      📥 Receive competitive bids from verified vendors<br>
      💰 Compare pricing, deliverables, and ratings<br>
      ✅ Accept the best bid → proceed to checkout<br><br>
      <strong>Steps:</strong> Create RFP → Vendors Bid → Compare → Accept → Book!<br><br>
      <em>It's the smartest way to find the best deals!</em>`);
      this.addNavLinks([
        { label: 'Create RFP', route: '/get-quotes/create', icon: 'bi-pencil-square' },
        { label: 'My RFPs', route: '/get-quotes', icon: 'bi-list-task' }
      ]);
    }
    this.suggestionChips.set(['Create RFP', 'My RFPs', 'Services Available', 'Quality Tiers']);
  }

  private handleMessagingQuery(p: string) {
    this.reply(`<strong>💬 Vendor Messaging:</strong><br><br>
    • <strong>Start a chat</strong> from any package page or RFP bid<br>
    • Messages are <strong>real-time</strong> with instant notifications<br>
    • Chat states: Pending → Accepted → Active<br>
    • You'll see a toast notification for new messages<br><br>
    <em>Go to Messages to view all your conversations!</em>`);
    this.addNavLinks([{ label: 'My Messages', route: '/messages', icon: 'bi-chat-dots' }]);
    this.suggestionChips.set(['My Messages', 'My Bookings', 'Create RFP', 'Help']);
  }

  private handleReviewQuery(p: string) {
    if (p.includes('write') || p.includes('submit') || p.includes('how to')) {
      this.reply(`<strong>Writing a Review:</strong><br><br>
      1️⃣ Go to <strong>My Bookings</strong><br>
      2️⃣ Find a <strong>completed/settled</strong> booking<br>
      3️⃣ Click <strong>"Write Review"</strong><br>
      4️⃣ Rate 1-5 stars ⭐ and add your comments<br>
      5️⃣ Submit and earn <strong>50 loyalty points!</strong> 🎁`);
    } else if (p.includes('edit')) {
      this.reply(`Yes! You can <strong>edit your review</strong> anytime from the same booking detail page in My Bookings.`);
    } else if (p.includes('report') || p.includes('flag') || p.includes('fake')) {
      this.reply(`To <strong>report a review</strong>:<br><br>
      🚩 Click the flag icon on any suspicious review<br>
      📝 Provide a reason for flagging<br>
      🔍 Our team investigates within 24 hours`);
    } else {
      this.reply(`<strong>⭐ Reviews on JoinEvents:</strong><br><br>
      ✍️ Write reviews for completed bookings<br>
      🎁 Earn <strong>50 loyalty points</strong> per review<br>
      ✏️ Edit your reviews anytime<br>
      🚩 Flag inappropriate reviews<br>
      📊 Reviews help other customers choose better!`);
    }
    this.addNavLinks([{ label: 'My Bookings', route: '/bookings', icon: 'bi-calendar-check' }]);
    this.suggestionChips.set(['My Bookings', 'My Points', 'How to Earn Points', 'Help']);
  }

  private handleSupportQuery(p: string) {
    if (p.includes('create') || p.includes('new') || p.includes('file')) {
      this.reply(`<strong>Creating a Support Ticket:</strong><br><br>
      1️⃣ Go to <strong>Support</strong> page<br>
      2️⃣ Click <strong>"Create Ticket"</strong><br>
      3️⃣ Fill in: Subject, Priority, Description<br>
      4️⃣ Optionally link a booking & attach files<br>
      5️⃣ Submit and track your ticket<br><br>
      <strong>Priority Levels:</strong> Low | Medium | High | Urgent`);
    } else if (p.includes('response time') || p.includes('how long')) {
      this.reply(`<strong>Support Response Times:</strong><br><br>
      🔴 <strong>Urgent:</strong> Within 2 hours<br>
      🟠 <strong>High:</strong> Within 6 hours<br>
      🟡 <strong>Medium:</strong> Within 24 hours<br>
      🟢 <strong>Low:</strong> Within 48 hours`);
    } else if (p.includes('human') || p.includes('agent') || p.includes('talk to')) {
      this.reply(`I understand you'd like human assistance! 🙋<br><br>
      While I'm an AI, our support team is available:<br>
      📝 Create a <strong>support ticket</strong> for detailed help<br>
      🔴 Set priority to <strong>"Urgent"</strong> for fastest response<br>
      📎 Attach screenshots or files for context`);
    } else {
      this.reply(`<strong>🎫 JoinEvents Support:</strong><br><br>
      📝 Create tickets with subject & priority<br>
      📎 Attach files and link bookings<br>
      💬 Reply within ticket threads<br>
      🔄 Reopen resolved tickets if needed<br>
      ⏱️ Response: 2h (urgent) to 48h (low)`);
    }
    this.addNavLinks([{ label: 'Support Center', route: '/support', icon: 'bi-headset' }]);
    this.suggestionChips.set(['Create Ticket', 'Response Times', 'My Bookings', 'Help']);
  }

  private handleProfileQuery(p: string) {
    if (p.includes('password')) {
      this.reply(`To <strong>change your password</strong>:<br>
      Go to Profile → Security → Change Password`);
    } else if (p.includes('avatar') || p.includes('photo') || p.includes('picture')) {
      this.reply(`To <strong>update your avatar</strong>:<br>
      Go to Profile → Click your avatar → Upload & crop a new photo`);
    } else if (p.includes('notification') || p.includes('settings')) {
      this.reply(`<strong>Notification Preferences:</strong><br><br>
      Go to Profile → Notification Preferences to toggle:<br>
      📧 Email notifications<br>
      🔔 In-app notifications<br>
      📱 SMS notifications`);
    } else if (p.includes('delete') || p.includes('deactivate')) {
      this.reply(`To <strong>delete your account</strong>:<br><br>
      ⚠️ Go to Profile → Danger Zone → Delete Account<br>
      🚨 <strong>This action is permanent and cannot be undone!</strong><br>
      📋 All your data, bookings, and points will be removed`);
    } else {
      this.reply(`<strong>👤 Profile Management:</strong><br><br>
      ✏️ Edit name, email, phone, address, bio<br>
      📸 Upload & crop avatar<br>
      🔒 Change password<br>
      🔔 Notification preferences (email, in-app, SMS)<br>
      🏆 View loyalty tier<br>
      ❌ Delete account (danger zone)`);
    }
    this.addNavLinks([{ label: 'My Profile', route: '/profile', icon: 'bi-person' }]);
    this.suggestionChips.set(['Change Password', 'Notification Settings', 'My Rewards', 'Help']);
  }

  private handleEventBrowsing(p: string) {
    // If user mentions a specific category, search for it
    this.extractEntities(p);
    const currentState = this.state();
    
    if (currentState.category) {
      this.searchPackages(currentState);
      return;
    }

    // Show all event types
    this.reply(`<strong>🎉 Event Types on JoinEvents:</strong><br><br>
    💒 <strong>Weddings</strong> — Grand Indian weddings (from ₹1.5L)<br>
    🎂 <strong>Birthday Parties</strong> — Fun celebrations (from ₹25K)<br>
    🏢 <strong>Corporate Events</strong> — Professional meets (from ₹80K)<br>
    💄 <strong>Beauty & Styling</strong> — Bridal makeup & mehendi (from ₹15K)<br>
    🚗 <strong>Travel & Transport</strong> — Luxury cars & logistics (from ₹10K)<br>
    🛍️ <strong>Event Shopping</strong> — Attire, jewelry, gifts (from ₹50K)<br><br>
    <em>Which category interests you?</em>`);
    this.addNavLinks([{ label: 'Browse Events', route: '/events', icon: 'bi-grid' }]);
    this.suggestionChips.set(['Wedding Packages', 'Birthday Packages', 'Corporate Events', 'Browse All']);
  }

  private handleNotificationQuery(p: string) {
    if (p.includes('clear') || p.includes('delete')) {
      this.reply(`To clear notifications:<br>
      🔔 Click the bell icon → <strong>"Clear All"</strong><br>
      Or delete individual notifications one by one.`);
    } else if (p.includes('not receiving') || p.includes('not getting')) {
      this.reply(`Not getting notifications? Check these:<br><br>
      1️⃣ Go to <strong>Profile → Notification Preferences</strong><br>
      2️⃣ Make sure notifications are <strong>enabled</strong><br>
      3️⃣ Check your email spam folder for email notifications`);
      this.addNavLinks([{ label: 'My Profile', route: '/profile', icon: 'bi-person' }]);
    } else {
      this.reply(`<strong>🔔 Notification Types:</strong><br><br>
      📋 <strong>Booking updates</strong> — status changes, confirmations<br>
      💬 <strong>New messages</strong> — vendor chat alerts<br>
      💳 <strong>Payment confirmations</strong> — receipts & invoices<br>
      ✅ <strong>Verification status</strong> — account updates<br>
      📢 <strong>System announcements</strong> — platform updates`);
    }
    this.addNavLinks([{ label: 'Notifications', route: '/notifications', icon: 'bi-bell' }]);
    this.suggestionChips.set(['My Notifications', 'Notification Settings', 'My Bookings', 'Help']);
  }

  private handlePlatformQuery(p: string) {
    if (p.includes('city') || p.includes('cities') || p.includes('available')) {
      this.reply(`<strong>🗺️ JoinEvents is available in:</strong><br><br>
      🏙️ Delhi NCR | Mumbai | Bengaluru<br>
      🏙️ Hyderabad | Pune | Chennai<br>
      🏙️ Kolkata | Gurugram | Noida<br><br>
      <em>More cities coming soon!</em>`);
    } else if (p.includes('working hours') || p.includes('hours') || p.includes('timing')) {
      this.reply(`<strong>⏰ JoinEvents is available 24/7!</strong><br><br>
      🌐 Platform: Always accessible<br>
      🎫 Support team responds based on ticket priority<br>
      🔴 Urgent: 2 hours | 🟡 Medium: 24 hours`);
    } else if (p.includes('mobile') || p.includes('app')) {
      this.reply(`<strong>📱 JoinEvents Mobile:</strong><br><br>
      Our platform is fully responsive and works great on mobile browsers! 📲<br>
      <em>Stay tuned for dedicated mobile app updates.</em>`);
    } else if (p.includes('minimum') || p.includes('min booking')) {
      this.reply(`There's <strong>no fixed minimum booking amount</strong>. It depends on the vendor and package you choose.<br><br>
      Starting prices range from ₹10,000 (travel) to ₹1,50,000 (wedding).`);
    } else {
      this.reply(`<strong>🎪 About JoinEvents:</strong><br><br>
      India's premier event planning marketplace connecting customers with verified vendors for weddings, birthdays, corporate events, and more!<br><br>
      ✅ Verified vendors with KYC<br>
      🔒 Escrow-protected payments<br>
      🛡️ Guarantee & no-show protection<br>
      🏆 Loyalty rewards program<br>
      📝 RFP system for custom quotes<br>
      🌍 Available in 9 major cities`);
    }
    this.suggestionChips.set(['Available Cities', 'How it Works', 'Find Packages', 'Help']);
  }

  private handleNavigationQuery(p: string) {
    const routes: { keywords: string[]; label: string; route: string; icon: string }[] = [
      { keywords: ['booking', 'bookings'], label: 'My Bookings', route: '/bookings', icon: 'bi-calendar-check' },
      { keywords: ['dashboard', 'home'], label: 'Dashboard', route: '/dashboard', icon: 'bi-house' },
      { keywords: ['message', 'messages', 'chat'], label: 'Messages', route: '/messages', icon: 'bi-chat-dots' },
      { keywords: ['payment', 'payments'], label: 'Payments', route: '/payments', icon: 'bi-credit-card' },
      { keywords: ['reward', 'rewards', 'loyalty', 'points'], label: 'Rewards', route: '/rewards', icon: 'bi-gift' },
      { keywords: ['profile', 'account', 'settings'], label: 'Profile', route: '/profile', icon: 'bi-person' },
      { keywords: ['support', 'ticket', 'help'], label: 'Support', route: '/support', icon: 'bi-headset' },
      { keywords: ['notification', 'notifications'], label: 'Notifications', route: '/notifications', icon: 'bi-bell' },
      { keywords: ['event', 'events', 'browse', 'explore'], label: 'Browse Events', route: '/events', icon: 'bi-grid' },
      { keywords: ['vendor', 'vendors', 'packages'], label: 'Vendor Packages', route: '/events/vendors', icon: 'bi-shop' },
      { keywords: ['rfp', 'quote', 'quotes', 'get quotes'], label: 'Get Quotes', route: '/get-quotes', icon: 'bi-list-task' },
      { keywords: ['create rfp', 'new rfp', 'new quote'], label: 'Create RFP', route: '/get-quotes/create', icon: 'bi-pencil-square' },
      { keywords: ['checkout'], label: 'Checkout', route: '/events', icon: 'bi-cart-check' },
    ];

    const matchedLinks: NavLink[] = [];
    for (const route of routes) {
      if (route.keywords.some(kw => p.includes(kw))) {
        matchedLinks.push({ label: route.label, route: route.route, icon: route.icon });
      }
    }

    if (matchedLinks.length > 0) {
      this.reply(`Here you go! 🗺️`);
      this.addNavLinks(matchedLinks.slice(0, 4));
    } else {
      this.reply(`Here are the main pages you can navigate to:`);
      this.addNavLinks([
        { label: 'Dashboard', route: '/dashboard', icon: 'bi-house' },
        { label: 'Browse Events', route: '/events', icon: 'bi-grid' },
        { label: 'My Bookings', route: '/bookings', icon: 'bi-calendar-check' },
        { label: 'My Rewards', route: '/rewards', icon: 'bi-gift' },
      ]);
    }
    this.suggestionChips.set(['My Bookings', 'My Messages', 'Support', 'Help']);
  }

  // ═════════════════════════════════════════
  // PACKAGE SEARCH
  // ═════════════════════════════════════════

  private searchPackages(currentState: RoshiState) {
    this.packageService.getPackages(currentState.category).subscribe(packages => {
      let filtered = packages;

      if (currentState.location) {
        const loc = currentState.location.toLowerCase();
        filtered = filtered.filter(pkg => 
          (pkg.location && pkg.location.toLowerCase().includes(loc)) ||
          (pkg.city && pkg.city.toLowerCase().includes(loc))
        );
      }

      if (currentState.maxBudget !== undefined) {
        filtered = filtered.filter(pkg => pkg.price <= currentState.maxBudget!);
      }

      if (currentState.guests !== undefined) {
        filtered = filtered.filter(pkg => pkg.maxGuests >= currentState.guests!);
      }

      if (currentState.sustainabilityOnly) {
        filtered = filtered.filter(pkg => pkg.sustainabilityTags && pkg.sustainabilityTags.length > 0);
      }

      this.isThinking.set(false);

      let textResponse = '';
      const filterSummary = this.buildFilterSummary(currentState);

      if (filtered.length > 0) {
        textResponse = `I found <strong>${filtered.length}</strong> package${filtered.length > 1 ? 's' : ''} matching ${filterSummary}:`;
      } else {
        textResponse = `I couldn't find exact matches for ${filterSummary}. Here are some popular options instead:`;
        filtered = packages.slice(0, 3);
      }

      this.chatHistory.update(h => [...h, {
        id: 'msg-' + Date.now(),
        sender: 'ai',
        type: 'text',
        content: textResponse,
        timestamp: new Date()
      }]);

      if (filtered.length > 0) {
        setTimeout(() => {
          this.chatHistory.update(h => [...h, {
            id: 'msg-' + (Date.now() + 1),
            sender: 'ai',
            type: 'packages',
            content: '',
            packages: filtered.slice(0, 3),
            timestamp: new Date()
          }]);
        }, 300);
      }

      this.addNavLinks([{ label: 'Browse All Vendors', route: '/events/vendors', icon: 'bi-shop' }]);
      this.updateSearchChips();
    });
  }

  // ═════════════════════════════════════════
  // UTILITY METHODS
  // ═════════════════════════════════════════

  private matchesIntent(input: string, keywords: string[]): boolean {
    return keywords.some(kw => input.includes(kw));
  }

  private reply(content: string) {
    this.isThinking.set(false);
    this.chatHistory.update(h => [...h, {
      id: 'msg-' + Date.now(),
      sender: 'ai',
      type: 'text',
      content: content,
      timestamp: new Date()
    }]);
  }

  private addBookingCards(bookings: Booking[]) {
    setTimeout(() => {
      this.chatHistory.update(h => [...h, {
        id: 'msg-' + Date.now(),
        sender: 'ai',
        type: 'bookings',
        content: '',
        bookings: bookings,
        timestamp: new Date()
      }]);
    }, 300);
  }

  private addLoyaltyCard(data: LoyaltyBalance) {
    setTimeout(() => {
      this.chatHistory.update(h => [...h, {
        id: 'msg-' + Date.now(),
        sender: 'ai',
        type: 'loyalty',
        content: '',
        loyaltyData: data,
        timestamp: new Date()
      }]);
    }, 300);
  }

  private addRfpCards(rfps: EventRfp[]) {
    setTimeout(() => {
      this.chatHistory.update(h => [...h, {
        id: 'msg-' + Date.now(),
        sender: 'ai',
        type: 'rfps',
        content: '',
        rfps: rfps,
        timestamp: new Date()
      }]);
    }, 300);
  }

  private addNavLinks(links: NavLink[]) {
    setTimeout(() => {
      this.chatHistory.update(h => [...h, {
        id: 'msg-' + Date.now(),
        sender: 'ai',
        type: 'nav-links',
        content: '',
        navLinks: links,
        timestamp: new Date()
      }]);
    }, 400);
  }

  private extractEntities(p: string) {
    const currentState = { ...this.state() };

    // Category extraction
    if (p.includes('wedding') || p.includes('shaadi') || p.includes('marriage')) {
      currentState.category = 'wedding';
    } else if (p.includes('birthday') || p.includes('janmadin') || p.includes('anniversary') || p.includes('party')) {
      currentState.category = 'birthday';
    } else if (p.includes('corporate') || p.includes('office') || p.includes('conference') || p.includes('meeting')) {
      currentState.category = 'corporate';
    } else if (p.includes('makeup') || p.includes('styling') || p.includes('beauty') || p.includes('mehendi') || p.includes('hairstyling')) {
      currentState.category = 'beauty';
    } else if (p.includes('travel') || p.includes('transport') || p.includes('car') || p.includes('bus') || p.includes('logistics')) {
      currentState.category = 'travel';
    } else if (p.includes('shopping') || p.includes('attire') || p.includes('invite') || p.includes('gift')) {
      currentState.category = 'shopping';
    }

    // Location extraction (expanded cities)
    const cities = [
      'hyderabad', 'secunderabad', 'banjara hills', 'jubilee hills', 'madhapur', 'gachibowli', 'kondapur', 'hitech city', 'begumpet',
      'mumbai', 'delhi', 'bangalore', 'bengaluru', 'pune', 'chennai', 'kolkata', 'gurugram', 'gurgaon', 'noida',
      'delhi ncr'
    ];
    for (const city of cities) {
      if (p.includes(city)) {
        currentState.location = city.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        break;
      }
    }

    // Budget extraction
    const lakhMatch = p.match(/(?:under|below|less than|budget of|within)?\s*(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|l)\b/i);
    if (lakhMatch) {
      currentState.maxBudget = parseFloat(lakhMatch[1]) * 100000;
    } else {
      const kMatch = p.match(/(?:under|below|less than|budget of|within)?\s*(\d+(?:\.\d+)?)\s*(?:k|thousand|thousands)\b/i);
      if (kMatch) {
        currentState.maxBudget = parseFloat(kMatch[1]) * 1000;
      } else {
        const plainPriceMatch = p.match(/(?:under|below|less than|budget of|within)?\s*(\d{4,8})\b/i);
        if (plainPriceMatch) {
          currentState.maxBudget = parseInt(plainPriceMatch[1], 10);
        }
      }
    }

    // Guests extraction
    const guestsMatch = p.match(/(\d+)\s*(?:guests|people|persons|capacity|pax|members)\b/i);
    if (guestsMatch) {
      currentState.guests = parseInt(guestsMatch[1], 10);
    }

    // Sustainability extraction
    if (p.includes('eco') || p.includes('sustainable') || p.includes('green') || p.includes('organic') || p.includes('sustainability')) {
      currentState.sustainabilityOnly = true;
    }

    this.state.set(currentState);
  }

  private buildFilterSummary(state: RoshiState): string {
    const parts: string[] = [];
    if (state.category) {
      parts.push(`<strong>${state.category.toUpperCase()}</strong> category`);
    }
    if (state.location) {
      parts.push(`in <strong>${state.location}</strong>`);
    }
    if (state.maxBudget !== undefined) {
      parts.push(`under <strong>₹${(state.maxBudget / 100000).toFixed(2).replace(/\.00$/, '')} Lakhs</strong>`);
    }
    if (state.guests !== undefined) {
      parts.push(`for <strong>${state.guests} guests</strong>`);
    }
    if (state.sustainabilityOnly) {
      parts.push(`with <strong>eco-friendly</strong> options`);
    }
    return parts.join(', ');
  }

  private setDefaultChips() {
    this.suggestionChips.set(['🔍 Find Packages', '📋 My Bookings', '🎁 My Rewards', '❓ How it Works']);
  }

  private updateSearchChips() {
    const currentState = this.state();
    const chips: string[] = [];

    if (!currentState.location) {
      chips.push('in Hyderabad', 'in Mumbai', 'in Bangalore');
    }
    if (currentState.maxBudget === undefined) {
      chips.push('under 5 Lakhs', 'under 10 Lakhs');
    }
    if (currentState.guests === undefined) {
      chips.push('for 200 guests', 'for 500 guests');
    }
    chips.push('Reset Search');

    this.suggestionChips.set(chips.slice(0, 4));
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      'pending': 'status-pending',
      'advance_paid': 'status-advance',
      'confirmed': 'status-confirmed',
      'in_progress': 'status-progress',
      'completed': 'status-completed',
      'settled': 'status-settled',
      'cancelled': 'status-cancelled',
      'disputed': 'status-disputed',
      'open': 'status-open',
      'receiving_bids': 'status-bids',
      'bid_selected': 'status-confirmed',
      'closed': 'status-settled'
    };
    return map[status] || 'status-pending';
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      'pending': 'Pending',
      'advance_paid': 'Advance Paid',
      'confirmed': 'Confirmed',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'settled': 'Settled',
      'cancelled': 'Cancelled',
      'disputed': 'Disputed',
      'open': 'Open',
      'receiving_bids': 'Receiving Bids',
      'bid_selected': 'Bid Selected',
      'closed': 'Closed'
    };
    return map[status] || status;
  }

  formatCurrency(amount: number): string {
    if (!amount) return '₹0';
    if (amount >= 100000) {
      return '₹' + (amount / 100000).toFixed(1) + 'L';
    } else if (amount >= 1000) {
      return '₹' + (amount / 1000).toFixed(0) + 'K';
    }
    return '₹' + amount.toLocaleString('en-IN');
  }

  getTierIcon(tier: string): string {
    const map: Record<string, string> = { 'Bronze': '🥉', 'Silver': '🥈', 'Gold': '🥇' };
    return map[tier] || '🏆';
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private scrollToBottom() {
    try {
      if (this.chatContainer) {
        this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
      }
    } catch(err) { }
  }
}
