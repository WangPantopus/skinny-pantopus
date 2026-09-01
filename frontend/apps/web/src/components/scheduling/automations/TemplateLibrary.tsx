"use client";

// W16 · H8 — Message Template Library. The list of reusable templates: a channel
// icon tile, name, a body snippet, a channel chip (below name/body), plus a kebab
// menu with Edit/Duplicate/Delete. Backed by GET /message-templates, PUT/POST/DELETE
// /message-templates. Search filters both starters and user templates. Personal sky pillar.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  Copy,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import * as api from "@pantopus/api";
import type { MessageChannel, MessageTemplate } from "@pantopus/types";
import { useSchedulingOwner } from "@/components/scheduling/SchedulingOwnerProvider";
import {
  pillarForOwner,
  pillarTokens,
} from "@/components/scheduling/pillarTokens";
import { decodeError } from "@/components/scheduling/decodeError";
import { toast } from "@/components/ui/toast-store";
import { confirmStore } from "@/components/ui/confirm-store";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import ErrorState from "@/components/ui/ErrorState";
import { Card, IconTile, Overline, Toggle } from "./kit";
import { channelMeta } from "./templateMeta";

// ─── Starter templates (client-seeded, read-only) ────────────────────────────

interface StarterTemplate {
  id: string;
  name: string;
  channel: MessageChannel;
  body: string;
}

const STARTERS: StarterTemplate[] = [
  {
    id: "starter-thankyou",
    name: "Thank-you note",
    channel: "email",
    body: "Hi {{invitee_name}},\n\nThanks so much for booking {{event_name}} — looking forward to it!\n\n{{host_name}}",
  },
  {
    id: "starter-reminder",
    name: "Reminder",
    channel: "push",
    body: "Reminder: {{event_name}} is coming up in {{duration}}. See you soon!",
  },
  {
    id: "starter-review",
    name: "Review request",
    channel: "email",
    body: "Hi {{invitee_name}},\n\nI hope {{event_name}} was helpful! If you have a moment, I'd love a quick review.\n\n{{manage_link}}\n\nThanks,\n{{host_name}}",
  },
];

// ─── Snippet helper ───────────────────────────────────────────────────────────

function snippet(body: string): string {
  const oneLine = body.replace(/\s+/g, " ").trim();
  return oneLine.length > 64 ? `${oneLine.slice(0, 64)}…` : oneLine;
}

// ─── Kebab menu ──────────────────────────────────────────────────────────────

function KebabMenu({
  onEdit,
  onDuplicate,
  onDelete,
}: {
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label="Template options"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-app-text-muted transition hover:bg-app-hover hover:text-app-text"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 min-w-[148px] overflow-hidden rounded-xl border border-app-border bg-app-surface shadow-md">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
            className="flex w-full items-center gap-2 px-3.5 py-2.5 text-[13px] font-medium text-app-text transition hover:bg-app-hover"
          >
            <Pencil className="h-3.5 w-3.5 text-app-text-muted" aria-hidden />
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDuplicate();
            }}
            className="flex w-full items-center gap-2 px-3.5 py-2.5 text-[13px] font-medium text-app-text transition hover:bg-app-hover"
          >
            <Copy className="h-3.5 w-3.5 text-app-text-muted" aria-hidden />
            Duplicate
          </button>
          <div className="border-t border-app-border-subtle" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="flex w-full items-center gap-2 px-3.5 py-2.5 text-[13px] font-medium text-app-error transition hover:bg-app-hover"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Template row (user-owned) ────────────────────────────────────────────────

