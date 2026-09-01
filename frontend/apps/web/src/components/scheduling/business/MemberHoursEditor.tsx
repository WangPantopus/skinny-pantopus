"use client";

// G4 — Member Working-Hours Editor. Edits one team member's bookable weekly
// hours. Availability is per-user on the backend (req.user), so a member can
// edit only their OWN hours here; everyone else renders the read-only
// "inherits personal" deferral (only the member can change their hours). Reuses
// the weekday + time-range grid; date overrides + block-out link to the full
// availability editor. Business violet accents; sky CTA. Frames: editing ·
// override · blocked · inherits (read-only) · saving · loading.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Ban,
  CalendarClock,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Copy,
  Globe,
  Link as LinkIcon,
  Plus,
  X,
} from "lucide-react";
import * as api from "@pantopus/api";
import type {
  AvailabilityOverride,
  AvailabilitySchedule,
  TeamAvailability,
} from "@pantopus/types";
import { PillarThemeProvider } from "@/components/scheduling/PillarThemeProvider";
import {
  detectTimezone,
  zoneLabel,
} from "@/components/scheduling/TimezoneSelector";
import { decodeError } from "@/components/scheduling/decodeError";
import ErrorState from "@/components/ui/ErrorState";
import { toast } from "@/components/ui/toast-store";
import {
  AccentOverline,
  Card,
  IconDisc,
  MemberAvatar,
  Note,
  PrimaryButton,
  Skeleton,
} from "./ui";
import { useBusinessOwner } from "./owner";
import {
  rosterFromSeats,
  type TeamMemberView,
} from "./members";
import {
  type DayHours,
  type HourRange,
  addRange,
  copyToWeekdays,
  formatTime,
  hasInvalidRanges,
  removeRange,
  rulesToWeek,
  setDayRanges,
  timeOptions,
  weekToRules,
} from "./weeklyHours";

const TIME_OPTIONS = timeOptions(30);

function TimeSelect({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-app-border bg-app-surface px-1.5 py-0.5 text-[11px] font-semibold text-app-business focus:outline-none focus:ring-2 focus:ring-app-business"
    >
      {TIME_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function RangePill({
  range,
  onChange,
  onRemove,
}: {
  range: HourRange;
  onChange: (next: HourRange) => void;
  onRemove: () => void;
}) {
  const invalid = range.start >= range.end;
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-2 py-1 " +
        (invalid ? "bg-app-error-bg" : "bg-app-business-bg")
      }
    >
      <TimeSelect
        value={range.start}
        ariaLabel="Start time"
        onChange={(v) => onChange({ ...range, start: v })}
      />
      <span className="text-[11px] font-bold text-app-business">–</span>
      <TimeSelect
        value={range.end}
        ariaLabel="End time"
        onChange={(v) => onChange({ ...range, end: v })}
      />
      <button
        type="button"
        aria-label="Remove range"
        onClick={onRemove}
        className="text-app-business"
      >
        <X className="h-3 w-3" strokeWidth={2.6} aria-hidden />
      </button>
    </span>
  );
}

function ReadonlyRangePill({ range }: { range: HourRange }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-app-surface-sunken px-2.5 py-1 text-[11px] font-bold text-app-text-strong">
      {formatTime(range.start)}–{formatTime(range.end)}
    </span>
  );
}

