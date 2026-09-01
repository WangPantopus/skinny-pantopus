// W18 · H15 — reminder-channel reachability logic. Pure + SSR-safe so it
// unit-tests without a DOM and drives both the channels page and the prompt.
//
// On web, PUSH is real (the browser Notification permission API). EMAIL is the
// always-on baseline (the account address). SMS and external channel-connect
// are deferred server-side (POST /connected-calendars/connect → 501), so they
// surface a first-class "coming soon" — never a dead end. Status is always
// conveyed as TEXT (statusLabel), never by color alone (H14 contract).

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export type ChannelId = "push" | "email" | "sms";

export type ChannelStatus = "on" | "off" | "blocked" | "soon" | "unsupported";

export interface ChannelView {
  id: ChannelId;
  name: string;
  /** Letter shown in the legend chip (P · E · S). */
  letter: "P" | "E" | "S";
  status: ChannelStatus;
  /** Status word for the pill — also the accessible status text. */
  statusLabel: string;
  detail: string;
  /** Action button label, or null when there's no action. */
  actionLabel: string | null;
}

/** Which prompt frame opens for a channel's action. */
export type PromptMode = "push" | "email" | "sms" | "connected" | "denied";

const STATUS_WORD: Record<ChannelStatus, string> = {
  on: "On",
  off: "Not set up",
  blocked: "Blocked",
  soon: "Coming soon",
  unsupported: "Not supported",
};

export function statusWord(status: ChannelStatus): string {
  return STATUS_WORD[status];
}

/** Read the browser push permission. SSR-safe and unsupported-safe. */
export function readPushPermission(): PushPermission {
  if (typeof window === "undefined") return "unsupported";
  if (typeof window.Notification === "undefined") return "unsupported";
  const p = window.Notification.permission;
  return p === "granted" || p === "denied" ? p : "default";
}

export function pushStatus(perm: PushPermission): ChannelStatus {
  if (perm === "granted") return "on";
  if (perm === "denied") return "blocked";
  if (perm === "unsupported") return "unsupported";
  return "off";
}

/** Which prompt frame the Push row's action should open. */
export function pushPromptMode(perm: PushPermission): PromptMode {
  if (perm === "granted") return "connected";
  if (perm === "denied") return "denied";
  return "push";
}

/** Map a resolved push permission to the prompt's post-request frame. */
export function pushResultMode(perm: PushPermission): PromptMode {
  return perm === "granted" ? "connected" : "denied";
}

/** Build the three reminder-channel rows from the live push permission. */
export function buildChannelViews(
  perm: PushPermission,
  accountEmail?: string | null,
): ChannelView[] {
  const push = pushStatus(perm);
  return [
    {
      id: "push",
      name: "Push (this browser)",
      letter: "P",
      status: push,
      statusLabel: statusWord(push),
      detail:
        push === "on"
          ? "Booking reminders can reach this device."
          : push === "blocked"
            ? "Notifications are turned off in your browser settings."
            : push === "unsupported"
              ? "This browser can't show push notifications."
              : "Turn on to get booking reminders right here.",
      actionLabel:
        push === "on"
          ? "Manage"
          : push === "blocked"
            ? "How to enable"
            : push === "unsupported"
              ? null
              : "Turn on",
    },
    {
      id: "email",
      name: "Email",
      letter: "E",
      status: "on",
      statusLabel: statusWord("on"),
      detail: accountEmail
        ? `Reminders go to ${accountEmail}.`
        : "Confirmations and reminders go to your account email.",
      actionLabel: "Use another email",
    },
    {
      id: "sms",
      name: "SMS",
      letter: "S",
      status: "soon",
      statusLabel: statusWord("soon"),
      detail: "Text reminders aren't available yet.",
      actionLabel: "Preview",
    },
  ];
}

// ── Verify-field validation (used by the connect prompt) ──────────────

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidPhone(value: string): boolean {
  const d = digitsOnly(value);
  return d.length >= 10 && d.length <= 15;
}

export function isCompleteCode(code: string, length = 6): boolean {
  return new RegExp(`^\\d{${length}}$`).test(code);
}
