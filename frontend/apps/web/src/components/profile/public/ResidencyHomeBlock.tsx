'use client';

export type ResidencyPayload = {
  hasHome?: boolean;
  city?: string | null;
  state?: string | null;
  verified?: boolean;
};

const COPY = {
  noHomePlace: 'Location not listed',
  homeNoPlace: 'Location not specified',
  unverified: 'Residency unverified',
  verified: 'Verified Resident',
} as const;

function homePlaceText(r: ResidencyPayload | null | undefined): string {
  if (!r?.hasHome) return COPY.noHomePlace;
  const place = [r.city, r.state].filter(Boolean).join(', ');
  return place || COPY.homeNoPlace;
}

export default function ResidencyHomeBlock({
  residency,
  dense = false,
}: {
  residency?: ResidencyPayload | null;
  /** Tighter spacing for cards (e.g. my profile sidebar) */
  dense?: boolean;
}) {
  const place = homePlaceText(residency ?? undefined);
  const gap = dense ? 'mt-2' : 'mt-1';

  return (
    <div className={dense ? '' : ''}>
      <p className={`text-sm text-app-secondary ${gap} flex items-center gap-1.5 flex-wrap`}>
        <span className="font-semibold text-app">Home:</span>
        <svg
          className="w-4 h-4 shrink-0 text-rose-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>{place}</span>
      </p>

      {residency?.hasHome &&
        (residency.verified ? (
          <div
            className={`${dense ? 'mt-2' : 'mt-2'} inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200`}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            {COPY.verified}
          </div>
        ) : (
          <div
            className={`${dense ? 'mt-2' : 'mt-2'} inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100`}
          >
            <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
            {COPY.unverified}
          </div>
        ))}
    </div>
  );
}

export { homePlaceText, COPY };
