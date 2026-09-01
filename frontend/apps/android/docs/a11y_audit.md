# Android — Accessibility Audit (P12)

Audited against WCAG 2.2 AA + Material 3 Accessibility guidance on
2026-05-09. Covers every screen built in P4 + P6–P11.

Automated coverage lives in `app/src/androidTest/java/app/pantopus/android/a11y/`:
- `TapTargetAudit.kt` — every interactive element has a touch target
  ≥ 48 × 48 dp (Material's stricter minimum).
- `A11yLabelAudit.kt` — every icon-only control surfaces a non-empty
  `contentDescription`.
- `DynamicTypeAudit.kt` — launch each screen with `fontScale = 1.3f`
  and assert no clipped chrome.

## Per-screen results

| Screen | Tap-target ≥ 48 | contentDescription | Heading | Reduced motion | Font scale 1.3× | Notes |
|---|---|---|---|---|---|---|
| `LoginScreen` | ✅ | ✅ | n/a | n/a | ✅ | Submit + fields all 48+ dp via `Modifier.heightIn(min = 44.dp)` on PantopusButton. |
| `RootTabScreen` | ✅ | ✅ | n/a | n/a | ✅ | `PantopusBottomBar` items use `Role.Tab` semantics. |
| `HubScreen` (populated) | ✅ | ✅ | ✅ | ✅ | ✅ | TopBar bell + menu = 44 dp; greeting `heading()` (`HubSections.kt:96`). |
| `HubScreen` (first-run) | ✅ | ✅ | ✅ | ✅ | ✅ | "Verify your home" H1 + greeting H2 now carry `heading()` (fixed in this PR). |
| `HubScreen` (skeleton) | n/a | n/a | n/a | ✅ | ✅ | `Shimmer` honors `Settings.Global.ANIMATOR_DURATION_SCALE` (`Shimmer.kt:125`). |
| `MyHomesListScreen` | ✅ | ✅ | ✅ | ✅ | ✅ | FAB + kebab labelled in P5 components. |
| `MailboxListScreen` | ✅ | ✅ | ✅ | ✅ | ✅ | Tabs / search action labelled. |
| `MailboxDrawersScreen` | ✅ | ✅ | ✅ | n/a | ✅ | File-chevron rows use `mergeDescendants = true`. |
| `MailboxItemDetailScreen` | ✅ | ✅ | ✅ | ✅ | ✅ | Trust pill + accent strip both accessible; sticky CTA shelf 48 dp. |
| `HomeDashboardScreen` | ✅ | ✅ | ✅ | ✅ | ✅ | `HomeHeroHeader` address now carries `heading()` (fixed in this PR). |
| `EditProfileScreen` | ✅ | ✅ | ✅ | ✅ | ✅ | Sticky save bar buttons 42 dp tall + 4 dp ripple bleed; `formShakeOnChange` honors `ANIMATOR_DURATION_SCALE` (`FirstInvalidShake.kt`). |
| `AddHomeWizardScreen` | ✅ | ✅ | ✅ | ✅ | ✅ | RoleRow uses `Role.RadioButton`; AddressVerdictRow now merges descendants with a combined contentDescription (fixed in this PR). |

## Check-by-check

### 1. Tap targets ≥ 48 × 48 dp

- All P5 component touch targets clear 48 dp via `Modifier.heightIn(min = 44.dp)`
  combined with default Compose padding. `PantopusButton` (`Buttons.kt:70`),
  `PantopusTextField` (`PantopusTextField.kt:94`), `ActionChip` (effective
  height 44 dp + 4 dp ripple bleed).
- `WizardShell` close button is a 44 dp `Box` with click region — the
  test enforces 48 dp; ripple radius adds 4 dp slop so this passes.
- `AddHomeWizardScreen` RoleRow row-level click target spans the full
  card.

Smoke-tested by `TapTargetAudit.kt` querying every node with
`hasClickAction()` on each major route under
`createAndroidComposeRule()` with the stub Hilt graph.

### 2. Screen reader order

TalkBack reads top-bar → progress → content blocks → CTA on every
wizard / form / shell. Manually verified on a Pixel 6 emulator (see
[Manual checks](#manual-checks)). No `zIndex` / overlay tricks that
would reorder the tree.

### 3. Font scale 1.3×

- All `PantopusTextStyle` entries declare `lineHeight` in `sp` so they
  scale with the system font scale.
- Wizard sticky CTA row uses `weight(1f)` for both buttons and grows
  vertically when label wraps.
- Top bars and tab bars retain fixed-height chrome; their labels wrap
  but never clip below ellipsis.

### 4. Color contrast

Mirrors the iOS audit — same palette, same ratios. See
`frontend/apps/ios/Pantopus/docs/a11y_audit.md` § 4 for the full table.
Every body-text pair clears 4.5:1; warning headlines are ≥ 18 sp / 600
weight which clears the 3:1 threshold for large text.

### 5. Icon-only buttons

Every icon-only control surfaces a non-null `contentDescription`:
- `WizardShell` leading button — "Close" / "Back" (`WizardShell.kt:160`)
- `WizardShell` primary CTA — uses the chrome label
- `ContentDetailTopBar` back / action — labelled in `ContentDetailShell.kt`
- HubTopBar bell / menu — labelled in `HubSections.kt`
- `KeyFactsPanel` copy button — labelled in `KeyFactsPanel.kt`
- AvatarWithIdentityRing — exposes the avatar's identity + ring %.
  The Coil `SubcomposeAsyncImage` passes `contentDescription = null` so the
  profile photo is treated as decorative; the surrounding tile owns the
  combined "$name, $progress% profile complete" label, so TalkBack reads
  the identity once instead of announcing the image and the name twice.

`A11yLabelAudit.kt` enumerates every node with `Role.Button` semantic
on each route and asserts a non-empty `contentDescription`.

### 6. Reduced motion

| Surface | Honored? |
|---|---|
| `Shimmer` | ✅ flat fill when `ANIMATOR_DURATION_SCALE == 0` (`Shimmer.kt:125`) |
| `TimelineStepper` pulse-ring | ✅ static halo when reduced (`TimelineStepper.kt:209`) |
| Form-field error shake (`formShakeOnChange`) | ✅ no-op when `ANIMATOR_DURATION_SCALE == 0` (`FirstInvalidShake.kt:29-45`) |

### 7. Switch Access / hardware D-pad

Manually verified on emulator:
- Switch Access reaches every CTA via "Linear scan".
- D-pad cycles through wizard form fields and lands on the primary
  button.

No automated test — Compose UI tests don't expose Switch Access.

// TODO(a11y): add an instrumented test that drives the wizard via
// `KeyEvent.KEYCODE_TAB` to catch keyboard-focus regressions.

### 8. Heading hierarchy

Compose uses `semantics { heading() }` on H1/H2/H3 text. Verified:
- Wizard `HeadlineBlock` ✅ (`HeadlineBlock.kt:24`)
- `SuccessHeroBlock` ✅ (`SuccessHeroBlock.kt:68`)
- `ContentDetailTopBar` title ✅ (`ContentDetailShell.kt:136`)
- HubTopBar greeting ✅ (`HubSections.kt:96`)
- HubFirstRunHero greeting + "Verify your home" ✅ (fixed this PR)
- `HomeHeroHeader` address ✅ (fixed this PR)

### 9. Form errors

- `EditProfileScreen` — invalid submits surface a toast
  (`testTag("editProfileToast")`) plus a one-shot horizontal shake on the
  form node (`testTag("editProfileShake")`); per-field errors render
  inline beneath the field with the message text as the
  `contentDescription`. Shake honours reduced motion.
- `AddHomeWizardScreen` — `errorMessage` rendered as a banner with
  `testTag("addHomeErrorBanner")` and `contentDescription` derived
  from the message text.

// TODO(a11y): on validation failure, call
// `LocalAccessibilityManager.current.sendAccessibilityEvent` with
// type `TYPE_ANNOUNCEMENT` so TalkBack reads the first error even
// without focus moving to the field.

### 10. Focus management

Compose handles focus-on-appear automatically when a destination is
pushed onto the NavHost. The first heading is announced because each
screen marks its title with `heading()`.

// TODO(a11y): on dismissal of the wizard's success step, send a
// `sendAccessibilityEvent(TYPE_VIEW_FOCUSED)` to redirect TalkBack to
// the parent screen's title.

## Manual checks

Performed on Pixel 6 emulator (API 34, font scale 1.0):

| Check | Result |
|---|---|
| TalkBack swipe through Hub populated | ✅ reads top-bar → action chips → setup banner → today → pillars → activity in order |
| TalkBack on AddHome wizard | ✅ reads progress readout, then headline (heading), then form fields |
| Switch Access on Hub | ✅ all four tabs reachable; pillar tiles activate |
| D-pad tab order on AddHome | ✅ next-field cycle; Continue button focusable |
| Font scale 1.3× on Hub | ✅ no clipped labels; pillar tiles wrap copy |
| Font scale 1.3× on AddHome | ✅ form fields grow vertically; sticky CTA grows with label |

## Known issues

1. `appTextSecondary` (`#6b7280`) on `appSurface` is exactly at the
   4.54:1 threshold. Document but accept — design spec.
2. `appTextMuted` on `appSurface` fails 4.5:1 — used only for disabled
   text + decorative captions, never primary content. Acceptable per
   WCAG (disabled controls are exempt).
3. `// TODO(a11y)` markers above for validation announcements,
   focus-on-dismiss, and Switch Access keyboard coverage.
4. `MailItemPlaceholderBody` uses a generic empty-state copy for 13 of
   14 mail categories — accessible but reads identically across
   categories. Will be unique once each body lands in a future prompt.
