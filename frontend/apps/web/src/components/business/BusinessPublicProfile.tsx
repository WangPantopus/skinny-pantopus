// @ts-nocheck
'use client';

import Image from 'next/image';

/**
 * BusinessPublicProfile — full public-facing business profile page.
 * Rendered when /[username] resolves to a business account.
 *
 * Layout:
 *   - Header: logo, name, categories, rating, primary location, CTAs
 *   - Tabs: Overview, Locations & Hours, Menu/Catalog, Reviews (+ any custom pages)
 *   - Tab content with published blocks rendered
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import type { BusinessUser, BusinessProfile, BusinessLocation, BusinessHours, BusinessPage, CatalogItem, BusinessReview, PageBlock } from '@pantopus/types';
import { PublicBlock } from './PublicBlockRenderer';
import UserIdentityLink from '@/components/user/UserIdentityLink';
import { EndorsementSummary, EndorsementButton } from '@/components/endorsement';
import { toast } from '@/components/ui/toast-store';

interface BusinessPublicProfileProps {
  username: string;
  currentUser?: { id?: string } | null;
  initialSlug?: string;
}

export default function BusinessPublicProfile({ username, currentUser, initialSlug }: BusinessPublicProfileProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openingChat, setOpeningChat] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const [business, setBusiness] = useState<BusinessUser | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [hours, setHours] = useState<BusinessHours[]>([]);
  const [pages, setPages] = useState<BusinessPage[]>([]);
  const [defaultPage, setDefaultPage] = useState<BusinessPage | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);

  const [activeTab, setActiveTab] = useState<string>('overview');

  // Reviews
  const [reviews, setReviews] = useState<BusinessReview[]>([]);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);

  const loadBusinessProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.businesses.getPublicBusinessPage(username);
      setBusiness(res.business);
      setProfile(res.profile);
      setLocations(res.locations || []);
      setHours(res.hours || []);
      setPages(res.pages || []);
      setDefaultPage(res.defaultPage || null);
      setCatalog(res.catalog || []);
      if (initialSlug) {
        const hasSlug = Array.isArray(res.pages) && res.pages.some((p: { slug?: string }) => p.slug === initialSlug);
        if (!hasSlug) {
          setError('This business page does not exist.');
          return;
        }
        setActiveTab(`page:${initialSlug}`);
      } else {
        setActiveTab('overview');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load business');
    } finally {
      setLoading(false);
    }
  }, [username, initialSlug]);

  useEffect(() => {
    loadBusinessProfile();
  }, [loadBusinessProfile]);

  const loadReviews = useCallback(async () => {
    if (reviewsLoaded || !business?.id) return;
    try {
      const res = await api.reviews.getUserReviews(business.id, { limit: 50 });
      setReviews(res.reviews || []);
    } catch {
      // ignore
    }
    setReviewsLoaded(true);
  }, [reviewsLoaded, business?.id]);

  useEffect(() => {
    if (activeTab === 'reviews') loadReviews();
  }, [activeTab, business, loadReviews]);

  useEffect(() => {
    let ignore = false;
    const loadFollowStatus = async () => {
      if (!currentUser?.id || !business?.id || currentUser.id === business.id) return;
      try {
        const status = await api.businesses.getFollowStatus(String(business.id));
        if (!ignore) setFollowing(!!status.following);
      } catch {
        if (!ignore) setFollowing(false);
      }
    };
    loadFollowStatus();
    return () => { ignore = true; };
  }, [currentUser?.id, business?.id]);

  const handleFollow = async () => {
    if (!currentUser) {
      router.push('/login');
      return;
    }
    if (!business?.id || currentUser.id === business.id) return;
    setFollowLoading(true);
    try {
      if (following) {
        await api.businesses.unfollowBusiness(String(business.id));
        setFollowing(false);
      } else {
        await api.businesses.followBusiness(String(business.id));
        setFollowing(true);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto" />
          <p className="mt-4 text-app-text-secondary">Loading business…</p>
        </div>
      </div>
    );
  }

  if (error || !business || !profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-app-text mb-2">Business not found</h2>
          <p className="text-app-text-secondary mb-4">{error || 'This business does not exist or is not published.'}</p>
          <button
            onClick={() => router.push('/app')}
            className="bg-violet-600 text-white px-6 py-2 rounded-lg hover:bg-violet-700"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const primaryLocation = locations.find((l) => l.is_primary) || locations[0];
  const displayRating = business.average_rating || 0;
  const displayReviewCount = business.review_count || 0;
  const handleOpenInquiry = async () => {
    if (!currentUser) { router.push('/login'); return; }
    if (!business?.id) return;
    setOpeningChat(true);
    try {
      const resp = await api.businesses.startBusinessInquiry(String(business.id), `Inquiry for @${username}`) as Record<string, any>;
      if (!resp?.roomId) throw new Error('Chat room was not created');
      router.push(`/app/chat/${resp.roomId}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to open chat');
    } finally {
      setOpeningChat(false);
    }
  };

  // Build tabs
  const tabs: { key: string; label: string }[] = [
    { key: 'overview', label: 'Overview' },
  ];
  if (locations.length > 0) {
    tabs.push({ key: 'locations', label: 'Locations & Hours' });
  }
  if (catalog.length > 0) {
    const catalogLabel = catalog.some((c) => c.kind === 'menu_item')
      ? 'Menu'
      : catalog.some((c) => c.kind === 'service')
      ? 'Services'
      : 'Catalog';
    tabs.push({ key: 'catalog', label: catalogLabel });
  }
  // Add custom published pages (non-default)
  for (const page of pages) {
    if (!page.is_default && page.show_in_nav) {
      tabs.push({ key: `page:${page.slug}`, label: page.title });
    }
  }
  if (
    initialSlug &&
    activeTab === `page:${initialSlug}` &&
    !tabs.some((t) => t.key === `page:${initialSlug}`)
  ) {
    const currentPage = pages.find((p: { slug?: string }) => p.slug === initialSlug);
    if (currentPage) {
      tabs.push({ key: `page:${initialSlug}`, label: currentPage.title || initialSlug });
    }
  }
  tabs.push({ key: 'reviews', label: 'Reviews' });

  // Block rendering context
  const blockCtx = {
    locations,
    hours,
    catalog,
    business,
    profile,
    onContact: handleOpenInquiry,
    canContact: !!currentUser,
  };

  return (
    <div className="bg-app-surface-raised min-h-screen">
      {/* ===== Business Header ===== */}
      <div className="bg-app-surface border-b border-app-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Logo / Avatar */}
            <div className="flex-shrink-0">
              {business.profile_picture_url ? (
                <Image
                  src={business.profile_picture_url}
                  alt={business.name}
                  className="w-24 h-24 rounded-2xl object-cover border-2 border-app-border"
                  width={96}
                  height={96}
                  sizes="96px"
                  quality={75}
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-400 via-purple-500 to-indigo-600 flex items-center justify-center text-white text-4xl font-bold border-2 border-app-border">
                  {(business.name || 'B')[0].toUpperCase()}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-app-text">{business.name}</h1>

              {/* Categories */}
              {profile.categories && profile.categories.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {profile.categories.map((cat: string, i: number) => (
                    <span
                      key={i}
                      className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 border border-violet-200"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              )}

              {/* Rating */}
              {displayReviewCount > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-yellow-500">
                    {'★'.repeat(Math.round(displayRating))}{'☆'.repeat(5 - Math.round(displayRating))}
                  </span>
                  <span className="text-sm text-app-text-secondary">
                    {displayRating.toFixed(1)} ({displayReviewCount} review{displayReviewCount !== 1 ? 's' : ''})
                  </span>
                </div>
              )}

              {/* Location */}
              {primaryLocation && (
                <div className="mt-2 text-sm text-app-text-secondary flex items-center gap-1">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>
                    {[primaryLocation.city, primaryLocation.state].filter(Boolean).join(', ')}
                    {locations.length > 1 && ` + ${locations.length - 1} more`}
                  </span>
                </div>
              )}

              {/* Tagline */}
              {business.tagline && (
                <p className="mt-2 text-sm text-app-text-secondary italic">{business.tagline}</p>
              )}
            </div>

            {/* CTAs */}
            <div className="flex sm:flex-col gap-2 flex-shrink-0">
              {currentUser?.id !== business.id && (
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                    following
                      ? 'border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100'
                      : 'border border-app-border text-app-text-strong hover:bg-app-hover'
                  }`}
                >
                  {followLoading ? '...' : following ? 'Following' : 'Follow'}
                </button>
              )}
              {profile.public_phone && (
                <a
                  href={`tel:${profile.public_phone}`}
                  className="px-4 py-2 rounded-lg border border-app-border text-sm font-semibold text-app-text-strong hover:bg-app-hover transition text-center"
                >
                  Call
                </a>
              )}
              <button
                onClick={handleOpenInquiry}
                disabled={openingChat}
                className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition"
              >
                {openingChat ? 'Opening…' : 'Message'}
              </button>
              {/* Endorse CTA */}
              {currentUser?.id !== business.id && profile.categories?.length > 0 && (
                <EndorsementButton
                  businessId={String(business.id)}
                  categories={profile.categories}
                  isOwner={currentUser?.id === business.id}
                />
              )}
              {primaryLocation?.location && (
                <a
                  href={`https://maps.google.com/?q=${primaryLocation.location.latitude},${primaryLocation.location.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg border border-app-border text-sm font-semibold text-app-text-strong hover:bg-app-hover transition text-center"
                >
                  Directions
                </a>
              )}
            </div>
          </div>

          {/* Tab bar */}
          <div className="mt-6 -mb-px flex gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition whitespace-nowrap ${
                  activeTab === t.key
                    ? 'border-violet-600 text-violet-700'
                    : 'border-transparent text-app-text-secondary hover:text-app-text-strong'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ===== Tab Content ===== */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Overview (published blocks) */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Description fallback if no blocks */}
            {(!defaultPage || !defaultPage.blocks || defaultPage.blocks.length === 0) && profile.description && (
              <div className="rounded-xl border border-app-border bg-app-surface p-6">
                <p className="text-app-text-secondary leading-relaxed whitespace-pre-wrap">{profile.description}</p>
              </div>
            )}

            {/* Render published blocks */}
            {defaultPage?.blocks?.map((block: PageBlock, i: number) => (
              <PublicBlock key={block.id || i} block={block} ctx={blockCtx} />
            ))}

            {/* If no blocks and no description, show a minimal info card */}
            {(!defaultPage?.blocks || defaultPage.blocks.length === 0) && !profile.description && (
              <div className="rounded-xl border border-app-border bg-app-surface p-8 text-center text-app-text-muted">
                <div className="text-3xl mb-2">🏢</div>
                <p className="text-sm">This business hasn&apos;t added content yet.</p>
              </div>
            )}

            {/* Quick info cards below blocks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              {/* Endorsement Summary Card */}
              <div className="sm:col-span-2">
                <EndorsementSummary
                  businessId={String(business.id)}
                  categories={profile.categories || []}
                  currentUserId={currentUser?.id}
                  businessOwnerId={String(business.id)}
                />
              </div>
              {profile.website && (
                <InfoCard icon="🌐" label="Website">
                  <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline text-sm truncate">
                    {profile.website.replace(/^https?:\/\//, '')}
                  </a>
                </InfoCard>
              )}
              {profile.public_email && (
                <InfoCard icon="✉️" label="Email">
                  <a href={`mailto:${profile.public_email}`} className="text-violet-600 hover:underline text-sm">
                    {profile.public_email}
                  </a>
                </InfoCard>
              )}
              {profile.public_phone && (
                <InfoCard icon="📞" label="Phone">
                  <a href={`tel:${profile.public_phone}`} className="text-violet-600 hover:underline text-sm">
                    {profile.public_phone}
                  </a>
                </InfoCard>
              )}
              {profile.founded_year && (
                <InfoCard icon="📅" label="Founded">
                  <span className="text-sm text-app-text-strong">{profile.founded_year}</span>
                </InfoCard>
              )}
            </div>
          </div>
        )}

        {/* Locations & Hours */}
        {activeTab === 'locations' && (
          <LocationsHoursTab locations={locations} hours={hours} />
        )}

        {/* Catalog */}
        {activeTab === 'catalog' && (
          <CatalogTab catalog={catalog} />
        )}

        {/* Reviews */}
        {activeTab === 'reviews' && (
          <ReviewsTab business={business} reviews={reviews} currentUser={currentUser} />
        )}

        {/* Custom pages */}
        {activeTab.startsWith('page:') && (
          <CustomPageTab
            username={username}
            pageSlug={activeTab.replace('page:', '')}
            ctx={blockCtx}
          />
        )}
      </div>
    </div>
  );
}


/* ─── Info Card ────────────────────────────── */

function InfoCard({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-4 flex items-start gap-3">
      <span className="text-lg">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-app-text-muted font-medium uppercase tracking-wider">{label}</div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}


/* ─── Locations & Hours Tab ────────────────── */

function LocationsHoursTab({ locations, hours }: { locations: BusinessLocation[]; hours: BusinessHours[] }) {
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const formatTime = (t: string | null) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const hoursByLocation: Record<string, BusinessHours[]> = {};
  for (const h of hours) {
    if (!hoursByLocation[h.location_id]) hoursByLocation[h.location_id] = [];
    hoursByLocation[h.location_id].push(h);
  }

  return (
    <div className="space-y-4">
      {locations.map((loc) => {
        const locHours = (hoursByLocation[loc.id] || []).sort((a: BusinessHours, b: BusinessHours) => a.day_of_week - b.day_of_week);
        return (
          <div key={loc.id} className="rounded-xl border border-app-border bg-app-surface p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-app-text">{loc.label}</h3>
                  {loc.is_primary && (
                    <span className="text-[10px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">
                      Primary
                    </span>
                  )}
                </div>
                <div className="text-sm text-app-text-secondary mt-0.5">{loc.address}</div>
                <div className="text-sm text-app-text-secondary">
                  {[loc.city, loc.state, loc.zipcode].filter(Boolean).join(', ')}
                </div>
                {loc.phone && (
                  <a href={`tel:${loc.phone}`} className="text-sm text-violet-600 hover:underline mt-1 inline-block">{loc.phone}</a>
                )}
              </div>
              {loc.location && (
                <a
                  href={`https://maps.google.com/?q=${loc.location.latitude},${loc.location.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg border border-app-border text-xs font-medium text-app-text-secondary hover:bg-app-hover transition flex-shrink-0"
                >
                  Directions
                </a>
              )}
            </div>

            {locHours.length > 0 && (
              <div className="border-t border-app-border-subtle pt-4">
                <h4 className="text-xs font-semibold text-app-text-secondary uppercase tracking-wider mb-2">Hours</h4>
                <div className="space-y-1.5">
                  {locHours.map((h: BusinessHours) => (
                    <div key={h.id} className="flex justify-between text-sm">
                      <span className="text-app-text-strong font-medium">{DAY_NAMES[h.day_of_week]}</span>
                      <span className={h.is_closed ? 'text-red-500' : 'text-app-text-secondary'}>
                        {h.is_closed ? 'Closed' : `${formatTime(h.open_time)} – ${formatTime(h.close_time)}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


/* ─── Catalog Tab ──────────────────────────── */

function CatalogTab({ catalog }: { catalog: CatalogItem[] }) {
  // Group by kind
  const grouped: Record<string, CatalogItem[]> = {};
  for (const item of catalog) {
    const k = item.kind || 'other';
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(item);
  }

  const kindLabels: Record<string, string> = {
    service: 'Services',
    product: 'Products',
    menu_item: 'Menu',
    class: 'Classes',
    rental: 'Rentals',
    membership: 'Memberships',
    other: 'Other',
  };

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([kind, items]) => (
        <div key={kind}>
          <h3 className="text-lg font-semibold text-app-text mb-3">{kindLabels[kind] || kind}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item: CatalogItem) => (
              <div key={item.id} className="rounded-xl border border-app-border bg-app-surface overflow-hidden hover:shadow-md transition">
                {item.image_url ? (
                  <Image src={item.image_url} alt={item.name} className="w-full h-36 object-cover" width={400} height={144} sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" quality={80} />
                ) : (
                  <div className="w-full h-20 bg-app-surface-sunken flex items-center justify-center">
                    <span className="text-2xl">
                      {kind === 'menu_item' ? '🍽️' : kind === 'product' ? '📦' : kind === 'service' ? '⚡' : '📋'}
                    </span>
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold text-app-text">{item.name}</h4>
                    {item.price_cents != null && (
                      <span className="text-sm font-bold text-app-text whitespace-nowrap">
                        ${(item.price_cents / 100).toFixed(2)}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-app-text-secondary mt-1 line-clamp-2">{item.description}</p>
                  )}
                  {item.duration_minutes && (
                    <span className="text-[10px] text-app-text-muted mt-1 inline-block">{item.duration_minutes} min</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}


/* ─── Reviews Tab ──────────────────────────── */

function ReviewsTab({ business, reviews }: { business: BusinessUser; reviews: BusinessReview[]; currentUser?: { id?: string } | null }) {
  const rating = business?.average_rating || 0;
  const count = business?.review_count || 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-xl border border-app-border bg-app-surface p-6 flex items-center gap-6">
        <div className="text-center">
          <div className="text-4xl font-bold text-app-text">{rating ? rating.toFixed(1) : '—'}</div>
          <div className="text-yellow-500 text-lg mt-1">
            {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
          </div>
          <div className="text-xs text-app-text-secondary mt-1">{count} review{count !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Individual reviews */}
      {reviews.length > 0 ? (
        reviews.map((review: BusinessReview) => (
          <div key={review.id} className="rounded-xl border border-app-border bg-app-surface p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-app-surface-sunken flex items-center justify-center text-xs font-semibold text-app-text-secondary">
                {(review.reviewer?.name || review.reviewer?.username || '?')[0].toUpperCase()}
              </div>
              <div>
                {review.reviewer?.username ? (
                  <UserIdentityLink
                    userId={review.reviewer?.id || null}
                    username={review.reviewer.username}
                    displayName={review.reviewer?.name || review.reviewer.username}
                    avatarUrl={review.reviewer?.profile_picture_url || null}
                    city={review.reviewer?.city || null}
                    state={review.reviewer?.state || null}
                    textClassName="text-sm font-medium text-app-text hover:underline"
                  />
                ) : (
                  <div className="text-sm font-medium text-app-text">
                    {review.reviewer?.name || 'Anonymous'}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <span className="text-yellow-500 text-xs">
                    {'★'.repeat(review.rating || 0)}{'☆'.repeat(5 - (review.rating || 0))}
                  </span>
                  <span className="text-[10px] text-app-text-muted">
                    {review.created_at ? new Date(review.created_at).toLocaleDateString() : ''}
                  </span>
                </div>
              </div>
            </div>
            {review.comment && (
              <p className="text-sm text-app-text-secondary leading-relaxed">{review.comment}</p>
            )}
          </div>
        ))
      ) : (
        <div className="text-center py-8 text-app-text-muted text-sm">
          No reviews yet. Be the first to leave a review!
        </div>
      )}
    </div>
  );
}


/* ─── Custom Page Tab ──────────────────────── */

function CustomPageTab({
  username,
  pageSlug,
  ctx,
}: {
  username: string;
  pageSlug: string;
  ctx: Record<string, any>;
}) {
  const [blocks, setBlocks] = useState<PageBlock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.businesses.getPublicBusinessPageBySlug(username, pageSlug);
        setBlocks(res.currentPage?.blocks || []);
      } catch {
        setBlocks([]);
      }
      setLoading(false);
    })();
  }, [pageSlug, username]);

  if (loading) {
    return <div className="text-center py-8 text-app-text-muted text-sm">Loading…</div>;
  }

  if (blocks.length === 0) {
    return <div className="text-center py-8 text-app-text-muted text-sm">This page has no published content yet.</div>;
  }

  return (
    <div className="space-y-4">
      {blocks.map((block: PageBlock, i: number) => (
        <PublicBlock key={block.id || i} block={block} ctx={ctx as Record<string, any>} />
      ))}
    </div>
  );
}
