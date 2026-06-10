/**
 * JoinEvents Invoice Model
 *
 * GST-compliant invoice structure for Indian marketplace.
 * Handles CGST/SGST (intra-state) and IGST (inter-state) calculations.
 * Implements TDS deduction under Section 194-O for e-commerce operators.
 */

export interface PlatformInvoice {
  /** Unique invoice number (e.g. JE-INV-2026-00001) */
  invoiceNumber: string;
  invoiceDate: string;

  // Booking reference
  bookingId: string;
  bookingNumber: string;
  eventDate: string;
  eventCategory: string;

  // Parties
  customerName: string;
  customerGstin?: string;
  vendorName: string;
  vendorGstin?: string;
  vendorPan?: string;
  /** JoinEvents platform GSTIN */
  platformGstin: string;

  // Amounts
  /** Gross booking value before any deductions */
  grossAmount: number;
  /** Platform commission amount */
  platformFee: number;
  /** Commission rate applied */
  commissionRate: number;

  // GST on platform commission
  /** Central GST — 9% of platformFee (intra-state) */
  cgst: number;
  /** State GST — 9% of platformFee (intra-state) */
  sgst: number;
  /** Integrated GST — 18% of platformFee (inter-state) */
  igst: number;
  /** Whether this is an inter-state transaction */
  isInterState: boolean;

  // TDS
  /** TDS deducted under Section 194-O (1% of gross amount) */
  tdsAmount: number;
  tdsRate: number;

  // Final payout
  /** Net vendor payout = grossAmount - platformFee - tdsAmount */
  vendorPayout: number;

  // Status
  status: 'generated' | 'sent' | 'paid' | 'cancelled';
  createdAt: string;
}

/** JoinEvents registered GSTIN (placeholder — replace with actual) */
export const PLATFORM_GSTIN = '36AAECJ1234R1ZX';
export const PLATFORM_PAN = 'AAECJ1234R';
export const PLATFORM_LEGAL_NAME = 'JoinEvents Technologies Pvt. Ltd.';
export const PLATFORM_ADDRESS = 'Plot 45, HITEC City, Hyderabad, Telangana 500081';
