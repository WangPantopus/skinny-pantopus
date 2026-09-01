// Shared chrome for the first-class scheduling states (paused / secret /
// expired / unavailable / no-availability). A single status-driven layout —
// centered muted icon halo, headline, one-line body, an optional state
// affordance, and the shared "Back to Pantopus / Get the app" dock. Mirrors
// the Support Train public "not shareable" layout. Neutral chrome; the pillar
// accent appears only on the Get-the-app CTA.
//
// Presentational + server-safe: interactive affordances (code input, notify-me)
// are passed in as `children` by the consuming stream.

import type { ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { IOS_APP_STORE_URL } from "@pantopus/utils";
import { pillarTokens, type Pillar } from "../pillarTokens";

export interface TerminalStateProps {
  icon: LucideIcon;
  title: string;
  body?: string;
  /** State-specific affordance rendered above the dock. */
  children?: ReactNode;
  /** Pillar accent for the Get-the-app CTA only. */
  pillar?: Pillar;
  className?: string;
}

export default function TerminalState({
  icon: Icon,
  title,
  body,
  children,
  pillar = "personal",
  className,
}: TerminalStateProps) {
  const tk = pillarTokens(pillar);
  return (
    <main
      className={clsx(
        "flex min-h-screen items-center justify-center bg-app px-6 py-16 text-app",
        className,
      )}
    >
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-app-surface-muted">
          <Icon className="h-7 w-7 text-app-text-muted" aria-hidden />
        </div>
        <h1 className="text-xl font-bold text-app-text-strong">{title}</h1>
        {body && (
          <p className="mx-auto mt-2 max-w-sm text-sm text-app-text-muted">
            {body}
          </p>
        )}
        {children && <div className="mt-6">{children}</div>}
        {/* Dock: design order — Get the app (filled primary) first, Back to Pantopus (ghost) below */}
        <div className="mt-10 flex flex-col items-center gap-3">
          {IOS_APP_STORE_URL && (
            <a
              href={IOS_APP_STORE_URL}
              className={clsx(
                "inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold",
                tk.bg,
                tk.textOn,
              )}
            >
              Get the app
            </a>
          )}
          <Link
            href="/"
            className="text-sm font-medium text-app-text-secondary hover:text-app-text"
          >
            Back to Pantopus
          </Link>
        </div>
      </div>
    </main>
  );
}
