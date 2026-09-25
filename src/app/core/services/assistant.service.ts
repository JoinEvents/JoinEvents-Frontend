import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';

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

/** Roshi, the customer's event concierge, answered by the API from the customer's real data. */
@Injectable({ providedIn: 'root' })
export class AssistantService extends BaseApiService {
  welcome(): Observable<AssistantReply> {
    return this.get<AssistantReply>('/assistant/welcome', undefined, true);
  }

  /** The conversation so far, oldest first, ending with the customer's message. */
  chat(messages: AssistantTurn[]): Observable<AssistantReply> {
    return this.post<AssistantReply>('/assistant/chat', { messages }, true);
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
