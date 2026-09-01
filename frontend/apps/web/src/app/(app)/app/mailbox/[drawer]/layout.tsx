'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { MailItemV2 } from '@/types/mailbox';
import type { BundleItem } from '@/types/mailbox';
import { useDrawerItems, useMarkItemOpened } from '@/lib/mailbox-queries';
import { MailItemCard, BundleCard, OfferCard, EmptyState } from '@/components/mailbox';

// ── Types ────────────────────────────────────────────────────
type DrawerParam = 'personal' | 'home' | 'business' | 'earn';

const DRAWER_LABELS: Record<string, string> = {
  personal: 'Personal',
  home: 'Home',
  business: 'Business',
  earn: 'Earn',
};

const FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'starred', label: 'Starred' },
];

// ── Helpers ──────────────────────────────────────────────────
function toBundleItem(item: MailItemV2): BundleItem {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = item as any;
  return {
    bundle_id: item.id,
    bundle_label: a.bundle_label || a.display_title || item.subject || 'Bundle',
    bundle_type: a.bundle_type || 'auto',
    item_count: a.bundle_item_count || 0,
    collapsed_by_default: a.collapsed_by_default ?? true,
    items: [],
  };
}

function toOfferEnvelope(item: MailItemV2) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = item as any;
  return {
    id: item.id,
    advertiser_id: item.sender_user_id || '',
    business_name: item.sender_display || '',
    business_logo_url: item.sender_logo_url,
    offer_title: item.display_title || item.subject || '',
    offer_subtitle: a.offer_subtitle,
    payout_amount: a.payout_amount || 0,
    expires_at: a.expires_at,
    status: (item.opened_at ? 'opened' : 'available') as 'available' | 'opened',
    opened: !!item.opened_at,
  };
}

