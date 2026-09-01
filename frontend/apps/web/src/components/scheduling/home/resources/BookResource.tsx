"use client";

// F12 — Book a resource. A date row + hour grid constrained to the resource's
// available hours and existing bookings (greyed/struck-through taken cells, off
// cells for past hours), with a live conflict line. Submit → POST
// /resources/:id/book → confirmed, or "request sent" when the resource needs
// approval. The 409 RESOURCE_TAKEN is the authoritative backstop (we re-fetch
// and re-grey); alternatives are rendered when the backend supplies them.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleX,
  Clock,
  CloudOff,
  House,
  LoaderCircle,
  RotateCw,
  TriangleAlert,
} from "lucide-react";
import { scheduling } from "@pantopus/api";
import type {
  Booking,
  BookingSlot,
  Resource,
  SlotConflict,
} from "@pantopus/types";
import { useSchedulingOwner } from "@/components/scheduling";
import {
  asSlotConflict,
  decodeError,
} from "@/components/scheduling/decodeError";
import SlotConflictAlternatives from "@/components/scheduling/SlotConflictAlternatives";
import { Avatar, type HomeMember } from "@/components/scheduling/home";
import { Card, Overline, PrimaryButton, Section, TextArea } from "./primitives";
import { formatHm, parseAvailableHours, rulesSummary } from "./resourceMeta";

type ResourceBookingRow = Booking & { resource_id?: string | null };
type CellState = "free" | "sel" | "selErr" | "taken" | "off";

