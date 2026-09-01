import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  buildSupportTrainAppUrl,
  buildSupportTrainPath,
  buildSupportTrainShareUrl,
} from '@pantopus/utils';
import {
  absoluteMediaUrl,
  buildShareMetadata,
  displayNameForUser,
  fetchPublicSupportTrain,
  formatLocationLine,
  getStoreDownloadCta,
  summarizeText,
} from '@/lib/publicShare';
import OpenInAppButton from '@/components/public-share/OpenInAppButton';
import SlotSignupButton from '@/components/public-share/SlotSignupButton';

type OrganizerUser = {
  id?: string | null;
  username?: string | null;
  name?: string | null;
  first_name?: string | null;
  firstName?: string | null;
  profile_picture_url?: string | null;
};

type SupportTrainSlot = {
  id: string;
  status?: string | null;
  filled_count?: number | null;
  capacity?: number | null;
  slot_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  slot_label?: string | null;
  support_mode?: string | null;
};

type SupportTrainWithOrganizers = {
  organizers?: Array<{
    role?: string | null;
    user?: OrganizerUser | null;
  }> | null;
  slots?: SupportTrainSlot[] | null;
};

function supportModeLabel(key: string): string {
  if (key === 'home_cooked_meals') return 'Home-cooked meals';
  if (key === 'takeout') return 'Takeout';
  if (key === 'groceries') return 'Groceries';
  if (key === 'gift_funds') return 'Gift funds';
  return key.replace(/_/g, ' ');
}

function formatWindow(start?: string | null, end?: string | null): string | null {
  if (start && end) return `${start} - ${end}`;
  if (start) return `${start}+`;
  if (end) return `Until ${end}`;
  return null;
}

