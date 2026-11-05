import type { CrewDayBookingCard, CrewDayRequestCard } from '@pantopus/types';

// The words for a booking's and a street request's state (01-spec.md rule 10: "Requested" isn't "Booked",
// "Paused" isn't "Refunded"), and the chip tones they use.

export type ChipTone = 'success' | 'info' | 'warning' | 'error' | 'neutral';

export const CHIP_CLASS: Record<ChipTone, string> = {
  success: 'bg-app-success-bg text-app-success',
  info: 'bg-app-info-bg text-app-info',
  warning: 'bg-app-warning-bg text-app-warning',
  error: 'bg-app-error-bg text-app-error',
  neutral: 'bg-app-surface-sunken text-app-text-strong',
};

export function bookingChip(card: Pick<CrewDayBookingCard, 'status' | 'charge' | 'problem_status'>): { label: string; tone: ChipTone } {
  if (card.problem_status === 'open') return { label: 'Paused', tone: 'warning' };
  switch (card.status) {
    case 'price_pending':
      return { label: 'Requested', tone: 'neutral' };
    case 'price_offered':
      return { label: 'Price ready', tone: 'warning' };
    case 'new_dates':
      return { label: 'Pick a date', tone: 'warning' };
    case 'on_the_way':
      return { label: 'On the way', tone: 'info' };
    case 'done':
      return { label: 'Done', tone: 'success' };
    case 'payment_failed':
      return { label: 'Payment due', tone: 'error' };
    case 'paid':
      return { label: 'Paid', tone: 'success' };
    case 'refunded':
      return { label: 'Refunded', tone: 'neutral' };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'neutral' };
    case 'declined':
      return { label: 'Not taken', tone: 'neutral' };
    default:
      return { label: 'Booked', tone: 'success' };
  }
}

export function requestChip(request: Pick<CrewDayRequestCard, 'status'>): { label: string; tone: ChipTone } {
  if (request.status === 'offer_ready') return { label: 'Offer ready', tone: 'success' };
  if (request.status === 'no_crew') return { label: 'No crew yet', tone: 'neutral' };
  return { label: 'Finding an option', tone: 'neutral' };
}

/** ["2026-03", "2026-04"] → "March or April"; ["any"] → "Any time". */
export function monthsText(months: string[]): string {
  if (!months.length || months.includes('any')) return 'Any time';
  const names = months.map((m) => {
    const [y, mo] = m.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, (mo || 1) - 1, 15)));
  });
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}
