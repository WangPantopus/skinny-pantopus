// C5 — inline state card shown beneath the booker profile when the page is
// paused or has no event types yet. Keeps the host's identity visible (the
// design surfaces the profile, not a full-screen takeover). Presentational +
// server-safe. The W0 full-screen state views are used only for hard failures
// (not found / unavailable) where there is no booker context.

import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

export default function ProfileStateCard({
  icon: Icon,
  title,
  body,
  dashed = false,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  dashed?: boolean;
}) {
  return (
    <div className="px-4 pt-4">
      <div
        className={clsx(
          "flex flex-col items-center gap-2.5 rounded-2xl bg-app-surface px-5 py-6 text-center",
          dashed
            ? "border border-dashed border-app-border-strong"
            : "border border-app-border shadow-sm",
        )}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-app-surface-sunken text-app-text-secondary">
          <Icon className="h-5 w-5" strokeWidth={1.9} aria-hidden />
        </span>
        <p className="text-sm font-semibold text-app-text">{title}</p>
        <p className="max-w-[16rem] text-xs leading-relaxed text-app-text-secondary">
          {body}
        </p>
      </div>
    </div>
  );
}
