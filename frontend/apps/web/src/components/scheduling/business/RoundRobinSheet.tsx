"use client";

// G1 — Round-Robin Assignment sheet. Opened from the Assignment list (which the
// W2 event editor links here for "Who can be booked"). Pick the fairness rule
// (balanced/priority/strict), choose which members rotate, and set weights when
// balanced. Saving REPLACES the assignee set (PUT /event-types/:id/assignees)
// and sets assignment_mode='round_robin'. Business violet accents; sky CTA.
// Frames mirrored: default · loading · none-selected (warning, Done disabled) ·
// single-member (rotation-needs-two note).

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  GripVertical,
  Info,
  ListOrdered,
  Repeat,
  Scale,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import * as api from "@pantopus/api";
import type { EventTypeAssignee, SchedulingOwnerRef } from "@pantopus/types";
import BottomSheet from "@/components/ui/BottomSheet";
import { toast } from "@/components/ui/toast-store";
import { decodeError, fieldErrors } from "@/components/scheduling/decodeError";
import {
  Checkbox,
  MemberAvatar,
  Note,
  PrimaryButton,
  RuleTile,
  Skeleton,
} from "./ui";
import type { TeamMemberView } from "./members";
import {
  ROUND_ROBIN_RULES,
  type RoundRobinRule,
  type RoundRobinSelection,
  buildRoundRobinAssignees,
  canSaveRoundRobin,
  clampWeight,
  rotationActive,
  selectionFromAssignees,
} from "./assignees";

const RULE_ICON: Record<RoundRobinRule, LucideIcon> = {
  balanced: Scale,
  priority: ListOrdered,
  strict: Repeat,
};

function WeightStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="inline-flex shrink-0 items-center gap-1">
      <button
        type="button"
        aria-label="Lower weight"
        onClick={() => onChange(clampWeight(value - 1))}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-app-border bg-app-surface text-app-text-secondary"
      >
        <span className="text-sm leading-none">−</span>
      </button>
      <span className="min-w-[2rem] rounded-full bg-app-business-bg px-2 py-0.5 text-center text-[11px] font-bold tabular-nums text-app-business">
        ×{value}
      </span>
      <button
        type="button"
        aria-label="Raise weight"
        onClick={() => onChange(clampWeight(value + 1))}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-app-border bg-app-surface text-app-business"
      >
        <span className="text-sm leading-none">+</span>
      </button>
    </div>
  );
}

