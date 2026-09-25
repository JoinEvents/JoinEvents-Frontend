import { VendorBusinessProfile } from '../models/user.model';

/**
 * The name the API gives a vendor record it creates on the vendor's behalf
 * (VendorVerificationController). CreatePackage rejects it as "incomplete",
 * so it counts as no business name at all.
 */
export const PLACEHOLDER_BUSINESS_NAME = 'My Vendor Business';

export interface VendorReadiness {
  /** KYC documents approved by the support team. */
  kycVerified: boolean;
  /** Business name and description set, as CreatePackage requires. */
  profileComplete: boolean;
  /** What is missing from the profile, for the vendor to fix. */
  profileGaps: string[];
}

/** Mirrors the checks VendorPackagesController.CreatePackage makes before accepting a package. */
export function profileGaps(profile: Pick<VendorBusinessProfile, 'businessName' | 'description'> | null): string[] {
  const gaps: string[] = [];
  const name = profile?.businessName?.trim() ?? '';
  if (!name || name.toLowerCase() === PLACEHOLDER_BUSINESS_NAME.toLowerCase()) gaps.push('Business name');
  if (!profile?.description?.trim()) gaps.push('Business description');
  return gaps;
}

export function vendorReadiness(
  verification: { isVerified?: unknown } | null,
  profile: VendorBusinessProfile | null
): VendorReadiness {
  const gaps = profileGaps(profile);
  return { kycVerified: verification?.isVerified === true, profileComplete: !gaps.length, profileGaps: gaps };
}
