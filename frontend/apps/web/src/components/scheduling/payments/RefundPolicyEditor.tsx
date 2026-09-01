"use client";

// W14 · G14 — Cancellation & Refund Policy editor. Four preset radio-cards
// (Flexible / Moderate / Strict / Custom); choosing Custom reveals A14.6-style
// rows (cutoff, refund-after-cutoff %, non-refundable deposit, no-show). A live
// "What the invitee sees" preview renders the W0 CancellationPolicy component —
// the exact sentence shown at checkout. Saves cancellation_policy via
// PUT /booking-page. Business violet accent; no dark patterns.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Clock,
  Eye,
  Lock,
  Minus,
  Percent,
  Plus,
  UserX,
} from "lucide-react";
import clsx from "clsx";
import * as api from "@pantopus/api";
import type { SchedulingOwnerRef } from "@pantopus/types";
import CancellationPolicy from "@/components/scheduling/CancellationPolicy";
import { decodeError } from "@/components/scheduling/decodeError";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import ErrorState from "@/components/ui/ErrorState";
import { toast } from "@/components/ui/toast-store";
import { Card } from "./kit";
import {
  CUTOFF_STEPS,
  CustomPolicy,
  DEFAULT_CUSTOM,
  PRESETS,
  PresetKey,
  REFUND_STEPS,
  cutoffLabel,
  fromCancellationPolicy,
  toCancellationPolicy,
} from "./policyPresets";

