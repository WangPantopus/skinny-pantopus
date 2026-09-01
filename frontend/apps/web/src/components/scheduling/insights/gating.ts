// W17 — Insights gating. The Team Performance report (H12) is business-only:
// the backend returns 400 { error:'BUSINESS_ONLY' } for non-business owners.
// We both hide the tab for non-business owners and degrade gracefully if the
// report is reached directly.

import type {
  SchedulingOwnerRef,
  DecodedSchedulingError,
} from "@pantopus/types";

export function isBusinessOwner(owner?: SchedulingOwnerRef | null): boolean {
  return owner?.ownerType === "business";
}

/** True when a decoded error is the team report's BUSINESS_ONLY gate (400). */
export function isBusinessOnly(decoded: DecodedSchedulingError): boolean {
  return (
    decoded.kind === "error" &&
    typeof decoded.code === "string" &&
    decoded.code.toUpperCase() === "BUSINESS_ONLY"
  );
}
