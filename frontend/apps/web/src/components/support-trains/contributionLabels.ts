// What a helper brings to a Support Train slot, named as the train pages show it.
export const CONTRIBUTION_LABELS: Record<string, string> = {
  cook: 'Home-cooked meal',
  takeout: 'Takeout / delivery',
  groceries: 'Groceries',
};

/** "Home-cooked meal: Lentil soup": the contribution and, when given, the dish or restaurant. */
export function contributionSummary(reservation: {
  contribution_mode?: string | null;
  dish_title?: string | null;
  restaurant_name?: string | null;
}): string {
  const mode = reservation.contribution_mode;
  const label = mode ? CONTRIBUTION_LABELS[mode] || mode.replace(/_/g, ' ') : null;
  return [label, reservation.dish_title || reservation.restaurant_name || null].filter(Boolean).join(': ');
}
