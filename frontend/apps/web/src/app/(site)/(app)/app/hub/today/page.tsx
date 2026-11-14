'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ChangeLocationModal from '@/components/hub/ChangeLocationModal';
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Calendar,
  CloudRain,
  Clock,
  CreditCard,
  Droplets,
  Leaf,
  Mail,
  MapPin,
  RefreshCw,
  Sparkles,
  Sun,
  Thermometer,
  Wind,
  Wrench,
} from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { queryKeys } from '@/lib/query-keys';
import { hubTodayQuery } from '@/lib/hubToday';
import { withoutLaunchCutTodayRows } from '@/lib/featureFlags';
import { resolveWebNotificationPath } from '@/lib/notificationRoutes';
import type { HubToday } from '@pantopus/types';
import BallotTodaySection, { useBallotToday } from '@/components/ballot/BallotTodaySection';
import { claimInReviewNote, claimsInReview, myClaimsQuery } from '@/lib/myHomes';
import { VerifyBanner } from '@/components/archetypes/place';
import TodayDetail from '@/components/place/detail/TodayDetail';
import SkyCard from '@/components/sky/SkyCard';
import type { TodaySkyInput } from '@/components/sky/todaySky';
import { claimWaitingLabel } from '@/components/homes/ClaimApprovalChecklist';
import { usePrimaryHome } from '@/lib/primaryHome';
import { PLACE_FRESH_MS, gatedStaleTime, useAfterRecheck } from '@/lib/householdCopy';
import { useHydrated } from '@/hooks/useHydrated';
import ChristmasCountdown from '@/components/mailbox/cards/ChristmasCountdown';
import SunCard from '@/components/sky/SunCard';
import { ADDRESS_FIRST_PATH, TodayAreaAddAddress, TodayAreaStart } from '@/components/hub/TodayAreaCards';
import { useMe } from '@/lib/me';
import {
  AREA_REREAD_MS,
  areaSunData,
  areaTodayQuery,
  briefingFromArea,
  locationAlreadyAllowed,
  readRoundedLocation,
  useHasNoPlace,
  useKeptArea,
} from '@/lib/todayArea';

// ── Icon helpers ─────────────────────────────────────────────────

function SignalIcon({ kind, className }: { kind: string; className?: string }) {
  const cls = className || 'w-4 h-4';
  switch (kind) {
    case 'alert': return <AlertTriangle className={cls} />;
    case 'weather': return <Sun className={cls} />;
    case 'precipitation': return <CloudRain className={cls} />;
    case 'aqi': return <Wind className={cls} />;
    case 'temperature': return <Thermometer className={cls} />;
    case 'bill_due': return <CreditCard className={cls} />;
    case 'task_due': return <Wrench className={cls} />;
    case 'calendar': return <Calendar className={cls} />;
    case 'mail': return <Mail className={cls} />;
    case 'gig': return <Briefcase className={cls} />;
    case 'seasonal': return <Leaf className={cls} />;
    case 'local_update': return <Sparkles className={cls} />;
    default: return <Sparkles className={cls} />;
  }
}

const URGENCY_BG: Record<string, string> = {
  critical: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40',
  high: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/40',
  medium: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40',
  low: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40',
};

const URGENCY_TEXT: Record<string, string> = {
  critical: 'text-red-700 dark:text-red-400',
  high: 'text-orange-700 dark:text-orange-400',
  medium: 'text-amber-700 dark:text-amber-400',
  low: 'text-blue-700 dark:text-blue-400',
};

// The footer names its sources the way the Place cards do, not by provider code.
const PROVIDER_NAMES: Record<string, string> = {
  OPEN_METEO: 'Open-Meteo',
  WEATHERKIT: 'Apple Weather',
  AIRNOW: 'AirNow (EPA)',
  NOAA: 'National Weather Service',
};
const SECTION_NAMES: Record<string, string> = { weather: 'weather', aqi: 'air quality', alerts: 'alerts' };

