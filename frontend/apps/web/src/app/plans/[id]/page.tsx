import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ANDROID_PLAY_STORE_URL,
  API_BASE_URL,
  IOS_APP_STORE_URL,
  buildPlanAppUrl,
  buildPlanPath,
  buildPlanShareUrl,
} from '@pantopus/utils';
import {
  absoluteMediaUrl,
  buildShareMetadata,
  fetchPublicPlan,
  getStoreDownloadCta,
  planInviteToken,
  summarizeText,
  type PublicPlan,
  type PublicPlanInvite,
} from '@/lib/publicShare';
import OpenInAppButton from '@/components/public-share/OpenInAppButton';
import JustInstalledHint from '@/components/public-share/JustInstalledHint';
import { Icon, KindGlyph, kindColors } from '@/components/plans/planKind';

// A Nearby Plans share link (design board W1). Signed out, area only: the exact
// place, the host's note and the people going are only in the app, for people
// the host lets in. Playdate links show nothing but the kind and the city.
export const dynamic = 'force-dynamic';

type Kind = PublicPlan['kind'];

/** The signed-in person's part in the plan: host, in (guest), or neither, with their request's status. */
type PlanViewer = { role: 'host' | 'guest' | 'none'; requestStatus: string | null; requestsWaiting: number };

/**
 * Who is looking, when they're signed in on the web. A host's "requests waiting" notices open this
 * page, so the host and people already in get words that fit them. It's the app's own plan read
 * (GET /api/plans/:id) with the person's session cookie, never cached; signed out, or when that read
 * fails, the page reads as it does for everyone.
 */
