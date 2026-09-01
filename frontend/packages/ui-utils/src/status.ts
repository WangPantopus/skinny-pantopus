// ============================================================
// STATUS STYLE MAPS
// Single source of truth for badge colors across the app.
// Provides both Tailwind class names (web) and hex values (mobile).
// ============================================================

export interface StatusStyle {
  label: string;
  bg: string;
  text: string;
  /** Hex background for React Native */
  bgHex: string;
  /** Hex text color for React Native */
  textHex: string;
}

const fallback: StatusStyle = {
  label: 'Unknown',
  bg: 'bg-gray-100',
  text: 'text-gray-600',
  bgHex: '#F3F4F6',
  textHex: '#4B5563',
};

// ─── Gig / Task statuses ────────────────────────────────────
export const GIG_STATUS_STYLES: Record<string, StatusStyle> = {
  open:        { label: 'Open',        bg: 'bg-emerald-50',  text: 'text-emerald-700', bgHex: '#ECFDF5', textHex: '#047857' },
  pending:     { label: 'Pending',     bg: 'bg-amber-50',    text: 'text-amber-700',   bgHex: '#FFFBEB', textHex: '#B45309' },
  assigned:    { label: 'Assigned',    bg: 'bg-blue-50',     text: 'text-blue-700',    bgHex: '#EFF6FF', textHex: '#1D4ED8' },
  in_progress: { label: 'In Progress', bg: 'bg-violet-50',   text: 'text-violet-700',  bgHex: '#F5F3FF', textHex: '#6D28D9' },
  completed:   { label: 'Completed',   bg: 'bg-teal-50',     text: 'text-teal-700',    bgHex: '#F0FDFA', textHex: '#0F766E' },
  confirmed:   { label: 'Confirmed',   bg: 'bg-teal-50',     text: 'text-teal-700',    bgHex: '#F0FDFA', textHex: '#0F766E' },
  cancelled:   { label: 'Cancelled',   bg: 'bg-gray-100',    text: 'text-gray-500',    bgHex: '#F3F4F6', textHex: '#6B7280' },
  expired:     { label: 'Expired',     bg: 'bg-gray-100',    text: 'text-gray-400',    bgHex: '#F3F4F6', textHex: '#9CA3AF' },
  rejected:    { label: 'Rejected',    bg: 'bg-red-50',      text: 'text-red-600',     bgHex: '#FEF2F2', textHex: '#DC2626' },
  disputed:    { label: 'Disputed',    bg: 'bg-orange-50',   text: 'text-orange-700',  bgHex: '#FFF7ED', textHex: '#C2410C' },
};

// ─── Bid / Offer statuses ───────────────────────────────────
export const BID_STATUS_STYLES: Record<string, StatusStyle> = {
  pending:   { label: 'Pending',   bg: 'bg-amber-50',   text: 'text-amber-700',  bgHex: '#FFFBEB', textHex: '#B45309' },
  accepted:  { label: 'Accepted',  bg: 'bg-teal-50',    text: 'text-teal-700',   bgHex: '#F0FDFA', textHex: '#0F766E' },
  rejected:  { label: 'Rejected',  bg: 'bg-red-50',     text: 'text-red-600',    bgHex: '#FEF2F2', textHex: '#DC2626' },
  declined:  { label: 'Declined',  bg: 'bg-red-50',     text: 'text-red-600',    bgHex: '#FEF2F2', textHex: '#DC2626' },
  withdrawn: { label: 'Withdrawn', bg: 'bg-gray-100',   text: 'text-gray-500',   bgHex: '#F3F4F6', textHex: '#6B7280' },
  expired:   { label: 'Expired',   bg: 'bg-gray-100',   text: 'text-gray-400',   bgHex: '#F3F4F6', textHex: '#9CA3AF' },
  countered: { label: 'Countered', bg: 'bg-purple-50',  text: 'text-purple-700', bgHex: '#FAF5FF', textHex: '#7C3AED' },
};

