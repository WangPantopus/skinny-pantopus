"use client";

// F4 — Find a Time · Setup. The household composes a request: title, who's
// needed (required vs optional), collective vs round-robin, duration and a date
// window. Submit is triggered by the page-level "Next" top-bar button via the
// exposed onSubmit prop. Times come from each member's personal availability —
// this never edits anyone's calendar; it only overlaps free/busy.

import { useMemo, useState } from "react";
import {
  CalendarRange,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  Info,
  Layers,
  Lock,
  Minus,
  Plus,
  Repeat,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import type { FindATimeMode } from "@pantopus/types";
import ErrorState from "@/components/ui/ErrorState";
import MemberAvatar from "./MemberAvatar";
import Segmented from "./Segmented";
import { rangeLabel } from "./format";
import type { MemberView } from "./members";

export interface FindATimeConfig {
  title: string;
  requiredIds: string[];
  optionalIds: string[];
  mode: FindATimeMode;
  durationMin: number;
  fromKey: string;
  toKey: string;
}

type Role = "required" | "optional";

function Overline({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-app-home">
      {children}
    </p>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-app-border bg-app-surface p-4">
      {children}
    </section>
  );
}

// ----- Sub-components --------------------------------------------------------

/** A +/- stepper. min/max enforced; step defaults to 5. */
function Stepper({
  value,
  min,
  max,
  step = 5,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  return (
    <div className="mt-3 flex items-center gap-3">
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        aria-label="Decrease"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-app-border bg-app-surface text-app-text-secondary transition hover:bg-app-hover disabled:opacity-40"
      >
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <span className="min-w-[56px] text-center text-sm font-bold text-app-text">
        {value} min
      </span>
      <button
        type="button"
        onClick={inc}
        disabled={value >= max}
        aria-label="Increase"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-app-border bg-app-surface text-app-text-secondary transition hover:bg-app-hover disabled:opacity-40"
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

const HOW_IT_WORKS: Array<[LucideIcon, string]> = [
  [UserCheck, "Each member sets their own free/busy hours in Personal."],
  [
    Layers,
    "Pantopus overlays everyone you pick and keeps only the shared free time.",
  ],
  [Lock, "No one's calendar is edited. Booking a slot adds one new event."],
];

export default function FindATimeSetup({
  members,
  membersLoading,
  membersError,
  onRetryMembers,
  defaultFrom,
  defaultTo,
  onSubmit,
  submitRef,
}: {
  members: MemberView[];
  membersLoading: boolean;
  membersError: string | null;
  onRetryMembers: () => void;
  defaultFrom: string;
  defaultTo: string;
  onSubmit: (config: FindATimeConfig) => void;
  /** Imperative handle: page calls submitRef.current?.() to trigger validation + submit */
  submitRef?: React.MutableRefObject<(() => void) | null>;
}) {
  const [title, setTitle] = useState("");
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [mode, setMode] = useState<FindATimeMode>("collective");
  const [rrRule, setRrRule] = useState("fair");
  const [duration, setDuration] = useState("30");
  const [customDurationMin, setCustomDurationMin] = useState(45);
  const [fromKey, setFromKey] = useState(defaultFrom);
  const [toKey, setToKey] = useState(defaultTo);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [explain, setExplain] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // Members default to required until explicitly set optional.
  const roleFor = (id: string): Role => roles[id] ?? "required";

  const requiredIds = useMemo(
    () =>
      members
        .filter((m) => (roles[m.userId] ?? "required") === "required")
        .map((m) => m.userId),
    [members, roles],
  );
  const optionalIds = useMemo(
    () =>
      members
        .filter((m) => (roles[m.userId] ?? "required") === "optional")
        .map((m) => m.userId),
    [members, roles],
  );

  const noneRequired = members.length > 0 && requiredIds.length === 0;
  const badRange = !fromKey || !toKey || toKey < fromKey;
  const durationMin =
    duration === "custom"
      ? Math.max(5, customDurationMin)
      : parseInt(duration, 10);

  const setRole = (id: string, role: Role) =>
    setRoles((r) => ({ ...r, [id]: role }));

  const submit = () => {
    if (noneRequired || badRange) {
      setShowErrors(true);
      return;
    }
    onSubmit({
      title: title.trim() || "Find a time",
      requiredIds,
      optionalIds,
      mode,
      durationMin,
      fromKey,
      toKey,
    });
  };

  // Expose submit via ref so the page-level "Next" button can trigger it.
  if (submitRef) submitRef.current = submit;

  return (
    <div className="space-y-4">
      {/* Explainer */}
      <div className="rounded-xl border border-app-info-light bg-app-info-bg p-3">
        <div className="flex items-start gap-2.5">
          <Info
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-app-info"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium leading-relaxed text-app-info">
              Times come from each member&apos;s personal availability. Pantopus
              finds the overlap — it never changes anyone&apos;s calendar.
            </p>
            {explain && (
              <ul className="mt-2.5 space-y-2 border-t border-app-info-light pt-2.5">
                {HOW_IT_WORKS.map(([Icon, text]) => (
                  <li key={text} className="flex items-start gap-2">
                    <Icon
                      className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-app-info"
                      aria-hidden
                    />
                    <span className="text-[11px] leading-snug text-app-text-secondary">
                      {text}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setExplain((v) => !v)}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-app-info"
            >
              {explain ? "Hide" : "How this works"}
              {explain ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Title + category */}
      <Card>
        <label
          htmlFor="fat-title"
          className="mb-1.5 block text-xs font-semibold text-app-text-strong"
        >
          Title
        </label>
        <input
          id="fat-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Plan a family call"
          className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2.5 text-sm text-app-text outline-none focus:border-app-home"
        />
        <p className="mb-1.5 mt-3 text-xs font-semibold text-app-text-secondary">
          Category
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-app-home-bg px-3 py-1.5 text-xs font-bold text-app-home">
          <span className="h-2 w-2 rounded-full bg-app-home" />
          Family
        </span>
      </Card>

      {/* Who's needed */}
      <Card>
        <Overline>Who&apos;s needed</Overline>
        {membersLoading ? (
          <div
            className="space-y-3"
            aria-busy="true"
            aria-label="Loading household"
          >
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 animate-pulse rounded-full bg-app-surface-muted" />
                <div className="h-3 w-24 animate-pulse rounded bg-app-surface-muted" />
                <div className="ml-auto h-7 w-28 animate-pulse rounded-lg bg-app-surface-muted" />
              </div>
            ))}
          </div>
        ) : membersError ? (
          <ErrorState message={membersError} onRetry={onRetryMembers} />
        ) : members.length === 0 ? (
          <p className="py-4 text-center text-sm text-app-text-secondary">
            No household members found. Invite people to your home to coordinate
            times.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-app-border">
              {members.map((m) => {
                const role = roleFor(m.userId);
                const invalid = showErrors && noneRequired;
                return (
                  <li key={m.userId} className="flex items-center gap-3 py-2.5">
                    <div className="relative">
                      <MemberAvatar member={m} size="md" />
                      {role === "required" && (
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-app-surface bg-app-home">
                          <Check
                            className="h-2 w-2 text-white"
                            strokeWidth={4}
                            aria-hidden
                          />
                        </span>
                      )}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-app-text">
                      {m.name}
                    </span>
                    <div
                      className={clsx(
                        "flex gap-0.5 rounded-lg p-0.5",
                        invalid
                          ? "bg-app-error-bg ring-1 ring-app-error-light"
                          : "bg-app-surface-muted",
                      )}
                    >
                      {(["required", "optional"] as Role[]).map((opt) => {
                        const on = role === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setRole(m.userId, opt)}
                            aria-pressed={on}
                            className={clsx(
                              "rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors",
                              on &&
                                opt === "required" &&
                                "bg-app-home text-white",
                              on &&
                                opt === "optional" &&
                                "bg-app-surface text-app-text-secondary shadow-sm",
                              !on && "text-app-text-muted",
                            )}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
            {showErrors && noneRequired && (
              <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-app-error">
                <CircleAlert className="h-3 w-3" aria-hidden /> Mark at least
                one member as required
              </p>
            )}
          </>
        )}
      </Card>

      {/* How it works (mode) */}
      <Card>
        <Overline>How it works</Overline>
        <div className="flex gap-2.5">
          {[
            {
              k: "collective" as const,
              icon: Users,
              title: "Collective",
              line: "Everyone free",
            },
            {
              k: "round_robin" as const,
              icon: Repeat,
              title: "Round-robin",
              line: "One covers",
            },
          ].map((t) => {
            const on = t.k === mode;
            const Icon = t.icon;
            return (
              <button
                key={t.k}
                type="button"
                onClick={() => setMode(t.k)}
                aria-pressed={on}
                className={clsx(
                  "flex flex-1 flex-col gap-2 rounded-xl border p-3 text-left transition-colors",
                  on
                    ? "border-app-home bg-app-home-bg"
                    : "border-app-border bg-app-surface hover:bg-app-hover",
                )}
              >
                <div className="flex items-center justify-between">
                  <Icon
                    className={clsx(
                      "h-[18px] w-[18px]",
                      on ? "text-app-home" : "text-app-text-muted",
                    )}
                    aria-hidden
                  />
                  {on && (
                    <Check className="h-4 w-4 text-app-home" aria-hidden />
                  )}
                </div>
                <div>
                  <p
                    className={clsx(
                      "text-sm font-bold",
                      on ? "text-app-home" : "text-app-text",
                    )}
                  >
                    {t.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-app-text-secondary">
                    {t.line}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-2.5 text-[11px] text-app-text-secondary">
          {mode === "collective"
            ? "Finds times when everyone required is free at once."
            : "Whoever's free gets it. Pick a rule for who covers."}
        </p>
      </Card>

      {/* Round-robin rule */}
      {mode === "round_robin" && (
        <Card>
          <Overline>Round-robin rule</Overline>
          <Segmented
            options={[
              { value: "fair", label: "Fair rotation" },
              { value: "role", label: "By role" },
            ]}
            value={rrRule}
            onChange={setRrRule}
            ariaLabel="Round-robin rule"
          />
        </Card>
      )}

      {/* Duration */}
      <Card>
        <Overline>Duration</Overline>
        <Segmented
          options={[
            { value: "30", label: "30 min" },
            { value: "60", label: "1 hr" },
            { value: "custom", label: "Custom" },
          ]}
          value={duration}
          onChange={setDuration}
          ariaLabel="Duration"
        />
        {duration === "custom" && (
          <Stepper
            value={customDurationMin}
            min={5}
            max={480}
            step={5}
            onChange={setCustomDurationMin}
          />
        )}
      </Card>

      {/* Date window — tappable row (design: DateWindow chevron-right, no raw inputs visible) */}
      <Card>
        <Overline>Date window</Overline>
        <button
          type="button"
          onClick={() => setDatePickerOpen((v) => !v)}
          aria-expanded={datePickerOpen}
          className={clsx(
            "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left",
            showErrors && badRange
              ? "border-app-error bg-app-error-bg"
              : "border-app-border bg-app-surface hover:bg-app-hover",
          )}
        >
          <CalendarRange
            className={clsx(
              "h-4 w-4 flex-shrink-0",
              showErrors && badRange ? "text-app-error" : "text-app-home",
            )}
            aria-hidden
          />
          <span
            className={clsx(
              "flex-1 text-xs font-semibold",
              showErrors && badRange ? "text-app-error" : "text-app-text",
            )}
          >
            {rangeLabel(fromKey, toKey)}
          </span>
          <ChevronRight
            className="h-4 w-4 flex-shrink-0 text-app-text-muted"
            aria-hidden
          />
        </button>
        {datePickerOpen && (
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <label className="block text-[11px] font-semibold text-app-text-secondary">
              From
              <input
                type="date"
                value={fromKey}
                onChange={(e) => setFromKey(e.target.value)}
                className="mt-1 w-full rounded-lg border border-app-border bg-app-surface px-2.5 py-2 text-xs text-app-text outline-none focus:border-app-home"
              />
            </label>
            <label className="block text-[11px] font-semibold text-app-text-secondary">
              To
              <input
                type="date"
                value={toKey}
                min={fromKey}
                onChange={(e) => setToKey(e.target.value)}
                className="mt-1 w-full rounded-lg border border-app-border bg-app-surface px-2.5 py-2 text-xs text-app-text outline-none focus:border-app-home"
              />
            </label>
          </div>
        )}
        {showErrors && badRange && (
          <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-app-error">
            <CircleAlert className="h-3 w-3" aria-hidden /> Pick an end date on
            or after the start date
          </p>
        )}
      </Card>
    </div>
  );
}
