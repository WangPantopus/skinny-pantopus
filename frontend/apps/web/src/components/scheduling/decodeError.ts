// Typed decoder for the scheduling error envelope. The shared axios client
// rejects with `{ message, code, statusCode, data, validationErrors,
// validationDetails }` (see packages/api/src/client.ts), where `data` is the
// raw backend body. This collapses that into a discriminated union the
// streams can switch on:
//   { error, message } | 400 { error:'Validation failed', details } |
//   409 SlotConflict | first-class page states | 501 connect.

import type {
  DecodedSchedulingError,
  SlotConflict,
  SlotConflictCode,
  ValidationDetail,
  BookingSlot,
} from "@pantopus/types";

const CONFLICT_CODES: SlotConflictCode[] = [
  "SLOT_TAKEN",
  "SLOT_UNAVAILABLE",
  "SLOT_FULL",
];

function isConflictCode(code: unknown): code is SlotConflictCode {
  return (
    typeof code === "string" && (CONFLICT_CODES as string[]).includes(code)
  );
}

export function decodeError(err: unknown): DecodedSchedulingError {
  const e = (err ?? {}) as Record<string, any>;
  // Raw backend body lives on `.data` (axios interceptor) or `.response.data`.
  const data: Record<string, any> = e.data ?? e.response?.data ?? e;
  const code: string | null =
    (typeof data?.error === "string" ? data.error : null) ??
    (typeof e.code === "string" ? e.code : null);
  const status: number | undefined =
    e.statusCode ?? e.status ?? data?.statusCode;
  const message: string =
    (typeof data?.message === "string" && data.message) ||
    (typeof e.message === "string" && e.message) ||
    "Something went wrong. Please try again.";

  // 409 slot conflict — never a dead end (surface alternatives).
  if (isConflictCode(code)) {
    const alternatives: BookingSlot[] = Array.isArray(data?.alternatives)
      ? data.alternatives
      : [];
    const conflict: SlotConflict = { error: code, message, alternatives };
    return { kind: "conflict", message, conflict };
  }

  // 400 validation.
  if (
    code === "Validation failed" ||
    (status === 400 && Array.isArray(data?.details))
  ) {
    const raw: any[] = Array.isArray(data?.details)
      ? data.details
      : Array.isArray(e.validationDetails)
        ? e.validationDetails
        : [];
    const details: ValidationDetail[] = raw.map((d) =>
      typeof d === "string"
        ? { field: "", message: d }
        : {
            field: d?.field ?? "",
            message: d?.message ?? String(d),
            code: d?.code,
          },
    );
    return {
      kind: "validation",
      details,
      message: details[0]?.message ?? message,
    };
  }

  // First-class page/link states (response states, not errors).
  if (code === "PAGE_PAUSED" || data?.status === "paused")
    return { kind: "paused", message };
  if (data?.status === "secret" || code === "SECRET")
    return { kind: "error", code, message };
  if (data?.status === "expired" || code === "EXPIRED" || status === 410) {
    return { kind: "expired", message };
  }

  // 501 connect ("coming soon").
  if (
    code === "NOT_AVAILABLE" ||
    code === "NOT_IMPLEMENTED" ||
    status === 501
  ) {
    return { kind: "not_implemented", message };
  }

  if (data?.status === "unavailable") return { kind: "unavailable", message };
  if (status === 404 || code === "NOT_FOUND")
    return { kind: "not_found", message };

  return { kind: "error", code, message };
}

/** Convenience: map validation details to a `{ field: message }` lookup for form errors. */
export function fieldErrors(
  decoded: DecodedSchedulingError,
): Record<string, string> {
  if (decoded.kind !== "validation") return {};
  const out: Record<string, string> = {};
  for (const d of decoded.details) {
    if (d.field) out[d.field] = d.message;
  }
  return out;
}

/** Convenience: the SlotConflict if this error is a 409, else null. */
export function asSlotConflict(
  decoded: DecodedSchedulingError,
): SlotConflict | null {
  return decoded.kind === "conflict" ? decoded.conflict : null;
}
