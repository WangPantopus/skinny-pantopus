'use client';

// ============================================================
// /app/place/scout — Before You Sign (Wave 5).
//
// Thin route: the Scout container owns the form, fetching, the auth
// gate and the page states. Authenticated (T1) but claim-free, which is
// the whole point — the reader is considering an address they do NOT
// live at and can never be a verified resident of it.
//
// A static `scout/` sibling wins over `[section]` in Next resolution,
// same as `pulse/` and `neighbor-message/`. Do NOT add 'scout' to
// PLACE_DETAIL_BY_SLUG — two owners would claim this URL.
// ============================================================

import Scout from '@/components/place/scout/Scout';

export default function PlaceScoutPage() {
  return <Scout />;
}
