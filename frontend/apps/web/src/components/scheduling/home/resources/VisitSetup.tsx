"use client";

// F13 — Schedule a visit (vendor / guest). Creates a single household visit
// event via POST /visits (stored as a HomeCalendarEvent; the people who must be
// home are marked busy in availability). The design's slot-offering window +
// shareable booking link aren't backed by the visits endpoint, so this builds a
// concrete scheduled visit and lands on the visit detail.

import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronRight,
  HardHat,
  Info,
  KeyRound,
  Loader2,
  Package,
  UserRound,
  Wrench,
} from "lucide-react";
import { scheduling } from "@pantopus/api";
import type { VisitType } from "@pantopus/types";
import { useSchedulingOwner } from "@/components/scheduling";
import { decodeError, fieldErrors } from "@/components/scheduling/decodeError";
import {
  Avatar,
  isoToLocalInput,
  localInputToIso,
  type HomeMember,
} from "@/components/scheduling/home";
import {
  Banner,
  Chips,
  FieldLabel,
  Section,
  Stepper,
  TextArea,
  TextField,
  ValueRow,
} from "./primitives";

// 4 chips for visual parity; persisted to the backend vendor|guest enum.
const VISIT_TYPES = [
  { value: "vendor" as const, label: "Vendor", Icon: Wrench },
  { value: "guest" as const, label: "Guest", Icon: UserRound },
  { value: "delivery" as const, label: "Delivery", Icon: Package },
  { value: "service" as const, label: "Service", Icon: HardHat },
];
type VisitChip = (typeof VISIT_TYPES)[number]["value"];

function toBackendType(chip: VisitChip): VisitType {
  return chip === "guest" ? "guest" : "vendor";
}

function defaultStart(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return isoToLocalInput(d.toISOString());
}

