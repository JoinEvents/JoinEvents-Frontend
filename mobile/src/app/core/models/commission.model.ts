/**
 * JoinEvents Platform Commission Model
 *
 * These interfaces define the SHAPE of data returned by backend APIs.
 * All commission rates, calculations, and business rules live on the backend.
 * The frontend only displays what the API returns.
 *
 * Backend is the single source of truth for:
 *   - Commission rates per category
 *   - Min/max fee caps
 *   - TDS deduction rules
 *   - Vendor subscription discounts on commission
 *   - GST calculations on commission
 */

/** Shape of the commission config returned by GET /commission/config */
export interface CommissionConfig {
  /** Default commission rate as a decimal (e.g. 0.10 = 10%) */
  defaultRate: number;
  /** Category-specific commission rates override the default */
  categoryRates: Record<string, number>;
  /** Minimum platform fee per booking in ₹ */
  minFee: number;
  /** Maximum platform fee per booking in ₹ */
  maxFee: number;
  /** GST rate applied on the platform's commission (e.g. 0.18 = 18%) */
  gstOnCommission: number;
  /** TDS rate deducted on vendor payouts under Section 194-O */
  tdsRate: number;
}

/** Shape of the fee breakdown returned by POST /commission/calculate */
export interface PlatformFeeBreakdown {
  /** Total booking value (what the customer pays) */
  bookingAmount: number;
  /** Event category used to determine the rate */
  eventCategory: string;
  /** Applied commission rate (e.g. 0.10 for 10%) */
  commissionRate: number;
  /** Platform commission in ₹ */
  commissionAmount: number;
  /** GST on platform's commission */
  gstOnCommission: number;
  /** TDS deducted from vendor payout */
  tdsDeduction: number;
  /** Net amount vendor receives after all deductions */
  vendorPayout: number;
  /** Platform's net revenue */
  platformRevenue: number;
}
