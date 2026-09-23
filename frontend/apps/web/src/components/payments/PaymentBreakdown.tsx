'use client';

import type { Payment, PaymentGigFee } from '@pantopus/types';
import { verifiedSettlement } from './payeeRelease';

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

/** A charged poster-fault fee replaces the full-task total with one fee line. */
function chargedGigFee(payment: Payment): PaymentGigFee | null {
  const fee = payment.gig_fee;
  if (!fee || !['poster_no_show', 'late_cancel'].includes(fee.kind)) return null;
  const valid = [fee.fee_cents, fee.released_cents, fee.worker_share_cents].every(Number.isSafeInteger)
    && fee.fee_cents > 0 && fee.fee_cents < payment.amount_total && fee.released_cents === payment.amount_total - fee.fee_cents
    && fee.worker_share_cents >= 0 && fee.worker_share_cents <= fee.fee_cents;
  return valid ? fee : null;
}

function feeLine(fee: PaymentGigFee): string {
  return `${fee.kind === 'poster_no_show' ? 'No-show fee' : 'Cancellation fee'} ${formatCents(fee.fee_cents)} charged · ${formatCents(fee.released_cents)} released`;
}

function payerTotalLabel(payment: Payment): string {
  if (payment.payment_status === 'authorized') return 'Authorization hold';
  if (payment.payment_status === 'capture_pending') return 'Capture pending';
  // A pending refund may instead be cancellation of an uncaptured hold.
  if (payment.payment_status === 'refund_pending') {
    return payment.captured_at ? 'Task charged' : 'Payment total';
  }
  if (['captured_hold', 'transfer_scheduled', 'transfer_pending', 'transferred',
    'refunded_partial', 'refunded_full', 'disputed'].includes(payment.payment_status)) {
    return 'Task charged';
  }
  return 'Payment total';
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
  const settlement = verifiedSettlement(payment);
  const gigFee = chargedGigFee(payment);

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

        {/* Platform fee (it describes a full task charge, never a fee charge) */}
        {gigFee ? null : perspective === 'payer' ? (
          <div className="flex justify-between">
            <span className="text-app-text-secondary">Platform fee (included)</span>
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
        {gigFee && (
          <div className="flex justify-between font-semibold">
            <span className="text-app-text">{feeLine(gigFee)}</span>
          </div>
        )}
        {perspective === 'payer' ? (!gigFee && (
          <div className="flex justify-between font-semibold">
            <span className="text-app-text">{payerTotalLabel(payment)}</span>
            <span className="text-app-text">{formatCents(total)}</span>
          </div>
        )) : (
          <div className="flex justify-between font-semibold">
            <span className="text-app-text">{refunded > 0 ? 'Original expected earnings' : 'Expected earnings'}</span>
            <span className="text-green-700">{formatCents(gigFee ? gigFee.worker_share_cents : toPayee + tip)}</span>
          </div>
        )}
        {perspective === 'payee' && settlement && (
          <div className="flex justify-between font-semibold">
            <span>{settlement.status === 'no_earnings' ? 'Remaining worker earnings' : 'Credited to wallet'}</span>
            <span>{formatCents(settlement.amountCents)}</span>
          </div>
        )}
        {perspective === 'payee' && refunded > 0 && (
          <p className="text-xs text-app-text-secondary">
            {settlement?.status === 'no_earnings' ? 'Refunds left no worker earnings to release.' : settlement
              ? 'This credit reflects refunds recorded before release. Check your wallet for later adjustments and separate tips.'
              : 'Refunds affect the worker’s earnings. The final wallet credit is not confirmed here.'}
          </p>
        )}

        {/* Refund info */}
        {refunded > 0 && (
          <>
            <div className="border-t border-app-border-subtle my-1" />
            <div className="flex justify-between text-red-600">
              <span>{perspective === 'payer' ? 'Refunded' : 'Refunded to payer'}</span>
              <span>-{formatCents(refunded)}</span>
            </div>
            {perspective === 'payer' && <div className="flex justify-between font-semibold">
              <span className="text-app-text">Net</span>
              <span>{formatCents(total - refunded)}</span>
            </div>}
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
