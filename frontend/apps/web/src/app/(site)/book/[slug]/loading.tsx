// C5 loading skeleton — shown during the server fetch of the booking landing.
// Mirrors the design's loading frame: plain banner, profile card, event rows.

export default function Loading() {
  return (
    <div
      className="mx-auto w-full max-w-md pb-2"
      aria-busy="true"
      aria-label="Loading booking page"
    >
      <div className="h-28 w-full rounded-t-2xl bg-app-surface-sunken" />
      <div className="-mt-9 px-4">
        <div className="rounded-2xl border border-app-border bg-app-surface p-4 shadow-sm">
          <div className="-mt-12 h-16 w-16 animate-pulse rounded-full border-[3px] border-app-surface bg-app-surface-muted" />
          <div className="mt-3 h-4 w-40 animate-pulse rounded bg-app-surface-muted" />
          <div className="mt-2.5 h-3 w-28 animate-pulse rounded bg-app-surface-muted" />
          <div className="mt-3 h-3 w-[90%] animate-pulse rounded bg-app-surface-muted" />
        </div>
      </div>
      <div className="flex flex-col gap-2.5 px-4 pt-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-2xl bg-app-surface-muted"
          />
        ))}
      </div>
    </div>
  );
}
