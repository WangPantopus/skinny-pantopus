'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import * as api from '@pantopus/api';
import PaymentBreakdown from '@/components/payments/PaymentBreakdown';
import ErrorState from '@/components/ui/ErrorState';
import GigPaymentRefundPanel from '@/components/payments/GigPaymentRefundPanel';
import GigBidCheckout from './GigBidCheckout';
import type { Payment } from '@pantopus/types';

interface PaymentSectionProps {
  gigId: string;
  gigPrice: number;
  isOwner: boolean;
  isWorker: boolean;
  paymentStatusFromGig: string;
  actorId?: string;
  onChanged?: () => void;
}

export default function PaymentSection(props: PaymentSectionProps) {
  return <ScopedPaymentSection key={`${props.actorId ?? ''}:${props.gigId}`} {...props} />;
}

function ScopedPaymentSection({ gigId, isOwner, isWorker, paymentStatusFromGig, actorId, onChanged }: PaymentSectionProps) {
  const search = useSearchParams();
  const paymentReturn = search.get('payment');
  const [gigPayment, setGigPayment] = useState<Payment | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setGigPayment(null);
    setError(false);
    setLoading(false);
    if (actorId && (isOwner || isWorker)) {
      setLoading(true);
      void api.payments.getPaymentForGig(gigId).then((result) => {
        if (active) setGigPayment(result.payment || null);
      }).catch(() => { if (active) setError(true); })
        .finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; };
  }, [gigId, actorId, isOwner, isWorker, paymentStatusFromGig, paymentReturn, refresh]);

  return (
    <>
      {actorId && isOwner && <GigBidCheckout gigId={gigId} actorId={actorId} onAccepted={() => {
        setRefresh((value) => value + 1);
        onChanged?.();
      }} />}
      {actorId && (isOwner || isWorker) && loading && (
        <p className="text-sm text-app-text-secondary text-center py-4">Loading payment details...</p>
      )}
      {actorId && (isOwner || isWorker) && error && (
        <div role="alert">
          <ErrorState message="We couldn't load payment details. Please try again." onRetry={() => setRefresh((value) => value + 1)} />
        </div>
      )}
      {actorId && gigPayment && (isOwner || isWorker) && (
        <PaymentBreakdown payment={gigPayment} perspective={isOwner ? 'payer' : 'payee'} />
      )}
      {actorId && isOwner && gigPayment?.payer_id === actorId && (
        <GigPaymentRefundPanel actorId={actorId} payment={gigPayment} onPaymentChanged={(updated) => {
          setGigPayment((current) => current?.id === updated.id ? { ...current, ...updated } : current);
          onChanged?.();
        }} />
      )}
    </>
  );
}
