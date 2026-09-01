'use client';

import type { Payment } from '@pantopus/types';

interface PaymentBreakdownProps {
  payment: Payment;
  /** Show from the payer's perspective (cost) or payee's (earnings). */
  perspective?: 'payer' | 'payee';
  /** Compact mode for sidebar. */
  compact?: boolean;
}

function formatCents(cents: number | undefined | null): string {
  if (cents === undefined || cents === null) return '$0.00';
  return `$${(cents / 100).toFixed(2)}`;
}

export default function PaymentBreakdown({
  payment,
  perspective = 'payer',
  compact = false,
}: PaymentBreakdownProps) {
  const subtotal = payment.amount_subtotal || payment.amount_total;
  const platformFee = payment.amount_platform_fee || 0;
  const toPayee = payment.amount_to_payee || 0;
  const total = payment.amount_total;
  const tip = payment.tip_amount || 0;
  const refunded = payment.refunded_amount || 0;

  if (compact) {
    return (
      <div className="text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-app-text-secondary">Subtotal</span>
          <span className="font-medium">{formatCents(subtotal)}</span>
        </div>
        {tip > 0 && (
          <div className="flex justify-between">
            <span className="text-app-text-secondary">Tip</span>
            <span className="font-medium text-green-600">+{formatCents(tip)}</span>
          </div>
        )}
        <div className="flex justify-between border-t pt-1 mt-1">
          <span className="font-medium text-app-text-strong">Total</span>
          <span className="font-semibold">{formatCents(total + tip)}</span>
        </div>
        {refunded > 0 && (
          <div className="flex justify-between text-red-600">
            <span>Refunded</span>
            <span>-{formatCents(refunded)}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-app-surface border border-app-border rounded-xl p-4 space-y-3">
      <h4 className="font-semibold text-app-text text-sm">
        {perspective === 'payer' ? 'Payment Summary' : 'Earnings Breakdown'}
      </h4>

      <div className="space-y-2 text-sm">
        {/* Subtotal */}
        <div className="flex justify-between">
          <span className="text-app-text-secondary">Service amount</span>
          <span className="text-app-text">{formatCents(subtotal)}</span>
        </div>

        {/* Platform fee */}
        {perspective === 'payer' ? (
          <div className="flex justify-between">
            <span className="text-app-text-secondary">Service fee</span>
            <span className="text-app-text">{formatCents(platformFee)}</span>
          </div>
        ) : (
          <div className="flex justify-between">
            <span className="text-app-text-secondary">Platform fee</span>
            <span className="text-red-600">-{formatCents(platformFee)}</span>
          </div>
        )}

        {/* Tip */}
        {tip > 0 && (
          <div className="flex justify-between">
            <span className="text-app-text-secondary">Tip</span>
            <span className="text-green-600">+{formatCents(tip)}</span>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-app-border-subtle my-1" />

        {/* Total or Earnings */}
        {perspective === 'payer' ? (
          <div className="flex justify-between font-semibold">
            <span className="text-app-text">Total charged</span>
            <span className="text-app-text">{formatCents(total)}</span>
          </div>
        ) : (
          <div className="flex justify-between font-semibold">
            <span className="text-app-text">You earn</span>
            <span className="text-green-700">{formatCents(toPayee + tip)}</span>
          </div>
        )}

        {/* Refund info */}
        {refunded > 0 && (
          <>
            <div className="border-t border-app-border-subtle my-1" />
            <div className="flex justify-between text-red-600">
              <span>Refunded</span>
              <span>-{formatCents(refunded)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-app-text">Net</span>
              <span>{formatCents(total - refunded)}</span>
            </div>
          </>
        )}
      </div>

      {/* Payment method info */}
      {payment.payment_method_brand && payment.payment_method_last4 && (
        <div className="pt-2 border-t border-app-border-subtle">
          <div className="flex items-center gap-2 text-xs text-app-text-secondary">
            <span className="capitalize">{payment.payment_method_brand}</span>
            <span>····</span>
            <span>{payment.payment_method_last4}</span>
          </div>
        </div>
      )}
    </div>
  );
}
