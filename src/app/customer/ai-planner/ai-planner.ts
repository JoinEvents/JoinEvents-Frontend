import { Component, ElementRef, ViewChild, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AiService } from '../../core/services/ai.service';
import { AuthService } from '../../core/services/auth.service';
import {
  AssistantAction, AssistantCard, AssistantReply, AssistantService, AssistantTurn, formatAssistantText
} from '../../core/services/assistant.service';

interface RoshiMessage {
  id: number;
  from: 'user' | 'roshi';
  text: string;
  html?: string;
  cards?: AssistantCard[];
  actions?: AssistantAction[];
  failed?: boolean;
}

/**
 * Roshi, the customer's event concierge. The API answers from the customer's own bookings,
 * rewards and the listed packages (with Claude when configured), so everything shown here is
 * real: package and booking cards open the right screens, and buttons take the customer there.
 */
@Component({
  selector: 'app-ai-planner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-planner.html',
  styleUrl: './ai-planner.css'
})
export class AiPlanner {
  private assistant = inject(AssistantService);
  private aiService = inject(AiService);
  private auth = inject(AuthService);
  private router = inject(Router);

  @ViewChild('chatContainer') private chatContainer?: ElementRef<HTMLElement>;
  @ViewChild('chatInput') private chatInput?: ElementRef<HTMLInputElement>;

  readonly isOpen = this.aiService.isOpen;
  readonly isThinking = signal(false);
  readonly messages = signal<RoshiMessage[]>([]);
  readonly suggestions = signal<string[]>([]);
  readonly poweredBy = signal<'claude' | 'rules' | null>(null);
  userInput = '';

  private nextId = 1;
  private greetedFor: string | null = null;
  private lastFailedText: string | null = null;

  constructor() {
    // A different person signing in starts a fresh conversation.
    effect(() => {
      const userId = this.auth.currentUser()?.id ?? null;
      if (userId !== this.greetedFor && this.greetedFor !== null) this.reset();
    });
    // Greet the first time the panel opens.
    effect(() => {
      if (this.isOpen() && this.greetedFor !== (this.auth.currentUser()?.id ?? null)) this.greet();
      if (this.isOpen()) this.focusInput();
    });
  }

  toggleChat(): void {
    this.aiService.toggle();
  }

  newChat(): void {
    this.reset();
    this.greet();
  }

  selectChip(chip: string): void {
    this.userInput = chip;
    this.sendMessage();
  }

  retry(): void {
    if (!this.lastFailedText) return;
    this.messages.update(list => list.filter(m => !m.failed));
    this.userInput = this.lastFailedText;
    this.messages.update(list => list.slice(0, -1)); // drop the unanswered question; it is re-sent
    this.sendMessage();
  }

  sendMessage(): void {
    const text = this.userInput.trim();
    if (!text || this.isThinking()) return;
    this.userInput = '';
    this.lastFailedText = null;
    this.push({ from: 'user', text });
    this.suggestions.set([]);
    this.isThinking.set(true);

    const history: AssistantTurn[] = this.messages()
      .filter(m => !m.failed && m.text)
      .map(m => ({ role: m.from === 'user' ? 'user' : 'assistant', content: m.text } as AssistantTurn))
      .slice(-20);

    this.assistant.chat(history).subscribe({
      next: reply => this.receive(reply),
      error: err => {
        this.isThinking.set(false);
        this.lastFailedText = text;
        const message = err?.status === 429
          ? "You're sending messages quickly. Give me a moment and try again."
          : "I couldn't reach the server just now.";
        this.push({ from: 'roshi', text: message, html: formatAssistantText(message), failed: true });
      }
    });
  }

  /** Buttons and cards name a screen; map it to this app's routes. */
  open(target: string, category?: string): void {
    const [kind, id] = target.includes(':') ? [target.slice(0, target.indexOf(':')), target.slice(target.indexOf(':') + 1)] : [target, ''];
    switch (kind) {
      case 'booking': this.router.navigate(['/bookings'], { queryParams: { bookingId: id } }); break;
      case 'package': this.router.navigate(['/events/vendors'], { queryParams: { [category || 'wedding']: id } }); break;
      case 'category': this.router.navigate(['/events/vendors'], { queryParams: { [id]: '' } }); break;
      case 'bookings': this.router.navigate(['/bookings']); break;
      case 'rewards': this.router.navigate(['/rewards']); break;
      case 'quotes': this.router.navigate(['/get-quotes']); break;
      case 'messages': this.router.navigate(['/messages']); break;
      case 'support': this.router.navigate(['/support']); break;
      default: this.router.navigate(['/events']);
    }
    // On a phone-sized screen the panel covers the page; get out of the way.
    if (window.innerWidth < 768) this.aiService.close();
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'Awaiting payment', advance_paid: 'Paid', confirmed: 'Confirmed', in_progress: 'In progress',
      completed: 'Completed', settled: 'Settled', cancelled: 'Cancelled', rejected: 'Declined', disputed: 'Disputed'
    };
    return map[status] ?? status;
  }

  statusClass(status: string): string {
    if (['confirmed', 'completed', 'settled'].includes(status)) return 'status-success';
    if (['pending', 'advance_paid', 'in_progress'].includes(status)) return 'status-warning';
    if (['cancelled', 'rejected', 'disputed'].includes(status)) return 'status-danger';
    return 'status-info';
  }

  tierIcon(tier: string): string {
    return ({ Gold: '🥇', Silver: '🥈', Bronze: '🥉' } as Record<string, string>)[tier] ?? '⭐';
  }

  money(value: number): string {
    return '₹' + Math.round(value || 0).toLocaleString('en-IN');
  }

  shortPrice(value: number): string {
    if (!value) return 'Price on request';
    return value >= 100000 ? `₹${(value / 100000).toFixed(value % 100000 ? 1 : 0)}L` : `₹${Math.round(value / 1000)}K`;
  }

  private greet(): void {
    this.greetedFor = this.auth.currentUser()?.id ?? null;
    if (!this.greetedFor) return;
    this.isThinking.set(true);
    this.assistant.welcome().subscribe({
      next: reply => this.receive(reply),
      error: () => {
        this.isThinking.set(false);
        const text = "Hi! I'm **Roshi**, your event concierge. Ask me to find packages, check your bookings or explain refunds.";
        this.push({ from: 'roshi', text, html: formatAssistantText(text) });
        this.suggestions.set(['Find wedding packages', 'My bookings', 'How do refunds work?']);
      }
    });
  }

  private receive(reply: AssistantReply): void {
    this.isThinking.set(false);
    this.poweredBy.set(reply.poweredBy);
    this.push({
      from: 'roshi',
      text: reply.reply,
      html: formatAssistantText(reply.reply),
      cards: reply.cards ?? [],
      actions: reply.actions ?? []
    });
    this.suggestions.set(reply.suggestions ?? []);
    this.focusInput();
  }

  private push(message: Omit<RoshiMessage, 'id'>): void {
    this.messages.update(list => [...list, { ...message, id: this.nextId++ }]);
    setTimeout(() => {
      const el = this.chatContainer?.nativeElement;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }, 30);
  }

  private reset(): void {
    this.messages.set([]);
    this.suggestions.set([]);
    this.isThinking.set(false);
    this.greetedFor = null;
    this.lastFailedText = null;
  }

  private focusInput(): void {
    setTimeout(() => this.chatInput?.nativeElement.focus(), 250);
  }
}
