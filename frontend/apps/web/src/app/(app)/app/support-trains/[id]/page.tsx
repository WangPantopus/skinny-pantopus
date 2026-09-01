'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { buildSupportTrainShareUrl } from '@pantopus/utils';
import { toast } from '@/components/ui/toast-store';
import {
  Calendar,
  Clock,
  Heart,
  MapPin,
  Share2,
  Settings,
  Users,
  ChefHat,
  ShoppingCart,
  Truck,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react';

// ============================================================
// SUPPORT TRAIN CAMPAIGN PAGE (Web)
// Three-column layout: Left info | Center tabs | Right admin
// ============================================================

type TabKey = 'needs' | 'details' | 'updates';

type OrganizerUser = {
  id?: string | null;
  username?: string | null;
  name?: string | null;
  profile_picture_url?: string | null;
};

type SupportTrainWithOrganizers = {
  organizers?: Array<{
    id?: string | null;
    role?: string | null;
    user?: OrganizerUser | null;
  }> | null;
};

type OwnerSignupRow = {
  key: string;
  slotDate: string;
  entries: Array<{
    reservation: any;
    slot: any;
  }>;
};

const ACTIVE_RESERVATION_STATUSES = new Set(['reserved', 'delivered', 'confirmed']);
const MODE_OPTIONS = [
  { key: 'cook', label: 'Home-cooked meal', flag: 'home_cooked_meals' },
  { key: 'takeout', label: 'Takeout / delivery', flag: 'takeout' },
  { key: 'groceries', label: 'Groceries', flag: 'groceries' },
];

function getOrganizerUser(
  train: SupportTrainWithOrganizers | null | undefined
): OrganizerUser | null {
  const organizers = Array.isArray(train?.organizers) ? train.organizers : [];
  const primary = organizers.find((organizer) => organizer?.role === 'primary');
  return primary?.user || organizers[0]?.user || null;
}

function displayOrganizerName(user: OrganizerUser | null | undefined): string {
  return user?.name || user?.username || 'Organizer';
}

function getProfileHref(user: OrganizerUser | null | undefined): string | null {
  if (typeof user?.username !== 'string' || !user.username.trim()) return null;
  return `/${encodeURIComponent(user.username.trim())}`;
}

function initialsForName(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function OrganizerAvatar({ user, name }: { user: OrganizerUser | null | undefined; name: string }) {
  if (user?.profile_picture_url) {
    return (
      // Native img keeps avatars working when storage hosts are not in Next image remotePatterns.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.profile_picture_url}
        alt=""
        className="w-9 h-9 rounded-full object-cover flex-shrink-0"
      />
    );
  }

  return (
    <span className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200 text-sm font-semibold flex items-center justify-center flex-shrink-0">
      {initialsForName(name)}
    </span>
  );
}

function OrganizerProfileChip({ user }: { user: OrganizerUser }) {
  const name = displayOrganizerName(user);
  const href = getProfileHref(user);
  const content = (
    <>
      <OrganizerAvatar user={user} name={name} />
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-app-text-muted">
          Organized by
        </span>
        <span className="block text-sm font-semibold text-app-text truncate">{name}</span>
      </span>
    </>
  );

  if (!href) {
    return (
      <div className="mt-3 inline-flex max-w-full items-center gap-3 rounded-full bg-app-surface-sunken px-3 py-2">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="mt-3 inline-flex max-w-full items-center gap-3 rounded-full bg-app-surface-sunken px-3 py-2 text-left transition hover:bg-app-surface"
      aria-label={`View ${name}'s public profile`}
    >
      {content}
    </Link>
  );
}

function formatOrganizerRole(role: string | null | undefined): string {
  if (role === 'primary') return 'Primary';
  if (role === 'co_organizer') return 'Co-organizer';
  return role ? role.replace(/_/g, ' ') : 'Organizer';
}

function OrganizerListItem({
  organizer,
}: {
  organizer: NonNullable<SupportTrainWithOrganizers['organizers']>[number];
}) {
  const user = organizer?.user || null;
  const name = displayOrganizerName(user);
  const href = getProfileHref(user);
  const roleLabel = formatOrganizerRole(organizer?.role);
  const content = (
    <>
      <OrganizerAvatar user={user} name={name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-app-text">{name}</span>
      </span>
      <span className="text-xs text-app-text-muted capitalize">{roleLabel}</span>
    </>
  );

  const className =
    'flex w-full items-center gap-3 rounded-lg px-1.5 py-2 text-left transition hover:bg-app-surface-sunken';

  if (!href) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link href={href} className={className} aria-label={`View ${name}'s public profile`}>
      {content}
    </Link>
  );
}

export default function SupportTrainDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reservationError, setReservationError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('needs');
  const [reserveSlot, setReserveSlot] = useState<any>(null);
  const [reserveMode, setReserveMode] = useState('');
  const [dishTitle, setDishTitle] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [estimatedArrivalTime, setEstimatedArrivalTime] = useState('');
  const [noteToRecipient, setNoteToRecipient] = useState('');
  const [reserving, setReserving] = useState(false);
  const [reserveError, setReserveError] = useState<string | null>(null);
  const needsSectionRef = useRef<HTMLDivElement | null>(null);

  const fetchData = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      router.push('/login');
      return;
    }
    try {
      const result = await api.supportTrains.getSupportTrain(id);
      setData(result);
      setError(null);
      setReservationError(null);
      if (result?.viewer_level === 'organizer') {
        try {
          const resData = await api.supportTrains.listReservations(id);
          setReservations(resData.reservations || []);
        } catch (err: any) {
          setReservations([]);
          setReservationError(err?.message || 'Failed to load signups');
        }
      } else {
        setReservations([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load');
      setReservations([]);
      setReservationError(null);
    }
  }, [id, router]);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <AlertTriangle className="w-12 h-12 text-app-text-muted mx-auto mb-4" />
        <p className="text-app-text-secondary mb-4">{error || 'Not found'}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  const slots = data.slots || [];
  const myReservationSlotIds = new Set(
    ((data.my_reservations || []) as any[])
      .map((reservation) => reservation?.slot_id || reservation?.slot?.id)
      .filter(Boolean)
  );
  const openSlots = slots.filter(
    (s: any) =>
      s.status === 'open' &&
      (s.filled_count ?? 0) < (s.capacity ?? 1) &&
      !myReservationSlotIds.has(s.id)
  );
  const updates = data.updates || [];
  const viewerLevel = data.viewer_level;
  const isOrganizer = viewerLevel === 'organizer';
  const ownerSignupRows = buildOwnerSignupRows(slots, reservations);
  const visibleSignupEntries = ownerSignupRows.flatMap((row) => row.entries);
  const signedDateKeys = new Set(ownerSignupRows.map((row) => row.slotDate));
  const openUnsignedSlots = openSlots.filter((slot: any) => !signedDateKeys.has(slotDateKey(slot)));
  const uniqueHelperCount = new Set(
    visibleSignupEntries.map(({ reservation }) => helperIdentity(reservation))
  ).size;
  const scheduledSlots = slots.filter((slot: any) => slot.status !== 'canceled');
  const totalDateCount = countUniqueSlotDates(scheduledSlots);
  const openDateCount = countUniqueSlotDates(openUnsignedSlots);
  const signedDateCount = ownerSignupRows.length;
  const needsCount = isOrganizer ? ownerSignupRows.length : openSlots.length;
  const organizerUser = getOrganizerUser(data);
  const scrollToNeeds = () => {
    window.setTimeout(() => {
      needsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const resetReserveForm = () => {
    setReserveSlot(null);
    setReserveMode('');
    setDishTitle('');
    setRestaurantName('');
    setEstimatedArrivalTime('');
    setNoteToRecipient('');
    setReserveError(null);
  };

  const openReserveFlowForSlot = (slot: any) => {
    if (isOrganizer) {
      setActiveTab('needs');
      scrollToNeeds();
      return;
    }
    const slotModes = getSlotContributionModes(data.support_modes, slot);
    if (slotModes.length === 0) {
      setActiveTab('needs');
      scrollToNeeds();
      toast.error('This slot does not have an available signup type.');
      return;
    }
    setReserveSlot(slot);
    setReserveMode(slotModes[0].key);
    setDishTitle('');
    setRestaurantName('');
    setEstimatedArrivalTime(slot.start_time || '');
    setNoteToRecipient('');
    setReserveError(null);
  };

  const handleTakeSlot = () => {
    if (isOrganizer) {
      setActiveTab('needs');
      scrollToNeeds();
      return;
    }

    if (openSlots.length === 0) {
      setActiveTab('needs');
      scrollToNeeds();
      toast.info('No open slots right now.');
      return;
    }

    if (openSlots.length === 1) {
      openReserveFlowForSlot(openSlots[0]);
      return;
    }

    setActiveTab('needs');
    scrollToNeeds();
    toast.info('Choose an open slot to sign up.');
  };

  const handleCopyLink = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(buildSupportTrainShareUrl(id));
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleReserve = async () => {
    if (!reserveSlot || !reserveMode) return;

    setReserving(true);
    setReserveError(null);
    try {
      await api.supportTrains.reserveSlot(id, reserveSlot.id, {
        contribution_mode: reserveMode as any,
        dish_title: dishTitle.trim() || null,
        restaurant_name: restaurantName.trim() || null,
        estimated_arrival_at: buildEstimatedArrivalISO(reserveSlot.slot_date, estimatedArrivalTime),
        note_to_recipient: noteToRecipient.trim() || null,
      });
      resetReserveForm();
      setActiveTab('needs');
      await fetchData();
      toast.success("You're signed up");
    } catch (err: any) {
      const message = getReservationErrorMessage(err);
      setReserveError(message);
      toast.error(message);
    } finally {
      setReserving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ── Left Column: Campaign Info ── */}
        <div className="lg:col-span-3 space-y-6">
          {/* Back */}
          <button
            onClick={() => router.push('/app/support-trains')}
            className="text-sm text-app-text-secondary hover:text-app-text transition flex items-center gap-1"
          >
            &larr; All Trains
          </button>

          {/* Title + Story */}
          <div>
            <h1 className="text-2xl font-bold text-app-text">{data.title}</h1>
            {organizerUser ? <OrganizerProfileChip user={organizerUser} /> : null}
            {data.recipient_summary && (
              <p className="text-sm text-app-text-secondary mt-1 italic">
                {data.recipient_summary}
              </p>
            )}
            {data.story && (
              <p className="text-sm text-app-text-secondary mt-3 leading-relaxed">{data.story}</p>
            )}
          </div>

          {/* Restriction chips */}
          <div className="flex flex-wrap gap-2">
            {(data.dietary_restrictions || []).map((r: string, i: number) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
              >
                <AlertTriangle className="w-3 h-3" />
                {r.replace(/_/g, ' ')}
              </span>
            ))}
            {(data.dietary_preferences || []).map((p: string, i: number) => (
              <span
                key={`p-${i}`}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                {p.replace(/_/g, ' ')}
              </span>
            ))}
            {data.household_size && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
                <Users className="w-3 h-3" />
                Family of {data.household_size}
              </span>
            )}
            {data.contactless_preferred && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
                Contactless
              </span>
            )}
            {data.preferred_dropoff_window?.start_time && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
                <Clock className="w-3 h-3" />
                {data.preferred_dropoff_window.start_time}
                {data.preferred_dropoff_window.end_time
                  ? ` - ${data.preferred_dropoff_window.end_time}`
                  : '+'}
              </span>
            )}
          </div>

          {/* Support modes */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">
              Support types
            </p>
            <div className="flex flex-wrap gap-2">
              {data.support_modes?.home_cooked_meals && <ModeBadge icon={ChefHat} label="Meals" />}
              {data.support_modes?.takeout && <ModeBadge icon={Truck} label="Takeout" />}
              {data.support_modes?.groceries && <ModeBadge icon={ShoppingCart} label="Groceries" />}
              {data.support_modes?.gift_funds && <ModeBadge icon={Heart} label="Gift Funds" />}
            </div>
          </div>

          {/* CTA buttons */}
          <div className="space-y-2">
            <button
              onClick={handleTakeSlot}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition"
            >
              {isOrganizer ? 'View signups' : 'Take a slot'}
            </button>
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-app-border rounded-lg text-sm text-app-text-secondary hover:bg-app-surface-sunken transition"
            >
              <Share2 className="w-4 h-4" />
              Copy link
            </button>
          </div>
        </div>

        {/* ── Center Column: Tabs ── */}
        <div ref={needsSectionRef} className="lg:col-span-6 scroll-mt-6">
          {/* Tab bar */}
          <div className="flex border-b border-app-border mb-6">
            {(['needs', 'details', 'updates'] as TabKey[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition ${
                  activeTab === tab
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-app-text-secondary hover:text-app-text'
                }`}
              >
                {tab === 'needs'
                  ? `${isOrganizer ? 'Signups' : 'Needs'} (${needsCount})`
                  : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Needs tab */}
          {activeTab === 'needs' && (
            <div className="space-y-3">
              {isOrganizer && reservationError ? (
                <div className="text-center py-16">
                  <AlertTriangle className="w-10 h-10 text-app-text-muted mx-auto mb-3" />
                  <p className="text-app-text-secondary">{reservationError}</p>
                  <button
                    onClick={fetchData}
                    className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition"
                  >
                    Retry
                  </button>
                </div>
              ) : isOrganizer ? (
                ownerSignupRows.length === 0 ? (
                  <div className="text-center py-16">
                    <Users className="w-10 h-10 text-app-text-muted mx-auto mb-3" />
                    <p className="text-app-text-secondary">No one has signed up yet</p>
                  </div>
                ) : (
                  ownerSignupRows.map((row) => <OwnerSignupCard key={row.key} row={row} />)
                )
              ) : openSlots.length === 0 ? (
                <div className="text-center py-16">
                  <Calendar className="w-10 h-10 text-app-text-muted mx-auto mb-3" />
                  <p className="text-app-text-secondary">No open slots right now</p>
                </div>
              ) : (
                openSlots.map((slot: any) => (
                  <SlotCard
                    key={slot.id}
                    slot={slot}
                    onSelect={() => openReserveFlowForSlot(slot)}
                  />
                ))
              )}
            </div>
          )}

          {/* Details tab */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              <DetailSection label="Dietary restrictions">
                {(data.dietary_restrictions || []).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {data.dietary_restrictions.map((r: string, i: number) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 capitalize"
                      >
                        {r.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-app-text-muted">None specified</p>
                )}
              </DetailSection>

              <DetailSection label="Household size">
                <p className="text-sm text-app-text">{data.household_size || 'Not specified'}</p>
              </DetailSection>

              <DetailSection label="Drop-off window">
                <p className="text-sm text-app-text">
                  {data.preferred_dropoff_window?.start_time
                    ? `${data.preferred_dropoff_window.start_time}${data.preferred_dropoff_window.end_time ? ' - ' + data.preferred_dropoff_window.end_time : '+'}`
                    : 'Not specified'}
                </p>
              </DetailSection>

              <DetailSection label="Contactless">
                <p className="text-sm text-app-text">{data.contactless_preferred ? 'Yes' : 'No'}</p>
              </DetailSection>

              {/* Address (privacy-gated) */}
              {viewerLevel !== 'viewer' && data.address && (
                <DetailSection label="Address">
                  <p className="text-sm text-app-text flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-app-text-muted" />
                    {data.address.address}
                    {data.address.unit_number ? ` ${data.address.unit_number}` : ''},{' '}
                    {data.address.city}, {data.address.state} {data.address.zip_code}
                  </p>
                </DetailSection>
              )}
              {viewerLevel === 'viewer' && data.coarse_location && (
                <DetailSection label="Location">
                  <p className="text-sm text-app-text">
                    {data.coarse_location.city}, {data.coarse_location.state}{' '}
                    {data.coarse_location.zip_code}
                  </p>
                  <p className="text-xs text-app-text-muted italic mt-1">
                    Exact address will appear after you sign up.
                  </p>
                </DetailSection>
              )}

              {viewerLevel !== 'viewer' && data.delivery_instructions && (
                <DetailSection label="Delivery instructions">
                  <p className="text-sm text-app-text">{data.delivery_instructions}</p>
                </DetailSection>
              )}
            </div>
          )}

          {/* Updates tab */}
          {activeTab === 'updates' && (
            <div className="space-y-4">
              {updates.length === 0 ? (
                <div className="text-center py-16">
                  <MessageSquare className="w-10 h-10 text-app-text-muted mx-auto mb-3" />
                  <p className="text-app-text-secondary">No updates yet</p>
                </div>
              ) : (
                updates.map((u: any) => (
                  <div
                    key={u.id}
                    className="bg-app-surface border border-app-border rounded-xl p-4"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-app-text">
                        {u.author?.name || 'Organizer'}
                      </span>
                      <span className="text-xs text-app-text-muted">
                        {formatTimeAgo(u.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-app-text leading-relaxed">{u.body}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ── Right Column: Organizer Panel ── */}
        {isOrganizer && (
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-app-surface border border-app-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-app-text mb-4">Quick Stats</h3>
              <div className="grid grid-cols-2 gap-3">
                <StatBox label="Dates" value={totalDateCount} />
                <StatBox label="Open" value={openDateCount} />
                <StatBox label="Signed" value={signedDateCount} />
                <StatBox
                  label="Helpers"
                  value={uniqueHelperCount}
                />
              </div>
              <div className="mt-3">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusBadgeClasses(data.status)}`}
                >
                  {data.status}
                </span>
              </div>
            </div>

            <button
              onClick={() => router.push(`/app/support-trains/${id}/manage`)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-app-surface border border-app-border rounded-xl text-sm font-medium text-app-text hover:bg-app-surface-sunken transition"
            >
              <Settings className="w-4 h-4" />
              Manage Train
            </button>

            <button
              onClick={() => router.push(`/app/support-trains/${id}/calendar`)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-app-surface border border-app-border rounded-xl text-sm font-medium text-app-text hover:bg-app-surface-sunken transition"
            >
              <Calendar className="w-4 h-4" />
              Calendar View
            </button>

            {/* Organizers */}
            <div className="bg-app-surface border border-app-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-app-text mb-3">Organizers</h3>
              {(data.organizers || []).map((o: any) => (
                <OrganizerListItem
                  key={o.id || o.user?.id || o.user?.username || o.role}
                  organizer={o}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      {reserveSlot ? (
        <ReserveSlotModal
          slot={reserveSlot}
          modes={getSlotContributionModes(data.support_modes, reserveSlot)}
          selectedMode={reserveMode}
          onSelectMode={setReserveMode}
          dishTitle={dishTitle}
          onDishTitleChange={setDishTitle}
          restaurantName={restaurantName}
          onRestaurantNameChange={setRestaurantName}
          estimatedArrivalTime={estimatedArrivalTime}
          onEstimatedArrivalTimeChange={setEstimatedArrivalTime}
          noteToRecipient={noteToRecipient}
          onNoteToRecipientChange={setNoteToRecipient}
          error={reserveError}
          submitting={reserving}
          onClose={resetReserveForm}
          onSubmit={handleReserve}
        />
      ) : null}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────

function SlotCard({ slot, onSelect }: { slot: any; onSelect: () => void }) {
  const date = new Date(slot.slot_date + 'T00:00:00Z');
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const ModeIcon =
    slot.support_mode === 'meal'
      ? ChefHat
      : slot.support_mode === 'groceries'
        ? ShoppingCart
        : Truck;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full flex items-center gap-4 p-4 rounded-xl border border-app-border bg-app-surface text-left hover:border-primary-300 dark:hover:border-primary-700 transition"
    >
      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary-50 dark:bg-primary-950/30">
        <ModeIcon className="w-5 h-5 text-primary-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-app-text">
          {slot.slot_label} — {dateStr}
        </p>
        {slot.start_time && (
          <p className="text-xs text-app-text-secondary mt-0.5">
            {slot.start_time}
            {slot.end_time ? ` - ${slot.end_time}` : '+'}
          </p>
        )}
      </div>
      <span className="px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg">
        Sign up
      </span>
    </button>
  );
}

function ReserveSlotModal({
  slot,
  modes,
  selectedMode,
  onSelectMode,
  dishTitle,
  onDishTitleChange,
  restaurantName,
  onRestaurantNameChange,
  estimatedArrivalTime,
  onEstimatedArrivalTimeChange,
  noteToRecipient,
  onNoteToRecipientChange,
  error,
  submitting,
  onClose,
  onSubmit,
}: {
  slot: any;
  modes: typeof MODE_OPTIONS;
  selectedMode: string;
  onSelectMode: (mode: string) => void;
  dishTitle: string;
  onDishTitleChange: (value: string) => void;
  restaurantName: string;
  onRestaurantNameChange: (value: string) => void;
  estimatedArrivalTime: string;
  onEstimatedArrivalTimeChange: (value: string) => void;
  noteToRecipient: string;
  onNoteToRecipientChange: (value: string) => void;
  error: string | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const date = new Date(slot.slot_date + 'T00:00:00Z');
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const canSubmit = !!selectedMode && !submitting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reserve-slot-title"
    >
      <div className="max-h-[calc(100vh-1rem)] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-app-border bg-app-surface p-5 shadow-xl sm:max-h-[calc(100vh-2rem)] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="reserve-slot-title" className="text-lg font-semibold text-app-text">
              Sign up for this slot
            </h2>
            <p className="mt-1 text-sm text-app-text-secondary">
              {slot.slot_label} on {dateStr}
              {slot.start_time ? `, ${slot.start_time}${slot.end_time ? ` - ${slot.end_time}` : '+'}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-app-text-muted hover:bg-app-surface-sunken"
          >
            Close
          </button>
        </div>

        <div className="mt-5 space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-app-text-muted">
              How will you help?
            </p>
            <div className="mt-2 grid gap-2">
              {modes.length > 0 ? (
                modes.map((mode) => (
                  <button
                    key={mode.key}
                    type="button"
                    onClick={() => onSelectMode(mode.key)}
                    className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                      selectedMode === mode.key
                        ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950/30 dark:text-primary-200'
                        : 'border-app-border text-app-text hover:bg-app-surface-sunken'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))
              ) : (
                <p className="rounded-xl border border-app-border bg-app-surface-sunken px-3 py-3 text-sm text-app-text-secondary">
                  No signup type is available for this slot.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-app-text">
              Dish
              <input
                value={dishTitle}
                onChange={(event) => onDishTitleChange(event.target.value)}
                placeholder="Chicken soup"
                className="mt-1 w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm outline-none focus:border-primary-500"
              />
            </label>
            <label className="text-sm font-medium text-app-text">
              Restaurant
              <input
                value={restaurantName}
                onChange={(event) => onRestaurantNameChange(event.target.value)}
                placeholder="Optional"
                className="mt-1 w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm outline-none focus:border-primary-500"
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-app-text">
            Estimated arrival
            <input
              type="time"
              value={estimatedArrivalTime}
              onChange={(event) => onEstimatedArrivalTimeChange(event.target.value)}
              className="mt-1 w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </label>

          <label className="block text-sm font-medium text-app-text">
            Note to recipient
            <textarea
              value={noteToRecipient}
              onChange={(event) => onNoteToRecipientChange(event.target.value)}
              rows={3}
              placeholder="Anything they should know?"
              className="mt-1 w-full resize-none rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </label>

          {error ? <p className="text-sm text-red-600 dark:text-red-300">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-app-border px-4 py-2 text-sm font-medium text-app-text-secondary hover:bg-app-surface-sunken"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Signing up...' : 'Confirm signup'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OwnerSignupCard({ row }: { row: OwnerSignupRow }) {
  const date = new Date(row.slotDate + 'T00:00:00Z');
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const slotSummaries = uniqueSlotSummaries(row.entries.map((entry) => entry.slot));

  return (
    <div className="flex items-start gap-4 p-4 rounded-xl border border-app-border bg-app-surface">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/30 flex-shrink-0">
        <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-app-text">{dateStr}</p>
            {slotSummaries.length > 0 && (
              <p className="text-xs text-app-text-secondary mt-0.5">
                {slotSummaries.join(', ')}
              </p>
            )}
          </div>
          <span className="w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
            {formatSignupCount(row.entries.length)}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {row.entries.map(({ reservation, slot }) => (
            <span
              key={reservation.id}
              className="rounded-full bg-app-surface-sunken px-3 py-1.5 text-xs font-medium text-app-text"
            >
              {helperDisplayName(reservation)}
              <span className="font-normal text-app-text-muted">
                {' '}
                · {formatSlotSummary(slot)}
                {reservation.contribution_mode
                  ? ` · ${formatContributionMode(reservation.contribution_mode)}`
                  : ''}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">
        {label}
      </p>
      {children}
    </div>
  );
}

function ModeBadge({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-app-surface-sunken text-app-text-secondary">
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

function buildOwnerSignupRows(slots: any[], reservations: any[]): OwnerSignupRow[] {
  const slotById = new Map<string, any>();
  for (const slot of slots || []) {
    if (slot?.id) slotById.set(slot.id, slot);
  }

  const groups = new Map<string, OwnerSignupRow>();

  for (const reservation of reservations || []) {
    if (!isActiveReservation(reservation)) continue;
    const slot = slotById.get(reservation?.slot_id);
    if (!slot) continue;

    const key = slotDateKey(slot);
    if (!key) continue;

    const existing = groups.get(key);
    if (existing) {
      existing.entries.push({ reservation, slot });
    } else {
      groups.set(key, { key, slotDate: key, entries: [{ reservation, slot }] });
    }
  }

  const rows = Array.from(groups.values()).sort((a, b) => a.slotDate.localeCompare(b.slotDate));
  for (const row of rows) {
    row.entries.sort((left, right) => compareSlots(left.slot, right.slot));
  }
  return rows;
}

function isActiveReservation(reservation: any): boolean {
  return ACTIVE_RESERVATION_STATUSES.has(String(reservation?.status || ''));
}

function slotDateKey(slot: any): string {
  return String(slot?.slot_date || '');
}

function countUniqueSlotDates(slots: any[]): number {
  return new Set((slots || []).map(slotDateKey).filter(Boolean)).size;
}

function compareSlots(left: any, right: any): number {
  const dateCompare = String(left?.slot_date || '').localeCompare(String(right?.slot_date || ''));
  if (dateCompare !== 0) return dateCompare;
  const timeCompare = String(left?.start_time || '').localeCompare(String(right?.start_time || ''));
  if (timeCompare !== 0) return timeCompare;
  return String(left?.slot_label || '').localeCompare(String(right?.slot_label || ''));
}

function uniqueSlotSummaries(slots: any[]): string[] {
  return Array.from(new Set((slots || []).map(formatSlotSummary).filter(Boolean)));
}

function formatSlotSummary(slot: any): string {
  const label = slot?.slot_label || formatContributionMode(slot?.support_mode || 'Support');
  if (!slot?.start_time) return label;
  return `${label} ${slot.start_time}${slot.end_time ? ` - ${slot.end_time}` : '+'}`;
}

function formatSignupCount(count: number): string {
  return `${count} ${count === 1 ? 'signup' : 'signups'}`;
}

function getAvailableContributionModes(supportModes: any): typeof MODE_OPTIONS {
  return MODE_OPTIONS.filter((mode) => supportModes?.[mode.flag]);
}

function getSlotContributionModes(supportModes: any, slot: any): typeof MODE_OPTIONS {
  const supportMode = String(slot?.support_mode || '').toLowerCase();
  const configuredModes = getAvailableContributionModes(supportModes);
  if (configuredModes.length > 0) return configuredModes;

  if (supportMode === 'groceries') return MODE_OPTIONS.filter((mode) => mode.key === 'groceries');
  if (supportMode === 'takeout') return MODE_OPTIONS.filter((mode) => mode.key === 'takeout');
  if (supportMode === 'meal' || supportMode === 'cook' || supportMode === 'home_cooked_meals') {
    return MODE_OPTIONS.filter((mode) => mode.key === 'cook');
  }
  return [];
}

function buildEstimatedArrivalISO(slotDate: string, time: string): string | null {
  if (!slotDate || !time) return null;
  const [year, month, day] = slotDate.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  if (!year || !month || !day || Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return new Date(year, month - 1, day, hours, minutes, 0, 0).toISOString();
}

function getReservationErrorMessage(err: any): string {
  const code = String(err?.data?.error || err?.message || '');
  if (code.includes('SLOT_FULL') || code.includes('SLOT_NOT_OPEN')) {
    return 'This slot was just filled. Please choose another open slot.';
  }
  if (code.includes('ALREADY_RESERVED')) {
    return 'You already have a reservation on this slot.';
  }
  if (code.includes('MODE_NOT_ENABLED')) {
    return 'That support type is not available for this train.';
  }
  return err?.message || 'Failed to reserve this slot. Please try again.';
}

function helperDisplayName(reservation: any): string {
  return (
    reservation?.user?.name ||
    reservation?.user?.username ||
    reservation?.guest_name ||
    reservation?.guest_email ||
    'Helper'
  );
}

function helperIdentity(reservation: any): string {
  return (
    reservation?.user?.id ||
    reservation?.user_id ||
    reservation?.guest_email ||
    reservation?.guest_name ||
    reservation?.id ||
    'helper'
  );
}

function formatContributionMode(mode: string): string {
  return mode.replace(/_/g, ' ');
}

function StatBox({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-app-surface-sunken rounded-lg p-3 text-center">
      <p className="text-xl font-bold text-app-text">{value}</p>
      <p className="text-xs text-app-text-muted mt-0.5">{label}</p>
    </div>
  );
}

function statusBadgeClasses(status: string): string {
  switch (status) {
    case 'draft':
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
    case 'published':
      return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200';
    case 'active':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200';
    case 'paused':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200';
    case 'completed':
      return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function formatTimeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 60000) return 'just now';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
