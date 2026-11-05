import { cookies } from 'next/headers';
import { launchFeatures } from '@/lib/featureFlags';
import { crewDayShareCode, fetchPublicCrewDay } from '@/lib/publicShare';
import type { PublicCrewDay } from '@/lib/crewDay';

/**
 * The invitation behind a page under /crew-day/<code>, read on the server with the visitor's session (for
 * `viewer`). `code` is null while Crew Day is off or when the path can't be a share code; the page then says
 * "This Crew Day isn't available", as it does for the server's 404 (no such day, or not approved) and 403 (off).
 */
export async function readCrewDayForPage(
  rawCode: string,
): Promise<{ code: string | null; day: PublicCrewDay | null; status: number }> {
  const code = crewDayShareCode(rawCode);
  if (!launchFeatures.crewDay || !code) return { code: null, day: null, status: 404 };
  const access = (await cookies()).get('pantopus_access')?.value ?? null;
  const result = await fetchPublicCrewDay(code, access);
  return { code, day: result.data, status: result.status };
}

/** True when the page should say "This Crew Day isn't available". */
export function crewDayUnavailable(page: { code: string | null; status: number }): boolean {
  return !page.code || page.status === 404 || page.status === 403;
}