export default function VisitSetup({
  members,
  onCreated,
  onCancel,
}: {
  members: HomeMember[];
  onCreated: (visitId: string) => void;
  onCancel: () => void;
}) {
  const owner = useSchedulingOwner();
  const [title, setTitle] = useState("");
  const [chip, setChip] = useState<VisitChip>("vendor");
  const [whoIsHome, setWhoIsHome] = useState<string[]>([]);
  const [startLocal, setStartLocal] = useState(defaultStart());
  const [lengthHr, setLengthHr] = useState(1);
  const [accessNote, setAccessNote] = useState("");

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const submitted = useRef(false);

  const hostError = submitted.current && whoIsHome.length === 0;

  const canSave =
    title.trim().length > 0 && whoIsHome.length > 0 && !!startLocal && !saving;

  const toggleHost = (id: string) =>
    setWhoIsHome((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const endIso = useMemo(() => {
    const startIso = localInputToIso(startLocal);
    if (!startIso) return null;
    return new Date(
      new Date(startIso).getTime() + lengthHr * 60 * 60_000,
    ).toISOString();
  }, [startLocal, lengthHr]);

  const handleSave = async () => {
    submitted.current = true;
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "Give this visit a title";
    if (whoIsHome.length === 0)
      next.host = "Pick at least one host who must be home";
    const startIso = localInputToIso(startLocal);
    if (!startIso) next.start = "Choose a start date and time";
    setErrors(next);
    if (Object.keys(next).length > 0 || !startIso || !endIso) return;

    setSaving(true);
    setFormError(null);
    try {
      const res = await scheduling.createVisit(
        {
          visit_type: toBackendType(chip),
          title: title.trim(),
          start_at: startIso,
          end_at: endIso,
          who_is_home: whoIsHome,
          location_notes: accessNote.trim() || undefined,
        },
        owner,
      );
      onCreated(res.visit.id);
    } catch (err) {
      const decoded = decodeError(err);
      if (decoded.kind === "validation") setErrors(fieldErrors(decoded));
      else setFormError(decoded.message);
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* bar */}
      <div className="flex items-center justify-between border-b border-app-border-subtle px-3 py-2.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="min-w-[64px] text-left text-sm font-semibold text-app-text-secondary disabled:opacity-50"
        >
          Cancel
        </button>
        <div className="text-[14.5px] font-bold tracking-tight text-app-text">
          Schedule a visit
        </div>
        <div className="min-w-[64px] text-right">
          {saving ? (
            <Loader2 className="ml-auto h-4 w-4 animate-spin text-app-text-muted" />
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="text-sm font-bold text-app-home disabled:text-app-text-muted"
            >
              Schedule
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-auto p-3.5">
        <Banner tone="info" icon={Info}>
          Slots come from when your chosen hosts are personally free.
        </Banner>

        {formError && (
          <div className="flex items-start gap-2 rounded-xl border border-app-error/30 bg-app-error-bg px-3 py-2.5 text-[12px] text-app-error">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {formError}
          </div>
        )}

        {/* Title + type */}
        <Section>
          <TextField
            label="Title"
            value={title}
            onChange={(v) => {
              setTitle(v);
              if (errors.title) setErrors((p) => ({ ...p, title: "" }));
            }}
            placeholder="e.g. Plumber visit"
            error={!!errors.title}
            helper={errors.title}
          />
          <div className="mt-3">
            <FieldLabel>Visit type</FieldLabel>
            <Chips options={VISIT_TYPES} value={chip} onChange={setChip} />
          </div>
        </Section>

        {/* Who must be home */}
        <Section overline="Who must be home">
          {members.length === 0 ? (
            <p className="text-[12px] text-app-text-secondary">
              No household members found.
            </p>
          ) : (
            members.map((m, i) => {
              const on = whoIsHome.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    toggleHost(m.id);
                    if (errors.host) setErrors((p) => ({ ...p, host: "" }));
                  }}
                  className={`flex w-full items-center gap-3 py-2.5 text-left ${
                    i === members.length - 1 ? "" : "border-b border-app-border"
                  }`}
                >
                  <Avatar member={m} size={30} />
                  <span className="flex-1 truncate text-[13px] font-semibold text-app-text">
                    {m.name}
                  </span>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      on
                        ? "border-app-home bg-app-home text-white"
                        : "border-app-border-strong"
                    }`}
                  >
                    {on && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                </button>
              );
            })
          )}
          {(errors.host || hostError) && (
            <p className="mt-2 flex items-center gap-1 text-[10.5px] text-app-error">
              <AlertCircle className="h-3 w-3" />
              {errors.host || "Pick at least one host who must be home"}
            </p>
          )}
        </Section>

        {/* When */}
        <Section overline="When">
          <ValueRow label="Starts" error={!!errors.start}>
            <input
              type="datetime-local"
              value={startLocal}
              onChange={(e) => {
                setStartLocal(e.target.value);
                if (errors.start) setErrors((p) => ({ ...p, start: "" }));
              }}
              className="rounded-lg bg-app-surface-sunken px-2.5 py-1.5 text-[12px] font-semibold text-app-text outline-none"
            />
          </ValueRow>
          <ValueRow label="Visit length" last>
            <Stepper
              value={lengthHr}
              onChange={setLengthHr}
              min={1}
              max={12}
              unit="hr"
            />
          </ValueRow>
          {errors.start && (
            <p className="mt-1 flex items-center gap-1 text-[10.5px] text-app-error">
              <AlertCircle className="h-3 w-3" />
              {errors.start}
            </p>
          )}
        </Section>

        {/* Access */}
        <Section overline="Access">
          <TextArea
            value={accessNote}
            onChange={setAccessNote}
            placeholder="Entry note for the visitor — e.g. front door code on arrival"
            rows={2}
          />
          {/* Link an access code — secondary affordance matching iOS/Android */}
          <button
            type="button"
            className="mt-2.5 flex w-full items-center gap-2.5 rounded-lg border border-app-border bg-app-surface-sunken px-3 py-2.5 text-left transition hover:bg-app-surface"
          >
            <KeyRound className="h-4 w-4 shrink-0 text-app-text-secondary" />
            <span className="flex-1 text-[13px] font-semibold text-app-text-secondary">
              Link an access code
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-app-text-muted" />
          </button>
        </Section>
      </div>
    </div>
  );
}
