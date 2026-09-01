// W4-owned BARE layout for the embeddable iframe target. The root layout already
// provides <html>/<body> + providers; the parent book/layout is intentionally
// minimal (no app header/footer/nav). This layout adds ZERO additional chrome so
// the widget renders clean inside an iframe on any external site, and marks the
// route noindex (it is an embed target, not a public landing page).

import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function EmbedLayout({ children }: { children: ReactNode }) {
  // Fragment — no wrapper chrome; the page paints its own full-bleed surface.
  return <>{children}</>;
}