function DayRow({
  day,
  readonly,
  last,
  onAdd,
  onChangeRange,
  onRemoveRange,
}: {
  day: DayHours;
  readonly?: boolean;
  last: boolean;
  onAdd: () => void;
  onChangeRange: (index: number, next: HourRange) => void;
  onRemoveRange: (index: number) => void;
}) {
  const off = day.ranges.length === 0;
  return (
    <div
      className={
        "flex items-start gap-3 px-4 py-3" +
        (last ? "" : " border-b border-app-border")
      }
    >
      <div
        className={
          "w-8 shrink-0 pt-1 text-xs font-bold " +
          (off ? "text-app-text-muted" : "text-app-text-strong")
        }
      >
        {day.label}
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        {off ? (
          <span className="pt-1 text-[11px] font-medium text-app-text-muted">
            Unavailable
          </span>
        ) : (
          day.ranges.map((r, i) =>
            readonly ? (
              <ReadonlyRangePill key={i} range={r} />
            ) : (
              <RangePill
                key={i}
                range={r}
                onChange={(next) => onChangeRange(i, next)}
                onRemove={() => onRemoveRange(i)}
              />
            ),
          )
        )}
      </div>
      {!readonly && (
        <button
          type="button"
          aria-label={`Add a range to ${day.label}`}
          onClick={onAdd}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-surface text-app-business"
        >
          <Plus className="h-3 w-3" aria-hidden />
        </button>
      )}
    </div>
  );
}

function DatedCard({ override }: { override: AvailabilityOverride }) {
  const blocked = override.is_unavailable;
  const sub = blocked
    ? "No bookings on this date"
    : override.start_time && override.end_time
      ? `${formatTime(override.start_time)}–${formatTime(override.end_time)} only`
      : "Custom hours for this date";
  return (
    <div
      className={
        "flex items-center gap-3 rounded-2xl border px-3.5 py-3 shadow-sm " +
        (blocked
          ? "border-app-error-light bg-app-error-bg"
          : "border-app-border bg-app-surface")
      }
    >
      <span
        className={
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg " +
          (blocked
            ? "bg-white text-app-error"
            : "bg-app-business-bg text-app-business")
        }
      >
        {blocked ? (
          <Ban className="h-4 w-4" aria-hidden />
        ) : (
          <CalendarClock className="h-4 w-4" aria-hidden />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={
            "text-[12.5px] font-bold " +
            (blocked ? "text-app-error" : "text-app-text")
          }
        >
          {formatOverrideDate(override.date)}
          {blocked ? " · Time off" : ""}
        </p>
        <p
          className={
            "text-[11px] " +
            (blocked ? "text-app-error" : "text-app-text-secondary")
          }
        >
          {sub}
        </p>
      </div>
    </div>
  );
}

function formatOverrideDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m) return date;
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return dt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  });
}