// ─── Payment statuses ───────────────────────────────────────
export const PAYMENT_STATUS_STYLES: Record<string, StatusStyle> = {
  pending:             { label: 'Pending',          bg: 'bg-amber-50',    text: 'text-amber-700',   bgHex: '#FFFBEB', textHex: '#B45309' },
  processing:          { label: 'Processing',       bg: 'bg-blue-50',     text: 'text-blue-700',    bgHex: '#EFF6FF', textHex: '#1D4ED8' },
  requires_action:     { label: 'Action Required',  bg: 'bg-orange-50',   text: 'text-orange-700',  bgHex: '#FFF7ED', textHex: '#C2410C' },
  requires_capture:    { label: 'Awaiting Capture',bg: 'bg-indigo-50',   text: 'text-indigo-700',  bgHex: '#EEF2FF', textHex: '#4338CA' },
  succeeded:           { label: 'Succeeded',        bg: 'bg-teal-50',     text: 'text-teal-700',    bgHex: '#F0FDFA', textHex: '#0F766E' },
  paid:                { label: 'Paid',              bg: 'bg-teal-50',     text: 'text-teal-700',    bgHex: '#F0FDFA', textHex: '#0F766E' },
  failed:              { label: 'Failed',            bg: 'bg-red-50',      text: 'text-red-600',     bgHex: '#FEF2F2', textHex: '#DC2626' },
  cancelled:           { label: 'Cancelled',         bg: 'bg-gray-100',    text: 'text-gray-500',    bgHex: '#F3F4F6', textHex: '#6B7280' },
  refunded:            { label: 'Refunded',          bg: 'bg-sky-50',      text: 'text-sky-700',     bgHex: '#F0F9FF', textHex: '#0369A1' },
  partially_refunded:  { label: 'Partial Refund',    bg: 'bg-sky-50',      text: 'text-sky-700',     bgHex: '#F0F9FF', textHex: '#0369A1' },
  disputed:            { label: 'Disputed',          bg: 'bg-orange-50',   text: 'text-orange-700',  bgHex: '#FFF7ED', textHex: '#C2410C' },
  held:                { label: 'Held',              bg: 'bg-yellow-50',   text: 'text-yellow-700',  bgHex: '#FEFCE8', textHex: '#A16207' },
  released:            { label: 'Released',          bg: 'bg-emerald-50',  text: 'text-emerald-700', bgHex: '#ECFDF5', textHex: '#047857' },
  transferred:         { label: 'Transferred',       bg: 'bg-emerald-50',  text: 'text-emerald-700', bgHex: '#ECFDF5', textHex: '#047857' },
  payout_pending:      { label: 'Payout Pending',    bg: 'bg-amber-50',    text: 'text-amber-700',   bgHex: '#FFFBEB', textHex: '#B45309' },
  payout_paid:         { label: 'Paid Out',           bg: 'bg-teal-50',     text: 'text-teal-700',    bgHex: '#F0FDFA', textHex: '#0F766E' },
  payout_failed:       { label: 'Payout Failed',     bg: 'bg-red-50',      text: 'text-red-600',     bgHex: '#FEF2F2', textHex: '#DC2626' },
};

// ─── Listing statuses ───────────────────────────────────────
export const LISTING_STATUS_STYLES: Record<string, StatusStyle> = {
  draft:          { label: 'Draft',          bg: 'bg-gray-100',    text: 'text-gray-500',    bgHex: '#F3F4F6', textHex: '#6B7280' },
  active:         { label: 'Active',         bg: 'bg-emerald-50',  text: 'text-emerald-700', bgHex: '#ECFDF5', textHex: '#047857' },
  pending_pickup: { label: 'Pending Pickup', bg: 'bg-amber-50',    text: 'text-amber-700',   bgHex: '#FFFBEB', textHex: '#B45309' },
  sold:           { label: 'Sold',           bg: 'bg-teal-50',     text: 'text-teal-700',    bgHex: '#F0FDFA', textHex: '#0F766E' },
  archived:       { label: 'Archived',       bg: 'bg-gray-100',    text: 'text-gray-400',    bgHex: '#F3F4F6', textHex: '#9CA3AF' },
};

// ─── Change-order statuses ───────────────────────────────────
export const CHANGE_ORDER_STATUS_STYLES: Record<string, StatusStyle> = {
  pending:   { label: 'Pending',   bg: 'bg-yellow-100', text: 'text-yellow-800', bgHex: '#FEF9C3', textHex: '#854D0E' },
  approved:  { label: 'Approved',  bg: 'bg-green-100',  text: 'text-green-800',  bgHex: '#DCFCE7', textHex: '#166534' },
  rejected:  { label: 'Rejected',  bg: 'bg-red-100',    text: 'text-red-700',    bgHex: '#FEE2E2', textHex: '#B91C1C' },
  withdrawn: { label: 'Withdrawn', bg: 'bg-gray-100',   text: 'text-gray-500',   bgHex: '#F3F4F6', textHex: '#6B7280' },
};

// ─── Helpers ─────────────────────────────────────────────────

/** Get Tailwind class string for a status badge. */
export function statusClasses(
  map: Record<string, StatusStyle>,
  status: string,
): string {
  const s = map[status] || fallback;
  return `${s.bg} ${s.text}`;
}

/** Get display label for a status value. */
export function statusLabel(
  map: Record<string, StatusStyle>,
  status: string,
): string {
  return map[status]?.label || status?.replace(/_/g, ' ') || 'Unknown';
}

/** Get the hex text color for a gig status (handy for RN). */
export function getStatusColor(status: string): string {
  return GIG_STATUS_STYLES[status]?.textHex || fallback.textHex;
}