function freshnessLabel(fetchedAt: string): string {
  const mins = Math.round((Date.now() - new Date(fetchedAt).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

/** On a quiet day the summary is only the weather line ("Overcast."), which the card already shows. */
function repeatsCondition(summary: string, label?: string | null): boolean {
  const plain = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return !!label && plain(summary) === plain(label);
}

// Instant Screens contract §4: how old a shown briefing may be after a failed refresh before the
// page says so ("Couldn't refresh"), and how old its alerts may be before they show as unavailable.
const TODAY_MAX_SHOWN_MS = 2 * 60 * 60 * 1000;
const ALERTS_MAX_SHOWN_MS = 30 * 60 * 1000;

// ── Page ─────────────────────────────────────────────────────────

export default function HubTodayPage() {
  const router = useRouter();
  // The briefing's routes are the apps' (e.g. '/place/today', '/app/pulse'): open the web's page for each.
  const openRoute = (route: string) => {
    const to = resolveWebNotificationPath(route);
    if (to) router.push(to);
  };
  // /app/today is a tab (bottom bar, sidebar): nothing to go back to. The Back
  // arrow stays on /app/hub/today, which a card or the morning push opens.
  const isTab = usePathname() === '/app/today';
  const queryClient = useQueryClient();
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Times follow this browser's clock, time zone and locale: shown once hydrated,
  // so the server's first content (lib/firstContent.ts) hydrates as rendered.
  const hydrated = useHydrated();

  useEffect(() => {
    if (!mounted) return;
    if (!getAuthToken()) router.replace('/login?redirectTo=%2Fapp%2Fhub%2Ftoday');
  }, [router, mounted]);

  const hasToken = mounted && !!getAuthToken();

  const query = useQuery<HubToday | null>({
    ...hubTodayQuery(),
    enabled: hasToken,
  });

  // Ballot P0 (ballot_p0): read alongside the briefing, not after it; sends
  // nothing for a viewer who does not have the flag.
  const ballot = useBallotToday(hasToken);

  const today = query.data ? withoutLaunchCutTodayRows(query.data) : null;
  // No briefing yet, but a claim in review: say so, as the apps' Today does (a claim makes its Home
  // yours only once it's approved).
  const noBriefing = query.isSuccess && (!today || today.display_mode === 'hidden');
  const claims = useQuery({ ...myClaimsQuery(), enabled: hasToken && noBriefing });
  const claim = claimsInReview(claims.data)[0] ?? null;
  const claimNote = claim ? claimInReviewNote(claim, 'Today') : null;

  // Today before an address (TABCARD 4a): with no briefing, no Home, no saved address and no claim in review, Today
  // starts where you are. Its reads wait for the briefing to say there's no place, so a place's Today sends nothing more.
  const placeChecks = hasToken && noBriefing;
  const me = useMe({ enabled: placeChecks });
  const userId = me.data?.id ?? null;
  const places = useHasNoPlace(userId, placeChecks);
  const checkingPlaces = placeChecks && !claim && (me.isPending || places.checking);
  const noPlace = places.noPlace;
  // The area this browser keeps for you (rounded on the device); with one, Today shows its city.
  const [keptArea, keepArea] = useKeptArea(noPlace ? userId : null);
  const areaView = noPlace && !!keptArea;
  const areaQuery = useQuery({ ...areaTodayQuery(userId, keptArea), enabled: areaView });
  const areaBriefing = useMemo(() => (areaView && areaQuery.data ? briefingFromArea(areaQuery.data) : null), [areaView, areaQuery.data]);
  const areaSun = areaView ? areaSunData(areaQuery.data) : null;
  // The city's name, kept with the point.
  useEffect(() => {
    const area = areaQuery.data?.area;
    if (!areaView || !keptArea || !area || (keptArea.label === area.label && keptArea.city === area.city)) return;
    keepArea({ ...keptArea, label: area.label, city: area.city });
  }, [areaView, keptArea, areaQuery.data, keepArea]);
  // "Use my location": the browser's own question if it never asked, then a fix rounded here.
  const [readingLocation, setReadingLocation] = useState(false);
  const [locationOff, setLocationOff] = useState(false);
  const readLocation = async () => {
    if (!userId) return;
    setReadingLocation(true);
    setLocationOff(false);
    try {
      const point = await readRoundedLocation();
      keepArea({ ...point, label: null, city: null, read_at: new Date().toISOString() });
    } catch {
      setLocationOff(true);
    } finally {
      setReadingLocation(false);
    }
  };
  // An area over an hour old is read again quietly, only while the browser already allows it: never a question.
  const rereadArea = useRef<string | null>(null);
  useEffect(() => {
    if (!areaView || !keptArea || !userId) return;
    const age = Date.now() - Date.parse(keptArea.read_at);
    if (!(age > AREA_REREAD_MS)) return;
    const key = `${userId}:${keptArea.read_at}`;
    if (rereadArea.current === key) return;
    rereadArea.current = key;
    void (async () => {
      if (!(await locationAlreadyAllowed())) return;
      try {
        const point = await readRoundedLocation();
        const read_at = new Date().toISOString();
        const moved = point.latitude !== keptArea.latitude || point.longitude !== keptArea.longitude;
        keepArea(moved ? { ...point, label: null, city: null, read_at } : { ...keptArea, read_at });
      } catch { /* the kept area stays */ }
    })();
  }, [areaView, keptArea, userId, keepArea]);

  // The briefing shown: your place's, else your area's city, fed through the same page.
  const briefing = today && today.display_mode !== 'hidden' ? today : areaBriefing;
  // The Weather box's sky: the briefing's own weather, sun times and clock. The kind of home comes from your primary
  // home, which the page already holds (first content, or the shell's read), when the briefing is about that home.
  // Guests and service providers get the scene's first house, as on the apps, where the Your Home section isn't theirs.
  const primaryHome = usePrimaryHome({ enabled: false }).data?.home;
  const weather = briefing?.weather ?? null;
  const location = briefing?.location;
  const homeType = location?.source === 'primary_home' && primaryHome?.role_base !== 'guest' && primaryHome?.role_base !== 'service_provider'
    ? primaryHome?.home_type
    : null;
  const sky = useMemo<TodaySkyInput | null>(() => (weather ? {
    condition: weather.condition_code,
    tempF: weather.current_temp_f,
    sunrise: weather.sunrise_utc,
    sunset: weather.sunset_utc,
    timeZone: location?.timezone,
    homeType,
  } : null), [weather, location?.timezone, homeType]);
  // The claimed address's public Today (the server's view for an open claim) under the claim's status;
  // the Place page reads the same copy. A refusal (an older server, a closed Home) keeps the claim's note.
  const claimTodayQuery = useQuery({
    queryKey: claim ? queryKeys.placeIntelligence(claim.home_id) : ['place', 'intelligence', 'none'],
    queryFn: () => api.place.getPlaceIntelligence(claim?.home_id as string),
    enabled: hasToken && !!claim,
    staleTime: gatedStaleTime(PLACE_FRESH_MS, () => false),
  });
  const { data: claimToday, waiting: claimTodayWaiting } = useAfterRecheck(claimTodayQuery, () => false);
  const claimTodayPending = !!claim && claimToday === undefined && (claimTodayQuery.isPending || claimTodayWaiting);
  // The first frame shows what this tab already loaded; the skeleton only while nothing has been
  // (a fresh page load starts with an empty cache, like the server).
  // The area's city loads and fails like the briefing.
  const loading = (query.data === undefined && (!mounted || (query.isPending && hasToken)))
    || (areaView && areaQuery.data === undefined && areaQuery.isPending);
  // Only a briefing that never loaded shows the error. A failed refresh keeps the briefing
  // (contract §3) and says so once it is older than Today's max shown age (§4: 2 hours; alerts 30 minutes).
  const error = query.data === undefined && query.error instanceof Error
    ? query.error.message
    : areaView && areaQuery.data === undefined && areaQuery.isError ? 'Today’s briefing could not be loaded.' : '';
  const refreshFailed = query.isError && query.data !== undefined;
  const shownAge = Date.now() - query.dataUpdatedAt;
  const showStaleLine = refreshFailed && shownAge > TODAY_MAX_SHOWN_MS;
  const alertsUnavailable = refreshFailed && shownAge > ALERTS_MAX_SHOWN_MS;
  // Quiet refreshes show nothing; the icon turns only after a tap on Refresh.
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([query.refetch(), claim ? claimTodayQuery.refetch() : null, areaView ? areaQuery.refetch() : null]);
    } finally { setRefreshing(false); }
  };

  return (
    <div className="min-h-screen bg-app pb-16">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            {!isTab && (
              <button
                onClick={() => router.back()}
                className="p-1.5 hover:bg-app-hover rounded-lg transition"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5 text-app-text" />
              </button>
            )}
            <h1 className="text-xl font-bold text-app-text">Today</h1>
          </div>
          <button
            onClick={() => { void refresh(); }}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-sm text-app-text-secondary hover:text-app-text transition disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="rounded-2xl border border-app bg-surface dark:bg-surface-dark p-6 animate-pulse space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-surface-muted dark:bg-gray-700" />
              <div className="space-y-2 flex-1">
                <div className="h-5 bg-surface-muted dark:bg-gray-700 rounded w-24" />
                <div className="h-3 bg-surface-muted dark:bg-gray-700 rounded w-40" />
              </div>
            </div>
            <div className="h-4 bg-surface-muted dark:bg-gray-700 rounded w-full" />
            <div className="h-4 bg-surface-muted dark:bg-gray-700 rounded w-5/6" />
            <div className="h-20 bg-surface-muted dark:bg-gray-700 rounded" />
          </div>
        )}

        {/* A refresh failed and the briefing shown is older than its max shown age */}
        {!loading && showStaleLine && (
          <div className="mb-3 flex items-center justify-between gap-3 px-1 text-xs text-app-text-secondary" role="status">
            <span>Couldn’t refresh. Showing {new Date(query.dataUpdatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.</span>
            <button onClick={() => { void refresh(); }} disabled={refreshing} className="font-semibold text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50">
              Retry
            </button>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>{error || 'Could not load today’s briefing'}</span>
            </div>
            <button
              onClick={() => { void refresh(); }}
              className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* A claim in review: its address's Today, the claim's status on top */}
        {!loading && !error && (!today || today.display_mode === 'hidden') && claim && claimToday ? (
          <div className="space-y-4">
            <VerifyBanner
              icon={Clock}
              title={`Your claim is in review. ${claimWaitingLabel(claim)}.`}
              cta="Check claim status"
              onClick={() => router.push('/app/homes')}
            />
            <TodayDetail intelligence={claimToday} embedded />
          </div>
        ) : null}

        {/* Empty; with no place at all, Today starts where you are (TABCARD 4a) */}
        {!loading && !error && (!today || today.display_mode === 'hidden') && !(claim && claimToday) && !areaView && (
          <div className="space-y-4">
            {noPlace ? (
              <TodayAreaStart
                reading={readingLocation}
                denied={locationOff}
                onUseLocation={() => { void readLocation(); }}
                onTypeAddress={() => router.push(ADDRESS_FIRST_PATH)}
              />
            ) : (
              <div className="rounded-xl border border-app bg-surface dark:bg-surface-dark p-8 text-center">
                {/* Wait for the claims and your places, so "No briefing" doesn't flash before a claim in review or the start card. */}
                {claims.isPending || claimTodayPending || checkingPlaces ? (
                  <p className="text-sm text-app-text-secondary" aria-hidden="true">&nbsp;</p>
                ) : claimNote ? (
                  <>
                    <p className="text-base font-semibold text-app-text">{claimNote.title}</p>
                    <p className="mt-1 text-sm text-app-text-secondary">{claimNote.description}</p>
                    <button
                      onClick={() => router.push('/app/homes')}
                      className="mt-4 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      Check status
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-app-text-secondary">No briefing available right now.</p>
                )}
              </div>
            )}
            <BallotTodaySection data={ballot} />
          </div>
        )}

        {/* Content */}
        {!loading && !error && briefing && (
          <div className="space-y-4">
            {/* Main card */}
            <div className="rounded-2xl border border-app bg-surface dark:bg-surface-dark overflow-hidden">
              {/* Location + freshness */}
              <div className="flex items-center justify-between px-5 pt-4">
                <div className="flex items-center gap-1.5 text-xs text-app-text-muted">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="truncate">{briefing.location.label}</span>
                </div>
                <span className="text-[11px] text-app-text-muted">
                  {hydrated ? `Updated ${freshnessLabel(briefing.fetched_at)}` : null}
                </span>
              </div>

              {/* Weather panel */}
              {briefing.weather && sky && (
                <SkyCard
                  input={sky}
                  at={Date.parse(briefing.fetched_at)}
                  temp={briefing.weather.current_temp_f}
                  label={briefing.weather.condition_label}
                  chips={briefing.weather.high_f != null && briefing.weather.low_f != null ? [`H ${briefing.weather.high_f}° · L ${briefing.weather.low_f}°`] : []}
                  className="mt-3 mb-4"
                />
              )}

              {/* Precipitation outlook */}
              {briefing.weather?.precipitation_next_6h && (
                <div className="mx-5 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <Droplets className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs text-blue-700 dark:text-blue-400">
                    Precipitation expected in the next 6 hours
                    {/* An hour that has already started isn't "expected around" its first minute. */}
                    {hydrated && briefing.weather.precipitation_start_at && new Date(briefing.weather.precipitation_start_at).getTime() > Date.now() && (
                      <> — around {new Date(briefing.weather.precipitation_start_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</>
                    )}
                  </span>
                </div>
              )}

              {/* Summary */}
              {briefing.summary && !repeatsCondition(briefing.summary, briefing.weather?.condition_label) && (
                <p className="px-5 pb-4 text-[15px] leading-relaxed text-app-text">
                  {briefing.summary}
                </p>
              )}

              {/* AQI */}
              {briefing.aqi?.is_noteworthy && (
                <div className="mx-5 mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                  <Wind className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                  <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                    AQI {briefing.aqi.index} — {briefing.aqi.category}
                  </span>
                </div>
              )}

              {/* Actions */}
              {briefing.actions.length > 0 && (
                <div className="border-t border-app-border/50 px-5 py-3 flex flex-wrap gap-2">
                  {briefing.actions.map((action, i) => {
                    const isChangeLocation = action.route === '/app/location';
                    const isViewDetails = action.route === '/app/hub/today';
                    if (isViewDetails) return null; // already on this page
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          if (isChangeLocation) {
                            setShowLocationPicker(true);
                          } else {
                            openRoute(action.route);
                          }
                        }}
                        className="text-sm font-semibold px-3.5 py-2 rounded-lg border border-app text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition"
                      >
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Your area's city (TABCARD 4a): the sun, how long until it rises or sets */}
            {areaSun ? <SunCard data={areaSun} countdown /> : null}

            {/* Ballot P0 (ballot_p0): ballot week and "Moved this year?" */}
            <BallotTodaySection data={ballot} />

            {/* Alerts: an out-of-date alert check is never shown as "no alerts" (contract §4) */}
            {alertsUnavailable && (
              <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-app bg-surface dark:bg-surface-dark" role="status">
                <span className="text-sm text-app-text-secondary">Alerts unavailable</span>
                <button onClick={() => { void refresh(); }} disabled={refreshing} className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50">
                  Retry
                </button>
              </div>
            )}
            {!alertsUnavailable && briefing.alerts.length > 0 && (
              <div className="space-y-2">
                {briefing.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40"
                  >
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-red-700 dark:text-red-400">
                        {alert.title}
                      </div>
                      {hydrated && (alert.starts_at || alert.ends_at) && (
                        <div className="text-[11px] text-red-600/80 dark:text-red-400/80 mt-0.5">
                          {alert.starts_at && new Date(alert.starts_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          {alert.ends_at && <> – {new Date(alert.ends_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Christmas cards (TABCARD 2a): the countdown, under the sky and what needs you (ballot, alerts), above
                the rest of the day. Shown once hydrated: it goes by this browser's date. */}
            {hydrated ? <ChristmasCountdown /> : null}

            {/* Seasonal tip — only when the ranked signals did not already
                surface it as a card (they usually do; showing both read as
                the same sentence twice). */}
            {briefing.seasonal?.tip && !briefing.signals.some((s) => s.kind === 'seasonal') && (
              <div className="flex items-start gap-2.5 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40">
                <Leaf className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-800 dark:text-green-400 leading-relaxed">
                  {briefing.seasonal.tip}
                </p>
              </div>
            )}

            {/* Signals */}
            {briefing.signals.length > 0 && (
              <div className="rounded-2xl border border-app bg-surface dark:bg-surface-dark p-5">
                <h2 className="text-xs font-bold text-app-text-muted uppercase tracking-wider mb-3">
                  Signals
                </h2>
                <div className="space-y-2">
                  {briefing.signals.map((signal, i) => {
                    const bg = URGENCY_BG[signal.urgency] || URGENCY_BG.low;
                    const text = URGENCY_TEXT[signal.urgency] || URGENCY_TEXT.low;
                    const body = (
                      <>
                        <div className={`mt-0.5 ${text}`}>
                          <SignalIcon kind={signal.kind} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-semibold ${text}`}>
                            {signal.label}
                          </div>
                          {signal.detail && (
                            <div className="text-xs text-app-text-secondary mt-1 leading-relaxed">
                              {signal.detail}
                            </div>
                          )}
                        </div>
                        {signal.action && (
                          <span className={`text-[11px] font-semibold ${text} opacity-80 flex-shrink-0 mt-1 whitespace-nowrap`}>
                            {signal.action.label} →
                          </span>
                        )}
                      </>
                    );
                    const baseCls = `w-full flex items-start gap-3 px-3.5 py-3 rounded-xl border ${bg} text-left`;
                    return signal.action ? (
                      <button
                        key={i}
                        onClick={() => openRoute(signal.action!.route)}
                        className={`${baseCls} hover:opacity-80 transition`}
                      >
                        {body}
                      </button>
                    ) : (
                      <div key={i} className={baseCls}>
                        {body}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Your area's city ends with the way to the rest of Today */}
            {areaView ? <TodayAreaAddAddress onAdd={() => router.push(ADDRESS_FIRST_PATH)} /> : null}

            {/* Meta footer */}
            {briefing.meta.providers_used.length > 0 && (
              <div className="text-[11px] text-app-text-muted px-1">
                Sources: {briefing.meta.providers_used.map((p) => PROVIDER_NAMES[p] ?? p).join(', ')}
                {briefing.meta.partial_failures.length > 0 && (
                  <> · Some data unavailable: {briefing.meta.partial_failures.map((f) => SECTION_NAMES[f] ?? f).join(', ')}</>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showLocationPicker && (
        <ChangeLocationModal
          onClose={() => setShowLocationPicker(false)}
          onLocationChanged={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.hubToday() });
            queryClient.invalidateQueries({ queryKey: queryKeys.hub() });
          }}
        />
      )}
    </div>
  );
}
