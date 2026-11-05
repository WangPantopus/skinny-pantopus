'use client';

import { Suspense, type ComponentType } from 'react';
import { useSearchParams, type ReadonlyURLSearchParams } from 'next/navigation';

export type SearchParamsProps = { searchParams: ReadonlyURLSearchParams | null };

/**
 * Renders an auth page's content with the address's query string.
 *
 * These pages are prerendered, and a build can't know the query, so reading it with `useSearchParams` sent the
 * pages out empty: nothing showed until their scripts had downloaded and run. The build now renders the same
 * content without a query as the fallback, so the page is in the HTML from the first byte (its form stays
 * disabled until it hydrates; see AuthForm). In the browser the content renders with the real query and takes
 * the fallback's place before anything can be typed, so every behavior is the query-aware one. The query is
 * only read in the browser, so tokens in it never reach the HTML.
 */
export default function WithSearchParams({ Content }: { Content: ComponentType<SearchParamsProps> }) {
  return (
    <Suspense fallback={<Content searchParams={null} />}>
      <ContentWithQuery Content={Content} />
    </Suspense>
  );
}

function ContentWithQuery({ Content }: { Content: ComponentType<SearchParamsProps> }) {
  return <Content searchParams={useSearchParams()} />;
}
