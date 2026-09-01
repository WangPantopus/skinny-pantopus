'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';
import { useBadges } from '@/contexts/BadgeContext';

// Import existing web gig-detail components
import GigHeader from '@/components/gig-detail/GigHeader';
import GigTimeline from '@/components/gig-detail/GigTimeline';
import BidPanel from '@/components/gig-detail/BidPanel';
import OffersPanel from '@/components/gig-detail/OffersPanel';
import CompletionFlow, { type CompletionFlowHandle } from '@/components/gig-detail/CompletionFlow';
import PaymentSection from '@/components/gig-detail/PaymentSection';
import QASection from '@/components/gig-detail/QASection';
import ChangeOrdersSection from '@/components/gig-detail/ChangeOrdersSection';
import DetailRow from '@/components/gig-detail/DetailRow';

// V2 components (extracted from inline)
import OffersPanelV2Comp from '@/components/gig-detail-v2/OffersPanelV2';
import InstantAcceptButtonComp from '@/components/gig-detail-v2/InstantAcceptButton';
import ETATrackerComp from '@/components/gig-detail-v2/ETATracker';
import ActiveTaskPanel from '@/components/gig-detail-v2/ActiveTaskPanel';

// ─── Lazy Leaflet ────────────────────────────────────────────────────

const MiniMap = dynamic(
  () =>
    import('react-leaflet').then(({ MapContainer, TileLayer, Marker }) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const L = require('leaflet') as typeof import('leaflet');
      const icon = new L.Icon({
        iconUrl: '/leaflet/marker-icon.png',
        iconRetinaUrl: '/leaflet/marker-icon-2x.png',
        shadowUrl: '/leaflet/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });
      return function MiniMapInner({ lat, lng }: { lat: number; lng: number }) {
        return (
          <MapContainer
            center={[lat, lng]}
            zoom={14}
            scrollWheelZoom={false}
            dragging={false}
            zoomControl={false}
            attributionControl={false}
            style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[lat, lng]} icon={icon} />
          </MapContainer>
        );
      };
    }),
  { ssr: false }
);

// ─── Constants ───────────────────────────────────────────────────────

const ENGAGEMENT_LABELS: Record<string, { icon: string; label: string }> = {
  instant_accept: { icon: '⚡', label: 'Instant Accept' },
  curated_offers: { icon: '📋', label: 'Offers' },
  quotes: { icon: '💼', label: 'Quotes' },
};

const formatUsd = (amount: number): string => `$${amount.toFixed(2)}`;

// ─── Trust Capsule ───────────────────────────────────────────────────

function TrustCapsule({
  verified,
  rating,
  reviewCount,
  reliabilityScore,
  gigsCompleted,
  distanceMiles,
  isRecommended,
}: {
  verified: boolean;
  rating: number | null;
  reviewCount: number;
  reliabilityScore: number;
  gigsCompleted: number;
  distanceMiles?: number;
  isRecommended?: boolean;
}) {
  return (
    <div className="relative bg-gray-100 rounded-lg px-3 py-2">
      {isRecommended && (
        <span className="absolute -top-2 right-2 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
          Best Match
        </span>
      )}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
        {verified && (
          <span className="flex items-center gap-1 text-green-600 font-semibold">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Verified
          </span>
        )}
        {rating != null && (
          <span className="font-medium">⭐ {rating.toFixed(1)} ({reviewCount})</span>
        )}
        <span className="font-medium">✓ {Math.round(reliabilityScore)}% reliable</span>
        <span className="font-medium">{gigsCompleted} gigs done</span>
        {distanceMiles != null && (
          <span className="font-medium">{distanceMiles.toFixed(1)} mi away</span>
        )}
      </div>
    </div>
  );
}

// ─── Offer Card V2 ──────────────────────────────────────────────────

