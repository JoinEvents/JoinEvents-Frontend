import { Component, signal, computed, OnInit, inject, ViewChild, ElementRef, AfterViewChecked, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessengerService } from '../../core/services/messenger.service';
import { AuthService } from '../../core/services/auth.service';
import { ChatThread, ChatMessage } from '../../core/models/message.model';
import { CommonModule } from '@angular/common';
import { timer, of } from 'rxjs';
import { switchMap, catchError, map } from 'rxjs/operators';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-customer-messages',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './messages.html',
  styleUrl: './messages.css'
})
export class CustomerMessages implements OnInit, AfterViewChecked {
  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;

  private messenger = inject(MessengerService);
  private auth = inject(AuthService);
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  threads = signal<ChatThread[]>([]);
  searchQuery = signal('');
  filteredThreads = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.threads();
    return this.threads().filter(t => 
      t.subject?.toLowerCase().includes(q) || 
      t.lastMessage?.toLowerCase().includes(q)
    );
  });
  messages = signal<ChatMessage[]>([]);
  selectedThread = signal<ChatThread | null>(null);
  selectedThread$ = toObservable(this.selectedThread);
  newMessage = '';
  user = this.auth.currentUser;

  ngOnInit() {
    this.destroyRef.onDestroy(() => {
      this.messenger.activeThreadId.set(null);
    });

    const userId = this.user()?.id || 'c1';
    
    this.messenger.getChatThreads(userId).pipe(
      catchError(err => {
        console.error('Failed to load chat threads initially:', err);
        return of([]);
      })
    ).subscribe(t => { 
      this.threads.set(t); 

      // Check query params for redirected booking chat creation
      const vendorId = this.route.snapshot.queryParams['vendorId'];
      const bookingId = this.route.snapshot.queryParams['bookingId'];

      if (vendorId) {
        const targetVendorId = vendorId.toLowerCase();
        // Look for an existing thread with this vendor and this specific booking (if bookingId provided)
        const existingThread = t.find(thread => {
          const matchesVendor = thread.vendorId?.toLowerCase() === targetVendorId ||
            thread.participants.some(p => p.id.toLowerCase() === targetVendorId && p.role === 'vendor');
          if (!matchesVendor) return false;
          if (bookingId) {
            return thread.bookingId?.toLowerCase() === bookingId.toLowerCase();
          }
          return true;
        });

        if (existingThread) {
          this.openThread(existingThread);
          this.clearQueryParams();
        } else {
          // If no thread exists, initiate a chat request for this booking
          const initialMessage = "Hi, I have booked your service. Let's discuss details.";
          this.messenger.requestChat(vendorId, bookingId || null, initialMessage).subscribe({
            next: (res) => {
              // Reload threads
              this.messenger.getChatThreads(userId).pipe(
                catchError(() => of([]))
              ).subscribe(newThreads => {
                this.threads.set(newThreads);
                const newT = newThreads.find(nt => nt.id === res.threadId);
                if (newT) {
                  this.openThread(newT);
                } else if (newThreads.length) {
                  // Fallback string matching
                  const found = newThreads.find(nt => nt.id.includes(res.threadId.substring(0, 8)));
                  if (found) this.openThread(found);
                }
                this.clearQueryParams();
              });
            },
            error: (err) => {
              console.error('Error initiating chat:', err);
              if (t.length && window.innerWidth > 768) {
                this.openThread(t[0]);
              }
              this.clearQueryParams();
            }
          });
        }
      } else {
        if (t.length && window.innerWidth > 768) {
          this.openThread(t[0]); 
        }
      }
    });

    // Background polling for messages every 3 seconds
    this.selectedThread$.pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap(active => {
        if (!active) return of([]);
        return timer(0, 3000).pipe(
          switchMap(() => this.messenger.getChatMessages(active.id).pipe(
            switchMap(newMsgs => {
              const currentIds = this.messages().filter(m => typeof m.id === 'string' && !m.id.startsWith('temp-')).map(m => m.id || '').join(',');
              const newIds = newMsgs.map(m => m.id || '').join(',');
              if (newIds !== currentIds) {
                return this.messenger.markAsRead(active.id).pipe(
                  map(() => newMsgs),
                  catchError(() => of(newMsgs))
                );
              }
              return of(newMsgs);
            }),
            catchError(() => of([]))
          ))
        );
      })
    ).subscribe(newMsgs => {
      this.messages.set(newMsgs);
      setTimeout(() => this.scrollToBottom(), 50);

      const userId = this.user()?.id || 'c1';
      this.messenger.getChatThreads(userId).subscribe(updated => {
        this.threads.set(updated);
      });
    });

    // Background polling for threads/status every 5 seconds
    timer(5000, 5000).pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap(() => this.messenger.getChatThreads(userId).pipe(catchError(() => of([]))))
    ).subscribe(ts => {
      if (ts.length) {
        const active = this.selectedThread();
        this.threads.set(ts);
        if (active) {
          const updated = ts.find(x => x.id === active.id);
          if (updated && updated.status !== active.status) {
            this.selectedThread.set(updated);
          }
        }
      }
    });
  }

  clearQueryParams() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { vendorId: null, bookingId: null },
      queryParamsHandling: 'merge'
    });
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  scrollToBottom(): void {
    try {
      if (this.myScrollContainer) {
        this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
      }
    } catch(err) { }
  }

  openThread(t: ChatThread) {
    this.selectedThread.set(t);
    this.messenger.activeThreadId.set(t.id);
    this.messages.set([]);

    if (t.unreadCount > 0) {
      t.unreadCount = 0;
      this.threads.update(list => list.map(item => item.id === t.id ? { ...item, unreadCount: 0 } : item));
      this.messenger.markAsRead(t.id).subscribe(() => {
        const currentThreads = this.threads();
        const totalUnread = currentThreads.reduce((sum, item) => sum + (item.unreadCount || 0), 0);
        this.messenger.unreadThreadsCount.set(totalUnread);
      });
    }

    setTimeout(() => this.scrollToBottom(), 50);
  }

  closeThread() {
    this.selectedThread.set(null);
    this.messenger.activeThreadId.set(null);
  }

  isChatDisabled(): boolean {
    const status = this.selectedThread()?.status;
    return status === 'Pending' || status === 'Rejected' || status === 'Closed';
  }

  sendMessage() {
    if (this.isChatDisabled() || !this.newMessage.trim()) return;
    
    const thread = this.selectedThread();
    const currentUser = this.user();
    if (!thread || !currentUser) return;

    const msgPayload: Partial<ChatMessage> = { 
      threadId: thread.id, 
      senderId: currentUser.id, 
      senderName: currentUser.name, 
      senderRole: 'customer', 
      content: this.newMessage, 
      timestamp: new Date().toISOString(), 
      isRead: false, 
      type: 'text' 
    };

    // Optimistic UI Update
    const tempId = 'temp-' + Date.now();
    const optimisticMsg: ChatMessage = { ...msgPayload, id: tempId } as ChatMessage;
    
    this.messages.update(m => [...m, optimisticMsg]);
    this.newMessage = '';
    
    this.messenger.sendMessage(msgPayload).subscribe({
      next: (savedMsg) => {
        this.messages.update(m => m.map(item => item.id === tempId ? savedMsg : item));
        setTimeout(() => this.scrollToBottom(), 50);
      },
      error: () => {
        this.messages.update(m => m.filter(item => item.id !== tempId));
      }
    });
  }
  formatTime(ts?: string): string {
    if (!ts) return '';
    let dateStr = ts;
    if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+') && !dateStr.includes('-')) {
      dateStr += 'Z';
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    if (isYesterday) {
      return 'Yesterday';
    }
    
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  }

  isSent(msg: ChatMessage): boolean { 
    return msg.senderId?.toLowerCase() === this.user()?.id?.toLowerCase(); 
  }
}
