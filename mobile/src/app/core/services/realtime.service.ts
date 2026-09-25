import { Injectable, NgZone, effect, inject, signal } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { Subject } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

/** A chat message as the hub pushes it. */
export interface LiveMessage {
  messageId: string;
  threadId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
}

/** A notification as the hub pushes it: the same shape GET /notifications returns. */
export interface LiveNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

/**
 * The live connection to the API's hub. While someone is signed in it stays connected
 * (reconnecting after drops and when the app resumes) and relays chat messages and
 * notifications as the server sends them. Screens poll only while it is down.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private auth = inject(AuthService);
  private zone = inject(NgZone);

  private connection: HubConnection | null = null;
  private connectedToken: string | null = null;

  readonly connected = signal(false);
  readonly messages$ = new Subject<LiveMessage>();
  readonly notifications$ = new Subject<LiveNotification>();

  constructor() {
    // Connect on sign-in, reconnect with a new token, disconnect on sign-out.
    effect(() => {
      const token = this.auth.currentUser()?.token ?? null;
      if (token === this.connectedToken) return;
      void this.stop().then(() => (token ? this.start(token) : undefined));
    });
  }

  /** The hub lives beside the API: https://host/api/v1 → https://host/hubs/chat. */
  static hubUrl(apiUrl: string): string {
    return apiUrl.replace(/\/api\/v\d+\/?$/, '').replace(/\/$/, '') + '/hubs/chat';
  }

  /** After the app returns from the background, reconnect if the OS dropped the socket. */
  async ensureConnected(): Promise<void> {
    const token = this.auth.currentUser()?.token;
    if (!token) return;
    if (this.connection?.state === HubConnectionState.Disconnected) {
      await this.stop();
      await this.start(token);
    }
  }

  private async start(token: string): Promise<void> {
    this.connectedToken = token;
    const connection = new HubConnectionBuilder()
      .withUrl(RealtimeService.hubUrl(environment.apiUrl), { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .configureLogging(environment.production ? LogLevel.None : LogLevel.Warning)
      .build();

    connection.on('ReceiveMessage', (m: Record<string, unknown>) => this.zone.run(() => this.messages$.next(normalizeMessage(m))));
    connection.on('Notification', (n: LiveNotification) => this.zone.run(() => this.notifications$.next(n)));
    connection.onreconnected(() => this.zone.run(() => this.connected.set(true)));
    connection.onreconnecting(() => this.zone.run(() => this.connected.set(false)));
    connection.onclose(() => this.zone.run(() => this.connected.set(false)));

    this.connection = connection;
    try {
      await connection.start();
      this.connected.set(true);
    } catch {
      // Offline or the API is unreachable: screens fall back to polling.
      this.connected.set(false);
    }
  }

  private async stop(): Promise<void> {
    const connection = this.connection;
    this.connection = null;
    this.connectedToken = null;
    this.connected.set(false);
    if (connection && connection.state !== HubConnectionState.Disconnected) {
      try {
        await connection.stop();
      } catch {
        // Already gone.
      }
    }
  }
}

/** The hub serialises camelCase; tolerate PascalCase too. */
function normalizeMessage(m: Record<string, unknown>): LiveMessage {
  const pick = (a: string, b: string) => String(m[a] ?? m[b] ?? '');
  return {
    messageId: pick('messageId', 'MessageId'),
    threadId: pick('threadId', 'ThreadId'),
    senderId: pick('senderId', 'SenderId'),
    senderName: pick('senderName', 'SenderName'),
    content: pick('content', 'Content'),
    timestamp: String(m['timestamp'] ?? m['Timestamp'] ?? new Date().toISOString())
  };
}
