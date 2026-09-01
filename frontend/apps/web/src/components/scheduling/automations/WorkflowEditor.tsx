"use client";

// W16 · H3 — Workflow Editor (+ H4 Trigger Picker as a local sheet). `id==='new'`
// is create mode; a UUID loads the existing workflow (found in the GET /workflows
// list — the API has no single-workflow GET). Composes trigger → action → message,
// with the offset shown only for timed triggers. Backed by POST/PUT/DELETE
// /workflows. Personal sky pillar.
//
// Tab strip: Build (the main form) + Activity (empty run-log state).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Braces, ChevronRight, Clock, Trash2 } from "lucide-react";
import * as api from "@pantopus/api";
import type { EventType, MessageTemplate, Workflow } from "@pantopus/types";
import { useSchedulingOwner } from "@/components/scheduling/SchedulingOwnerProvider";
import { pillarForOwner } from "@/components/scheduling/pillarTokens";
import { decodeError, fieldErrors } from "@/components/scheduling/decodeError";
import { toast } from "@/components/ui/toast-store";
import { confirmStore } from "@/components/ui/confirm-store";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import ErrorState from "@/components/ui/ErrorState";
import {
  Card,
  Field,
  GhostButton,
  IconTile,
  PrimaryButton,
  Segmented,
  TextArea,
  TextInput,
  Toggle,
  UnderlineTabs,
} from "./kit";
import TriggerPicker from "./TriggerPicker";
import { VARIABLES as WF_VARIABLES } from "./templateMeta";
import {
  ACTIONS,
  emptyWorkflowForm,
  formToWorkflowInput,
  offsetToParts,
  partsToOffset,
  triggerMeta,
  triggerSummary,
  validateWorkflow,
  workflowToForm,
  type OffsetUnit,
  type WorkflowForm,
} from "./workflowMeta";

// SMS segment limit for the character counter.
const SMS_LIMIT = 160;

const OFFSET_UNITS: { id: OffsetUnit; label: string }[] = [
  { id: "minutes", label: "minutes" },
  { id: "hours", label: "hours" },
  { id: "days", label: "days" },
];

type EditorTab = "build" | "activity";

