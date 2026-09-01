'use client';

import type { PaymentStatus } from '@pantopus/types';

/**
 * Maps payment_status to display label + Tailwind color classes.
 */
const STATUS_MAP: Record<
  string,
  { label: string; bg: string; text: string; dot: string }
> = {
  none: { label: 'No Payment', bg: 'bg-app-surface-sunken', text: 'text-app-text-secondary', dot: 'bg-gray-400' },
  setup_pending: { label: 'Saving Card', bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  ready_to_authorize: { label: 'Card Saved', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400' },
  authorize_pending: { label: 'Authorizing', bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  authorized: { label: 'Authorized', bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  authorization_failed: { label: 'Auth Failed', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  capture_pending: { label: 'Capturing', bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  captured_hold: { label: 'Payment Held', bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  transfer_scheduled: { label: 'Payout Scheduled', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400' },
  transfer_pending: { label: 'Payout Processing', bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  transferred: { label: 'Paid Out', bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  refund_pending: { label: 'Refund Pending', bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  refunded_partial: { label: 'Partially Refunded', bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-400' },
  refunded_full: { label: 'Refunded', bg: 'bg-app-surface-sunken', text: 'text-app-text-secondary', dot: 'bg-gray-400' },
  disputed: { label: 'Disputed', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  canceled: { label: 'Canceled', bg: 'bg-app-surface-sunken', text: 'text-app-text-secondary', dot: 'bg-gray-400' },
  // Legacy
  succeeded: { label: 'Succeeded', bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  pending: { label: 'Pending', bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  processing: { label: 'Processing', bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  completed: { label: 'Completed', bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  failed: { label: 'Failed', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
};

interface PaymentStatusBadgeProps {
  status: PaymentStatus | string | undefined | null;
  /** Show additional description tooltip on hover. */
  showTooltip?: boolean;
  /** Size variant. */
  size?: 'sm' | 'md';
}

export default function PaymentStatusBadge({
  status,
  size = 'sm',
}: PaymentStatusBadgeProps) {
  if (!status || status === 'none') return null;

  const info = STATUS_MAP[status] || {
    label: status,
    bg: 'bg-app-surface-sunken',
    text: 'text-app-text-secondary',
    dot: 'bg-gray-400',
  };

  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${info.bg} ${info.text} ${sizeClasses}`}
      title={info.label}
    >
      <span className={`${dotSize} rounded-full ${info.dot}`} />
      {info.label}
    </span>
  );
}
