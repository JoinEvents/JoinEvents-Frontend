import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { AuthService } from './auth.service';

/** One turn as the API takes it. */
export interface AssistantTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantPackage {
  id: string;
  name: string;
  vendorName: string;
  category: string;
  city: string;
  price: number;
  maxGuests: number;
  rating: number;
  reviews: number;
  image?: string | null;
}

export interface AssistantBooking {
  id: string;
  bookingNumber: string;
  eventName: string;
  eventDate: string;
  status: string;
  vendorName: string;
  packageName: string;
  guests: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
}

export interface AssistantRewards {
  points: number;
  tier: string;
  nextTier?: string | null;
  pointsToNextTier?: number | null;
}

export interface AssistantCard {
  type: 'packages' | 'bookings' | 'rewards';
  packages?: AssistantPackage[];
  bookings?: AssistantBooking[];
  rewards?: AssistantRewards;
}

/** A button that names a screen: packages, bookings, rewards, quotes, messages, support, booking:<id>, package:<id>, category:<key>. */
export interface AssistantAction {
  label: string;
  target: string;
}

export interface AssistantReply {
  reply: string;
  cards: AssistantCard[];
  actions: AssistantAction[];
  suggestions: string[];
  poweredBy: 'claude' | 'rules';
}

export interface RoshiMessage {
  id: number;
  from: 'user' | 'roshi';
  text: string;
  html?: string;
  cards?: AssistantCard[];
  actions?: AssistantAction[];
  failed?: boolean;
}

/**
 * Roshi, the customer's event concierge, answered by the API from the customer's real bookings,
 * rewards and the listed packages. The conversation lives here, not in the page, so it survives
 * opening a package or booking from a card and coming back.
 */
@Injectable({ providedIn: 'root' })
export class AssistantService extends BaseApiService {
  private auth = inject(AuthService);

  readonly messages = signal<RoshiMessage[]>([]);
  readonly suggestions = signal<string[]>([]);
  readonly thinking = signal(false);
  readonly poweredBy = signal<'claude' | 'rules' | null>(null);
  readonly started = computed(() => this.messages().length > 0);

  private nextId = 1;
  private greetedFor: string | null = null;
  private lastFailed: string | null = null;

  constructor() {
    super();
    // Someone else signing in on this phone gets a fresh conversation.
    effect(() => {
      const id = this.auth.currentUser()?.id ?? null;
      if (this.greetedFor !== null && id !== this.greetedFor) this.reset();
    });
  }

  /** Opens the conversation with a personal greeting, once per signed-in customer. */
  greet(): void {
    const id = this.auth.currentUser()?.id ?? null;
    if (!id || this.greetedFor === id) return;
    this.greetedFor = id;
    this.thinking.set(true);
    this.get<AssistantReply>('/assistant/welcome').subscribe({
      next: reply => this.receive(reply),
      error: () => {
        this.thinking.set(false);
        const text = "Hi! I'm **Roshi**, your event concierge. Ask me to find packages, check your bookings or explain refunds.";
        this.push({ from: 'roshi', text, html: formatAssistantText(text) });
        this.suggestions.set(['Find wedding packages', 'My bookings', 'How do refunds work?']);
      }
    });
  }

  send(raw: string): void {
    const text = raw.trim();
    if (!text || this.thinking()) return;
    this.lastFailed = null;
    this.push({ from: 'user', text });
    this.suggestions.set([]);
    this.thinking.set(true);

    const history: AssistantTurn[] = this.messages()
      .filter(m => !m.failed && m.text)
      .map(m => ({ role: m.from === 'user' ? 'user' : 'assistant', content: m.text } as AssistantTurn))
      .slice(-20);

    this.post<AssistantReply>('/assistant/chat', { messages: history }).subscribe({
      next: reply => this.receive(reply),
      error: err => {
        this.thinking.set(false);
        this.lastFailed = text;
        const message = err?.status === 429
          ? "You're sending messages quickly. Give me a moment and try again."
          : "I couldn't reach the server. Check your connection and try again.";
        this.push({ from: 'roshi', text: message, html: formatAssistantText(message), failed: true });
      }
    });
  }

  retry(): void {
    const text = this.lastFailed;
    if (!text) return;
    // Drop the failure notice and the unanswered question; send it again.
    this.messages.update(list => list.slice(0, -2));
    this.send(text);
  }

  newConversation(): void {
    this.reset();
    this.greet();
  }

  private receive(reply: AssistantReply): void {
    this.thinking.set(false);
    this.poweredBy.set(reply.poweredBy);
    this.push({ from: 'roshi', text: reply.reply, html: formatAssistantText(reply.reply), cards: reply.cards ?? [], actions: reply.actions ?? [] });
    this.suggestions.set(reply.suggestions ?? []);
  }

  private push(message: Omit<RoshiMessage, 'id'>): void {
    this.messages.update(list => [...list, { ...message, id: this.nextId++ }]);
  }

  private reset(): void {
    this.messages.set([]);
    this.suggestions.set([]);
    this.thinking.set(false);
    this.greetedFor = null;
    this.lastFailed = null;
  }
}
/**
 * Roshi writes plain text with **bold** and "- " bullets. Escape everything, then add back only
 * those two, so nothing in a reply can inject markup.
 */
export function formatAssistantText(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const lines = escaped.split('\n');
  const html: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    const bullet = /^\s*[-•]\s+(.*)$/.exec(line);
    if (bullet) {
      if (!inList) { html.push('<ul>'); inList = true; }
      html.push(`<li>${bullet[1]}</li>`);
      continue;
    }
    if (inList) { html.push('</ul>'); inList = false; }
    html.push(line.trim() ? `<p>${line}</p>` : '');
  }
  if (inList) html.push('</ul>');
  return html.join('');
}
