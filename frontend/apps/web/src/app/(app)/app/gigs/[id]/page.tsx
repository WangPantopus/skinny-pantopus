// @ts-nocheck
'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { FileText, Lock, CircleDot } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { useBadges } from '@/contexts/BadgeContext';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { pushSignal } from '@/lib/signal-buffer';
import PaymentStatusBadge from '@/components/payments/PaymentStatusBadge';
import UserIdentityLink from '@/components/user/UserIdentityLink';
import GigTimeline from '@/components/gig-detail/GigTimeline';
import MediaLightbox from '@/components/gig-detail/MediaLightbox';
import DetailRow from '@/components/gig-detail/DetailRow';
import QASection from '@/components/gig-detail/QASection';
import ChangeOrdersSection from '@/components/gig-detail/ChangeOrdersSection';
import BidPanel from '@/components/gig-detail/BidPanel';
import OffersPanel from '@/components/gig-detail/OffersPanel';
import CompletionFlow, { type CompletionFlowHandle } from '@/components/gig-detail/CompletionFlow';
import GigHeader from '@/components/gig-detail/GigHeader';
import PaymentSection from '@/components/gig-detail/PaymentSection';
import { formatTimeAgo as timeAgo } from '@pantopus/ui-utils';
import type { GigWithDetails, UserProfile } from '@pantopus/types';

