'use client';

// Place's Verified neighbors rows on the web (founder decision 2026-11-07), as
// on iOS and Android: "Verified homes nearby" (/app/nearby, the density window
// that was the Nearby tab's Neighborhood segment) and "Invite your neighbors".

import Link from 'next/link';
import { Check, ChevronRight, Map as MapIcon, Share2 } from 'lucide-react';
import { Group } from '@/components/archetypes/place';
import { useNeighborInvite } from '@/components/nearby/useNeighborInvite';

const ROW =
  'flex w-full items-center gap-3 p-4 rounded-2xl bg-app-surface border border-app-border shadow-sm hover:bg-app-hover transition text-left';
const TILE = 'inline-flex items-center justify-center shrink-0 w-11 h-11 rounded-xl bg-app-home-bg text-app-home';

export default function VerifiedNeighborsGroup() {
  const { share, copied } = useNeighborInvite();
  return (
    <Group label="Verified neighbors" stack>
      <Link href="/app/nearby" className={ROW} data-testid="place-verified-homes-nearby">
        <span className={TILE}>
          <MapIcon size={22} strokeWidth={2} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15.5px] font-semibold text-app-text -tracking-[0.01em]">Verified homes nearby</span>
          <span className="block text-[12.5px] text-app-text-muted mt-0.5">
            How many homes around you have verified, by area. Never who.
          </span>
        </span>
        <ChevronRight size={18} strokeWidth={2.25} className="shrink-0 text-app-text-muted" />
      </Link>
      <button type="button" onClick={share} className={ROW} data-testid="place-invite-neighbors">
        <span className={TILE}>{copied ? <Check size={22} strokeWidth={2} /> : <Share2 size={22} strokeWidth={2} />}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15.5px] font-semibold text-app-text -tracking-[0.01em]">
            {copied ? 'Link copied' : 'Invite your neighbors'}
          </span>
          <span className="block text-[12.5px] text-app-text-muted mt-0.5">
            Share a link that shows them their own address first.
          </span>
        </span>
        <ChevronRight size={18} strokeWidth={2.25} className="shrink-0 text-app-text-muted" />
      </button>
    </Group>
  );
}
