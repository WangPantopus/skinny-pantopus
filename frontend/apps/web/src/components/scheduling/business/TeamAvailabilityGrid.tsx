"use client";

// G3 — Team Booking Availability. Which members are bookable + the hours that
// feed round-robin. Reads the business team roster (seats) and the per-member
// free grids (GET /team-availability, business-only) to render each member,
// their free-day summary and a coverage strip. The "bookable" toggle persists
// per-member opt-outs in the booking-page branding (no destructive seat change).
// Non-admins see a read-only, permission-gated view. Business violet accents.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarX,
  ChevronRight,
  Info,
  Lock,
  User,
} from "lucide-react";
import * as api from "@pantopus/api";
import type { BookingPage, TeamAvailability } from "@pantopus/types";
import { PillarThemeProvider } from "@/components/scheduling/PillarThemeProvider";
import { detectTimezone } from "@/components/scheduling/TimezoneSelector";
import { decodeError } from "@/components/scheduling/decodeError";
import ErrorState from "@/components/ui/ErrorState";
import { toast } from "@/components/ui/toast-store";
import {
  AccentOverline,
  BusinessSwitcher,
  Card,
  Chip,
  MemberAvatar,
  Note,
  Skeleton,
  Toggle,
} from "./ui";
import { useBusinessOwner } from "./owner";
import {
  coverageFromFreeByMember,
  freeWeekdaysLabel,
  gapLabel,
  rosterFromSeats,
  type TeamMemberView,
} from "./members";
import { brandingPatch, readBookableOff } from "./settings";

const MANAGE_ROLES = new Set(["owner", "admin", "manager"]);

function rangeFromToday(days: number): { from: string; to: string } {
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + days);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

function MemberRow({
  member,
  freeLabel,
  bookable,
  gated,
  last,
  onToggle,
  onOpen,
}: {
  member: TeamMemberView;
  freeLabel: string;
  bookable: boolean;
  gated: boolean;
  last: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const off = !bookable;
  return (
    <div
      className={
        "flex items-center gap-3 px-4 py-3" +
        (last ? "" : " border-b border-app-border") +
        (off ? " opacity-60" : "")
      }
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        aria-label={`Edit ${member.name}'s booking hours`}
      >
        <MemberAvatar id={member.id} name={member.name} size="lg" dim={off} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-app-text">
            {member.name}
            {member.isYou && (
              <span className="ml-1.5 text-[10px] font-bold uppercase text-app-business">
                You
              </span>
            )}
          </span>
          <span className="block truncate text-[11px] text-app-text-secondary">
            {off ? "Not taking bookings" : freeLabel}
          </span>
          <span className="mt-1 inline-flex">
            {member.isActive ? (
              <Chip tone="business" icon={User}>
                Personal hours
              </Chip>
            ) : (
              <Chip tone="neutral" icon={Building2}>
                Business hours
              </Chip>
            )}
          </span>
        </span>
      </button>
      {!gated && (
        <Toggle
          on={bookable}
          onChange={onToggle}
          disabled={!member.isActive}
          label={`${member.name} bookable`}
        />
      )}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Edit ${member.name}'s hours`}
        className="shrink-0"
      >
        <ChevronRight className="h-4 w-4 text-app-text-muted" aria-hidden />
      </button>
    </div>
  );
}

function CoverageStrip({
  gaps,
  hasWeekdayGap,
}: {
  gaps: number[];
  hasWeekdayGap: boolean;
}) {
  if (gaps.length === 0) return null;
  if (hasWeekdayGap) {
    return (
      <Note tone="warning" icon={CalendarX}>
        {gapLabel(gaps)} have no coverage — add hours for at least one member.
      </Note>
    );
  }
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-app-border bg-app-surface px-3.5 py-3 shadow-sm">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-surface-sunken text-app-text-secondary">
        <CalendarX className="h-4 w-4" aria-hidden />
      </span>
      <span className="text-xs font-medium leading-tight text-app-text-strong">
        No one is available {gapLabel(gaps).toLowerCase()}.
      </span>
    </div>
  );
}

