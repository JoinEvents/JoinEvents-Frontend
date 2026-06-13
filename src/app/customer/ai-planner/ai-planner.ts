import { Component, signal, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PackageService } from '../../core/services/package.service';
import { AiService } from '../../core/services/ai.service';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  type: 'text' | 'packages';
  content: string;
  packages?: any[];
  timestamp: Date;
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
export class AiPlanner implements AfterViewChecked {
  private packageService = inject(PackageService);
  private aiService = inject(AiService);

  @ViewChild('chatContainer') private chatContainer!: ElementRef;

  isOpen = this.aiService.isOpen;
  isThinking = signal(false);
  userInput = '';

  // Conversation state tracking
  state = signal<RoshiState>({});
  
  // Suggestion chips
  suggestionChips = signal<string[]>([
    'Wedding Packages',
    'Birthday Venues',
    'Cancellation Policy',
    'Eco-Friendly Venues'
  ]);
  
  chatHistory = signal<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'ai',
      type: 'text',
      content: `Hi! I am <strong>Roshi</strong>, your JoinEvents assistant. 🌸<br><br>
      What kind of event are you planning? You can search for packages, ask about our policies, or request budget options! <br>
      <em>(e.g., "Find a wedding venue in Banjara Hills under 10 Lakhs" or "What is the cancellation policy?")</em>`,
      timestamp: new Date()
    }
  ]);

  toggleChat() {
    this.aiService.toggle();
    if (this.isOpen()) {
      this.scrollToBottom();
    }
  }

  selectChip(chip: string) {
    this.userInput = chip;
    this.sendMessage();
  }

  sendMessage() {
    const text = this.userInput.trim();
    if (!text) return;

    // Add user message
    this.chatHistory.update(h => [...h, {
      id: 'msg-' + Date.now(),
      sender: 'user',
      type: 'text',
      content: text,
      timestamp: new Date()
    }]);

    this.userInput = '';
    this.isThinking.set(true);

    // Simulate thinking duration
    setTimeout(() => {
      this.processPrompt(text);
    }, 1200);
  }

  private processPrompt(prompt: string) {
    const p = prompt.toLowerCase().trim();
    // Clean prompt: lowercase and strip punctuation at start/end
    const cleanP = p.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim();

    // 1. Reset / Onboarding Intent
    const isReset = /^(reset|start over|clear|restart)$/i.test(cleanP);
    if (isReset) {
      this.state.set({});
      this.isThinking.set(false);
      this.chatHistory.update(h => [...h, {
        id: 'msg-' + Date.now(),
        sender: 'ai',
        type: 'text',
        content: `I've reset our conversation context. What can I help you plan today?`,
        timestamp: new Date()
      }]);
      this.updateSuggestionChips();
      return;
    }

    // 2. Greeting Intent
    const isGreeting = /^(hi|hello|hey|greetings|good\s*morning|good\s*afternoon|good\s*evening|yo|hola|namaste)$/i.test(cleanP);
    if (isGreeting) {
      this.isThinking.set(false);
      this.chatHistory.update(h => [...h, {
        id: 'msg-' + Date.now(),
        sender: 'ai',
        type: 'text',
        content: `Hello! 😊 How can I help you plan your event today?<br>
        You can ask me to find packages (e.g. "wedding in Hyderabad") or ask about cancellation policies!`,
        timestamp: new Date()
      }]);
      this.updateSuggestionChips();
      return;
    }

    // 3. Smalltalk / Help Intent
    if (cleanP === 'help' || cleanP === 'info' || cleanP === 'what can you do' || cleanP === 'who are you' || cleanP === 'what is your name') {
      this.isThinking.set(false);
      this.chatHistory.update(h => [...h, {
        id: 'msg-' + Date.now(),
        sender: 'ai',
        type: 'text',
        content: `I am **Roshi**, your JoinEvents planning assistant! 🌸<br><br>
        I can help you:<br>
        • **Search for venues & packages** (Wedding, Birthday, Corporate, etc.) by city, budget, guest count, or sustainability.<br>
        • **Explain cancellation and refund policies** dynamically.<br>
        • **Explore payment trust & disputing options** on JoinEvents.<br><br>
        Try asking me: *"Find wedding packages under 10 Lakhs"* or *"What happens if I cancel 10 days before?"*`.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
        timestamp: new Date()
      }]);
      this.updateSuggestionChips();
      return;
    }

    // 4. Polite response / Smalltalk
    if (/^(thanks|thank you|ok|okay|cool|great|awesome|perfect|good|fine)$/i.test(cleanP)) {
      this.isThinking.set(false);
      this.chatHistory.update(h => [...h, {
        id: 'msg-' + Date.now(),
        sender: 'ai',
        type: 'text',
        content: `You're welcome! Let me know if you need anything else for your event planning. 😊`,
        timestamp: new Date()
      }]);
      this.updateSuggestionChips();
      return;
    }

    // 5. Cancellation Policy FAQ Routing
    if (p.includes('cancel') || p.includes('refund') || p.includes('refunds') || p.includes('policy') || p.includes('money back') || p.includes('penalty') || p.includes('strike')) {
      this.handleCancellationFAQ(p);
      return;
    }

    // 3. Extract search criteria from input
    this.extractEntities(p);

    const currentState = this.state();

    // If no category is detected yet, prompt user to pick one
    if (!currentState.category) {
      this.isThinking.set(false);
      this.chatHistory.update(h => [...h, {
        id: 'msg-' + Date.now(),
        sender: 'ai',
        type: 'text',
        content: `I can help you search for packages! What type of event category are you looking for? (e.g., Wedding, Birthday, Corporate event, Beauty/Styling, Travel/Transport, Event Shopping)`,
        timestamp: new Date()
      }]);
      this.suggestionChips.set(['Wedding', 'Birthday Party', 'Corporate Event', 'Beauty & Styling', 'Travel & Transport', 'Event Shopping']);
      return;
    }

    // Call service to get packages for current category
    this.packageService.getPackages(currentState.category).subscribe(packages => {
      let filtered = packages;

      // Filter by location
      if (currentState.location) {
        const loc = currentState.location.toLowerCase();
        filtered = filtered.filter(pkg => 
          (pkg.location && pkg.location.toLowerCase().includes(loc)) ||
          (pkg.city && pkg.city.toLowerCase().includes(loc))
        );
      }

      // Filter by budget
      if (currentState.maxBudget !== undefined) {
        filtered = filtered.filter(pkg => pkg.price <= currentState.maxBudget!);
      }

      // Filter by guests capacity
      if (currentState.guests !== undefined) {
        filtered = filtered.filter(pkg => pkg.maxGuests >= currentState.guests!);
      }

      // Filter by sustainability
      if (currentState.sustainabilityOnly) {
        filtered = filtered.filter(pkg => pkg.sustainabilityTags && pkg.sustainabilityTags.length > 0);
      }

      this.isThinking.set(false);

      let textResponse = '';
      const filterSummary = this.buildFilterSummary(currentState);

      if (filtered.length > 0) {
        textResponse = `I found **${filtered.length}** event package${filtered.length > 1 ? 's' : ''} matching ${filterSummary}:`;
      } else {
        textResponse = `I couldn't find exact matches matching ${filterSummary}. However, here are some of our popular general packages:`;
        filtered = packages.slice(0, 3); // Fallback to category defaults
      }

      // Convert Markdown bold to HTML bold for display
      textResponse = textResponse.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

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
            packages: filtered.slice(0, 3), // Show top 3 results
            timestamp: new Date()
          }]);
        }, 300);
      }

      this.updateSuggestionChips();
    });
  }

  private extractEntities(p: string) {
    const currentState = { ...this.state() };

    // Category extraction
    if (p.includes('wedding') || p.includes('shaadi') || p.includes('marriage')) {
      currentState.category = 'wedding';
    } else if (p.includes('birthday') || p.includes('janmadin') || p.includes('anniversary')) {
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

    // Location extraction
    const cities = ['hyderabad', 'secunderabad', 'banjara hills', 'jubilee hills', 'madhapur', 'gachibowli', 'kondapur', 'hitech city', 'begumpet'];
    for (const city of cities) {
      if (p.includes(city)) {
        // Capitalize words
        currentState.location = city.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        break;
      }
    }

    // Budget extraction (e.g. under 5 lakhs, under 10l, under 50k, under 200000)
    const lakhMatch = p.match(/(?:under|below|less than|budget of)?\s*(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|l)\b/i);
    if (lakhMatch) {
      currentState.maxBudget = parseFloat(lakhMatch[1]) * 100000;
    } else {
      const kMatch = p.match(/(?:under|below|less than|budget of)?\s*(\d+(?:\.\d+)?)\s*(?:k|thousand|thousands)\b/i);
      if (kMatch) {
        currentState.maxBudget = parseFloat(kMatch[1]) * 1000;
      } else {
        const plainPriceMatch = p.match(/(?:under|below|less than|budget of)?\s*(\d{4,8})\b/i);
        if (plainPriceMatch) {
          currentState.maxBudget = parseInt(plainPriceMatch[1], 10);
        }
      }
    }

    // Guests extraction (e.g. for 500 guests, 300 people, capacity of 200)
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
      parts.push(`**${state.category.toUpperCase()}** category`);
    }
    if (state.location) {
      parts.push(`located in **${state.location}**`);
    }
    if (state.maxBudget !== undefined) {
      parts.push(`under **₹${(state.maxBudget / 100000).toFixed(2).replace(/\.00$/, '')} Lakhs**`);
    }
    if (state.guests !== undefined) {
      parts.push(`fitting **${state.guests} guests**`);
    }
    if (state.sustainabilityOnly) {
      parts.push(`with **eco-friendly / sustainable** policies`);
    }
    return parts.join(', ');
  }

  private handleCancellationFAQ(p: string) {
    this.isThinking.set(false);
    
    let responseText = '';
    
    // Check if user specified a day number (e.g., "in 20 days", "cancel 10 days before")
    const dayMatch = p.match(/(\d+)\s*days?\b/i);
    if (dayMatch) {
      const days = parseInt(dayMatch[1], 10);
      if (days > 30) {
        responseText = `If you cancel your booking **more than 30 days** before the event (you mentioned **${days} days**):<br>
        • You will get a **100% refund** of your advance amount.<br>
        • A small platform processing fee of 2% of the total booking (capped at ₹2,500) will be retained by JoinEvents.`;
      } else if (days >= 15 && days <= 30) {
        responseText = `If you cancel your booking between **15 and 30 days** before the event (you mentioned **${days} days**):<br>
        • You will get a **50% refund** of your advance amount.<br>
        • The remaining 50% is retained as a cancellation charge.`;
      } else if (days >= 7 && days < 15) {
        responseText = `If you cancel your booking between **7 and 14 days** before the event (you mentioned **${days} days**):<br>
        • You will get a **25% refund** of your advance amount.<br>
        • The remaining 75% is retained as a cancellation charge.`;
      } else {
        responseText = `If you cancel your booking **less than 7 days** before the event (you mentioned **${days} days**):<br>
        • You will receive a **0% refund** (100% of the advance is retained).`;
      }
    } else if (p.includes('vendor') && (p.includes('cancel') || p.includes('cancels'))) {
      responseText = `If a **Vendor cancels** a confirmed booking:<br>
      • The customer receives a **100% refund** of the advance paid.<br>
      • The vendor is penalized **10% of the total booking value** (capped at ₹15,000).<br>
      • The vendor receives 1 strike on their account. Multiple strikes lead to suspension.`;
    } else {
      // General overview
      responseText = `Here is the official **JoinEvents Cancellation & Refund Policy** for customers:<br><br>
      • <strong>&gt; 30 days before event:</strong> 100% refund of advance paid (minus 2% platform fee, capped at ₹2,500).<br>
      • <strong>15 to 30 days before:</strong> 50% refund of advance paid.<br>
      • <strong>7 to 14 days before:</strong> 25% refund of advance paid.<br>
      • <strong>&lt; 7 days before:</strong> 0% refund.<br><br>
      <em>Tip: If you have a specific date, tell me how many days are left (e.g. "I want to cancel 12 days before") and I can calculate it for you!</em>`;
    }

    this.chatHistory.update(h => [...h, {
      id: 'msg-' + Date.now(),
      sender: 'ai',
      type: 'text',
      content: responseText,
      timestamp: new Date()
    }]);

    this.suggestionChips.set([
      'Cancel 20 days before',
      'Cancel 5 days before',
      'What if Vendor cancels?',
      'Back to Search'
    ]);
  }

  private updateSuggestionChips() {
    const currentState = this.state();
    const chips: string[] = [];

    if (!currentState.category) {
      chips.push('Wedding Packages', 'Birthday Venues', 'Cancellation Policy', 'Eco-Friendly Venues');
    } else {
      // Prompt options based on what is missing
      if (!currentState.location) {
        chips.push('in Banjara Hills', 'in Jubilee Hills', 'in Madhapur');
      }
      if (currentState.maxBudget === undefined) {
        chips.push('under 5 Lakhs', 'under 10 Lakhs', 'under 50k');
      }
      if (currentState.guests === undefined) {
        chips.push('for 200 guests', 'for 500 guests', 'for 1000 guests');
      }
      if (!currentState.sustainabilityOnly) {
        chips.push('Eco-Friendly options');
      }
      chips.push('Cancellation Policy', 'Reset Search');
    }

    this.suggestionChips.set(chips.slice(0, 4)); // Show top 4 chips
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
