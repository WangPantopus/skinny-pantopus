"use client";

// W2 — Event Types. B3 intake questions editor. Name + email are always asked
// (locked rows); the host adds custom questions (type, options for select-style
// types, required). Persists the WHOLE set via PUT /event-types/:id/questions
// (replace semantics). Used both as a local sheet from the editor (B2) and as
// the full /event-types/[id]/questions page.

import { useState } from "react";
import clsx from "clsx";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Lock,
  Mail,
  Plus,
  Trash2,
  User,
  X,
} from "lucide-react";
import * as api from "@pantopus/api";
import type {
  IntakeQuestion,
  IntakeQuestionFieldType,
  SchedulingOwnerRef,
} from "@pantopus/types";
import { toast } from "@/components/ui/toast-store";
import { decodeError } from "@/components/scheduling/decodeError";
import { FieldLabel, TextField, Toggle } from "./fields";

const TYPE_OPTIONS: ReadonlyArray<{
  value: IntakeQuestionFieldType;
  label: string;
}> = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Paragraph" },
  { value: "select", label: "Dropdown" },
  { value: "multiselect", label: "Multi-select" },
  { value: "checkbox", label: "Checkbox" },
  { value: "phone", label: "Phone" },
];

const TYPE_LABEL: Record<IntakeQuestionFieldType, string> = Object.fromEntries(
  TYPE_OPTIONS.map((t) => [t.value, t.label]),
) as Record<IntakeQuestionFieldType, string>;

const SELECT_TYPES: IntakeQuestionFieldType[] = [
  "select",
  "multiselect",
  "checkbox",
];
const isSelectType = (t: IntakeQuestionFieldType) => SELECT_TYPES.includes(t);

interface Draft {
  key: string;
  id?: string;
  label: string;
  field_type: IntakeQuestionFieldType;
  options: string[];
  required: boolean;
}

let _uid = 0;
const uid = () => `q_${Date.now().toString(36)}_${_uid++}`;

function toDraft(q: IntakeQuestion): Draft {
  return {
    key: uid(),
    id: q.id,
    label: q.label,
    field_type: q.field_type,
    options: Array.isArray(q.options) ? [...q.options] : [],
    required: Boolean(q.required),
  };
}

