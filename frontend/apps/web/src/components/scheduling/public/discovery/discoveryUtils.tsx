// W5 Invitee discovery — shared presentational helpers for the public booking
// landing (C5) and slot picker (C6). Pillar gradient classes are written as
// literal strings so Tailwind's JIT picks them up. Colors/spacing come from the
// shared design tokens only (no hardcoded hex).

import {
  Video,
  Phone,
  MapPin,
  Globe,
  MessageCircleQuestion,
  type LucideIcon,
} from "lucide-react";
import type { EventTypeLocationMode } from "@pantopus/types";
import type { Pillar } from "@/components/scheduling";

/** Pillar → banner gradient (light tint → saturated accent), token-based. */
export const PILLAR_BANNER: Record<Pillar, string> = {
  personal: "bg-gradient-to-br from-app-personal-bg to-app-personal",
  home: "bg-gradient-to-br from-app-home-bg to-app-home",
  business: "bg-gradient-to-br from-app-business-bg to-app-business",
};

/** Pillar → solid avatar background, token-based. */
export const PILLAR_AVATAR: Record<Pillar, string> = {
  personal: "bg-app-personal",
  home: "bg-app-home",
  business: "bg-app-business",
};

export function locationIcon(mode: EventTypeLocationMode): LucideIcon {
  switch (mode) {
    case "video":
      return Video;
    case "phone":
      return Phone;
    case "in_person":
      return MapPin;
    case "ask":
      return MessageCircleQuestion;
    case "custom":
    default:
      return Globe;
  }
}

export function locationLabel(
  mode: EventTypeLocationMode,
  detail: string | null,
): string {
  switch (mode) {
    case "video":
      return "Video call";
    case "phone":
      return "Phone";
    case "in_person":
      return detail?.trim() || "In person";
    case "ask":
      return "They'll ask you";
    case "custom":
    default:
      return detail?.trim() || "Details to follow";
  }
}

/** "30 min" · "1 hr" · "1 hr 30 min". */
export function durationLabel(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return "";
  if (min < 60) return `${min} min`;
  const hrs = Math.floor(min / 60);
  const rem = min % 60;
  const hrLabel = `${hrs} hr`;
  return rem === 0 ? hrLabel : `${hrLabel} ${rem} min`;
}

export function initialsFromName(value: string | null | undefined): string {
  const parts = String(value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Display name for the host from the public page payload. */
export function hostNameFrom(
  title: string | null | undefined,
  fallback = "this host",
): string {
  const t = String(title ?? "").trim();
  return t || fallback;
}