// ─── Lazy Leaflet mini map (SSR-disabled) ───────────────────────────
// Same pattern as gigs-v2/[id]/page.tsx — dynamically imports react-leaflet only on the client.
// Owners get the exact coords; non-owners get the backend-jittered approx coords (~500m grid),
// so the same component naturally renders the right level of precision per viewer.
const MiniMap = dynamic(
  () =>
    import('react-leaflet').then(({ MapContainer, TileLayer, Marker, Circle }) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const L = require('leaflet') as typeof import('leaflet');
      const icon = new L.Icon({
        iconUrl: '/leaflet/marker-icon.png',
        iconRetinaUrl: '/leaflet/marker-icon-2x.png',
        shadowUrl: '/leaflet/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });
      return function MiniMapInner({ lat, lng, isApprox }: { lat: number; lng: number; isApprox: boolean }) {
        return (
          <MapContainer
            center={[lat, lng]}
            zoom={isApprox ? 13 : 15}
            // Full interactivity — let the user explore to figure out where this is.
            scrollWheelZoom
            dragging
            doubleClickZoom
            zoomControl
            // Compact attribution in the corner — required by the OSM tile usage policy.
            attributionControl
            style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            {isApprox ? (
              <Circle
                center={[lat, lng]}
                radius={500}
                pathOptions={{ color: '#0284c7', weight: 2, fillColor: '#0284c7', fillOpacity: 0.15 }}
              />
            ) : (
              <Marker position={[lat, lng]} icon={icon} />
            )}
          </MapContainer>
        );
      };
    }),
  { ssr: false }
);

/** Common shape for poster/creator nested objects from backend variants. */
interface GigActorSummary {
  [key: string]: unknown;
  id?: string;
  account_type?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  profile_picture_url?: string;
  /** Some serializers / clients use alternate keys */
  avatar_url?: string;
  profilePicture?: string;
  city?: string;
  state?: string;
}

/**
 * Extended gig record covering all backend variants (snake_case, camelCase, nested).
 * Extends GigWithDetails with additional optional fields the backend may return.
 */
interface GigFullRecord extends GigWithDetails {
  [key: string]: unknown;
  user_id?: string;
  poster_user_id?: string;
  /** List-style gig payloads sometimes carry poster art at the root */
  poster_profile_picture_url?: string | null;
  accepted_by?: string | null;
  acceptedBy?: string | null;
  creator_id?: string;
  creator?: GigActorSummary | null;
  Creator?: GigActorSummary | null;
  user?: GigActorSummary | null;
  User?: GigActorSummary | null;
  is_anonymous?: boolean;
  anonymous?: boolean;
  post_as_anonymous?: boolean;
  postAnonymously?: boolean;
  createdAt?: string;
  attachments?: string[];
  media_urls?: string[];
  photos?: string[];
  viewer_has_saved?: boolean;
}

interface GigMediaItem {
  id?: string;
  file_url?: string;
  url?: string;
  file_name?: string;
  mime_type?: string;
}

export default function GigDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const gigId = params.id as string;
  const { socket, connected: socketConnected } = useBadges();

  const [gig, setGig] = useState<GigFullRecord | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [canManageGigAsBusinessMember, setCanManageGigAsBusinessMember] = useState(false);
  const [loading, setLoading] = useState(true);

  // Media gallery state
  const [gigMedia, setGigMedia] = useState<GigMediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const completionRef = useRef<CompletionFlowHandle>(null);

  // Key incremented on socket bid events to trigger OffersPanel refresh
  const [offersRefreshKey, setOffersRefreshKey] = useState(0);

  // ---------- Loaders ----------
  useEffect(() => {
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gigId]);

  const init = async () => {
    const token = getAuthToken();
    if (!token) {
      router.push('/login');
      return;
    }
    setLoading(true);
    try {
      await Promise.all([loadCurrentUser(), loadGigDetails(), loadGigMedia()]);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentUser = async () => {
    try {
      const userData = await api.users.getMyProfile();
      setUser(userData as UserProfile);
    } catch (err) {
      console.error('Failed to load user:', err);
      setUser(null);
    }
  };

  const loadGigDetails = async () => {
    try {
      const gigData = await api.gigs.getGigById(gigId);
      setGig(gigData as GigFullRecord);
    } catch (err) {
      console.error('Failed to load gig:', err);
      setGig(null);
    }
  };

  const loadGigMedia = async () => {
    setMediaLoading(true);
    try {
      const result = await api.upload.getGigMedia(gigId);
      setGigMedia(result.media ?? []);
    } catch {
      setGigMedia([]);
    } finally {
      setMediaLoading(false);
    }
  };

  // ---------- Derived ----------
  const currentUserId = user?.id;

  useEffect(() => {
    const resolveBusinessManageAccess = async () => {
      if (!gig || !currentUserId) {
        setCanManageGigAsBusinessMember(false);
        return;
      }
      const ownerId = gig.user_id || gig.poster_user_id || gig.poster_id;
      const ownerAccountType = gig.creator?.account_type;
      if (!ownerId || String(ownerId) === String(currentUserId) || ownerAccountType !== 'business') {
        setCanManageGigAsBusinessMember(false);
        return;
      }
      try {
        const access = await api.businessIam.getMyBusinessAccess(String(ownerId));
        const canManage = Boolean(
          access?.hasAccess &&
          (access?.isOwner ||
            (Array.isArray(access?.permissions) &&
              (access.permissions.includes('gigs.manage') || access.permissions.includes('gigs.post')))
          )
        );
        setCanManageGigAsBusinessMember(canManage);
      } catch {
        setCanManageGigAsBusinessMember(false);
      }
    };
    void resolveBusinessManageAccess();
  }, [gig, currentUserId]);

  const gigStatus = String(gig?.status ?? '');
  const isAssigned = gigStatus === 'assigned';
  const isInProgress = gigStatus === 'in_progress';

  const acceptedBy = gig?.accepted_by ?? gig?.acceptedBy ?? null;
  const iAmWorker = Boolean(currentUserId && acceptedBy === currentUserId);

  const isMyGig = Boolean(
    currentUserId &&
      gig &&
      ((gig.user_id === currentUserId) ||
        (gig.poster_user_id === currentUserId) ||
        (gig.poster_id === currentUserId) ||
        (gig.creator_id === currentUserId) ||
        (gig.creator?.id === currentUserId) ||
        canManageGigAsBusinessMember)
  );

  const budget = gig?.price || gig?.budget_min || 0;
  const budgetMax = gig?.budget_max;
  const paymentStatusFromGig = String(gig?.payment_status || 'none');

  // Magic-task posts include the AI's suggested budget range under ai_draft_json.
  // Surface it as a "suggested" range so helpers see what the poster expects.
  const aiBudgetRange = (() => {
    const ai = (gig as { ai_draft_json?: { budget_range?: { min?: number; max?: number } | null } } | null)
      ?.ai_draft_json;
    const range = ai?.budget_range;
    if (!range) return null;
    const min = Number(range.min);
    const max = Number(range.max);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return null;
    return { min: Math.round(min), max: Math.round(max) };
  })();
  const payTypeIsOffers = ((gig as { pay_type?: string } | null)?.pay_type ?? 'fixed') === 'offers';

  const poster = (gig?.creator ?? gig?.Creator ?? gig?.user ?? gig?.User ?? gig?.poster ?? null) as GigActorSummary | null;
  const isAnonymousPoster =
    Boolean(gig?.is_anonymous ?? gig?.anonymous ?? gig?.post_as_anonymous ?? gig?.postAnonymously) ||
    !poster;
  const posterDisplayName = isAnonymousPoster
    ? 'Anonymous'
    : poster?.name ||
      (poster?.firstName && poster?.lastName ? `${poster.firstName} ${poster.lastName}` : null) ||
      (poster?.first_name && poster?.last_name ? `${poster.first_name} ${poster.last_name}` : null) ||
      poster?.username ||
      'Anonymous';
  const posterInitial = isAnonymousPoster
    ? '?'
    : (
        String(posterDisplayName || '').trim()[0] ||
        String(poster?.username ?? '')?.[0] ||
        String(poster?.name ?? '')?.[0] ||
        '?'
      ).toUpperCase();
  const gigCreatedAt = gig?.created_at || gig?.createdAt;
  const posterUserId = poster?.id || gig?.user_id || gig?.poster_id || null;
  const posterUsername = poster?.username || null;
  const posterAvatarRaw =
    poster?.profile_picture_url ||
    poster?.avatar_url ||
    poster?.profilePicture ||
    gig?.poster_profile_picture_url ||
    null;
  const posterAvatar =
    typeof posterAvatarRaw === 'string' && posterAvatarRaw.trim().length > 0
      ? posterAvatarRaw.trim()
      : null;

  // Auto-open cancel modal if ?action=cancel
  useEffect(() => {
    if (searchParams.get('action') === 'cancel' && gig && !loading) {
      completionRef.current?.openCancelModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gig, loading]);

  // Real-time updates via Socket.IO (replaces 12s polling)
  useEffect(() => {
    if (!gigId || !socket) return;

    socket.emit('gig:join', { gigId });

    const onStatusChange = () => void loadGigDetails();
    const onBidUpdate = () => { void loadGigDetails(); setOffersRefreshKey((k) => k + 1); };
    const onBidAccepted = () => { void loadGigDetails(); setOffersRefreshKey((k) => k + 1); };
    const onPaymentUpdate = () => void loadGigDetails();
    const onCompletionUpdate = () => void loadGigDetails();
    const onQaUpdate = () => void loadGigDetails();

    socket.on('gig:status-change', onStatusChange);
    socket.on('gig:bid-update', onBidUpdate);
    socket.on('gig:bid-accepted', onBidAccepted);
    socket.on('gig:payment-update', onPaymentUpdate);
    socket.on('gig:completion-update', onCompletionUpdate);
    socket.on('gig:qa-update', onQaUpdate);

    return () => {
      socket.emit('gig:leave', { gigId });
      socket.off('gig:status-change', onStatusChange);
      socket.off('gig:bid-update', onBidUpdate);
      socket.off('gig:bid-accepted', onBidAccepted);
      socket.off('gig:payment-update', onPaymentUpdate);
      socket.off('gig:completion-update', onCompletionUpdate);
      socket.off('gig:qa-update', onQaUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gigId, socket]);

  // Fallback: poll every 60s when socket is disconnected
  useEffect(() => {
    if (!gigId || !currentUserId || socketConnected) return;
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void loadGigDetails();
    }, 60000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gigId, currentUserId, socketConnected]);

  // ── Dwell time tracking for affinity signals ──
  const mountTimeRef = useRef<number>(Date.now());
  useEffect(() => {
    mountTimeRef.current = Date.now();
    const category = gig?.category;
    return () => {
      if (!gigId || !category) return;
      const dwellMs = Date.now() - mountTimeRef.current;
      pushSignal({
        gig_id: gigId,
        category,
        dwell_ms: dwellMs,
        timestamp: new Date().toISOString(),
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gigId, gig?.category]);

  const handleOpenGigChat = async () => {
    try {
      const resp = await api.gigs.getGigChatRoom(gigId);
      const roomId = resp?.roomId;
      if (!roomId) {
        const { toast } = await import('@/components/ui/toast-store');
        toast.info('Chat thread not available yet for this gig.');
        return;
      }
      router.push(`/app/chat/${roomId}`);
    } catch (err: unknown) {
      console.error('Open gig chat failed:', err);
      const { toast } = await import('@/components/ui/toast-store');
      toast.error(err instanceof Error ? err.message : 'Failed to open chat');
    }
  };

  const handleRefresh = () => {
    void loadGigDetails();
  };

  // ---------- Media Gallery Helpers ----------
  const allMediaUrls: { url: string; type: 'image' | 'document'; name: string }[] = (() => {
    if (!gig) return [];
    const seen = new Set<string>();
    const items: { url: string; type: 'image' | 'document'; name: string }[] = [];

    const attachmentCandidates = [
      gig.attachments,
      gig.media_urls,
      gig.photos,
      gig.image_urls,
    ];
    attachmentCandidates
      .flatMap((list) => (Array.isArray(list) ? list : []))
      .forEach((entry: string | Record<string, any>) => {
        const raw = typeof entry === 'string' ? entry.trim() : (String(entry?.url ?? entry?.file_url ?? entry?.src ?? '')).trim();
        if (!raw || seen.has(raw)) return;
        seen.add(raw);
        const isImg = /\.(png|jpg|jpeg|gif|webp|heic|heif)$/i.test(raw.split('?')[0] || '');
        items.push({ url: raw, type: isImg ? 'image' : 'document', name: raw.split('/').pop() || 'file' });
      });

    (gigMedia || []).forEach((m: GigMediaItem) => {
      const url = (m.file_url || m.url || '').trim();
      if (!url || seen.has(url)) return;
      seen.add(url);
      const isImg = /^image\//i.test(m.mime_type ?? '') || /\.(png|jpg|jpeg|gif|webp|heic|heif)$/i.test(url.split('?')[0] || '');
      items.push({ url, type: isImg ? 'image' : 'document', name: m.file_name ?? url.split('/').pop() ?? 'file' });
    });

    return items;
  })();

  const imageMedia = allMediaUrls.filter((m) => m.type === 'image');
  const documentMedia = allMediaUrls.filter((m) => m.type === 'document');

  // ---------- Render ----------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
          <p className="mt-4 text-app-text-secondary">Loading gig details...</p>
        </div>
      </div>
    );
  }

  if (!gig) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-app-text mb-2">Gig not found</h2>
          <p className="text-app-text-secondary mb-4">This gig may have been removed or doesn&apos;t exist.</p>
          <button onClick={() => router.push('/app')} className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-app-surface-raised">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left */}
          <div className="lg:col-span-2 space-y-6">
            {/* ─── Status Timeline ─── */}
            <ErrorBoundary>
              <GigTimeline
                gig={gig}
                isMyGig={isMyGig}
                iAmWorker={iAmWorker}
                onAction={(action) => {
                  switch (action) {
                    case 'start_work': completionRef.current?.startWork(); break;
                    case 'mark_complete': completionRef.current?.markCompleted(); break;
                    case 'confirm_complete': completionRef.current?.confirmCompletion(); break;
                    case 'cancel': completionRef.current?.openCancelModal(); break;
                    case 'message': handleOpenGigChat(); break;
                    case 'leave_review': router.push(`/app/gigs/${gigId}/review`); break;
                  }
                }}
              />
            </ErrorBoundary>

            <div>
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-3xl font-bold text-app-text mb-2">{gig.title}</h1>
                <GigHeader
                  gigId={gigId}
                  isOwner={isMyGig}
                  currentUserId={currentUserId}
                  initialSaved={Boolean(gig?.viewer_has_saved)}
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-app-text-secondary">
                <span>Posted {gigCreatedAt ? timeAgo(gigCreatedAt) : 'recently'}</span>
                <span>•</span>
                <span className="font-medium text-primary-600">{gig.category || 'General'}</span>
              </div>
            </div>

            <div className="bg-app-surface rounded-xl p-6 border border-app-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-app-text-secondary mb-1">
                    {payTypeIsOffers ? 'Open to offers' : 'Budget'}
                  </p>
                  {payTypeIsOffers && aiBudgetRange ? (
                    <>
                      <p className="text-3xl font-bold text-green-600">
                        ${aiBudgetRange.min}<span className="text-xl"> – ${aiBudgetRange.max}</span>
                      </p>
                      <p className="mt-1 text-xs text-app-text-secondary">Suggested range · helpers may bid</p>
                    </>
                  ) : (
                    <p className="text-3xl font-bold text-green-600">
                      ${budget}
                      {budgetMax && budgetMax !== budget && <span className="text-xl"> - ${budgetMax}</span>}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-app-text-secondary mb-1">Type</p>
                  <p className="text-lg font-semibold text-app-text capitalize">{gig.gig_type?.replace('_', ' ') || 'One Time'}</p>
                </div>
              </div>
              {/* Payment status badge */}
              {paymentStatusFromGig !== 'none' && (
                <div className="mt-3 pt-3 border-t border-app-border-subtle flex items-center gap-2">
                  <span className="text-xs text-app-text-secondary">Payment:</span>
                  <PaymentStatusBadge status={paymentStatusFromGig} />
                </div>
              )}
            </div>

            <div className="bg-app-surface rounded-xl p-6 border border-app-border">
              <h2 className="text-xl font-semibold text-app-text mb-4">Description</h2>
              <p className="text-app-text-strong whitespace-pre-wrap leading-relaxed">{gig.description}</p>
            </div>

            {/* ─── Media Gallery ─── */}
            {allMediaUrls.length > 0 && (
              <div className="bg-app-surface rounded-xl p-6 border border-app-border">
                <h2 className="text-xl font-semibold text-app-text mb-4">
                  Media <span className="text-sm font-normal text-app-text-secondary">({allMediaUrls.length})</span>
                </h2>

                {imageMedia.length > 0 && (
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {imageMedia.map((m, i) => (
                      <button
                        key={m.url}
                        type="button"
                        onClick={() => setLightboxIndex(i)}
                        className="relative aspect-square rounded-lg overflow-hidden border border-app-border hover:border-primary-400 hover:shadow-md transition group focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <Image
                          src={m.url}
                          alt={m.name}
                          fill
                          sizes="(max-width: 768px) 33vw, 200px"
                          className="object-cover group-hover:scale-105 transition-transform duration-200"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          quality={80}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition" />
                      </button>
                    ))}
                  </div>
                )}

                {documentMedia.length > 0 && (
                  <div className="space-y-2">
                    {documentMedia.map((m) => (
                      <a
                        key={m.url}
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg border border-app-border hover:bg-app-hover transition"
                      >
                        <span className="text-2xl"><FileText className="w-6 h-6 inline-block" /></span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-app-text truncate">{m.name}</p>
                          <p className="text-xs text-app-text-secondary">Click to open</p>
                        </div>
                        <span className="text-app-text-muted text-sm">↗</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {mediaLoading && allMediaUrls.length === 0 && (
              <div className="bg-app-surface rounded-xl p-6 border border-app-border">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-app-border border-t-gray-600" />
                  <span className="text-sm text-app-text-secondary">Loading media...</span>
                </div>
              </div>
            )}

            <div className="bg-app-surface rounded-xl p-6 border border-app-border">
              <h2 className="text-xl font-semibold text-app-text mb-4">Details</h2>
              <div className="space-y-3">
                {(() => {
                  // Format location nicely. Owners always see the full address;
                  // others see it only after they're accepted (gig.locationUnlocked is set
                  // by the backend's resolveGigPrecision when assignment happens).
                  const canSeeExactAddress = isMyGig || iAmWorker || Boolean(gig.locationUnlocked);
                  const exactParts = [
                    gig.exact_address,
                    gig.exact_city,
                    [gig.exact_state, gig.exact_zip].filter(Boolean).join(' '),
                  ].filter(Boolean);
                  const exactLabel = exactParts.join(', ');

                  // Owner / assigned helper: full address with a small "shared with helper" hint
                  // so the owner remembers the helper will see this once accepted.
                  if (canSeeExactAddress && exactLabel) {
                    return (
                      <div className="py-2 border-b border-app-border-subtle last:border-0">
                        <div className="flex justify-between items-start gap-3">
                          <span className="text-sm text-app-text-secondary">Address</span>
                          <span className="text-sm font-medium text-app-text text-right">{exactLabel}</span>
                        </div>
                        {isMyGig && (
                          <p className="mt-1 text-xs text-app-text-secondary">
                            🔒 Only visible to you and the helper you accept.
                          </p>
                        )}
                      </div>
                    );
                  }

                  // Public viewer: show only the area + a lock indicator so it's obvious
                  // the precise address is intentionally hidden, not missing.
                  const originMode = (gig.origin_mode || gig.location_type || '').toString();
                  const area = gig.exact_city || gig.approx_city;
                  const areaLabel = area
                    ? `${area}${gig.exact_state ? `, ${gig.exact_state}` : ''}`
                    : 'your area';
                  const originLabel =
                    originMode === 'home' ? `Near ${areaLabel}` :
                    originMode === 'current' ? `Near ${areaLabel}` :
                    originMode === 'address' ? `Near ${areaLabel}` :
                    originMode === 'map_pin' ? `Near ${areaLabel}` :
                    'In Person';
                  return (
                    <div className="py-2 border-b border-app-border-subtle last:border-0">
                      <div className="flex justify-between items-start gap-3">
                        <span className="text-sm text-app-text-secondary">Location</span>
                        <span className="text-sm font-medium text-app-text text-right">{originLabel}</span>
                      </div>
                      <p className="mt-1 text-xs text-app-text-secondary">
                        🔒 Exact address hidden — revealed to the helper once the poster accepts.
                      </p>
                    </div>
                  );
                })()}

                {/* Mini map — shows exact pin for owner/assigned, ~500m approximation circle for others.
                    Interactive: scroll to zoom, drag to pan, +/− buttons in the corner. */}
                {(() => {
                  const lat = Number(gig.latitude ?? gig.location?.latitude);
                  const lng = Number(gig.longitude ?? gig.location?.longitude);
                  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                  const canSeeExactAddress = isMyGig || iAmWorker || Boolean(gig.locationUnlocked);
                  return (
                    <div className="py-2">
                      <div className="h-64 w-full rounded-xl overflow-hidden border border-app-border">
                        <MiniMap lat={lat} lng={lng} isApprox={!canSeeExactAddress} />
                      </div>
                      <p className="mt-1 text-xs text-app-text-secondary">
                        {canSeeExactAddress
                          ? 'Drag to pan · scroll to zoom.'
                          : 'Approximate area — the blue circle covers ~500m around the actual location. Drag to pan · scroll to zoom.'}
                      </p>
                    </div>
                  );
                })()}

                {gig.scheduled_start && (
                  <DetailRow
                    label="Scheduled for"
                    value={new Date(gig.scheduled_start).toLocaleString('en-US', {
                      weekday: 'short',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  />
                )}

                {gig.deadline && (
                  <DetailRow
                    label="Deadline"
                    value={new Date(gig.deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  />
                )}
                {gig.estimated_duration && <DetailRow label="Estimated Duration" value={`${gig.estimated_duration} hours`} />}
                {gig.cancellation_policy && (
                  <div className="py-2 border-b border-app-border-subtle last:border-0">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-app-text-secondary">Cancel Policy</span>
                      <span className="text-sm font-medium text-app-text capitalize">
                        {
                          (() => {
                            const policy = gig.cancellation_policy;
                            if (policy === 'flexible') return <><CircleDot className="w-3 h-3 inline-block text-green-500" /> Flexible</>;
                            if (policy === 'standard') return <><CircleDot className="w-3 h-3 inline-block text-yellow-500" /> Standard</>;
                            if (policy === 'strict') return <><CircleDot className="w-3 h-3 inline-block text-red-500" /> Strict</>;
                            return policy;
                          })()
                        }
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-app-text-secondary">
                      {
                        ({
                          flexible: 'Free cancellation anytime before work starts.',
                          standard: 'Free within 1 hour of acceptance. 5% fee after.',
                          strict: '10% fee after acceptance. 50% after work starts.',
                        } as Record<string, string>)[gig.cancellation_policy] || ''
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ─── Q&A Section ─── */}
            <ErrorBoundary>
              <QASection gigId={gigId} isMyGig={isMyGig} currentUserId={currentUserId} />
            </ErrorBoundary>

            {/* ─── Change Orders Section ─── */}
            {(isAssigned || isInProgress) && (isMyGig || iAmWorker) && (
              <ErrorBoundary>
                <ChangeOrdersSection gigId={gigId} isMyGig={isMyGig} iAmWorker={iAmWorker} currentUserId={currentUserId} />
              </ErrorBoundary>
            )}
          </div>

          {/* Right */}
          <div className="space-y-6">
            <div className="bg-app-surface rounded-xl p-6 border border-app-border">
              <h3 className="text-sm font-medium text-app-text-secondary mb-4">Posted by</h3>
              <div className="flex items-center gap-3 mb-4">
                {posterAvatar ? (
                  // Native img: avatars may come from any storage host without Next image remotePatterns churn.
                  <img
                    src={posterAvatar}
                    alt={posterDisplayName}
                    width={48}
                    height={48}
                    className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-app-border-subtle"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-purple-500 text-lg font-semibold text-white">
                    {posterInitial}
                  </div>
                )}
                <div>
                  {isAnonymousPoster ? (
                    <p className="font-semibold text-app-text">{posterDisplayName}</p>
                  ) : (
                    <UserIdentityLink
                      userId={posterUserId}
                      username={posterUsername}
                      displayName={posterDisplayName}
                      avatarUrl={posterAvatar}
                      city={poster?.city}
                      state={poster?.state}
                      textClassName="font-semibold text-app-text hover:underline"
                    />
                  )}
                  <p className="text-sm text-app-text-secondary">Member since 2026</p>
                </div>
              </div>
              <button
                onClick={handleOpenGigChat}
                className="w-full bg-app-surface-sunken text-app-text-strong py-2 rounded-lg hover:bg-app-hover font-medium"
              >
                Send Message
              </button>
            </div>

            {/* Completion/cancellation/worker/owner panels */}
            <ErrorBoundary>
              <CompletionFlow
                ref={completionRef}
                gigId={gigId}
                gig={gig as any}
                isOwner={isMyGig}
                isWorker={iAmWorker}
                currentUserId={currentUserId}
                gigStatus={gigStatus}
                paymentLifecycleStatus={paymentStatusFromGig}
                onStatusChange={handleRefresh}
                onOpenChat={handleOpenGigChat}
              />
            </ErrorBoundary>

            {/* Payment breakdown (owner and worker) */}
            <ErrorBoundary>
              <PaymentSection
                gigId={gigId}
                gigPrice={budget}
                isOwner={isMyGig}
                isWorker={iAmWorker}
                paymentStatusFromGig={paymentStatusFromGig}
              />
            </ErrorBoundary>

            {/* Offers panel (owner only) */}
            <ErrorBoundary>
              <OffersPanel
                gigId={gigId}
                gigStatus={gigStatus}
                gigPrice={budget}
                isOwner={isMyGig}
                paymentStatus={paymentStatusFromGig}
                onStatusChange={handleRefresh}
                onOpenChat={handleOpenGigChat}
                refreshKey={offersRefreshKey}
              />
            </ErrorBoundary>

            {/* Bid panel (non-owner only) */}
            <ErrorBoundary>
              <BidPanel
                gigId={gigId}
                gigStatus={gigStatus}
                gigPrice={budget}
                isOwner={isMyGig}
                currentUserId={currentUserId}
                onBidChange={handleRefresh}
                onOpenChat={handleOpenGigChat}
              />
            </ErrorBoundary>

            <div className="bg-yellow-50 rounded-xl p-6 border border-yellow-200">
              <h3 className="text-sm font-semibold text-yellow-900 mb-2"><Lock className="w-4 h-4 inline-block" /> Safety Tips</h3>
              <ul className="text-xs text-yellow-800 space-y-1">
                <li>• Meet in public places</li>
                <li>• Don&apos;t share personal info</li>
                <li>• Use in-app payments</li>
                <li>• Report suspicious activity</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* ─── Media Lightbox ─── */}
      {lightboxIndex !== null && imageMedia.length > 0 && (
        <MediaLightbox
          images={imageMedia}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}
