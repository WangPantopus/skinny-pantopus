// W6 · D1 — Intake / booking details form. Mirrors Form.html: 44px inputs, 8px
// radius, section overlines, red * on required, inline validation (red border +
// alert-circle + message; green check when valid), italic helper text. Built
// dynamically from the host's intake questions when the public payload carries
// them (see confirmUtils — the live public read does not expose questions yet,
// so the base name/email/phone form is what renders today). Controlled by the
// parent ConfirmFlow, which owns the values + error map.

"use client";

import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Plus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import clsx from "clsx";
import {
  type AnswerValue,
  type IntakeValues,
  isValidEmail,
  type PublicIntakeQuestion,
  questionKey,
} from "./confirmUtils";

const MAX_GUESTS = 5;

function Overline({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-app-text-secondary">
      {children}
    </p>
  );
}

function FieldLabel({
  children,
  required,
  htmlFor,
}: {
  children: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-[11.5px] font-semibold text-app-text-strong"
    >
      {children}
      {required && <span className="ml-0.5 text-app-error">*</span>}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1 text-[11px] text-app-error">
      <AlertCircle className="h-[11px] w-[11px] shrink-0" aria-hidden />
      {message}
    </p>
  );
}

function inputClasses(
  state: "default" | "error" | "valid",
  disabled?: boolean,
): string {
  return clsx(
    "flex h-11 w-full items-center gap-2 rounded-lg border bg-app-surface px-3.5 text-[13.5px] text-app-text outline-none transition",
    "placeholder:text-app-text-muted",
    state === "error"
      ? "border-[1.5px] border-app-error focus-within:ring-2 focus-within:ring-app-error/15"
      : state === "valid"
        ? "border-[1.5px] border-app-success focus-within:ring-2 focus-within:ring-app-success/10"
        : "border-app-border focus-within:border-app-personal focus-within:ring-2 focus-within:ring-app-personal/15",
    disabled && "opacity-60",
  );
}

function TextField({
  id,
  label,
  required,
  value,
  onChange,
  placeholder,
  type = "text",
  leading,
  error,
  helper,
  valid,
  disabled,
}: {
  id: string;
  label?: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  leading?: string;
  error?: string;
  helper?: string;
  valid?: boolean;
  disabled?: boolean;
}) {
  const state = error ? "error" : valid ? "valid" : "default";
  return (
    <div>
      {label && (
        <FieldLabel htmlFor={id} required={required}>
          {label}
        </FieldLabel>
      )}
      <div className={inputClasses(state, disabled)}>
        {leading && (
          <span className="shrink-0 text-[13px] text-app-text-muted">
            {leading}
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-app-text-muted"
        />
        {state === "valid" && (
          <CheckCircle2
            className="h-[17px] w-[17px] shrink-0 text-app-success"
            aria-hidden
          />
        )}
        {state === "error" && (
          <AlertCircle
            className="h-[17px] w-[17px] shrink-0 text-app-error"
            aria-hidden
          />
        )}
      </div>
      <FieldError message={error} />
      {!error && helper && (
        <p className="mt-1.5 text-[11px] italic leading-4 text-app-text-secondary">
          {helper}
        </p>
      )}
    </div>
  );
}

function QuestionField({
  q,
  index,
  value,
  onChange,
  error,
}: {
  q: PublicIntakeQuestion;
  index: number;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue) => void;
  error?: string;
}) {
  const id = `q-${questionKey(q, index)}`;

  if (q.field_type === "textarea") {
    return (
      <div>
        <FieldLabel htmlFor={id} required={q.required}>
          {q.label}
        </FieldLabel>
        <textarea
          id={id}
          rows={3}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          className={clsx(
            "w-full rounded-lg border bg-app-surface px-3.5 py-2.5 text-[13.5px] leading-5 text-app-text outline-none transition placeholder:text-app-text-muted",
            error
              ? "border-[1.5px] border-app-error focus:ring-2 focus:ring-app-error/15"
              : "border-app-border focus:border-app-personal focus:ring-2 focus:ring-app-personal/15",
          )}
        />
        <FieldError message={error} />
      </div>
    );
  }

  if (q.field_type === "select") {
    return (
      <div>
        <FieldLabel htmlFor={id} required={q.required}>
          {q.label}
        </FieldLabel>
        <select
          id={id}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          className={clsx(
            "h-11 w-full rounded-lg border bg-app-surface px-3 text-[13.5px] text-app-text outline-none transition",
            error
              ? "border-[1.5px] border-app-error"
              : "border-app-border focus:border-app-personal focus:ring-2 focus:ring-app-personal/15",
          )}
        >
          <option value="">Select one</option>
          {(q.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <FieldError message={error} />
      </div>
    );
  }

  if (q.field_type === "multiselect") {
    const arr = Array.isArray(value) ? value : [];
    return (
      <div>
        <FieldLabel required={q.required}>{q.label}</FieldLabel>
        <div className="space-y-2">
          {(q.options ?? []).map((opt) => {
            const checked = arr.includes(opt);
            return (
              <label
                key={opt}
                className="flex items-center gap-2.5 rounded-lg border border-app-border bg-app-surface px-3 py-2.5 text-[13px] text-app-text"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...arr, opt]
                        : arr.filter((x) => x !== opt),
                    )
                  }
                  className="h-4 w-4 rounded border-app-border text-app-personal focus:ring-app-personal"
                />
                {opt}
              </label>
            );
          })}
        </div>
        <FieldError message={error} />
      </div>
    );
  }

  if (q.field_type === "checkbox") {
    return (
      <div>
        <label className="flex items-start gap-2.5 text-[13px] text-app-text">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-app-border text-app-personal focus:ring-app-personal"
          />
          <span>
            {q.label}
            {q.required && <span className="ml-0.5 text-app-error">*</span>}
          </span>
        </label>
        <FieldError message={error} />
      </div>
    );
  }

  // text + phone
  return (
    <TextField
      id={id}
      label={q.label}
      required={q.required}
      type={q.field_type === "phone" ? "tel" : "text"}
      leading={q.field_type === "phone" ? "+1" : undefined}
      value={typeof value === "string" ? value : ""}
      onChange={onChange}
      placeholder={q.field_type === "phone" ? "(555) 000-0000" : undefined}
      error={error}
    />
  );
}

