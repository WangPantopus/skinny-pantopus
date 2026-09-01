"use client";

// F4 → F5 — Household "Find a time". One route, three steps:
//   setup     → FindATimeSetup (title, who's needed, mode, duration, window)
//   computing → overlaying everyone's personal availability
//   results   → SuggestedSlots (ranked common-free times) → Book it (hands to the
//               W10 add-event flow) or Send proposal (creates a poll → F6)
//   no-overlap → no shared free slots found; quick-fix actions (back to setup)
//   sent      → success terminal frame
// Owner context is home (the route's /app/homes/:id segment resolves it), so all
// reads/writes route through the /api/homes/:id/scheduling alias.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, Check, Home, Pencil } from "lucide-react";
import * as api from "@pantopus/api";
import { getAuthToken } from "@pantopus/api";
import type { BookingSlot } from "@pantopus/types";
import ErrorState from "@/components/ui/ErrorState";
import { toast } from "@/components/ui/toast-store";
import { useSchedulingOwner } from "@/components/scheduling/SchedulingOwnerProvider";
import { decodeError } from "@/components/scheduling/decodeError";
import TimezoneSelector, {
  detectTimezone,
  zoneLabel,
} from "@/components/scheduling/TimezoneSelector";
import FindATimeSetup, {
  type FindATimeConfig,
} from "@/components/scheduling/home/find-a-time/FindATimeSetup";
import SuggestedSlots from "@/components/scheduling/home/find-a-time/SuggestedSlots";
import {
  readMembers,
  shortName,
  type MemberView,
} from "@/components/scheduling/home/find-a-time/members";
import {
  rangeLabel,
  todayKey,
  addDaysKey,
} from "@/components/scheduling/home/find-a-time/format";

type Step = "setup" | "computing" | "results" | "no-overlap" | "sent";

