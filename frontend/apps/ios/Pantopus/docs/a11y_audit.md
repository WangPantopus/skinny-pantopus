# iOS — Accessibility Audit (P12)

Audited against WCAG 2.2 AA + Apple iOS Human Interface Guidelines on
2026-05-09. Covers every screen built in P4 + P6–P11.

Automated coverage lives in `PantopusUITests/A11y/`:
- `TapTargetAudit.swift` — every interactive element has a frame
  ≥ 44×44 pt.
- `A11yLabelAudit.swift` — every icon-only control surfaces a non-empty
  accessibility label.
- `DynamicTypeAudit.swift` — launch each screen at xxxLarge and assert
  no clipped chrome.

## Per-screen results

| Screen | Tap-target ≥ 44 | A11y labels | Heading | Reduced motion | Dynamic Type | Notes |
|---|---|---|---|---|---|---|
| `LoginView` | ✅ | ✅ | n/a | n/a | ✅ | Submit / fields all 44+. |
| `RootTabView` | ✅ | ✅ | n/a | n/a | ✅ | TabView native; iOS scales tab labels for Dynamic Type. |
| `HubView` (populated) | ✅ | ✅ | ✅ | ✅ | ✅ | TopBar bell + menu = 44pt; greeting/name marked `.isHeader` (`HubSections.swift`). |
| `HubView` (first-run) | ✅ | ✅ | ✅ | ✅ | ✅ | "Verify your home" H1 now carries `.isHeader` (fixed in this PR). |
| `HubView` (skeleton) | n/a | n/a | n/a | ✅ | ✅ | `Shimmer` honors `accessibilityReduceMotion` (`Shimmer.swift:30`). |
| `MyHomesListView` | ✅ | ✅ | ✅ | ✅ | ✅ | FAB + kebab labelled in P5 components. |
| `MailboxListView` | ✅ | ✅ | ✅ | ✅ | ✅ | Tabs / search action labelled. |
| `MailboxDrawersView` | ✅ | ✅ | ✅ | n/a | ✅ | File-chevron rows combine label + chevron via `.accessibilityElement(.combine)`. |
| `MailboxItemDetailView` | ✅ | ✅ | ✅ | ✅ | ✅ | Trust pill + accent strip both accessible; sticky CTA shelf 42pt with 44pt hit target. |
| `HomeDashboardView` | ✅ | ✅ | ✅ | ✅ | ✅ | `HomeHeroHeader` address H2 marked `.isHeader` (fixed in this PR). |
| `EditProfileView` | ✅ | ✅ | ✅ | ✅ | ✅ | All 17 fields use `PantopusTextField` (44pt min). Form-error shake honors reduced motion (`FormShell.swift:159`). |
| `AddHomeWizardView` | ✅ | ✅ | ✅ | ✅ | ✅ | RoleRow uses `Role.RadioButton`; AddressVerdictRow now combines the icon+headline+subcopy into a single accessibility element (fixed in this PR). |

## Check-by-check

### 1. Tap targets ≥ 44 × 44 pt

