'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Store, Search } from 'lucide-react';
import type { Listing, MarketplaceDiscoverResponse } from '@pantopus/api';
import ListingCard from '@/app/(app)/app/marketplace/ListingCard';
import ListingCategoryClusterCard from './ListingCategoryClusterCard';
import MarketplaceSectionHeader from './MarketplaceSectionHeader';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';

// ── Density tiers (mirrors gig BrowseFeed pattern) ──────────

type DensityTier = 'empty' | 'sparse' | 'full';

function getDensity(totalActive: number): DensityTier {
  if (totalActive === 0) return 'empty';
  if (totalActive < 10) return 'sparse';
  return 'full';
}

// ── Horizontal scroll section ────────────────────────────────

function HorizontalScrollSection({
  items,
  onSave,
}: {
  items: Listing[];
  onSave: (id: string) => void;
}) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative -mx-4 sm:-mx-6 lg:-mx-8">
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto px-4 sm:px-6 lg:px-8 pb-2 snap-x snap-mandatory scrollbar-hide"
      >
        {items.map((item) => (
          <div key={item.id} className="flex-shrink-0 w-[200px] sm:w-[220px] snap-start">
            <ListingCard
              item={item}
              onSave={() => onSave(item.id)}
              onClick={() => router.push(`/app/marketplace/${item.id}`)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Wanted row (text-focused, compact) ───────────────────────

function WantedRow({
  item,
  onClick,
}: {
  item: Listing;
  onClick: () => void;
}) {
  const budget = item.budget_max ? `$${Number(item.budget_max).toFixed(0)}` : null;
  const creator = (item.creator || {}) as NonNullable<Listing['creator']>;
  const name = creator?.first_name || creator?.name || creator?.username || 'Someone';
  const profileHref = creator?.username ? `/${creator.username}` : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      className="w-full flex items-center gap-3 px-4 py-3 border-b border-app-border-subtle last:border-b-0 hover:bg-app-hover transition text-left"
    >
      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
        <Search className="w-4 h-4 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-app-text truncate">{item.title}</p>
        <p className="text-xs text-app-text-muted truncate">
          {profileHref ? (
            <Link
              href={profileHref}
              onClick={(event) => event.stopPropagation()}
              className="font-medium text-app-text-muted"
            >
              {name}
            </Link>
          ) : (
            <span className="font-medium">{name}</span>
          )}{' '}
          is looking
          {budget && <span className="text-amber-600 font-medium"> · Budget: {budget}</span>}
        </p>
      </div>
      <span className="text-xs text-amber-500 font-bold uppercase flex-shrink-0">Wanted</span>
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────

function EmptyMarketplace({ onCreateListing }: { onCreateListing: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mb-4">
        <Store className="w-8 h-8 text-primary-600" />
      </div>
      <h2 className="text-xl font-bold text-app-text-strong mb-2">Your marketplace is just getting started</h2>
      <p className="text-sm text-app-text-muted mb-6 max-w-sm">
        No listings nearby yet. Be the first to post something — whether you&apos;re selling,
        giving away, or looking for something!
      </p>
      <button
        onClick={onCreateListing}
        className="px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition"
      >
        Post a Listing
      </button>
    </div>
  );
}

// ── Sparse layout (< 10 items) ──────────────────────────────

function SparseGrid({
  data,
  onSave,
  onCreateListing,
}: {
  data: MarketplaceDiscoverResponse;
  onSave: (id: string) => void;
  onCreateListing: () => void;
}) {
  const router = useRouter();

  // Collect all unique items across sections
  const seen = new Set<string>();
  const allItems: Listing[] = [];
  const sections = [
    data.sections.just_listed,
    data.sections.free_nearby,
    data.sections.nearby_deals,
    data.sections.wanted_nearby,
  ];
  for (const section of sections) {
    for (const item of section) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        allItems.push(item);
      }
    }
  }

  return (
    <div>
      {/* Encouraging message */}
      <div
        className="motion-safe:animate-section-in opacity-0 py-4 text-center"
        style={{ animationFillMode: 'forwards' }}
      >
        <p className="text-sm text-app-text-muted leading-relaxed">
          Your marketplace is just getting started! Here {allItems.length === 1 ? 'is' : 'are'} the{' '}
          <strong className="text-app-text-strong">{data.total_active}</strong> listing{data.total_active !== 1 ? 's' : ''}{' '}
          nearby.
        </p>
      </div>

      {/* Single grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {allItems.map((item) => (
          <ListingCard
            key={item.id}
            item={item}
            onSave={() => onSave(item.id)}
            onClick={() => router.push(`/app/marketplace/${item.id}`)}
          />
        ))}
      </div>

      {/* CTA */}
      <div className="flex justify-center mt-8 mb-4">
        <button
          onClick={onCreateListing}
          className="px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition"
        >
          Post a Listing
        </button>
      </div>
    </div>
  );
}

// ── Loading skeleton ─────────────────────────────────────────

function DiscoverySkeleton() {
  return (
    <div className="space-y-8">
      {/* Section 1: horizontal scroll skeleton */}
      <div>
        <div className="h-5 w-32 bg-app-surface-sunken rounded animate-pulse mb-3" />
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-shrink-0 w-[200px]">
              <div className="bg-app-surface rounded-xl border border-app-border overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-app-surface-sunken" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-app-surface-sunken rounded w-3/4" />
                  <div className="h-2.5 bg-app-surface-sunken rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Section 2: grid skeleton */}
      <div>
        <div className="h-5 w-28 bg-app-surface-sunken rounded animate-pulse mb-3" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          <LoadingSkeleton variant="listing-card" count={4} />
        </div>
      </div>
      {/* Section 3: category clusters skeleton */}
      <div>
        <div className="h-5 w-36 bg-app-surface-sunken rounded animate-pulse mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[72px] bg-app-surface rounded-xl border border-app-border animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────

interface MarketplaceDiscoveryFeedProps {
  data: MarketplaceDiscoverResponse | null;
  loading: boolean;
  onSave: (listingId: string) => void;
  onCategoryClick: (category: string) => void;
  onCreateListing: () => void;
  onSeeAllClick: () => void;
}

export default function MarketplaceDiscoveryFeed({
  data,
  loading,
  onSave,
  onCategoryClick,
  onCreateListing,
  onSeeAllClick,
}: MarketplaceDiscoveryFeedProps) {
  const router = useRouter();

  // ── Loading ──
  if (loading && !data) {
    return <DiscoverySkeleton />;
  }

  if (!data) return null;

  const density = getDensity(data.total_active);

  // ── Empty ──
  if (density === 'empty') {
    return <EmptyMarketplace onCreateListing={onCreateListing} />;
  }

  // ── Sparse (< 10 items): single friendly grid ──
  if (density === 'sparse') {
    return <SparseGrid data={data} onSave={onSave} onCreateListing={onCreateListing} />;
  }

  // ── Full: all sections ──
  const { sections, total_active, free_count } = data;
  const srAnnouncement = `${total_active} listing${total_active !== 1 ? 's' : ''} found nearby`;

  let sectionDelay = 0;
  const nextDelay = () => { const d = sectionDelay; sectionDelay += 80; return d; };

  return (
    <div role="feed" aria-label="Marketplace discovery feed">
      <div role="status" aria-live="polite" className="sr-only">
        {srAnnouncement}
      </div>

      {/* ── 1. Free Near You ── */}
      {sections.free_nearby.length > 0 && (
        <section
          aria-labelledby="section-free-nearby"
          className="motion-safe:animate-section-in opacity-0"
          style={{ animationDelay: `${nextDelay()}ms`, animationFillMode: 'forwards' }}
        >
          <MarketplaceSectionHeader
            id="section-free-nearby"
            title="Free Near You"
            subtitle={`${free_count} free item${free_count !== 1 ? 's' : ''}`}
            onSeeAll={() => { /* Apply free filter to switch to browse */ onSeeAllClick(); }}
          />
          <HorizontalScrollSection items={sections.free_nearby} onSave={onSave} />
        </section>
      )}

      {/* ── 2. Just Listed ── */}
      {sections.just_listed.length > 0 && (
        <section
          aria-labelledby="section-just-listed"
          className="motion-safe:animate-section-in opacity-0"
          style={{ animationDelay: `${nextDelay()}ms`, animationFillMode: 'forwards' }}
        >
          <MarketplaceSectionHeader
            id="section-just-listed"
            title="Just Listed"
            onSeeAll={onSeeAllClick}
          />
          <HorizontalScrollSection items={sections.just_listed} onSave={onSave} />
        </section>
      )}

      {/* ── 3. Nearby Deals ── */}
      {sections.nearby_deals.length > 0 && (
        <section
          aria-labelledby="section-nearby-deals"
          className="motion-safe:animate-section-in opacity-0"
          style={{ animationDelay: `${nextDelay()}ms`, animationFillMode: 'forwards' }}
        >
          <MarketplaceSectionHeader
            id="section-nearby-deals"
            title="Nearby Deals"
            onSeeAll={onSeeAllClick}
          />
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {sections.nearby_deals.map((item) => (
              <ListingCard
                key={item.id}
                item={item}
                onSave={() => onSave(item.id)}
                onClick={() => router.push(`/app/marketplace/${item.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── 4. By Category ── */}
      {sections.by_category.length > 0 && (
        <section
          aria-labelledby="section-by-category"
          className="motion-safe:animate-section-in opacity-0"
          style={{ animationDelay: `${nextDelay()}ms`, animationFillMode: 'forwards' }}
        >
          <MarketplaceSectionHeader id="section-by-category" title="Browse by Category" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sections.by_category.map((cluster) => (
              <ListingCategoryClusterCard
                key={cluster.category}
                cluster={cluster}
                onClick={onCategoryClick}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── 5. Wanted Nearby ── */}
      {sections.wanted_nearby.length > 0 && (
        <section
          aria-labelledby="section-wanted-nearby"
          className="motion-safe:animate-section-in opacity-0"
          style={{ animationDelay: `${nextDelay()}ms`, animationFillMode: 'forwards' }}
        >
          <MarketplaceSectionHeader id="section-wanted-nearby" title="Wanted Nearby" />
          <div className="rounded-xl border border-app-border bg-app-surface overflow-hidden">
            {sections.wanted_nearby.map((item) => (
              <WantedRow
                key={item.id}
                item={item}
                onClick={() => router.push(`/app/marketplace/${item.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Stats footer + See All ── */}
      <div className="text-center py-8 space-y-4">
        <p className="text-sm text-app-text-muted">
          {total_active} active listing{total_active !== 1 ? 's' : ''} near you
          {free_count > 0 && ` · ${free_count} free`}
        </p>
        <button
          onClick={onSeeAllClick}
          className="px-6 py-2.5 bg-app-surface border border-app-border rounded-lg text-sm font-medium text-app-text-strong hover:bg-app-hover transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          See all listings
        </button>
      </div>
    </div>
  );
}