export default function FindATimePage() {
  const router = useRouter();
  const owner = useSchedulingOwner();
  const params = useParams<{ id: string }>();
  const homeId = params?.id ?? "";

  const [tz, setTz] = useState<string>(() => detectTimezone());
  const [tzOpen, setTzOpen] = useState(false);

  const [members, setMembers] = useState<MemberView[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("setup");
  const [config, setConfig] = useState<FindATimeConfig | null>(null);
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentPollId, setSentPollId] = useState<string | null>(null);

  // Imperative handle so the page-level "Next" button triggers setup validation.
  const setupSubmitRef = useRef<(() => void) | null>(null);

  const loadMembers = useCallback(async () => {
    if (!getAuthToken()) {
      router.push("/login");
      return;
    }
    setMembersLoading(true);
    setMembersError(null);
    try {
      const res = await api.homeIam.getHomeMembers(homeId);
      setMembers(readMembers(res.members ?? []));
    } catch (err) {
      setMembersError(
        decodeError(err).message || "Couldn't load your household.",
      );
    } finally {
      setMembersLoading(false);
    }
  }, [homeId, router]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const defaultFrom = useMemo(() => todayKey(tz), [tz]);
  const defaultTo = useMemo(() => addDaysKey(todayKey(tz), 6), [tz]);

  // The members we actually overlay: collective needs everyone required free;
  // round-robin includes optionals too (anyone can cover).
  const queryIds = useMemo(() => {
    if (!config) return [];
    return config.mode === "round_robin"
      ? [...config.requiredIds, ...config.optionalIds]
      : config.requiredIds;
  }, [config]);

  const shownMembers = useMemo(
    () => members.filter((m) => queryIds.includes(m.userId)),
    [members, queryIds],
  );

  const runFind = useCallback(
    async (cfg: FindATimeConfig) => {
      setConfig(cfg);
      setStep("computing");
      setFetchError(null);
      const ids =
        cfg.mode === "round_robin"
          ? [...cfg.requiredIds, ...cfg.optionalIds]
          : cfg.requiredIds;
      try {
        const res = await api.scheduling.getFindATime(
          {
            member_ids: ids,
            mode: cfg.mode,
            duration_min: cfg.durationMin,
            slot_interval_min: cfg.durationMin,
            from: cfg.fromKey,
            to: cfg.toKey,
            timezone: tz,
          },
          owner,
        );
        const found = res.slots ?? [];
        if (found.length === 0) {
          setSlots([]);
          setStep("no-overlap");
        } else {
          setSlots(found);
          setStep("results");
        }
      } catch (err) {
        setFetchError(decodeError(err).message);
        setStep("results");
      }
    },
    [owner, tz],
  );

  // Re-run when the tz changes while viewing results so labels stay correct.
  const changeTz = (next: string) => {
    setTz(next);
    if (config && step === "results") {
      runFind(config);
    }
  };

  const book = (slot: BookingSlot) => {
    const params = new URLSearchParams({
      start: slot.start,
      end: slot.end,
      title: config?.title ?? "",
    });
    // The household add-event flow (W10) creates the actual calendar event.
    router.push(
      `/app/homes/${homeId}/scheduling/events/new?${params.toString()}`,
    );
  };

  const sendProposal = async () => {
    if (!config || slots.length === 0) return;
    setSending(true);
    try {
      const { poll } = await api.scheduling.createPoll(
        {
          title: config.title,
          duration_min: config.durationMin,
          options: slots
            .slice(0, 20)
            .map((s) => ({ start: s.start, end: s.end })),
        },
        owner,
      );
      setSentPollId(poll.id);
      setStep("sent");
    } catch (err) {
      toast.error(decodeError(err).message || "Couldn't send the proposal.");
    } finally {
      setSending(false);
    }
  };

  const windowLabel = config
    ? rangeLabel(config.fromKey, config.toKey)
    : "this week";

  // ── Title + back navigation ────────────────────────────────────
  // Design: SheetBar title changes per step. On web we render a persistent back
  // button + a dynamic title row + a trailing action button ("Next" in setup,
  // "Edit" in results steps).
  const isSetup = step === "setup";
  const isResults = step === "results" || step === "no-overlap";

  return (
    <div className="mx-auto max-w-2xl pb-10">
      <header className="mb-5">
        <button
          type="button"
          onClick={() => {
            if (step === "setup" || step === "sent") {
              router.push(`/app/homes/${homeId}/calendar`);
            } else if (step === "computing" || isResults) {
              setStep("setup");
            } else {
              router.push(`/app/homes/${homeId}/calendar`);
            }
          }}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-app-text-secondary hover:text-app-text"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {isSetup || step === "sent" ? "Calendar" : "Back to setup"}
        </button>
        <p className="text-xs font-bold uppercase tracking-wider text-app-home">
          Calendarly · Household
        </p>
        {/* Title + trailing action in one row — mirrors SheetBar */}
        <div className="mt-0.5 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-app-text">
            {isResults ? "Suggested times" : "Find a time"}
          </h1>
          {isSetup && (
            <button
              type="button"
              onClick={() => setupSubmitRef.current?.()}
              className="rounded-lg px-3 py-1.5 text-sm font-bold text-app-home hover:bg-app-home-bg"
            >
              Next
            </button>
          )}
          {isResults && (
            <button
              type="button"
              onClick={() => setStep("setup")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-3 py-1.5 text-sm font-bold text-app-text-secondary hover:bg-app-hover"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
            </button>
          )}
        </div>
        {isSetup && (
          <p className="mt-1 max-w-md text-sm text-app-text-secondary">
            Overlay everyone&apos;s personal availability to find a time that
            works — without touching anyone&apos;s calendar.
          </p>
        )}
      </header>

      {step === "setup" && (
        <FindATimeSetup
          members={members}
          membersLoading={membersLoading}
          membersError={membersError}
          onRetryMembers={loadMembers}
          defaultFrom={defaultFrom}
          defaultTo={defaultTo}
          onSubmit={runFind}
          submitRef={setupSubmitRef}
        />
      )}

      {/* ── Computing — 64dp arc + users icon + shimmer rows (design: FrameComputing) */}
      {step === "computing" && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-app-border bg-app-surface px-6 py-16 text-center">
          {/* Spinning arc with users icon at centre */}
          <div className="relative mb-5 h-16 w-16">
            {/* Track */}
            <div className="absolute inset-0 rounded-full border-[3px] border-app-home-bg" />
            {/* Spinning arc */}
            <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-app-home" />
            {/* Centre icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-app-home"
                aria-hidden
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>

          <h2 className="text-base font-bold text-app-text">
            Checking everyone&apos;s availability
          </h2>
          <p className="mt-1 text-sm text-app-text-secondary">
            Composing{" "}
            {shownMembers.length
              ? shownMembers.map((m) => shortName(m.name)).join(", ")
              : "the household"}
            &apos;s free time
          </p>

          {/* Shimmer rows — avatar + text + badge */}
          <div className="mt-5 w-full space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 animate-pulse rounded-full bg-app-surface-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-app-surface-muted" />
                <div className="flex-1" />
                <div className="h-4 w-10 animate-pulse rounded-full bg-app-surface-muted" />
              </div>
            ))}
          </div>
        </div>
      )}

      {step === "results" &&
        (fetchError ? (
          <ErrorState
            message={fetchError}
            onRetry={() => config && runFind(config)}
          />
        ) : (
          <SuggestedSlots
            slots={slots}
            members={shownMembers}
            requiredIds={config?.requiredIds ?? []}
            mode={config?.mode ?? "collective"}
            durationMin={config?.durationMin ?? 30}
            peopleCount={queryIds.length}
            windowLabel={windowLabel}
            tz={zoneLabel(tz)}
            onChangeTz={() => setTzOpen(true)}
            onEdit={() => setStep("setup")}
            onBook={book}
            onSendProposal={sendProposal}
            sending={sending}
          />
        ))}

      {/* ── No-overlap — design: FrameNoOverlap (warning icon, two quick-fix actions) */}
      {step === "no-overlap" && (
        <div className="flex flex-col items-center rounded-2xl border border-app-border bg-app-surface px-6 py-12 text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-app-warning-bg text-app-warning">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <line x1="9" y1="14" x2="9.01" y2="14" />
              <line x1="12" y1="14" x2="12.01" y2="14" />
              <line x1="15" y1="14" x2="15.01" y2="14" />
              <line x1="9" y1="18" x2="9.01" y2="18" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
              <line x1="15" y1="18" x2="15.01" y2="18" />
            </svg>
          </span>
          <h2 className="text-base font-bold text-app-text">
            No time works for all {queryIds.length}
          </h2>
          <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-app-text-secondary">
            Their free hours don&apos;t overlap{" "}
            {windowLabel !== "this week" ? `in ${windowLabel}` : "this week"}.
            Loosen a constraint to see options.
          </p>
          <div className="mt-5 flex w-full max-w-xs flex-col gap-2.5">
            <button
              type="button"
              onClick={() => setStep("setup")}
              className="flex items-center justify-center gap-2 rounded-xl bg-app-home px-4 py-2.5 text-sm font-bold text-white hover:opacity-90"
            >
              Make someone optional
            </button>
            <button
              type="button"
              onClick={() => setStep("setup")}
              className="flex items-center justify-center gap-2 rounded-xl border border-app-border bg-app-surface px-4 py-2.5 text-sm font-bold text-app-text-secondary hover:bg-app-hover"
            >
              Widen the window
            </button>
          </div>
        </div>
      )}

      {/* ── Sent — design: FrameSent (radial circle + check, Back to calendar PRIMARY, View responses SECONDARY) */}
      {step === "sent" && (
        <div className="flex flex-col items-center rounded-2xl border border-app-border bg-app-surface px-6 py-12 text-center">
          {/* 84pt radial-gradient circle with solid inner circle + check icon */}
          <div className="relative mb-5 h-20 w-20">
            {/* Outer radial-gradient ring */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 30% 30%, var(--color-app-home-bg, #dcfce7), #bbf7d0)",
              }}
            />
            {/* Inner solid circle + check */}
            <div className="absolute inset-4 flex items-center justify-center rounded-full bg-app-home shadow-lg">
              <Check
                className="h-7 w-7 text-white"
                strokeWidth={3}
                aria-hidden
              />
            </div>
          </div>

          <h2 className="text-xl font-bold text-app-text">
            Proposal sent to {queryIds.length}{" "}
            {queryIds.length === 1 ? "person" : "people"}
          </h2>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-app-text-secondary">
            We&apos;ll notify you as they respond. The most-picked time gets
            booked.
          </p>

          {/* Design: Back to calendar = PRIMARY, View responses = SECONDARY */}
          <div className="mt-5 flex w-full max-w-sm flex-col gap-2.5">
            <button
              type="button"
              onClick={() => router.push(`/app/homes/${homeId}/calendar`)}
              className="flex items-center justify-center gap-2 rounded-xl bg-app-home px-4 py-2.5 text-sm font-bold text-white hover:opacity-90"
            >
              <Home className="h-4 w-4" aria-hidden /> Back to calendar
            </button>
            {sentPollId && (
              <a
                href={`/poll/${sentPollId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-app-border bg-app-surface px-4 py-2.5 text-sm font-bold text-app-text-secondary hover:bg-app-hover"
              >
                <BarChart3 className="h-4 w-4" aria-hidden /> View responses
              </a>
            )}
          </div>
        </div>
      )}

      <TimezoneSelector
        open={tzOpen}
        onClose={() => setTzOpen(false)}
        value={tz}
        onSelect={changeTz}
        pillar="home"
      />
    </div>
  );
}
