"use client";

// W2 — Event Types. B2 Event Type / Service editor (create + edit in one form).
// owner_type drives the pillar accent (pill + overlines); all functional chrome
// is product-blue. Save uses PUT partial semantics — priced fields are only
// included when schedulingPaid is on, so they're never clobbered when hidden.
// Intake questions (B3) open as a local sheet here and persist on their own.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import {
  Bell,
  CalendarClock,
  ChevronLeft,
  CircleCheck,
  EyeOff,
  Gauge,
  ListChecks,
  UserCheck,
  X,
} from "lucide-react";
import * as api from "@pantopus/api";
import type { IntakeQuestion } from "@pantopus/types";
import { webFeatureFlags } from "@/lib/featureFlags";
import { toast } from "@/components/ui/toast-store";
import BottomSheet from "@/components/ui/BottomSheet";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import ErrorState from "@/components/ui/ErrorState";
import { useSchedulingOwner } from "@/components/scheduling/SchedulingOwnerProvider";
import {
  pillarForOwner,
  pillarTokens,
} from "@/components/scheduling/pillarTokens";
import { decodeError, fieldErrors } from "@/components/scheduling/decodeError";
import {
  ColorSwatches,
  EditorCard,
  FieldLabel,
  LinkRow,
  PillarPill,
  QuickChip,
  Segmented,
  Stepper,
  TextAreaField,
  TextField,
  ToggleRow,
} from "./fields";
import PricingFields from "./PricingFields";
import IntakeQuestionsEditor from "./IntakeQuestionsEditor";
import {
  DURATION_PRESETS,
  EVENT_TYPE_COLORS,
  LOCATION_MODES,
  MAX_DURATION,
  MIN_DURATION,
  defaultFormValues,
  eventTypeToForm,
  formToInput,
  slugify,
  suffixSlug,
  validateForm,
  type EventTypeFormValues,
} from "./eventTypeFormModel";

const LIST_PATH = "/app/scheduling/event-types";

