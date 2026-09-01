"use client";

// W8 — the inbox scope row (All / Personal / Home / Business). The active pill
// fills in that scope's identity color; "All" uses the neutral primary accent.
// Only rendered when more than one pillar is available (else there's nothing to
// scope between).

import clsx from "clsx";
import {
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";
import {
  availablePillars,
  PILLAR_LABEL,
  type Scope,
  type ScopeOwners,
} from "./owners";

export default function ScopePills({
  scope,
  onScope,
  owners,
}: {
  scope: Scope;
  onScope: (next: Scope) => void;
  owners: ScopeOwners;
}) {
  const pillars = availablePillars(owners);
  const list: Array<{ key: Scope; label: string; pillar?: Pillar }> = [
    { key: "all", label: "All" },
    ...pillars.map((p) => ({
      key: p as Scope,
      label: PILLAR_LABEL[p],
      pillar: p,
    })),
  ];

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {list.map((item) => {
        const on = scope === item.key;
        const tk = item.pillar ? pillarTokens(item.pillar) : null;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onScope(item.key)}
            aria-pressed={on}
            className={clsx(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
              on
                ? tk
                  ? clsx(tk.bg, tk.textOn)
                  : "bg-primary-600 text-white"
                : "border border-app-border bg-app-surface text-app-text-secondary hover:bg-app-hover",
            )}
          >
            {item.pillar && (
              <span
                className={clsx(
                  "h-1.5 w-1.5 rounded-full",
                  on ? "bg-white/90" : tk!.bg,
                )}
                aria-hidden
              />
            )}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