export default function MemberHoursEditor({ memberId }: { memberId: string }) {
  const biz = useBusinessOwner();
  const owner = biz.owner;

  const [roster, setRoster] = useState<TeamMemberView[]>([]);
  const [schedule, setSchedule] = useState<AvailabilitySchedule | null>(null);
  const [week, setWeek] = useState<DayHours[] | null>(null);
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
  const [tz, setTz] = useState<string | null>(null);
  const [avail, setAvail] = useState<TeamAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const member = useMemo(
    () => roster.find((m) => m.id === memberId) ?? null,
    [roster, memberId],
  );
  const isYou = member?.isYou ?? false;

  const load = useCallback(async () => {
    if (!owner?.ownerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setDirty(false);
    try {
      const seatsRes = await api.businessSeats.getBusinessSeats(owner.ownerId);
      const list = rosterFromSeats(seatsRes.seats);
      setRoster(list);
      const me = list.find((m) => m.id === memberId);
      if (me?.isYou) {
        // Editable: load my own availability.
        const bundle = await api.scheduling.getAvailability(owner);
        const sched =
          bundle.schedules.find((s) => s.is_default) ??
          bundle.schedules[0] ??
          null;
        setSchedule(sched);
        setWeek(rulesToWeek(bundle.rules));
        setOverrides(bundle.overrides ?? []);
        setTz(sched?.timezone ?? detectTimezone());
      } else {
        // Read-only: pull the member's free-day summary for context.
        try {
          const today = new Date();
          const to = new Date(today);
          to.setDate(to.getDate() + 13);
          const iso = (d: Date) => d.toISOString().slice(0, 10);
          const a = await api.scheduling.getTeamAvailability(
            { from: iso(today), to: iso(to), tz: detectTimezone() },
            owner,
          );
          setAvail(a);
        } catch {
          setAvail(null);
        }
      }
    } catch (err) {
      setError(decodeError(err).message);
    } finally {
      setLoading(false);
    }
  }, [owner, memberId]);

  useEffect(() => {
    void load();
  }, [load]);

  const mutateWeek = useCallback((next: DayHours[]) => {
    setWeek(next);
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    if (!owner || !schedule || !week || saving) return;
    if (hasInvalidRanges(week)) {
      toast.error("Fix overlapping or backwards time ranges first");
      return;
    }
    setSaving(true);
    try {
      await api.scheduling.updateRules(schedule.id, weekToRules(week), owner);
      toast.success("Hours saved");
      setDirty(false);
    } catch (err) {
      toast.error(decodeError(err).message || "Couldn’t save hours");
    } finally {
      setSaving(false);
    }
  }, [owner, schedule, week, saving]);

  // ── States ────────────────────────────────────────────────────────────────

  if (biz.loading || (loading && owner)) return <MemberHoursSkeleton />;

  if (biz.unavailable || !owner) {
    return (
      <div className="mx-auto max-w-2xl">
        <Header name="Member hours" />
        <Note tone="info" icon={LinkIcon}>
          Member hours are available once you own or join a business.
        </Note>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <Header name="Member hours" />
        <ErrorState message={error} onRetry={() => void load()} />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="mx-auto max-w-2xl">
        <Header name="Member hours" />
        <ErrorState
          message="This team member could not be found."
          onRetry={() => void load()}
        />
      </div>
    );
  }

  const title = `${member.name.split(/\s+/)[0]}’s booking hours`;

  // Read-only deferral for other members.
  if (!isYou) {
    // Build a best-effort readonly week from the team availability data.
    // Since the member’s personal schedule is user-scoped (not accessible
    // via the API for other members), we derive day on/off from their free
    // windows and show placeholder hour ranges where available.
    const memberFreeWindows = avail?.freeByMember?.[member.id] ?? [];
    const readonlyWeek = buildReadonlyWeek(memberFreeWindows);
    return (
      <PillarThemeProvider pillar="business">
        <div className="mx-auto max-w-2xl space-y-3">
          <Header name={title} member={member} />
          {/* Inherits-banner: link icon + text + "View personal" sky button */}
          <div className="flex items-center gap-2.5 rounded-[14px] bg-app-business-bg px-3.5 py-3">
            <LinkIcon
              className="h-4 w-4 shrink-0 text-app-business"
              aria-hidden
            />
            <p className="flex-1 text-[11.5px] font-medium leading-[15px] text-app-text-strong">
              These hours come from {member.name.split(/\s+/)[0]}&apos;s personal availability.
            </p>
            <Link
              href="/app/scheduling/availability"
              className="shrink-0 whitespace-nowrap text-[11.5px] font-bold text-primary-600 hover:underline"
            >
              View personal
            </Link>
          </div>
          {/* Dimmed readonly week grid — opacity 0.6 per design */}
          <div className="opacity-60">
            <Card>
              {readonlyWeek.map((day, i) => (
                <DayRow
                  key={day.weekday}
                  day={day}
                  readonly
                  last={i === readonlyWeek.length - 1}
                  onAdd={() => {}}
                  onChangeRange={() => {}}
                  onRemoveRange={() => {}}
                />
              ))}
            </Card>
          </div>
        </div>
      </PillarThemeProvider>
    );
  }

  // Editable: the viewer's own hours.
  return (
    <PillarThemeProvider pillar="business">
      <div className="mx-auto max-w-2xl space-y-3 pb-24">
        <Header name={title} member={member} />

        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full bg-app-business-bg px-3 py-1.5 text-[11.5px] font-bold text-app-business"
          aria-label="Time zone"
        >
          <Globe className="h-3.5 w-3.5" aria-hidden />
          {tz ? zoneLabel(tz) : detectTimezone()}
        </button>

        {week && (
          <Card>
            {week.map((day, i) => (
              <DayRow
                key={day.weekday}
                day={day}
                last={i === week.length - 1}
                onAdd={() => mutateWeek(addRange(week, day.weekday))}
                onChangeRange={(idx, next) =>
                  mutateWeek(
                    setDayRanges(
                      week,
                      day.weekday,
                      day.ranges.map((r, ri) => (ri === idx ? next : r)),
                    ),
                  )
                }
                onRemoveRange={(idx) =>
                  mutateWeek(removeRange(week, day.weekday, idx))
                }
              />
            ))}
          </Card>
        )}

        {week && (
          <button
            type="button"
            onClick={() => mutateWeek(copyToWeekdays(week, 1))}
            className="inline-flex items-center gap-1.5 px-1 text-xs font-bold text-primary-600"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            Copy Monday to weekdays
          </button>
        )}

        <section>
          <AccentOverline className="pb-2 pt-2">Date overrides</AccentOverline>
          <div className="space-y-2">
            {overrides.slice(0, 4).map((o, i) => (
              <DatedCard key={o.id ?? `${o.date}-${i}`} override={o} />
            ))}
            <Card>
              <OverrideLinkRow
                icon={CalendarPlus}
                label="Add a date override"
                href={
                  schedule
                    ? `/app/scheduling/availability/${schedule.id}`
                    : "/app/scheduling/availability"
                }
              />
              <OverrideLinkRow
                icon={Ban}
                label="Block out time"
                href="/app/scheduling/availability/blocks"
                last
              />
            </Card>
          </div>
        </section>
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 left-0 right-0 mt-2 border-t border-app-border bg-app-surface/95 px-1 py-3 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <PrimaryButton
            onClick={save}
            loading={saving}
            disabled={!dirty && !saving}
          >
            {saving ? "Saving" : "Save hours"}
          </PrimaryButton>
        </div>
      </div>
    </PillarThemeProvider>
  );
}

// Builds a Mon-first readonly DayHours array for display in the inherits-personal
// banner. The member's exact schedule is user-scoped on the backend so we can't
// load it for another user; we show all days as "Unavailable" to avoid fabricating
// hours. If the team availability windows provide usable data in the future this
// function can be enhanced to populate them.
function buildReadonlyWeek(_windows: { start: string; end: string }[]): DayHours[] {
  const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sun
  const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return DISPLAY_ORDER.map((wd) => ({
    weekday: wd,
    label: SHORT[wd] ?? "",
    ranges: [],
  }));
}

function OverrideLinkRow({
  icon: Icon,
  label,
  href,
  last,
}: {
  icon: typeof CalendarPlus;
  label: string;
  href: string;
  last?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-app-hover" +
        (last ? "" : " border-b border-app-border")
      }
    >
      <IconDisc icon={Icon} />
      <span className="flex-1 text-[13px] font-medium text-app-text">
        {label}
      </span>
      <ChevronRight className="h-4 w-4 text-app-text-muted" aria-hidden />
    </Link>
  );
}

function Header({ name, member }: { name: string; member?: TeamMemberView }) {
  return (
    <div className="flex items-center gap-3">
      <Link
        href="/app/scheduling/business/team-availability"
        aria-label="Back to team availability"
        className="flex h-9 w-9 items-center justify-center rounded-full text-app-text-secondary transition-colors hover:bg-app-hover"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </Link>
      {member && <MemberAvatar id={member.id} name={member.name} />}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-app-business">
          Business
        </p>
        <h1 className="text-lg font-bold text-app-text">{name}</h1>
      </div>
    </div>
  );
}

function MemberHoursSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-3" aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-9 w-9 rounded-full" />
        <div>
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-1.5 h-5 w-44" />
        </div>
      </div>
      <Skeleton className="h-8 w-48 rounded-full" />
      <Card>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className={
              "flex items-center gap-3 px-4 py-3.5" +
              (i === 6 ? "" : " border-b border-app-border")
            }
          >
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-6 w-40 rounded-full" />
            <div className="flex-1" />
            <Skeleton className="h-6 w-6 rounded-full" />
          </div>
        ))}
      </Card>
    </div>
  );
}
