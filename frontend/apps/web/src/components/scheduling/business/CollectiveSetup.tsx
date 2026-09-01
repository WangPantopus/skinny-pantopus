"use client";

// G2 — Collective Event Setup sheet. Several members must all be free for one
// slot. Toggle collective on, pick required members + seats per appointment;
// saving sets assignment_mode='collective', writes the assignee set, and stores
// seat capacity. When the chosen members have no shared opening (intersection of
// their free grids is empty) we surface the no-overlap warning. Business violet
// accents; sky CTA. Frames: off · on · no-overlap · saving.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  GitMerge,
  Info,
  UserCheck,
  Users,
  UsersRound,
} from "lucide-react";
import * as api from "@pantopus/api";
import type { EventTypeAssignee, SchedulingOwnerRef } from "@pantopus/types";
import BottomSheet from "@/components/ui/BottomSheet";
import { toast } from "@/components/ui/toast-store";
import { decodeError } from "@/components/scheduling/decodeError";
import {
  AccentOverline,
  Card,
  Checkbox,
  MemberAvatar,
  Note,
  PrimaryButton,
  Stepper,
} from "./ui";
import type { TeamMemberView } from "./members";
import { intersectFreeWindows } from "./members";
import { buildCollectiveAssignees } from "./assignees";

type CollectiveMode = "specific" | "anyN";

const EXPLAIN =
  "Times come from where every required member is free. Fewer common openings means fewer slots.";

function MasterToggleCard({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <Card className="px-3 py-3">
      <button
        type="button"
        onClick={() => onChange(!on)}
        className="flex w-full items-center gap-3 text-left"
      >
        <span
          className={
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg " +
            (on
              ? "bg-app-business-bg text-app-business"
              : "bg-app-surface-sunken text-app-text-secondary")
          }
        >
          <UsersRound className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-bold text-app-text">
            Require multiple staff
          </span>
          <span className="mt-0.5 block text-[11px] text-app-text-secondary">
            Several members must be free at once.
          </span>
        </span>
        <span
          role="switch"
          aria-checked={on}
          className={
            "relative h-7 w-12 shrink-0 rounded-full transition-colors " +
            (on ? "bg-app-business" : "bg-app-border-strong")
          }
        >
          <span
            className={
              "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all " +
              (on ? "left-[22px]" : "left-0.5")
            }
          />
        </span>
      </button>
    </Card>
  );
}