export default function RoundRobinSheet({
  open,
  onClose,
  owner,
  eventTypeId,
  eventTypeName,
  roster,
  initialAssignees,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  owner: SchedulingOwnerRef;
  eventTypeId: string;
  eventTypeName: string;
  roster: TeamMemberView[];
  initialAssignees: EventTypeAssignee[];
  onSaved?: (assignees: EventTypeAssignee[]) => void;
}) {
  const rosterIds = useMemo(() => roster.map((m) => m.id), [roster]);
  const [sel, setSel] = useState<RoundRobinSelection>(() =>
    selectionFromAssignees(initialAssignees, rosterIds),
  );
  const [loading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Re-hydrate whenever the sheet opens for a (possibly different) event type.
  useEffect(() => {
    if (open) setSel(selectionFromAssignees(initialAssignees, rosterIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eventTypeId]);

  const orderedRoster = useMemo(() => {
    const byId = new Map(roster.map((m) => [m.id, m]));
    const ordered = sel.order
      .map((id) => byId.get(id))
      .filter(Boolean) as TeamMemberView[];
    // Append any roster members not yet in the order (defensive).
    for (const m of roster) if (!sel.order.includes(m.id)) ordered.push(m);
    return ordered;
  }, [roster, sel.order]);

  const selectedCount = orderedRoster.filter((m) =>
    sel.selected.has(m.id),
  ).length;
  const canSave = canSaveRoundRobin(sel);

  const toggleMember = (id: string) => {
    setSel((s) => {
      const next = new Set(s.selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...s, selected: next };
    });
  };

  const setWeight = (id: string, n: number) =>
    setSel((s) => ({ ...s, weights: { ...s.weights, [id]: n } }));

  const setRule = (rule: RoundRobinRule) => setSel((s) => ({ ...s, rule }));

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const assignees = buildRoundRobinAssignees(sel);
      // Persist the mode first so availability/slotting treats it as a team type.
      await api.scheduling.updateEventType(
        eventTypeId,
        { assignment_mode: "round_robin" },
        owner,
      );
      const { assignees: saved } = await api.scheduling.updateAssignees(
        eventTypeId,
        assignees,
        owner,
      );
      toast.success("Rotation updated");
      onSaved?.(saved);
      onClose();
    } catch (err) {
      const decoded = decodeError(err);
      const fe = fieldErrors(decoded);
      toast.error(
        fe["assignees"] || (decoded.message ?? "Couldn’t update the rotation"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={saving ? () => {} : onClose}
      footer={
        <PrimaryButton onClick={save} disabled={!canSave} loading={saving}>
          {saving ? "Saving" : "Done"}
        </PrimaryButton>
      }
    >
      <div className="space-y-3">
        <div>
          <h3 className="text-base font-bold text-app-text">Assign bookings</h3>
          <p className="mt-1 text-xs text-app-text-secondary">
            New bookings rotate across the members you pick for{" "}
            <span className="font-semibold text-app-text">{eventTypeName}</span>
            .
          </p>
        </div>

        <div role="radiogroup" aria-label="Rotation rule" className="space-y-2">
          {ROUND_ROBIN_RULES.map((r) => (
            <RuleTile
              key={r.id}
              icon={RULE_ICON[r.id]}
              name={r.name}
              desc={r.desc}
              selected={sel.rule === r.id}
              onClick={() => setRule(r.id)}
            />
          ))}
        </div>

        <p className="px-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-app-business">
          Bookable members
        </p>

        {!canSave && (
          <Note tone="warning" icon={AlertTriangle}>
            Pick at least one member to take bookings.
          </Note>
        )}

        {loading ? (
          <div className="rounded-2xl border border-app-border bg-app-surface">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-3"
                style={{
                  borderBottom:
                    i === 3 ? undefined : "1px solid var(--app-border)",
                }}
              >
                <Skeleton className="h-[22px] w-[22px] rounded-md" />
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="mt-1.5 h-2 w-2/3" />
                </div>
                <Skeleton className="h-6 w-14 rounded-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface">
            {orderedRoster.map((m, i) => {
              const checked = sel.selected.has(m.id);
              return (
                <div
                  key={m.id}
                  className={
                    "flex items-center gap-3 px-3 py-2.5" +
                    (i === orderedRoster.length - 1
                      ? ""
                      : " border-b border-app-border")
                  }
                >
                  <button
                    type="button"
                    aria-label={`${checked ? "Remove" : "Add"} ${m.name}`}
                    onClick={() => toggleMember(m.id)}
                    className="flex items-center gap-3"
                  >
                    <Checkbox on={checked} />
                    <MemberAvatar id={m.id} name={m.name} dim={!checked} />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleMember(m.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-[13px] font-semibold text-app-text">
                      {m.name}
                    </p>
                    <p className="truncate text-[10.5px] text-app-text-secondary">
                      {m.isYou
                        ? "You · uses personal availability"
                        : "Uses personal availability"}
                    </p>
                  </button>
                  {checked &&
                    (sel.rule === "balanced" ? (
                      <WeightStepper
                        value={clampWeight(sel.weights[m.id] ?? 1)}
                        onChange={(n) => setWeight(m.id, n)}
                      />
                    ) : sel.rule === "priority" ? (
                      <GripVertical
                        className="h-5 w-5 shrink-0 text-app-text-muted"
                        aria-hidden
                      />
                    ) : null)}
                </div>
              );
            })}
          </div>
        )}

        {canSave && rotationActive(sel) && (
          <Note tone="info" icon={Repeat}>
            New bookings rotate across {selectedCount} members, weighted by your
            settings.
          </Note>
        )}
        {canSave && !rotationActive(sel) && (
          <Note tone="info" icon={Info}>
            Rotation needs two or more members. Bookings go to the one selected
            member for now.
          </Note>
        )}
      </div>
    </BottomSheet>
  );
}
