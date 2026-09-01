"use client";

// Add-to-calendar rows (Gig Picker Sheets idiom: 56px rows, leading icon disc,
// label + sub, trailing chevron). Google / Outlook deep links + an Apple/.ics
// download. Host surfaces build the .ics inline from the event; public manage
// surfaces pass `icsUrl` (publicBooking.getIcsUrl(token)). Wrap in a BottomSheet
// to present as a sheet, or render inline. Context-neutral chrome.

import clsx from "clsx";
import { Calendar, CalendarDays, ChevronRight, Download } from "lucide-react";

export interface CalendarEventInput {
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
}

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

function Row({
  icon: Icon,
  label,
  sub,
  href,
  download,
}: {
  icon: typeof Calendar;
  label: string;
  sub: string;
  href: string;
  download?: boolean;
}) {
  return (
    <a
      href={href}
      target={download ? undefined : "_blank"}
      rel="noopener noreferrer"
      download={download ? "invite.ics" : undefined}
      className="flex h-14 items-center gap-3 px-1 hover:bg-app-hover"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-app-surface-muted">
        <Icon className="h-4 w-4 text-app-text-secondary" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-app-text">{label}</span>
        <span className="block truncate text-xs text-app-text-muted">
          {sub}
        </span>
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-app-text-muted"
        aria-hidden
      />
    </a>
  );
}

export default function AddToCalendar({
  event,
  icsUrl,
  className,
}: {
  event: CalendarEventInput;
  /** Public manage surfaces pass the .ics endpoint; host surfaces omit (built inline). */
  icsUrl?: string;
  className?: string;
}) {
  const ics = icsUrl || icsDataUri(event);
  return (
    <div className={clsx("divide-y divide-app-border-subtle", className)}>
      <Row
        icon={Calendar}
        label="Apple Calendar"
        sub="Save to your iPhone"
        href={ics}
      />
      <Row
        icon={CalendarDays}
        label="Google Calendar"
        sub="Opens in your browser"
        href={googleUrl(event)}
      />
      <Row
        icon={CalendarDays}
        label="Outlook"
        sub="Opens in your browser"
        href={outlookUrl(event)}
      />
      <Row
        icon={Download}
        label="Download .ics file"
        sub="Works with any calendar app"
        href={ics}
        download
      />
    </div>
  );
}
