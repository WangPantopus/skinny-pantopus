/**
 * Unified status colors used across the entire app.
 *
 * Gig and Bid statuses are sourced from @pantopus/ui-utils.
 * Home-task, Bill, and Issue statuses remain local (web-only).
 */

import {
  GIG_STATUS_STYLES as GIG_STATUS,
  BID_STATUS_STYLES as BID_STATUS,
  statusClasses,
  statusLabel,
} from '@pantopus/ui-utils';
import type { StatusStyle } from '@pantopus/ui-utils';

// Re-export shared statuses with their legacy names
export { GIG_STATUS, BID_STATUS, statusClasses, statusLabel };

// ─── Home-task statuses (web-only) ──────────────────────────
export const TASK_STATUS: Record<string, StatusStyle> = {
  open:        { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Open',        bgHex: '#ECFDF5', textHex: '#047857' },
  in_progress: { bg: 'bg-violet-50',  text: 'text-violet-700',  label: 'In Progress', bgHex: '#F5F3FF', textHex: '#6D28D9' },
  done:        { bg: 'bg-teal-50',    text: 'text-teal-700',    label: 'Done',        bgHex: '#F0FDFA', textHex: '#0F766E' },
  canceled:    { bg: 'bg-gray-100',   text: 'text-gray-500',    label: 'Canceled',    bgHex: '#F3F4F6', textHex: '#6B7280' },
};

// ─── Bill statuses (web-only) ───────────────────────────────
export const BILL_STATUS: Record<string, StatusStyle> = {
  due:      { bg: 'bg-blue-50',   text: 'text-blue-700',  label: 'Due',      bgHex: '#EFF6FF', textHex: '#1D4ED8' },
  paid:     { bg: 'bg-teal-50',   text: 'text-teal-700',  label: 'Paid',     bgHex: '#F0FDFA', textHex: '#0F766E' },
  overdue:  { bg: 'bg-red-50',    text: 'text-red-600',   label: 'Overdue',  bgHex: '#FEF2F2', textHex: '#DC2626' },
  canceled: { bg: 'bg-gray-100',  text: 'text-gray-500',  label: 'Canceled', bgHex: '#F3F4F6', textHex: '#6B7280' },
};

// ─── Issue statuses (web-only) ──────────────────────────────
export const ISSUE_STATUS: Record<string, StatusStyle> = {
  open:        { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Open',        bgHex: '#ECFDF5', textHex: '#047857' },
  scheduled:   { bg: 'bg-violet-50',  text: 'text-violet-700',  label: 'Scheduled',   bgHex: '#F5F3FF', textHex: '#6D28D9' },
  in_progress: { bg: 'bg-amber-50',   text: 'text-amber-700',   label: 'In Progress', bgHex: '#FFFBEB', textHex: '#B45309' },
  resolved:    { bg: 'bg-teal-50',    text: 'text-teal-700',    label: 'Resolved',    bgHex: '#F0FDFA', textHex: '#0F766E' },
  canceled:    { bg: 'bg-gray-100',   text: 'text-gray-500',    label: 'Canceled',    bgHex: '#F3F4F6', textHex: '#6B7280' },
};