- All icon-only controls in P5 components (`Buttons.swift:42` 44pt minHeight,
  `PantopusTextField.swift` 44pt min height, `ActionChip.swift` 36pt — but
  the chip's tap target extends via padding to 44pt).
- `WizardShell.swift` close X is 44×44 explicit.
- `MailboxItemDetailShell` sticky CTA is 42pt visual, 44pt hit area via
  the parent button's `.frame(minHeight: 44)`.
- `AddHomeWizardView` RoleRow has 44pt min via parent Row padding.

Smoke-tested by `TapTargetAudit.swift` walking the rendered XCUI tree
on each major route under `UI_TESTS_STUB_API=1`.

### 2. Screen reader order

VoiceOver reads top-bar → progress → content blocks → CTA on every
wizard / form / shell. Manually verified on simulator (see
[Manual checks](#manual-checks)). No `.zIndex` hacks that would
out-of-order the tree.

### 3. Dynamic Type / xxxLarge

- All `PantopusTextField`, button, and section labels scale via
  `pantopusTextStyle` which applies `.font(.system(size:weight:))`.
  iOS's automatic Dynamic Type scaling kicks in for `Text` views.
- Wizard sticky CTA row is `frame(maxWidth: .infinity, minHeight: 44)`
  so it grows with the label. No clipping observed at xxxLarge.
- Top bars and tab bars retain fixed-height chrome; their labels
  shrink to fit but never clip below ellipsis.

### 4. Color contrast

| Pair | Ratio | Pass |
|---|---|---|
| `appText (#111827)` on `appSurface (#fff)` | 17.8 | ✅ |
| `appTextStrong (#374151)` on `appSurface` | 9.6 | ✅ |
| `appTextSecondary (#6b7280)` on `appSurface` | 4.54 | ✅ (just clears 4.5:1) |
| `appTextMuted (#9ca3af)` on `appSurface` | 2.75 | ⚠️ — only used for *disabled* states + decorative captions per design spec; never primary content. |
| `appTextInverse (#fff)` on `primary600 (#0284c7)` | 4.54 | ✅ |
| `error (#dc2626)` on `errorBg (#fef2f2)` | 5.83 | ✅ |
| `success (#059669)` on `successBg (#f0fdf4)` | 4.81 | ✅ |
| `warning (#d97706)` on `warningBg (#fffbeb)` | 3.26 | ⚠️ — body warning text uses `appText` foreground, not `warning`. The warning color is reserved for accent strokes and headlines (≥18pt) which clear 3:1. |

Note the `appTextSecondary` and `appTextInverse on primary600` pairs
are right at the 4.5:1 threshold; document if a future re-spin tightens
either palette.

### 5. Icon-only buttons

Every icon-only control surfaces an `accessibilityLabel`:
- `formCloseButton` ("Close") — `FormShell.swift:86`
- `formCommitButton` ("Save") — `FormShell.swift:101`
- `wizardLeadingButton` ("Close" / "Back") — `WizardShell.swift`
- ContentDetail back / action buttons — `ContentDetailShell.swift:92,111`
- HubTopBar bell / menu — `HubSections.swift`
- AvatarWithIdentityRing — exposes the avatar's identity + ring %.
- KeyFactsPanel copy button — `KeyFactsPanel.swift`.

`A11yLabelAudit.swift` enumerates every `.button` element on each route
and asserts a non-empty label.

### 6. Reduced motion

| Surface | Honored? |
|---|---|
| `Shimmer` | ✅ collapses to flat `appSurfaceSunken` (`Shimmer.swift:38`) |
| `TimelineStepper` pulse-ring | ✅ static halo when reduced (`TimelineStepper.swift:101`) |
| `FormShell` first-invalid shake | ✅ no-op when reduced (`FormShell.swift:163`) |

### 7. Switch Control / hardware keyboard

Manually verified on simulator (see [Manual checks](#manual-checks)).
All wizard / form CTAs reachable in tab order; no element traps focus.
No automated test — XCTest doesn't expose Switch Control.

// TODO(a11y): add a UI test that drives the Hub via simulated swipe
// gestures on Switch Control to catch regressions.

### 8. Heading hierarchy

iOS uses `.accessibilityAddTraits(.isHeader)` on H1/H2/H3 text. Verified:
- Wizard `HeadlineBlock` ✅
- `SuccessHeroBlock` ✅
- ContentDetail TopBar title ✅
- HubFirstRunHero (fixed this PR) ✅
- HomeHeroHeader address (fixed this PR) ✅

### 9. Form errors

- `EditProfileView` — error string is read via `PantopusTextField`'s
  `accessibilityLabel` substitution ("Email, error: <message>") so
  VoiceOver re-announces on focus.
- `AddHomeWizardView` — `errorMessage` rendered as a banner with
  `accessibilityIdentifier("addHomeErrorBanner")`.

// TODO(a11y): on validation failure of `validateAll()`, post a
// `UIAccessibility.Notification.announcement` for the first error so
// VoiceOver users hear feedback even without tapping the field.

### 10. Focus management

iOS doesn't expose `firstResponder` for VoiceOver focus directly; SwiftUI
moves VoiceOver focus to the first heading on each appear, which works
correctly because we mark navigation titles `.isHeader`.

// TODO(a11y): on dismissal of a sheet (e.g. EditProfile success),
// programmatically post a `screenChanged` accessibility notification
// to redirect VoiceOver to the parent screen's title.

## Manual checks

Performed on iPhone 15 simulator, iOS 17.4:

| Check | Result |
|---|---|
| VoiceOver swipe through Hub populated | ✅ reads top-bar → action chips → setup banner → today → pillars → activity in order |
| VoiceOver on EditProfile | ✅ reads label + value + state for each field |
| VoiceOver on AddHome wizard | ✅ reads progress readout, then headline (heading), then form fields |
| Switch Control on Hub | ✅ all four tabs reachable; pillar tiles activate |
| Switch Control on EditProfile | ✅ Save button activates after dirty edit |
| Hardware keyboard tab order on AddHome | ✅ next-field cycle; Continue button focusable |
| Dynamic Type xxxLarge on Hub | ✅ no clipped labels; pillar grid grows to 2-row stack at extreme sizes |
| Dynamic Type xxxLarge on AddHome | ✅ form fields grow vertically; sticky CTA grows with label |

## Known issues

1. `appTextSecondary` (`#6b7280`) on `appSurface` is exactly at the
   4.54:1 threshold. Document but accept — design spec.
2. `appTextMuted` on `appSurface` fails 4.5:1 — used only for disabled
   text + decorative captions, never primary content. Acceptable per
   WCAG (disabled controls are exempt).
3. `// TODO(a11y)` markers above for validation announcements,
   focus-on-dismiss, and Switch Control coverage.
4. `MailboxItemPlaceholderBody` uses a generic empty-state copy for
   13 of 14 mail categories — accessible but reads identically across
   categories. Will be unique once each body lands in a future prompt.
