// ============================================================
// /dev/* — internal preview/verification surfaces (e.g. the Place
// archetype + dashboard previews). They render mock data only and are
// NOT product screens, so:
//   • robots: noindex/nofollow (never surface in search)
//   • 404 in production builds (kept to dev/preview environments)
// ============================================================

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  return <>{children}</>;
}