async function fetchPlanViewer(id: string): Promise<PlanViewer | null> {
  const access = (await cookies()).get('pantopus_access')?.value;
  if (!access) return null;
  try {
    const response = await fetch(`${API_BASE_URL.replace(/\/+$/, '')}/api/plans/${encodeURIComponent(id)}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json', Cookie: `pantopus_access=${access}` },
    });
    if (!response.ok) return null;
    const plan = await response.json();
    const role = plan?.viewer?.role;
    if (role !== 'host' && role !== 'guest' && role !== 'none') return null;
    return {
      role,
      requestStatus: typeof plan.viewer.request_status === 'string' ? plan.viewer.request_status : null,
      requestsWaiting: Number(plan.requests_count) || 0,
    };
  } catch {
    return null;
  }
}

const KIND_LABEL: Record<Kind, string> = {
  watch_party: 'Watch party',
  playdate: 'Playdate',
  pickup_game: 'Pickup game',
  walk_coffee: 'Walk & coffee',
  study_group: 'Study group',
};

/** As a sentence says it: "Sam invited you to their watch party". */
const KIND_NOUN: Record<Kind, string> = {
  watch_party: 'watch party',
  playdate: 'playdate',
  pickup_game: 'pickup game',
  walk_coffee: 'walk & coffee',
  study_group: 'study group',
};

type PageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ invite?: string | string[] }> };

/**
 * An invitation's token from ?invite= and, once the plan is read, the invitation it opens (null when there's none or
 * it was taken back). The page's links carry the token so the app can open the invitation.
 */
async function inviteFrom(searchParams: PageProps['searchParams']): Promise<string | null> {
  const value = (await searchParams)?.invite;
  return planInviteToken(Array.isArray(value) ? value[0] : value);
}

function inviteQuery(token: string | null, invite: PublicPlanInvite | null): string {
  return token && invite?.available ? `?invite=${encodeURIComponent(token)}` : '';
}

function LockIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <Icon className={className}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Icon>
  );
}

function KindTag({ kind }: { kind: Kind }) {
  return (
    <span
      className="inline-flex h-[30px] items-center gap-[7px] self-start whitespace-nowrap rounded-full bg-[var(--plan-cs)] pl-1 pr-3 text-[13px] font-semibold leading-[18px] text-app-text"
      style={kindColors(kind)}
    >
      <span className="grid h-[22px] w-[22px] place-items-center rounded-[7px] bg-[var(--plan-c)] text-white dark:text-[#0b1220]">
        <KindGlyph kind={kind} className="h-[13px] w-[13px]" />
      </span>
      {KIND_LABEL[kind]}
    </span>
  );
}

/** The board's illustrated mini-map: a park, blocks and roads, and the plan's area as a soft circle. Not a real map. */
function MiniMap({ kind }: { kind: Kind }) {
  const area: CSSProperties = {
    ...kindColors(kind),
    background:
      'radial-gradient(closest-side, color-mix(in srgb, var(--plan-c) 24%, transparent) 0%, color-mix(in srgb, var(--plan-c) 20%, transparent) 72%, transparent 100%)',
  };
  const block = 'absolute rounded-[4px] bg-[#e8e5de] dark:bg-[#252a30]';
  const road = 'absolute bg-white shadow-[0_0_0_1px_#dcd8cf] dark:bg-[#384049] dark:shadow-[0_0_0_1px_#2a3038]';
  return (
    <div className="relative h-[150px] overflow-hidden bg-[#f2f0eb] dark:bg-[#1d2126]" aria-hidden="true">
      <i className="absolute left-[4%] top-[10%] h-[42%] w-[32%] rounded-[22px] bg-[#d5eac7] dark:bg-[#1e3527]" />
      <i className={`${block} left-[54%] top-[8%] h-[14%] w-[20%]`} />
      <i className={`${block} left-[54%] top-[34%] h-[20%] w-[20%]`} />
      <i className={`${block} left-[84%] top-[34%] h-[20%] w-[14%]`} />
      <i className={`${block} left-[10%] top-[66%] h-[16%] w-[28%]`} />
      <i className={`${block} left-[54%] top-[66%] h-[16%] w-[20%]`} />
      <i className={`${road} left-[-5%] top-[60%] h-[6px] w-[110%]`} />
      <i className={`${road} left-[44%] top-[-10%] h-[120%] w-[6px]`} />
      <i className={`${road} left-[-5%] top-[26%] h-[4px] w-[110%] -rotate-6`} />
      <i className={`${road} left-[78%] top-[-10%] h-[120%] w-[4px]`} />
      <span
        className="absolute left-[56%] top-1/2 z-[2] h-[150px] w-[150px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={area}
      />
    </div>
  );
}

function firstNameOf(displayName: string | undefined): string {
  return String(displayName || 'A neighbor').split(' ')[0];
}

function nearPhrase(plan: PublicPlan): string {
  if (plan.city) return `near ${plan.city}`;
  const label = plan.area?.city || plan.area?.label || '';
  if (!label) return 'nearby';
  return /^near\s/i.test(label) ? label.replace(/^Near/, 'near') : `near ${label}`;
}

function whereText(plan: PublicPlan): string {
  const label = plan.area?.label || '';
  const city = plan.area?.city || '';
  if (!label) return city;
  if (!city || label === city || label.endsWith(city)) return label;
  return `${label}, ${city}`;
}

function whenText(plan: PublicPlan): string | null {
  if (!plan.starts_at) return null;
  const start = new Date(plan.starts_at);
  if (Number.isNaN(start.getTime())) return null;
  const timeZone = plan.timezone || 'America/Los_Angeles';
  const day = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', month: 'short', day: 'numeric' }).format(start);
  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(start);
  return `${day} · ${time}`;
}

/** The line above the card: an invitation, unless the person is the host, is in, or already asked. */
function introText(plan: PublicPlan, hostName: string, viewer: PlanViewer | null, over: boolean, invite: PublicPlanInvite | null): string {
  const near = nearPhrase(plan);
  const host = firstNameOf(hostName);
  if (invite?.available && !over && (!viewer || viewer.role === 'none')) {
    return `${invite.host_first_name} invited you to their ${KIND_NOUN[plan.kind]} ${near}.`;
  }
  if (viewer?.role === 'host') {
    const waiting = over ? 0 : viewer.requestsWaiting;
    if (waiting > 0) return `Your plan ${near}. ${waiting} ${waiting === 1 ? 'person is' : 'people are'} waiting for your answer.`;
    return `Your plan ${near}.`;
  }
  if (viewer?.role === 'guest') return over ? `You joined ${host}'s plan ${near}.` : `You're in ${host}'s plan ${near}.`;
  if (!over && viewer?.requestStatus === 'pending') return `You asked to join ${host}'s plan ${near}.`;
  if (!over && viewer?.requestStatus === 'waitlisted') return `You're on the waitlist for ${host}'s plan ${near}.`;
  return `${host} invited you to a plan ${near}.`;
}

function goingText(plan: PublicPlan): string {
  const going = plan.going_count ?? 0;
  if (plan.state === 'live') return `Happening now · ${going} going`;
  if (plan.is_full) {
    const waiting = plan.waitlist_count ?? 0;
    return `${going} going · Full${waiting > 0 ? ` · ${waiting} waiting` : ''}`;
  }
  const left = plan.spots_left ?? 0;
  return `${going} going · ${left} ${left === 1 ? 'spot' : 'spots'} left`;
}

function HostAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const src = absoluteMediaUrl(avatarUrl);
  if (src) {
    // Native img keeps public avatars working across storage hosts without Next image config churn.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className="h-[30px] w-[30px] flex-none rounded-full object-cover" />;
  }
  return (
    <span
      className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full bg-[#e0e7ff] text-xs font-bold text-[#3730a3] dark:bg-[#23264a] dark:text-[#c7d2fe]"
      aria-hidden="true"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[13px] font-semibold leading-[18px] text-app-success">
      <Icon className="h-[14px] w-[14px]">
        <path d="M12 3l7 3v5.5c0 4.3-2.9 8-7 9.5-4.1-1.5-7-5.2-7-9.5V6z" />
        <path d="M9 12l2 2 4-4" />
      </Icon>
      Verified address
    </span>
  );
}

function TopBar({ id, fallbackUrl, query = '' }: { id: string; fallbackUrl: string | null; query?: string }) {
  return (
    <div className="flex h-14 items-center justify-between border-b border-app-border bg-app-surface px-4">
      <Link href="/" className="text-[19px] font-bold leading-[22px] tracking-[-0.02em] text-app-text">
        Pantopus
      </Link>
      <OpenInAppButton
        appUrl={`${buildPlanAppUrl(id)}${query}`}
        linkHref={`${buildPlanShareUrl(id)}${query}`}
        fallbackUrl={fallbackUrl}
        className="text-sm font-semibold text-app-link"
      >
        Open app
      </OpenInAppButton>
    </div>
  );
}

function StoreButtons() {
  if (!IOS_APP_STORE_URL && !ANDROID_PLAY_STORE_URL) return null;
  const button =
    'flex h-10 w-full items-center justify-center rounded-[10px] border border-app-border-strong bg-app-surface text-[15px] font-semibold text-app-text';
  return (
    <div className="grid grid-cols-2 gap-[10px]">
      {IOS_APP_STORE_URL ? <a href={IOS_APP_STORE_URL} className={button}>Get it for iPhone</a> : <span />}
      {ANDROID_PLAY_STORE_URL ? <a href={ANDROID_PLAY_STORE_URL} className={button}>Get it for Android</a> : <span />}
    </div>
  );
}

const PRIMARY_BUTTON =
  'flex h-[50px] w-full items-center justify-center rounded-xl bg-primary-600 text-base font-semibold text-white shadow-[0_6px_16px_rgba(2,132,199,0.18)] hover:opacity-95';

const PLAYDATE_CAPTION = 'Playdate links show no details here. Open them in the app with a verified address.';

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const token = await inviteFrom(searchParams);
  const { data: plan } = await fetchPublicPlan(id, token);
  const base = { robots: { index: false, follow: false } };
  if (!plan) {
    return { ...base, title: 'Plan not available | Pantopus', description: "This plan isn't available." };
  }
  // A texted invitation's preview says whose it is.
  const invitedBy = plan.invite?.available ? `${plan.invite.host_first_name} invited you: ` : '';
  if (plan.kind === 'playdate') {
    return {
      ...base,
      ...buildShareMetadata({
        title: `${invitedBy}A playdate ${nearPhrase(plan)}`,
        description: 'Open it in Pantopus with a verified address to see the details and ask to join.',
        path: buildPlanPath(id),
        appArgument: buildPlanAppUrl(id),
      }),
    };
  }
  const when = whenText(plan);
  const description = [KIND_LABEL[plan.kind], when, whereText(plan)].filter(Boolean).join(' · ');
  return {
    ...base,
    ...buildShareMetadata({
      title: `${invitedBy}${plan.title || KIND_LABEL[plan.kind]}`,
      description: summarizeText(`${description}. ${plan.about || ''}`, 160, description),
      path: buildPlanPath(id),
      appArgument: buildPlanAppUrl(id),
    }),
  };
}

export default async function PublicPlanPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const token = await inviteFrom(searchParams);
  const [result, viewer] = await Promise.all([fetchPublicPlan(id, token), fetchPlanViewer(id)]);
  const plan = result.data;
  const userAgent = (await headers()).get('user-agent') || '';
  const fallbackUrl = getStoreDownloadCta(userAgent)?.href ?? null;
  const invite = plan?.invite ?? null;
  // The app opens the invitation from the same link; one taken back opens the plan as any share does.
  const query = inviteQuery(token, invite);
  const appUrl = `${buildPlanAppUrl(id)}${query}`;
  const linkHref = `${buildPlanShareUrl(id)}${query}`;

  if (!plan && result.status === 404) notFound();

  if (!plan) {
    return (
      <main className="min-h-screen bg-app text-app-text">
        <div className="mx-auto w-full max-w-md">
          <TopBar id={id} fallbackUrl={fallbackUrl} />
          <div className="flex flex-col gap-4 px-4 pt-10 text-center">
            <h1 className="text-xl font-semibold">Couldn&apos;t load this plan</h1>
            <p className="text-sm text-app-text-secondary">Something went wrong. Please try again.</p>
            <a href={buildPlanPath(id)} className={PRIMARY_BUTTON}>
              Try again
            </a>
          </div>
        </div>
      </main>
    );
  }

  if (plan.kind === 'playdate') {
    // The host and families who are in see their own playdate's details in the app, as everyone does.
    const mine = viewer?.role === 'host' || viewer?.role === 'guest';
    const invitedBy = invite?.available && !mine ? invite.host_first_name : null;
    return (
      <main className="min-h-screen bg-app text-app-text">
        <div className="mx-auto w-full max-w-md pb-10">
          <TopBar id={id} fallbackUrl={fallbackUrl} query={query} />
          <div className="flex flex-col gap-4 px-4 pt-[18px]">
            {invitedBy ? <p className="text-sm leading-5 text-app-text-secondary">{invitedBy} invited you to their playdate.</p> : null}
            <KindTag kind="playdate" />
            <h1 className="text-2xl font-bold leading-[30px] tracking-[-0.015em]">
              {viewer?.role === 'host' ? 'Your playdate' : 'A playdate'} {nearPhrase(plan)}
            </h1>
            <div className="flex flex-col gap-3 rounded-[20px] border border-app-border bg-app-surface p-4 shadow-sm">
              <span className="grid h-12 w-12 place-items-center rounded-[13px] bg-app-surface-sunken text-app-text-strong">
                <LockIcon className="h-[22px] w-[22px]" />
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="text-[17px] font-semibold leading-[22px]">
                  {mine ? 'Playdate details stay in the app' : 'Playdates are for verified neighbors'}
                </h2>
                <p className="text-sm leading-5 text-app-text-secondary">
                  {viewer?.role === 'host'
                    ? "Open it in the Pantopus app to see who asked to join and who's going."
                    : viewer?.role === 'guest'
                      ? "You're in. Open it in the Pantopus app to see the time, the place and who's going."
                      : invitedBy
                        ? "Open it in the Pantopus app with a verified address to see the time, the place and who's going, and to say you're in."
                        : "Open it in the Pantopus app with a verified address to see the time, the place and who's going, and to ask to join."}
                </p>
              </div>
            </div>
            <OpenInAppButton
              appUrl={appUrl}
              linkHref={linkHref}
              fallbackUrl={fallbackUrl}
              className={PRIMARY_BUTTON}
            >
              Open in Pantopus
            </OpenInAppButton>
            <StoreButtons />
            <JustInstalledHint what="this playdate" emailHint={invitedBy ? invite?.email_hint : null} />
            <p className="text-center text-xs leading-4 text-app-text-secondary">{PLAYDATE_CAPTION}</p>
          </div>
        </div>
      </main>
    );
  }

  const hostName = plan.host?.display_name || 'A neighbor';
  const when = whenText(plan);
  const over = plan.state === 'cancelled' || plan.state === 'ended';
  // Someone who is in, or already asked, opens the plan in the app rather than joining.
  const joined = viewer?.role === 'host' || viewer?.role === 'guest'
    || (!over && (viewer?.requestStatus === 'pending' || viewer?.requestStatus === 'waitlisted'));
  // An invitation is the host's yes: in the app, the person just says they're in.
  const invited = Boolean(invite?.available) && !over && !joined;

  return (
    <main className="min-h-screen bg-app text-app-text">
      <div className="mx-auto w-full max-w-md pb-10">
        <TopBar id={id} fallbackUrl={fallbackUrl} query={query} />
        <div className="flex flex-col gap-4 px-4 pt-[18px]">
          <p className="text-sm leading-5 text-app-text-secondary">{introText(plan, hostName, viewer, over, invite)}</p>
          {invite && !invite.available && !over ? (
            <p className="text-sm leading-5 text-app-text-secondary">
              This invitation isn&apos;t available anymore. You can still ask to join in the app.
            </p>
          ) : null}

          <section
            className="overflow-hidden rounded-[20px] border border-app-border bg-app-surface shadow-sm"
            aria-labelledby="plan-title"
          >
            <MiniMap kind={plan.kind} />
            <div className="flex flex-col gap-2 px-4 pb-4 pt-[14px]">
              <KindTag kind={plan.kind} />
              <h1 id="plan-title" className="text-xl font-semibold leading-[26px] tracking-[-0.012em]">
                {plan.title || KIND_LABEL[plan.kind]}
              </h1>
              <p className="text-sm leading-5 text-app-text-strong [font-variant-numeric:tabular-nums]">
                {[when, whereText(plan)].filter(Boolean).join(' · ')}
              </p>
              <div className="flex items-center gap-[10px]">
                <HostAvatar name={hostName} avatarUrl={plan.host?.avatar_url ?? null} />
                <span className="flex flex-wrap items-center gap-x-2 text-sm leading-5">
                  <span className="font-semibold">{hostName}</span>
                  {plan.host?.verified_address ? <VerifiedBadge /> : null}
                </span>
              </div>
              {over ? (
                <p className="text-sm font-semibold leading-5 text-app-text-strong">
                  {plan.state === 'cancelled' ? 'This plan was cancelled.' : 'This plan has ended.'}
                </p>
              ) : (
                <p className="text-sm leading-5 text-app-text-secondary">{goingText(plan)}</p>
              )}
            </div>
          </section>

          <div className="flex items-start gap-[10px] text-sm leading-5 text-app-text-secondary">
            <LockIcon className="mt-0.5 h-4 w-4" />
            <span>
              {viewer?.role === 'host'
                ? 'The exact place goes only to people you let in.'
                : viewer?.role === 'guest'
                  ? 'You see the exact place in the app.'
                  : invited
                    ? 'You see the exact place in the app once you say you’re in.'
                    : 'The exact place goes only to people the host lets in.'}
            </span>
          </div>

          <OpenInAppButton
            appUrl={appUrl}
            linkHref={linkHref}
            fallbackUrl={fallbackUrl}
            className={PRIMARY_BUTTON}
          >
            {joined
              ? 'Open in Pantopus'
              : over
                ? 'See plans near you in Pantopus'
                : invited
                  ? 'Open in Pantopus to say you’re in'
                  : 'Open in Pantopus to join'}
          </OpenInAppButton>
          <StoreButtons />
          <JustInstalledHint what="this plan" emailHint={invited ? invite?.email_hint : null} />
          <p className="text-center text-xs leading-4 text-app-text-secondary">{PLAYDATE_CAPTION}</p>
        </div>
      </div>
    </main>
  );
}
