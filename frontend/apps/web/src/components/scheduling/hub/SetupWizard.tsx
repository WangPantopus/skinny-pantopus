"use client";

// A2 — First-run "Set up your booking link" wizard. Four steps: Link · Type ·
// Hours · Share. Claims a slug (debounced check + PUT /booking-page/slug),
// creates a first event type, sets the weekly hours + timezone, takes the page
// live, then shows the success hero. Re-entering with a type already set up
// resumes at the Hours step.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  Globe,
  MapPin,
  Phone,
  Plus,
  RotateCcw,
  Share2,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import * as api from "@pantopus/api";
import { buildBookingPageUrl } from "@pantopus/utils";
import type {
  AvailabilityRule,
  BookingPage,
  EventTypeLocationMode,
} from "@pantopus/types";
import { useSchedulingOwner } from "@/components/scheduling/SchedulingOwnerProvider";
import { PillarThemeProvider } from "@/components/scheduling/PillarThemeProvider";
import TimezoneSelector, {
  detectTimezone,
  zoneLabel,
} from "@/components/scheduling/TimezoneSelector";
import ShareLink from "@/components/scheduling/ShareLink";
import { decodeError } from "@/components/scheduling/decodeError";
import { toast } from "@/components/ui/toast-store";
import StepRail from "./StepRail";
import SlugClaimField, {
  sanitizeSlug,
  type SlugStatus,
} from "./SlugClaimField";
import WeeklyHoursEditor, {
  DEFAULT_WEEK,
  weekToRules,
  type DayHours,
} from "./WeeklyHoursEditor";

const STEPS = [
  { n: 1, label: "Link" },
  { n: 2, label: "Type" },
  { n: 3, label: "Hours" },
  { n: 4, label: "Share" },
];

const KINDS: {
  id: EventTypeLocationMode;
  label: string;
  icon: LucideIcon;
  name: string;
}[] = [
  { id: "video", label: "Video call", icon: Video, name: "Video meeting" },
  { id: "phone", label: "Phone call", icon: Phone, name: "Phone call" },
  {
    id: "in_person",
    label: "In person",
    icon: MapPin,
    name: "In-person meeting",
  },
  { id: "ask", label: "Ask invitee", icon: ClipboardList, name: "Meeting" },
];

const DURATIONS = [15, 30, 45, 60];

function rulesToWeek(rules: AvailabilityRule[]): DayHours[] {
  const byDay = new Map<number, { start: string; end: string }>();
  for (const r of rules) {
    if (!byDay.has(r.weekday)) {
      byDay.set(r.weekday, {
        start: r.start_time.slice(0, 5),
        end: r.end_time.slice(0, 5),
      });
    }
  }
  if (byDay.size === 0) return DEFAULT_WEEK;
  return DEFAULT_WEEK.map((d) =>
    byDay.has(d.weekday)
      ? { ...d, enabled: true, ...byDay.get(d.weekday)! }
      : { ...d, enabled: false },
  );
}

