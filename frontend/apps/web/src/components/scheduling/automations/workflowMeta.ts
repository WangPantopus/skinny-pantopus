// W16 · H2/H3/H4 — Workflow trigger/action metadata + pure helpers.
//
// The backend Workflow is { trigger, offset_minutes, action, message_template }.
// `offset_minutes` only applies to the timed triggers (before_start/after_end);
// `action` is the delivery channel; `message_template` is inline message text
// (NOT a reference to a MessageTemplate id — that library is separate, H8).

import {
  Bell,
  CalendarCheck2,
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  Clock,
  Mail,
  MessageSquare,
  Smartphone,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  Workflow,
  WorkflowAction,
  WorkflowTrigger,
} from "@pantopus/types";

export interface TriggerMeta {
  id: WorkflowTrigger;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Timed triggers carry an offset relative to the booking start/end. */
  timed: boolean;
}

export const TRIGGERS: TriggerMeta[] = [
  {
    id: "booking_created",
    label: "When a booking is created",
    description: "Runs the moment someone books.",
    icon: CalendarPlus,
    timed: false,
  },
  {
    id: "before_start",
    label: "Before it starts",
    description: "Runs a chosen time ahead of the start.",
    icon: Clock,
    timed: true,
  },
  {
    id: "after_end",
    label: "After it ends",
    description: "Runs a chosen time after it wraps up.",
    icon: CalendarCheck2,
    timed: true,
  },
  {
    id: "cancelled",
    label: "When it's cancelled",
    description: "Runs if the booking is cancelled.",
    icon: CalendarX2,
    timed: false,
  },
  {
    id: "rescheduled",
    label: "When it's rescheduled",
    description: "Runs if the booking moves to a new time.",
    icon: CalendarClock,
    timed: false,
  },
];

export interface ActionMeta {
  id: WorkflowAction;
  label: string;
  short: string;
  icon: LucideIcon;
  /** SMS is accepted by the API but not yet delivered — shown as "soon". */
  locked?: boolean;
}

export const ACTIONS: ActionMeta[] = [
  { id: "email", label: "Send an email", short: "Email", icon: Mail },
  { id: "push", label: "Send a push notification", short: "Push", icon: Bell },
  {
    id: "in_app",
    label: "Send an in-app message",
    short: "In-app",
    icon: MessageSquare,
  },
  {
    id: "sms",
    label: "Send a text message",
    short: "Text",
    icon: Smartphone,
    locked: true,
  },
];

export function triggerMeta(id: WorkflowTrigger): TriggerMeta {
  return TRIGGERS.find((t) => t.id === id) ?? TRIGGERS[0];
}

export function actionMeta(id: WorkflowAction): ActionMeta {
  return ACTIONS.find((a) => a.id === id) ?? ACTIONS[0];
}

export type OffsetUnit = "minutes" | "hours" | "days";

const UNIT_PER: Record<OffsetUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 1440,
};

/** Split an offset in minutes into the largest whole unit (for the editor). */
export function offsetToParts(min: number): {
  value: number;
  unit: OffsetUnit;
} {
  const m = Math.max(0, Math.round(min));
  if (m === 0) return { value: 0, unit: "minutes" };
  if (m % 1440 === 0) return { value: m / 1440, unit: "days" };
  if (m % 60 === 0) return { value: m / 60, unit: "hours" };
  return { value: m, unit: "minutes" };
}

/** Recombine a value + unit into minutes for the API. */
export function partsToOffset(value: number, unit: OffsetUnit): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value) * UNIT_PER[unit];
}

function offsetPhrase(min: number): string {
  const { value, unit } = offsetToParts(min);
  const u = value === 1 ? unit.replace(/s$/, "") : unit;
  return `${value} ${u}`;
}

/** Plain-English trigger summary, weaving in the offset for timed triggers. */
export function triggerSummary(w: {
  trigger: WorkflowTrigger;
  offset_minutes?: number | null;
}): string {
  const offset = w.offset_minutes ?? 0;
  switch (w.trigger) {
    case "before_start":
      return offset > 0
        ? `${offsetPhrase(offset)} before it starts`
        : "When it starts";
    case "after_end":
      return offset > 0
        ? `${offsetPhrase(offset)} after it ends`
        : "When it ends";
    default:
      return triggerMeta(w.trigger).label;
  }
}

/** Friendly action summary: "Email" · "Push notification". */
export function actionSummary(action: WorkflowAction): string {
  switch (action) {
    case "email":
      return "Email";
    case "push":
      return "Push notification";
    case "in_app":
      return "In-app message";
    case "sms":
      return "Text message";
    default:
      return action;
  }
}

export interface WorkflowForm {
  name: string;
  event_type_id: string | null;
  trigger: WorkflowTrigger;
  offset_minutes: number;
  action: WorkflowAction;
  message_template: string;
  is_active: boolean;
}

export function emptyWorkflowForm(eventTypeId?: string | null): WorkflowForm {
  return {
    name: "",
    event_type_id: eventTypeId ?? null,
    trigger: "before_start",
    offset_minutes: 60,
    action: "email",
    message_template: "",
    is_active: true,
  };
}

export function workflowToForm(w: Workflow): WorkflowForm {
  return {
    name: w.name,
    event_type_id: w.event_type_id,
    trigger: w.trigger,
    offset_minutes: w.offset_minutes ?? 0,
    action: w.action,
    message_template: w.message_template ?? "",
    is_active: w.is_active,
  };
}

/** Build the API input, dropping the offset for non-timed triggers. Name falls back to actionSummary when blank. */
export function formToWorkflowInput(form: WorkflowForm) {
  const timed = triggerMeta(form.trigger).timed;
  const resolvedName =
    form.name.trim() || actionSummary(form.action);
  return {
    name: resolvedName,
    event_type_id: form.event_type_id,
    trigger: form.trigger,
    offset_minutes: timed ? form.offset_minutes : 0,
    action: form.action,
    message_template: form.message_template.trim(),
    is_active: form.is_active,
  };
}

/** Field-level validation mirroring the backend schema (name optional, 0-200). */
export function validateWorkflow(form: WorkflowForm): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = form.name.trim();
  // Name is REQUIRED: backend/routes/scheduling.js:1079 is
  // `Joi.string().trim().min(1).max(200).required()`. A previous comment here claimed the
  // server falls back to the action summary when it is blank — it does not, it 400s. Without
  // this check the user gets an opaque request failure instead of inline field validation.
  if (!name) errors.name = "Give this workflow a name.";
  else if (name.length > 200)
    errors.name = "Keep the name under 200 characters.";
  if (!TRIGGERS.some((t) => t.id === form.trigger))
    errors.trigger = "Pick a trigger.";
  if (!ACTIONS.some((a) => a.id === form.action))
    errors.action = "Pick an action.";
  if (triggerMeta(form.trigger).timed && form.offset_minutes < 0)
    errors.offset_minutes = "Offset can't be negative.";
  if (form.message_template.length > 5000)
    errors.message_template = "Message is too long (5000 character max).";
  return errors;
}
