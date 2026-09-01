"use client";

// W16 · H5 — Message Template Editor (+ H6 Variable Picker and H7 Message Preview
// as local panels). `id==='new'` creates; a UUID loads from GET /message-templates
// (no single GET). Subject shows only for channels that need one (email). Backed
// by POST/PUT/DELETE /message-templates. Personal sky pillar.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Braces, Eye, EyeOff, Trash2 } from "lucide-react";
import * as api from "@pantopus/api";
import type { MessageChannel, MessageTemplate } from "@pantopus/types";
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
  PrimaryButton,
  Segmented,
  TextInput,
  Toggle,
} from "./kit";
import VariablePicker from "./VariablePicker";
import MessagePreview from "./MessagePreview";
import {
  CHANNELS,
  channelMeta,
  emptyTemplateForm,
  formToTemplateInput,
  insertToken,
  templateToForm,
  validateTemplate,
  type TemplateForm,
} from "./templateMeta";

const BODY_CLASS =
  "w-full min-h-[160px] resize-y rounded-lg border bg-app-surface px-3 py-2 text-[14px] leading-6 text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2";

export default function TemplateEditor({ id }: { id: string }) {
  const router = useRouter();
  const owner = useSchedulingOwner();
  const pillar = pillarForOwner(owner.ownerType);
  const isNew = id === "new";

  const [phase, setPhase] = useState<"loading" | "error" | "ready">(
    isNew ? "ready" : "loading",
  );
  const [form, setForm] = useState<TemplateForm>(() => emptyTemplateForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showVars, setShowVars] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const caretRef = useRef<number>(0);

  const load = useCallback(async () => {
    if (isNew) {
      setPhase("ready");
      return;
    }
    setPhase("loading");
    try {
      const { templates } = await api.scheduling.listMessageTemplates(owner);
      const found = (templates ?? []).find((t: MessageTemplate) => t.id === id);
      if (!found) {
        setPhase("error");
        return;
      }
      setForm(templateToForm(found));
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, [owner, id, isNew]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = (next: Partial<TemplateForm>) =>
    setForm((cur) => ({ ...cur, ...next }));

  const rememberCaret = () => {
    caretRef.current = bodyRef.current?.selectionStart ?? form.body.length;
  };

  const insertVariable = (token: string) => {
    const caret = caretRef.current;
    const next = insertToken(form.body, token, caret);
    patch({ body: next });
    const newCaret = caret + `{{${token}}}`.length;
    requestAnimationFrame(() => {
      const el = bodyRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(newCaret, newCaret);
        caretRef.current = newCaret;
      }
    });
  };

  const needsSubject = channelMeta(form.channel).needsSubject;

  const save = async () => {
    const localErrors = validateTemplate(form);
    setErrors(localErrors);
    if (Object.keys(localErrors).length > 0) {
      toast.error("Fix the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      const input = formToTemplateInput(form);
      if (isNew) {
        await api.scheduling.createMessageTemplate(input, owner);
        toast.success("Template created.");
      } else {
        await api.scheduling.updateMessageTemplate(id, input, owner);
        toast.success("Template saved.");
      }
      router.push("/app/scheduling/templates");
    } catch (err) {
      const d = decodeError(err);
      if (d.kind === "validation") setErrors(fieldErrors(d));
      toast.error(d.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirmStore.open({
      title: `Delete "${form.name || "this template"}"?`,
      description:
        "Workflows using its text keep their copy. This can't be undone.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await api.scheduling.deleteMessageTemplate(id, owner);
      toast.success("Template deleted.");
      router.push("/app/scheduling/templates");
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
          message="We couldn't load this template."
          onRetry={() => void load()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-10">
      <header>
        <button
          type="button"
          onClick={() => router.push("/app/scheduling/templates")}
          className="mb-2 text-[12.5px] font-semibold text-app-text-secondary transition hover:text-app-text"
        >
          ← Templates
        </button>
        <h1 className="text-xl font-bold text-app-text">
          {isNew ? "New template" : "Edit template"}
        </h1>
        <p className="mt-0.5 text-sm text-app-text-secondary">
          Reusable message copy for workflows and manual sends.
        </p>
      </header>

      <Field label="Channel">
        <Segmented
          pillar={pillar}
          value={form.channel}
          onChange={(channel) => patch({ channel: channel as MessageChannel })}
          options={CHANNELS.map((c) => ({
            id: c.id,
            label: c.label,
            icon: c.icon,
            locked: c.locked,
          }))}
        />
      </Field>

      <Field
        label="Name · optional"
        htmlFor="tpl-name"
        error={errors.name}
        hint="Leave blank to auto-name from the channel."
      >
        <TextInput
          id="tpl-name"
          value={form.name}
          invalid={Boolean(errors.name)}
          maxLength={200}
          placeholder="e.g. Thank-you note"
          onChange={(e) => patch({ name: e.target.value })}
        />
      </Field>

      {needsSubject && (
        <Field label="Subject" htmlFor="tpl-subject" error={errors.subject}>
          <TextInput
            id="tpl-subject"
            value={form.subject}
            invalid={Boolean(errors.subject)}
            maxLength={300}
            placeholder="See you on {{event_date}}"
            onChange={(e) => patch({ subject: e.target.value })}
          />
        </Field>
      )}

      <Field
        label="Message"
        error={errors.body}
        hint="Use variables like {{invitee_name}} — they fill in per booking."
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowVars((v) => !v)}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-3 py-1.5 text-[12.5px] font-semibold transition hover:bg-app-hover",
              showVars ? "text-app-text" : "text-app-text-secondary",
            )}
          >
            <Braces className="h-3.5 w-3.5" aria-hidden />
            Variables
          </button>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-3 py-1.5 text-[12.5px] font-semibold text-app-text-secondary transition hover:bg-app-hover"
          >
            {showPreview ? (
              <EyeOff className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Eye className="h-3.5 w-3.5" aria-hidden />
            )}
            {showPreview ? "Hide preview" : "Preview"}
          </button>
        </div>

        {showVars && (
          <div className="mb-2">
            <VariablePicker pillar={pillar} onInsert={insertVariable} />
          </div>
        )}

        <textarea
          ref={bodyRef}
          value={form.body}
          maxLength={5000}
          onChange={(e) => patch({ body: e.target.value })}
          onSelect={rememberCaret}
          onKeyUp={rememberCaret}
          onClick={rememberCaret}
          placeholder="Hi {{invitee_name}}, thanks for booking {{event_name}}…"
          className={clsx(
            BODY_CLASS,
            errors.body
              ? "border-app-error focus:ring-app-error/40"
              : "border-app-border focus:border-app-personal focus:ring-app-personal/30",
          )}
        />
        {/* Character counter: monospaced, shown always for SMS, shown when near limit for other channels */}
        {(form.channel === "sms" || form.body.length > 4000) && (
          <p
            className={clsx(
              "mt-1 text-right font-mono text-[11.5px]",
              form.channel === "sms" && form.body.length > 160
                ? "text-app-error"
                : "text-app-text-muted",
            )}
          >
            {form.channel === "sms"
              ? `${form.body.length} / 160`
              : `${form.body.length} / 5000`}
          </p>
        )}
        {/* SMS over-limit warning: this will send as more than one SMS */}
        {form.channel === "sms" && form.body.length > 160 && (
          <p className="mt-1 text-[11.5px] font-medium text-app-warning">
            This will send as more than one SMS.
          </p>
        )}
      </Field>

      {showPreview && (
        <MessagePreview
          channel={form.channel}
          subject={form.subject}
          body={form.body}
          pillar={pillar}
        />
      )}

      <Card>
        <div className="flex items-center gap-3 px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-medium text-app-text">Active</div>
            <div className="mt-0.5 text-[12px] text-app-text-secondary">
              {form.is_active
                ? "Available to workflows and manual sends."
                : "Hidden from pickers until you turn it on."}
            </div>
          </div>
          <Toggle
            on={form.is_active}
            pillar={pillar}
            onChange={(is_active) => patch({ is_active })}
            label="Template active"
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
          <GhostButton onClick={() => router.push("/app/scheduling/templates")}>
            Cancel
          </GhostButton>
          <PrimaryButton onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : isNew ? "Create template" : "Save changes"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
