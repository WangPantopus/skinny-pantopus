"use client";

// Claim-your-link field with a debounced availability check
// (GET /booking-page/check-slug). Used by the first-run wizard (A2) and the
// Home/Business onboarding (A6). Surfaces available / checking / taken (+ up to
// three suggestion chips) / invalid-format states.

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowUpRight, Check, CircleAlert, Pencil } from "lucide-react";
import * as api from "@pantopus/api";
import { buildBookingPageUrl } from "@pantopus/utils";
import type { SchedulingOwnerRef } from "@pantopus/types";
import {
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";
import { SLUG_RE, sanitizeSlug } from "./slug";

export type SlugStatus =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "invalid";

export { sanitizeSlug } from "./slug";

const PREFIX = (() => {
  try {
    const sample = buildBookingPageUrl("__slug__");
    return sample.split("__slug__")[0].replace(/^https?:\/\//, "");
  } catch {
    return "/book/";
  }
})();

interface Props {
  owner: SchedulingOwnerRef;
  pillar: Pillar;
  value: string;
  onChange: (value: string) => void;
  onStatusChange?: (status: SlugStatus) => void;
  /** The owner's current slug — treated as available (it's already theirs). */
  ownedSlug?: string;
  label?: string;
  availableHint?: string;
}

export default function SlugClaimField({
  owner,
  pillar,
  value,
  onChange,
  onStatusChange,
  ownedSlug,
  label = "Your link",
  availableHint = "People will book you at this link.",
}: Props) {
  const tk = pillarTokens(pillar);
  const [status, setStatus] = useState<SlugStatus>("idle");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const reqId = useRef(0);

  useEffect(() => {
    onStatusChange?.(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    const slug = value.trim();
    if (!slug) {
      setStatus("idle");
      setSuggestions([]);
      return;
    }
    if (ownedSlug && slug === ownedSlug) {
      // The owner's current link — already theirs, so it's "available".
      setStatus("available");
      setSuggestions([]);
      return;
    }
    if (!SLUG_RE.test(slug)) {
      setStatus("invalid");
      setSuggestions([]);
      return;
    }
    setStatus("checking");
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const res = await api.scheduling.checkSlug(slug, owner);
        if (id !== reqId.current) return;
        if (res.available) {
          setStatus("available");
          setSuggestions([]);
        } else {
          setStatus("taken");
          setSuggestions(res.suggestions ?? []);
        }
      } catch {
        if (id !== reqId.current) return;
        setStatus("invalid");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [value, owner, ownedSlug]);

  const taken = status === "taken";
  const invalid = status === "invalid";

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-app-text-secondary">
        {label}
      </p>
      <div
        className={clsx(
          "flex items-center gap-0.5 rounded-lg border bg-app-surface px-3.5 py-3 font-mono text-sm focus-within:ring-2",
          taken || invalid ? "border-app-error-light" : "border-app-border",
          tk.ring,
        )}
      >
        <span className="text-app-text-secondary">{PREFIX}</span>
        <input
          value={value}
          onChange={(e) => onChange(sanitizeSlug(e.target.value))}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          className="min-w-0 flex-1 bg-transparent font-semibold text-app-text outline-none"
          placeholder="your-name"
          aria-label="Booking link handle"
        />
        {taken || invalid ? (
          <CircleAlert
            className="h-[15px] w-[15px] shrink-0 text-app-error"
            aria-hidden
          />
        ) : (
          <Pencil
            className="h-[15px] w-[15px] shrink-0 text-app-text-muted"
            aria-hidden
          />
        )}
      </div>

      {status === "available" && (
        <div className="mt-2.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-app-success-bg px-2.5 py-1 text-[11.5px] font-bold text-app-success">
            <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
            Available
          </span>
          <span className="text-[11.5px] text-app-text-secondary">
            {availableHint}
          </span>
        </div>
      )}

      {status === "checking" && (
        <div className="mt-2.5 flex items-center gap-2">
          <span className="h-[22px] w-[92px] animate-pulse rounded-full bg-app-surface-sunken" />
          <span className="h-3 w-36 animate-pulse rounded bg-app-surface-sunken" />
        </div>
      )}

      {invalid && (
        <p className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-app-error">
          <CircleAlert className="h-3.5 w-3.5" aria-hidden />
          Use 3–50 letters, numbers, or hyphens.
        </p>
      )}

      {taken && (
        <div className="mt-2.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-app-error">
            <CircleAlert className="h-3 w-3" aria-hidden />
            That link is taken
          </p>
          {suggestions.length > 0 && (
            <div className="mt-2.5">
              <p className="mb-1.5 text-[11px] text-app-text-secondary">
                Try one of these:
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onChange(sanitizeSlug(s))}
                    className={clsx(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-xs font-semibold",
                      tk.border,
                      tk.bgSoft,
                      tk.text,
                    )}
                  >
                    {s}
                    <ArrowUpRight className="h-3 w-3" aria-hidden />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
