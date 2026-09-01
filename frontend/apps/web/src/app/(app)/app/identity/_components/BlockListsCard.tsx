'use client';

/**
 * BlockListsCard — unified-IA §8.3.
 *
 * Shows the personal-block count and the audience-block count on one
 * card with two SEPARATE Manage links. The lists are intentionally not
 * unified — per §8.3 a unified list would expose the cross-context link
 * (audience blocks operate on fan_handle; personal blocks operate on
 * user_id). Cascade is handled invisibly server-side.
 */

import Link from 'next/link';
import { ShieldOff, ArrowRight } from 'lucide-react';

interface BlockListsCardProps {
  counts: { personal: number; audience: number };
  /** Whether the user owns at least one persona — drives Audience CTA wording. */
  hasPersona: boolean;
}

export function BlockListsCard({ counts, hasPersona }: BlockListsCardProps) {
  return (
    <section
      id="block-lists"
      data-testid="profiles-block-lists-card"
      className="rounded-lg border border-app bg-surface p-5"
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-lg bg-surface-muted p-2">
          <ShieldOff className="h-5 w-5 text-app-secondary" aria-hidden />
        </div>
        <div>
          <h2 className="font-semibold text-app">Block lists</h2>
          <p className="text-sm text-app-secondary">
            Personal and Beacon blocks are kept separate so the platform never reveals the link.
          </p>
        </div>
      </div>
      <ul className="divide-y divide-app">
        <li className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-medium text-app">Personal blocks</p>
            <p
              className="text-xs text-app-secondary"
              data-testid="profiles-block-count-personal"
            >
              {counts.personal === 1
                ? '1 person blocked from your personal profile.'
                : `${counts.personal.toLocaleString()} people blocked from your personal profile.`}
            </p>
          </div>
          <Link
            href="/app/profile/settings/blocked"
            data-testid="profiles-block-manage-personal"
            className="inline-flex items-center gap-1 rounded-lg border border-app px-3 py-1.5 text-sm font-medium text-app hover:bg-surface-muted"
          >
            Manage
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </li>
        <li className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-medium text-app">Beacon blocks</p>
            <p
              className="text-xs text-app-secondary"
              data-testid="profiles-block-count-audience"
            >
              {hasPersona
                ? counts.audience === 1
                  ? '1 fan blocked from your Beacon.'
                  : `${counts.audience.toLocaleString()} fans blocked from your Beacon.`
                : 'No Beacon yet — there are no audience blocks to manage.'}
            </p>
          </div>
          {hasPersona ? (
            <Link
              href="/app/audience/manage/blocks"
              data-testid="profiles-block-manage-audience"
              className="inline-flex items-center gap-1 rounded-lg border border-app px-3 py-1.5 text-sm font-medium text-app hover:bg-surface-muted"
            >
              Manage
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-lg border border-dashed border-app px-3 py-1.5 text-sm font-medium text-app-secondary">
              —
            </span>
          )}
        </li>
      </ul>
    </section>
  );
}

export default BlockListsCard;
