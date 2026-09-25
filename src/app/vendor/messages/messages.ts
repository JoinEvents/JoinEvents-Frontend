import { Component, signal, computed, OnInit, inject, ViewChild, ElementRef, AfterViewChecked, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessengerService } from '../../core/services/messenger.service';
import { AuthService } from '../../core/services/auth.service';
import { ChatThread, ChatMessage } from '../../core/models/message.model';
import { CommonModule } from '@angular/common';
import { timer, of } from 'rxjs';
import { switchMap, catchError, map, filter } from 'rxjs/operators';
import { RealtimeService } from '../../core/services/realtime.service';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-vendor-messages',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './messages.html',
  styleUrl: './messages.css'
})
export class VendorMessages implements OnInit, AfterViewChecked {
  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;

  private messenger = inject(MessengerService);
  private auth = inject(AuthService);
  private destroyRef = inject(DestroyRef);
  private realtime = inject(RealtimeService);

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

    // Messages arrive the moment they are sent: into the open conversation, and the list
    // refreshes for the others.
    this.messenger.liveMessages$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(m => {
      const active = this.selectedThread();
      if (active && m.threadId === active.id) {
        this.messages.update(list => {
          if (list.some(x => x.id === m.id)) return list;
          // Our own optimistic copy becomes the saved message.
          const temp = list.findIndex(x => typeof x.id === 'string' && x.id.startsWith('temp-') && x.content === m.content && this.isSent(m));
          if (temp >= 0) {
            const copy = [...list];
            copy[temp] = m;
            return copy;
          }
          return [...list, m];
        });
        if (!this.isSent(m)) this.messenger.markAsRead(active.id).subscribe();
        setTimeout(() => this.scrollToBottom(), 50);
      }
      const me = this.user()?.id;
      if (me) this.messenger.getChatThreads(me).pipe(catchError(() => of([]))).subscribe(t => { if (t.length) this.threads.set(t); });
    });

    const userId = this.user()?.id || 'v1';
    
    this.messenger.getChatThreads(userId).pipe(
      catchError(err => {
        console.error('Failed to load chat threads initially:', err);
        return of([]);
      })
    ).subscribe(t => { 
      this.threads.set(t); 
      if (t.length && window.innerWidth > 768) {
        this.openThread(t[0]); 
      }
    });

    // Background polling for messages every 3 seconds
    this.selectedThread$.pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap(active => {
        if (!active) return of([]);
        // Live messages arrive over the hub; polling only covers a dropped connection.
        return timer(0, 3000).pipe(
          filter(tick => tick === 0 || !this.realtime.connected()),
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

      const userId = this.user()?.id || 'v1';
      this.messenger.getChatThreads(userId).subscribe(updated => {
        this.threads.set(updated);
      });
    });

    // Background polling for threads/status every 5 seconds
    timer(5000, 5000).pipe(
      takeUntilDestroyed(this.destroyRef),
      filter(() => !this.realtime.connected()),
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

  acceptThread() {
    const thread = this.selectedThread();
    if (!thread) return;

    this.messenger.acceptChat(thread.id).subscribe({
      next: () => {
        // Update local thread status immediately
        const updatedThread: ChatThread = { ...thread, status: 'Accepted' };
        this.selectedThread.set(updatedThread);
        // Force refresh threads list
        const userId = this.user()?.id || 'v1';
        this.messenger.getChatThreads(userId).subscribe(t => this.threads.set(t));
      },
      error: (err) => console.error('Error accepting chat:', err)
    });
  }

  rejectThread() {
    const thread = this.selectedThread();
    if (!thread) return;

    this.messenger.rejectChat(thread.id).subscribe({
      next: () => {
        // Update local thread status immediately
        const updatedThread: ChatThread = { ...thread, status: 'Rejected' };
        this.selectedThread.set(updatedThread);
        // Force refresh threads list
        const userId = this.user()?.id || 'v1';
        this.messenger.getChatThreads(userId).subscribe(t => this.threads.set(t));
      },
      error: (err) => console.error('Error rejecting chat:', err)
    });
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
      senderRole: 'vendor', 
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
