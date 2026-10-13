import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ANDROID_PLAY_STORE_URL,
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
  summarizeText,
  type PublicPlan,
} from '@/lib/publicShare';
import OpenInAppButton from '@/components/public-share/OpenInAppButton';

// A Nearby Plans share link (design board W1). Signed out, area only: the exact
// place, the host's note and the people going are only in the app, for people
// the host lets in. Playdate links show nothing but the kind and the city.
export const dynamic = 'force-dynamic';

type Kind = PublicPlan['kind'];

const KIND_LABEL: Record<Kind, string> = {
  watch_party: 'Watch party',
  playdate: 'Playdate',
  pickup_game: 'Pickup game',
  walk_coffee: 'Walk & coffee',
};

const KIND_TOKEN: Record<Kind, string> = {
  watch_party: 'watch',
  playdate: 'playdate',
  pickup_game: 'pickup',
  walk_coffee: 'walk',
};

function kindColors(kind: Kind): CSSProperties {
  const token = KIND_TOKEN[kind] || 'watch';
  return {
    ['--plan-c' as string]: `var(--color-cat-plan-${token})`,
    ['--plan-cs' as string]: `var(--color-cat-plan-${token}-tint)`,
  };
}

function Icon({ children, className = 'h-5 w-5' }: { children: ReactNode; className?: string }) {
  return (
    <svg
      className={`flex-none ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function KindGlyph({ kind, className }: { kind: Kind; className?: string }) {
  switch (kind) {
    case 'playdate':
      return (
        <Icon className={className}>
          <circle cx="8" cy="6" r="2.6" />
          <path d="M3.8 20v-4.2a4.2 4.2 0 0 1 8.4 0V20" />
          <circle cx="17" cy="10.2" r="2" />
          <path d="M14 20v-2.6a3 3 0 0 1 6 0V20" />
        </Icon>
      );
    case 'pickup_game':
      return (
        <Icon className={className}>
          <circle cx="12" cy="12" r="9" />
          <path d="M5.6 5.6c3.3 3.4 3.3 9.4 0 12.8M18.4 5.6c-3.3 3.4-3.3 9.4 0 12.8" />
        </Icon>
      );
    case 'walk_coffee':
      return (
        <Icon className={className}>
          <path d="M4 9.5h12v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
          <path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16" />
          <path d="M8 3.5v3M12 3.5v3" />
        </Icon>
      );
    default:
      return (
        <Icon className={className}>
          <rect x="3" y="7" width="18" height="12.5" rx="2" />
          <path d="M8 3l4 4 4-4" />
        </Icon>
      );
  }
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

function TopBar({ id, fallbackUrl }: { id: string; fallbackUrl: string | null }) {
  return (
    <div className="flex h-14 items-center justify-between border-b border-app-border bg-app-surface px-4">
      <Link href="/" className="text-[19px] font-bold leading-[22px] tracking-[-0.02em] text-app-text">
        Pantopus
      </Link>
      <OpenInAppButton
        appUrl={buildPlanAppUrl(id)}
        linkHref={buildPlanShareUrl(id)}
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

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { data: plan } = await fetchPublicPlan(id);
  const base = { robots: { index: false, follow: false } };
  if (!plan) {
    return { ...base, title: 'Plan not available | Pantopus', description: "This plan isn't available." };
  }
  if (plan.kind === 'playdate') {
    return {
      ...base,
      ...buildShareMetadata({
        title: `A playdate ${nearPhrase(plan)}`,
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
      title: plan.title || KIND_LABEL[plan.kind],
      description: summarizeText(`${description}. ${plan.about || ''}`, 160, description),
      path: buildPlanPath(id),
      appArgument: buildPlanAppUrl(id),
    }),
  };
}

export default async function PublicPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await fetchPublicPlan(id);
  const plan = result.data;
  const userAgent = (await headers()).get('user-agent') || '';
  const fallbackUrl = getStoreDownloadCta(userAgent)?.href ?? null;

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
    return (
      <main className="min-h-screen bg-app text-app-text">
        <div className="mx-auto w-full max-w-md pb-10">
          <TopBar id={id} fallbackUrl={fallbackUrl} />
          <div className="flex flex-col gap-4 px-4 pt-[18px]">
            <KindTag kind="playdate" />
            <h1 className="text-2xl font-bold leading-[30px] tracking-[-0.015em]">A playdate {nearPhrase(plan)}</h1>
            <div className="flex flex-col gap-3 rounded-[20px] border border-app-border bg-app-surface p-4 shadow-sm">
              <span className="grid h-12 w-12 place-items-center rounded-[13px] bg-app-surface-sunken text-app-text-strong">
                <LockIcon className="h-[22px] w-[22px]" />
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="text-[17px] font-semibold leading-[22px]">Playdates are for verified neighbors</h2>
                <p className="text-sm leading-5 text-app-text-secondary">
                  Open it in the Pantopus app with a verified address to see the time, the place and who&apos;s going,
                  and to ask to join.
                </p>
              </div>
            </div>
            <OpenInAppButton
              appUrl={buildPlanAppUrl(id)}
              linkHref={buildPlanShareUrl(id)}
              fallbackUrl={fallbackUrl}
              className={PRIMARY_BUTTON}
            >
              Open in Pantopus
            </OpenInAppButton>
            <StoreButtons />
            <p className="text-center text-xs leading-4 text-app-text-secondary">{PLAYDATE_CAPTION}</p>
          </div>
        </div>
      </main>
    );
  }

  const hostName = plan.host?.display_name || 'A neighbor';
  const when = whenText(plan);
  const over = plan.state === 'cancelled' || plan.state === 'ended';

  return (
    <main className="min-h-screen bg-app text-app-text">
      <div className="mx-auto w-full max-w-md pb-10">
        <TopBar id={id} fallbackUrl={fallbackUrl} />
        <div className="flex flex-col gap-4 px-4 pt-[18px]">
          <p className="text-sm leading-5 text-app-text-secondary">
            {firstNameOf(hostName)} invited you to a plan {nearPhrase(plan)}.
          </p>

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
            <span>The exact place goes only to people the host lets in.</span>
          </div>

          <OpenInAppButton
            appUrl={buildPlanAppUrl(id)}
            linkHref={buildPlanShareUrl(id)}
            fallbackUrl={fallbackUrl}
            className={PRIMARY_BUTTON}
          >
            {over ? 'See plans near you in Pantopus' : 'Open in Pantopus to join'}
          </OpenInAppButton>
          <StoreButtons />
          <p className="text-center text-xs leading-4 text-app-text-secondary">{PLAYDATE_CAPTION}</p>
        </div>
      </div>
    </main>
  );
}
