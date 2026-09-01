'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import * as api from '@pantopus/api';
import SearchInput from '@/components/SearchInput';
import { BID_STATUS } from '@/components/statusColors';
import UserIdentityLink from '@/components/user/UserIdentityLink';
import { formatTimeAgo as timeAgo } from '@pantopus/ui-utils';
import { Inbox, Send } from 'lucide-react';
import { ListArchetype } from '@/components/archetypes';

type Offer = {
  id: string;
  gig_id: string;
  user_id: string;
  bid_amount: number;
  message: string;
  proposed_time?: string;
  status: string;
  created_at: string;
  gig?: { id: string; title: string; price: number; status: string; category?: string };
  bidder?: { id: string; username: string; name?: string; first_name?: string; profile_picture_url?: string; city?: string; state?: string };
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = BID_STATUS;

export default function OffersPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'received' | 'sent'>('received');
  const [received, setReceived] = useState<Offer[]>([]);
  const [sent, setSent] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recvRes, sentRes] = await Promise.allSettled([
        api.gigs.getReceivedOffers(),
        api.gigs.getMyBids(),
      ]);
      if (recvRes.status === 'fulfilled') setReceived(((recvRes.value as Record<string, any>).offers || []) as Offer[]);
      if (sentRes.status === 'fulfilled') setSent(((sentRes.value as Record<string, any>).bids || []) as Offer[]);
    } catch {}
    setLoading(false);
  };

  const items = tab === 'received' ? received : sent;
  const filtered = items.filter(o => {
    if (filter !== 'all' && o.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const title = (o.gig?.title || '').toLowerCase();
      const msg = (o.message || '').toLowerCase();
      const name = (o.bidder?.name || o.bidder?.username || '').toLowerCase();
      if (!title.includes(q) && !msg.includes(q) && !name.includes(q)) return false;
    }
    return true;
  });

  const recvPending = received.filter(o => o.status === 'pending').length;
  const sentPending = sent.filter(o => o.status === 'pending').length;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <ListArchetype<Offer>
        title="Offers"
        subtitle="Manage bids and offers on your tasks."
        primaryAction={{
          label: 'Post a task',
          onClick: () => router.push('/app/gigs-v2/new'),
        }}
        headerFilters={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search offers…"
            className="max-w-sm"
          />
        }
        tabs={[
          { key: 'received', label: 'Received', count: recvPending > 0 ? recvPending : null },
          { key: 'sent', label: 'Sent', count: sentPending > 0 ? sentPending : null },
        ]}
        activeTabKey={tab}
        onTabChange={(k) => {
          setTab(k as 'received' | 'sent');
          setFilter('all');
        }}
        renderHeader={() => (
          <div className="flex gap-2 overflow-x-auto">
            {['all', 'pending', 'accepted', 'declined'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition ${
                  filter === f
                    ? 'bg-gray-900 text-white'
                    : 'bg-app-surface-sunken text-app-text-secondary hover:bg-app-hover'
                }`}
              >
                {f === 'all' ? 'All' : STATUS_STYLES[f]?.label || f}
              </button>
            ))}
          </div>
        )}
        loading={loading}
        rows={filtered}
        rowSpacing={3}
        keyExtractor={(offer) => offer.id}
        renderRow={(offer) => (
          <OfferCard
            offer={offer}
            perspective={tab}
            onNavigate={(path) => router.push(path)}
          />
        )}
        emptyState={{
          icon: tab === 'received' ? Inbox : Send,
          headline:
            filter !== 'all'
              ? `No ${filter} offers`
              : tab === 'received'
              ? 'No offers received yet'
              : 'No offers sent yet',
          subcopy:
            tab === 'received'
              ? 'Post a task and people will send you offers.'
              : 'Browse the map and bid on tasks to get started.',
          tone: 'personal',
          ctaLabel: tab === 'received' ? 'Post a task' : 'Browse tasks',
          onCtaClick: () =>
            router.push(tab === 'received' ? '/app/gigs-v2/new' : '/app/map'),
        }}
      />
    </div>
  );
}

function OfferCard({
  offer,
  perspective,
  onNavigate,
}: {
  offer: Offer;
  perspective: 'received' | 'sent';
  onNavigate: (path: string) => void;
}) {
  const status = STATUS_STYLES[offer.status] || STATUS_STYLES.pending;
  const personName = perspective === 'received'
    ? (offer.bidder?.name || offer.bidder?.first_name || offer.bidder?.username || 'Unknown')
    : null;

  return (
    <div
      onClick={() => offer.gig?.id && onNavigate(`/app/gigs/${offer.gig.id}`)}
      className={`bg-app-surface rounded-xl border border-app-border p-4 hover:border-app-border hover:shadow-sm transition cursor-pointer ${
        offer.status === 'pending' ? 'border-l-4 border-l-amber-400' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: info */}
        <div className="min-w-0 flex-1">
          {/* Gig title */}
          <h3 className="text-sm font-semibold text-app-text truncate">
            {offer.gig?.title || 'Unknown Gig'}
          </h3>

          {/* Person (for received offers) */}
          {perspective === 'received' && offer.bidder && (
            <div className="flex items-center gap-2 mt-1.5">
              {offer.bidder.profile_picture_url ? (
                <Image src={offer.bidder.profile_picture_url} alt="" width={20} height={20} sizes="20px" quality={75} className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-gray-300 text-white text-[10px] font-bold flex items-center justify-center">
                  {(personName || '?')[0].toUpperCase()}
                </div>
              )}
              {offer.bidder.username ? (
                <UserIdentityLink
                  userId={offer.bidder.id}
                  username={offer.bidder.username}
                  displayName={personName || offer.bidder.username}
                  avatarUrl={offer.bidder.profile_picture_url || null}
                  city={offer.bidder.city || null}
                  state={offer.bidder.state || null}
                  textClassName="text-xs text-app-text-secondary hover:underline"
                />
              ) : (
                <span className="text-xs text-app-text-secondary">
                  {personName}
                  {offer.bidder.city && ` · ${offer.bidder.city}`}
                </span>
              )}
            </div>
          )}

          {/* Message */}
          {offer.message && (
            <p className="text-xs text-app-text-secondary mt-1.5 line-clamp-2">&quot;{offer.message}&quot;</p>
          )}

          {/* Time */}
          <p className="text-[10px] text-app-text-muted mt-2">{timeAgo(offer.created_at)}</p>
        </div>

        {/* Right: amount + status */}
        <div className="text-right flex-shrink-0">
          <div className="text-lg font-bold text-app-text">${offer.bid_amount}</div>
          {offer.gig?.price && offer.bid_amount !== offer.gig.price && (
            <div className="text-[10px] text-app-text-muted line-through">${offer.gig.price} asked</div>
          )}
          <span className={`inline-block mt-1.5 px-2 py-0.5 text-[10px] font-semibold rounded-full ${status.bg} ${status.text}`}>
            {status.label}
          </span>
        </div>
      </div>
    </div>
  );
}
