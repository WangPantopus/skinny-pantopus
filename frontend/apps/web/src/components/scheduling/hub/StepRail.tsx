"use client";

// Numbered step rail for the first-run wizard (A2) and onboarding (A6).
// Discs check-on-done with 2px connectors; the active step gets a ring; an
// overline reads "You're on step X of N". Accent keys off the pillar.

import clsx from "clsx";
import { Check } from "lucide-react";
import { Fragment } from "react";
import {
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";

export interface WizardStep {
  n: number;
  label: string;
}

export default function StepRail({
  steps,
  current,
  done = [],
  pillar,
}: {
  steps: WizardStep[];
  current: number;
  done?: number[];
  pillar: Pillar;
}) {
  const tk = pillarTokens(pillar);
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-app-text-secondary">
        You’re on step {current} of {steps.length}
      </p>
      <div className="flex items-center gap-1 rounded-xl border border-app-border bg-app-surface px-3 py-2.5">
        {steps.map((s, i) => {
          const isDone = done.includes(s.n) || s.n < current;
          const active = s.n === current;
          return (
            <Fragment key={s.n}>
              <div className="flex shrink-0 flex-col items-center gap-1">
                <div
                  className={clsx(
                    "flex h-[22px] w-[22px] items-center justify-center rounded-full text-[10.5px] font-bold",
                    isDone || active
                      ? clsx(tk.bg, tk.textOn)
                      : "bg-app-surface-sunken text-app-text-muted",
                    active &&
                      clsx(
                        "ring-2 ring-offset-2 ring-offset-app-surface",
                        tk.ring,
                      ),
                  )}
                >
                  {isDone ? (
                    <Check
                      className="h-2.5 w-2.5"
                      strokeWidth={3}
                      aria-hidden
                    />
                  ) : (
                    s.n
                  )}
                </div>
                <span
                  className={clsx(
                    "text-[9.5px]",
                    active
                      ? clsx("font-bold", tk.text)
                      : isDone
                        ? "font-medium text-app-text-strong"
                        : "font-medium text-app-text-muted",
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={clsx(
                    "mb-3.5 h-0.5 flex-1 rounded-full",
                    s.n < current || done.includes(s.n)
                      ? tk.bg
                      : "bg-app-border",
                  )}
                />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
