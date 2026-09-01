"use client";

// W18 · Cross-cutting & polish — the scheduling a11y primitives.
//
// W18 owns these shared accessibility helpers (the doc's "components/scheduling
// a11y tokens that W18 owns"). They are additive and framework-light so every
// scheduling surface can adopt them without restyling:
//   • focusRing(pillar) — the WCAG-visible keyboard focus ring. Uses
//     `focus-visible` only, so mouse users see NO change — purely additive.
//   • MIN_TARGET — the 44×44 minimum touch/click target (H14 contract).
//   • SR_ONLY — visually-hidden-but-announced text.
//   • useReducedMotion / useFocusTrap / useReturnFocus — the dialog a11y trio
//     the ChannelConnectPrompt (and any sheet) needs to be keyboard-complete.
//
// See ./A11Y_AUDIT.md for the full contract and where each is applied.

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Pillar } from "@/components/scheduling/pillarTokens";

/** Pillar-tinted keyboard focus ring (focus-visible → no change for mouse). */
const RING: Record<Pillar, string> = {
  personal: "focus-visible:ring-app-personal",
  home: "focus-visible:ring-app-home",
  business: "focus-visible:ring-app-business",
};

/**
 * The standard scheduling focus ring: 2px pillar ring + 2px offset, shown only
 * on keyboard focus. Apply to any interactive element that doesn't already have
 * a visible focus treatment.
 */
export function focusRing(pillar: Pillar = "personal"): string {
  return [
    "focus:outline-none focus-visible:outline-none",
    "focus-visible:ring-2 focus-visible:ring-offset-2",
    "focus-visible:ring-offset-app-surface",
    RING[pillar],
  ].join(" ");
}

/** WCAG 2.5.5 / large-text minimum target size. */
export const MIN_TARGET = "min-h-[44px] min-w-[44px]";

/** Visually hidden, still announced by assistive tech (Tailwind's sr-only). */
export const SR_ONLY = "sr-only";

/** True when the user has asked for reduced motion. SSR-safe (false on server). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** Restore focus to the element that was focused before `active` turned true. */
export function useReturnFocus(active: boolean): void {
  const previous = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!active) return;
    previous.current =
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null;
    return () => {
      previous.current?.focus?.();
    };
  }, [active]);
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Trap Tab focus inside `ref` while `active`. Focuses the first focusable on
 * open and wraps Tab / Shift+Tab at the edges — the keyboard half of a modal.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    const visible = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    // Move focus inside on open (unless it's already there).
    if (!node.contains(document.activeElement)) visible()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const els = visible();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      const activeEl = document.activeElement;
      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };

    node.addEventListener("keydown", onKeyDown);
    return () => node.removeEventListener("keydown", onKeyDown);
  }, [ref, active]);
}