export default function WorkflowEditor({ id }: { id: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const owner = useSchedulingOwner();
  const pillar = pillarForOwner(owner.ownerType);
  const isNew = id === "new";

  const [tab, setTab] = useState<EditorTab>("build");
  const [phase, setPhase] = useState<"loading" | "error" | "ready">(
    isNew ? "ready" : "loading",
  );
  const [form, setForm] = useState<WorkflowForm>(() =>
    emptyWorkflowForm(search?.get("eventType") ?? null),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showVarPicker, setShowVarPicker] = useState(false);

  const load = useCallback(async () => {
    // Best-effort context.
    api.scheduling
      .listEventTypes(owner)
      .then((res) => setEventTypes(res.eventTypes ?? []))
      .catch(() => undefined);
    api.scheduling
      .listMessageTemplates(owner)
      .then((res) => setTemplates(res.templates ?? []))
      .catch(() => undefined);

    if (isNew) {
      setPhase("ready");
      return;
    }
    setPhase("loading");
    try {
      const { workflows } = await api.scheduling.listWorkflows(owner);
      const found = (workflows ?? []).find((w: Workflow) => w.id === id);
      if (!found) {
        setPhase("error");
        return;
      }
      setForm(workflowToForm(found));
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, [owner, id, isNew]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = (next: Partial<WorkflowForm>) =>
    setForm((cur) => ({ ...cur, ...next }));

  const timed = triggerMeta(form.trigger).timed;
  const offset = useMemo(
    () => offsetToParts(form.offset_minutes),
    [form.offset_minutes],
  );

  const isSms = form.action === "sms";
  const msgLen = form.message_template.length;

  const insertVariable = (token: string) => {
    patch({ message_template: form.message_template + `{{${token}}}` });
    setShowVarPicker(false);
  };

  const save = async () => {
    const localErrors = validateWorkflow(form);
    setErrors(localErrors);
    if (Object.keys(localErrors).length > 0) {
      toast.error("Fix the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      const input = formToWorkflowInput(form);
      if (isNew) {
        await api.scheduling.createWorkflow(input, owner);
        toast.success("Workflow created.");
      } else {
        await api.scheduling.updateWorkflow(id, input, owner);
        toast.success("Workflow saved.");
      }
      router.push("/app/scheduling/workflows");
    } catch (err) {
      const d = decodeError(err);
      if (d.kind === "validation") {
        setErrors(fieldErrors(d));
        toast.error(d.message);
      } else {
        toast.error(d.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirmStore.open({
      title: `Delete "${form.name || "this workflow"}"?`,
      description: "It stops running immediately. This can't be undone.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await api.scheduling.deleteWorkflow(id, owner);
      toast.success("Workflow deleted.");
      router.push("/app/scheduling/workflows");
    } catch (err) {
      toast.error(decodeError(err).message);
    }
  };

  if (phase === "loading") {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <ShimmerBlock className="h-8 w-40 rounded-lg" />
        {[0, 1, 2].map((i) => (
          <ShimmerBlock key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState
          message="We couldn't load this workflow."
          onRetry={() => void load()}
        />
      </div>
    );
  }

  const trig = triggerMeta(form.trigger);

  return (
    <div className="mx-auto max-w-2xl pb-10">
      <header className="mb-4">
        <button
          type="button"
          onClick={() => router.push("/app/scheduling/workflows")}
          className="mb-2 text-[12.5px] font-semibold text-app-text-secondary transition hover:text-app-text"
        >
          ← Workflows
        </button>
        <h1 className="text-xl font-bold text-app-text">
          {isNew ? "New workflow" : "Edit workflow"}
        </h1>
        <p className="mt-0.5 text-sm text-app-text-secondary">
          Run a message automatically when something happens.
        </p>
      </header>

      {/* Build / Activity tab strip */}
      <div className="mb-5">
        <UnderlineTabs
          pillar={pillar}
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "build", label: "Build" },
            { id: "activity", label: "Activity" },
          ]}
        />
      </div>

      {/* ── Activity tab ── */}
      {tab === "activity" && (
        <div className="flex flex-col items-center gap-2.5 rounded-xl border border-app-border bg-app-surface px-6 py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-app-surface-sunken text-app-text-muted">
            <Clock className="h-6 w-6" strokeWidth={1.8} aria-hidden />
          </span>
          <h2 className="text-[15px] font-bold text-app-text">
            No activity yet
          </h2>
          <p className="max-w-xs text-[12.5px] leading-5 text-app-text-secondary">
            Run history will appear here once this workflow starts sending.
          </p>
        </div>
      )}

      {/* ── Build tab ── */}
      {tab === "build" && (
        <div className="space-y-5">
          {/* Name — optional, falls back to channel.actionSummary server-side */}
          <Field
            label="Name · optional"
            htmlFor="wf-name"
            error={errors.name}
            hint="Leave blank to auto-name from the action."
          >
            <TextInput
              id="wf-name"
              value={form.name}
              invalid={Boolean(errors.name)}
              maxLength={200}
              placeholder="e.g. Thank-you email"
              onChange={(e) => patch({ name: e.target.value })}
            />
          </Field>

          {/* Trigger → opens the H4 picker */}
          <Field label="Trigger" error={errors.trigger}>
            <Card>
              <button
                type="button"
                onClick={() => setTriggerOpen(true)}
                className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-app-hover"
              >
                <IconTile icon={trig.icon} pillar={pillar} />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-app-text">
                    {triggerSummary(form)}
                  </div>
                  <div className="mt-0.5 text-[12px] text-app-text-secondary">
                    {trig.description}
                  </div>
                </div>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-app-text-muted"
                  aria-hidden
                />
              </button>
            </Card>
          </Field>

          {timed && (
            <Field
              label="How long?"
              error={errors.offset_minutes}
              hint={
                form.trigger === "before_start"
                  ? "Time before the booking starts."
                  : "Time after the booking ends."
              }
            >
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={offset.value}
                  onChange={(e) =>
                    patch({
                      offset_minutes: partsToOffset(
                        Number(e.target.value),
                        offset.unit,
                      ),
                    })
                  }
                  className="w-24 rounded-lg border border-app-border bg-app-surface px-3 py-2 text-[14px] text-app-text focus:border-app-personal focus:outline-none focus:ring-2 focus:ring-app-personal/30"
                  aria-label="Offset amount"
                />
                <select
                  value={offset.unit}
                  onChange={(e) =>
                    patch({
                      offset_minutes: partsToOffset(
                        offset.value,
                        e.target.value as OffsetUnit,
                      ),
                    })
                  }
                  className="rounded-lg border border-app-border bg-app-surface px-3 py-2 text-[14px] text-app-text focus:border-app-personal focus:outline-none focus:ring-2 focus:ring-app-personal/30"
                  aria-label="Offset unit"
                >
                  {OFFSET_UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
          )}

          {/* Action — capsule channel chips (Segmented) */}
          <Field label="Action" error={errors.action}>
            <Segmented
              pillar={pillar}
              value={form.action}
              onChange={(action) => patch({ action })}
              options={ACTIONS.map((a) => ({
                id: a.id,
                label: a.short,
                icon: a.icon,
                locked: a.locked,
              }))}
            />
          </Field>

          {/* Message — with Insert variable bar, char counter, template picker */}
          <Field
            label="Message"
            htmlFor="wf-message"
            error={errors.message_template}
            hint="Optional. Use {{invitee_name}} and other variables — leave blank for the default copy."
          >
            {/* Insert variable dashed capsule button */}
            <div className="mb-2">
              <button
                type="button"
                onClick={() => setShowVarPicker((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-app-border-strong bg-app-surface px-3 py-1.5 text-[12.5px] font-semibold text-app-text-secondary transition hover:bg-app-hover"
              >
                <Braces className="h-3 w-3" aria-hidden />
                Insert variable
              </button>
            </div>

            {/* Variable picker panel */}
            {showVarPicker && (
              <div className="mb-2 rounded-xl border border-app-border bg-app-surface-sunken p-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-app-text-secondary">
                  Variables
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {WF_VARIABLES.map((v) => (
                    <button
                      key={v.token}
                      type="button"
                      onClick={() => insertVariable(v.token)}
                      title={`e.g. "${v.sample}"`}
                      className="inline-flex items-center gap-1 rounded-full border border-app-border bg-app-surface px-2.5 py-1 text-[11.5px] font-semibold text-app-text-strong transition hover:bg-app-hover"
                    >
                      <span className="font-mono text-[10.5px] text-app-personal">
                        {"{{"}
                      </span>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Insert saved template select */}
            {templates.length > 0 && (
              <div className="mb-2">
                <select
                  value=""
                  onChange={(e) => {
                    const t = templates.find((x) => x.id === e.target.value);
                    if (t) patch({ message_template: t.body });
                  }}
                  className="w-full rounded-lg border border-dashed border-app-border-strong bg-app-surface px-3 py-2 text-[13px] font-medium text-app-text-secondary focus:border-app-personal focus:outline-none focus:ring-2 focus:ring-app-personal/30"
                  aria-label="Insert a saved template"
                >
                  <option value="">Insert a saved template…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <TextArea
              id="wf-message"
              value={form.message_template}
              invalid={Boolean(errors.message_template)}
              maxLength={5000}
              placeholder="Hi {{invitee_name}}, thanks for booking…"
              onChange={(e) => patch({ message_template: e.target.value })}
            />
            {/* Character counter */}
            {(isSms || msgLen > 4000) && (
              <p
                className={`mt-1 text-right font-mono text-[11.5px] ${
                  isSms && msgLen > SMS_LIMIT
                    ? "text-app-error"
                    : "text-app-text-muted"
                }`}
              >
                {isSms ? `${msgLen} / ${SMS_LIMIT}` : `${msgLen} / 5000`}
              </p>
            )}
            {/* SMS over-limit warning */}
            {isSms && msgLen > SMS_LIMIT && (
              <p className="mt-1 text-[11.5px] font-medium text-app-warning">
                This will send as more than one SMS.
              </p>
            )}
          </Field>

          <Card>
            <div className="flex items-center gap-3 px-3.5 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium text-app-text">
                  Active
                </div>
                <div className="mt-0.5 text-[12px] text-app-text-secondary">
                  {form.is_active
                    ? "Running now."
                    : "Paused — it won't send until you turn it on."}
                </div>
              </div>
              <Toggle
                on={form.is_active}
                pillar={pillar}
                onChange={(is_active) => patch({ is_active })}
                label="Workflow active"
              />
            </div>
          </Card>

          <div className="flex items-center justify-between gap-3 pt-1">
            {!isNew ? (
              <button
                type="button"
                onClick={() => void remove()}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-app-error transition hover:underline"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <GhostButton
                onClick={() => router.push("/app/scheduling/workflows")}
              >
                Cancel
              </GhostButton>
              <PrimaryButton onClick={() => void save()} disabled={saving}>
                {saving ? "Saving…" : isNew ? "Create workflow" : "Save changes"}
              </PrimaryButton>
            </div>
          </div>

          <TriggerPicker
            open={triggerOpen}
            value={form.trigger}
            pillar={pillar}
            onSelect={(trigger) => {
              // Default a sensible offset when switching into a timed trigger.
              const becomingTimed = triggerMeta(trigger).timed;
              patch({
                trigger,
                offset_minutes:
                  becomingTimed && form.offset_minutes === 0
                    ? 60
                    : form.offset_minutes,
              });
            }}
            onClose={() => setTriggerOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
