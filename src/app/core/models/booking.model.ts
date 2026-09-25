export type BookingStatus = 'pending' | 'advance_paid' | 'confirmed' | 'in_progress' | 'completed' | 'settled' | 'cancelled' | 'rejected' | 'disputed';

export interface BookingService {
  serviceId: string;
  serviceName: string;
  category: string;
  vendorId: string;
  vendorName: string;
  price: number;
  status: 'pending' | 'confirmed' | 'completed' | 'included' | 'in_progress';
}

export interface Booking {
  id: string;
  bookingNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  vendorId?: string;
  vendorName?: string;
  vendorPhone?: string;
  vendorEmail?: string;
  vendorLocation?: string;
  vendorDescription?: string;
  eventTypeId: string;
  eventName: string;
  packageId?: string;
  packageName?: string;
  eventDate: string;
  venue: string;
  city: string;
  guestCount: number;
  status: BookingStatus;
  advanceAmount: number;
  baseAmount: number;
  extraServicesAmount: number;
  damageCharges: number;
  damageChargeNotes?: string;
  isDamageChargeApproved?: boolean;
  gstPercent: number;
  totalAmount: number;
  finalPaidAmount?: number;
  /** Everything the customer has paid so far, from confirmed payments. */
  amountPaid?: number;
  /** What is still owed on the booking. */
  balanceDue?: number;
  // --- Platform Revenue Fields (populated by backend) ---
  platformFeeRate?: number;
  platformFeeAmount?: number;
  tdsDeducted?: number;
  vendorPayoutAmount?: number;
  
  // --- Escrow & Guarantee Fields (managed by backend) ---
  escrowStatus?: 'held' | 'released' | 'refunded';
  guaranteeStatus?: 'active' | 'claimed' | 'resolved' | 'expired';
  vendorConfirmedAt?: string;
  vendorConfirmationDue?: string;
  cancellationReason?: string;
  cancelledBy?: 'customer' | 'vendor' | 'system';
  cancellationDate?: string;
  cancellationFee?: number;
  platformCancellationFeeRetained?: number;
  refundAmount?: number;
  refundStatus?: 'none' | 'pending' | 'processed' | 'failed';
  refundTransactionId?: string;
  vendorPenaltyAmount?: number;
  vendorStrikeApplied?: boolean;
  disputeInfo?: {
    reason: string;
    status: 'open' | 'resolved';
    resolution?: string;
  };
  review?: {
    rating: number;
    comment: string;
  };
  services: BookingService[];
  createdAt: string;
  notes?: string;
  assignedTo?: string;
  internalNotes?: string;
  supportLogs?: { date: string, message: string, actor: string }[];
}

/** One priced item of a quote, before GST. */
export interface BookingQuoteLine {
  description: string;
  /** How the amount was reached, e.g. "₹450 per plate × 200 guests". */
  detail?: string | null;
  amount: number;
}

/** The server's price for a package and guest count — exactly what a booking will charge. */
export interface BookingQuote {
  packageId: string;
  packageName: string;
  vendorId: string;
  guestCount: number;
  maxGuests?: number | null;
  lines: BookingQuoteLine[];
  subtotal: number;
  gstPercent: number;
  gstAmount: number;
  totalAmount: number;
  advancePercent: number;
  advanceAmount: number;
  balanceAmount: number;
}

/** What a customer asks to book. Amounts are never sent: the server prices the booking. */
export interface CreateBookingRequest {
  packageId: string;
  vendorId?: string;
  eventDate: string;
  guestCount: number;
  eventName?: string;
  venue?: string;
  city?: string;
}
