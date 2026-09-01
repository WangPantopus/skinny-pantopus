// Compact segmented control themed to the active pillar. Shared by the
// find-a-time duration / round-robin rule pickers and the who's-free Day/Week
// toggle.

import clsx from "clsx";
import {
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";

export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  pillar = "home",
  size = "md",
  ariaLabel,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  pillar?: Pillar;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  const tk = pillarTokens(pillar);
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex gap-1 rounded-lg bg-app-surface-muted p-1"
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={clsx(
              "flex-1 rounded-md font-semibold transition-colors",
              size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm",
              on
                ? clsx(tk.bg, tk.textOn, "shadow-sm")
                : "text-app-text-secondary hover:text-app-text",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
