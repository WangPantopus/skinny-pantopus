'use client';

// ============================================================
// /app/place/neighbor-message/[id] — a received neighbor message (W2.6).
// Thin route: the NeighborMessageReceived container owns fetching, the
// auth gate, the page states, the templated reply, and the in-control
// actions (not-helpful / block / report). Linked from the delivery
// notification ("from a verified neighbor nearby").
// ============================================================

import { useParams } from 'next/navigation';
import NeighborMessageReceived from '@/components/place/neighbor-message/NeighborMessageReceived';

export default function NeighborMessageReceivedPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  return <NeighborMessageReceived messageId={id ?? ''} />;
}
