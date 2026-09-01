// ============================================================
// Place — HEADER. "Your Place" + the address line + the trust avatar
// (verified green check / claimed amber home / none). `rightSlot`
// swaps the avatar for a quiet control — e.g. a "Sign in" link on the
// signed-out preview.
//
// When the resident holds more than one place, the address line becomes
// the multi-home switch trigger (a quiet chevron affordance) that opens
// the PlaceSwitcher sheet; picking a place re-points the dashboard.
// ============================================================

'use client';

import { useState, type ReactNode } from 'react';
import { MapPin, ChevronsUpDown } from 'lucide-react';
import { PlaceAvatar, type PlaceAvatarStatus } from './primitives';
import PlaceSwitcher, { type PlaceSwitcherHome } from './PlaceSwitcher';

export interface PlaceHeaderProps {
  title?: string;
  address: string;
  initials?: string;
  /** Trust status driving the avatar badge. */
  status?: PlaceAvatarStatus;
  /** Override the avatar (e.g. a "Sign in" link on the preview). */
  rightSlot?: ReactNode;
  /** The resident's places — when 2+, the address line opens the switcher. */
  switchHomes?: PlaceSwitcherHome[];
  /** The home the dashboard is currently showing (highlighted in the sheet). */
  activeHomeId?: string | null;
  /** Switch the active place — the dashboard re-queries for it. */
  onSwitchHome?: (id: string) => void;
  /** Claim or verify another address. */
  onAddPlace?: () => void;
  className?: string;
}

export default function PlaceHeader({
  title = 'Your Place',
  address,
  initials = 'RC',
  status = 'verified',
  rightSlot,
  switchHomes,
  activeHomeId = null,
  onSwitchHome,
  onAddPlace,
  className = '',
}: PlaceHeaderProps) {
  const [switcherOpen, setSwitcherOpen] = useState(false);

  // Only a multi-home resident gets the switch affordance — a single
  // place has nothing to switch to (and "Add a place" lives in the
  // homes screen they reach elsewhere).
  const canSwitch = !!onSwitchHome && (switchHomes?.length ?? 0) > 1;

  const addressLine = (
    <span className="flex items-center gap-1.5 min-w-0 text-app-text-secondary">
      <MapPin size={14} strokeWidth={2} className="shrink-0 text-app-text-muted" />
      <span className="text-sm font-medium truncate" title={address}>{address}</span>
      {canSwitch ? (
        <ChevronsUpDown size={15} strokeWidth={2} className="shrink-0 text-app-text-muted" />
      ) : null}
    </span>
  );

  return (
    <header className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h1 className="text-[28px] leading-8 font-bold -tracking-[0.02em] text-app-text">{title}</h1>
        {canSwitch ? (
          <button
            type="button"
            onClick={() => setSwitcherOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={switcherOpen}
            className="-mx-1 mt-1 flex max-w-full items-center rounded-md px-1 py-0.5 hover:bg-app-hover transition-colors"
          >
            {addressLine}
          </button>
        ) : (
          <div className="mt-1">{addressLine}</div>
        )}
      </div>
      {rightSlot ?? (
        <PlaceAvatar
          initials={initials}
          status={status}
          size={40}
          label={status === 'claimed' ? 'Claimed' : undefined}
        />
      )}

      {canSwitch ? (
        <PlaceSwitcher
          open={switcherOpen}
          onClose={() => setSwitcherOpen(false)}
          homes={switchHomes ?? []}
          activeId={activeHomeId}
          onPick={(id) => {
            setSwitcherOpen(false);
            onSwitchHome?.(id);
          }}
          onAddPlace={() => {
            setSwitcherOpen(false);
            onAddPlace?.();
          }}
        />
      ) : null}
    </header>
  );
}
