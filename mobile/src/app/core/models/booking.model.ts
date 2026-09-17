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
