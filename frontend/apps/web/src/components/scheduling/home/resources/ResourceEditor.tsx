"use client";

// F10 — Resource editor (create / edit). Grouped FormShell mirroring the W10
// add/edit event form. Smart defaults from the picked type; rules collapsed by
// default. Create → POST /resources, edit → PUT /resources/:id (partial),
// delete → soft-delete. Owns its own Cancel / title / Save bar.

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  LoaderCircle,
  Trash2,
  X,
} from "lucide-react";
import type { Resource, ResourceType, WhoCanBook } from "@pantopus/types";
import { scheduling } from "@pantopus/api";
import { useSchedulingOwner } from "@/components/scheduling";
import { decodeError, fieldErrors } from "@/components/scheduling/decodeError";
import { Avatar } from "@/components/scheduling/home";
import type { HomeMember } from "@/components/scheduling/home";
import {
  Card,
  Chips,
  Overline,
  Section,
  Segmented,
  Stepper,
  Switch,
  TextButton,
  TextField,
  ValueRow,
  WeekdayPicker,
} from "./primitives";
import {
  DEFAULT_AVAILABLE_HOURS,
  RESOURCE_TYPES,
  durationLabel,
  parseAvailableHours,
  typeDefaults,
  type AvailableHours,
} from "./resourceMeta";
import type { ResourcePrefill } from "./ResourceList";

const WHO_OPTIONS: { value: WhoCanBook; label: string }[] = [
  { value: "members", label: "All" },
  { value: "specific", label: "Specific" },
  { value: "guests", label: "Guest link" },
];

const TYPE_OPTIONS = RESOURCE_TYPES.map((t) => ({
  value: t.value,
  label: t.label,
  Icon: t.Icon,
}));

