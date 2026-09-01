"use client";

// W16 · H4 — Trigger Picker. A local bottom sheet (no global route) opened from
// the workflow editor. Lists the five triggers with plain-English descriptions;
// the offset for timed triggers is configured back in the editor.

import { Check } from "lucide-react";
import clsx from "clsx";
import type { WorkflowTrigger } from "@pantopus/types";
import BottomSheet from "@/components/ui/BottomSheet";
import {
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";
import { IconTile } from "./kit";
import { TRIGGERS } from "./workflowMeta";

export default function TriggerPicker({
  open,
  value,
  pillar = "personal",
  onSelect,
  onClose,
}: {
  open: boolean;
  value: WorkflowTrigger;
  pillar?: Pillar;
  onSelect: (trigger: WorkflowTrigger) => void;
  onClose: () => void;
}) {
  const tk = pillarTokens(pillar);
  return (
    <BottomSheet open={open} onClose={onClose} title="When should this run?">
      <div className="max-h-[60vh] overflow-y-auto p-3">
        <div className="space-y-1.5">
          {TRIGGERS.map((t) => {
            const active = t.id === value;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onSelect(t.id);
                  onClose();
                }}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                  active
                    ? clsx(tk.border, tk.bgSoft)
                    : "border-app-border bg-app-surface hover:bg-app-hover",
                )}
              >
                <IconTile icon={t.icon} pillar={pillar} muted={!active} />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-app-text">
                    {t.label}
                  </div>
                  <div className="mt-0.5 text-[12px] text-app-text-secondary">
                    {t.description}
                  </div>
                </div>
                {active && (
                  <Check
                    className={clsx("h-4 w-4 shrink-0", tk.text)}
                    strokeWidth={3}
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
}
