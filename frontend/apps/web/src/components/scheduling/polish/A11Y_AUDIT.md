# Calendarly Web — Accessibility & Large-Text Audit (H14)

**Stream:** W18 · Cross-cutting & polish · `claude/calendarly-web-w18-cross-cutting-polish`
**Screen:** H14 — Accessibility & Large-Text pass (MVP, cross-cutting)
**Scope rule (from the W18 brief):** _"apply fixes only to W0/W18-owned shared
components … and FILE per-stream a11y gaps back to those streams. Do NOT edit
another stream's files while its PR is open."_

H14 is a **cross-cutting audit**, not a route. It is meant to run _last_, after
W1–W17 merge, as a sweep on a quiet tree. At the time of this PR the integration
branch `feature/calendarly-web` has **W0 + W1–W11** merged; **W12–W17 are not yet
built**. Therefore this PR:

1. Ships the **W18-owned a11y primitives** (`a11y.ts`) every scheduling surface
   can adopt without restyling.
2. Makes the **H15 channel surfaces** the reference implementation of the
   contract (dialog semantics, focus trap, labelled code inputs, reduced-motion,
   status-as-text).
3. Applies **safe, additive** a11y fixes (ARIA / labels / focus only — **zero
   visual change**) to the two W0 shared components H14 explicitly names
   (`SlotPicker`, `SlotConflictAlternatives`).
4. **Files** every remaining gap below — both the W0 items that need a _visual_
   change (44px targets, grid→list reflow, contrast) and the per-feature-stream
   items — to be applied in the final sweep once their trees are quiet.

---

## 1. The contract (what "accessible" means for every scheduling screen)

Derived from the H14 design prompt + WCAG 2.2 AA.

| #   | Requirement             | Rule                                                                                                                            |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Targets**             | Every interactive control ≥ **44×44px** (use `MIN_TARGET`).                                                                     |
| C2  | **Full labels**         | Slot/day buttons announce date **and** time **and** state — "Tue, Jun 16, 3:00 PM, available". Never time alone.                |
| C3  | **Focus ring**          | Visible keyboard focus on every control: 2px pillar ring, 2px offset (`focusRing(pillar)`), `focus-visible` only.               |
| C4  | **Never color-alone**   | Availability, timezone, conflict, status conveyed by **text/icon**, not hue.                                                    |
| C5  | **Timezone affordance** | The viewer tz is stated in text ("Times shown in …"); a mismatch is text, not color.                                            |
| C6  | **Conflict announced**  | The 409 "slot taken" presenter is a live region (`role="alert"`).                                                               |
| C7  | **Reduce-motion**       | Confetti/entrance animations suppressed under `prefers-reduced-motion` (`useReducedMotion`); a calm static state replaces them. |
| C8  | **Large-text reflow**   | At XXL text the dense slot grid collapses to a single-column stacked list; day numbers never truncate.                          |
| C9  | **Dialogs/sheets**      | `role="dialog"` + `aria-modal`, labelled + described, focus trap, return-focus, Escape, scroll-lock.                            |
| C10 | **Inputs labelled**     | Every field (incl. one-time-code boxes) has a programmatic label reachable with assistive tech.                                 |

## 2. W18-owned primitives (`components/scheduling/polish/a11y.ts`)

Adopt these instead of hand-rolling — they encode C1/C3/C7/C9.

- `focusRing(pillar)` — C3 keyboard ring (additive; no mouse change).
- `MIN_TARGET` — C1 (`min-h-[44px] min-w-[44px]`).
- `SR_ONLY` — visually-hidden, announced text.
- `useReducedMotion()` — C7.
- `useFocusTrap(ref, active)` / `useReturnFocus(active)` — C9 (the keyboard half
  of any modal/sheet).

**Reference implementation:** `ChannelConnectPrompt.tsx` — full C9 dialog (trap,
return-focus, Escape, scroll-lock), C10 labelled one-time-code boxes
(`aria-label="Digit N of 6"`, `inputMode="numeric"`, `autoComplete="one-time-code"`,
paste/backspace), C4 status-as-text, C7 reduced-motion entrance.

## 3. W0 shared components — findings

✅ compliant · 🔧 fixed in this PR (additive) · 📌 filed (needs a visual change → sweep)