interface IntakeFormProps {
  values: IntakeValues;
  errors: Record<string, string>;
  questions: PublicIntakeQuestion[];
  onPatch: (patch: Partial<IntakeValues>) => void;
  onAnswer: (key: string, value: AnswerValue) => void;
  disabled?: boolean;
  /** When true, replace editable name/email fields with a "Booking as" read-only chip. */
  isPrefilled?: boolean;
  /** Prefilled invitee name (shown in BookingAsChip). */
  prefilledName?: string;
  /** Prefilled invitee email (shown in BookingAsChip). */
  prefilledEmail?: string;
  /** When true, show the "You have an account. Open in app…" info banner below the email field. */
  hasExistingAccount?: boolean;
  /** Pillar accent for "Not you?" link and other accent-colored elements. */
  accentText?: string;
  onSwitchAccount?: () => void;
}

export default function IntakeForm({
  values,
  errors,
  questions,
  onPatch,
  onAnswer,
  disabled,
  isPrefilled = false,
  prefilledName,
  prefilledEmail,
  hasExistingAccount = false,
  accentText = "text-app-info",
  onSwitchAccount,
}: IntakeFormProps) {
  const guestsExpanded = values.guests.length > 0;

  const setGuest = (i: number, v: string) => {
    const next = [...values.guests];
    next[i] = v;
    onPatch({ guests: next });
  };
  const removeGuest = (i: number) => {
    onPatch({ guests: values.guests.filter((_, idx) => idx !== i) });
  };
  const addGuest = () => {
    if (values.guests.length >= MAX_GUESTS) return;
    onPatch({ guests: [...values.guests, ""] });
  };

  // "A few questions" section is always shown: phone (required) is the first field
  // there per design spec (intake-booking-frames.jsx:263-289 — HostQuestions
  // places phone first, then schema-driven questions). "Your info" has no phone.
  const hasQuestionSection = true;

  return (
    <div className="space-y-3.5">
      {/* Your info — either editable fields or prefilled "Booking as" chip */}
      <section>
        <Overline>Your info</Overline>
        {isPrefilled && prefilledName ? (
          // BookingAsChip — replaces editable fields when the user is signed in.
          // Mirrors intake-booking-frames.jsx:424-446.
          <div className="flex items-center gap-2.5 rounded-xl border border-app-border bg-app-surface px-3 py-2.5 shadow-sm">
            <span
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg,#a78bfa,#7c3aed)" }}
              aria-hidden
            >
              {prefilledName
                .split(" ")
                .map((p) => p[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-bold text-app-text">
                Booking as {prefilledName}
              </p>
              {prefilledEmail && (
                <p className="truncate text-[11px] text-app-text-secondary">
                  {prefilledEmail}
                </p>
              )}
            </div>
            {onSwitchAccount && (
              <button
                type="button"
                onClick={onSwitchAccount}
                className={clsx(
                  "shrink-0 text-[11px] font-bold",
                  accentText,
                )}
              >
                Not you?
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2.5">
              <div className="flex-1">
                <TextField
                  id="intake-first"
                  label="First name"
                  required
                  value={values.firstName}
                  onChange={(v) => onPatch({ firstName: v })}
                  placeholder="Maya"
                  error={errors.firstName}
                  valid={!errors.firstName && values.firstName.trim().length > 0}
                  disabled={disabled}
                />
              </div>
              <div className="flex-1">
                <TextField
                  id="intake-last"
                  label="Last name"
                  required
                  value={values.lastName}
                  onChange={(v) => onPatch({ lastName: v })}
                  placeholder="Chen"
                  error={errors.lastName}
                  valid={!errors.lastName && values.lastName.trim().length > 0}
                  disabled={disabled}
                />
              </div>
            </div>
            <TextField
              id="intake-email"
              label="Email"
              required
              type="email"
              value={values.email}
              onChange={(v) => onPatch({ email: v })}
              placeholder="you@email.com"
              error={errors.email}
              valid={!errors.email && isValidEmail(values.email)}
              helper="We'll only email you about this booking."
              disabled={disabled}
            />
            {/* Existing-account info banner (Frame 4) — shown when the email
                matches an existing Pantopus account, before the user signs in.
                Design: intake-booking-frames.jsx:354-368. */}
            {hasExistingAccount && (
              <div className="flex items-start gap-2.5 rounded-xl border border-app-info-light bg-app-info-bg px-3 py-2.5">
                <AlertCircle
                  className="mt-0.5 h-[15px] w-[15px] shrink-0 text-app-info"
                  aria-hidden
                />
                <p className="text-[11.5px] leading-4 text-app-text-strong">
                  You have an account.{" "}
                  <Link
                    href="/app"
                    className={clsx("font-bold underline decoration-app-info/40", accentText)}
                  >
                    Open in app
                  </Link>{" "}
                  to use your saved details.
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* A few questions — always shown; phone is the first field here per design */}
      {hasQuestionSection && (
        <section>
          <Overline>A few questions</Overline>
          <div className="space-y-3">
            {/* Phone number is the first question-section field per design
                (HostQuestions in intake-booking-frames.jsx:263-289). */}
            <TextField
              id="intake-phone"
              label="Phone number"
              required
              type="tel"
              leading="+1"
              value={values.phone}
              onChange={(v) => onPatch({ phone: v })}
              placeholder="(555) 000-0000"
              error={errors.phone}
              helper={
                !errors.phone
                  ? "For a text reminder before your booking."
                  : undefined
              }
              valid={!errors.phone && values.phone.trim().length > 0}
              disabled={disabled}
            />
            {questions.map((q, i) => {
              const key = questionKey(q, i);
              return (
                <QuestionField
                  key={key}
                  q={q}
                  index={i}
                  value={values.answers[key]}
                  onChange={(v) => onAnswer(key, v)}
                  error={errors[key]}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Add guests */}
      <section>
        {!guestsExpanded ? (
          <button
            type="button"
            onClick={addGuest}
            disabled={disabled}
            className="flex w-full items-center gap-2.5 rounded-lg border border-app-border bg-app-surface px-3.5 py-2.5 text-left shadow-sm hover:bg-app-hover disabled:opacity-60"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-app-personal-bg text-app-personal">
              <UserPlus className="h-[15px] w-[15px]" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-semibold text-app-text">
                Add guests
              </span>
              <span className="block text-[10.5px] text-app-text-secondary">
                Add up to {MAX_GUESTS} guests.
              </span>
            </span>
            <Plus
              className="h-[17px] w-[17px] shrink-0 text-app-personal"
              aria-hidden
            />
          </button>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5">
              <Users
                className="h-3.5 w-3.5 text-app-text-secondary"
                aria-hidden
              />
              <span className="text-xs font-semibold text-app-text">
                Guests
              </span>
            </div>
            {values.guests.map((g, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1">
                  <TextField
                    id={`guest-${i}`}
                    type="email"
                    value={g}
                    onChange={(v) => setGuest(i, v)}
                    placeholder="guest@email.com"
                    error={errors[`guest${i}`]}
                    disabled={disabled}
                  />
                </div>
                <button
                  type="button"
                  aria-label={`Remove guest ${i + 1}`}
                  onClick={() => removeGuest(i)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-app-border bg-app-surface text-app-text-secondary hover:bg-app-hover"
                >
                  <X className="h-[15px] w-[15px]" aria-hidden />
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={addGuest}
                disabled={values.guests.length >= MAX_GUESTS || disabled}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-app-personal disabled:opacity-40"
              >
                <Plus className="h-3 w-3" aria-hidden />
                Add another
              </button>
              <span className="text-[10.5px] text-app-text-muted">
                {values.guests.length} of {MAX_GUESTS}
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
