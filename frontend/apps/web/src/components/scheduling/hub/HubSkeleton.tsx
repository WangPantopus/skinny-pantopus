"use client";

// A1 — loading skeleton. Shimmer placeholders mirror the populated layout
// (summary card, booking-link card, toggle, agenda rows, manage group). Never
// a "Loading…" string.

function Bar({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-app-surface-sunken ${className ?? ""}`}
    />
  );
}

export default function HubSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <Bar className="h-[120px] w-full rounded-2xl" />
      <Bar className="h-[300px] w-full rounded-2xl" />
      <Bar className="h-[60px] w-full rounded-2xl" />
      <div className="space-y-2 pt-2">
        <Bar className="h-3 w-32" />
        {[0, 1].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-app-border bg-app-surface p-3"
          >
            <Bar className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Bar className="h-3 w-2/3" />
              <Bar className="h-2.5 w-2/5" />
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2 pt-2">
        <Bar className="h-3 w-20" />
        <Bar className="h-[230px] w-full rounded-xl" />
      </div>
    </div>
  );
}
