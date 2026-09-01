// ============================================================
// PlaceDashboardView — the presentational dashboard.
//
// Renders the trust header (+ multi-home switcher), the Today's Pulse
// hero, and the launch-set groups (data-driven from the PlaceIntelligence
// contract). For a claimed (T3) place it adds the verify nudge and the
// Band-D "Locked until you verify" group — both opening the verification
// prompt sheet (B1), which routes into the existing verification pages
// and returns to the now-verified dashboard. For a verified (T4) place it
// shows the Identity group (verified status + residency letter).
//
// Pure: it takes the already-fetched intelligence so it's trivial to
// preview and test. The container (PlaceDashboard) owns fetching + states.
// ============================================================

'use client';

import { Fragment, useState } from 'react';
import type { PlaceIntelligence } from '@pantopus/types';
import { Group, HeroCard, PlaceHeader, VerifyBanner, type PlaceSwitcherHome } from '@/components/archetypes/place';
import { derivePulse, renderSection, renderVerifyLocked } from './presentation';
import { IdentityGroup } from './PlaceIdentitySection';
import VerifyPromptSheet from './VerifyPromptSheet';
import { GROUP_TO_SLUG } from './detail/sections';

export interface PlaceDashboardViewProps {
  intelligence: PlaceIntelligence;
  /** The active home; needed to route the verification flow (B1 sheet). */
  homeId: string;
  /** Resident initials for the avatar; falls back to a neutral glyph. */
  userInitials?: string;
  /** Tap-through to a group-detail page (W2.3). Cards only show the
   *  chevron when their group has a detail screen. */
  onOpenSection?: (slug: string) => void;
  /** Expand the hero into the full Today's Pulse stream (W2.5). */
  onOpenPulse?: () => void;
  /** The resident's places — when 2+, the header opens the multi-home switcher. */
  switchHomes?: PlaceSwitcherHome[];
  /** The home currently shown (highlighted in the switcher). */
  activeHomeId?: string | null;
  /** Switch the active place — re-queries the contract for it. */
  onSwitchHome?: (id: string) => void;
  /** Claim or verify another address. */
  onAddPlace?: () => void;
  /** Route to claim a place (a Band B/C locked card, if any). */
  onClaim?: () => void;
}

export default function PlaceDashboardView({
  intelligence,
  homeId,
  userInitials,
  onOpenSection,
  onOpenPulse,
  switchHomes,
  activeHomeId,
  onSwitchHome,
  onAddPlace,
  onClaim,
}: PlaceDashboardViewProps) {
  const [verifyOpen, setVerifyOpen] = useState(false);
  const openVerify = () => setVerifyOpen(true);

  const pulse = derivePulse(intelligence);
  const tier = intelligence.tier;
  const status = tier === 'T4' ? 'verified' : tier === 'T3' ? 'claimed' : 'none';

  // Identity / Band-D isn't in the contract yet (launch set is Band A), so
  // we derive the verify entry (T3) and the available identity rows (T4)
  // from the resolved tier. The verify nudge + locked cards open the B1
  // prompt sheet; skip the client identity group if a wave starts serving one.
  const showVerify = tier === 'T3';
  const hasServerIdentity = intelligence.groups.some((g) => g.group === 'identity');
  const showIdentity = tier === 'T4' && !hasServerIdentity;

  return (
    <div className="flex flex-col">
      <PlaceHeader
        address={intelligence.place.label}
        status={status}
        initials={userInitials ?? ''}
        switchHomes={switchHomes}
        activeHomeId={activeHomeId}
        onSwitchHome={onSwitchHome}
        onAddPlace={onAddPlace}
      />

      {showVerify ? (
        <div className="mt-4">
          <VerifyBanner onClick={openVerify} />
        </div>
      ) : null}

      <div className={showVerify ? 'mt-3' : 'mt-4'}>
        <HeroCard
          variant={pulse.variant}
          title={pulse.title}
          chip={pulse.chip}
          mainIcon={pulse.mainIcon}
          nudge={pulse.nudge}
          onOpen={onOpenPulse}
        />
      </div>

      <div className="mt-6">
        {intelligence.groups.map((group, gi) => {
          const slug = GROUP_TO_SLUG[group.group];
          const onOpen = slug && onOpenSection ? () => onOpenSection(slug) : undefined;
          return (
            // Staggered entrance — decorative; reduced-motion gets it static.
            <div
              key={group.group}
              className="motion-safe:animate-[fadeInUp_0.35s_ease-out_both]"
              style={{ animationDelay: `${Math.min(gi, 6) * 55}ms` }}
            >
              <Group label={group.label}>
                {group.sections.map((section) => (
                  <Fragment key={section.id}>{renderSection(section, { onOpen, onVerify: openVerify, onClaim })}</Fragment>
                ))}
              </Group>
            </div>
          );
        })}

        {showVerify ? (
          <Group label="Locked until you verify">{renderVerifyLocked(openVerify)}</Group>
        ) : null}
        {showIdentity ? <IdentityGroup /> : null}
      </div>

      {showVerify ? (
        <VerifyPromptSheet
          open={verifyOpen}
          onClose={() => setVerifyOpen(false)}
          homeId={homeId}
          address={intelligence.place.label}
        />
      ) : null}
    </div>
  );
}