function hourShort(h: number): string {
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateLabel(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function BookResource({
  rid,
  members,
  membersById,
  currentUserId,
  initialDate,
  onBooked,
  onCancel,
}: {
  rid: string;
  members: HomeMember[];
  membersById: Map<string, HomeMember>;
  currentUserId: string | null;
  initialDate?: string;
  onBooked: () => void;
  onCancel: () => void;
}) {
  const owner = useSchedulingOwner();
  const [resource, setResource] = useState<Resource | null>(null);
  const [bookings, setBookings] = useState<ResourceBookingRow[]>([]);
  const [loadErr, setLoadErr] = useState(false);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [date, setDate] = useState<Date>(() =>
    initialDate ? new Date(`${initialDate}T00:00:00`) : new Date(),
  );
  const [range, setRange] = useState<{ start: number; end: number } | null>(
    null,
  );
  const [anchor, setAnchor] = useState<number | null>(null);

  const [forWhom, setForWhom] = useState<string | null>(currentUserId);
  const [whoOpen, setWhoOpen] = useState(false);
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<SlotConflict | null>(null);
  const [success, setSuccess] = useState<null | "confirmed" | "pending">(null);

  const loadBookings = useCallback(async () => {
    try {
      const [resRes, bookRes] = await Promise.all([
        scheduling.listResources(owner),
        scheduling
          .listBookings({}, owner)
          .catch(() => ({ bookings: [] as Booking[] })),
      ]);
      const found = resRes.resources.find((r) => r.id === rid) ?? null;
      setResource(found);
      setBookings(
        (bookRes.bookings as ResourceBookingRow[]).filter(
          (b) =>
            b.resource_id === rid &&
            (b.status === "confirmed" || b.status === "pending"),
        ),
      );
      if (!found) setLoadErr(true);
    } catch {
      setLoadErr(true);
    }
  }, [owner, rid]);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const hours = useMemo(
    () => parseAvailableHours(resource?.available_hours),
    [resource],
  );
  const startHour = hours ? parseInt(hours.start.slice(0, 2), 10) : 8;
  const endHour = hours ? Math.ceil(parseInt(hours.end.slice(0, 2), 10)) : 21;
  const cellHours = useMemo(() => {
    const arr: number[] = [];
    for (let h = startHour; h < endHour; h += 1) arr.push(h);
    return arr;
  }, [startHour, endHour]);

  const dayBookings = useMemo(
    () =>
      bookings.filter((b) => dateKey(new Date(b.start_at)) === dateKey(date)),
    [bookings, date],
  );

  const isHourTaken = useCallback(
    (h: number) => {
      const cellStart = new Date(date);
      cellStart.setHours(h, 0, 0, 0);
      const cellEnd = new Date(date);
      cellEnd.setHours(h + 1, 0, 0, 0);
      const buffer = (resource?.buffer_min ?? 0) * 60_000;
      return dayBookings.some((b) => {
        const s = new Date(b.start_at).getTime() - buffer;
        const e = new Date(b.end_at).getTime() + buffer;
        return cellStart.getTime() < e && cellEnd.getTime() > s;
      });
    },
    [date, dayBookings, resource],
  );

  const isHourPast = useCallback(
    (h: number) => {
      const cellStart = new Date(date);
      cellStart.setHours(h, 0, 0, 0);
      return cellStart.getTime() < Date.now();
    },
    [date],
  );

  const maxHours = resource?.max_duration_min
    ? Math.floor(resource.max_duration_min / 60)
    : 24;

  const durationHours = range ? range.end - range.start + 1 : 0;
  const rangeHasBlocked = useMemo(() => {
    if (!range) return false;
    for (let h = range.start; h <= range.end; h += 1) {
      if (isHourTaken(h) || isHourPast(h)) return true;
    }
    return false;
  }, [range, isHourTaken, isHourPast]);
  const tooLong = durationHours > maxHours;
  const rangeInvalid = rangeHasBlocked || tooLong;
  const canSubmit = !!range && !rangeInvalid && !submitting;

  const cellState = (h: number): CellState => {
    const inRange = range && h >= range.start && h <= range.end;
    if (inRange) return rangeInvalid ? "selErr" : "sel";
    if (isHourPast(h)) return "off";
    if (isHourTaken(h)) return "taken";
    return "free";
  };

  const onCell = (h: number) => {
    if (isHourPast(h)) return;
    setConflict(null);
    setFormError(null);
    if (anchor === null || range === null || range.start !== range.end) {
      // start a fresh single-hour selection
      setAnchor(h);
      setRange({ start: h, end: h });
    } else if (range && h >= range.start && h <= range.end) {
      // tapping inside the current single-cell selection → re-anchor
      setAnchor(h);
      setRange({ start: h, end: h });
    } else {
      setRange({ start: Math.min(anchor, h), end: Math.max(anchor, h) });
    }
  };

  const submit = async () => {
    if (!range || !resource) return;
    const start = new Date(date);
    start.setHours(range.start, 0, 0, 0);
    const member = forWhom ? membersById.get(forWhom) : undefined;
    setSubmitting(true);
    setFormError(null);
    setConflict(null);
    try {
      const res = await scheduling.bookResource(
        rid,
        {
          start_at: start.toISOString(),
          duration_min: durationHours * 60,
          name: member?.name || undefined,
        },
        owner,
      );
      // bookResource returns a full Booking row; status is 'pending' when the
      // resource requires approval.
      setSuccess(res.booking.status === "pending" ? "pending" : "confirmed");
    } catch (err) {
      const decoded = decodeError(err);
      const sc = asSlotConflict(decoded);
      if (sc && sc.alternatives && sc.alternatives.length > 0) {
        setConflict(sc);
      } else {
        setFormError(decoded.message);
      }
      void loadBookings();
    } finally {
      setSubmitting(false);
    }
  };

  const pickAlternative = (slot: BookingSlot) => {
    const s = new Date(slot.start);
    setDate(s);
    setAnchor(s.getHours());
    setRange({ start: s.getHours(), end: s.getHours() });
    setConflict(null);
  };

  // ─── Success ──────────────────────────────────────────────
  if (success) {
    const isPending = success === "pending";
    const rangeLabel =
      range && resource
        ? `${resource.name} · ${dateLabel(date)} ${formatHm(`${String(range.start).padStart(2, "0")}:00`)}–${formatHm(`${String(range.end + 1).padStart(2, "0")}:00`)}`
        : resource?.name;
    return (
      <div className="flex h-full flex-col items-center justify-center px-7 py-12 text-center">
        <div className="relative mb-5 h-[84px] w-[84px]">
          <div
            className={`absolute inset-0 rounded-full ${isPending ? "bg-app-warning-bg" : "bg-app-home-bg"}`}
          />
          <div
            className={`absolute inset-4 flex items-center justify-center rounded-full ${isPending ? "bg-app-warning" : "bg-app-home"} shadow-lg`}
          >
            {isPending ? (
              <Clock className="h-7 w-7 text-white" strokeWidth={2.6} />
            ) : (
              <Check className="h-7 w-7 text-white" strokeWidth={2.8} />
            )}
          </div>
        </div>
        <div className="text-[18px] font-bold tracking-tight text-app-text">
          {isPending ? "Request sent to an admin" : "Booked"}
        </div>
        <p className="mt-1.5 max-w-[240px] text-[13px] leading-[19px] text-app-text-secondary">
          {isPending
            ? "We'll notify you when your booking is approved."
            : rangeLabel}
        </p>
        <div className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-app-home-bg px-3 py-1.5 text-[11.5px] font-bold text-app-home">
          <Check className="h-3.5 w-3.5" />
          {isPending ? rangeLabel : "Added to the home calendar"}
        </div>
        <div className="mt-5 w-full max-w-xs">
          <PrimaryButton icon={House} onClick={onBooked}>
            Back to calendar
          </PrimaryButton>
        </div>
      </div>
    );
  }

  if (loadErr) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-7 py-12 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-app-error-bg">
          <CloudOff className="h-7 w-7 text-app-error" />
        </div>
        <div className="text-[15.5px] font-bold text-app-text">
          Couldn&apos;t load this resource
        </div>
        <p className="mt-1.5 max-w-[220px] text-[12.5px] text-app-text-secondary">
          Check your connection and try again.
        </p>
        <div className="mt-4 w-40">
          <PrimaryButton
            icon={RotateCw}
            onClick={() => {
              setLoadErr(false);
              void loadBookings();
            }}
          >
            Retry
          </PrimaryButton>
        </div>
      </div>
    );
  }

  const chips = resource ? rulesSummary(resource) : [];
  const selectedMember = forWhom ? membersById.get(forWhom) : undefined;

  return (
    <div className="flex h-full flex-col">
      {/* bar */}
      <div className="flex items-center justify-between border-b border-app-border-subtle px-3 py-2.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="min-w-[52px] text-left text-sm font-semibold text-app-text-secondary disabled:opacity-50"
        >
          Cancel
        </button>
        <div className="truncate px-2 text-[14.5px] font-bold tracking-tight text-app-text">
          {resource ? `Book ${resource.name}` : "Book resource"}
        </div>
        <span className="min-w-[52px]" />
      </div>

      <div className="relative flex-1 overflow-hidden">
        {/* Submitting overlay — form fades to 0.45 and centered spinner card floats above */}
        {submitting && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2.5 rounded-2xl bg-white/90 px-6 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.1)]">
              <LoaderCircle className="h-[26px] w-[26px] animate-spin text-app-home" />
              <span className="text-[12.5px] font-semibold text-app-text-secondary">
                Booking the {resource?.name ?? "resource"}
              </span>
            </div>
          </div>
        )}
      <div className={`h-full overflow-auto space-y-3 p-3.5 ${submitting ? "pointer-events-none opacity-[0.45]" : ""}`}>
        {/* rules reminder */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span
                key={c}
                className="inline-flex items-center rounded-full bg-app-surface-sunken px-2.5 py-1 text-[10.5px] font-semibold text-app-text-secondary"
              >
                {c}
              </span>
            ))}
          </div>
        )}

        {formError && (
          <div className="flex items-start gap-2 rounded-xl border border-app-error/30 bg-app-error-bg px-3 py-2.5 text-[12px] text-app-error">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {formError}
          </div>
        )}

        {conflict && (
          <SlotConflictAlternatives
            conflict={conflict}
            pillar="home"
            onPick={pickAlternative}
            onPickAnother={() => setConflict(null)}
          />
        )}

        {/* When */}
        <Card>
          <Overline>When</Overline>
          <div className="mt-2 flex items-center justify-between px-0.5 pb-2.5">
            <button
              type="button"
              onClick={() => {
                const prev = new Date(date);
                prev.setDate(prev.getDate() - 1);
                if (prev.getTime() >= today.getTime()) {
                  setDate(prev);
                  setRange(null);
                  setAnchor(null);
                }
              }}
              disabled={dateKey(date) === dateKey(today)}
              className="text-app-text-muted disabled:opacity-30"
              aria-label="Previous day"
            >
              <ChevronLeft className="h-[18px] w-[18px]" />
            </button>
            <span className="text-[13.5px] font-bold text-app-text">
              {dateLabel(date)}
            </span>
            <button
              type="button"
              onClick={() => {
                const nx = new Date(date);
                nx.setDate(nx.getDate() + 1);
                setDate(nx);
                setRange(null);
                setAnchor(null);
              }}
              className="text-app-text-secondary"
              aria-label="Next day"
            >
              <ChevronRight className="h-[18px] w-[18px]" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {cellHours.map((h) => {
              const st = cellState(h);
              const cls =
                st === "sel"
                  ? "bg-app-home text-white border-transparent"
                  : st === "selErr"
                    ? "bg-app-error-bg text-app-error border-app-error"
                    : st === "taken"
                      ? "bg-app-surface-sunken text-app-text-muted line-through border-transparent cursor-not-allowed"
                      : st === "off"
                        ? "bg-app-surface-muted text-app-text-muted opacity-50 border-transparent cursor-not-allowed"
                        : "bg-app-surface text-app-text-secondary border-app-border hover:bg-app-hover";
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => onCell(h)}
                  disabled={st === "taken" || st === "off"}
                  className={`flex h-[34px] items-center justify-center rounded-lg border text-[11.5px] font-bold transition ${cls}`}
                >
                  {hourShort(h)}
                </button>
              );
            })}
          </div>
          {/* conflict line */}
          {range && (
            <ConflictLine
              tone={rangeHasBlocked ? "err" : tooLong ? "warn" : "ok"}
              text={
                rangeHasBlocked
                  ? "Taken — pick another time"
                  : tooLong
                    ? `That's longer than the ${maxHours} hr max`
                    : `This slot is free · ${formatHm(`${String(range.start).padStart(2, "0")}:00`)}–${formatHm(`${String(range.end + 1).padStart(2, "0")}:00`)}`
              }
            />
          )}
        </Card>

        {/* For whom */}
        {members.length > 0 && (
          <Card>
            <Overline>For whom</Overline>
            <div className="relative mt-2">
              <button
                type="button"
                onClick={() => setWhoOpen((v) => !v)}
                className="flex w-full items-center gap-2.5 rounded-lg border border-app-border bg-app-surface px-3 py-2.5"
              >
                {selectedMember && <Avatar member={selectedMember} size={28} />}
                <span className="flex-1 text-left text-[13px] font-semibold text-app-text">
                  {selectedMember?.name ?? "Choose a member"}
                </span>
                <ChevronDown className="h-4 w-4 text-app-text-muted" />
              </button>
              {whoOpen && (
                <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-app-border bg-app-surface py-1 shadow-lg">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setForWhom(m.id);
                        setWhoOpen(false);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-app-surface-sunken"
                    >
                      <Avatar member={m} size={24} />
                      <span className="flex-1 text-[12.5px] font-semibold text-app-text">
                        {m.name}
                      </span>
                      {forWhom === m.id && (
                        <Check
                          className="h-3.5 w-3.5 text-app-home"
                          strokeWidth={3}
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Notes */}
        <Section overline="Notes">
          <TextArea
            value={notes}
            onChange={setNotes}
            placeholder="Add a note (optional)"
            rows={3}
          />
        </Section>
      </div>
      </div>

      {/* Sticky submit */}
      <div className="border-t border-app-border bg-app-surface px-3.5 py-3">
        <PrimaryButton
          icon={Check}
          disabled={!canSubmit}
          onClick={submit}
        >
          Submit booking
        </PrimaryButton>
      </div>
    </div>
  );
}

function ConflictLine({
  tone,
  text,
}: {
  tone: "ok" | "err" | "warn";
  text: string;
}) {
  const map = {
    ok: { cls: "bg-app-success-bg text-app-success", Icon: CheckCircle2 },
    err: { cls: "bg-app-error-bg text-app-error", Icon: CircleX },
    warn: { cls: "bg-app-warning-bg text-app-warning", Icon: TriangleAlert },
  }[tone];
  return (
    <div
      className={`mt-2.5 flex items-center gap-2 rounded-lg px-3 py-2 ${map.cls}`}
    >
      <map.Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="text-[11.5px] font-semibold">{text}</span>
    </div>
  );
}
