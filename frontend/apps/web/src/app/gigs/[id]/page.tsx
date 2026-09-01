import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  buildGigAppUrl,
  buildGigPath,
  buildGigShareUrl,
} from '@pantopus/utils';
import {
  buildShareMetadata,
  collectPreviewImages,
  displayNameForUser,
  fetchPublicGig,
  formatLocationLine,
  formatMoney,
  getStoreDownloadCta,
  summarizeText,
} from '@/lib/publicShare';
import OpenInAppButton from '@/components/public-share/OpenInAppButton';
import PublicShareMedia from '@/components/public-share/PublicShareMedia';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await fetchPublicGig(id);
  const gig = result.data;

  if (!gig) {
    return {
      title: 'Task Not Found | Pantopus',
      description: 'This Pantopus task could not be found.',
    };
  }

  const previewImages = collectPreviewImages(
    gig.media_urls,
    gig.photos,
    gig.attachments
  );
  const budget = formatMoney(gig.price);
  const budgetMax = formatMoney(gig.budget_max);
  const budgetLine =
    budget && budgetMax && budget !== budgetMax
      ? `Budget ${budget} – ${budgetMax}. `
      : budget || budgetMax
        ? `Budget ${budget || budgetMax}. `
        : '';
  const descriptionSource = `${budgetLine}${gig.description || ''}`.trim();

  return buildShareMetadata({
    title: gig.title || 'Task',
    description: summarizeText(
      descriptionSource,
      160,
      'See this task on Pantopus.'
    ),
    path: buildGigPath(id),
    appArgument: buildGigAppUrl(id),
    images: previewImages.length > 0 ? previewImages : null,
  });
}

export default async function PublicGigPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await fetchPublicGig(id);
  const gig = result.data;

  if (!gig) {
    notFound();
  }

  const userAgent = (await headers()).get('user-agent') || '';
  const storeCta = getStoreDownloadCta(userAgent);
  const fallbackUrl = storeCta?.href ?? null;

  const creatorName = displayNameForUser(gig.creator, 'Pantopus neighbor');
  const previewImages = collectPreviewImages(
    gig.media_urls,
    gig.photos,
    gig.attachments
  );
  const budget = formatMoney(gig.price);
  const budgetMax = formatMoney(gig.budget_max);
  const location = formatLocationLine(
    gig.location_name,
    gig.creator?.city,
    gig.creator?.state
  );
  const category = gig.category || gig.task_archetype || null;

  return (
    <main className="min-h-screen bg-app text-app">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-semibold text-app hover:opacity-80">
            Pantopus
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href={buildGigShareUrl(id)}
              className="text-sm text-app-text-secondary hover:text-app"
            >
              Canonical URL
            </Link>
            <OpenInAppButton
              appUrl={buildGigAppUrl(id)}
              linkHref={buildGigShareUrl(id)}
              fallbackUrl={fallbackUrl}
              className="rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              Open In App
            </OpenInAppButton>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_360px]">
          <section className="overflow-hidden rounded-3xl border border-app bg-surface shadow-sm">
            <PublicShareMedia
              images={previewImages}
              heroAlt={gig.title || 'Pantopus task'}
            />

            <div className="space-y-6 p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-app-text-secondary">
                <span className="rounded-full bg-primary-50 px-3 py-1 text-primary-700">
                  Task
                </span>
                {gig.status ? (
                  <span className="rounded-full bg-surface-muted px-3 py-1">
                    {String(gig.status).replace(/_/g, ' ')}
                  </span>
                ) : null}
                {category ? (
                  <span className="rounded-full bg-surface-muted px-3 py-1">
                    {category}
                  </span>
                ) : null}
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight text-app sm:text-4xl">
                  {gig.title || 'Task'}
                </h1>
                <p className="text-base leading-7 text-app-text-secondary">
                  {gig.description || 'No description provided.'}
                </p>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-app bg-surface p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-secondary">
                Posted By
              </p>
              <p className="mt-2 text-xl font-semibold text-app">{creatorName}</p>
              {location ? (
                <p className="mt-2 text-sm text-app-text-secondary">{location}</p>
              ) : null}
            </div>

            <div className="rounded-3xl border border-app bg-surface p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-secondary">
                Budget
              </p>
              <p className="mt-2 text-2xl font-semibold text-app">
                {budget && budgetMax && budget !== budgetMax
                  ? `${budget} - ${budgetMax}`
                  : budget || budgetMax || 'Budget on request'}
              </p>
              {gig.deadline ? (
                <p className="mt-3 text-sm text-app-text-secondary">
                  Deadline: {new Date(gig.deadline).toLocaleString()}
                </p>
              ) : null}
            </div>

            <div className="rounded-3xl border border-app bg-surface p-6 shadow-sm">
              <p className="text-sm leading-6 text-app-text-secondary">
                Want to bid, message the poster, or manage this task? Open it in Pantopus.
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <OpenInAppButton
                  appUrl={buildGigAppUrl(id)}
                  linkHref={buildGigShareUrl(id)}
                  fallbackUrl={fallbackUrl}
                  className="rounded-full bg-primary-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-primary-700"
                >
                  Open Task
                </OpenInAppButton>
                {storeCta ? (
                  <a
                    href={storeCta.href}
                    className="rounded-full border border-app px-4 py-2 text-center text-sm font-semibold text-app hover:bg-surface-muted"
                  >
                    {storeCta.label}
                  </a>
                ) : null}
                <Link
                  href="/"
                  className="rounded-full border border-app px-4 py-2 text-center text-sm font-semibold text-app hover:bg-surface-muted"
                >
                  Back To Pantopus
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
