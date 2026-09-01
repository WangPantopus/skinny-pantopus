import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  buildCanonicalAppUrlForPost,
  buildCanonicalPathForPost,
  buildCanonicalShareUrlForPost,
  buildPostAppUrl,
  buildPostShareUrl,
} from '@pantopus/utils';
import {
  buildShareMetadata,
  displayNameForUser,
  fetchPublicPost,
  formatLocationLine,
  getStoreDownloadCta,
  pickPreviewImage,
  summarizeText,
} from '@/lib/publicShare';
import OpenInAppButton from '@/components/public-share/OpenInAppButton';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await fetchPublicPost(id);
  const post = result.data;

  if (!post) {
    return {
      title: 'Post Not Available | Pantopus',
      description: result.status === 403
        ? 'This post is not publicly shareable.'
        : 'This Pantopus post could not be found.',
    };
  }

  const metaShareRef = {
    id,
    ref_task_id: post.ref_task_id ?? null,
    ref_listing_id: post.ref_listing_id ?? null,
  };

  return buildShareMetadata({
    title: post.title || post.post_type || 'Pantopus post',
    description: summarizeText(
      post.content,
      160,
      'See this post on Pantopus.'
    ),
    path: buildCanonicalPathForPost(metaShareRef),
    appArgument: buildCanonicalAppUrlForPost(metaShareRef),
    image: pickPreviewImage(post.media_urls, post.media_live_urls),
  });
}

export default async function PublicPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await fetchPublicPost(id);
  const post = result.data;
  const userAgent = (await headers()).get('user-agent') || '';
  const storeCta = getStoreDownloadCta(userAgent);
  const fallbackUrl = storeCta?.href ?? null;

  if (!post && result.status === 404) {
    notFound();
  }

  if (!post) {
    return (
      <main className="min-h-screen bg-app text-app">
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-4 text-center sm:px-6">
          <p className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-app-text-secondary">
            Post Share
          </p>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-app">
            This post isn&apos;t publicly shareable
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-app-text-secondary">
            The link works, but this post can only be viewed by people who have access in Pantopus
            or by recipients of an explicit external share.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <OpenInAppButton
              appUrl={buildPostAppUrl(id)}
              linkHref={buildPostShareUrl(id)}
              fallbackUrl={fallbackUrl}
              className="rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
            >
              Open In Pantopus
            </OpenInAppButton>
            {storeCta ? (
              <a
                href={storeCta.href}
                className="rounded-full border border-app px-5 py-2.5 text-sm font-semibold text-app hover:bg-surface-muted"
              >
                {storeCta.label}
              </a>
            ) : null}
            <Link
              href="/"
              className="rounded-full border border-app px-5 py-2.5 text-sm font-semibold text-app hover:bg-surface-muted"
            >
              Back To Pantopus
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const creatorName = displayNameForUser(post.creator, 'Pantopus neighbor');
  const image = pickPreviewImage(post.media_urls, post.media_live_urls);
  const location = formatLocationLine(
    post.location_name,
    post.creator?.city,
    post.creator?.state
  );
  const shareRef = {
    id,
    ref_task_id: post.ref_task_id ?? null,
    ref_listing_id: post.ref_listing_id ?? null,
  };

  return (
    <main className="min-h-screen bg-app text-app">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-semibold text-app hover:opacity-80">
            Pantopus
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href={buildCanonicalShareUrlForPost(shareRef)}
              className="text-sm text-app-text-secondary hover:text-app"
            >
              Canonical URL
            </Link>
            <OpenInAppButton
              appUrl={buildCanonicalAppUrlForPost(shareRef)}
              linkHref={buildCanonicalShareUrlForPost(shareRef)}
              fallbackUrl={fallbackUrl}
              className="rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              Open In App
            </OpenInAppButton>
          </div>
        </div>

        <article className="overflow-hidden rounded-3xl border border-app bg-surface shadow-sm">
          {image ? (
            <div className="aspect-[16/9] w-full bg-surface-muted">
              <img
                src={image}
                alt={post.title || 'Pantopus post'}
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}

          <div className="space-y-5 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-app-text-secondary">
              <span className="rounded-full bg-primary-50 px-3 py-1 text-primary-700">
                {post.post_type || 'Post'}
              </span>
              {post.state ? (
                <span className="rounded-full bg-surface-muted px-3 py-1">
                  {String(post.state).replace(/_/g, ' ')}
                </span>
              ) : null}
            </div>

            <div>
              {post.title ? (
                <h1 className="text-3xl font-semibold tracking-tight text-app sm:text-4xl">
                  {post.title}
                </h1>
              ) : null}
              <p className="mt-3 text-base leading-7 text-app-text-secondary whitespace-pre-wrap">
                {post.content || ''}
              </p>
            </div>

            <div className="rounded-2xl bg-surface-muted px-4 py-3 text-sm text-app-text-secondary">
              <span className="font-semibold text-app">{creatorName}</span>
              {location ? ` · ${location}` : ''}
              {post.created_at ? ` · ${new Date(post.created_at).toLocaleString()}` : ''}
            </div>
          </div>
        </article>

        <div className="mt-6 rounded-3xl border border-app bg-surface p-6 shadow-sm">
          <p className="text-sm leading-6 text-app-text-secondary">
            Open this post in Pantopus to reply, react, and keep up with the conversation.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <OpenInAppButton
              appUrl={buildCanonicalAppUrlForPost(shareRef)}
              linkHref={buildCanonicalShareUrlForPost(shareRef)}
              fallbackUrl={fallbackUrl}
              className="rounded-full bg-primary-600 px-5 py-2.5 text-center text-sm font-semibold text-white hover:bg-primary-700"
            >
              Open In Pantopus
            </OpenInAppButton>
            {storeCta ? (
              <a
                href={storeCta.href}
                className="rounded-full border border-app px-5 py-2.5 text-center text-sm font-semibold text-app hover:bg-surface-muted"
              >
                {storeCta.label}
              </a>
            ) : null}
            <Link
              href="/"
              className="rounded-full border border-app px-5 py-2.5 text-center text-sm font-semibold text-app hover:bg-surface-muted"
            >
              Back To Pantopus
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
