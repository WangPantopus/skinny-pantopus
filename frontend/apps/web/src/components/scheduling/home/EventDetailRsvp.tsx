"use client";

// F2 — Home event detail, extended with per-person RSVP. EventHeader +
// DetailGrid + Attendees (RSVP pills) + your inline RSVP control + Notes, with
// Edit (opens the F3 form sheet) and Delete (confirm). RSVP is an optimistic
// upsert against POST /events/:eventId/rsvp.

import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  Check,
  CloudOff,
  Hand,
  HelpCircle,
  MapPin,
  Minus,
  Pencil,
  RotateCw,
  Tag,
  Repeat,
  Trash2,
  WifiOff,
  X as XIcon,
} from "lucide-react";
import type { RsvpStatus } from "@pantopus/types";
import BottomSheet from "@/components/ui/BottomSheet";
import { confirmStore } from "@/components/ui/confirm-store";
import { toast } from "@/components/ui/toast-store";
import { decodeError } from "@/components/scheduling/decodeError";
import { Avatar } from "./Avatars";
import AddEditEventForm from "./AddEditEventForm";
import {
  deleteHomeEvent,
  getHomeEventDetail,
  rsvpHomeEvent,
  type HomeEventAttendee,
  type HomeEventDetail,
} from "./api";
import {
  categoryFor,
  formatLongDate,
  minutesLabel,
  recurrenceLabel,
  remindersToMinutes,
  resolveMembers,
  RSVP_META,
  type HomeMember,
} from "./helpers";