function getOrganizerUser(
  train: SupportTrainWithOrganizers | null | undefined
): OrganizerUser | null {
  const organizers = Array.isArray(train?.organizers) ? train.organizers : [];
  const primary = organizers.find((organizer) => organizer?.role === 'primary');
  return primary?.user || organizers[0]?.user || null;
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

function OrganizerAvatar({ user, name }: { user: OrganizerUser; name: string }) {
  const avatarUrl = absoluteMediaUrl(user?.profile_picture_url);

  if (avatarUrl) {
    return (
      // Native img keeps public avatars working across storage hosts without Next image config churn.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
      {initialsForName(name)}
    </span>
  );
}

function OrganizerChip({ user }: { user: OrganizerUser }) {
  const name = displayNameForUser(user, 'Organizer');
  const href = getProfileHref(user);
  const content = (
    <>
      <OrganizerAvatar user={user} name={name} />
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-app-text-secondary">
          Organized by
        </span>
        <span className="block truncate text-sm font-semibold text-app">{name}</span>
      </span>
    </>
  );

  if (!href) {
    return (
      <div className="inline-flex max-w-full items-center gap-3 rounded-full bg-surface-muted px-3 py-2">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex max-w-full items-center gap-3 rounded-full bg-surface-muted px-3 py-2 text-left transition hover:bg-primary-50"
      aria-label={`View ${name}'s public profile`}
    >
      {content}
    </Link>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await fetchPublicSupportTrain(id);
  const train = result.data;

  if (!train) {
    return {
      title: 'Support Train Not Available | Pantopus',
      description:
        result.status === 403
          ? 'This Support Train is not publicly shareable.'
          : 'This Support Train could not be found.',
    };
  }

  const location = formatLocationLine(
    train.coarse_location?.city,
    train.coarse_location?.state,
    train.coarse_location?.zip_code
  );
  const description = [train.story, location ? `Approximate area: ${location}.` : null]
    .filter(Boolean)
    .join(' ');

  return buildShareMetadata({
    title: train.title || 'Support Train',
    description: summarizeText(description, 160, 'See this Support Train on Pantopus.'),
    path: buildSupportTrainPath(id),
    appArgument: buildSupportTrainAppUrl(id),
  });
}

export default async function PublicSupportTrainPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await fetchPublicSupportTrain(id);
  const train = result.data;
  const userAgent = (await headers()).get('user-agent') || '';
  const storeCta = getStoreDownloadCta(userAgent);
  const fallbackUrl = storeCta?.href ?? null;

  if (!train && result.status === 404) {
    notFound();
  }

  if (!train) {
    return (
      <main className="min-h-screen bg-app text-app">
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-4 text-center sm:px-6">
          <p className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-app-text-secondary">
            Support Train Share
          </p>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-app">
            This Support Train isn&apos;t publicly shareable
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-app-text-secondary">
            The link is valid, but this Support Train is limited to Pantopus members with access.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/"
              className="rounded-full border border-app px-5 py-2.5 text-sm font-semibold text-app hover:bg-surface-muted"
            >
              Back To Pantopus
            </Link>
            {storeCta ? (
              <a
                href={storeCta.href}
                className="rounded-full border border-app px-5 py-2.5 text-sm font-semibold text-app hover:bg-surface-muted"
              >
                {storeCta.label}
              </a>
            ) : null}
          </div>
        </div>
      </main>
    );
  }

  const location = formatLocationLine(
    train.coarse_location?.city,
    train.coarse_location?.state,
    train.coarse_location?.zip_code
  );
  const supportModes = Object.entries(train.support_modes || {})
    .filter(([, enabled]) => !!enabled)
    .map(([key]) => supportModeLabel(key));
  const trainSlots = Array.isArray(train.slots) ? (train.slots as SupportTrainSlot[]) : [];
  const visibleSlots = trainSlots.filter((slot) => slot?.status !== 'canceled');
  const openSlots = visibleSlots.filter(
    (slot) => slot?.status === 'open' && (slot?.filled_count ?? 0) < (slot?.capacity ?? 1)
  );
  const organizerUser = getOrganizerUser(train);

  // Map enabled support modes to contribution_mode values for the signup form
  const modeKeyToContribution: Record<string, 'cook' | 'takeout' | 'groceries'> = {
    home_cooked_meals: 'cook',
    takeout: 'takeout',
    groceries: 'groceries',
  };
  const enabledContributionModes = Object.entries(train.support_modes || {})
    .filter(([key, enabled]) => !!enabled && key in modeKeyToContribution)
    .map(([key]) => modeKeyToContribution[key]);

  return (
    <main className="min-h-screen bg-app text-app">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-semibold text-app hover:opacity-80">
            Pantopus
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href={buildSupportTrainShareUrl(id)}
              className="text-sm text-app-text-secondary hover:text-app"
            >
              Canonical URL
            </Link>
            <OpenInAppButton
              appUrl={buildSupportTrainAppUrl(id)}
              linkHref={buildSupportTrainShareUrl(id)}
              fallbackUrl={fallbackUrl}
              className="rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              Open In App
            </OpenInAppButton>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_360px]">
          <section className="overflow-hidden rounded-3xl border border-app bg-surface shadow-sm">
            <div className="space-y-6 p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-app-text-secondary">
                <span className="rounded-full bg-primary-50 px-3 py-1 text-primary-700">
                  Support Train
                </span>
                {train.recipient_summary ? (
                  <span className="rounded-full bg-surface-muted px-3 py-1">
                    {train.recipient_summary}
                  </span>
                ) : null}
                {location ? (
                  <span className="rounded-full bg-surface-muted px-3 py-1">{location}</span>
                ) : null}
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight text-app sm:text-4xl">
                  {train.title || 'Support Train'}
                </h1>
                {organizerUser ? <OrganizerChip user={organizerUser} /> : null}
                <p className="text-base leading-7 text-app-text-secondary">
                  {train.story || 'Help coordinate support for this household.'}
                </p>
              </div>

              {supportModes.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-secondary">
                    Support types
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {supportModes.map((mode) => (
                      <span
                        key={mode}
                        className="rounded-full bg-surface-muted px-3 py-1 text-sm text-app"
                      >
                        {mode}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {(train.dietary_restrictions || []).length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-secondary">
                    Dietary restrictions
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {train.dietary_restrictions.map((item: string) => (
                      <span
                        key={item}
                        className="rounded-full bg-rose-50 px-3 py-1 text-sm text-rose-700"
                      >
                        {item.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-app bg-surface p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-secondary">
                Open dates
              </p>
              <p className="mt-2 text-2xl font-semibold text-app">{openSlots.length}</p>
              <p className="mt-3 text-sm leading-6 text-app-text-secondary">
                Exact address stays hidden until an organizer manually shares it with a signed-up
                helper.
              </p>
            </div>

            <div className="rounded-3xl border border-app bg-surface p-6 shadow-sm">
              <p className="text-sm leading-6 text-app-text-secondary">
                Sign up for an open date below, or open in Pantopus for the best experience
                with one-tap signups, real-time updates, and direct chat with the organizer.
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <OpenInAppButton
                  appUrl={buildSupportTrainAppUrl(id)}
                  linkHref={buildSupportTrainShareUrl(id)}
                  fallbackUrl={fallbackUrl}
                  className="rounded-full bg-primary-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-primary-700"
                >
                  Open Support Train
                </OpenInAppButton>
                {storeCta ? (
                  <a
                    href={storeCta.href}
                    className="rounded-full border border-app px-4 py-2 text-center text-sm font-semibold text-app hover:bg-surface-muted"
                  >
                    {storeCta.label}
                  </a>
                ) : null}
              </div>
            </div>
          </aside>
        </div>

        <section className="mt-8 rounded-3xl border border-app bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-secondary">
                Dates
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-app">Upcoming support slots</h2>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {visibleSlots.length === 0 ? (
              <p className="text-sm text-app-text-secondary">No dates have been posted yet.</p>
            ) : (
              visibleSlots.map((slot) => {
                const dateLabel = slot?.slot_date
                  ? new Date(`${slot.slot_date}T00:00:00Z`).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      timeZone: 'UTC',
                    })
                  : 'Upcoming date';
                const windowLabel = formatWindow(slot?.start_time, slot?.end_time);
                const isOpen =
                  slot?.status === 'open' && (slot?.filled_count ?? 0) < (slot?.capacity ?? 1);

                return (
                  <div
                    key={slot.id}
                    className="flex flex-col gap-3 rounded-2xl border border-app bg-surface-muted px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-base font-semibold text-app">
                        {slot?.slot_label || 'Support'} · {dateLabel}
                      </p>
                      <p className="mt-1 text-sm text-app-text-secondary">
                        {[windowLabel, supportModeLabel(slot?.support_mode || '')]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <SlotSignupButton
                      supportTrainId={id}
                      slotId={slot.id}
                      slotLabel={slot?.slot_label || 'Support'}
                      slotDate={dateLabel}
                      isOpen={isOpen}
                      appUrl={buildSupportTrainAppUrl(id)}
                      fallbackUrl={fallbackUrl}
                      enabledModes={enabledContributionModes}
                    />
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
