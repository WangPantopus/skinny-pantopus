"use client";

// W18 · H15 — Notification / Reminder Permission & Channel Connect Prompt.
//
// The just-in-time sheet that makes sure a reminder is never configured against
// a dead channel. Five frames, mirroring the A18 status-screen layout (centered
// tinted icon, headline, muted explainer, CTA) inside an accessible dialog:
//   push       — request browser notification permission (REAL on web)
//   email/sms  — verify a destination (deferred backend → "coming soon")
//   connected  — success confirmation (after push granted)
//   denied      — push blocked → how to re-enable; email still works
//
// Accessibility is exemplary on purpose (this is the W18 polish stream's
// reference implementation): role="dialog" + aria-modal, labelled/described,
// focus trap, return-focus, Escape-to-close, scroll lock, reduced-motion,
// and code boxes that are real labelled inputs reachable with assistive tech.

import { useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";
import {
  BellOff,
  BellRing,
  CheckCheck,
  Info,
  Mail,
  MessageSquare,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "@/components/ui/toast-store";
import {
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";
import {
  digitsOnly,
  isCompleteCode,
  isValidEmail,
  isValidPhone,
  type PromptMode,
  type PushPermission,
} from "./channelState";
import {
  focusRing,
  useFocusTrap,
  useReducedMotion,
  useReturnFocus,
} from "./a11y";

const CODE_LENGTH = 6;

interface ChannelConnectPromptProps {
  open: boolean;
  /** Which frame to open on. */
  mode: PromptMode;
  pillar: Pillar;
  accountEmail?: string | null;
  onClose: () => void;
  /** Fires when the browser push permission resolves, so the page can refresh. */
  onPushResult?: (perm: PushPermission) => void;
}

export default function ChannelConnectPrompt({
  open,
  mode,
  pillar,
  accountEmail,
  onClose,
  onPushResult,
}: ChannelConnectPromptProps) {
  const tk = pillarTokens(pillar);
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  const [frame, setFrame] = useState<PromptMode>(mode);
  const [busy, setBusy] = useState(false);

  // Re-seed the frame each time the sheet opens (or the caller changes mode).
  useEffect(() => {
    if (open) {
      setFrame(mode);
      setBusy(false);
    }
  }, [open, mode]);

  useReturnFocus(open);
  useFocusTrap(dialogRef, open);

  // Escape to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  const handleAllowPush = async () => {
    if (
      typeof window === "undefined" ||
      typeof window.Notification === "undefined"
    ) {
      toast.info("This browser doesn't support push notifications.");
      return;
    }
    setBusy(true);
    try {
      const result = await window.Notification.requestPermission();
      const perm: PushPermission =
        result === "granted"
          ? "granted"
          : result === "denied"
            ? "denied"
            : "default";
      onPushResult?.(perm);
      if (perm === "granted") setFrame("connected");
      else if (perm === "denied") setFrame("denied");
      else toast.info("No changes made — you can turn push on anytime.");
    } finally {
      setBusy(false);
    }
  };

  const comingSoon = (label: string) =>
    toast.info(
      `${label} verification is coming soon — reminders use your account email for now.`,
    );

  const content = (() => {
    switch (frame) {
      case "connected":
        return (
          <StatusFrame
            icon={CheckCheck}
            iconBg="bg-app-success-bg"
            iconFg="text-app-success"
            titleId={titleId}
            descId={descId}
            title="Push reminders are on"
            body="Reminders can reach this device. You can change this anytime in your browser settings."
          >
            <PrimaryButton pillar={pillar} onClick={onClose}>
              Done
            </PrimaryButton>
          </StatusFrame>
        );

      case "denied":
        return (
          <StatusFrame
            icon={BellOff}
            iconBg="bg-app-warning-bg"
            iconFg="text-app-warning"
            titleId={titleId}
            descId={descId}
            title="Push is turned off"
            body="Reminders can't reach this device until you turn notifications back on in your browser settings. Email still works."
          >
            <EnableHelp />
            <div className="mt-3 flex flex-col gap-2">
              <PrimaryButton
                pillar={pillar}
                onClick={() => {
                  // Web doesn't have a direct OS settings link like mobile; open
                  // the browser's site-settings page for this origin instead.
                  // This mirrors iOS/Android "Open Settings" primary CTA intent.
                  const url = `chrome://settings/content/notifications?search=${encodeURIComponent(window.location.origin)}`;
                  try {
                    window.open(url, "_blank", "noopener");
                  } catch {
                    // Fallback: browsers block chrome:// URLs from JS; guide via
                    // the disclosure panel which is always shown above.
                  }
                }}
              >
                Open browser settings
              </PrimaryButton>
              <SecondaryButton pillar={pillar} onClick={onClose}>
                Keep email only
              </SecondaryButton>
            </div>
          </StatusFrame>
        );

      case "email":
        return (
          <VerifyFrame
            icon={Mail}
            pillar={pillar}
            titleId={titleId}
            descId={descId}
            title="Confirm your email"
            channel="Email"
            destination={accountEmail ?? undefined}
            destinationKind="email"
            busy={busy}
            onSubmit={() => comingSoon("Email")}
          />
        );

      case "sms":
        return (
          <VerifyFrame
            icon={MessageSquare}
            pillar={pillar}
            titleId={titleId}
            descId={descId}
            title="Add a phone number"
            channel="SMS"
            destinationKind="phone"
            caption="Carrier rates may apply."
            busy={busy}
            onSubmit={() => comingSoon("SMS")}
          />
        );

      case "push":
      default:
        return (
          <StatusFrame
            icon={BellRing}
            iconBg={tk.bgSoft}
            iconFg={tk.text}
            titleId={titleId}
            descId={descId}
            title="Turn on push reminders"
            body="Pantopus needs permission to send reminders to this device. You can change this anytime in your browser settings."
          >
            <div className="flex flex-col gap-2">
              <PrimaryButton
                pillar={pillar}
                onClick={handleAllowPush}
                disabled={busy}
              >
                {busy ? "Waiting for your browser…" : "Allow notifications"}
              </PrimaryButton>
              <SecondaryButton
                pillar={pillar}
                onClick={() => setFrame("email")}
              >
                Use email instead
              </SecondaryButton>
            </div>
          </StatusFrame>
        );
    }
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={() => {
          if (!busy) onClose();
        }}
        aria-hidden
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={clsx(
          "relative w-full max-w-sm overflow-hidden rounded-t-2xl border border-app-border-subtle bg-app-surface shadow-2xl sm:rounded-2xl",
          !reducedMotion && "motion-safe:animate-in motion-safe:fade-in",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => {
            if (!busy) onClose();
          }}
          disabled={busy}
          aria-label="Close"
          className={clsx(
            "absolute right-3 top-3 z-10 rounded-lg p-1.5 text-app-text-muted transition hover:bg-app-hover hover:text-app-text disabled:opacity-50",
            focusRing(pillar),
          )}
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
        <div className="px-6 pb-7 pt-9">{content}</div>
      </div>
    </div>
  );
}

// ── Frame building blocks ─────────────────────────────────────────────

function StatusFrame({
  icon: Icon,
  iconBg,
  iconFg,
  titleId,
  descId,
  title,
  body,
  children,
}: {
  icon: LucideIcon;
  iconBg: string;
  iconFg: string;
  titleId: string;
  descId: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-center">
      <span
        className={clsx(
          "mx-auto mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-full",
          iconBg,
        )}
      >
        <Icon className={clsx("h-9 w-9", iconFg)} strokeWidth={2} aria-hidden />
      </span>
      <h2 id={titleId} className="text-lg font-bold text-app-text-strong">
        {title}
      </h2>
      <p
        id={descId}
        className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-app-text-secondary"
      >
        {body}
      </p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function VerifyFrame({
  icon: Icon,
  pillar,
  titleId,
  descId,
  title,
  channel,
  destination,
  destinationKind,
  caption,
  busy,
  onSubmit,
}: {
  icon: LucideIcon;
  pillar: Pillar;
  titleId: string;
  descId: string;
  title: string;
  channel: string;
  destination?: string;
  destinationKind: "email" | "phone";
  caption?: string;
  busy: boolean;
  onSubmit: () => void;
}) {
  const tk = pillarTokens(pillar);
  const [dest, setDest] = useState(destination ?? "");
  const [code, setCode] = useState("");
  const fieldId = useId();

  const destValid =
    destinationKind === "email" ? isValidEmail(dest) : isValidPhone(dest);
  const canSubmit = destValid && isCompleteCode(code, CODE_LENGTH) && !busy;

  return (
    <div className="text-center">
      <span
        className={clsx(
          "mx-auto mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-full",
          tk.bgSoft,
        )}
      >
        <Icon
          className={clsx("h-9 w-9", tk.text)}
          strokeWidth={2}
          aria-hidden
        />
      </span>
      <h2 id={titleId} className="text-lg font-bold text-app-text-strong">
        {title}
      </h2>
      <p
        id={descId}
        className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-app-text-secondary"
      >
        Enter your {destinationKind === "email" ? "email" : "number"} and the
        6-digit code we&apos;d send to confirm it.
      </p>

      <div
        role="note"
        className="mx-auto mt-4 flex max-w-xs items-start gap-2 rounded-lg bg-app-info-bg px-3 py-2 text-left text-xs text-app-info"
      >
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          {channel} verification is coming soon. For now, reminders use your
          account email.
        </span>
      </div>

      <div className="mt-4 text-left">
        <label
          htmlFor={fieldId}
          className="mb-1 block text-xs font-semibold text-app-text-strong"
        >
          {destinationKind === "email" ? "Email address" : "Phone number"}
        </label>
        <div className="flex items-center rounded-lg border border-app-border bg-app-surface focus-within:border-app-text">
          {destinationKind === "phone" && (
            <span className="pl-3 pr-1 text-sm text-app-text-muted">+1</span>
          )}
          <input
            id={fieldId}
            type={destinationKind === "email" ? "email" : "tel"}
            inputMode={destinationKind === "email" ? "email" : "tel"}
            autoComplete={destinationKind === "email" ? "email" : "tel"}
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            placeholder={
              destinationKind === "email" ? "you@example.com" : "555 123 4567"
            }
            className={clsx(
              "w-full bg-transparent px-3 py-2.5 text-sm text-app-text placeholder:text-app-text-muted",
              "focus:outline-none",
              destinationKind === "phone" && "pl-1",
            )}
          />
        </div>
      </div>

      <fieldset className="mt-4 text-left">
        <legend className="mb-1 text-xs font-semibold text-app-text-strong">
          6-digit code
        </legend>
        <CodeBoxes value={code} onChange={setCode} pillar={pillar} />
        <button
          type="button"
          className={clsx(
            "mt-2 rounded text-xs font-semibold text-app-text-secondary hover:underline",
            focusRing(pillar),
          )}
          onClick={() => toast.info(`${channel} verification is coming soon.`)}
        >
          Resend code
        </button>
      </fieldset>

      {caption && (
        <p className="mt-3 text-center text-[11px] text-app-text-muted">
          {caption}
        </p>
      )}

      <div className="mt-5">
        <PrimaryButton pillar={pillar} onClick={onSubmit} disabled={!canSubmit}>
          Verify
        </PrimaryButton>
      </div>
    </div>
  );
}

/** Six single-character code inputs with auto-advance, backspace + paste. */
function CodeBoxes({
  value,
  onChange,
  pillar,
}: {
  value: string;
  onChange: (next: string) => void;
  pillar: Pillar;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const setAt = (index: number, char: string) => {
    const chars = value.split("");
    chars[index] = char;
    onChange(chars.join("").slice(0, CODE_LENGTH));
  };

  return (
    <div className="flex gap-2">
      {Array.from({ length: CODE_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={1}
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1} of ${CODE_LENGTH}`}
          value={value[i] ?? ""}
          onChange={(e) => {
            const digit = digitsOnly(e.target.value).slice(-1);
            if (!digit) {
              setAt(i, "");
              return;
            }
            setAt(i, digit);
            refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && i > 0) {
              refs.current[i - 1]?.focus();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = digitsOnly(e.clipboardData.getData("text")).slice(
              0,
              CODE_LENGTH,
            );
            if (pasted) {
              onChange(pasted);
              refs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
            }
          }}
          className={clsx(
            "h-11 w-full rounded-lg border border-app-border bg-app-surface text-center text-base font-semibold text-app-text",
            "focus:border-app-text focus:outline-none",
            focusRing(pillar),
          )}
        />
      ))}
    </div>
  );
}

function EnableHelp() {
  return (
    <details className="mx-auto mt-2 max-w-xs rounded-lg border border-app-border bg-app-surface-sunken px-3 py-2 text-left text-xs text-app-text-secondary">
      <summary className="cursor-pointer font-semibold text-app-text-strong">
        How to turn push back on
      </summary>
      <ol className="mt-2 list-decimal space-y-1 pl-4">
        <li>Click the lock icon in your browser&apos;s address bar.</li>
        <li>Find “Notifications” and set it to Allow.</li>
        <li>Reload this page.</li>
      </ol>
    </details>
  );
}

function PrimaryButton({
  pillar,
  onClick,
  disabled,
  children,
}: {
  pillar: Pillar;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const tk = pillarTokens(pillar);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "w-full rounded-lg px-4 py-2.5 text-sm font-bold transition disabled:opacity-50",
        tk.bg,
        tk.textOn,
        focusRing(pillar),
      )}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  pillar,
  onClick,
  children,
}: {
  pillar: Pillar;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "w-full rounded-lg border border-app-border bg-app-surface px-4 py-2.5 text-sm font-semibold text-app-text transition hover:bg-app-hover",
        focusRing(pillar),
      )}
    >
      {children}
    </button>
  );
}
