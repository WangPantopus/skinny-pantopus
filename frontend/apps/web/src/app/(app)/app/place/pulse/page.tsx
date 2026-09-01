'use client';

// ============================================================
// /app/place/pulse — Today's Pulse, the full ranked stream (W2.5).
// Thin route: the PulseStream container owns fetching, the auth gate,
// the page states, and the ranked-stream / all-clear rendering. The
// feed sibling to the structured dashboard, expanded from its hero.
// ============================================================

import PulseStream from '@/components/place/pulse/PulseStream';

export default function PlacePulsePage() {
  return <PulseStream />;
}