export default function TeamAvailabilityGrid() {
  const biz = useBusinessOwner();
  const owner = biz.owner;

  const [roster, setRoster] = useState<TeamMemberView[]>([]);
  const [avail, setAvail] = useState<TeamAvailability | null>(null);
  const [page, setPage] = useState<BookingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tz = useMemo(() => detectTimezone(), []);
  const range = useMemo(() => rangeFromToday(13), []);

  const load = useCallback(async () => {
    if (!owner?.ownerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [seatsRes, pageRes] = await Promise.all([
        api.businessSeats.getBusinessSeats(owner.ownerId),
        api.scheduling.getBookingPage(owner),
      ]);
      setRoster(rosterFromSeats(seatsRes.seats));
      setPage(pageRes.page);
      // team-availability is business-only; surface its error inline but keep
      // the roster visible.
      try {
        const a = await api.scheduling.getTeamAvailability(
          { ...range, tz },
          owner,
        );
        setAvail(a);
      } catch {
        setAvail({ members: [], freeByMember: {} });
      }
    } catch (err) {
      setError(decodeError(err).message);
    } finally {
      setLoading(false);
    }
  }, [owner, range, tz]);

  useEffect(() => {
    void load();
  }, [load]);

  const bookableOff = useMemo(() => new Set(readBookableOff(page)), [page]);

  const viewerSeat = roster.find((m) => m.isYou);
  // Default to manage-capable (e.g. the owner with no seat row of their own).
  const gated = useMemo(() => {
    const rawRole = viewerSeat?.role.toLowerCase() ?? "";
    if (!viewerSeat) return false;
    return ![...MANAGE_ROLES].some((r) => rawRole.includes(r));
  }, [viewerSeat]);

  const toggleBookable = useCallback(
    async (memberId: string, nextBookable: boolean) => {
      if (!owner || !page) return;
      const off = new Set(readBookableOff(page));
      if (nextBookable) off.delete(memberId);
      else off.add(memberId);
      const nextOff = [...off];
      // optimistic
      setPage({
        ...page,
        branding: brandingPatch(page, { bookableOff: nextOff }),
      });
      try {
        const { page: updated } = await api.scheduling.updateBookingPage(
          { branding: brandingPatch(page, { bookableOff: nextOff }) },
          owner,
        );
        setPage(updated);
      } catch (err) {
        setPage(page); // revert
        toast.error(decodeError(err).message || "Couldn’t update");
      }
    },
    [owner, page],
  );

  const coverage = useMemo(() => {
    const bookableIds = roster
      .filter((m) => m.isActive && !bookableOff.has(m.id))
      .map((m) => m.id);
    return coverageFromFreeByMember(
      avail?.freeByMember,
      bookableIds,
      range.from,
      range.to,
    );
  }, [roster, avail, bookableOff, range]);

  // ── States ────────────────────────────────────────────────────────────────

  if (biz.loading || (loading && owner)) {
    return <TeamSkeleton switcher={biz.options.length > 1} />;
  }

  if (biz.unavailable || !owner) {
    return (
      <div className="mx-auto max-w-2xl">
        <Header
          options={biz.options}
          activeId={biz.active?.id ?? null}
          onSwitch={biz.setActiveId}
        />
        <Note tone="info" icon={Info}>
          Team booking availability is available once you own or join a
          business.
        </Note>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <Header
          options={biz.options}
          activeId={biz.active?.id ?? null}
          onSwitch={biz.setActiveId}
        />
        <ErrorState message={error} onRetry={() => void load()} />
      </div>
    );
  }

  return (
    <PillarThemeProvider pillar="business">
      <div className="mx-auto max-w-2xl space-y-3">
        <Header
          options={biz.options}
          activeId={biz.active?.id ?? null}
          onSwitch={biz.setActiveId}
        />

        <Note tone="info" icon={Info}>
          Bookings use each member’s personal availability. Edit a member’s
          hours to change when they can be booked.
        </Note>

        <section>
          <AccentOverline className="pb-2">Team</AccentOverline>
          {roster.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
                <p className="text-sm font-semibold text-app-text">
                  No team members yet
                </p>
                <p className="max-w-xs text-xs text-app-text-secondary">
                  Invite members to your business to assign and rotate bookings.
                </p>
              </div>
            </Card>
          ) : (
            <Card>
              {roster.map((m, i) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  freeLabel={freeWeekdaysLabel(avail?.freeByMember?.[m.id])}
                  bookable={m.isActive && !bookableOff.has(m.id)}
                  gated={gated}
                  last={i === roster.length - 1}
                  onToggle={() =>
                    void toggleBookable(m.id, bookableOff.has(m.id))
                  }
                  onOpen={() => {
                    window.location.href = `/app/scheduling/business/members/${encodeURIComponent(m.id)}/hours`;
                  }}
                />
              ))}
            </Card>
          )}
        </section>

        <CoverageStrip
          gaps={coverage.gaps}
          hasWeekdayGap={coverage.hasWeekdayGap}
        />

        {gated && (
          <div className="flex items-center gap-1.5 px-1 text-app-text-muted">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            <span className="text-[11px] font-medium">
              Only admins can change booking hours (team.manage).
            </span>
          </div>
        )}
      </div>
    </PillarThemeProvider>
  );
}

function Header({
  options,
  activeId,
  onSwitch,
}: {
  options: { id: string; name: string }[];
  activeId: string | null;
  onSwitch: (id: string) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-app-business">
          Business
        </p>
        <h1 className="text-xl font-bold text-app-text">
          Booking availability
        </h1>
      </div>
      <BusinessSwitcher
        options={options}
        activeId={activeId}
        onChange={onSwitch}
      />
    </div>
  );
}

function TeamSkeleton({ switcher }: { switcher: boolean }) {
  return (
    <div className="mx-auto max-w-2xl space-y-3" aria-hidden>
      <div className="flex items-start justify-between">
        <div>
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-2 h-6 w-44" />
        </div>
        {switcher && <Skeleton className="h-7 w-28 rounded-full" />}
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
      <Card>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={
              "flex items-center gap-3 px-4 py-3.5" +
              (i === 3 ? "" : " border-b border-app-border")
            }
          >
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-3 w-2/5" />
              <Skeleton className="mt-1.5 h-2 w-3/5" />
              <Skeleton className="mt-2 h-4 w-20 rounded-full" />
            </div>
            <Skeleton className="h-7 w-12 rounded-full" />
          </div>
        ))}
      </Card>
    </div>
  );
}
