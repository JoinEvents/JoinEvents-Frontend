export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderRole: 'customer' | 'vendor' | 'admin';
  content: string;
  timestamp: string;
  isRead: boolean;
  type: 'text' | 'image' | 'doc';
}

export interface ChatThread {
  id: string;
  bookingId?: string;
  participants: { id: string; name: string; role: string }[];
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  subject: string;
  status?: 'Pending' | 'Accepted' | 'Rejected' | 'Active' | 'Closed';
  avatar?: string;
  eventTitle?: string;
}

export interface SupportTicket {
  id: string;
  customerId: string;
  customerName: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
  messages: ChatMessage[];
}