export default function EventTypeForm({ id }: { id: string }) {
  const isNew = id === "new";
  const router = useRouter();
  const searchParams = useSearchParams();
  const owner = useSchedulingOwner();
  const pillar = pillarForOwner(owner.ownerType);
  const paid = webFeatureFlags.schedulingPaid;

  const presetDuration = Number(searchParams?.get("duration")) || undefined;

  const [phase, setPhase] = useState<"loading" | "error" | "ready">(
    isNew ? "ready" : "loading",
  );
  const [values, setValues] = useState<EventTypeFormValues>(() =>
    defaultFormValues(presetDuration),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [durationMode, setDurationMode] = useState<"single" | "multiple">(
    "single",
  );
  const [questions, setQuestions] = useState<IntakeQuestion[]>([]);
  const [intakeOpen, setIntakeOpen] = useState(false);

  const load = useCallback(() => {
    if (isNew) return undefined;
    let alive = true;
    setPhase("loading");
    api.scheduling
      .getEventType(id, owner)
      .then((detail) => {
        if (!alive) return;
        const form = eventTypeToForm(detail.eventType);
        setValues(form);
        setDurationMode(form.durations.length > 1 ? "multiple" : "single");
        setQuestions(detail.questions ?? []);
        setPhase("ready");
      })
      .catch(() => {
        if (alive) setPhase("error");
      });
    return () => {
      alive = false;
    };
  }, [id, isNew, owner]);

  useEffect(() => load(), [load]);

  const patch = useCallback(
    (p: Partial<EventTypeFormValues>) => setValues((v) => ({ ...v, ...p })),
    [],
  );

  // ── Duration helpers ──────────────────────────────────────────
  const setSingleDuration = (d: number) =>
    patch({ durations: [d], default_duration: d });

  const toggleDuration = (d: number) =>
    setValues((v) => {
      const has = v.durations.includes(d);
      let durations = has
        ? v.durations.filter((x) => x !== d)
        : [...v.durations, d];
      if (durations.length === 0) durations = [d];
      durations = [...durations].sort((a, b) => a - b);
      const default_duration = durations.includes(v.default_duration)
        ? v.default_duration
        : durations[0];
      return { ...v, durations, default_duration };
    });

  const setDefaultDuration = (d: number) =>
    setValues((v) =>
      v.durations.includes(d) ? { ...v, default_duration: d } : v,
    );

  const switchDurationMode = (mode: "single" | "multiple") => {
    setDurationMode(mode);
    if (mode === "single") {
      patch({ durations: [values.default_duration] });
    }
  };

  // ── Save ──────────────────────────────────────────────────────
  const handleSave = async () => {
    const errs = validateForm(values, { paid });
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      if (isNew) {
        let slug = slugify(values.name);
        let created: { eventType: { id: string } } | null = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            created = await api.scheduling.createEventType(
              formToInput({ ...values, slug }, { includePricing: paid }),
              owner,
            );
            break;
          } catch (err) {
            const d = decodeError(err);
            if (d.kind === "error" && d.code === "SLUG_TAKEN" && attempt < 4) {
              slug = suffixSlug(slug, attempt + 2);
              continue;
            }
            throw err;
          }
        }
        toast.success("Event type created.");
        if (created) {
          router.replace(`${LIST_PATH}/${created.eventType.id}`);
        } else {
          router.push(LIST_PATH);
        }
      } else {
        const res = await api.scheduling.updateEventType(
          id,
          formToInput(values, { includePricing: paid }),
          owner,
        );
        setValues(eventTypeToForm(res.eventType));
        toast.success("Changes saved.");
      }
    } catch (err) {
      const d = decodeError(err);
      if (d.kind === "validation") {
        setErrors(fieldErrors(d));
        toast.error(d.message);
      } else if (d.kind === "error" && d.code === "SLUG_TAKEN") {
        setErrors({ name: "That name's link is already taken. Try another." });
        toast.error("That booking link is already taken.");
      } else {
        toast.error(d.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const title = isNew
    ? pillar === "business"
      ? "New service"
      : "New event type"
    : values.name || "Event type";

  const location = useMemo(
    () => LOCATION_MODES.find((l) => l.mode === values.location_mode),
    [values.location_mode],
  );

  if (phase === "loading")
    return (
      <EditorSkeleton title={title} onBack={() => router.push(LIST_PATH)} />
    );
  if (phase === "error")
    return (
      <div>
        <EditorHeader
          title="Event type"
          onBack={() => router.push(LIST_PATH)}
          pillar={pillar}
        />
        <ErrorState
          message="We couldn't load this event type."
          onRetry={load}
        />
      </div>
    );

  const disabled = saving;

  return (
    <div className="pb-28">
      <EditorHeader
        title={title}
        onBack={() => router.push(LIST_PATH)}
        pillar={pillar}
      />

      <div className="flex flex-col gap-3">
        {/* Basics */}
        <EditorCard overline="Basics" pillar={pillar}>
          <TextField
            label="Name"
            value={values.name}
            onChange={(v) => patch({ name: v })}
            placeholder="e.g. Intro call"
            disabled={disabled}
            error={errors.name}
          />
          <TextAreaField
            label="Description"
            value={values.description}
            onChange={(v) => patch({ description: v })}
            placeholder="What should people expect?"
            disabled={disabled}
            error={errors.description}
          />
          <ColorSwatches
            colors={EVENT_TYPE_COLORS}
            value={values.color}
            onChange={(c) => patch({ color: c })}
          />
        </EditorCard>

        {/* Duration */}
        <EditorCard overline="Duration" pillar={pillar}>
          <Segmented
            ariaLabel="Duration mode"
            value={durationMode}
            onChange={(m) => switchDurationMode(m)}
            disabled={disabled}
            options={[
              { value: "single", label: "Single" },
              { value: "multiple", label: "Multiple" },
            ]}
          />

          {durationMode === "single" ? (
            <div>
              <FieldLabel>Length</FieldLabel>
              <div className="flex flex-wrap items-center gap-2">
                <Stepper
                  value={values.default_duration}
                  onChange={(v) => setSingleDuration(v)}
                  unit="min"
                  step={5}
                  min={MIN_DURATION}
                  max={MAX_DURATION}
                  disabled={disabled}
                  error={Boolean(errors.durations)}
                />
                {DURATION_PRESETS.map((p) => (
                  <QuickChip
                    key={p}
                    label={String(p)}
                    icon
                    active={values.default_duration === p}
                    onClick={() => setSingleDuration(p)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <FieldLabel>Lengths people can pick</FieldLabel>
                <div className="flex flex-wrap items-center gap-2">
                  {[...DURATION_PRESETS, 90].map((p) => (
                    <QuickChip
                      key={p}
                      label={`${p} min`}
                      active={values.durations.includes(p)}
                      onClick={() => toggleDuration(p)}
                    />
                  ))}
                </div>
              </div>
              <div>
                <FieldLabel>Default length</FieldLabel>
                <div className="flex flex-wrap items-center gap-2">
                  {values.durations.map((d) => {
                    const on = d === values.default_duration;
                    return (
                      <span key={d} className="inline-flex items-center">
                        <button
                          type="button"
                          onClick={() => setDefaultDuration(d)}
                          className={clsx(
                            "inline-flex items-center gap-1 rounded-l-full border py-1.5 pl-3 pr-2.5 text-xs font-semibold transition",
                            on
                              ? "border-primary-600 bg-primary-50 text-primary-700"
                              : "border-app-border bg-app-surface text-app-text-secondary",
                          )}
                        >
                          {d} min
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${d} min`}
                          disabled={values.durations.length <= 1}
                          onClick={() => toggleDuration(d)}
                          className={clsx(
                            "inline-flex items-center rounded-r-full border border-l-0 py-1.5 pl-1 pr-2.5 transition disabled:opacity-30",
                            on
                              ? "border-primary-600 bg-primary-50 text-primary-700"
                              : "border-app-border bg-app-surface text-app-text-muted",
                          )}
                        >
                          <X className="h-3 w-3" aria-hidden />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {errors.durations && (
            <p className="text-xs text-app-error">{errors.durations}</p>
          )}
        </EditorCard>

        {/* Location */}
        <EditorCard overline="Location" pillar={pillar}>
          <Segmented
            ariaLabel="Location"
            value={values.location_mode}
            onChange={(m) => patch({ location_mode: m })}
            disabled={disabled}
            options={LOCATION_MODES.map((l) => ({
              value: l.mode,
              label: l.label,
            }))}
          />
          {location && location.mode !== "ask" && (
            <TextField
              label={location.detailLabel}
              value={values.location_detail}
              onChange={(v) => patch({ location_detail: v })}
              placeholder={location.placeholder}
              mono={location.mono}
              disabled={disabled}
            />
          )}
        </EditorCard>

        {/* Availability — link out to W3 */}
        <EditorCard overline="Availability" pillar={pillar}>
          <LinkRow
            icon={CalendarClock}
            label="Schedule"
            value="Manage in Availability"
            href="/app/scheduling/availability"
            last
          />
        </EditorCard>

        {/* Advanced (collapsible) */}
        <EditorCard
          overline="Advanced"
          pillar={pillar}
          collapsible
          open={advancedOpen}
          onToggle={() => setAdvancedOpen((o) => !o)}
        >
          <div className="flex gap-3">
            <div className="flex-1">
              <FieldLabel>Buffer before</FieldLabel>
              <Stepper
                value={values.buffer_before_min}
                onChange={(v) => patch({ buffer_before_min: v })}
                unit="min"
                step={5}
                min={0}
                max={720}
                disabled={disabled}
              />
            </div>
            <div className="flex-1">
              <FieldLabel>Buffer after</FieldLabel>
              <Stepper
                value={values.buffer_after_min}
                onChange={(v) => patch({ buffer_after_min: v })}
                unit="min"
                step={5}
                min={0}
                max={720}
                disabled={disabled}
              />
            </div>
          </div>
          <div>
            <FieldLabel>Minimum notice</FieldLabel>
            <Stepper
              value={Math.round(values.min_notice_min / 60)}
              onChange={(h) => patch({ min_notice_min: h * 60 })}
              unit="hrs"
              step={1}
              min={0}
              max={720}
              disabled={disabled}
            />
          </div>
          <div>
            <FieldLabel>Booking horizon</FieldLabel>
            <Stepper
              value={values.max_horizon_days}
              onChange={(v) => patch({ max_horizon_days: v })}
              unit="days"
              step={5}
              min={1}
              max={730}
              disabled={disabled}
            />
          </div>
          <div>
            <FieldLabel>Per-day cap</FieldLabel>
            <Stepper
              value={values.daily_cap ?? 0}
              onChange={(v) => patch({ daily_cap: v <= 0 ? null : v })}
              unit="/day"
              step={1}
              min={0}
              max={100}
              disabled={disabled}
            />
            <p className="mt-1.5 text-[11px] text-app-text-muted">
              0 means no daily limit.
            </p>
          </div>
        </EditorCard>

        {/* Assignment — inline segmented (business only) */}
        {pillar === "business" && (
          <EditorCard overline="Assignment" pillar={pillar}>
            <Segmented
              ariaLabel="Assignment mode"
              value={
                (["one_on_one", "round_robin", "collective"].includes(
                  values.assignment_mode,
                )
                  ? values.assignment_mode
                  : "one_on_one") as
                  | "one_on_one"
                  | "round_robin"
                  | "collective"
              }
              onChange={(m) => patch({ assignment_mode: m })}
              disabled={disabled}
              options={[
                { value: "one_on_one" as const, label: "Anyone" },
                { value: "round_robin" as const, label: "Specific" },
                { value: "collective" as const, label: "Collective" },
              ]}
            />
            {values.assignment_mode === "collective" ? (
              <p className="text-[11px] leading-snug text-app-text-secondary">
                Everyone must be free. The booking goes on every required
                host&apos;s calendar.
              </p>
            ) : (
              <p className="text-[11px] leading-snug text-app-text-secondary">
                Any seated teammate who&apos;s free can take the booking.
              </p>
            )}
          </EditorCard>
        )}

        {/* Pricing — flag-gated */}
        {paid && (
          <PricingFields
            values={values}
            onPatch={(p) => patch(p)}
            errors={errors}
            disabled={disabled}
            owner={owner}
            pillar={pillar}
          />
        )}

        {/* Controls */}
        <EditorCard pillar={pillar}>
          <ToggleRow
            icon={UserCheck}
            label="Require approval"
            sub="Approve each booking before it's confirmed"
            on={values.requires_approval}
            onChange={(v) => patch({ requires_approval: v })}
            disabled={disabled}
          />
          <ToggleRow
            icon={EyeOff}
            label="Unlisted (link only)"
            sub="Hidden from your public page"
            on={values.visibility === "secret"}
            onChange={(v) => patch({ visibility: v ? "secret" : "public" })}
            disabled={disabled}
          />
          <ToggleRow
            icon={CircleCheck}
            label="Active"
            sub="People can book this right now"
            on={values.is_active}
            onChange={(v) => patch({ is_active: v })}
            disabled={disabled}
            last
          />
        </EditorCard>

        {/* More — intake questions + booking limits + reminders (edit mode only) */}
        {!isNew && (
          <EditorCard pillar={pillar}>
            <LinkRow
              icon={ListChecks}
              label="Intake questions"
              value={questionsSummary(questions.length)}
              onClick={() => setIntakeOpen(true)}
            />
            <LinkRow
              icon={Gauge}
              label="Booking limits"
              value="Off"
              disabled
            />
            <LinkRow
              icon={Bell}
              label="Reminders"
              value="1 day, 1 hour before"
              disabled
              last
            />
          </EditorCard>
        )}
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-4 border-t border-app-border bg-app-bg/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={clsx(
            "inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm transition disabled:opacity-70",
            "bg-primary-600 hover:bg-primary-700",
          )}
        >
          {saving
            ? "Saving…"
            : isNew
              ? pillar === "business"
                ? "Create service"
                : "Create event type"
              : "Save changes"}
        </button>
      </div>

      {/* Intake questions sheet (B3) */}
      <BottomSheet
        open={intakeOpen}
        onClose={() => setIntakeOpen(false)}
        title="Intake questions"
      >
        <IntakeQuestionsEditor
          eventTypeId={id}
          owner={owner}
          initialQuestions={questions}
          variant="sheet"
          onSaved={(qs) => {
            setQuestions(qs);
            setIntakeOpen(false);
          }}
        />
      </BottomSheet>
    </div>
  );
}

function questionsSummary(n: number): string {
  if (n === 0) return "Just name and email";
  return `${n} question${n === 1 ? "" : "s"}`;
}

export function EditorHeader({
  title,
  onBack,
  pillar,
  right,
  overline,
}: {
  title: string;
  onBack: () => void;
  pillar: "personal" | "home" | "business";
  right?: React.ReactNode;
  /** Optional pillar-accent overline shown above the title (e.g. "Personal · Intro call"). */
  overline?: string;
}) {
  const tk = pillarTokens(pillar);
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="-ml-1.5 flex h-8 w-8 items-center justify-center rounded-lg text-app-text-secondary hover:bg-app-hover"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          {overline && (
            <p
              className={`mb-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] ${tk.text}`}
            >
              {overline}
            </p>
          )}
          <h1 className="truncate text-xl font-bold text-app-text">{title}</h1>
        </div>
        {right}
      </div>
      {!overline && (
        <div className="mt-2 pl-7">
          <PillarPill pillar={pillar} />
        </div>
      )}
    </div>
  );
}

function EditorSkeleton({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <div>
      <EditorHeader title={title} onBack={onBack} pillar="personal" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <ShimmerBlock key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
