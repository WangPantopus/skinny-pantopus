import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  buildListingAppUrl,
  buildListingPath,
  buildListingShareUrl,
} from '@pantopus/utils';
import {
  buildShareMetadata,
  collectPreviewImages,
  displayNameForUser,
  fetchPublicListing,
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
  const result = await fetchPublicListing(id);
  const listing = result.data;

  if (!listing) {
    return {
      title: 'Listing Not Found | Pantopus',
      description: 'This Pantopus marketplace listing could not be found.',
    };
  }

  const previewImages = collectPreviewImages(
    listing.media_urls,
    listing.media_thumbnails
  );
  const priceLine = listing.is_free
    ? 'Free. '
    : formatMoney(listing.price)
      ? `Price ${formatMoney(listing.price)}. `
      : '';
  const descriptionSource = `${priceLine}${listing.description || ''}`.trim();

  return buildShareMetadata({
    title: listing.title || 'Marketplace Listing',
    description: summarizeText(
      descriptionSource,
      160,
      'See this marketplace listing on Pantopus.'
    ),
    path: buildListingPath(id),
    appArgument: buildListingAppUrl(id),
    images: previewImages.length > 0 ? previewImages : null,
  });
}

export default async function PublicListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await fetchPublicListing(id);
  const listing = result.data;

  if (!listing) {
    notFound();
  }

  const userAgent = (await headers()).get('user-agent') || '';
  const storeCta = getStoreDownloadCta(userAgent);
  const fallbackUrl = storeCta?.href ?? null;

  const sellerName = displayNameForUser(listing.creator, 'Pantopus member');
  const previewImages = collectPreviewImages(
    listing.media_urls,
    listing.media_thumbnails
  );
  const price = listing.is_free ? 'Free' : formatMoney(listing.price) || 'Price on request';
  const location = formatLocationLine(listing.location_name, listing.city, listing.state);
  const category = listing.category || listing.subcategory || null;
  const condition = listing.condition || null;

  return (
    <main className="min-h-screen bg-app text-app">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-semibold text-app hover:opacity-80">
            Pantopus
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href={buildListingShareUrl(id)}
              className="text-sm text-app-text-secondary hover:text-app"
            >
              Canonical URL
            </Link>
            <OpenInAppButton
              appUrl={buildListingAppUrl(id)}
              linkHref={buildListingShareUrl(id)}
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
              heroAlt={listing.title || 'Pantopus listing'}
            />

            <div className="space-y-6 p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-app-text-secondary">
                <span className="rounded-full bg-primary-50 px-3 py-1 text-primary-700">
                  Marketplace
                </span>
                {listing.status ? (
                  <span className="rounded-full bg-surface-muted px-3 py-1">
                    {String(listing.status).replace(/_/g, ' ')}
                  </span>
                ) : null}
                {category ? (
                  <span className="rounded-full bg-surface-muted px-3 py-1">
                    {category}
                  </span>
                ) : null}
                {condition ? (
                  <span className="rounded-full bg-surface-muted px-3 py-1">
                    {condition}
                  </span>
                ) : null}
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight text-app sm:text-4xl">
                  {listing.title || 'Marketplace Listing'}
                </h1>
                <p className="text-base leading-7 text-app-text-secondary">
                  {listing.description || 'No description provided.'}
                </p>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-app bg-surface p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-secondary">
                Seller
              </p>
              <p className="mt-2 text-xl font-semibold text-app">{sellerName}</p>
              {location ? (
                <p className="mt-2 text-sm text-app-text-secondary">{location}</p>
              ) : null}
            </div>

            <div className="rounded-3xl border border-app bg-surface p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-secondary">
                Price
              </p>
              <p className="mt-2 text-2xl font-semibold text-app">{price}</p>
              {listing.quantity != null ? (
                <p className="mt-3 text-sm text-app-text-secondary">
                  Quantity available: {listing.quantity}
                </p>
              ) : null}
            </div>

            <div className="rounded-3xl border border-app bg-surface p-6 shadow-sm">
              <p className="text-sm leading-6 text-app-text-secondary">
                Open this listing in Pantopus to message the seller, make an offer, or save it.
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <OpenInAppButton
                  appUrl={buildListingAppUrl(id)}
                  linkHref={buildListingShareUrl(id)}
                  fallbackUrl={fallbackUrl}
                  className="rounded-full bg-primary-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-primary-700"
                >
                  Open Listing
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
