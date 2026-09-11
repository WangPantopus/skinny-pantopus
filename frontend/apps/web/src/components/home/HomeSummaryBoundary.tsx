'use client';

import type { ReactNode } from 'react';

export default function HomeSummaryBoundary({ title, error, loading, onRetry, children }: {
  title: string; error: string | null; loading: boolean; onRetry: () => void; children: ReactNode;
}) {
  if (error) return (
    <section aria-label={title} className="rounded-xl border border-app-border bg-app-surface p-5">
      <h3 className="font-semibold text-app-text">{title}</h3>
      <p role="alert" className="mt-2 text-sm text-app-text-secondary">{error}</p>
      <button type="button" onClick={onRetry} disabled={loading} className="mt-3 rounded-lg border border-app-border px-3 py-2 text-sm font-medium disabled:opacity-50">
        Retry {title.toLowerCase()}
      </button>
    </section>
  );
  return <div aria-label={title} aria-busy={loading}>{children}</div>;
}