function ModeTiles({
  value,
  onChange,
}: {
  value: CollectiveMode;
  onChange: (m: CollectiveMode) => void;
}) {
  const opts: { id: CollectiveMode; label: string; icon: typeof UserCheck }[] =
    [
      { id: "specific", label: "Specific members", icon: UserCheck },
      { id: "anyN", label: "Any N of a group", icon: Users },
    ];
  return (
    <div className="flex gap-2">
      {opts.map((o) => {
        const on = o.id === value;
        const Icon = o.icon;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={
              "flex flex-1 flex-col items-start gap-2 rounded-xl border px-3 py-3 text-left " +
              (on
                ? "border-app-business bg-app-business-bg"
                : "border-app-border bg-app-surface hover:bg-app-hover")
            }
          >
            <Icon
              className={
                "h-[18px] w-[18px] " +
                (on ? "text-app-business" : "text-app-text-secondary")
              }
              aria-hidden
            />
            <span className="text-[11.5px] font-bold leading-tight text-app-text">
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CountCard({
  label,
  sub,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  sub: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
}) {
  return (
    <Card className="flex items-center gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-app-text">{label}</p>
        <p className="mt-0.5 text-[11px] text-app-text-secondary">{sub}</p>
      </div>
      <Stepper
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        accent
        ariaLabel={label}
      />
    </Card>
  );
}

export default function CollectiveSetup({
  open,
  onClose,
  owner,
  eventTypeId,
  eventTypeName: _eventTypeName,
  roster,
  initialAssignees,
  initialSeatCap,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  owner: SchedulingOwnerRef;
  eventTypeId: string;
  eventTypeName: string;
  roster: TeamMemberView[];
  initialAssignees: EventTypeAssignee[];
  initialSeatCap: number;
  onSaved?: (assignees: EventTypeAssignee[]) => void;
}) {
  const hydrate = useCallback(() => {
    const active = initialAssignees.filter((a) => a.is_active !== false);
    return {
      on: active.length > 0,
      selected: new Set(active.map((a) => a.subject_id)),
    };
  }, [initialAssignees]);

  const [on, setOn] = useState<boolean>(() => hydrate().on);
  const [selected, setSelected] = useState<Set<string>>(
    () => hydrate().selected,
  );
  const [mode, setMode] = useState<CollectiveMode>("specific");
  const [requiredCount, setRequiredCount] = useState(2);
  const [seats, setSeats] = useState(Math.max(1, initialSeatCap || 1));
  const [saving, setSaving] = useState(false);
  const [freeByMember, setFreeByMember] = useState<Record<
    string,
    { start: string; end: string }[]
  > | null>(null);

  useEffect(() => {
    if (!open) return;
    const h = hydrate();
    setOn(h.on);
    setSelected(h.selected);
    setSeats(Math.max(1, initialSeatCap || 1));
    setRequiredCount(Math.max(2, h.selected.size || 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eventTypeId]);

  const selectedIds = useMemo(
    () => roster.filter((m) => selected.has(m.id)).map((m) => m.id),
    [roster, selected],
  );
  const selectedKey = selectedIds.join(",");

  // Detect a no-overlap situation: fetch the team's free grids and intersect
  // the chosen members' windows. Empty intersection → warn (don't block save).
  useEffect(() => {
    if (!open || !on || selectedIds.length < 2) {
      setFreeByMember(null);
      return;
    }
    let cancelled = false;
    const today = new Date();
    const to = new Date(today);
    to.setDate(to.getDate() + 14);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    (async () => {
      try {
        const res = await api.scheduling.getTeamAvailability(
          { from: iso(today), to: iso(to) },
          owner,
        );
        if (!cancelled) {
          const map: Record<string, { start: string; end: string }[]> = {};
          for (const [k, v] of Object.entries(res.freeByMember ?? {}))
            map[k] = (v ?? []).map((s) => ({ start: s.start, end: s.end }));
          setFreeByMember(map);
        }
      } catch {
        if (!cancelled) setFreeByMember(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // selectedKey captures the selected-id set for the dependency check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, on, owner, selectedKey]);

  const noOverlap = useMemo(() => {
    if (!freeByMember || selectedIds.length < 2) return false;
    return intersectFreeWindows(freeByMember, selectedIds).length === 0;
  }, [freeByMember, selectedIds]);

  const toggleMember = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (!on) {
        // Collective off → back to one-on-one, clear the team assignee set.
        await api.scheduling.updateEventType(
          eventTypeId,
          { assignment_mode: "one_on_one" },
          owner,
        );
        const { assignees } = await api.scheduling.updateAssignees(
          eventTypeId,
          [],
          owner,
        );
        toast.success("Collective booking turned off");
        onSaved?.(assignees);
        onClose();
        return;
      }
      await api.scheduling.updateEventType(
        eventTypeId,
        { assignment_mode: "collective", seat_cap: Math.max(1, seats) },
        owner,
      );
      const { assignees } = await api.scheduling.updateAssignees(
        eventTypeId,
        buildCollectiveAssignees(selectedIds),
        owner,
      );
      toast.success("Collective booking saved");
      onSaved?.(assignees);
      onClose();
    } catch (err) {
      toast.error(
        decodeError(err).message || "Couldn’t save collective booking",
      );
    } finally {
      setSaving(false);
    }
  };

  const saveDisabled = on && selectedIds.length < 2;

  return (
    <BottomSheet
      open={open}
      onClose={saving ? () => {} : onClose}
      title="Collective booking"
      subhead="Every required member must be free at the same time."
      footer={
        <PrimaryButton onClick={save} disabled={saveDisabled} loading={saving}>
          {saving ? "Saving" : "Save"}
        </PrimaryButton>
      }
    >
      <div className="space-y-3">
        <MasterToggleCard on={on} onChange={setOn} />

        {!on ? (
          <Note tone="info" icon={Info}>
            Turn on if a booking needs more than one person.
          </Note>
        ) : (
          <div className="space-y-3">
            <CountCard
              label="Required staff"
              sub="How many must be free"
              value={requiredCount}
              onChange={(n) => setRequiredCount(Math.max(1, n))}
              min={1}
              max={Math.max(2, roster.length)}
            />
            <ModeTiles value={mode} onChange={setMode} />

            {noOverlap && (
              <Note tone="warning" icon={AlertTriangle}>
                The chosen members have no shared openings in the next two
                weeks. Widen their hours or drop a member.
              </Note>
            )}

            <div>
              <AccentOverline>Members</AccentOverline>
              <div className="mt-2">
                <Card>
                  {roster.map((m, i) => {
                    const checked = selected.has(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMember(m.id)}
                        className={
                          "flex w-full items-center gap-3 px-3 py-2.5 text-left" +
                          (i === roster.length - 1
                            ? ""
                            : " border-b border-app-border")
                        }
                      >
                        <Checkbox on={checked} />
                        <MemberAvatar id={m.id} name={m.name} dim={!checked} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-app-text">
                            {m.name}
                          </span>
                          <span className="block truncate text-[10.5px] text-app-text-secondary">
                            {m.role}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </Card>
              </div>
            </div>

            <CountCard
              label="Seats per appointment"
              sub="Capacity for each slot"
              value={seats}
              onChange={(n) => setSeats(Math.max(1, n))}
              min={1}
              max={50}
            />

            <Note tone="info" icon={GitMerge}>
              {EXPLAIN}
            </Note>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
