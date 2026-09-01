'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import * as api from '@pantopus/api';
import PaymentBreakdown from '@/components/payments/PaymentBreakdown';
import StripeProvider from '@/components/payments/StripeProvider';
import GigPaymentSetup from '@/components/payments/GigPaymentSetup';
import { toast } from '@/components/ui/toast-store';
import type { Payment } from '@pantopus/types';

interface PaymentSectionProps {
  gigId: string;
  gigPrice: number;
  isOwner: boolean;
  isWorker: boolean;
  paymentStatusFromGig: string;
}

export default function PaymentSection({
  gigId,
  gigPrice,
  isOwner,
  isWorker,
  paymentStatusFromGig,
}: PaymentSectionProps) {
  const searchParams = useSearchParams();
  const [gigPayment, setGigPayment] = useState<Payment | null>(null);
  const [showPaymentSetup, setShowPaymentSetup] = useState(false);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [paymentIsSetupIntent, setPaymentIsSetupIntent] = useState(false);
  const [rollbackOnAbort, setRollbackOnAbort] = useState(false);
  const [rollbackInFlight, setRollbackInFlight] = useState(false);

  useEffect(() => {
    if (paymentStatusFromGig && paymentStatusFromGig !== 'none') {
      void loadGigPayment();
    }
    const paymentParam = searchParams.get('payment');
    if (paymentParam === 'setup_complete' || paymentParam === 'authorized') {
      void loadGigPayment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gigId, paymentStatusFromGig]);

  // Resume payment setup when redirected from another page after accepting a bid
  useEffect(() => {
    if (!gigId) return;
    if (searchParams.get('action') !== 'payment_setup') return;
    if (typeof window === 'undefined') return;

    const storageKey = `gig_payment_setup_${gigId}`;
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) {
      setRollbackOnAbort(false);
      return;
    }

    try {
      const pending = JSON.parse(raw) as {
        clientSecret?: string;
        isSetupIntent?: boolean;
        roomId?: string | null;
        rollbackOnAbort?: boolean;
      };
      if (pending?.clientSecret) {
        setPaymentClientSecret(String(pending.clientSecret));
        setPaymentIsSetupIntent(Boolean(pending.isSetupIntent));
        setRollbackOnAbort(Boolean(pending.rollbackOnAbort));
        setShowPaymentSetup(true);
      }
    } catch {
      // Ignore malformed payload.
      setRollbackOnAbort(false);
    } finally {
      window.sessionStorage.removeItem(storageKey);
    }
  }, [gigId, searchParams]);

  const loadGigPayment = async () => {
    try {
      const result = await api.payments.getPaymentForGig(gigId);
      setGigPayment(result.payment || null);
    } catch {
      setGigPayment(null);
    }
  };

  const rollbackAbandonedAccept = async () => {
    if (!rollbackOnAbort || rollbackInFlight) return;
    setRollbackInFlight(true);
    try {
      await api.gigs.reopenBidding(gigId, { rollbackMode: 'payment_setup_aborted' });
      toast.error('Payment authorization was not completed. Bid selection has been reverted.');
    } catch (rollbackErr) {
      console.error('Failed to reopen bidding after abandoned payment setup:', rollbackErr);
      toast.error('Payment authorization was not completed and we could not automatically reopen bidding.');
    } finally {
      setRollbackOnAbort(false);
      setRollbackInFlight(false);
      void loadGigPayment();
    }
  };

  if (!gigPayment && !showPaymentSetup) return null;

  return (
    <>
      {/* Payment Breakdown (visible to owner and worker) */}
      {gigPayment && (isOwner || isWorker) && (
        <PaymentBreakdown
          payment={gigPayment}
          perspective={isOwner ? 'payer' : 'payee'}
        />
      )}

      {/* Payment Setup Modal (from Stripe redirect / session storage resume) */}
      {showPaymentSetup && paymentClientSecret && (
        <StripeProvider clientSecret={paymentClientSecret}>
          <GigPaymentSetup
            clientSecret={paymentClientSecret}
            isSetupIntent={paymentIsSetupIntent}
            gigId={gigId}
            amount={gigPrice * 100 || 0}
            onSuccess={() => {
              setRollbackOnAbort(false);
              setShowPaymentSetup(false);
              setPaymentClientSecret(null);
              void loadGigPayment();
            }}
            onError={(err) => {
              console.error('Payment setup error:', err);
            }}
            onClose={() => {
              setShowPaymentSetup(false);
              setPaymentClientSecret(null);
              void rollbackAbandonedAccept();
            }}
          />
        </StripeProvider>
      )}
    </>
  );
}