function OfferCardV2({
  offer,
  onAccept,
  onDecline,
}: {
  offer: any;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const user = offer.user || offer.bidder || {};
  const trust = offer.trust_capsule || {};
  const isRecommended = offer.is_recommended || offer.match_rank === 1;
  const displayName = user.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : user.name || user.username || 'Helper';

  return (
    <div className={`bg-white rounded-xl border p-4 space-y-3 ${isRecommended ? 'border-l-4 border-l-green-500 border-gray-200' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {user.profile_picture_url ? (
            <Image
              src={user.profile_picture_url}
              alt={displayName}
              width={36}
              height={36}
              className="rounded-full object-cover"
              sizes="36px"
              quality={75}
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-700">
              {(displayName[0] || '?').toUpperCase()}
            </div>
          )}
          <span className="font-semibold text-gray-900 truncate">{displayName}</span>
        </div>
        <span className="text-lg font-bold text-gray-900">
          ${Number(offer.amount || offer.price || 0).toFixed(0)}
        </span>
      </div>

      <TrustCapsule
        verified={trust.verified ?? user.verified ?? false}
        rating={trust.average_rating ?? user.average_rating ?? null}
        reviewCount={trust.review_count ?? user.review_count ?? 0}
        reliabilityScore={trust.reliability_score ?? user.reliability_score ?? 0}
        gigsCompleted={trust.gigs_completed ?? user.gigs_completed ?? 0}
        distanceMiles={trust.distance_miles ?? offer.distance_miles}
        isRecommended={isRecommended}
      />

      {offer.message && (
        <p className="text-sm text-gray-500 line-clamp-2">{offer.message}</p>
      )}

      <div className="flex items-center gap-4">
        <button
          onClick={() => onAccept(offer.id)}
          className="px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
        >
          Accept
        </button>
        <button
          onClick={() => onDecline(offer.id)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Decline
        </button>
      </div>
    </div>
  );
}

// ─── Offers Panel V2 ────────────────────────────────────────────────

function OffersPanelV2({
  offers,
  gig,
  onAcceptOffer,
  onDeclineOffer,
  loading,
}: {
  offers: any[];
  gig: any;
  onAcceptOffer: (id: string) => void;
  onDeclineOffer: (id: string) => void;
  loading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (gig.engagement_mode === 'instant_accept') return null;

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin h-6 w-6 border-2 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 font-medium">Waiting for offers</p>
        <div className="flex justify-center gap-1.5 mt-2">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-pulse" />
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse delay-75" />
          <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-pulse delay-150" />
        </div>
      </div>
    );
  }

  const sorted = [...offers].sort((a, b) => (a.match_rank ?? 999) - (b.match_rank ?? 999));
  const visible = expanded ? sorted : sorted.slice(0, 3);
  const remaining = sorted.length - 3;

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-gray-900">
        {gig.engagement_mode === 'quotes' ? 'Quotes' : 'Offers'} ({sorted.length})
      </h3>
      <div className="space-y-3">
        {visible.map(offer => (
          <OfferCardV2
            key={offer.id}
            offer={offer}
            onAccept={onAcceptOffer}
            onDecline={onDeclineOffer}
          />
        ))}
      </div>
      {remaining > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mx-auto block px-4 py-2 text-sm font-semibold text-primary-600 border border-primary-500 rounded-full hover:bg-primary-50 transition-colors"
        >
          {expanded ? 'Show less' : `See more offers (${remaining})`}
        </button>
      )}
    </div>
  );
}

// ─── Instant Accept Button ──────────────────────────────────────────

function InstantAcceptButton({
  gigId,
  onAccepted,
}: {
  gigId: string;
  onAccepted: () => void;
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handlePress = async () => {
    if (state !== 'idle') return;
    setState('loading');
    setErrorMsg('');
    try {
      const resp = await api.gigs.instantAccept(gigId);
      setState('success');
      if (resp?.requiresPaymentSetup) {
        toast.success("You're assigned! Waiting for the task owner to finish payment authorization.");
      } else {
        toast.success("You're assigned!");
      }
      setTimeout(onAccepted, 800);
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      if (status === 409) {
        setErrorMsg('This task was just taken by someone else');
        toast.warning('This task was just taken by someone else');
      } else if (status === 403) {
        setErrorMsg('Set up your wallet to accept tasks');
        toast.error('Set up your wallet to accept tasks');
      } else {
        setErrorMsg(err?.message || 'Something went wrong');
      }
      setState('error');
    }
  };

  if (state === 'success') {
    return (
      <div className="bg-green-500 text-white text-center py-4 rounded-xl font-bold text-lg animate-pulse">
        ✓ You're assigned!
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handlePress}
        disabled={state === 'loading'}
        className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
      >
        {state === 'loading' ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
            Accepting…
          </span>
        ) : (
          'I Can Help! 🤝'
        )}
      </button>
      {errorMsg && <p className="text-red-600 text-sm text-center mt-2">{errorMsg}</p>}
    </div>
  );
}

// ─── ETA Tracker ────────────────────────────────────────────────────

function ETATracker({ gig, socket }: { gig: any; socket: any }) {
  const [eta, setEta] = useState<number | null>(gig.helper_eta_minutes ?? null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(gig.helper_location_updated_at ?? null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!socket || !gig.id) return;
    const onEtaUpdate = (data: any) => {
      if (data.eta_minutes != null) setEta(data.eta_minutes);
      setLastUpdated(new Date().toISOString());
    };
    socket.on('gig:eta-update', onEtaUpdate);
    return () => { socket.off('gig:eta-update', onEtaUpdate); };
  }, [socket, gig.id]);

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const result = await api.gigs.shareGigStatus(gig.id);
      await navigator.clipboard.writeText(result.share_url);
      toast.success('Link copied!');
    } catch {
      toast.error('Failed to generate share link');
    } finally {
      setSharing(false);
    }
  };

  const staleMins = lastUpdated
    ? Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 60000)
    : null;
  const isStale = staleMins != null && staleMins > 5;

  if (gig.status !== 'assigned' && gig.status !== 'in_progress') return null;

  return (
    <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-gray-900">
            {eta != null
              ? `Helper is on the way — ETA: ~${eta} min`
              : 'Helper accepted — waiting for location update'}
          </p>
          {isStale && (
            <p className="text-xs text-gray-400 mt-0.5">Last updated {staleMins} min ago</p>
          )}
        </div>
      </div>
      <button
        onClick={handleShare}
        disabled={sharing}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-primary-600 border border-primary-300 bg-white rounded-full hover:bg-primary-50 disabled:opacity-50"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        {sharing ? 'Sharing…' : 'Share Status'}
      </button>
    </div>
  );
}

// ─── Main Page Content ──────────────────────────────────────────────

function GigDetailV2Content() {
  const router = useRouter();
  const { id: gigId } = useParams<{ id: string }>();
  const { socket } = useBadges();

  const completionFlowRef = useRef<CompletionFlowHandle>(null);

  // State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [gig, setGig] = useState<any>(null);
  const [offersV2, setOffersV2] = useState<any[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gigPayment, setGigPayment] = useState<any>(null);
  const [gigMedia, setGigMedia] = useState<any[]>([]);

  // Derived
  const currentUserId = currentUser?.id;
  const isMyGig = Boolean(
    currentUserId &&
    (gig?.user_id === currentUserId || gig?.poster_id === currentUserId || gig?.poster_user_id === currentUserId)
  );
  const acceptedBy = gig?.accepted_by || gig?.acceptedBy?.id || gig?.accepted_bid?.bidder_id || gig?.worker_id;
  const iAmWorker = Boolean(currentUserId && String(acceptedBy) === String(currentUserId));
  const gigStatus = gig?.status || '';
  const engagementMode = gig?.engagement_mode || 'curated_offers';
  const paymentStatus = (() => {
    const v = gigPayment?.payment_status ?? gigPayment?.status ?? gig?.payment_status;
    return typeof v === 'string' ? v : null;
  })();

  // ── Data loading ──

  const loadCurrentUser = useCallback(async () => {
    try {
      const res = await api.users.getMyProfile();
      setCurrentUser(res);
    } catch { /* not critical */ }
  }, []);

  const loadGig = useCallback(async () => {
    if (!gigId) return;
    try {
      const result = await api.gigs.getGigById(gigId);
      setGig(result || null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load task');
    }
  }, [gigId]);

  const loadOffers = useCallback(async () => {
    if (!gigId || !currentUserId) return;
    // Only owner sees offers
    if (!isMyGig) return;
    setOffersLoading(true);
    try {
      const res = await api.gigs.getGigOffersV2(gigId);
      setOffersV2(res?.offers || []);
    } catch {
      // Fallback: legacy bids
      try {
        const bidsRes = await api.gigs.getGigBids(gigId);
        setOffersV2((bidsRes as any)?.bids || []);
      } catch { /* ignore */ }
    } finally {
      setOffersLoading(false);
    }
  }, [gigId, currentUserId, isMyGig]);

  const loadMedia = useCallback(async () => {
    if (!gigId) return;
    try {
      const res = await api.upload.getGigMedia(gigId);
      setGigMedia((res as any)?.media || []);
    } catch { setGigMedia([]); }
  }, [gigId]);

  const loadPayment = useCallback(async () => {
    if (!gigId) return;
    try {
      const res = await api.payments.getPaymentForGig(gigId);
      setGigPayment((res as any)?.payment || null);
    } catch { setGigPayment(null); }
  }, [gigId]);

  // Init
  useEffect(() => {
    const token = getAuthToken();
    if (!token) { router.push('/login'); return; }

    setLoading(true);
    Promise.all([loadCurrentUser(), loadGig(), loadMedia(), loadPayment()])
      .finally(() => setLoading(false));
  }, [loadCurrentUser, loadGig, loadMedia, loadPayment, router]);

  // Load offers after we know the user
  useEffect(() => {
    if (currentUserId && gig) loadOffers();
  }, [currentUserId, gig, loadOffers]);

  // Socket
  useEffect(() => {
    if (!gigId || !socket) return;
    socket.emit('gig:join', { gigId });

    const refresh = () => { loadGig(); loadPayment(); loadOffers(); };
    socket.on('gig:status-change', refresh);
    socket.on('gig:bid-update', () => { loadGig(); loadOffers(); });
    socket.on('gig:bid-accepted', refresh);
    socket.on('gig:payment-update', () => loadPayment());
    socket.on('gig:completion-update', refresh);
    socket.on('gig:qa-update', () => loadGig());

    return () => {
      socket.emit('gig:leave', { gigId });
      socket.off('gig:status-change', refresh);
      socket.off('gig:bid-update');
      socket.off('gig:bid-accepted', refresh);
      socket.off('gig:payment-update');
      socket.off('gig:completion-update', refresh);
      socket.off('gig:qa-update');
    };
  }, [gigId, socket, loadGig, loadPayment, loadOffers]);

  // Handlers
  const handleStatusChange = () => { loadGig(); loadPayment(); loadOffers(); };
  const handleOpenChat = async () => {
    if (!gigId) return;
    try {
      const res = await api.gigs.getGigChatRoom(gigId);
      if (res?.roomId) router.push(`/app/mailbox?roomId=${res.roomId}`);
    } catch { /* ignore */ }
  };
  const handleAcceptOffer = async (offerId: string) => {
    if (!gigId) return;
    const selectedOffer = offersV2.find((offer) => String(offer?.id) === String(offerId));
    const rawAmount = Number(selectedOffer?.amount ?? selectedOffer?.bid_amount ?? gig?.price ?? NaN);
    const amount = Number.isFinite(rawAmount) ? rawAmount : null;
    const confirmed = await confirmStore.open({
      title: amount != null && amount > 0 ? 'Authorize payment method?' : 'Accept this bid?',
      description:
        amount != null && amount > 0
          ? `Pantopus will place a temporary authorization hold of ${formatUsd(amount)}. You are charged only after you confirm the task is completed. If canceled per policy, the hold is released (or only applicable fees apply).`
          : 'This will assign the gig to this bidder.',
      confirmLabel: amount != null && amount > 0 ? 'Continue to Payment' : 'Accept',
      cancelLabel: amount != null && amount > 0 ? 'Not now' : 'Cancel',
      variant: 'primary',
    });
    if (!confirmed) return;
    try {
      const resp = await api.gigs.acceptBid(gigId, offerId);
      const payment = (resp as any)?.payment || {};
      const clientSecret = (resp as any)?.clientSecret || payment?.clientSecret || null;
      const setupIntentId = (resp as any)?.setupIntentId || payment?.setupIntentId || null;
      const isSetupIntent = Boolean((resp as any)?.isSetupIntent ?? setupIntentId);
      const requiresPaymentSetup = Boolean((resp as any)?.requiresPaymentSetup || clientSecret);

      if (requiresPaymentSetup && clientSecret && typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          `gig_payment_setup_${gigId}`,
          JSON.stringify({
            clientSecret,
            isSetupIntent,
            roomId: (resp as any)?.roomId || null,
            rollbackOnAbort: true,
          })
        );
        toast.info('Bid accepted. Complete payment authorization to continue.');
        router.push(`/app/gigs-v2/${gigId}?action=payment_setup`);
      }
      handleStatusChange();
    } catch (e: any) { toast.error(e?.message || 'Failed to accept offer'); }
  };
  const handleDeclineOffer = async (offerId: string) => {
    if (!gigId) return;
    try {
      await api.gigs.rejectBid(gigId, offerId);
      loadGig();
      loadOffers();
    } catch { /* ignore */ }
  };

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-3 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!gig) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-gray-500 text-lg">Task not found</p>
      </div>
    );
  }

  const engInfo = ENGAGEMENT_LABELS[engagementMode] || ENGAGEMENT_LABELS.curated_offers;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Left column (2/3) ── */}
        <div className="lg:col-span-2 space-y-6">
          <GigHeader
            gigId={gigId!}
            isOwner={isMyGig}
            currentUserId={currentUserId}
            initialSaved={Boolean(gig?.viewer_has_saved)}
          />

          {/* ── Gig info card ── */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
            <h1 className="text-2xl font-bold text-gray-900">{gig.title || 'Untitled Task'}</h1>
            {gig.description && (
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">{gig.description}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {gig.category && (
                <span className="px-3 py-1 rounded-full text-sm font-medium border border-primary-500 text-primary-600">
                  {gig.category}
                </span>
              )}
              {gig.schedule_type && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700 capitalize">
                  {gig.schedule_type === 'asap'
                    ? '⚡ Now'
                    : gig.schedule_type === 'scheduled' && gig.time_window_start
                    ? `🗓️ ${new Date(gig.time_window_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                    : gig.schedule_type === 'today'
                    ? '📅 Today'
                    : gig.schedule_type === 'flexible'
                    ? '🤷 Flexible'
                    : gig.schedule_type.replace(/_/g, ' ')}
                </span>
              )}
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                {gig.pay_type === 'offers'
                  ? 'Open to offers'
                  : gig.pay_type === 'hourly'
                  ? `$${Number(gig.price || 0)}/hr`
                  : `$${Number(gig.price || 0)}`}
              </span>
            </div>
            {(gig.exact_city || gig.exact_state || gig.approx_address) && (
              <p className="text-sm text-gray-500">
                📍 {[gig.exact_city, gig.exact_state].filter(Boolean).join(', ') || gig.approx_address}
              </p>
            )}
            {gig.locationUnlocked && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
                Address unlocked
              </span>
            )}
            {(() => {
              const lat = Number(gig.latitude ?? gig.location?.latitude);
              const lng = Number(gig.longitude ?? gig.location?.longitude);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
              return (
                <div className="h-48 w-full rounded-xl overflow-hidden border border-gray-200">
                  <MiniMap lat={lat} lng={lng} />
                </div>
              );
            })()}
          </div>

          {/* Engagement mode badge */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-primary-50 text-primary-700 border border-primary-200">
              {engInfo.icon} {engInfo.label}
            </span>
            {gigStatus && (
              <span className="inline-flex px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700 capitalize">
                {gigStatus.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          <GigTimeline
            gig={gig}
            isMyGig={isMyGig}
            iAmWorker={iAmWorker}
            onAction={handleStatusChange}
          />

          {/* Instant accept for non-owner helpers */}
          {engagementMode === 'instant_accept' && gigStatus === 'open' && !isMyGig && (
            <InstantAcceptButtonComp gigId={gigId!} onAccepted={handleStatusChange} />
          )}

          {/* ETA tracker when assigned */}
          {(gigStatus === 'assigned' || gigStatus === 'in_progress') && (
            <ETATrackerComp gig={gig} socket={socket} />
          )}

          {/* Active task panel for in-progress gigs */}
          {(gigStatus === 'assigned' || gigStatus === 'in_progress') && (isMyGig || iAmWorker) && (
            <ActiveTaskPanel
              gig={gig}
              isOwner={isMyGig}
              isWorker={iAmWorker}
              socket={socket}
              onOpenChat={handleOpenChat}
              onCancel={() => completionFlowRef.current?.openCancelModal()}
              onStatusChange={handleStatusChange}
            />
          )}

          <CompletionFlow
            ref={completionFlowRef}
            gigId={gigId!}
            gig={gig}
            isOwner={isMyGig}
            isWorker={iAmWorker}
            currentUserId={currentUserId}
            gigStatus={gigStatus}
            paymentLifecycleStatus={paymentStatus || 'none'}
            onStatusChange={handleStatusChange}
            onOpenChat={handleOpenChat}
          />

          <QASection
            gigId={gigId!}
            isMyGig={isMyGig}
            currentUserId={currentUserId}
          />

          <ChangeOrdersSection
            gigId={gigId!}
            isMyGig={isMyGig}
            iAmWorker={iAmWorker}
            currentUserId={currentUserId}
          />
        </div>

        {/* ── Right column (1/3) ── */}
        <div className="space-y-6">
          {/* Offers / Bids panel */}
          {(engagementMode === 'curated_offers' || engagementMode === 'quotes') && isMyGig && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <OffersPanelV2Comp
                offers={offersV2}
                gig={gig}
                onAcceptOffer={handleAcceptOffer}
                onDeclineOffer={handleDeclineOffer}
                loading={offersLoading}
              />
            </div>
          )}

          {(engagementMode === 'curated_offers' || engagementMode === 'quotes') && !isMyGig && (
            <BidPanel
              gigId={gigId!}
              gigStatus={gigStatus}
              gigPrice={Number(gig.price || 0)}
              isOwner={false}
              currentUserId={currentUserId}
              onBidChange={handleStatusChange}
              onOpenChat={handleOpenChat}
            />
          )}

          <PaymentSection
            gigId={gigId!}
            gigPrice={Number(gig.price || 0)}
            isOwner={isMyGig}
            isWorker={iAmWorker}
            paymentStatusFromGig={paymentStatus || 'none'}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Page Export ──────────────────────────────────────────────────────

export default function GigDetailV2Page() {
  return (
    <Suspense>
      <GigDetailV2Content />
    </Suspense>
  );
}