export default function ResourceEditor({
  resource,
  prefill,
  members,
  onSaved,
  onCancel,
  onDeleted,
}: {
  resource?: Resource | null;
  prefill?: ResourcePrefill;
  members: HomeMember[];
  onSaved: (resource: Resource) => void;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const owner = useSchedulingOwner();
  const editing = !!resource;

  const initialHours: AvailableHours =
    parseAvailableHours(resource?.available_hours) ?? DEFAULT_AVAILABLE_HOURS;
  const initialType: ResourceType =
    resource?.resource_type ?? prefill?.type ?? "other";
  const initialDefaults = typeDefaults(initialType);

  const [name, setName] = useState(resource?.name ?? prefill?.name ?? "");
  const [type, setType] = useState<ResourceType>(initialType);
  const [photoUrl, setPhotoUrl] = useState(resource?.photo_url ?? "");
  const [photoOpen, setPhotoOpen] = useState(!!resource?.photo_url);
  const [whoCanBook, setWhoCanBook] = useState<WhoCanBook>(
    resource?.who_can_book ?? "members",
  );
  const [specific, setSpecific] = useState<string[]>([]);
  const [maxHr, setMaxHr] = useState<number>(
    resource
      ? resource.max_duration_min
        ? Math.round(resource.max_duration_min / 60)
        : 0
      : initialDefaults.max_duration_min
        ? Math.round(initialDefaults.max_duration_min / 60)
        : 4,
  );
  const [bufferMin, setBufferMin] = useState<number>(
    resource?.buffer_min ?? initialDefaults.buffer_min,
  );
  const [requiresApproval, setRequiresApproval] = useState<boolean>(
    resource?.requires_approval ?? initialDefaults.requires_approval,
  );
  const [rulesOpen, setRulesOpen] = useState(editing);
  const [days, setDays] = useState<number[]>(initialHours.days);
  const [startTime, setStartTime] = useState(initialHours.start);
  const [endTime, setEndTime] = useState(initialHours.end);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const durError = maxHr <= 0;
  const hoursError = days.length === 0 || startTime >= endTime;
  const canSave = name.trim().length > 0 && !durError && !hoursError && !saving;

  const helperLine = useMemo(() => {
    const d = typeDefaults(type);
    if (editing)
      return `${durationLabel(maxHr * 60)} · ${requiresApproval ? "Needs approval" : "No approval"}`;
    return `${RESOURCE_TYPES.find((t) => t.value === type)?.label} defaults: ${durationLabel(
      d.max_duration_min,
    )} · ${d.requires_approval ? "Needs approval" : "No approval"}`;
  }, [type, editing, maxHr, requiresApproval]);

  const applyTypeDefaults = (next: ResourceType) => {
    setType(next);
    if (!editing) {
      const d = typeDefaults(next);
      setMaxHr(d.max_duration_min ? Math.round(d.max_duration_min / 60) : 4);
      setBufferMin(d.buffer_min);
      setRequiresApproval(d.requires_approval);
    }
  };

  const handleSave = async () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Give this resource a name";
    if (durError) next.duration = "Set a max duration above zero";
    if (hoursError) next.hours = "Pick at least one day and a valid time range";
    setErrors(next);
    if (Object.keys(next).length > 0) {
      if (next.duration || next.hours) setRulesOpen(true);
      return;
    }

    const availableHours: AvailableHours = {
      days: days.slice().sort(),
      start: startTime,
      end: endTime,
    };
    const payload = {
      name: name.trim(),
      resource_type: type,
      photo_url: photoUrl.trim() || undefined,
      who_can_book: whoCanBook,
      max_duration_min: maxHr * 60,
      buffer_min: bufferMin,
      requires_approval: requiresApproval,
      available_hours: availableHours as unknown as Record<string, unknown>,
    };

    setSaving(true);
    setFormError(null);
    try {
      const res = editing
        ? await scheduling.updateResource(resource!.id, payload, owner)
        : await scheduling.createResource(payload, owner);
      onSaved(res.resource);
    } catch (err) {
      const decoded = decodeError(err);
      if (decoded.kind === "validation") setErrors(fieldErrors(decoded));
      else setFormError(decoded.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!resource) return;
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!resource) return;
    setDeleteConfirmOpen(false);
    setSaving(true);
    try {
      await scheduling.deleteResource(resource.id, owner);
      onDeleted();
    } catch (err) {
      setFormError(decodeError(err).message);
      setSaving(false);
    }
  };

  const toggleSpecific = (id: string) =>
    setSpecific((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  return (
    <div className="flex h-full flex-col">
      {/* Delete confirm dialog (design: trash-2 icon + stacked full-width buttons) */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
          <div className="w-full max-w-xs rounded-2xl bg-app-surface p-5 shadow-[0_8px_40px_rgba(0,0,0,0.18)]">
            <div className="mb-3 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-app-error-bg">
                <Trash2 className="h-6 w-6 text-app-error" />
              </div>
            </div>
            <div className="mb-1 text-center text-[15px] font-bold text-app-text">
              Delete {resource?.name}?
            </div>
            <p className="mb-4 text-center text-[12.5px] leading-[18px] text-app-text-secondary">
              Existing bookings stay on the calendar. New bookings will be
              turned off.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={confirmDelete}
                className="h-11 w-full rounded-xl bg-app-error text-[13.5px] font-bold text-white transition hover:brightness-105"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="h-11 w-full rounded-xl border border-app-border-strong bg-app-surface text-[13.5px] font-bold text-app-text-secondary transition hover:bg-app-surface-sunken"
              >
                Keep
              </button>
            </div>
          </div>
        </div>
      )}

      {/* bar */}
      <div className="flex items-center justify-between border-b border-app-border-subtle px-3 py-2.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="min-w-[52px] text-left text-sm font-semibold text-app-text-secondary disabled:opacity-50"
        >
          Cancel
        </button>
        <div className="text-[14.5px] font-bold tracking-tight text-app-text">
          {editing ? "Edit resource" : "New resource"}
        </div>
        <div className="min-w-[52px] text-right">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className="text-sm font-bold text-app-home disabled:text-app-text-muted"
          >
            Save
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {/* Saving overlay — dims form content and shows centered spinner card */}
        {saving && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2.5 rounded-2xl bg-white/90 px-6 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.1)]">
              <LoaderCircle className="h-[26px] w-[26px] animate-spin text-app-home" />
              <span className="text-[12.5px] font-semibold text-app-text-secondary">
                Saving resource
              </span>
            </div>
          </div>
        )}
      <div className={`h-full overflow-auto space-y-3 p-3.5 ${saving ? "pointer-events-none opacity-[0.45]" : ""}`}>
        {formError && (
          <div className="flex items-start gap-2 rounded-xl border border-app-error/30 bg-app-error-bg px-3 py-2.5 text-[12px] text-app-error">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {formError}
          </div>
        )}

        {/* Name + type */}
        <Section>
          <TextField
            label="Name"
            value={name}
            onChange={(v) => {
              setName(v);
              if (errors.name) setErrors((p) => ({ ...p, name: "" }));
            }}
            placeholder="Name this resource"
            error={!!errors.name}
            helper={errors.name}
          />
          <div className="mt-3">
            <div className="mb-1.5 text-[11px] font-semibold text-app-text-secondary">
              Type
            </div>
            <Chips
              options={TYPE_OPTIONS}
              value={type}
              onChange={applyTypeDefaults}
            />
          </div>
        </Section>

        {/* Photo */}
        <Section overline="Photo">
          {photoOpen ? (
            <div className="space-y-2">
              <TextField
                value={photoUrl}
                onChange={setPhotoUrl}
                placeholder="https://… image URL"
                type="url"
              />
              <TextButton
                tone="default"
                icon={X}
                onClick={() => {
                  setPhotoOpen(false);
                  setPhotoUrl("");
                }}
              >
                Remove photo
              </TextButton>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPhotoOpen(true)}
              className="flex w-full items-center gap-3 rounded-lg border-[1.5px] border-dashed border-app-border-strong bg-app-surface px-3 py-2.5 text-left"
            >
              <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-app-surface-sunken text-app-text-secondary">
                <ImagePlus className="h-[17px] w-[17px]" />
              </div>
              <span className="flex-1 text-[12.5px] font-semibold text-app-text-secondary">
                Add a photo
              </span>
              <span className="text-[10.5px] font-semibold text-app-text-muted">
                Optional
              </span>
            </button>
          )}
        </Section>

        {/* Who can book */}
        <Section overline="Who can book">
          <Segmented
            options={WHO_OPTIONS}
            value={whoCanBook}
            onChange={setWhoCanBook}
          />
          {whoCanBook === "specific" && (
            <div className="mt-3">
              {members.map((m, i) => {
                const on = specific.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleSpecific(m.id)}
                    className={`flex w-full items-center gap-3 py-2.5 text-left ${
                      i === members.length - 1
                        ? ""
                        : "border-b border-app-border"
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
              })}
              <p className="mt-2 text-[10.5px] text-app-text-secondary">
                Member-level rules apply soon — for now any active member can
                book.
              </p>
            </div>
          )}
        </Section>

        {/* Booking rules (collapsible) */}
        <Card>
          <button
            type="button"
            onClick={() => setRulesOpen((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <div>
              <Overline>Booking rules</Overline>
              {!rulesOpen && (
                <div className="mt-1 text-[10.5px] text-app-text-secondary">
                  {helperLine}
                </div>
              )}
            </div>
            {rulesOpen ? (
              <ChevronUp className="h-[18px] w-[18px] text-app-text-muted" />
            ) : (
              <ChevronDown className="h-[18px] w-[18px] text-app-text-muted" />
            )}
          </button>
          {rulesOpen && (
            <div className="mt-3">
              <ValueRow label="Max duration" error={durError}>
                <Stepper
                  value={maxHr}
                  onChange={setMaxHr}
                  min={0}
                  max={24}
                  unit="hr"
                  error={durError}
                />
              </ValueRow>
              {durError && (
                <p className="flex items-center gap-1 pb-1.5 text-[10.5px] text-app-error">
                  <AlertCircle className="h-3 w-3" />
                  Set a max duration above zero
                </p>
              )}
              <ValueRow label="Buffer between bookings">
                <Stepper
                  value={bufferMin}
                  onChange={setBufferMin}
                  min={0}
                  max={120}
                  step={5}
                  unit="min"
                />
              </ValueRow>
              <ValueRow label="Requires approval" last>
                <Switch on={requiresApproval} onChange={setRequiresApproval} />
              </ValueRow>
            </div>
          )}
        </Card>

        {/* Available hours */}
        <Section overline="Available hours">
          <WeekdayPicker value={days} onChange={setDays} />
          <div className="mt-3">
            <ValueRow label="Available hours" last error={startTime >= endTime}>
              <div className="flex items-center gap-1.5">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="rounded-lg bg-app-surface-sunken px-2 py-1.5 text-[12px] font-semibold text-app-text outline-none"
                />
                <span className="text-app-text-muted">–</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="rounded-lg bg-app-surface-sunken px-2 py-1.5 text-[12px] font-semibold text-app-text outline-none"
                />
              </div>
            </ValueRow>
          </div>
          {errors.hours && (
            <p className="mt-1 flex items-center gap-1 text-[10.5px] text-app-error">
              <AlertCircle className="h-3 w-3" />
              {errors.hours}
            </p>
          )}
        </Section>

        {/* Delete (edit only) */}
        {editing && (
          <div className="flex justify-center py-1">
            <TextButton tone="danger" icon={Trash2} onClick={handleDelete}>
              Delete resource
            </TextButton>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
