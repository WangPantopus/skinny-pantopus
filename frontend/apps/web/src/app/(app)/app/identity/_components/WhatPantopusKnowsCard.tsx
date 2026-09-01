'use client';

/**
 * WhatPantopusKnowsCard — unified-IA §8.1 + §5.4 verbatim disclosure.
 *
 * The credibility line for the firewall claim. Static content; the only
 * action is a link to the full privacy policy. Per §8.1, this card lives
 * at the bottom of /app/identity so it's always reachable but never
 * forced as a signup interstitial (§13.6 open question recommendation).
 */

import Link from 'next/link';
import { Info, ArrowRight } from 'lucide-react';

export function WhatPantopusKnowsCard() {
  return (
    <section
      id="what-pantopus-knows"
      data-testid="profiles-what-pantopus-knows-card"
      className="rounded-lg border border-app bg-surface p-5"
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-lg bg-surface-muted p-2">
          <Info className="h-5 w-5 text-app-secondary" aria-hidden />
        </div>
        <div>
          <h2 className="font-semibold text-app">What Pantopus knows</h2>
          <p className="text-sm leading-6 text-app-secondary">
            We keep a private link between your audience identity and your personal account.
            We use this only for billing, safety enforcement, tax reporting, and account recovery.
            Other people on Pantopus never see this link.
          </p>
        </div>
      </div>
      <Link
        href="/legal/privacy"
        data-testid="profiles-what-pantopus-knows-policy-link"
        className="inline-flex items-center gap-1 rounded-lg border border-app px-3 py-1.5 text-sm font-medium text-app hover:bg-surface-muted"
      >
        Read full policy
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </section>
  );
}

export default WhatPantopusKnowsCard;
