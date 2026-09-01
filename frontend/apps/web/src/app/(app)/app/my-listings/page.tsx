'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import * as api from '@pantopus/api';
import type { ListingStatus } from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { Tag } from 'lucide-react';
import type { Listing } from '@pantopus/types';
import { ListArchetype } from '@/components/archetypes';

// ── Status config ─────────────────────────────────────────────
type FilterStatus = 'all' | 'active' | 'pending_pickup' | 'sold' | 'archived' | 'draft';

const STATUS_TABS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'pending_pickup', label: 'Pending Pickup' },
  { key: 'sold', label: 'Sold' },
  { key: 'archived', label: 'Archived' },
  { key: 'draft', label: 'Draft' },
];

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  pending_pickup: 'bg-amber-100 text-amber-700',
  sold: 'bg-app-surface-sunken text-app-text-secondary',
  archived: 'bg-app-surface-sunken text-app-text-secondary',
  draft: 'bg-blue-100 text-blue-700',
};

const CONDITION_LABELS: Record<string, string> = {
  new: 'New', like_new: 'Like New', good: 'Good', fair: 'Fair', poor: 'Poor',
};

const QUICK_STATUSES = ['active', 'pending_pickup', 'sold', 'archived'] as const;

function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}

export default function MyListingsPage() {
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');

  useEffect(() => {
    loadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const loadListings = async () => {
    const token = getAuthToken();
    if (!token) { router.push('/login'); return; }

    setLoading(true);
    try {
      const result = await api.listings.getMyListings({
        limit: 100,
        status: filter === 'all' ? undefined : filter as Listing['status'],
      });
      const resObj = result as Record<string, any>;
      setListings((resObj?.listings || []) as Listing[]);
    } catch (err) {
      console.error('Failed to load my listings:', err);
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickStatus = async (listingId: string, status: string) => {
    try {
      await api.listings.updateListingStatus(listingId, status as ListingStatus);
      loadListings();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  // ── Counts per status (from current full dataset) ───────────
  const counts: Record<string, number> = {
    all: listings.length,
    active: listings.filter(l => l.status === 'active').length,
    pending_pickup: listings.filter(l => l.status === 'pending_pickup').length,
    sold: listings.filter(l => l.status === 'sold').length,
    archived: listings.filter(l => l.status === 'archived').length,
    draft: listings.filter(l => l.status === 'draft').length,
  };

  return (
    <div className="min-h-[calc(100vh-64px)]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ListArchetype<Listing>
          title="My listings"
          subtitle={`${listings.length} total · ${counts.active} active`}
          primaryAction={{
            label: 'New listing',
            onClick: () => router.push('/app/marketplace?create=true'),
          }}
          tabs={STATUS_TABS.map((t) => ({
            key: t.key,
            label: t.label,
            count: counts[t.key] ?? 0,
          }))}
          activeTabKey={filter}
          onTabChange={(k) => setFilter(k as FilterStatus)}
          scrollableTabs
          loading={loading}
          rows={listings}
          rowSpacing={3}
          keyExtractor={(item) => item.id}
          renderRow={(item) => (
            <ListingRow
              item={item}
              onClick={() => router.push(`/app/marketplace/${item.id}`)}
              onEdit={() => router.push(`/app/marketplace/${item.id}/edit`)}
              onStatusChange={(status) => handleQuickStatus(item.id, status)}
            />
          )}
          emptyState={{
            icon: Tag,
            headline:
              filter === 'all'
                ? 'No listings yet'
                : `No ${STATUS_TABS.find((t) => t.key === filter)?.label.toLowerCase()} listings`,
            subcopy:
              filter === 'all'
                ? 'Start selling, giving away, or sharing items with your neighbors.'
                : 'Try a different filter or create a new listing.',
            tone: 'personal',
            ctaLabel: 'Create listing',
            onCtaClick: () => router.push('/app/marketplace?create=true'),
          }}
        />
      </main>
    </div>
  );
}

// ── Listing Row Component ───────────────────────────────────────
function ListingRow({
  item,
  onClick,
  onEdit,
  onStatusChange,
}: {
  item: Listing;
  onClick: () => void;
  onEdit: () => void;
  onStatusChange: (status: string) => void;
}) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const coverUrl = item.media_urls?.[0];
  const statusClass = STATUS_BADGE[item.status] || 'bg-app-surface-sunken text-app-text-secondary';

  return (
    <div className="bg-app-surface rounded-xl border border-app-border p-4 hover:shadow-md transition group">
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div
          className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-lg overflow-hidden bg-app-surface-sunken cursor-pointer"
          onClick={onClick}
        >
          {coverUrl ? (
            <Image src={coverUrl} alt={item.title} width={96} height={96} sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" quality={80} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl text-gray-300">
              📷
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3
                  className="text-base font-semibold text-app-text truncate cursor-pointer hover:text-primary-600"
                  onClick={onClick}
                >
                  {item.title}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase flex-shrink-0 ${statusClass}`}>
                  {(item.status || 'draft').replace(/_/g, ' ')}
                </span>
              </div>

              {/* Price + condition */}
              <div className="flex items-center gap-2 text-sm mb-1">
                <span className={`font-semibold ${item.is_free ? 'text-green-600' : 'text-app-text'}`}>
                  {item.is_free ? 'FREE' : item.price != null ? `$${Number(item.price).toFixed(0)}` : '—'}
                </span>
                {item.condition && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="text-app-text-secondary">{CONDITION_LABELS[item.condition] || item.condition}</span>
                  </>
                )}
                <span className="text-gray-300">·</span>
                <span className="text-app-text-muted">{formatDate(item.created_at)}</span>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-3 text-xs text-app-text-muted">
                <span title="Views">
                  <svg className="w-3.5 h-3.5 inline mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  {item.view_count || 0}
                </span>
                <span title="Saves">
                  <svg className="w-3.5 h-3.5 inline mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                  {item.save_count || 0}
                </span>
                <span title="Messages">
                  <svg className="w-3.5 h-3.5 inline mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  {item.message_count || 0}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Edit */}
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="p-2 border border-app-border text-app-text-secondary rounded-lg hover:bg-app-hover hover:text-app-text-strong transition"
                title="Edit"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>

              {/* Quick status */}
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowStatusMenu(!showStatusMenu); }}
                  className="p-2 border border-app-border text-app-text-secondary rounded-lg hover:bg-app-hover hover:text-app-text-strong transition"
                  title="Change status"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                </button>

                {showStatusMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowStatusMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 bg-app-surface border border-app-border rounded-lg shadow-lg z-20 py-1 min-w-[160px]">
                      {QUICK_STATUSES.map(s => (
                        <button
                          key={s}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowStatusMenu(false);
                            onStatusChange(s);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-app-hover ${
                            item.status === s ? 'text-primary-600 font-semibold' : 'text-app-text-strong'
                          }`}
                        >
                          <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                            s === 'active' ? 'bg-green-500' :
                            s === 'pending_pickup' ? 'bg-amber-500' :
                            s === 'sold' ? 'bg-gray-400' :
                            'bg-gray-400'
                          }`} />
                          {s.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