export default function EventDetailRsvp({
  homeId,
  eventId,
  membersById,
  members,
  currentUserId,
  canEdit,
  onBack,
}: {
  homeId: string;
  eventId: string;
  membersById: Map<string, HomeMember>;
  members: HomeMember[];
  currentUserId: string | null;
  canEdit: boolean;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<HomeEventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [rsvpSaving, setRsvpSaving] = useState(false);
  const [changing, setChanging] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await getHomeEventDetail(homeId, eventId);
      setDetail(res);
      setError(null);
    } catch (err) {
      const decoded = decodeError(err);
      setError(
        decoded.kind === "not_found"
          ? "It may have been deleted, or your connection dropped."
          : decoded.message,
      );
    } finally {
      setLoading(false);
    }
  }, [homeId, eventId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  if (loading) return <DetailSkeleton />;

  if (error || !detail) {
    return (
      <div className="flex flex-col items-center justify-center px-7 py-20 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-app-error-bg">
          <CloudOff className="h-7 w-7 text-app-error" />
        </div>
        <div className="text-base font-bold text-app-text">
          Couldn&apos;t load this event
        </div>
        <p className="mt-1.5 max-w-[240px] text-[12.5px] text-app-text-secondary">
          {error}
        </p>
        <button
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-app-home px-5 py-2.5 text-sm font-bold text-white"
        >
          <RotateCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  const { event, attendees } = detail;
  const cat = categoryFor(event.event_type);
  const reminders = remindersToMinutes(event.reminders);

  // Attendee map; surface assigned members even if they haven't replied yet.
  const rsvpByUser = new Map<string, RsvpStatus>();
  for (const a of attendees) rsvpByUser.set(a.user_id, a.rsvp_status);
  const assignedMembers = resolveMembers(event.assigned_to, membersById);
  const extraAttendees: HomeEventAttendee[] = attendees.filter(
    (a) => !(event.assigned_to ?? []).includes(a.user_id),
  );
  const attendeeRows: { member: HomeMember; status: RsvpStatus }[] = [
    ...assignedMembers.map((m) => ({
      member: m,
      status: rsvpByUser.get(m.id) ?? ("pending" as RsvpStatus),
    })),
    ...extraAttendees.map((a) => ({
      member: membersById.get(a.user_id) ?? {
        id: a.user_id,
        name: "Member",
        initials: "··",
        avatarUrl: null,
        gradient: "linear-gradient(135deg,#9ca3af,#6b7280)",
      },
      status: a.rsvp_status,
    })),
  ];

  const myStatus: RsvpStatus | null = currentUserId
    ? (rsvpByUser.get(currentUserId) ?? null)
    : null;
  const showRsvp =
    !!currentUserId &&
    (event.request_rsvp ||
      (event.assigned_to ?? []).includes(currentUserId) ||
      myStatus !== null);
  const recorded = myStatus !== null && myStatus !== "pending" && !changing;

  const submitRsvp = async (status: RsvpStatus) => {
    if (!currentUserId) return;
    const prev = detail;
    // optimistic
    const nextAttendees = (() => {
      const has = attendees.some((a) => a.user_id === currentUserId);
      if (has) {
        return attendees.map((a) =>
          a.user_id === currentUserId ? { ...a, rsvp_status: status } : a,
        );
      }
      return [...attendees, { user_id: currentUserId, rsvp_status: status }];
    })();
    setDetail({ ...detail, attendees: nextAttendees });
    setChanging(false);
    setRsvpSaving(true);
    try {
      await rsvpHomeEvent(homeId, eventId, status);
    } catch (err) {
      setDetail(prev);
      toast.error(decodeError(err).message || "Couldn't save your RSVP");
    } finally {
      setRsvpSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirmStore.open({
      title: "Delete this event?",
      description:
        "This can't be undone. Attendees won't see it on the calendar anymore.",
      confirmLabel: "Delete",
      cancelLabel: "Keep",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await deleteHomeEvent(homeId, eventId);
      toast.success("Event deleted");
      onBack();
    } catch (err) {
      toast.error(decodeError(err).message || "Couldn't delete the event");
    }
  };

  const rsvpEnabled = isOnline && !rsvpSaving;

  return (
    <div className="pb-24">
      {/* offline banner */}
      {!isOnline && (
        <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <div className="text-[12px] font-bold text-amber-800">
              You&apos;re offline
            </div>
            <div className="mt-0.5 text-[11.5px] leading-[15px] text-amber-700">
              RSVP buttons are disabled until you reconnect.
            </div>
          </div>
        </div>
      )}

      {/* header */}
      <div className="px-1 pb-1 pt-3">
        <h2 className="text-[21px] font-bold leading-7 tracking-tight text-app-text">
          {event.title}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-app-text-secondary">
            {formatLongDate(event.start_at)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-app-surface-sunken px-2 py-0.5 text-[10.5px] font-semibold text-app-text-secondary">
            <span
              className="h-[7px] w-[7px] rounded-full"
              style={{ background: cat.color }}
            />
            {cat.label}
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {/* detail grid */}
        <Card>
          <DetailRow
            icon={<Repeat className="h-4 w-4" />}
            label="Repeats"
            value={recurrenceLabel(event.recurrence_rule)}
          />
          <DetailRow
            icon={<Bell className="h-4 w-4" />}
            label="Reminder"
            value={
              reminders.length
                ? reminders.map(minutesLabel).join(" · ")
                : "None"
            }
          />
          <DetailRow
            icon={<MapPin className="h-4 w-4" />}
            label="Location"
            value={event.location_notes || "—"}
          />
          <DetailRow
            icon={<Tag className="h-4 w-4" />}
            label="Type"
            value={cat.label}
            last
          />
        </Card>

        {/* attendees */}
        {attendeeRows.length > 0 && (
          <Card>
            <Overline>Attendees</Overline>
            <div className="mt-1">
              {attendeeRows.map((row, i) => (
                <div
                  key={row.member.id}
                  className={`flex items-center gap-2.5 py-2.5 ${
                    i === attendeeRows.length - 1
                      ? ""
                      : "border-b border-app-border"
                  }`}
                >
                  <Avatar member={row.member} size={30} />
                  <div className="min-w-0 flex-1 text-[13px] font-semibold text-app-text">
                    {row.member.name}
                    {row.member.id === currentUserId && (
                      <span className="font-semibold text-app-text-muted">
                        {" "}
                        · you
                      </span>
                    )}
                  </div>
                  <RsvpPill status={row.status} />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* your RSVP */}
        {showRsvp && (
          <Card highlight={!recorded && event.request_rsvp}>
            <Overline accent={isOnline}>Your RSVP</Overline>
            {recorded ? (
              <div className="flex items-center gap-2.5 py-0.5">
                {myStatus && (
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${RSVP_META[myStatus].recordedHalo}`}
                  >
                    <RsvpRecordedIcon status={myStatus} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-bold text-app-text">
                    {myStatus ? RSVP_META[myStatus].recordedTitle : ""}
                  </div>
                  <div className="mt-0.5 text-[11px] text-app-text-secondary">
                    Everyone can see your reply
                  </div>
                </div>
                <button
                  onClick={() => setChanging(true)}
                  className="inline-flex items-center gap-1.5 px-2 py-1 text-[13px] font-bold text-app-home"
                >
                  <Pencil className="h-3.5 w-3.5" /> Change
                </button>
              </div>
            ) : (
              <div className={`mt-1.5 space-y-2 ${!isOnline ? "opacity-50 pointer-events-none" : ""}`}>
                <RsvpSegmented
                  value={myStatus}
                  disabled={!rsvpEnabled}
                  onPick={submitRsvp}
                />
                {event.request_rsvp && myStatus === null && isOnline && (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-app-home">
                    <Hand className="h-3 w-3" /> Tap to let everyone know
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {/* notes */}
        {event.description && (
          <Card>
            <Overline>Notes</Overline>
            <p className="mt-1 text-[12.5px] leading-[18px] text-app-text">
              {event.description}
            </p>
          </Card>
        )}
      </div>

      {/* footer actions */}
      {canEdit && (
        <div className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-2xl items-center gap-2.5 border-t border-app-border bg-app-surface/95 px-4 py-3 backdrop-blur">
          <button
            onClick={() => setEditOpen(true)}
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-app-border-strong bg-app-surface text-sm font-bold text-app-text-secondary"
          >
            <Pencil className="h-4 w-4" /> Edit
          </button>
          <button
            onClick={handleDelete}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-bold text-app-error"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      )}

      {/* edit sheet */}
      <BottomSheet open={editOpen} onClose={() => setEditOpen(false)}>
        <div className="h-[80vh]">
          <AddEditEventForm
            homeId={homeId}
            members={members}
            event={event}
            onCancel={() => setEditOpen(false)}
            onSaved={(updated) => {
              setDetail((d) => (d ? { ...d, event: updated } : d));
              setEditOpen(false);
              toast.success("Event updated");
              void load();
            }}
          />
        </div>
      </BottomSheet>
    </div>
  );
}

// ─── Local pieces ─────────────────────────────────────────────
function Card({
  children,
  highlight,
}: {
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-app-surface p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${
        highlight
          ? "border-app-home ring-4 ring-app-home-bg"
          : "border-app-border"
      }`}
    >
      {children}
    </div>
  );
}
function Overline({
  children,
  accent,
}: {
  children: React.ReactNode;
  /** true = home-green accent; false/undefined = secondary text */
  accent?: boolean;
}) {
  return (
    <div
      className={`text-[9.5px] font-bold uppercase tracking-[0.08em] ${
        accent ? "text-app-home" : "text-app-text-secondary"
      }`}
    >
      {children}
    </div>
  );
}
function DetailRow({
  icon,
  label,
  value,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 py-2.5 ${
        last ? "" : "border-b border-app-border"
      }`}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-app-surface-sunken text-app-text-secondary">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-app-text-muted">
          {label}
        </div>
        <div className="mt-0.5 truncate text-[13px] font-semibold text-app-text">
          {value}
        </div>
      </div>
    </div>
  );
}
function RsvpPill({ status }: { status: RsvpStatus }) {
  const meta = RSVP_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${meta.cls}`}
    >
      <RsvpIcon icon={meta.icon} />
      {meta.label}
    </span>
  );
}

/** 11×11 inline icon for RSVP pills — matches the design's data-lucide glyph set. */
function RsvpIcon({
  icon,
}: {
  icon: "check" | "help-circle" | "x" | "minus";
}) {
  const cls = "h-[11px] w-[11px]";
  if (icon === "check") return <Check className={cls} strokeWidth={2.6} />;
  if (icon === "help-circle") return <HelpCircle className={cls} strokeWidth={2.6} />;
  if (icon === "x") return <XIcon className={cls} strokeWidth={2.6} />;
  return <Minus className={cls} strokeWidth={2.6} />;
}

/** Icon inside the recorded-RSVP halo circle. */
function RsvpRecordedIcon({ status }: { status: RsvpStatus }) {
  const icon = RSVP_META[status].recordedIcon;
  const cls = "h-4 w-4";
  if (icon === "check") return <Check className={cls} strokeWidth={2.6} />;
  if (icon === "help-circle")
    return <HelpCircle className={cls} strokeWidth={2.6} />;
  if (icon === "x") return <XIcon className={cls} strokeWidth={2.6} />;
  // "minus" — pending/no-reply recorded state
  return <Minus className={cls} strokeWidth={2.6} />;
}
function RsvpSegmented({
  value,
  disabled,
  onPick,
}: {
  value: RsvpStatus | null;
  disabled?: boolean;
  onPick: (s: RsvpStatus) => void;
}) {
  const opts: { status: RsvpStatus; label: string }[] = [
    { status: "going", label: "Going" },
    { status: "maybe", label: "Maybe" },
    { status: "declined", label: "Can't" },
  ];
  return (
    <div className="flex gap-0.5 rounded-lg bg-app-surface-sunken p-0.5">
      {opts.map((o) => {
        const on = o.status === value;
        return (
          <button
            key={o.status}
            type="button"
            disabled={disabled}
            onClick={() => onPick(o.status)}
            className={`h-9 flex-1 rounded-md text-[12.5px] font-bold transition disabled:opacity-60 ${
              on
                ? "bg-app-home text-white shadow-sm"
                : "text-app-text-secondary"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-3 pt-3">
      <div className="px-1">
        <div className="h-6 w-3/5 rounded-md bg-app-surface-sunken" />
        <div className="mt-2.5 h-3 w-2/5 rounded bg-app-surface-sunken" />
      </div>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="space-y-3 rounded-2xl border border-app-border bg-app-surface p-3.5"
        >
          {[0, 1, 2].map((j) => (
            <div key={j} className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-lg bg-app-surface-sunken" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2 w-2/5 rounded bg-app-surface-sunken" />
                <div className="h-3 w-3/5 rounded bg-app-surface-sunken" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
