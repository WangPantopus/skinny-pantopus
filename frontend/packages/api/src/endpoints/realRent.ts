// ============================================================
// REAL RENT BENCHMARK — the resident's own contribution (Wave 3)
//
// The block AGGREGATE never comes from here: it rides the place
// intelligence contract's `real_rent` section, behind the k>=10 floor.
// These three routes carry only the CALLER'S OWN figure — write it,
// read it back, withdraw it.
//
// Writing is T4-gated server-side (403 VERIFICATION_REQUIRED): "ten
// neighbors who proved they live here" is the entire difference
// between this and a listings-site estimate, so only a verified
// occupant may report. Reading your own figure needs only home access
// — it is your number, and hiding it would just look broken.
// ============================================================

import { get, put, del } from '../client';

export interface RentReport {
  /** Whole dollars per month, as the resident reported it. */
  monthly_rent: number;
  /** The size the report is FOR; falls back to the home's own count. */
  bedrooms: number | null;
  reported_at: string;
  updated_at: string;
}

/**
 * PUT /api/homes/:id/rent-report — contribute or update.
 * Verified occupants only (403 `VERIFICATION_REQUIRED` otherwise);
 * an implausible amount comes back 400 `BAD_AMOUNT`.
 *
 * Omitting `bedrooms` lets the server use the home's own bedroom
 * count — pass it explicitly when editing a report that already
 * carries one, so an edit never silently drops the size.
 */
export async function setRentReport(
  homeId: string,
  monthlyRent: number,
  bedrooms?: number,
): Promise<RentReport> {
  const body: { monthly_rent: number; bedrooms?: number } = { monthly_rent: monthlyRent };
  if (bedrooms != null) body.bedrooms = bedrooms;
  const res = await put<{ report: RentReport }>(`/api/homes/${homeId}/rent-report`, body);
  return res.report;
}

/** GET /api/homes/:id/rent-report — the caller's own report here, or null. */
export async function getRentReport(homeId: string): Promise<RentReport | null> {
  const res = await get<{ report: RentReport | null }>(`/api/homes/${homeId}/rent-report`);
  return res.report;
}

/** DELETE /api/homes/:id/rent-report — withdraw it from the block aggregate. */
export async function deleteRentReport(homeId: string): Promise<void> {
  await del<{ removed: boolean }>(`/api/homes/${homeId}/rent-report`);
}
