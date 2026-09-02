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
import Link from 'next/link';
import { Compass, ChevronRight, ShieldCheck } from 'lucide-react';
import type { PlaceIntelligence } from '@pantopus/types';
import { Group, HeroCard, PlaceHeader, VerifyBanner, type PlaceSwitcherHome } from '@/components/archetypes/place';
import JustMovedCard from './JustMovedCard';
import { derivePulse, isUnavailableSection, renderSection, renderVerifyLocked, sectionTitle } from './presentation';
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
  /** The active home's move-in date; a recent one shows the first-week checklist. */
  moveInDate?: string | null;
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
  moveInDate = null,
  onSwitchHome,
  onAddPlace,
  onClaim,
}: PlaceDashboardViewProps) {
  const [verifyOpen, setVerifyOpen] = useState(false);
  const openVerify = () => setVerifyOpen(true);

  const pulse = derivePulse(intelligence);
  // The first-week card ticks "Set your pickup day" itself once the
  // calendar runs on the household's own day rather than a city default.
  const calendar = intelligence.groups.flatMap((g) => g.sections).find((s) => s.id === 'address_calendar');
  const needsPickupDay =
    calendar && calendar.status === 'ready' && calendar.data ? (calendar.data as { needs_pickup_day?: boolean }).needs_pickup_day ?? null : null;
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
        {/* Movers first (Wedge v2 D5): the first-week checklist for a recent move-in. */}
        <JustMovedCard homeId={homeId} moveInDate={moveInDate} needsPickupDay={needsPickupDay} className="mb-4" />
        {/* The privacy mirror (Wedge v2 §2): one tap to see yourself as a neighbor does. */}
        <Link
          href={`/app/homes/${homeId}/privacy`}
          className="mb-4 flex items-center gap-2 rounded-xl border border-app-border bg-app-surface-sunken px-3.5 py-2.5 text-[13px] text-app-text-secondary hover:text-app-text"
        >
          <ShieldCheck size={15} strokeWidth={2.25} className="shrink-0 text-app-home" />
          <span className="flex-1">Private by default. See what neighbors see of this address.</span>
          <ChevronRight size={15} strokeWidth={2.25} className="shrink-0 text-app-text-muted" />
        </Link>
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
                {(() => {
                  // Two or more empty sections in a group fold into one row;
                  // a single one keeps its card so the group never looks bare.
                  const unavailable = group.sections.filter(isUnavailableSection);
                  const fold = unavailable.length >= 2;
                  return (
                    <>
                      {group.sections
                        .filter((section) => !fold || !isUnavailableSection(section))
                        .map((section) => (
                          <Fragment key={section.id}>{renderSection(section, { onOpen, onVerify: openVerify, onClaim })}</Fragment>
                        ))}
                      {fold ? <CoverageRow titles={unavailable.map((s) => sectionTitle(s.id))} reason={unavailable[0]?.unavailable_reason ?? null} onOpen={onOpen} /> : null}
                    </>
                  );
                })()}
              </Group>
            </div>
          );
        })}

        {showVerify ? (
          <Group label="Locked until you verify">{renderVerifyLocked(openVerify)}</Group>
        ) : null}
        {showIdentity ? <IdentityGroup /> : null}

        {/*
          THE ONLY WAY INTO SCOUT ON A PHONE.
          The nav rail that carries it is `hidden lg:block`, so without
          this row the surface existed and was unreachable on the device
          most of this product is used on. It sits last on purpose: the
          dashboard is about the place you live, and this is the one link
          that is about somewhere else.
        */}
        <Link
          href="/app/place/scout"
          className="flex items-center gap-3 mt-6 p-4 rounded-2xl bg-app-surface border border-app-border shadow-sm hover:bg-app-hover transition"
        >
          <span className="inline-flex items-center justify-center shrink-0 w-11 h-11 rounded-xl bg-app-home-bg text-app-home">
            <Compass size={22} strokeWidth={2} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15.5px] font-semibold text-app-text -tracking-[0.01em]">
              Looking at somewhere else?
            </span>
            <span className="block text-[12.5px] text-app-text-muted mt-0.5">
              Check an address you are considering, and what to ask before you sign
            </span>
          </span>
          <ChevronRight size={18} strokeWidth={2.25} className="shrink-0 text-app-text-muted" />
        </Link>
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

/**
 * One quiet row standing in for every section this address has no data
 * for yet. Lists them by name so the reader knows what is coming rather
 * than scrolling past a wall of "Not available for your area yet".
 */
function CoverageRow({ titles, reason, onOpen }: { titles: string[]; reason: string | null; onOpen?: () => void }) {
  const list = titles.length <= 3 ? titles.join(', ') : `${titles.slice(0, 3).join(', ')} and ${titles.length - 3} more`;
  const body = (
    <>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-medium text-app-text">Coverage is expanding here</div>
        <div className="text-[13px] text-app-text-muted mt-0.5">
          {list} — {reason ?? 'not published for this area yet. We add sources as they open.'}
        </div>
      </div>
      {onOpen ? <ChevronRight size={18} className="text-app-text-muted flex-shrink-0" aria-hidden /> : null}
    </>
  );
  const cls = 'flex items-center gap-3 rounded-2xl border border-dashed border-app bg-surface-muted px-4 py-3 text-left';
  return onOpen ? (
    <button type="button" onClick={onOpen} className={`${cls} w-full`} data-testid="coverage-row">
      {body}
    </button>
  ) : (
    <div className={cls} data-testid="coverage-row">{body}</div>
  );
}

