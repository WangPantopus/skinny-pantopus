"use client";

// F6 — Member Poll Response. The interactive half of the public /poll/[id] page.
// Each proposed time gets a 3-way vote (Works=yes / If needed=maybe / Can't=no);
// the response posts to /api/public/poll/:id/vote. Closed/finalized polls render
// locked. No auth required — voters identify by email (optionalAuth on the API).

import { useMemo, useState } from "react";
import { CheckCircle2, Send, Vote } from "lucide-react";
import clsx from "clsx";
import * as api from "@pantopus/api";
import type { Poll, PollOption, PollVoteValue } from "@pantopus/types";
import { decodeError } from "@/components/scheduling/decodeError";
import { instantLabel } from "./format";

type VoteState = Record<string, PollVoteValue>;

const VOTE_OPTS: Array<{ k: PollVoteValue; label: string; on: string }> = [
  { k: "yes", label: "Works", on: "bg-app-home text-white" },
  { k: "maybe", label: "If needed", on: "bg-app-warning text-white" },
  { k: "no", label: "Can't", on: "bg-app-error text-white" },
];

function VoteControl({
  value,
  locked,
  onChange,
}: {
  value: PollVoteValue | undefined;
  locked?: boolean;
  onChange: (v: PollVoteValue) => void;
}) {
  return (
    <div
      className={clsx(
        "flex gap-1 rounded-lg bg-app-surface-muted p-1",
        locked && "opacity-70",
      )}
    >
      {VOTE_OPTS.map((o) => {
        const sel = o.k === value;
        return (
          <button
            key={o.k}
            type="button"
            disabled={locked}
            aria-pressed={sel}
            onClick={() => onChange(o.k)}
            className={clsx(
              "flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors",
              sel
                ? clsx(o.on, "shadow-sm")
                : "text-app-text-secondary hover:text-app-text",
              locked && "cursor-default",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function PollResponse({
  pollId,
  poll,
  options,
  tz,
}: {
  pollId: string;
  poll: Poll;
  options: PollOption[];
  tz?: string;
}) {
  const closed = poll.status === "closed";
  const [votes, setVotes] = useState<VoteState>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [nowClosed, setNowClosed] = useState(closed);
  const [error, setError] = useState<string | null>(null);

  const answeredCount = Object.keys(votes).length;
  // Design gates submit solely on at least one vote cast (no email required).
  const canSubmit = answeredCount > 0 && !submitting;

  const finalized = useMemo(() => {
    if (!poll.finalized_start_at) return null;
    const l = instantLabel(poll.finalized_start_at, tz);
    return `${l.date} · ${l.time}`;
  }, [poll.finalized_start_at, tz]);

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.publicBooking.votePoll(pollId, {
        name: null,
        email: null,
        votes: Object.entries(votes).map(([option_id, value]) => ({
          option_id,
          value,
        })),
      });
      setDone(true);
    } catch (err) {
      const decoded = decodeError(err);
      if (decoded.kind === "error" && decoded.code === "POLL_CLOSED") {
        setNowClosed(true);
      } else {
        setError(decoded.message || "Couldn’t submit your response.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Header (organizer + meta) ──────────────────────────────
  const header = (
    <div className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface p-3.5">
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-app-home-bg text-app-home">
        <Vote className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-bold text-app-text">
          {poll.title}
        </h1>
        <p className="mt-0.5 text-xs text-app-text-secondary">
          {poll.duration_min} min
          {poll.description ? ` · ${poll.description}` : ""}
        </p>
      </div>
      <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-app-home-bg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-app-home">
        Poll
      </span>
    </div>
  );

  // ── Done ───────────────────────────────────────────────────
  if (done) {
    return (
      <div className="space-y-4">
        {header}
        <div className="flex flex-col items-center rounded-2xl border border-app-border bg-app-surface px-6 py-12 text-center">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-app-home-bg text-app-home">
            <CheckCircle2 className="h-8 w-8" aria-hidden />
          </span>
          <h2 className="text-lg font-bold text-app-text">
            Response submitted
          </h2>
          <p className="mt-1.5 max-w-xs text-sm text-app-text-secondary">
            Thanks! The organizer will book the time that works for the most
            people.
          </p>
        </div>
      </div>
    );
  }

  // ── Closed / finalized ─────────────────────────────────────
  if (nowClosed) {
    return (
      <div className="space-y-4">
        {header}
        <div className="flex items-start gap-2.5 rounded-xl border border-app-home/40 bg-app-home-bg p-3.5">
          <CheckCircle2
            className="mt-0.5 h-5 w-5 flex-shrink-0 text-app-home"
            aria-hidden
          />
          <div>
            <p className="text-sm font-bold text-app-text">
              This proposal closed
            </p>
            <p className="mt-0.5 text-xs text-app-text-secondary">
              {finalized
                ? `Booked ${finalized}. It's on the family calendar.`
                : "Voting has ended for this poll."}
            </p>
          </div>
        </div>
        <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-app-text-muted">
          Proposed times
        </p>
        <div className="space-y-2.5 opacity-60">
          {options.map((o) => {
            const l = instantLabel(o.start_at, tz);
            return (
              <div
                key={o.id}
                className="rounded-2xl border border-app-border bg-app-surface p-3.5"
              >
                <p className="mb-2 text-sm font-bold text-app-text">
                  {l.date} · {l.time}
                </p>
                <VoteControl value={undefined} locked onChange={() => {}} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Voting ─────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {header}

      <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-app-text-muted">
        Mark which times work
      </p>

      <div className="space-y-2.5">
        {options.map((o) => {
          const l = instantLabel(o.start_at, tz);
          return (
            <div
              key={o.id}
              className="rounded-2xl border border-app-border bg-app-surface p-3.5"
            >
              <p className="mb-2 text-sm font-bold text-app-text">
                {l.date} · {l.time}
              </p>
              <VoteControl
                value={votes[o.id]}
                onChange={(v) => setVotes((s) => ({ ...s, [o.id]: v }))}
              />
            </div>
          );
        })}
      </div>

      {error && (
        <p
          className="rounded-lg bg-app-error-bg px-3 py-2 text-xs font-medium text-app-error"
          role="alert"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-app-home px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
      >
        <Send className="h-4 w-4" aria-hidden />
        {submitting ? "Submitting…" : "Submit response"}
      </button>
      {answeredCount === 0 && (
        <p className="text-center text-[11px] text-app-text-muted">
          Mark at least one time to submit.
        </p>
      )}
    </div>
  );
}
