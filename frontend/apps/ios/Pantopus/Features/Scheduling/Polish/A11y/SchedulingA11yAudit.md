# Calendarly — H14 Accessibility & Large-Text Audit (Stream I18)

Cross-cutting accessibility pass over the merged Calendarly surface on
`feature/calendarly`. Per the I18 contract this stream **only ships its own
files** (`Features/Scheduling/Polish/**`): it adds reusable a11y helpers
(`SchedulingA11yModifiers.swift`), encodes the contract as testable data
(`SchedulingA11yAudit.swift`), and **files follow-up issues** for gaps inside
other streams' files rather than editing them (preserving disjoint ownership).

The structured, test-backed version of this report is `SchedulingA11yAudit.swift`
(`SchedulingA11yAudit.findings`). Keep the two in sync.

## The contract (from the H14 design)

1. **44pt targets** — every interactive control ≥44pt, including at the largest
   Dynamic Type.
2. **Full slot labels** — each slot button announces `"<date>, <time>,
   available/taken"`, not just the time.
3. **Timezone affordance** — `"Times shown in <tz>"` is text; a host/viewer
   mismatch is spoken (`"…, host is in Eastern Time"`), never color.
4. **Text, not color alone** — availability, status, and conflicts carry text or
   shape, not just a hue.
5. **Dynamic-Type reflow** — dense slot grids collapse to a single stacked list
   at accessibility sizes; day numbers never truncate.
6. **Visible focus ring** — focused controls show a ring offset from the control.
7. **Reduce Motion** — confetti / pulses are suppressed under Reduce Motion.
8. **Accessibility identifiers** — every routed screen + key control has a stable
   `accessibilityIdentifier` (mirrors Android `testTag`).

## What passes today

- **SlotPicker slots already reflow** — slots render as full-width grouped rows
  (Morning / Afternoon / Evening), not a fixed 40×40 grid, so the headline
  "fix SlotCalendar's fixed tiles" requirement is already satisfied for the
  time column.
- **SchedulingSlotRow targets** — `frame(minHeight: 44)`.
- **Day cells convey availability as text** — `", available" / ", unavailable" /
  ", today"` plus a supplementary dot.
- **Timezone chip** is a labelled button.
- **I6 confirmed screen** gates confetti + halo pulse on
  `accessibilityReduceMotion`.
- **H15 (this stream)** — real labelled OTP input, ≥44pt targets, visible focus
  ring, color-independent state, full identifier coverage.

## Gaps → follow-up issues (do NOT edit other streams' files)

| # | Slug | Surface (owner) | Gap | Suggested fix |
|---|------|-----------------|-----|---------------|
| 1 | `i18-a11y-slotrow-label` | `SchedulingSlotRow` (Foundation) | Label is time-only when `detail == nil`. | Compose the label from `SchedulingA11y.slotLabel(date:time:isAvailable:)`, or have callers pass the day + availability. |
| 2 | `i18-a11y-slotpicker-daycell-target` | `SlotPicker.calendar` (Foundation) | Day-cell button is 40pt tall (< 44pt). | Apply `.a11yMinimumTapTarget(44)` to the day cell button. |
| 3 | `i18-a11y-slotpicker-slot-label` | `SlotPicker.slots` (Foundation) | Passes `detail: nil`, so rows announce only the time. | Pass the selected day's date (and taken state) into the row label. |
| 4 | `i18-a11y-timezone-mismatch-vo` | `SlotPicker.timezone` / `TimezoneSelectorSheet` (Foundation) | Host/viewer timezone mismatch is not spoken. | Use `SchedulingA11y.timezoneLabel(viewer:host:)` for the chip's accessibility label. |

All four land in Foundation `SharedUI/*` files owned by I0b, not by any feature
stream — they should be fixed in a Foundation follow-up (or fold the
`SchedulingA11y` helpers into those components) so every consumer benefits at
once. The helpers in `SchedulingA11yModifiers.swift` are written so those fixes
are one-line adoptions.

## Reusable helpers shipped (for adoption by the fixes above)

- `View.a11yMinimumTapTarget(_:)` — enforce a ≥44pt hit area.
- `View.a11yFocusRing(active:accent:cornerRadius:)` — visible focus ring.
- `SchedulingA11y.slotLabel(date:time:isAvailable:)` — full slot VoiceOver label.
- `SchedulingA11y.timezoneLabel(viewer:host:)` — timezone affordance label.
- `DynamicTypeSize.schedulingSlotColumns` — 3 → 1 column reflow at a11y sizes.
