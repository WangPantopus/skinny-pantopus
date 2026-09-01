"use client";

// A1 — identity pillar switcher. Re-scopes the whole hub between Personal /
// Home / Business; the accent keys off the active pillar. Owner refs are
// resolved read-only (useHubOwners); pillars without a resolved owner still
// switch (the hub renders a tailored empty state).

import clsx from "clsx";
import { House, Store, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";
import { PILLARS, PILLAR_LABEL } from "./owners";

const ICONS: Record<Pillar, LucideIcon> = {
  personal: User,
  home: House,
  business: Store,
};

export default function IdentitySwitcher({
  active,
  onSelect,
}: {
  active: Pillar;
  onSelect: (pillar: Pillar) => void;
}) {
  return (
    <div className="flex gap-1.5 rounded-full border border-app-border bg-app-surface p-1">
      {PILLARS.map((p) => {
        const on = p === active;
        const Icon = ICONS[p];
        const tk = pillarTokens(p);
        return (
          <button
            key={p}
            type="button"
            onClick={() => onSelect(p)}
            aria-pressed={on}
            className={clsx(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition-colors",
              on
                ? clsx(tk.bg, tk.textOn)
                : "text-app-text-strong hover:bg-app-hover",
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
            {PILLAR_LABEL[p]}
          </button>
        );
      })}
    </div>
  );
}
