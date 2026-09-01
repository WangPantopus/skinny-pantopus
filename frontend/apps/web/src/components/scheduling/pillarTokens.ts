// Pillar → design-token mapping for Calendarly. Maps the scheduling owner
// pillar (personal / home / business) to the app's identity theme tokens so
// every stream themes consistently. Token classes are written as literal
// strings so Tailwind's JIT picks them up.

import type { SchedulingOwnerType } from "@pantopus/types";

export type Pillar = "personal" | "home" | "business";

/**
 * Fixed PRIMARY blue (#0284c7). Use for host-side OPERATIONAL action buttons —
 * Approve, the bookings-management primary dock, the inbox FAB — and for
 * functional chrome (sheet "Done", links). These stay blue regardless of the
 * owner's pillar. For invitee-facing accents that follow the booking owner's
 * pillar, use pillarTokens(...) / usePillarTokens() instead.
 */
export const PRIMARY_BLUE = "#0284c7";
export const PRIMARY_BLUE_CLS = {
  text: "text-app-info",
  bg: "bg-app-info",
  bgSoft: "bg-app-info-bg",
  border: "border-app-info",
  ring: "ring-app-info",
  textOn: "text-white",
} as const;

export function pillarForOwner(ownerType?: SchedulingOwnerType | null): Pillar {
  if (ownerType === "home") return "home";
  if (ownerType === "business") return "business";
  return "personal";
}

export interface PillarTokens {
  pillar: Pillar;
  /** Accent text, e.g. for the kicker/overline. */
  text: string;
  /** Solid accent background (selected day, primary CTA). */
  bg: string;
  /** Soft tinted background (selected pill, halo). */
  bgSoft: string;
  /** Accent border. */
  border: string;
  /** Focus / today ring. */
  ring: string;
  /** Text color to sit on the solid accent. */
  textOn: string;
  /** Raw accent hex (#0284c7 / #16a34a / #7c3aed) for inline styles / SVG. */
  hex: string;
}

const MAP: Record<Pillar, PillarTokens> = {
  personal: {
    pillar: "personal",
    text: "text-app-personal",
    bg: "bg-app-personal",
    bgSoft: "bg-app-personal-bg",
    border: "border-app-personal",
    ring: "ring-app-personal",
    textOn: "text-white",
    hex: "#0284c7",
  },
  home: {
    pillar: "home",
    text: "text-app-home",
    bg: "bg-app-home",
    bgSoft: "bg-app-home-bg",
    border: "border-app-home",
    ring: "ring-app-home",
    textOn: "text-white",
    hex: "#16a34a",
  },
  business: {
    pillar: "business",
    text: "text-app-business",
    bg: "bg-app-business",
    bgSoft: "bg-app-business-bg",
    border: "border-app-business",
    ring: "ring-app-business",
    textOn: "text-white",
    hex: "#7c3aed",
  },
};

export function pillarTokens(
  owner?: SchedulingOwnerType | Pillar | null,
): PillarTokens {
  if (owner === "personal" || owner === "home" || owner === "business") {
    return MAP[owner];
  }
  return MAP[pillarForOwner(owner ?? undefined)];
}
