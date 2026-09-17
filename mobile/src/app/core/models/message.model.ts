export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderRole: 'customer' | 'vendor' | 'admin' | 'support';
  content: string;
  timestamp: string;
  isRead: boolean;
  type: 'text' | 'image' | 'doc';
  isInternal?: boolean;
}

export interface ChatThread {
  id: string;
  bookingId?: string;
  vendorId?: string;
  participants: { id: string; name: string; role: string }[];
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  subject: string;
  status?: 'Pending' | 'Accepted' | 'Rejected' | 'Active' | 'Closed';
  avatar?: string;
  eventTitle?: string;
}

export interface VendorContact {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
}

export interface BookingDetails {
  id: string;
  eventName: string;
  eventDate: string;
  status: string;
  totalAmount: number;
  venue: string;
  city: string;
  guestCount: number;
}

export interface SupportTicket {
  id: string;
  customerId: string;
  customerName: string;
  customerAvatar?: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
  messages: ChatMessage[];
  eventName?: string;
  vendorContact?: VendorContact;
  attachmentUrl?: string;
  bookingId?: string;
  bookingDetails?: BookingDetails;
}
