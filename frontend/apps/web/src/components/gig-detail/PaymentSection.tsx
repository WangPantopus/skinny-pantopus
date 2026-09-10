'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import * as api from '@pantopus/api';
import PaymentBreakdown from '@/components/payments/PaymentBreakdown';
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

  useEffect(() => {
    let active = true;
    setGigPayment(null);
    if (actorId && (isOwner || isWorker)) {
      void api.payments.getPaymentForGig(gigId).then((result) => {
        if (active) setGigPayment(result.payment || null);
      }).catch(() => { if (active) setGigPayment(null); });
    }
    return () => { active = false; };
  }, [gigId, actorId, isOwner, isWorker, paymentStatusFromGig, paymentReturn, refresh]);

  return (
    <>
      {actorId && isOwner && <GigBidCheckout gigId={gigId} actorId={actorId} onAccepted={() => {
        setRefresh((value) => value + 1);
        onChanged?.();
      }} />}
      {actorId && gigPayment && (isOwner || isWorker) && (
        <PaymentBreakdown payment={gigPayment} perspective={isOwner ? 'payer' : 'payee'} />
      )}
    </>
  );
}
