'use client';

// ============================================================
// /app/place/neighbor-message — compose a verified neighbor message (W2.6).
// Thin route: the NeighborMessageCompose container owns fetching, the
// verified-only gate, the recipient (by address within the block, via
// query params), the template-only picker, and the send.
// ============================================================

import NeighborMessageCompose from '@/components/place/neighbor-message/NeighborMessageCompose';

export default function NeighborMessageComposePage() {
  return <NeighborMessageCompose />;
}