function PresetCard({
  name,
  summary,
  selected,
  onSelect,
}: {
  name: string;
  summary: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={clsx(
        "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors",
        selected
          ? "border-[1.5px] border-app-business bg-app-business-bg"
          : "border border-app-border bg-app-surface shadow-sm hover:bg-app-hover",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-app-text">{name}</div>
        <div className="mt-0.5 text-xs text-app-text-secondary">{summary}</div>
      </div>
      <span
        className={clsx(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
          selected
            ? "bg-app-business text-white"
            : "border-[1.5px] border-app-border-strong",
        )}
      >
        {selected && (
          <Check className="h-3 w-3" strokeWidth={3.2} aria-hidden />
        )}
      </span>
    </button>
  );
}

/** +/- stepper over a fixed list of allowed values. */
function StepRow({
  icon: Icon,
  label,
  value,
  display,
  steps,
  onChange,
  last,
}: {
  icon: typeof Clock;
  label: string;
  value: number;
  display: string;
  steps: number[];
  onChange: (next: number) => void;
  last?: boolean;
}) {
  const idx = Math.max(0, steps.indexOf(value));
  const dec = () => onChange(steps[Math.max(0, idx - 1)]);
  const inc = () => onChange(steps[Math.min(steps.length - 1, idx + 1)]);
  return (
    <div
      className={clsx(
        "flex items-center gap-3 px-4 py-3",
        !last && "border-b border-app-border-subtle",
      )}
    >
      <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-app-surface-sunken text-app-text-strong">
        <Icon className="h-[15px] w-[15px]" aria-hidden />
      </span>
      <div className="flex-1 text-sm font-semibold text-app-text">{label}</div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={dec}
          disabled={idx === 0}
          aria-label={`Decrease ${label}`}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-app-border bg-app-surface text-app-text-strong transition hover:bg-app-hover disabled:opacity-40"
        >
          <Minus className="h-3.5 w-3.5" aria-hidden />
        </button>
        <span className="min-w-[2.75rem] text-center text-sm font-bold tabular-nums text-app-business">
          {display}
        </span>
        <button
          type="button"
          onClick={inc}
          disabled={idx === steps.length - 1}
          aria-label={`Increase ${label}`}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-app-border bg-app-surface text-app-business transition hover:bg-app-hover disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function CustomRows({
  value,
  onChange,
}: {
  value: CustomPolicy;
  onChange: (next: CustomPolicy) => void;
}) {
  return (
    <Card>
      <StepRow
        icon={Clock}
        label="Free-cancellation cutoff"
        value={value.cutoffHours}
        display={cutoffLabel(value.cutoffHours)}
        steps={CUTOFF_STEPS}
        onChange={(cutoffHours) => onChange({ ...value, cutoffHours })}
      />
      <StepRow
        icon={Percent}
        label="Refund after cutoff"
        value={value.refundPctAfter}
        display={`${value.refundPctAfter}%`}
        steps={REFUND_STEPS}
        onChange={(refundPctAfter) => onChange({ ...value, refundPctAfter })}
      />
      <div className="flex items-center gap-3 border-b border-app-border-subtle px-4 py-3">
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-app-surface-sunken text-app-text-strong">
          <Lock className="h-[15px] w-[15px]" aria-hidden />
        </span>
        <div className="flex-1 text-sm font-semibold text-app-text">
          Deposit is non-refundable
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={value.depositNonRefundable}
          aria-label="Deposit is non-refundable"
          onClick={() =>
            onChange({
              ...value,
              depositNonRefundable: !value.depositNonRefundable,
            })
          }
          className={clsx(
            "relative h-7 w-12 shrink-0 rounded-full transition-colors",
            value.depositNonRefundable
              ? "bg-app-business"
              : "bg-app-border-strong",
          )}
        >
          <span
            className={clsx(
              "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all",
              value.depositNonRefundable ? "left-[1.375rem]" : "left-0.5",
            )}
          />
        </button>
      </div>
      <button
        type="button"
        onClick={() =>
          onChange({
            ...value,
            noShow:
              value.noShow === "charge_full" ? "no_charge" : "charge_full",
          })
        }
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-app-hover"
      >
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-app-surface-sunken text-app-text-strong">
          <UserX className="h-[15px] w-[15px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-app-text">
            No-show handling
          </div>
          <div className="mt-0.5 text-xs text-app-text-secondary">
            {value.noShow === "charge_full" ? "Charge full price" : "No charge"}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-app-text-muted" aria-hidden />
      </button>
    </Card>
  );
}

export default function RefundPolicyEditor({
  owner,
}: {
  owner?: SchedulingOwnerRef;
}) {
  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [selected, setSelected] = useState<PresetKey>("flexible");
  const [custom, setCustom] = useState<CustomPolicy>(DEFAULT_CUSTOM);

  useEffect(() => {
    let alive = true;
    setPhase("loading");
    api.scheduling
      .getBookingPage(owner)
      .then((res) => {
        if (!alive) return;
        const init = fromCancellationPolicy(res.page?.cancellation_policy);
        setSelected(init.selected);
        setCustom(init.custom);
        setDirty(false);
        setPhase("ready");
      })
      .catch(() => {
        if (alive) setPhase("error");
      });
    return () => {
      alive = false;
    };
  }, [owner, reloadKey]);

  const policy = useMemo(
    () => toCancellationPolicy(selected, custom),
    [selected, custom],
  );

  const pickPreset = useCallback((key: PresetKey) => {
    setSelected(key);
    setDirty(true);
  }, []);

  const updateCustom = useCallback((next: CustomPolicy) => {
    setCustom(next);
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await api.scheduling.updateBookingPage(
        { cancellation_policy: policy },
        owner,
      );
      toast.success("Cancellation policy saved.");
      setDirty(false);
    } catch (err) {
      toast.error(decodeError(err).message);
    } finally {
      setSaving(false);
    }
  }, [policy, owner]);

  if (phase === "loading") {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <ShimmerBlock key={i} className="h-[68px] rounded-2xl" />
        ))}
        <ShimmerBlock className="mt-2 h-20 rounded-xl" />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <ErrorState
        message="We couldn't load your policy."
        onRetry={() => setReloadKey((k) => k + 1)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2 pb-28">
      {PRESETS.map((p) => (
        <PresetCard
          key={p.key}
          name={p.name}
          summary={p.summary}
          selected={selected === p.key}
          onSelect={() => pickPreset(p.key)}
        />
      ))}

      {selected === "custom" && (
        <div className="mt-1">
          <CustomRows value={custom} onChange={updateCustom} />
        </div>
      )}

      {/* Live "what the invitee sees" preview (W0 renderer). */}
      <div className="mt-3 rounded-xl bg-app-business-bg p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-app-business" aria-hidden />
          <span className="text-[10px] font-bold uppercase tracking-wider text-app-business">
            What the invitee sees
          </span>
        </div>
        <CancellationPolicy
          policy={policy}
          className="border-none shadow-none"
        />
      </div>
      <p className="px-1 text-xs leading-snug text-app-text-secondary">
        {selected === "flexible"
          ? "Flexible is the friendliest — most people start here."
          : "Invitees see this wording before they pay."}
      </p>

      {/* Sticky save bar. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-app-border-subtle bg-gradient-to-t from-app-bg via-app-bg to-transparent px-4 pb-6 pt-3 lg:left-60">
        <div className="mx-auto max-w-6xl lg:pl-8">
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-app-business text-sm font-bold text-white shadow-sm transition hover:opacity-95 disabled:opacity-45 sm:w-auto sm:px-8"
          >
            {saving ? "Saving…" : dirty ? "Save policy" : "Saved"}
          </button>
        </div>
      </div>
    </div>
  );
}