export default function SetupWizard() {
  const router = useRouter();
  const owner = useSchedulingOwner();
  const BASE = "/app/scheduling";

  const [step, setStep] = useState(1);
  const [resume, setResume] = useState(false);
  const [loadingPage, setLoadingPage] = useState(true);
  const [page, setPage] = useState<BookingPage | null>(null);
  const [hasType, setHasType] = useState(false);

  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const [kind, setKind] = useState<EventTypeLocationMode>("video");
  const [duration, setDuration] = useState(30);
  const [tz, setTz] = useState(detectTimezone());
  const [tzOpen, setTzOpen] = useState(false);
  const [week, setWeek] = useState<DayHours[]>(DEFAULT_WEEK);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ page: loaded }, etRes, availRes] = await Promise.all([
          api.scheduling.getBookingPage(owner),
          api.scheduling.listEventTypes(owner),
          api.scheduling.getAvailability(owner),
        ]);
        if (cancelled) return;
        setPage(loaded);
        setSlug(loaded.slug);
        setTz(
          loaded.timezone ||
            availRes.schedules[0]?.timezone ||
            detectTimezone(),
        );
        setWeek(rulesToWeek(availRes.rules ?? []));
        if (etRes.eventTypes.length > 0) {
          setHasType(true);
          setStep(3);
          setResume(true);
        }
      } catch (err) {
        if (!cancelled)
          toast.error(decodeError(err).message || "Couldn’t load setup");
      } finally {
        if (!cancelled) setLoadingPage(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [owner]);

  const slugOk = slugStatus === "available" || (!!page && slug === page.slug);
  const detected = useMemo(() => detectTimezone(), []);

  const goBack = () => {
    if (step > 1) setStep(step - 1);
    else router.push(BASE);
  };

  const claimSlug = async (): Promise<boolean> => {
    if (!page || slug === page.slug) return true;
    setSubmitting(true);
    try {
      const { page: updated } = await api.scheduling.updateBookingPageSlug(
        slug,
        owner,
      );
      setPage(updated);
      return true;
    } catch (err) {
      const decoded = decodeError(err);
      toast.error(decoded.message || "That link is taken — try another");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const finish = async () => {
    setSubmitting(true);
    try {
      await api.scheduling.updateBookingPage(
        { timezone: tz, is_live: true, is_paused: false },
        owner,
      );
      if (!hasType) {
        const meta = KINDS.find((k) => k.id === kind)!;
        try {
          await api.scheduling.createEventType(
            {
              name: meta.name,
              slug: sanitizeSlug(`${meta.id}-${duration}min`),
              durations: [duration],
              default_duration: duration,
              location_mode: kind,
              visibility: "public",
            },
            owner,
          );
          setHasType(true);
        } catch (err) {
          // A type may already exist or the slug may collide — non-fatal.
          if (decodeError(err).kind !== "conflict") {
            toast.error(
              decodeError(err).message || "Couldn’t add the meeting type",
            );
          }
        }
      }
      // Persist weekly hours onto the (personal) default schedule. Best-effort.
      try {
        const avail = await api.scheduling.getAvailability(owner);
        const schedule = avail.schedules[0];
        if (schedule)
          await api.scheduling.updateRules(
            schedule.id,
            weekToRules(week),
            owner,
          );
      } catch {
        /* hours can be fine-tuned later in Availability */
      }
      setStep(4);
    } catch (err) {
      toast.error(decodeError(err).message || "Couldn’t finish setup");
    } finally {
      setSubmitting(false);
    }
  };

  const tzIsAuto = tz === detected;

  return (
    <PillarThemeProvider pillar="personal">
      <div className="mx-auto max-w-xl">
        <header className="mb-5 flex items-center gap-2">
          <button
            type="button"
            onClick={goBack}
            className="flex h-9 w-9 items-center justify-center rounded-full text-app-text hover:bg-app-hover"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <h1 className="flex-1 text-lg font-semibold text-app-text">
            Set up booking
          </h1>
          <span className="text-xs font-semibold text-app-text-secondary">
            {step}/4
          </span>
        </header>

        {loadingPage ? (
          <div className="space-y-4" aria-hidden>
            <div className="h-16 w-full animate-pulse rounded-xl bg-app-surface-sunken" />
            <div className="h-40 w-full animate-pulse rounded-xl bg-app-surface-sunken" />
          </div>
        ) : (
          <div className="space-y-5">
            <StepRail
              steps={STEPS}
              current={step}
              done={step === 4 ? [1, 2, 3, 4] : resume ? [1, 2] : []}
              pillar="personal"
            />

            {step === 1 && (
              <>
                <Headline
                  title="Claim your booking link"
                  sub="This is the link you'll share. People book you at it — pick something short and memorable."
                />
                {page && (
                  <SlugClaimField
                    owner={owner}
                    pillar="personal"
                    value={slug}
                    onChange={setSlug}
                    onStatusChange={setSlugStatus}
                    ownedSlug={page.slug}
                  />
                )}
                <Actions>
                  <Primary
                    icon={ArrowRight}
                    disabled={!slugOk || submitting}
                    onClick={async () => {
                      if (await claimSlug()) setStep(2);
                    }}
                  >
                    Continue · pick a type
                  </Primary>
                </Actions>
              </>
            )}

            {step === 2 && (
              <>
                <Headline
                  title="Pick a meeting type"
                  sub="Add one type of meeting people can book. You can add more later from Event types."
                />
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-app-text-secondary">
                    Meeting type
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {KINDS.map((k) => {
                      const active = k.id === kind;
                      const Icon = k.icon;
                      return (
                        <button
                          key={k.id}
                          type="button"
                          onClick={() => setKind(k.id)}
                          className={clsx(
                            "flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors",
                            active
                              ? "border-app-personal bg-app-personal-bg"
                              : "border-app-border bg-app-surface hover:bg-app-hover",
                          )}
                        >
                          <span
                            className={clsx(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                              active
                                ? "bg-app-personal text-white"
                                : "bg-app-surface-sunken text-app-text-strong",
                            )}
                          >
                            <Icon className="h-4 w-4" aria-hidden />
                          </span>
                          <span
                            className={clsx(
                              "text-[13px] font-semibold",
                              active ? "text-app-personal" : "text-app-text",
                            )}
                          >
                            {k.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-app-text-secondary">
                    Duration
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {DURATIONS.map((d) => {
                      const active = d === duration;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDuration(d)}
                          className={clsx(
                            "rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors",
                            active
                              ? "border-app-personal bg-app-personal text-white"
                              : "border-app-border bg-app-surface text-app-text-strong hover:bg-app-hover",
                          )}
                        >
                          {d} min
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Actions>
                  <Primary icon={ArrowRight} onClick={() => setStep(3)}>
                    Continue · set your hours
                  </Primary>
                </Actions>
              </>
            )}

            {step === 3 && (
              <>
                {resume && (
                  <div className="flex items-center gap-3 rounded-xl border border-app-personal-bg bg-app-personal-bg/40 p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-app-personal-bg bg-app-surface text-app-personal">
                      <RotateCcw className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-app-text">
                        Pick up where you left off
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-app-text-secondary">
                        Your link and type are set. Set your hours to finish.
                      </p>
                    </div>
                  </div>
                )}
                <Headline
                  title="Set your weekly hours"
                  sub="People can only book inside these windows. Fine-tune any day, or use the defaults."
                />
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-app-text-secondary">
                    Timezone
                  </p>
                  <button
                    type="button"
                    onClick={() => setTzOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-app-personal-bg bg-app-personal-bg px-3 py-2 text-[13px] font-semibold text-app-personal"
                  >
                    <Globe className="h-3.5 w-3.5" aria-hidden />
                    {zoneLabel(tz)}
                    {tzIsAuto && (
                      <span className="rounded-full border border-app-personal-bg bg-app-surface px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-app-personal">
                        Auto
                      </span>
                    )}
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
                <WeeklyHoursEditor
                  value={week}
                  onChange={setWeek}
                  pillar="personal"
                />
                <Actions>
                  <Ghost onClick={() => setWeek(DEFAULT_WEEK)}>
                    Use defaults
                  </Ghost>
                  <Primary
                    icon={ArrowRight}
                    disabled={submitting}
                    onClick={finish}
                    grow
                  >
                    {submitting ? "Saving…" : "Finish setup"}
                  </Primary>
                </Actions>
              </>
            )}

            {step === 4 && page && (
              <SuccessStep
                slug={page.slug}
                onAddType={() => router.push(`${BASE}/event-types`)}
                onDone={() => router.push(`${BASE}/booking-page`)}
              />
            )}
          </div>
        )}

        <TimezoneSelector
          open={tzOpen}
          onClose={() => setTzOpen(false)}
          value={tz}
          onSelect={(z) => {
            setTz(z);
            setTzOpen(false);
          }}
          pillar="personal"
        />
      </div>
    </PillarThemeProvider>
  );
}

function Headline({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h2 className="text-[22px] font-bold tracking-tight text-app-text">
        {title}
      </h2>
      <p className="mt-1.5 text-[13.5px] leading-5 text-app-text-secondary">
        {sub}
      </p>
    </div>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2.5 pt-1">{children}</div>;
}

function Primary({
  children,
  icon: Icon,
  onClick,
  disabled,
  grow,
}: {
  children: React.ReactNode;
  icon?: LucideIcon;
  onClick?: () => void;
  disabled?: boolean;
  grow?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold shadow-sm transition-colors",
        grow ? "flex-[1.5]" : "flex-1",
        disabled
          ? "cursor-not-allowed bg-app-surface-sunken text-app-text-muted shadow-none"
          : "bg-app-personal text-white hover:opacity-90",
      )}
    >
      {children}
      {Icon && <Icon className="h-4 w-4" aria-hidden />}
    </button>
  );
}

function Ghost({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-app-border bg-app-surface px-4 text-sm font-semibold text-app-text-strong hover:bg-app-hover"
    >
      {children}
    </button>
  );
}

function SuccessStep({
  slug,
  onAddType,
  onDone,
}: {
  slug: string;
  onAddType: () => void;
  onDone: () => void;
}) {
  return (
    <div className="flex flex-col items-center pt-2 text-center">
      <div className="relative mb-5 flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-app-personal-bg" />
        <div className="absolute inset-[18px] flex items-center justify-center rounded-full bg-app-personal shadow-md">
          <Check className="h-8 w-8 text-white" strokeWidth={3} aria-hidden />
        </div>
      </div>
      <h2 className="text-[22px] font-bold tracking-tight text-app-text">
        You’re all set
      </h2>
      <p className="mt-2 max-w-sm text-[13.5px] leading-5 text-app-text-secondary">
        Your booking link is live. Share it and people can book a meeting during
        your weekly hours.
      </p>
      <div className="mt-5 w-full">
        <ShareLink
          url={buildBookingPageUrl(slug)}
          pillar="personal"
          label="Your booking link"
        />
      </div>
      <div className="mt-5 flex w-full gap-2.5">
        <button
          type="button"
          onClick={onAddType}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-app-border bg-app-surface text-sm font-semibold text-app-text-strong hover:bg-app-hover"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add type
        </button>
        <button
          type="button"
          onClick={onDone}
          className="flex h-12 flex-[1.5] items-center justify-center gap-2 rounded-xl bg-app-personal text-sm font-semibold text-white hover:opacity-90"
        >
          <Share2 className="h-4 w-4" aria-hidden />
          Share link
        </button>
      </div>
    </div>
  );
}
