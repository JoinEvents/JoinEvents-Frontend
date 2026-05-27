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
  userInput = signal('');
  
  chatHistory = signal<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'ai',
      type: 'text',
      content: 'Hi! I am Roshi, your JoinEvents assistant. What kind of event are you planning? (e.g., "Find me an eco-friendly wedding venue under 10 Lakhs")',
      timestamp: new Date()
    }
  ]);

  toggleChat() {
    this.aiService.toggle();
    if (this.isOpen()) {
      this.scrollToBottom();
    }
  }

  sendMessage() {
    const text = this.userInput().trim();
    if (!text) return;

    // Add user message
    this.chatHistory.update(h => [...h, {
      id: 'msg-' + Date.now(),
      sender: 'user',
      type: 'text',
      content: text,
      timestamp: new Date()
    }]);

    this.userInput.set('');
    this.isThinking.set(true);

    // Simulate AI thinking and querying
    setTimeout(() => {
      this.processPrompt(text);
    }, 1500);
  }

  private processPrompt(prompt: string) {
    const p = prompt.toLowerCase();
    
    // Simple intent matching based on our mock data
    let eventTypeMatch = null;
    if (p.includes('wedding')) eventTypeMatch = 'wedding';
    if (p.includes('birthday')) eventTypeMatch = 'birthday';
    
    const needsEco = p.includes('eco') || p.includes('sustainable') || p.includes('green');

    this.packageService.getPackages(eventTypeMatch || undefined).subscribe(packages => {
      let filtered = packages;
      
      if (needsEco) {
        filtered = filtered.filter(pkg => pkg.sustainabilityTags && pkg.sustainabilityTags.length > 0);
      }

      // Add AI Response
      let textResponse = '';
      if (filtered.length > 0) {
        textResponse = `I found some excellent ${needsEco ? 'sustainable ' : ''}options that match your vision! Here are a few curated packages:`;
      } else {
        textResponse = "I couldn't find exact matches for that right now, but here are our top premium packages instead:";
        filtered = packages; // fallback
      }

      this.isThinking.set(false);

      this.chatHistory.update(h => [...h, {
        id: 'msg-' + Date.now(),
        sender: 'ai',
        type: 'text',
        content: textResponse,
        timestamp: new Date()
      }]);

      if (filtered.length > 0) {
        // Send package cards
        setTimeout(() => {
          this.chatHistory.update(h => [...h, {
            id: 'msg-' + (Date.now() + 1),
            sender: 'ai',
            type: 'packages',
            content: '',
            packages: filtered.slice(0, 2), // Show top 2
            timestamp: new Date()
          }]);
        }, 500);
      }
    });
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
