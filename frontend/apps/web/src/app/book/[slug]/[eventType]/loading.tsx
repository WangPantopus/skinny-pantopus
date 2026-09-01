// C6 loading skeleton — shown during the server fetch of the slot picker shell.

export default function Loading() {
  return (
    <div
      className="mx-auto w-full max-w-md"
      aria-busy="true"
      aria-label="Loading the slot picker"
    >
      <div className="flex h-12 items-center border-b border-app-border bg-app-surface px-4">
        <div className="mx-auto h-4 w-24 animate-pulse rounded bg-app-surface-muted" />
      </div>
      <div className="space-y-3 px-4 py-3">
        <div className="h-16 animate-pulse rounded-2xl bg-app-surface-muted" />
        <div className="h-8 w-44 animate-pulse rounded-full bg-app-surface-muted" />
        <div className="h-64 animate-pulse rounded-2xl bg-app-surface-muted" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-lg bg-app-surface-muted"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
