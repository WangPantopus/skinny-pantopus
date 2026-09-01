"use client";

// W16 · H1 — Default Reminders Quick-Setup. Pick the lead-times that auto-attach
// to every event you own. Backed by GET/PUT /notification-preferences, writing
// `scheduling.reminder_minutes` (the same key A4 uses) while round-tripping every
// other pref key untouched. Personal sky pillar (themes green/violet elsewhere).

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Bell, BellOff, Check, CheckCircle2, Circle, Mail, Plus, X } from "lucide-react";
import * as api from "@pantopus/api";
import type {
  NotificationPreferences,
  SchedulingOwnerRef,
} from "@pantopus/types";
import { useSchedulingOwner } from "@/components/scheduling/SchedulingOwnerProvider";
import {
  pillarForOwner,
  pillarTokens,
} from "@/components/scheduling/pillarTokens";
import { decodeError } from "@/components/scheduling/decodeError";
import { toast } from "@/components/ui/toast-store";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import ErrorState from "@/components/ui/ErrorState";
import {
  CUSTOM_UNITS,
  REMINDER_OPTIONS,
  customToMinutes,
  readReminders,
  reminderRowLabel,
  writeReminders,
  type CustomUnit,
  type Prefs,
} from "./reminders";

function sameSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

export default function RemindersQuickSetup() {
  const owner: SchedulingOwnerRef = useSchedulingOwner();
  const pillar = pillarForOwner(owner.ownerType);
  const tk = pillarTokens(pillar);

  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Push-permission gate (Frame 4): read browser Notification.permission.
  // 'denied' means user has blocked push; 'default' means not yet asked.
  // 'granted' = no banner. Undefined when API is not available (SSR/non-browser).
  const [pushOff, setPushOff] = useState(false);

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setPushOff(Notification.permission === "denied");
    }
  }, []);

  const requestPush = () => {
    if (typeof Notification === "undefined") return;
    void Notification.requestPermission().then((perm) => {
      setPushOff(perm === "denied");
    });
  };

  const [adding, setAdding] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [customUnit, setCustomUnit] = useState<CustomUnit>("hours");

  const load = useCallback(async () => {
    setPhase("loading");
    try {
      const { prefs: loaded } =
        await api.scheduling.getNotificationPreferences(owner);
      const p = (loaded ?? {}) as Prefs;
      setPrefs(p);
      setSelected(readReminders(p));
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, [owner]);

  useEffect(() => {
    void load();
  }, [load]);

  // Render the presets plus any saved/added custom lead-times, sorted desc.
  const rows = useMemo(() => {
    const presets = REMINDER_OPTIONS.map((o) => o.minutes);
    const extras = selected.filter((m) => !presets.includes(m));
    const all = [...new Set([...presets, ...extras])].sort((a, b) => b - a);
    return all;
  }, [selected]);

  const dirty = prefs ? !sameSet(selected, readReminders(prefs)) : false;

  const toggle = (min: number) => {
    setSaved(false);
    setSelected((cur) =>
      cur.includes(min) ? cur.filter((m) => m !== min) : [...cur, min],
    );
  };

  const addCustom = () => {
    const mins = customToMinutes(Number(customValue), customUnit);
    if (mins === null) {
      toast.error("Enter a positive number.");
      return;
    }
    if (selected.includes(mins)) {
      toast.info("That reminder is already on.");
    } else {
      setSelected((cur) => [...cur, mins]);
      setSaved(false);
    }
    setCustomValue("");
    setAdding(false);
  };

  const save = async () => {
    if (!prefs) return;
    setSaving(true);
    try {
      const next = writeReminders(prefs, selected);
      const { prefs: updated } =
        await api.scheduling.updateNotificationPreferences(
          next as NotificationPreferences,
          owner,
        );
      const merged = (updated ?? next) as Prefs;
      setPrefs(merged);
      setSelected(readReminders(merged));
      setSaved(true);
      toast.success("Reminders saved. They'll apply to new events.");
    } catch (err) {
      toast.error(decodeError(err).message || "Couldn't save reminders");
    } finally {
      setSaving(false);
    }
  };

  if (phase === "loading") {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <ShimmerBlock className="h-7 w-48 rounded-lg" />
        <ShimmerBlock className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (phase === "error" || !prefs) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState
          message="We couldn't load your reminders."
          onRetry={() => void load()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-24">
      <header>
        <p
          className={clsx(
            "mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em]",
            tk.text,
          )}
        >
          Reminders &amp; automations
        </p>
        <h1 className="text-xl font-bold text-app-text">Default reminders</h1>
        <p className="mt-0.5 text-sm text-app-text-secondary">
          Times come from each event you own. Per-event overrides stay.
        </p>
      </header>

      <p className="text-[12.5px] leading-5 text-app-text-secondary">
        Pick the lead-times that attach to every event you own. We pre-picked
        the two most people keep — change them anytime.
      </p>

      {/* Frame 4 — push-permission gated banner */}
      {pushOff && (
        <div className="flex items-center gap-2.5 rounded-xl border border-app-warning-light bg-app-warning-bg px-3 py-3">
          <BellOff
            className="h-4 w-4 shrink-0 text-app-warning"
            aria-hidden
          />
          <span className="flex-1 text-[11.5px] font-semibold leading-[15px] text-app-warning">
            Push is off in your browser settings. Email still works.
          </span>
          <button
            type="button"
            onClick={requestPush}
            className="shrink-0 text-[11.5px] font-bold text-app-info"
          >
            Enable
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-app-border bg-app-surface">
        <div className="divide-y divide-app-border-subtle">
          {rows.map((min) => {
            const on = selected.includes(min);
            return (
              <div key={min} className="px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => toggle(min)}
                  aria-pressed={on}
                  className="flex w-full items-center gap-3 text-left"
                >
                  {on ? (
                    <CheckCircle2
                      className={clsx("h-[21px] w-[21px] shrink-0", tk.text)}
                      strokeWidth={2.4}
                      aria-hidden
                    />
                  ) : (
                    <Circle
                      className="h-[21px] w-[21px] shrink-0 text-app-border-strong"
                      aria-hidden
                    />
                  )}
                  <span
                    className={clsx(
                      "text-[14px]",
                      on
                        ? "font-semibold text-app-text"
                        : "font-medium text-app-text-secondary",
                    )}
                  >
                    {reminderRowLabel(min)}
                  </span>
                </button>
                {on && (
                  <div className="ml-[33px] mt-2 flex items-center gap-1.5">
                    <span
                      className={clsx(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold",
                        tk.bgSoft,
                        tk.text,
                      )}
                    >
                      <Bell className="h-2.5 w-2.5" aria-hidden />
                      Push
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-app-border bg-app-surface px-2.5 py-1 text-[10.5px] font-semibold text-app-text-secondary">
                      <Mail className="h-2.5 w-2.5" aria-hidden />
                      Email
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add custom time */}
      {adding ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-app-border bg-app-surface p-3">
          <input
            type="number"
            min={1}
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="e.g. 2"
            className="w-24 rounded-lg border border-app-border bg-app-surface px-3 py-2 text-[14px] text-app-text focus:border-app-personal focus:outline-none focus:ring-2 focus:ring-app-personal/30"
            aria-label="Custom amount"
          />
          <select
            value={customUnit}
            onChange={(e) => setCustomUnit(e.target.value as CustomUnit)}
            className="rounded-lg border border-app-border bg-app-surface px-3 py-2 text-[14px] text-app-text focus:border-app-personal focus:outline-none focus:ring-2 focus:ring-app-personal/30"
            aria-label="Custom unit"
          >
            {CUSTOM_UNITS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label} before
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addCustom}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-primary-700"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setCustomValue("");
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-app-text-muted transition hover:bg-app-hover"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-app-border-strong bg-app-surface px-3.5 py-2 text-[12.5px] font-semibold text-app-text-secondary transition hover:bg-app-hover"
        >
          <Plus className={clsx("h-3.5 w-3.5", tk.text)} aria-hidden />
          Add custom time
        </button>
      )}

      <p className="text-[12px] leading-5 text-app-text-secondary">
        Reminders are delivered by push and email per your{" "}
        <Link
          href="/app/scheduling/settings/notifications"
          className={clsx(
            "font-semibold underline-offset-2 hover:underline",
            tk.text,
          )}
        >
          notification settings
        </Link>
        .
      </p>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-app-border bg-app-surface/95 backdrop-blur lg:left-60">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          {saved && !dirty ? (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-app-success">
              <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
              Reminders saved
            </span>
          ) : (
            <span className="text-[12.5px] text-app-text-secondary">
              {selected.length === 0
                ? "No reminders — attendees still get their confirmation."
                : `${selected.length} reminder${selected.length > 1 ? "s" : ""} selected`}
            </span>
          )}
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !dirty}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
