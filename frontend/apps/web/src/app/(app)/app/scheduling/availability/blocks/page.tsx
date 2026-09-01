"use client";

// B9 — Block off time. A focused create form for personal busy holds + the list
// of blocks added this session (the backend exposes no list-blocks endpoint, so
// the list is session-scoped; existing blocks surface on the calendar). Create
// and delete are optimistic-then-refetch within the session.

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as api from "@pantopus/api";
import { getAuthToken } from "@pantopus/api";
import type { AvailabilityBlock } from "@pantopus/types";
import { CalendarOff, ChevronLeft, Repeat, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/toast-store";
import { useSchedulingOwner } from "@/components/scheduling/SchedulingOwnerProvider";
import { decodeError } from "@/components/scheduling/decodeError";
import BlockOffForm, {
  type BlockPayload,
} from "@/components/scheduling/availability/BlockOffForm";

function timeLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function blockWhen(b: AvailabilityBlock): string {
  const start = new Date(b.start_at);
  const end = new Date(b.end_at);
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(start);
  const allDay =
    start.getHours() === 0 &&
    start.getMinutes() === 0 &&
    end.getHours() === 23 &&
    end.getMinutes() >= 58;
  const when = allDay ? "All day" : `${timeLabel(start)} – ${timeLabel(end)}`;
  return `${dateLabel} · ${when}`;
}

function repeatLabel(rule: string | null): string | null {
  if (!rule) return null;
  if (/DAILY/.test(rule)) return "Repeats daily";
  if (/WEEKLY/.test(rule)) return "Repeats weekly";
  if (/MONTHLY/.test(rule)) return "Repeats monthly";
  return "Repeats";
}

export default function BlockOffPage() {
  const router = useRouter();
  const owner = useSchedulingOwner();
  const [creating, setCreating] = useState(false);
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);

  const create = async (payload: BlockPayload) => {
    if (!getAuthToken()) {
      router.push("/login");
      return;
    }
    setCreating(true);
    try {
      const { block } = await api.scheduling.createBlock(payload, owner);
      setBlocks((cur) => [block, ...cur]);
      toast.success("Time blocked off.");
    } catch (err) {
      toast.error(decodeError(err).message);
    } finally {
      setCreating(false);
    }
  };

  const remove = async (block: AvailabilityBlock) => {
    const prev = blocks;
    setBlocks((cur) => cur.filter((b) => b.id !== block.id));
    try {
      await api.scheduling.deleteBlock(block.id, owner);
      toast.success("Block removed.");
    } catch (err) {
      setBlocks(prev);
      toast.error(decodeError(err).message);
    }
  };

  return (
    <div className="max-w-2xl">
      <button
        type="button"
        onClick={() => router.push("/app/scheduling/availability")}
        className="inline-flex items-center gap-1 text-sm font-medium text-app-text-secondary hover:text-app-text"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden /> Availability
      </button>
      {/* Pillar overline — 'Personal · Availability' per block-time-frames.jsx:73 */}
      <div className="mt-3 text-[9.5px] font-bold uppercase tracking-[0.08em] text-app-personal">
        Personal · Availability
      </div>
      <h1 className="mt-1 text-2xl font-bold text-app-text">Block off time</h1>
      <p className="mt-0.5 max-w-md text-sm text-app-text-secondary">
        Drop a one-off or recurring busy hold so the engine stops offering that
        window. It&apos;s private to you.
      </p>

      <div className="mt-5">
        <BlockOffForm onCreate={create} creating={creating} />
      </div>

      {blocks.length > 0 && (
        <div className="mt-6">
          <div className="px-0.5 pb-2 text-[9.5px] font-bold uppercase tracking-wider text-app-text-muted">
            Added this session
          </div>
          <div className="space-y-2">
            {blocks.map((b) => {
              const repeat = repeatLabel(b.recurrence_rule);
              return (
                <div
                  key={b.id}
                  className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface p-3 shadow-sm"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-app-surface-sunken text-app-text-secondary">
                    <CalendarOff className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-app-text">
                      {b.title || "Busy"}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-app-text-secondary">
                      {blockWhen(b)}
                      {repeat && (
                        <>
                          <span className="text-app-text-muted">·</span>
                          <span className="inline-flex items-center gap-1 font-medium text-app-personal">
                            <Repeat className="h-3 w-3" aria-hidden /> {repeat}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Remove block"
                    onClick={() => remove(b)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-app-text-muted hover:bg-app-hover hover:text-app-error"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
