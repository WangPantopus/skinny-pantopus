// W6 · D2 — the money block on the review/checkout step. Mirrors the A09.4
// Invoice totals: a line-item row, a hero total in the host pillar accent, and
// (for deposits) a "Due now / Balance at your visit" split. The public payload
// only exposes price_cents + deposit_cents, so we render those honestly — no
// fabricated service-fee / tax rows. Free event types render no money block
// (the parent shows the refund/policy line only).

"use client";

import clsx from "clsx";
import type { PublicEventType } from "@pantopus/types";
import { pillarTokens, type Pillar } from "@/components/scheduling";
import {
  balanceCents,
  dueNowCents,
  formatCents,
  priceMode,
} from "./confirmUtils";

function Overline({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-app-text-secondary">
      {children}
    </p>
  );
}

export default function ReviewSummary({
  eventType,
  lineLabel,
  pillar,
}: {
  eventType: PublicEventType;
  /** e.g. "Intro call · 30 min". */
  lineLabel: string;
  pillar: Pillar;
}) {
  const mode = priceMode(eventType);
  if (mode === "free") return null;

  const tk = pillarTokens(pillar);
  const currency = eventType.currency || "usd";

  return (
    <section>
      <Overline>Price</Overline>
      <div className="overflow-hidden rounded-xl border border-app-border bg-app-surface">
        <div className="bg-app-surface-muted px-3.5 py-2.5">
          <div className="flex justify-between py-1 text-[12.5px] font-semibold text-app-text">
            <span>{lineLabel}</span>
            <span className="tabular-nums">
              {formatCents(eventType.price_cents, currency)}
            </span>
          </div>

          <div className="my-2 h-px bg-app-border" />

          {mode === "full" ? (
            <div className="flex items-baseline justify-between py-0.5">
              <span className="text-[13px] font-bold text-app-text">Total</span>
              <span
                className={clsx(
                  "text-[22px] font-extrabold tabular-nums tracking-tight",
                  tk.text,
                )}
              >
                {formatCents(eventType.price_cents, currency)}
              </span>
            </div>
          ) : (
            <div className="space-y-1.5 py-0.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-bold text-app-text">
                  Due now
                </span>
                <span
                  className={clsx(
                    "text-[22px] font-extrabold tabular-nums tracking-tight",
                    tk.text,
                  )}
                >
                  {formatCents(dueNowCents(eventType), currency)}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11.5px] font-medium text-app-text-secondary">
                  Balance at your visit
                </span>
                <span className="text-[13px] font-semibold tabular-nums text-app-text-strong">
                  {formatCents(balanceCents(eventType), currency)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {mode === "deposit" && (
        <p className="mt-2 text-[11px] leading-4 text-app-text-secondary">
          You pay a{" "}
          <b className="font-bold text-app-text-strong">
            {formatCents(dueNowCents(eventType), currency)} deposit
          </b>{" "}
          now. The rest is due at your visit.
        </p>
      )}
    </section>
  );
}
