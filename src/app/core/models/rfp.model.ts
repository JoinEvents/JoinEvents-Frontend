export type RfpStatus = 'open' | 'receiving_bids' | 'bid_selected' | 'closed';
export type BidStatus = 'pending' | 'accepted' | 'rejected';

export interface RfpBid {
  id: string;
  rfpId: string;
  vendorId: string;
  vendorName: string;
  vendorBusinessName: string;
  vendorRating: number;
  vendorReviews: number;
  isVerified: boolean;
  proposedAmount: number;
  description: string;
  deliverables: string[];
  validUntil: string;
  submittedAt: string;
  status: BidStatus;
}

export interface EventRfp {
  id: string;
  customerId: string;
  customerName: string;
  title: string;
  eventTypeId: string;
  eventTypeName: string;
  eventDate: string;
  city: string;
  venueStatus?: 'booked' | 'not_booked';
  venueName?: string;
  locality?: string;
  pincode?: string;
  guestCount: number;
  budgetMin: number;
  budgetMax: number;
  requirements: string;
  servicesNeeded: string[];
  status: RfpStatus;
  bids: RfpBid[];
  createdAt: string;
  expiresAt: string;
}
