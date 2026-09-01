'use client';

import { useEffect } from 'react';

function clearWebAppStorage() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.clear();
  } catch {}
  try {
    sessionStorage.clear();
  } catch {}
}

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[RootError]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-app flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-xl border border-app bg-surface p-6 text-center">
        <h1 className="text-lg font-semibold text-app mb-2">We hit a page error</h1>
        <p className="text-sm text-app-secondary mb-5">
          If this came from stale browser data, you can safely clear local cache and reload.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="px-4 py-2 rounded-lg border border-app text-sm hover-bg-app"
          >
            Try again
          </button>
          <button
            onClick={() => {
              clearWebAppStorage();
              window.location.reload();
            }}
            className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-700"
          >
            Clear app cache and reload
          </button>
        </div>
      </div>
    </div>
  );
}