export default function IntakeQuestionsEditor({
  eventTypeId,
  owner,
  initialQuestions,
  onSaved,
  variant = "sheet",
}: {
  eventTypeId: string;
  owner: SchedulingOwnerRef;
  initialQuestions: IntakeQuestion[];
  onSaved?: (questions: IntakeQuestion[]) => void;
  /** "sheet" = hosted in a BottomSheet (no bottom save CTA shown — "Save question" in EditGroup commits);
   *  "page" = standalone page (explicit "Save questions" CTA is shown). */
  variant?: "sheet" | "page";
}) {
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    initialQuestions.map(toDraft),
  );
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const patch = (key: string, partial: Partial<Draft>) =>
    setDrafts((d) => d.map((q) => (q.key === key ? { ...q, ...partial } : q)));

  const remove = (key: string) => {
    setDrafts((d) => d.filter((q) => q.key !== key));
    if (editingKey === key) setEditingKey(null);
  };

  const move = (key: string, dir: -1 | 1) =>
    setDrafts((d) => {
      const i = d.findIndex((q) => q.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.length) return d;
      const next = [...d];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const addQuestion = () => {
    const draft: Draft = {
      key: uid(),
      label: "",
      field_type: "text",
      options: [],
      required: false,
    };
    setDrafts((d) => [...d, draft]);
    setEditingKey(draft.key);
  };

  const save = async () => {
    // Commit any in-progress edit; drop blank-label questions.
    const cleaned = drafts
      .map((q) => ({ ...q, label: q.label.trim() }))
      .filter((q) => q.label.length > 0);

    if (drafts.some((q) => !q.label.trim())) {
      toast.error("Give every question a label, or remove it.");
      return;
    }

    const payload: IntakeQuestion[] = cleaned.map((q, i) => ({
      label: q.label,
      field_type: q.field_type,
      options: isSelectType(q.field_type)
        ? q.options.map((o) => o.trim()).filter(Boolean)
        : [],
      required: q.required,
      sort_order: i,
    }));

    setSaving(true);
    try {
      const res = await api.scheduling.updateQuestions(
        eventTypeId,
        payload,
        owner,
      );
      const saved = res.questions ?? payload;
      setDrafts(saved.map(toDraft));
      setEditingKey(null);
      toast.success("Questions saved.");
      onSaved?.(saved);
    } catch (err) {
      const decoded = decodeError(err);
      toast.error(decoded.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col">
      <p className="px-0.5 text-xs leading-snug text-app-text-secondary">
        Ask people a few things when they book. Name and email are always asked.
      </p>

      {/* Locked defaults */}
      <div className="mt-3 flex flex-col">
        <LockedRow icon={User} label="Name" />
        <LockedRow icon={Mail} label="Email" last />
      </div>

      {/* Custom questions */}
      <p className="mb-1 mt-5 text-[11px] font-bold uppercase tracking-[0.08em] text-app-text-muted">
        Your questions
      </p>

      {drafts.length === 0 && editingKey == null && (
        <p className="text-xs text-app-text-secondary">
          You haven&apos;t added any yet.
        </p>
      )}

      <div className="flex flex-col">
        {drafts.map((q, i) =>
          editingKey === q.key ? (
            <EditGroup
              key={q.key}
              draft={q}
              onChange={(p) => patch(q.key, p)}
              onDone={() => {
                if (!q.label.trim()) {
                  remove(q.key);
                } else {
                  setEditingKey(null);
                  // In sheet mode, "Save question" is the sole commit CTA —
                  // persist immediately so the sheet "Done" header can close cleanly.
                  if (variant === "sheet") {
                    void save();
                  }
                }
              }}
              onDelete={() => remove(q.key)}
            />
          ) : (
            <QuestionRow
              key={q.key}
              draft={q}
              isFirst={i === 0}
              isLast={i === drafts.length - 1}
              onEdit={() => setEditingKey(q.key)}
              onDelete={() => remove(q.key)}
              onMoveUp={() => move(q.key, -1)}
              onMoveDown={() => move(q.key, 1)}
            />
          ),
        )}
      </div>

      <button
        type="button"
        onClick={addQuestion}
        className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary-600 text-sm font-bold text-white shadow-sm transition hover:bg-primary-700"
      >
        <Plus className="h-4 w-4" strokeWidth={2.4} aria-hidden />
        Add a question
      </button>

      {/* Page variant: explicit save CTA (sheet variant uses the sheet header Done action). */}
      {variant === "page" && (
        <div className="mt-6">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary-600 text-sm font-bold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save questions"}
          </button>
        </div>
      )}
    </div>
  );
}

function LockedRow({
  icon: Icon,
  label,
  last,
}: {
  icon: typeof User;
  label: string;
  last?: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex items-center gap-3 py-2.5",
        !last && "border-b border-app-border",
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-surface-sunken text-app-text-secondary">
        <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-app-text">{label}</p>
        <p className="mt-0.5 text-[10.5px] text-app-text-muted">Always asked</p>
      </div>
      <Lock
        className="h-3.5 w-3.5 text-app-text-muted"
        strokeWidth={2}
        aria-hidden
      />
    </div>
  );
}

function QuestionRow({
  draft,
  isFirst,
  isLast,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  draft: Draft;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div
      className={clsx(
        "flex items-center gap-2 py-2.5",
        !isLast && "border-b border-app-border",
      )}
    >
      <GripVertical
        className="h-4 w-4 shrink-0 text-app-text-muted"
        aria-hidden
      />
      <button
        type="button"
        onClick={onEdit}
        className="min-w-0 flex-1 text-left"
      >
        <span className="block text-[13px] font-semibold leading-snug text-app-text">
          {draft.label || "Untitled question"}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5">
          <span className="text-[11px] text-app-text-secondary">
            {TYPE_LABEL[draft.field_type]}
          </span>
          {draft.required && (
            <span className="inline-flex items-center rounded-full bg-primary-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-700">
              Required
            </span>
          )}
        </span>
      </button>
      <div className="flex shrink-0 flex-col">
        <button
          type="button"
          aria-label="Move up"
          disabled={isFirst}
          onClick={onMoveUp}
          className="text-app-text-muted disabled:opacity-30"
        >
          <ChevronUp className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Move down"
          disabled={isLast}
          onClick={onMoveDown}
          className="text-app-text-muted disabled:opacity-30"
        >
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <button
        type="button"
        aria-label="Delete question"
        onClick={onDelete}
        className="flex h-7 w-7 shrink-0 items-center justify-center text-app-text-muted hover:text-app-error"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

function EditGroup({
  draft,
  onChange,
  onDone,
  onDelete,
}: {
  draft: Draft;
  onChange: (p: Partial<Draft>) => void;
  /** Called when user clicks "Save question" — collapses the inline editor. */
  onDone: () => void;
  onDelete: () => void;
}) {
  const showOptions = isSelectType(draft.field_type);

  const setOption = (i: number, v: string) =>
    onChange({ options: draft.options.map((o, idx) => (idx === i ? v : o)) });
  const addOption = () => onChange({ options: [...draft.options, ""] });
  const removeOption = (i: number) =>
    onChange({ options: draft.options.filter((_, idx) => idx !== i) });

  return (
    <div className="my-1 flex flex-col gap-3 rounded-xl border-[1.5px] border-primary-200 bg-primary-50 p-3">
      <TextField
        label="Question"
        value={draft.label}
        onChange={(v) => onChange({ label: v })}
        placeholder="e.g. What should we cover?"
      />

      <div>
        <FieldLabel>Answer type</FieldLabel>
        <div className="grid grid-cols-3 gap-1 rounded-[10px] bg-app-surface-sunken p-1">
          {TYPE_OPTIONS.map((o) => {
            const on = o.value === draft.field_type;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() =>
                  onChange({
                    field_type: o.value,
                    options:
                      isSelectType(o.value) && draft.options.length === 0
                        ? ["Option one", "Option two"]
                        : draft.options,
                  })
                }
                className={clsx(
                  "h-8 whitespace-nowrap rounded-md text-[11px] transition",
                  on
                    ? "bg-app-surface font-bold text-primary-700 shadow-sm"
                    : "font-semibold text-app-text-secondary hover:text-app-text",
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      {showOptions && (
        <div>
          <FieldLabel>Options</FieldLabel>
          <div className="flex flex-col gap-1.5">
            {draft.options.map((o, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border-[1.5px] border-app-border bg-app-surface px-2.5 py-2"
              >
                <GripVertical
                  className="h-3.5 w-3.5 shrink-0 text-app-text-muted"
                  aria-hidden
                />
                <input
                  value={o}
                  onChange={(e) => setOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  className="min-w-0 flex-1 bg-transparent text-[12.5px] text-app-text outline-none placeholder:text-app-text-muted"
                />
                <button
                  type="button"
                  aria-label="Remove option"
                  onClick={() => removeOption(i)}
                  className="text-app-text-muted hover:text-app-error"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addOption}
              className="inline-flex items-center gap-1.5 self-start py-1 text-xs font-semibold text-primary-600"
            >
              <Plus className="h-3 w-3" aria-hidden />
              Add option
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg border border-app-border bg-app-surface px-3 py-2.5">
        <span className="text-[12.5px] font-semibold text-app-text">
          Make this required
        </span>
        <Toggle
          on={draft.required}
          onChange={(v) => onChange({ required: v })}
          label="Make this required"
        />
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onDone}
          className="h-10 flex-1 rounded-lg bg-primary-600 text-[13px] font-bold text-white transition hover:bg-primary-700"
        >
          Save question
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex h-10 items-center gap-1.5 px-1.5 text-[12.5px] font-semibold text-app-error"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          Delete
        </button>
      </div>
    </div>
  );
}