// ── Layout ───────────────────────────────────────────────────
export default function DrawerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ drawer: string }>;
}) {
  const { drawer: drawerParam } = use(params);
  const drawer = drawerParam as DrawerParam;
  const pathname = usePathname();
  const router = useRouter();

  // Detect if we're on an item detail sub-route
  const isItemView = pathname.split('/').filter(Boolean).length > 3;

  // ── State ───────────────────────────────────────────────
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [allItems, setAllItems] = useState<MailItemV2[]>([]);
  const [expandedBundles, setExpandedBundles] = useState<Set<string>>(new Set());
  const [openingOffers, setOpeningOffers] = useState<Set<string>>(new Set());

  // Debounce search input (400ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Data fetching ───────────────────────────────────────
  const { data, isLoading } = useDrawerItems(drawer, { page, limit: 20, filter: filter || undefined });
  const markOpened = useMarkItemOpened();

  // Accumulate items for infinite scroll
  useEffect(() => {
    if (!data) return;
    setAllItems(prev => page === 1 ? data.items : [...prev, ...data.items]);
  }, [data, page]);

  // Reset when drawer or filter changes
  useEffect(() => {
    setPage(1);
    setAllItems([]);
  }, [drawer, filter]);

  // ── Infinite scroll ─────────────────────────────────────
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && data?.has_more && !isLoading) {
          setPage(p => p + 1);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [data?.has_more, isLoading]);

  // ── Item click ──────────────────────────────────────────
  const selectedItemId = pathname.match(/\/mailbox\/[^/]+\/([^/]+)/)?.[1];

  const handleItemClick = useCallback((item: MailItemV2) => {
    const href = `/app/mailbox/${drawer}/${item.id}`;

    // Mark as opened if unread
    if (!item.opened_at) {
      markOpened.mutate(item.id);
    }

    // Desktop: update URL without full navigation (keeps list in place)
    // Mobile: navigate to detail page
    if (window.innerWidth >= 768) {
      window.history.pushState(null, '', href);
      // Force Next.js to re-render with the new pathname
      router.push(href, { scroll: false });
    } else {
      router.push(href);
    }
  }, [drawer, markOpened, router]);

  // ── Filter items by search (debounced) ─────────────────
  const filteredItems = useMemo(() => {
    if (!debouncedSearch) return allItems;
    const q = debouncedSearch.toLowerCase();
    return allItems.filter(item =>
      (item.sender_display || '').toLowerCase().includes(q) ||
      (item.display_title || item.subject || '').toLowerCase().includes(q) ||
      (item.preview_text || '').toLowerCase().includes(q)
    );
  }, [allItems, debouncedSearch]);

  // ── Split into unread/read ──────────────────────────────
  const unreadItems = filteredItems.filter(item => !item.opened_at);
  const readItems = filteredItems.filter(item => !!item.opened_at);
  const hasNewItems = unreadItems.length > 0 && readItems.length > 0;

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── List panel ───────────────────────────────────── */}
      <div
        className={`flex flex-col h-full flex-shrink-0 border-r border-app-border bg-app-surface ${
          isItemView ? 'hidden md:flex md:w-[360px]' : 'w-full md:w-[360px]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-app-border-subtle flex-shrink-0">
          <h1 className="text-base font-semibold text-app-text flex-1">
            {DRAWER_LABELS[drawer] || drawer}
          </h1>

          {/* Filter dropdown */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter mail items"
            className="text-xs border border-app-border rounded-md px-2 py-1 bg-app-surface text-app-text-strong"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Search toggle */}
          <button
            type="button"
            onClick={() => setSearchOpen(!searchOpen)}
            aria-label={searchOpen ? 'Close search' : 'Search this drawer'}
            aria-expanded={searchOpen}
            className="p-1.5 text-app-text-secondary hover:text-app-text-strong dark:hover:text-gray-300 hover:bg-app-hover dark:hover:bg-gray-800 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>

        {/* Search input */}
        {searchOpen && (
          <div className="px-3 py-2 border-b border-app-border-subtle flex-shrink-0">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search this drawer..."
              autoFocus
              className="w-full text-sm px-3 py-1.5 border border-app-border rounded-md bg-app-surface text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        )}

        {/* New items banner */}
        {hasNewItems && page === 1 && (
          <div className="px-4 py-2 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-100 dark:border-primary-800 flex-shrink-0" role="status" aria-live="polite">
            <p className="text-xs font-medium text-primary-700 dark:text-primary-300">
              {unreadItems.length} new item{unreadItems.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        {/* Item list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && page === 1 ? (
            // Loading skeleton
            <div className="p-3 space-y-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-center gap-3 py-3 px-2">
                  <div className="w-8 h-8 rounded-full bg-app-surface-sunken animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-24 bg-app-surface-sunken rounded animate-pulse" />
                    <div className="h-3 w-40 bg-app-surface-sunken rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            debouncedSearch ? (
              <EmptyState
                icon="🔍"
                title="No results found"
                description={`Nothing matches "${debouncedSearch}" in this drawer.`}
              />
            ) : (
              <EmptyState section={drawer} />
            )
          ) : (
            <div role="list" aria-label={`${DRAWER_LABELS[drawer] || drawer} mail items`}>
              {/* Unread items */}
              {unreadItems.map((item) => (
                <DrawerItemRenderer
                  key={item.id}
                  item={item}
                  drawer={drawer}
                  isSelected={selectedItemId === item.id}
                  expandedBundles={expandedBundles}
                  setExpandedBundles={setExpandedBundles}
                  openingOffers={openingOffers}
                  setOpeningOffers={setOpeningOffers}
                  onClick={() => handleItemClick(item)}
                />
              ))}

              {/* Earlier divider */}
              {hasNewItems && (
                <div className="flex items-center gap-3 px-4 py-2">
                  <div className="flex-1 h-px bg-app-surface-sunken" />
                  <span className="text-[10px] font-medium text-app-text-muted uppercase tracking-wider">Earlier</span>
                  <div className="flex-1 h-px bg-app-surface-sunken" />
                </div>
              )}

              {/* Read items */}
              {readItems.map((item) => (
                <DrawerItemRenderer
                  key={item.id}
                  item={item}
                  drawer={drawer}
                  isSelected={selectedItemId === item.id}
                  expandedBundles={expandedBundles}
                  setExpandedBundles={setExpandedBundles}
                  openingOffers={openingOffers}
                  setOpeningOffers={setOpeningOffers}
                  onClick={() => handleItemClick(item)}
                />
              ))}

              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} className="h-4" />

              {/* Loading more indicator */}
              {isLoading && page > 1 && (
                <div className="py-4 text-center" role="status" aria-label="Loading more items">
                  <div className="inline-block w-5 h-5 border-2 border-app-border border-t-gray-600 rounded-full animate-spin" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Detail panel ─────────────────────────────────── */}
      <div
        className={`flex-1 min-w-0 overflow-hidden ${
          isItemView ? '' : 'hidden md:block'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

// ── Item Renderer ────────────────────────────────────────────
function DrawerItemRenderer({
  item,
  drawer,
  isSelected,
  expandedBundles,
  setExpandedBundles,
  openingOffers,
  setOpeningOffers,
  onClick,
}: {
  item: MailItemV2;
  drawer: string;
  isSelected: boolean;
  expandedBundles: Set<string>;
  setExpandedBundles: React.Dispatch<React.SetStateAction<Set<string>>>;
  openingOffers: Set<string>;
  setOpeningOffers: React.Dispatch<React.SetStateAction<Set<string>>>;
  onClick: () => void;
}) {
  // Bundle items
  if (item.mail_object_type === 'bundle') {
    const bundle = toBundleItem(item);
    return (
      <div className="px-2">
        <BundleCard
          bundle={bundle}
          isExpanded={expandedBundles.has(item.id)}
          onToggle={() => {
            setExpandedBundles(prev => {
              const next = new Set(prev);
              if (next.has(item.id)) next.delete(item.id);
              else next.add(item.id);
              return next;
            });
          }}
          onFileAll={() => {/* vault folder picker — Phase 2 */}}
        />
      </div>
    );
  }

  // Earn drawer: OfferCard
  if (drawer === 'earn') {
    const offer = toOfferEnvelope(item);
    if (offer.payout_amount > 0) {
      return (
        <div className="px-3 py-1.5">
          <OfferCard
            item={offer}
            isOpening={openingOffers.has(item.id)}
            onOpen={() => {
              setOpeningOffers(prev => new Set(prev).add(item.id));
              setTimeout(() => {
                setOpeningOffers(prev => {
                  const next = new Set(prev);
                  next.delete(item.id);
                  return next;
                });
                onClick();
              }, 1500);
            }}
          />
        </div>
      );
    }
  }

  // Default: MailItemCard
  return (
    <MailItemCard
      item={item}
      isSelected={isSelected}
      onClick={onClick}
    />
  );
}
