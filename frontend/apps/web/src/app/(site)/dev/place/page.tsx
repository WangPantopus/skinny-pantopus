'use client';

// ============================================================
// /dev/place — visual preview for the Place card archetype (W1.2).
// Renders the SectionCard atom in every state, the two special cards
// (locked / density), the Group wrapper, and the PlaceHeader at each
// trust status. Public route (not under /app) so it needs no session.
// This is a verification surface, not a shipped screen.
// ============================================================

import {
  CloudSun,
  Wind,
  Bell,
  Sunrise,
  Waves,
  House,
  Home,
  Key,
  MessageCircle,
  TestTube,
  Droplets,
  Factory,
  HardHat,
  LifeBuoy,
  Zap,
  BadgePercent,
  Building2,
  Landmark,
  Vote,
  BadgeCheck,
  FileText,
} from 'lucide-react';
import {
  SectionCard,
  LockedCard,
  DensityCard,
  Group,
  PlaceHeader,
  TextButton,
} from '@/components/archetypes/place';
import type { PlaceDensityBucket } from '@pantopus/types';

const noop = () => {};

function Phone({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[420px]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-app-text-muted mb-2 px-1">
        {label}
      </div>
      <div className="bg-app-bg border border-app-border rounded-3xl shadow-sm p-4">{children}</div>
    </div>
  );
}

const BUCKETS: PlaceDensityBucket[] = ['forming', 'few', 'growing', 'none'];

export default function DevPlacePage() {
  return (
    <main className="min-h-screen bg-app-bg text-app-text">
      <div className="max-w-6xl mx-auto px-5 py-10">
        <header className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-app-home mb-1">
            Pantopus · Place · archetype preview
          </p>
          <h1 className="text-2xl font-bold -tracking-[0.02em]">SectionCard + special-card archetype</h1>
          <p className="text-sm text-app-text-secondary mt-1 max-w-2xl">
            The web mirror of place-components.jsx. Every SectionCard state, the locked and density
            special cards, the group wrapper, and the trust-status header.
          </p>
        </header>

        <div className="flex flex-wrap gap-8 items-start">
          {/* ── Header at each trust status ── */}
          <Phone label="PlaceHeader — verified · claimed · signed-out">
            <div className="flex flex-col gap-5">
              <PlaceHeader address="1421 SE Oak St, Portland" status="verified" />
              <PlaceHeader address="1421 SE Oak St, Portland" status="claimed" />
              <PlaceHeader
                address="1421 SE Oak St, Portland"
                status="none"
                rightSlot={<TextButton arrow={false} onClick={noop}>Sign in</TextButton>}
              />
            </div>
          </Phone>

          {/* ── SectionCard — block states ── */}
          <Phone label="SectionCard — states">
            <Group label="Loaded">
              <SectionCard
                icon={House}
                title="Your home"
                asOf="May 2026"
                value="Built 1979 · 1,840 sqft · est. value $612,000"
                sparkline
                onClick={noop}
              />
              <SectionCard
                icon={TestTube}
                title="Lead & radon"
                value="Built 1979 — lead paint possible; test before renovation"
                caption="Screening, not a diagnosis"
                onClick={noop}
              />
              <SectionCard
                icon={Zap}
                title="Bill benchmark"
                value="Your electric bill is 12% above neighbors"
                chip={{ label: '12% above', variant: 'warning' }}
                onClick={noop}
              />
              <SectionCard
                icon={LifeBuoy}
                title="Emergency plan"
                action={{ label: 'Build your household plan', onClick: noop }}
                caption="Not set up yet · 3 quick steps"
                onClick={noop}
              />
            </Group>

            <Group label="Stale · empty · unavailable">
              <SectionCard
                icon={Droplets}
                title="Water"
                asOf="as of Apr 2026"
                state="stale"
                value="Portland Water Bureau · no recent health-based violations"
                onClick={noop}
              />
              <SectionCard icon={Bell} title="Recalls" state="empty" onClick={noop} />
              <SectionCard icon={HardHat} title="Permits" state="unavailable" onClick={noop} />
            </Group>

            <Group label="Error · loading">
              <SectionCard icon={Factory} title="Environment" state="error" onRetry={noop} />
              <SectionCard icon={Building2} title="Rent band" state="loading" />
            </Group>
          </Phone>

          {/* ── SectionCard — inline rhythm ── */}
          <Phone label="SectionCard — inline rows">
            <Group label="Today">
              <SectionCard icon={CloudSun} title="Weather" value="62°, clear" asOf="9:40 AM" inline onClick={noop} />
              <SectionCard
                icon={Wind}
                title="Air quality"
                value="Good (38)"
                statusDot="success"
                inline
                onClick={noop}
              />
              <SectionCard icon={Bell} title="Alerts" value="None" statusDot="success" inline onClick={noop} />
              <SectionCard icon={Sunrise} title="Sunrise & sunset" value="6:42a · 8:11p" inline onClick={noop} />
            </Group>
            <Group label="Inline — chip · action">
              <SectionCard
                icon={Waves}
                title="Flood"
                chip={{ label: 'Minimal risk', variant: 'success' }}
                inline
                onClick={noop}
              />
              <SectionCard icon={Vote} title="Next election" chip={{ label: 'In 34 days', variant: 'info' }} inline onClick={noop} />
              <SectionCard
                icon={Landmark}
                title="Your districts"
                action={{ label: 'View your districts', onClick: noop }}
                inline
                onClick={noop}
              />
              <SectionCard
                icon={BadgeCheck}
                title="Identity"
                chip={{ label: 'Address-proven', variant: 'success', icon: BadgeCheck }}
                inline
                onClick={noop}
              />
            </Group>
          </Phone>

          {/* ── Special: locked cards ── */}
          <Phone label="Special — locked (3 tiers)">
            <div className="flex flex-col gap-2">
              <LockedCard
                icon={Home}
                title="Home details & value"
                reason="Save this place to see your home's exact details and value."
                cta="Create account"
                onCta={noop}
              />
              <LockedCard
                icon={Key}
                title="Bills & maintenance"
                reason="Claim your place to add bills, maintenance, and your tools."
                cta="Claim home"
                onCta={noop}
              />
              <LockedCard
                icon={MessageCircle}
                title="Neighbor messaging"
                reason="Verify your address to message neighbors."
                cta="Verify address"
                onCta={noop}
              />
            </div>
          </Phone>

          {/* ── Special: density buckets ── */}
          <Phone label="Special — density (4 buckets)">
            <div className="flex flex-col gap-2">
              {BUCKETS.map((bucket) => (
                <DensityCard key={bucket} bucket={bucket} onCta={noop} onClick={noop} />
              ))}
            </div>
          </Phone>

          {/* ── Money signals sampler (chips + incentives copy) ── */}
          <Phone label="Group — money signals">
            <Group label="Money signals">
              <SectionCard
                icon={Zap}
                title="Bill benchmark"
                value="Your electric bill is 12% above neighbors"
                chip={{ label: '12% above', variant: 'warning' }}
                onClick={noop}
              />
              <SectionCard
                icon={BadgePercent}
                title="Incentives"
                value="Heat-pump rebate may apply — you may be eligible, verify"
                onClick={noop}
              />
              <SectionCard
                icon={FileText}
                title="Residency letter"
                action={{ label: 'Generate a residency letter', onClick: noop }}
                onClick={noop}
              />
            </Group>
          </Phone>
        </div>
      </div>
    </main>
  );
}