function TemplateRow({
  template: t,
  last,
  pillar,
  busy,
  onOpen,
  onToggle,
  onDuplicate,
  onDelete,
}: {
  template: MessageTemplate;
  last: boolean;
  pillar: ReturnType<typeof pillarForOwner>;
  busy: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const meta = channelMeta(t.channel);
  const ChannelIcon = meta.icon;
  return (
    <div
      className={clsx(
        "flex items-center gap-3 px-3.5 py-3",
        !last && "border-b border-app-border-subtle",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <IconTile icon={meta.icon} pillar={pillar} />
        <div className="min-w-0 flex-1">
          {/* Name row */}
          <div className="truncate text-[13.5px] font-semibold text-app-text">
            {t.name}
          </div>
          {/* Body snippet */}
          {t.body && (
            <div className="mt-0.5 truncate text-[11.5px] text-app-text-secondary">
              {snippet(t.body)}
            </div>
          )}
          {/* Channel chip — bottom line, matches iOS/Android AutoChip */}
          <div className="mt-1.5 flex items-center gap-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-app-surface-sunken px-2 py-0.5 text-[10.5px] font-semibold text-app-text-secondary">
              <ChannelIcon className="h-2.5 w-2.5" aria-hidden />
              {meta.label}
            </span>
          </div>
        </div>
      </button>
      <KebabMenu
        onEdit={onOpen}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
      <Toggle
        on={t.is_active}
        pillar={pillar}
        disabled={busy}
        onChange={onToggle}
        label={`${t.name} active`}
      />
    </div>
  );
}

// ─── Starter row (read-only) ──────────────────────────────────────────────────

function StarterRow({
  starter,
  last,
  pillar,
  onUse,
}: {
  starter: StarterTemplate;
  last: boolean;
  pillar: ReturnType<typeof pillarForOwner>;
  onUse: () => void;
}) {
  const meta = channelMeta(starter.channel);
  const ChannelIcon = meta.icon;
  return (
    <div
      className={clsx(
        "flex items-center gap-3 px-3.5 py-3",
        !last && "border-b border-app-border-subtle",
      )}
    >
      <button
        type="button"
        onClick={onUse}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <IconTile icon={meta.icon} muted />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold text-app-text">
            {starter.name}
          </div>
          <div className="mt-0.5 truncate text-[11.5px] text-app-text-secondary">
            {snippet(starter.body)}
          </div>
          <div className="mt-1.5 flex items-center gap-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-app-surface-sunken px-2 py-0.5 text-[10.5px] font-semibold text-app-text-secondary">
              <ChannelIcon className="h-2.5 w-2.5" aria-hidden />
              {meta.label}
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TemplateLibrary() {
  const router = useRouter();
  const owner = useSchedulingOwner();
  const pillar = pillarForOwner(owner.ownerType);

  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading");
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);

  const load = useCallback(async () => {
    setPhase("loading");
    try {
      const { templates: list } =
        await api.scheduling.listMessageTemplates(owner);
      setTemplates(list ?? []);
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, [owner]);

  useEffect(() => {
    void load();
  }, [load]);

  const q = query.toLowerCase();

  const visibleStarters = STARTERS.filter(
    (s) =>
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.body.toLowerCase().includes(q),
  );

  const visibleTemplates = templates.filter(
    (t) =>
      !q ||
      t.name.toLowerCase().includes(q) ||
      (t.body ?? "").toLowerCase().includes(q),
  );

  const toggleActive = async (t: MessageTemplate) => {
    const next = !t.is_active;
    setBusyId(t.id);
    setTemplates((list) =>
      list.map((x) => (x.id === t.id ? { ...x, is_active: next } : x)),
    );
    try {
      await api.scheduling.updateMessageTemplate(
        t.id,
        { is_active: next },
        owner,
      );
    } catch (err) {
      setTemplates((list) =>
        list.map((x) => (x.id === t.id ? { ...x, is_active: !next } : x)),
      );
      toast.error(decodeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const duplicate = async (t: MessageTemplate) => {
    try {
      await api.scheduling.createMessageTemplate(
        {
          name: `${t.name} (copy)`,
          channel: t.channel,
          subject: t.subject ?? undefined,
          body: t.body,
          is_active: false,
        },
        owner,
      );
      toast.success("Template duplicated.");
      void load();
    } catch (err) {
      toast.error(decodeError(err).message);
    }
  };

  const remove = async (t: MessageTemplate) => {
    const ok = await confirmStore.open({
      title: `Delete "${t.name}"?`,
      description:
        "Workflows using its text keep their copy. This can't be undone.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await api.scheduling.deleteMessageTemplate(t.id, owner);
      setTemplates((list) => list.filter((x) => x.id !== t.id));
      toast.success("Template deleted.");
    } catch (err) {
      toast.error(decodeError(err).message);
    }
  };

  const applyStarter = (s: StarterTemplate) => {
    // Navigate to new template editor pre-filled via query params.
    const params = new URLSearchParams({
      name: s.name,
      channel: s.channel,
      body: s.body,
    });
    router.push(`/app/scheduling/templates/new?${params.toString()}`);
  };

  return (
    <div>
      <header className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Overline pillar={pillar} className="mb-1.5">
            Reminders &amp; automations
          </Overline>
          <h1 className="text-xl font-bold text-app-text">Templates</h1>
          <p className="mt-0.5 text-sm text-app-text-secondary">
            Reusable message copy for workflows and manual sends.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label={searchActive ? "Close search" : "Search templates"}
            onClick={() => {
              setSearchActive((v) => !v);
              if (searchActive) setQuery("");
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-app-border bg-app-surface text-app-text-secondary transition hover:bg-app-hover"
          >
            {searchActive ? (
              <X className="h-4 w-4" aria-hidden />
            ) : (
              <Search className="h-4 w-4" aria-hidden />
            )}
          </button>
          <button
            type="button"
            onClick={() => router.push("/app/scheduling/templates/new")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" strokeWidth={2.4} aria-hidden />
            New
          </button>
        </div>
      </header>

      {/* Search field — collapsible */}
      {searchActive && (
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted" />
            <input
              type="search"
              placeholder="Search templates…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="w-full rounded-xl border border-app-border bg-app-surface py-2 pl-9 pr-3 text-[14px] text-app-text placeholder:text-app-text-muted focus:border-app-personal focus:outline-none focus:ring-2 focus:ring-app-personal/30"
            />
          </div>
        </div>
      )}

      {phase === "loading" && (
        <Card>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3.5 py-3.5">
              <ShimmerBlock className="h-[34px] w-[34px] rounded-[9px]" />
              <div className="flex-1 space-y-1.5">
                <ShimmerBlock className="h-3 w-1/3 rounded" />
                <ShimmerBlock className="h-2.5 w-2/3 rounded" />
              </div>
              <ShimmerBlock className="h-[28px] w-[46px] rounded-full" />
            </div>
          ))}
        </Card>
      )}

      {phase === "error" && (
        <ErrorState
          message="Couldn't load templates."
          onRetry={() => void load()}
        />
      )}

      {phase === "ready" && (
        <>
          {/* Starter templates — always shown (filtered by search) */}
          {visibleStarters.length > 0 && (
            <section className="mb-5">
              <Overline className="mb-2">Starter templates</Overline>
              <Card>
                {visibleStarters.map((s, i) => (
                  <StarterRow
                    key={s.id}
                    starter={s}
                    last={i === visibleStarters.length - 1}
                    pillar={pillar}
                    onUse={() => applyStarter(s)}
                  />
                ))}
              </Card>
            </section>
          )}

          {/* My templates */}
          <section>
            <Overline className="mb-2">My templates</Overline>
            {visibleTemplates.length === 0 && !q && (
              <EmptyTemplates
                pillar={pillar}
                onAdd={() => router.push("/app/scheduling/templates/new")}
              />
            )}
            {visibleTemplates.length === 0 && q && (
              <div className="rounded-xl border border-dashed border-app-border bg-app-surface px-6 py-8 text-center text-[13px] text-app-text-secondary">
                No templates match &ldquo;{query}&rdquo;
              </div>
            )}
            {visibleTemplates.length > 0 && (
              <Card>
                {visibleTemplates.map((t, i) => (
                  <TemplateRow
                    key={t.id}
                    template={t}
                    last={i === visibleTemplates.length - 1}
                    pillar={pillar}
                    busy={busyId === t.id}
                    onOpen={() =>
                      router.push(`/app/scheduling/templates/${t.id}`)
                    }
                    onToggle={() => void toggleActive(t)}
                    onDuplicate={() => void duplicate(t)}
                    onDelete={() => void remove(t)}
                  />
                ))}
              </Card>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function EmptyTemplates({
  pillar,
  onAdd,
}: {
  pillar: ReturnType<typeof pillarForOwner>;
  onAdd: () => void;
}) {
  const tk = pillarTokens(pillar);
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-xl border border-app-border bg-app-surface px-6 py-12 text-center">
      <span
        className={clsx(
          "flex h-14 w-14 items-center justify-center rounded-full",
          tk.bgSoft,
          tk.text,
        )}
      >
        <MessageSquarePlus className="h-6 w-6" strokeWidth={1.8} aria-hidden />
      </span>
      <h2 className="text-[15px] font-bold text-app-text">No templates yet</h2>
      <p className="max-w-xs text-[12.5px] leading-5 text-app-text-secondary">
        Save the messages you reuse — thank-you notes, reminders, review
        requests — and drop them into workflows.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-app-border-strong bg-app-surface px-4 py-2 text-[13px] font-bold text-app-text transition hover:bg-app-hover"
      >
        <Plus className={clsx("h-3.5 w-3.5", tk.text)} aria-hidden />
        New template
      </button>
    </div>
  );
}