| Component                                                                   | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SlotPicker`                                                                | 🔧 + 📌 | **Fixed:** slot buttons now carry full `aria-label` (C2) + focus ring (C3); day cells get a human date + availability label (C2/C4) + focus ring; Morning/Afternoon become `role="group"`; the tz chip gets `aria-haspopup="dialog"`/`aria-expanded` + label (C5). **📌 Filed:** day/slot tiles are ~40px (`py-2.5`/`h-10`) → bump to `MIN_TARGET` (C1); add a `≥XXL`/container-query single-column reflow for the slot grid (C8). Both are visual → defer to the sweep. |
| `SlotConflictAlternatives`                                                  | 🔧      | **Fixed:** the conflict header is now `role="alert"` so it's announced (C6); each alternative button has an explicit "Book {time}, {date}" `aria-label` (C2) + focus ring (C3).                                                                                                                                                                                                                                                                                          |
| `TimezoneSelector`                                                          | ✅      | Search input is labelled; rows use `aria-pressed` (selection not color-alone, C4/C10); offset+local time are text (C5). 📌 minor: the focus ring is hardcoded `app-personal` rather than pillar-tinted — cosmetic, filed.                                                                                                                                                                                                                                                |
| `BookingStatusPill`                                                         | ✅      | Status is a text label; the dot is `aria-hidden` → not color-alone (C4).                                                                                                                                                                                                                                                                                                                                                                                                 |
| `states/TerminalState` (+ Paused/Secret/Expired/Unavailable/NoAvailability) | ✅      | Semantic `main` + `h1`; icon `aria-hidden`; announced on navigation. 📌 optional: add `role="status"` for SPA transitions.                                                                                                                                                                                                                                                                                                                                               |
| `AddToCalendar`                                                             | 📌      | Verify the menu is keyboard-operable (`aria-haspopup`/`aria-expanded`, Esc) and each provider is a labelled control — confirm in sweep.                                                                                                                                                                                                                                                                                                                                  |
| `ShareLink`                                                                 | 📌      | Confirm Copy/QR/Share buttons have text labels (not icon-only) and a copy-success live region.                                                                                                                                                                                                                                                                                                                                                                           |
| `CancellationPolicy`                                                        | ✅      | Read-only text content; no interactive a11y surface.                                                                                                                                                                                                                                                                                                                                                                                                                     |

> **Why not change the visual items now?** This PR's W0 edits are deliberately
> **ARIA/label/focus only** — they cannot regress any merged stream's pixels.
> 44px targets, grid→list reflow, and contrast bumps change layout and are best
> landed in the post-merge sweep where they can be screenshot-reviewed against
> every consuming surface at once.

## 4. Per-feature-stream gaps (filed — apply within each stream)

Merged streams (W1–W11): apply in a follow-up; their PRs are closed so a sweep is
safe. Unbuilt streams (W12–W17): bake in from the start using `a11y.ts`.

- **All streams:** route every interactive control through `focusRing(pillar)`
  (C3) and `MIN_TARGET` (C1); render all local sheets/modals with
  `useFocusTrap` + `useReturnFocus` + `role="dialog"` (C9).
- **W1 (A4 NotificationPrefsForm):** the P/E/S chip toggles use `aria-pressed`
  ✅; confirm each chip's accessible name includes the channel **and** row
  ("New booking, Push, on") — currently the letter alone — and add a focus ring.
- **W5/W6/W7 (public booking):** the booker flow consumes the now-labelled
  `SlotPicker`/`SlotConflictAlternatives` ✅; verify each step heading is an
  `<h1>`/`<h2>` and the confirm screen suppresses confetti under reduce-motion (C7).
- **W8/W9 (host inbox & sheets):** approve/decline/cancel/reschedule sheets must
  be C9 dialogs; status pills ✅ already text.
- **W10/W11 (home):** calendar day cells need C2 labels like `SlotPicker`; the
  union-row "booking" vs "event" must be text/icon, not color (C4).
- **W12–W17 (unbuilt):** payments/packages money rows use `tabular-nums` +
  labelled amounts; insights charts need a text/table fallback (charts are not
  accessible by color alone, C4); the period/filter and round-robin sheets are
  C9 dialogs.

## 5. Verification

- **Build/typecheck:** `pnpm --filter @pantopus/web build` + `typecheck` green
  (the hard gate; run for this PR).
- **Static / unit:** `tests/scheduling/w18-channels.test.ts` covers the H15
  channel/permission state machine + verify-field validation.
- **axe / Lighthouse:** the hosted-dev backend + auth aren't reachable from this
  build sandbox, so an automated axe pass over the live public/host screens is
  deferred. Recommended once running against hosted-dev:
  `npx @axe-core/cli <preview-url>/book/<slug>` and a Lighthouse a11y run on the
  Reminder-channels page (`/app/scheduling/settings/channels`), the public booker
  (`/book/<slug>` → slot picker), and the host inbox. Expected ≥ 95 with the
  fixes above; the filed items (C1/C8) are the remaining points.
