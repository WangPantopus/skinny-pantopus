import type { ScheduleType } from '@pantopus/types';
import { PRO_CATEGORIES } from '@pantopus/types';

/**
 * Infer the best engagement mode based on category and schedule.
 *
 * Rules (same as backend):
 *  1. ASAP + non-pro category → instant_accept
 *  2. Pro category → quotes
 *  3. Everything else → curated_offers
 */
export function inferEngagementMode(
  category: string,
  scheduleType: ScheduleType,
  userOverride?: string | null,
): string {
  if (userOverride) return userOverride;

  const isPro = PRO_CATEGORIES.some(
    (c) => c.toLowerCase() === (category || '').toLowerCase(),
  );

  if (isPro) return 'quotes';
  if (scheduleType === 'asap') return 'instant_accept';
  return 'curated_offers';
}
