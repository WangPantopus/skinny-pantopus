"use client";

// W16 · H6 — Variable Picker. A local panel (no global route) the template editor
// toggles open. Each chip inserts a {{token}} into the body at the caret; the
// editor owns the textarea selection and the actual insertion.

import clsx from "clsx";
import { Braces } from "lucide-react";
import {
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";
import { VARIABLES } from "./templateMeta";

export default function VariablePicker({
  pillar = "personal",
  onInsert,
}: {
  pillar?: Pillar;
  onInsert: (token: string) => void;
}) {
  const tk = pillarTokens(pillar);
  return (
    <div className="rounded-xl border border-app-border bg-app-surface-sunken p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-app-text-secondary">
        <Braces className="h-3 w-3" aria-hidden />
        Insert a variable
      </p>
      <div className="flex flex-wrap gap-1.5">
        {VARIABLES.map((v) => (
          <button
            key={v.token}
            type="button"
            onClick={() => onInsert(v.token)}
            title={`Inserts {{${v.token}}} — e.g. "${v.sample}"`}
            className={clsx(
              "inline-flex items-center gap-1 rounded-full border bg-app-surface px-2.5 py-1 text-[11.5px] font-semibold transition-colors hover:bg-app-hover",
              "border-app-border text-app-text-strong",
            )}
          >
            <span className={clsx("font-mono text-[10.5px]", tk.text)}>
              {`{{`}
            </span>
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
