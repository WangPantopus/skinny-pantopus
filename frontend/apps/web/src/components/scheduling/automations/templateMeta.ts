// W16 · H5/H6/H7/H8 — Message-template metadata + pure helpers.
//
// Templates are { name, channel, subject?, body } with {{variable}} placeholders.
// `subject` is required for the email channel. The preview endpoint interpolates
// {{var}} tokens with a supplied `variables` map; H6 inserts tokens, H7 builds a
// sample map from the variables actually used in the body and renders the result.

import { Bell, Mail, MessageSquare, Smartphone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MessageChannel, MessageTemplate } from "@pantopus/types";

export interface ChannelMeta {
  id: MessageChannel;
  label: string;
  icon: LucideIcon;
  needsSubject: boolean;
  /** SMS is accepted by the API but not yet delivered — shown as "soon". */
  locked?: boolean;
}

export const CHANNELS: ChannelMeta[] = [
  { id: "email", label: "Email", icon: Mail, needsSubject: true },
  { id: "push", label: "Push", icon: Bell, needsSubject: false },
  { id: "in_app", label: "In-app", icon: MessageSquare, needsSubject: false },
  {
    id: "sms",
    label: "Text",
    icon: Smartphone,
    needsSubject: false,
    locked: true,
  },
];

export function channelMeta(id: MessageChannel): ChannelMeta {
  return CHANNELS.find((c) => c.id === id) ?? CHANNELS[0];
}

/** Variables offered by the H6 picker, each with a realistic preview sample. */
export interface VariableMeta {
  token: string;
  label: string;
  sample: string;
}

export const VARIABLES: VariableMeta[] = [
  { token: "invitee_name", label: "Invitee name", sample: "Alex Rivera" },
  { token: "host_name", label: "Host name", sample: "Jordan Lee" },
  { token: "event_name", label: "Event name", sample: "Intro Call" },
  { token: "event_date", label: "Date", sample: "Mon, Jun 22" },
  { token: "event_time", label: "Time", sample: "10:00 AM" },
  { token: "duration", label: "Duration", sample: "30 min" },
  { token: "location", label: "Location", sample: "Google Meet" },
  {
    token: "manage_link",
    label: "Manage link",
    sample: "pantopus.com/booking/9f2",
  },
];

const TOKEN_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

/** Unique {{variable}} names referenced in a body/subject, in order seen. */
export function extractVariables(...parts: string[]): string[] {
  const seen = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const m of part.matchAll(TOKEN_RE)) seen.add(m[1]);
  }
  return [...seen];
}

/** Build the sample `variables` map H7 sends to the preview endpoint. */
export function buildSampleVars(names: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of names) {
    const known = VARIABLES.find((v) => v.token === name);
    out[name] = known
      ? known.sample
      : name.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return out;
}

/**
 * Client-side mirror of the server interpolation, so H7 can preview instantly
 * (and offline) before the round-trip. Unknown tokens are left untouched.
 */
export function interpolate(
  text: string,
  vars: Record<string, string>,
): string {
  return text.replace(TOKEN_RE, (whole, name: string) =>
    name in vars ? vars[name] : whole,
  );
}

/** Insert a {{token}} into `body` at `caret` (end if out of range). */
export function insertToken(
  body: string,
  token: string,
  caret: number,
): string {
  const at =
    Number.isFinite(caret) && caret >= 0 && caret <= body.length
      ? caret
      : body.length;
  const placeholder = `{{${token}}}`;
  return body.slice(0, at) + placeholder + body.slice(at);
}

export interface TemplateForm {
  name: string;
  channel: MessageChannel;
  subject: string;
  body: string;
  is_active: boolean;
}

export function emptyTemplateForm(): TemplateForm {
  return {
    name: "",
    channel: "email",
    subject: "",
    body: "",
    is_active: true,
  };
}

export function templateToForm(t: MessageTemplate): TemplateForm {
  return {
    name: t.name,
    channel: t.channel,
    subject: t.subject ?? "",
    body: t.body,
    is_active: t.is_active,
  };
}

/** API input — only send a subject for channels that use one. Name falls back to channel label when blank. */
export function formToTemplateInput(form: TemplateForm) {
  const resolvedName =
    form.name.trim() || channelMeta(form.channel).label;
  return {
    name: resolvedName,
    channel: form.channel,
    subject: channelMeta(form.channel).needsSubject
      ? form.subject.trim()
      : undefined,
    body: form.body.trim(),
    is_active: form.is_active,
  };
}

/** Field-level validation mirroring templateSchema (subject required for email). */
export function validateTemplate(form: TemplateForm): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = form.name.trim();
  // Name is REQUIRED: backend/routes/scheduling.js:1123 is
  // `Joi.string().trim().min(1).max(200).required()`. The server does not fall back to the
  // channel label — it 400s — so accepting a blank name here turns an inline field error
  // into an opaque save failure.
  if (!name) errors.name = "Give this template a name.";
  else if (name.length > 200)
    errors.name = "Keep the name under 200 characters.";
  const body = form.body.trim();
  if (!body) errors.body = "Add a message body.";
  else if (body.length > 5000)
    errors.body = "Message is too long (5000 character max).";
  if (channelMeta(form.channel).needsSubject) {
    const subject = form.subject.trim();
    if (!subject) errors.subject = "Email needs a subject line.";
    else if (subject.length > 300)
      errors.subject = "Keep the subject under 300 characters.";
  }
  return errors;
}
