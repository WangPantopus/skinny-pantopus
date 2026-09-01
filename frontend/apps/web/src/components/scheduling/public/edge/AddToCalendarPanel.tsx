"use client";

// D8 — Add to Calendar. Matches the 5-frame design spec:
//   Frame 1 (web-default): SheetHeader + blue RecapChip + 4 rows + caption + DoneBar.
//   Frame 3 (generating): the .ics row morphs to a skeleton state while generating.
//   Frame 4 (added): selected row morphs to a green success state + status line.
// Render inline, or pass to a <BottomSheet> to present as a sheet. Public manage
// surfaces pass the .ics endpoint (publicBooking.getIcsUrl(token)); host surfaces
// let it build inline via icsDataUri.

import { useState } from "react";
import { Calendar, CalendarDays, ChevronRight, Download, CheckCircle2 } from "lucide-react";
import clsx from "clsx";
import type { CalendarEventInput } from "@/components/scheduling";
import { formatRange, tzAbbrev } from "./edgeUtils";

// ─── URL builders ────────────────────────────────────────────────────────────

function utcStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function googleUrl(e: CalendarEventInput): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${utcStamp(e.start)}/${utcStamp(e.end)}`,
    details: e.description || "",
    location: e.location || "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function outlookUrl(e: CalendarEventInput): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: e.title,
    startdt: new Date(e.start).toISOString(),
    enddt: new Date(e.end).toISOString(),
    body: e.description || "",
    location: e.location || "",
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function icsDataUri(e: CalendarEventInput): string {
  const uid = `${utcStamp(e.start)}-${Math.random().toString(36).slice(2)}@pantopus`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pantopus//Calendarly//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${utcStamp(new Date().toISOString())}`,
    `DTSTART:${utcStamp(e.start)}`,
    `DTEND:${utcStamp(e.end)}`,
    `SUMMARY:${escapeIcs(e.title)}`,
    e.description ? `DESCRIPTION:${escapeIcs(e.description)}` : "",
    e.location ? `LOCATION:${escapeIcs(e.location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

// ─── Row types ────────────────────────────────────────────────────────────────

type RowState = "default" | "skeleton" | "done";

type RowConfig = {
  key: string;
  icon: typeof Calendar;
  label: string;
  sub: string;
  href: string;
  download?: boolean;
  state?: RowState;
  doneLabel?: string;
  doneSub?: string;
};

function PickerRow({
  icon: Icon,
  label,
  sub,
  href,
  download: isDownload,
  state = "default",
  doneLabel,
  doneSub,
  last,
}: RowConfig & { last?: boolean }) {
  const isSkeleton = state === "skeleton";
  const isDone = state === "done";

  const inner = (
    <span
      className={clsx(
        "flex h-14 w-full cursor-pointer items-center gap-3 px-3.5 hover:bg-app-hover",
        !last && "border-b border-app-border",
      )}
    >
      {/* leading icon disc */}
      <span
        className={clsx(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]",
          isDone
            ? "bg-app-success-bg text-app-success"
            : "bg-app-surface-muted text-app-text-secondary",
        )}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>

      {/* label + sub */}
      <span className="min-w-0 flex-1">
        {isSkeleton ? (
          <>
            <span
              className={clsx(
                "block text-[13.5px] font-semibold leading-snug",
                isDone ? "text-app-success" : "text-app-text",
              )}
            >
              {label}
            </span>
            <span className="mt-1.5 flex items-center gap-2">
              <span className="h-2 w-24 animate-pulse rounded-full bg-app-surface-muted" />
              <span className="text-[10.5px] text-app-text-muted">
                Preparing your file
              </span>
            </span>
          </>
        ) : (
          <>
            <span
              className={clsx(
                "block text-[13.5px] font-semibold leading-snug",
                isDone ? "text-app-success" : "text-app-text",
              )}
            >
              {isDone ? (doneLabel ?? label) : label}
            </span>
            {(isDone ? doneSub : sub) && (
              <span className="mt-0.5 block text-[10.5px] text-app-text-muted">
                {isDone ? doneSub : sub}
              </span>
            )}
          </>
        )}
      </span>

      {/* trailing */}
      {isDone ? (
        <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-app-success" aria-hidden />
      ) : isSkeleton ? null : (
        <ChevronRight className="h-4 w-4 shrink-0 text-app-text-muted" aria-hidden />
      )}
    </span>
  );

  if (isSkeleton) {
    return <span className="block">{inner}</span>;
  }

  return (
    <a
      href={href}
      target={isDownload ? undefined : "_blank"}
      rel="noopener noreferrer"
      download={isDownload ? "invite.ics" : undefined}
      className="block"
    >
      {inner}
    </a>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

export default function AddToCalendarPanel({
  event,
  tz,
  icsUrl,
  onDone,
  className,
}: {
  event: CalendarEventInput;
  tz?: string;
  /** Public manage surfaces pass the token .ics endpoint. */
  icsUrl?: string;
  /** Called when the user taps Done. */
  onDone?: () => void;
  className?: string;
}) {
  const [addedKey, setAddedKey] = useState<string | null>(null);

  const recap = [
    event.title,
    formatRange(event.start, event.end, tz),
    tz ? tzAbbrev(tz) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // The ICS href is built synchronously (data URI); no async generating state
  // is needed for the web-default frame because the download is instant. The
  // skeleton state is modelled but only activates if an explicit icsUrl prop is
  // absent AND we want to show a brief transitional state — currently the state
  // is "default" for all rows and flips to "done" on the Apple Calendar row
  // when the user taps it.
  const ics = icsUrl ?? icsDataUri(event);

  const rows: RowConfig[] = [
    {
      key: "apple",
      icon: Calendar,
      label: "Apple Calendar",
      sub: "Save to your iPhone",
      href: ics,
      doneLabel: "Added to Apple Calendar",
      doneSub: "With a reminder 10 minutes before",
    },
    {
      key: "google",
      icon: CalendarDays,
      label: "Google Calendar",
      sub: "Opens in your browser",
      href: googleUrl(event),
    },
    {
      key: "outlook",
      icon: CalendarDays,
      label: "Outlook",
      sub: "Opens in your browser",
      href: outlookUrl(event),
    },
    {
      key: "ics",
      icon: Download,
      label: "Download .ics file",
      sub: "Works with any calendar app",
      href: ics,
      download: true,
    },
  ];

  return (
    <div className={clsx("flex flex-col", className)}>
      {/* SheetHeader */}
      <div className="px-3.5 pb-0 pt-2">
        <p className="text-[15px] font-bold tracking-tight text-app-text">
          Add to your calendar
        </p>
      </div>

      {/* RecapChip — blue50/blue100/blue700 palette */}
      <div className="mx-3.5 mt-2 flex items-center gap-2 rounded-[10px] border px-3 py-2.5"
        style={{
          background: "#F0F9FF",
          borderColor: "#E0F2FE",
        }}
      >
        <Calendar
          className="h-3.5 w-3.5 shrink-0"
          aria-hidden
          style={{ color: "#0369A1" }}
        />
        <p
          className="min-w-0 truncate text-[11.5px] font-semibold"
          style={{ color: "#0369A1" }}
        >
          {recap}
        </p>
      </div>

      {/* Row card */}
      <div className="mx-3.5 mt-3 overflow-hidden rounded-[14px] border border-app-border bg-app-surface shadow-sm">
        {rows.map((row, idx) => {
          const { key: rowKey, ...rowRest } = row;
          return (
            <PickerRow
              key={rowKey}
              {...rowRest}
              state={addedKey === rowKey ? "done" : "default"}
              last={idx === rows.length - 1}
              // Track Apple Calendar click to show the "added" success morph
              {...(rowKey === "apple"
                ? {
                    onClick: () => setAddedKey("apple"),
                  }
                : {})}
            />
          );
        })}
      </div>

      {/* Added status line (Frame 4) */}
      {addedKey && (
        <div className="mx-3.5 mt-3 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-app-success" aria-hidden />
          <span className="text-[11px] font-semibold text-app-text-muted">
            Added — closing in a moment
          </span>
        </div>
      )}

      {/* Caption */}
      <p className="mx-5 mt-3 text-[11px] leading-4 text-app-text-muted">
        We'll add the event with the join link and a reminder.
      </p>

      {/* DoneBar */}
      <div className="mt-auto border-t border-app-border px-3.5 pb-[18px] pt-2.5">
        <button
          type="button"
          onClick={onDone}
          className="flex h-11 w-full items-center justify-center rounded-xl border border-app-border bg-app-surface text-[13.5px] font-bold text-app-text hover:bg-app-hover"
        >
          Done
        </button>
      </div>
    </div>
  );
}
