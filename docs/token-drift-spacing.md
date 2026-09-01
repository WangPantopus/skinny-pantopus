# P7.2 — Layout-spacing drift audit

> **Generated:** 2026-05-26. **Tokens cited from:** `docs/token-conventions.md`.
>
> This audit covers ONLY layout spacing — padding, gaps, margins, and
> spacer minimums. Leaf-component geometry (`.frame(width:, height:)`,
> `Modifier.size`, `Icon(..., size:)`, image/illustration/badge/FAB
> dimensions) is **out of scope** and was not touched.

## Methodology

### Scope

- **iOS:** `frontend/apps/ios/Pantopus/Features/`,
  `frontend/apps/ios/Pantopus/Core/Design/Components/`,
  `frontend/apps/ios/Pantopus/App/`.
- **Android:** `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/`,
  `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/`.

### In-scope patterns

- **iOS:** `.padding(N)`, `.padding(.<edge>, N)` for any of
  `horizontal|vertical|top|bottom|leading|trailing`, `spacing: N` keyword
  in any layout constructor (`VStack` / `HStack` / `LazyVGrid` /
  `LazyHGrid` / `GridItem` / `Grid` / `FlowLayoutCompat` /
  `FilterSheetFlowLayout` / `.safeAreaInset(edge:, spacing:)`),
  `Spacer(minLength: N)`.
- **Android:** `.padding(N.dp)`, `padding(<edge> = N.dp ...)` for any of
  `horizontal|vertical|top|bottom|start|end` (kwargs inside `.padding(…)`
  or `PaddingValues(…)`), `Arrangement.spacedBy(N.dp)`,
  `Spacer(modifier = Modifier.height/width(N.dp))` and
  `Spacer(Modifier.height/width(N.dp))` positional form.

### Out of scope — explicitly **NOT** flagged, **NOT** changed

- `.frame(width:, height:)` (iOS) / `Modifier.size(...)` /
  `Modifier.height(...).chained(...)` / standalone `Modifier.width/height`
  outside `Spacer(...)` (Android) — fixed-component geometry per the
  design-system DoD.
- `Icon(..., size: 20)`.
- Image / illustration / badge / FAB dimensions.
- Animated offsets, gesture translations, drag distances.

### Allowed token values

The canonical spacing ramp (from `docs/token-conventions.md` §2 / §8):

| Value | iOS / Android token |
|---:|---|
| 0 | `Spacing.s0` |
| 4 | `Spacing.s1` |
| 8 | `Spacing.s2` |
| 12 | `Spacing.s3` |
| 16 | `Spacing.s4` |
| 20 | `Spacing.s5` |
| 24 | `Spacing.s6` |
| 32 | `Spacing.s8` |
| 40 | `Spacing.s10` |
| 48 | `Spacing.s12` |
| 64 | `Spacing.s16` |

Any other integer is **off-scale** — logged, not auto-rounded.

### Post-Wave-D coverage check

The Pass-2 change set touched **17 of 19** Wave A–D iOS feature folders
explicitly listed in the prompt — well above the 8-folder threshold.
(`Features/Today/` does not exist on disk; `Features/RecentActivity/`
has zero in-scope literal spacing — it was already token-clean.) On
Android, **8** Wave A–D `screens/*` folders were touched.

| Wave A–D folder | iOS files | Android files |
|---|---:|---:|
| Membership / membership | 1 | 1 |
| Homes/Guests / homes/guests | 2 | (already clean) |
| Homes/PropertyDetails | 1 | (already clean) |
| Profile/Professional | 6 | (already clean) |
| AudienceProfile/EditPersona | 1 | 1 |
| AudienceProfile/ComposeBroadcast | 2 | 1 |
| AudienceProfile/BroadcastDetail | 1 | 1 |
| Gigs/TasksMap | 1 | 1 |
| Gigs/QuickPost | 1 | (already clean) |
| Explore | 1 | 1 |
| Mailbox/MailboxMap | 1 | 1 |
| Mailbox/MailboxRoot | 1 | (already clean) |
| Mailbox/ItemDetail/Bodies | 14 | (already clean) |
| Chat/Conversation/AI | 3 | (already clean) |
| ReviewClaims | 2 | (already clean) |
| CreatorInbox | 1 | 1 |
| BusinessProfile | 1 | (already clean) |

## Summary

| | iOS | Android |
|---|---:|---:|
| **Files touched by Pass 2** (on-scale → token) | **140** | **76** |
| **Lines changed by Pass 2** | **1149** | **781** |
| **Off-scale occurrences remaining (Pass-2 left untouched)** | **986** | **874** |
| Files containing at least one off-scale literal | 113 | 95 |

Off-scale value distribution (post-Pass-2):

| Value (pt/dp) | iOS occurrences | Android occurrences |
|---:|---:|---:|
| 1 | 135 | 49 |
| 2 | 375 | 152 |
| 3 | 153 | 83 |
| 5 | 104 | 56 |
| 6 | 239 | 155 |
| 7 | 30 | 20 |
| 9 | 21 | 20 |
| 10 | 194 | 126 |
| 11 | 10 | 9 |
| 13 | 2 | 2 |
| 14 | 114 | 107 |
| 17 | 1 | – |
| 18 | 35 | 29 |
| 22 | 23 | 20 |
| 28 | 7 | 9 |
| 42 | 1 | – |
| 44 | 2 | – |
| 46 | 1 | 1 |
| 50 | 2 | 2 |
| 52 | 1 | 1 |
| 56 | – | 3 |
| 60 | 5 | 1 |
| 80 | 4 | 5 |
| 92 | 2 | – |
| 96 | 1 | 8 |
| 100 | 1 | 6 |
| 110 | 5 | 5 |
| 120 | 2 | 3 |
| 130 | 1 | – |
| 150 | – | 1 |
| 172 | – | 1 |
| 190 | 2 | – |

The big rocks — `2 / 6 / 10 / 14` — collectively account for ~70 % of the
remaining drift. These are the "half-step" values: designers chose them
to land 2pt off the canonical scale for a specific reason (denser inline
chip padding, half-leading on a 28pt row, etc.). Auto-rounding any of
them would silently change visual rhythm. The design call is binary:
either (a) extend the spacing ramp with `s_half`/`s2_alt` tokens (or
similar), or (b) accept the bespoke value where it's needed and keep
the off-scale literal in code.

## Pass 2 — applied replacements

Pass 2 ran a Python script
(`/tmp/p72-audit/apply.py` during this session) that mechanically
replaced every on-scale value with its `Spacing.sN` token. After
Pass 2 a re-run of every grep returned **0** on-scale literal hits on
both platforms — confirmed by:

```
# iOS — must be 0
grep -rE "\.padding\((0|4|8|12|16|20|24|32|40|48|64)\)|\
\.padding\(\.[a-z]+, *(0|4|8|12|16|20|24|32|40|48|64)\)|\
VStack\(.*spacing: *(0|4|8|12|16|20|24|32|40|48|64)\)|\
HStack\(.*spacing: *(0|4|8|12|16|20|24|32|40|48|64)\)|\
Spacer\(minLength: *(0|4|8|12|16|20|24|32|40|48|64)\)" \
  frontend/apps/ios/Pantopus/Features/ \
  frontend/apps/ios/Pantopus/Core/Design/Components/ \
  frontend/apps/ios/Pantopus/App/ --include="*.swift" | wc -l
# 0
```

```
# Android — must be 0
grep -rE "\.padding\((0|4|8|12|16|20|24|32|40|48|64)\.dp\)|\
(horizontal|vertical|top|bottom|start|end) *= *(0|4|8|12|16|20|24|32|40|48|64)\.dp|\
Arrangement\.spacedBy\((0|4|8|12|16|20|24|32|40|48|64)\.dp\)|\
Spacer\(.*Modifier\.(height|width)\((0|4|8|12|16|20|24|32|40|48|64)\.dp\)\)" \
  frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/ \
  frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/ \
  --include="*.kt" | wc -l
# 0
```

### Out-of-scope verification

Inspected the Pass-2 git diff for any modification to a `.frame(...)`,
`Modifier.size(...)`, `Icon(..., size:)`, or non-Spacer
`Modifier.height/width` line — none were touched. The only diff lines
containing `.frame(` are mixed lines that **also** contain a chained
`.padding(...)`; on those, only the padding portion changed, the
`.frame(...)` substring is byte-identical between pre and post:

```
- Rectangle().fill(Theme.Color.appBorder).frame(height: 1).padding(.leading, 12)
+ Rectangle().fill(Theme.Color.appBorder).frame(height: 1).padding(.leading, Spacing.s3)
```

### Snapshot tests

The replacement is a literal-for-literal token rename — both sides
resolve to the same `CGFloat`/`Dp` at runtime (per
`Core/Design/Spacing.swift` and `ui/theme/Spacing.kt`, the
constants ARE the integer values). Snapshot tests render identically.

---

## Off-scale entries (DESIGN REVIEW)

Per-file enumeration of every remaining off-scale literal — these were
**not** changed by Pass 2.

Each entry: `Lxx: 'value' in '<pattern>' — off-scale, design review`.

> The full per-file detail below was generated by the same audit script.
> Use it as the working list for the design conversation about whether
> to extend the spacing ramp or accept these values as bespoke.


## iOS — off-scale layout spacing

**113 files** contain off-scale layout spacing. 986 total occurrences.

**`frontend/apps/ios/Pantopus/Core/Design/Components/PantopusTextField.swift`** (1 occurrences; values: 2×1)
- L64: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Core/Design/Components/PersonaCard.swift`** (4 occurrences; values: 1×1, 2×1, 3×1, 6×1)
- L67: `2` in `spacing: N` — off-scale, design review
- L120: `3` in `spacing: N` — off-scale, design review
- L127: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L128: `1` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Core/Design/Components/TimelineStepper.swift`** (1 occurrences; values: 2×1)
- L51: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/AudienceProfile/AudienceProfileView.swift`** (52 occurrences; values: 1×3, 2×9, 3×2, 5×5, 6×9, 7×1, 9×1, 10×13, 11×1, 14×5, 22×2, 28×1)
- L135: `14` in `spacing: N` — off-scale, design review
- L145: `6` in `spacing: N` — off-scale, design review
- L157: `10` in `spacing: N` — off-scale, design review
- L225: `14` in `.padding(N)` — off-scale, design review
- L236: `10` in `spacing: N` — off-scale, design review
- L244: `2` in `spacing: N` — off-scale, design review
- L275: `22` in `.padding(.{edge}, N)` — off-scale, design review
- L309: `1` in `spacing: N` — off-scale, design review
- L324: `10` in `.padding(.{edge}, N)` — off-scale, design review
- L371: `22` in `spacing: N` — off-scale, design review
- L393: `10` in `.padding(.{edge}, N)` — off-scale, design review
- L443: `9` in `spacing: N` — off-scale, design review
- _…40 more in this file_

**`frontend/apps/ios/Pantopus/Features/AudienceProfile/BroadcastDetail/BroadcastDetailView.swift`** (7 occurrences; values: 1×1, 2×3, 3×1, 6×1, 7×1)
- L202: `3` in `spacing: N` — off-scale, design review
- L209: `7` in `.padding(.{edge}, N)` — off-scale, design review
- L210: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L233: `2` in `spacing: N` — off-scale, design review
- L412: `2` in `spacing: N` — off-scale, design review
- L442: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L443: `1` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/AudienceProfile/ComposeBroadcast/ComposeBroadcastEditor.swift`** (7 occurrences; values: 1×1, 2×1, 5×4, 7×1)
- L74: `1` in `spacing: N` — off-scale, design review
- L95: `7` in `.padding(.{edge}, N)` — off-scale, design review
- L96: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L111: `5` in `.padding(.{edge}, N)` — off-scale, design review
- L124: `5` in `.padding(.{edge}, N)` — off-scale, design review
- L195: `5` in `spacing: N` — off-scale, design review
- L240: `5` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/AudienceProfile/ComposeBroadcast/ComposeBroadcastView.swift`** (10 occurrences; values: 1×3, 2×2, 3×3, 5×1, 6×1)
- L70: `1` in `spacing: N` — off-scale, design review
- L106: `5` in `spacing: N` — off-scale, design review
- L174: `1` in `spacing: N` — off-scale, design review
- L280: `3` in `spacing: N` — off-scale, design review
- L299: `3` in `spacing: N` — off-scale, design review
- L313: `3` in `spacing: N` — off-scale, design review
- L320: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L321: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L365: `2` in `spacing: N` — off-scale, design review
- L529: `1` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/AudienceProfile/EditPersona/EditPersonaView.swift`** (35 occurrences; values: 1×5, 2×2, 3×9, 5×4, 6×9, 7×4, 9×1, 46×1)
- L340: `3` in `spacing: N` — off-scale, design review
- L372: `2` in `spacing: N` — off-scale, design review
- L384: `7` in `.padding(.{edge}, N)` — off-scale, design review
- L385: `3` in `.padding(.{edge}, N)` — off-scale, design review
- L407: `1` in `spacing: N` — off-scale, design review
- L437: `1` in `spacing: N` — off-scale, design review
- L449: `7` in `.padding(.{edge}, N)` — off-scale, design review
- L450: `3` in `.padding(.{edge}, N)` — off-scale, design review
- L544: `3` in `spacing: N` — off-scale, design review
- L549: `3` in `spacing: N` — off-scale, design review
- L554: `3` in `spacing: N` — off-scale, design review
- L610: `5` in `spacing: N` — off-scale, design review
- _…23 more in this file_

**`frontend/apps/ios/Pantopus/Features/Auth/Screens/ResetPasswordView.swift`** (1 occurrences; values: 6×1)
- L198: `6` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Auth/Screens/SignUpView.swift`** (2 occurrences; values: 2×1, 6×1)
- L347: `6` in `spacing: N` — off-scale, design review
- L426: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/BusinessProfile/BusinessProfileView.swift`** (6 occurrences; values: 2×6)
- L183: `2` in `spacing: N` — off-scale, design review
- L206: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L267: `2` in `spacing: N` — off-scale, design review
- L483: `2` in `spacing: N` — off-scale, design review
- L605: `2` in `spacing: N` — off-scale, design review
- L609: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/CeremonialMail/CeremonialMailWizardView.swift`** (19 occurrences; values: 2×5, 6×8, 10×3, 14×3)
- L38: `10` in `.padding(.{edge}, N)` — off-scale, design review
- L39: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L91: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L135: `10` in `spacing: N` — off-scale, design review
- L137: `2` in `spacing: N` — off-scale, design review
- L152: `10` in `.padding(.{edge}, N)` — off-scale, design review
- L175: `2` in `spacing: N` — off-scale, design review
- L212: `2` in `spacing: N` — off-scale, design review
- L260: `6` in `spacing: N` — off-scale, design review
- L274: `14` in `.padding(N)` — off-scale, design review
- L286: `6` in `spacing: N` — off-scale, design review
- L295: `14` in `.padding(N)` — off-scale, design review
- _…7 more in this file_

**`frontend/apps/ios/Pantopus/Features/CeremonialMailOpen/CeremonialMailOpenView.swift`** (43 occurrences; values: 1×2, 2×2, 3×1, 6×12, 7×2, 10×3, 14×11, 18×4, 22×3, 28×1, 60×1, 110×1)
- L279: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L343: `22` in `.padding(.{edge}, N)` — off-scale, design review
- L420: `10` in `spacing: N` — off-scale, design review
- L445: `1` in `spacing: N` — off-scale, design review
- L455: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L456: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L457: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L475: `28` in `.padding(.{edge}, N)` — off-scale, design review
- L476: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L485: `6` in `spacing: N` — off-scale, design review
- L495: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L509: `6` in `.padding(.{edge}, N)` — off-scale, design review
- _…31 more in this file_

**`frontend/apps/ios/Pantopus/Features/Chat/ChatListView.swift`** (12 occurrences; values: 5×1, 6×1, 7×1, 10×3, 14×4, 22×2)
- L72: `14` in `spacing: N` — off-scale, design review
- L93: `22` in `.padding(.{edge}, N)` — off-scale, design review
- L106: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L107: `10` in `.padding(.{edge}, N)` — off-scale, design review
- L150: `22` in `.padding(.{edge}, N)` — off-scale, design review
- L191: `10` in `.padding(.{edge}, N)` — off-scale, design review
- L208: `10` in `spacing: N` — off-scale, design review
- L215: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L264: `6` in `spacing: N` — off-scale, design review
- L272: `5` in `.padding(.{edge}, N)` — off-scale, design review
- L301: `7` in `spacing: N` — off-scale, design review
- L309: `14` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Chat/Conversation/AI/AICapabilityChip.swift`** (2 occurrences; values: 6×1, 10×1)
- L25: `6` in `spacing: N` — off-scale, design review
- L34: `10` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Chat/Conversation/AI/AIEstimateCard.swift`** (2 occurrences; values: 10×2)
- L21: `10` in `spacing: N` — off-scale, design review
- L43: `10` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Chat/Conversation/ChatConversationView.swift`** (98 occurrences; values: 1×8, 2×8, 3×11, 5×6, 6×19, 7×3, 9×4, 10×20, 13×2, 14×12, 18×2, 22×1, 44×2)
- L209: `18` in `spacing: N` — off-scale, design review
- L212: `6` in `spacing: N` — off-scale, design review
- L236: `18` in `spacing: N` — off-scale, design review
- L258: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L259: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L271: `6` in `spacing: N` — off-scale, design review
- L277: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L293: `7` in `spacing: N` — off-scale, design review
- L315: `10` in `spacing: N` — off-scale, design review
- L320: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L321: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L327: `10` in `spacing: N` — off-scale, design review
- _…86 more in this file_

**`frontend/apps/ios/Pantopus/Features/Chat/ConversationRow.swift`** (8 occurrences; values: 1×1, 2×1, 3×1, 6×4, 14×1)
- L30: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L82: `2` in `spacing: N` — off-scale, design review
- L83: `6` in `spacing: N` — off-scale, design review
- L105: `6` in `spacing: N` — off-scale, design review
- L113: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L196: `3` in `spacing: N` — off-scale, design review
- L203: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L204: `1` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Chat/NewMessage/NewMessageView.swift`** (21 occurrences; values: 2×1, 5×1, 6×2, 9×1, 10×5, 11×2, 14×4, 18×3, 22×1, 60×1)
- L98: `9` in `.padding(.{edge}, N)` — off-scale, design review
- L129: `18` in `spacing: N` — off-scale, design review
- L141: `10` in `spacing: N` — off-scale, design review
- L146: `11` in `spacing: N` — off-scale, design review
- L148: `5` in `spacing: N` — off-scale, design review
- L154: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L155: `10` in `.padding(.{edge}, N)` — off-scale, design review
- L157: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L171: `18` in `spacing: N` — off-scale, design review
- L190: `6` in `spacing: N` — off-scale, design review
- L198: `10` in `.padding(.{edge}, N)` — off-scale, design review
- L199: `6` in `.padding(.{edge}, N)` — off-scale, design review
- _…9 more in this file_

**`frontend/apps/ios/Pantopus/Features/Chat/Search/ChatSearchView.swift`** (5 occurrences; values: 1×1, 2×1, 3×1, 6×2)
- L53: `2` in `spacing: N` — off-scale, design review
- L54: `6` in `spacing: N` — off-scale, design review
- L130: `3` in `spacing: N` — off-scale, design review
- L137: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L138: `1` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Compose/GigCompose/GigComposeMagic.swift`** (5 occurrences; values: 1×3, 2×1, 10×1)
- L293: `1` in `spacing: N` — off-scale, design review
- L372: `1` in `spacing: N` — off-scale, design review
- L395: `10` in `.padding(.{edge}, N)` — off-scale, design review
- L484: `1` in `spacing: N` — off-scale, design review
- L522: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Compose/GigCompose/GigComposeWizardView.swift`** (2 occurrences; values: 2×2)
- L602: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L603: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Compose/ListingCompose/ListingComposePhotoStep.swift`** (10 occurrences; values: 1×1, 7×1, 28×2, 42×1, 92×2, 130×1, 190×2)
- L34: `28` in `.padding(.{edge}, N)` — off-scale, design review
- L35: `92` in `.padding(.{edge}, N)` — off-scale, design review
- L36: `190` in `.padding(.{edge}, N)` — off-scale, design review
- L38: `28` in `.padding(.{edge}, N)` — off-scale, design review
- L39: `92` in `.padding(.{edge}, N)` — off-scale, design review
- L40: `190` in `.padding(.{edge}, N)` — off-scale, design review
- L133: `7` in `.padding(N)` — off-scale, design review
- L271: `42` in `.padding(.{edge}, N)` — off-scale, design review
- L272: `130` in `.padding(.{edge}, N)` — off-scale, design review
- L426: `1` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Compose/ListingCompose/SuggestionsBanner.swift`** (11 occurrences; values: 1×1, 2×4, 3×3, 7×1, 9×1, 10×1)
- L67: `3` in `.padding(.{edge}, N)` — off-scale, design review
- L143: `3` in `.padding(.{edge}, N)` — off-scale, design review
- L180: `2` in `spacing: N` — off-scale, design review
- L199: `2` in `spacing: N` — off-scale, design review
- L210: `10` in `.padding(.{edge}, N)` — off-scale, design review
- L272: `7` in `.padding(.{edge}, N)` — off-scale, design review
- L375: `9` in `.padding(.{edge}, N)` — off-scale, design review
- L423: `2` in `spacing: N` — off-scale, design review
- L486: `1` in `spacing: N` — off-scale, design review
- L515: `2` in `.padding(N)` — off-scale, design review
- L559: `3` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Compose/PulseCompose/PulseComposeContent.swift`** (2 occurrences; values: 2×2)
- L480: `2` in `.padding(N)` — off-scale, design review
- L494: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/ContentDetail/InvoiceDetailView.swift`** (1 occurrences; values: 14×1)
- L42: `14` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/ContentDetail/TransactionalDetailShell.swift`** (37 occurrences; values: 1×2, 2×4, 3×2, 5×2, 6×8, 10×10, 14×2, 18×4, 22×2, 110×1)
- L113: `22` in `.padding(.{edge}, N)` — off-scale, design review
- L137: `110` in `Spacer(minLength: N)` — off-scale, design review
- L166: `18` in `.padding(.{edge}, N)` — off-scale, design review
- L171: `18` in `.padding(.{edge}, N)` — off-scale, design review
- L175: `22` in `.padding(.{edge}, N)` — off-scale, design review
- L232: `5` in `spacing: N` — off-scale, design review
- L239: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L260: `10` in `.padding(.{edge}, N)` — off-scale, design review
- L272: `10` in `.padding(.{edge}, N)` — off-scale, design review
- L286: `18` in `.padding(.{edge}, N)` — off-scale, design review
- L298: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L311: `5` in `spacing: N` — off-scale, design review
- _…25 more in this file_

**`frontend/apps/ios/Pantopus/Features/CreatorInbox/CreatorInboxView.swift`** (26 occurrences; values: 1×2, 2×4, 3×2, 5×2, 6×5, 10×1, 11×2, 14×2, 18×2, 22×2, 28×1, 60×1)
- L69: `1` in `spacing: N` — off-scale, design review
- L164: `22` in `.padding(.{edge}, N)` — off-scale, design review
- L181: `14` in `spacing: N` — off-scale, design review
- L205: `2` in `spacing: N` — off-scale, design review
- L216: `10` in `.padding(.{edge}, N)` — off-scale, design review
- L232: `6` in `spacing: N` — off-scale, design review
- L252: `5` in `spacing: N` — off-scale, design review
- L260: `11` in `.padding(.{edge}, N)` — off-scale, design review
- L261: `5` in `.padding(.{edge}, N)` — off-scale, design review
- L335: `28` in `.padding(.{edge}, N)` — off-scale, design review
- L337: `60` in `.padding(.{edge}, N)` — off-scale, design review
- L344: `18` in `spacing: N` — off-scale, design review
- _…14 more in this file_

**`frontend/apps/ios/Pantopus/Features/DiscoverHub/DiscoverHubView.swift`** (3 occurrences; values: 1×1, 2×2)
- L548: `1` in `spacing: N` — off-scale, design review
- L642: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L698: `2` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Explore/ExploreMapView.swift`** (33 occurrences; values: 1×2, 2×2, 3×2, 5×4, 6×7, 10×6, 11×1, 14×6, 18×1, 28×1, 80×1)
- L194: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L200: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L210: `5` in `spacing: N` — off-scale, design review
- L225: `11` in `.padding(.{edge}, N)` — off-scale, design review
- L244: `2` in `spacing: N` — off-scale, design review
- L250: `3` in `.padding(N)` — off-scale, design review
- L255: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L301: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L415: `18` in `.padding(.{edge}, N)` — off-scale, design review
- L449: `10` in `spacing: N` — off-scale, design review
- L497: `10` in `spacing: N` — off-scale, design review
- L528: `80` in `Spacer(minLength: N)` — off-scale, design review
- _…21 more in this file_

**`frontend/apps/ios/Pantopus/Features/Feed/FeedView.swift`** (5 occurrences; values: 10×1, 14×1, 22×2, 80×1)
- L131: `22` in `.padding(.{edge}, N)` — off-scale, design review
- L150: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L151: `10` in `.padding(.{edge}, N)` — off-scale, design review
- L173: `80` in `Spacer(minLength: N)` — off-scale, design review
- L211: `22` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Feed/Pulse/PulsePostCard.swift`** (5 occurrences; values: 2×2, 3×1, 9×1, 14×1)
- L123: `9` in `spacing: N` — off-scale, design review
- L130: `2` in `spacing: N` — off-scale, design review
- L197: `14` in `spacing: N` — off-scale, design review
- L230: `3` in `spacing: N` — off-scale, design review
- L269: `2` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Gigs/GigsCategoryChipRow.swift`** (1 occurrences; values: 14×1)
- L31: `14` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Gigs/GigsFeedView.swift`** (20 occurrences; values: 2×5, 3×1, 5×3, 6×2, 10×4, 14×2, 22×2, 110×1)
- L95: `10` in `spacing: N` — off-scale, design review
- L102: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L138: `5` in `spacing: N` — off-scale, design review
- L207: `22` in `.padding(.{edge}, N)` — off-scale, design review
- L238: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L239: `10` in `.padding(.{edge}, N)` — off-scale, design review
- L267: `110` in `Spacer(minLength: N)` — off-scale, design review
- L293: `22` in `.padding(.{edge}, N)` — off-scale, design review
- L315: `6` in `spacing: N` — off-scale, design review
- L336: `10` in `spacing: N` — off-scale, design review
- L347: `3` in `spacing: N` — off-scale, design review
- L355: `6` in `.padding(.{edge}, N)` — off-scale, design review
- _…8 more in this file_

**`frontend/apps/ios/Pantopus/Features/Gigs/QuickPost/PostGigV1SupportViews.swift`** (3 occurrences; values: 1×1, 2×2)
- L19: `1` in `.padding(.{edge}, N)` — off-scale, design review
- L25: `2` in `spacing: N` — off-scale, design review
- L73: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Gigs/QuickPost/PostGigV1View.swift`** (2 occurrences; values: 2×1, 5×1)
- L459: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L474: `5` in `.padding(N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Gigs/TasksMap/TasksMapView.swift`** (22 occurrences; values: 1×1, 5×3, 6×5, 7×1, 10×4, 14×5, 18×2, 28×1)
- L113: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L126: `6` in `spacing: N` — off-scale, design review
- L132: `5` in `spacing: N` — off-scale, design review
- L153: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L174: `7` in `spacing: N` — off-scale, design review
- L180: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L181: `18` in `.padding(.{edge}, N)` — off-scale, design review
- L247: `18` in `.padding(.{edge}, N)` — off-scale, design review
- L276: `10` in `spacing: N` — off-scale, design review
- L292: `10` in `spacing: N` — off-scale, design review
- L326: `5` in `.padding(.{edge}, N)` — off-scale, design review
- L332: `14` in `.padding(.{edge}, N)` — off-scale, design review
- _…10 more in this file_

**`frontend/apps/ios/Pantopus/Features/Homes/AddHome/AddHomeFindStepView.swift`** (2 occurrences; values: 2×2)
- L279: `2` in `spacing: N` — off-scale, design review
- L366: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Homes/AddHome/AddHomeWizardView.swift`** (2 occurrences; values: 2×2)
- L244: `2` in `spacing: N` — off-scale, design review
- L289: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Homes/Bills/BillDetailView.swift`** (2 occurrences; values: 3×2)
- L330: `3` in `spacing: N` — off-scale, design review
- L337: `3` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Homes/Calendar/MonthStripHeader.swift`** (5 occurrences; values: 2×1, 3×1, 6×1, 10×2)
- L95: `10` in `spacing: N` — off-scale, design review
- L100: `10` in `.padding(.{edge}, N)` — off-scale, design review
- L160: `3` in `spacing: N` — off-scale, design review
- L178: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L194: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Homes/ClaimOwnership/Steps/ClaimStartStep.swift`** (1 occurrences; values: 2×1)
- L192: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Homes/Documents/DocumentDetailView.swift`** (1 occurrences; values: 2×1)
- L620: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Homes/Documents/UploadDocumentFormView.swift`** (5 occurrences; values: 2×5)
- L265: `2` in `spacing: N` — off-scale, design review
- L320: `2` in `spacing: N` — off-scale, design review
- L508: `2` in `spacing: N` — off-scale, design review
- L633: `2` in `spacing: N` — off-scale, design review
- L685: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Homes/Emergency/AddEmergencyInfoFormView.swift`** (1 occurrences; values: 2×1)
- L383: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Homes/Guests/AddGuestFormContent.swift`** (3 occurrences; values: 1×1, 2×1, 3×1)
- L113: `1` in `spacing: N` — off-scale, design review
- L127: `3` in `.padding(.{edge}, N)` — off-scale, design review
- L156: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Homes/InviteOwner/InviteOwnerFormContent.swift`** (5 occurrences; values: 1×2, 2×1, 3×2)
- L108: `1` in `spacing: N` — off-scale, design review
- L122: `3` in `.padding(.{edge}, N)` — off-scale, design review
- L166: `3` in `.padding(.{edge}, N)` — off-scale, design review
- L299: `1` in `.padding(.{edge}, N)` — off-scale, design review
- L408: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Homes/Maintenance/LogMaintenanceFormView.swift`** (1 occurrences; values: 2×1)
- L516: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Homes/Maintenance/MaintenanceDetailView.swift`** (2 occurrences; values: 2×2)
- L292: `2` in `spacing: N` — off-scale, design review
- L484: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Homes/Members/InviteMemberWizardView.swift`** (1 occurrences; values: 2×1)
- L107: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Homes/Tasks/AddHouseholdTaskFormView+TaskFields.swift`** (1 occurrences; values: 2×1)
- L161: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Hub/HubView.swift`** (1 occurrences; values: 96×1)
- L112: `96` in `Spacer(minLength: N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Hub/Sections/HubSections.swift`** (15 occurrences; values: 1×3, 2×6, 3×2, 5×2, 6×2)
- L29: `1` in `spacing: N` — off-scale, design review
- L112: `1` in `spacing: N` — off-scale, design review
- L196: `3` in `.padding(.{edge}, N)` — off-scale, design review
- L265: `3` in `spacing: N` — off-scale, design review
- L266: `6` in `spacing: N` — off-scale, design review
- L278: `6` in `spacing: N` — off-scale, design review
- L371: `1` in `spacing: N` — off-scale, design review
- L409: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L431: `2` in `spacing: N` — off-scale, design review
- L506: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L560: `2` in `spacing: N` — off-scale, design review
- L575: `5` in `spacing: N` — off-scale, design review
- _…3 more in this file_

**`frontend/apps/ios/Pantopus/Features/Hub/Today/TodayDetailView.swift`** (7 occurrences; values: 1×3, 2×4)
- L152: `2` in `spacing: N` — off-scale, design review
- L261: `2` in `spacing: N` — off-scale, design review
- L427: `1` in `spacing: N` — off-scale, design review
- L448: `1` in `spacing: N` — off-scale, design review
- L489: `2` in `spacing: N` — off-scale, design review
- L539: `1` in `.padding(.{edge}, N)` — off-scale, design review
- L585: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/IdentityCenter/IdentityCenterView.swift`** (15 occurrences; values: 1×2, 2×2, 6×4, 10×1, 14×4, 18×1, 22×1)
- L126: `10` in `spacing: N` — off-scale, design review
- L138: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L142: `14` in `spacing: N` — off-scale, design review
- L150: `6` in `spacing: N` — off-scale, design review
- L159: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L160: `1` in `.padding(.{edge}, N)` — off-scale, design review
- L168: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L169: `1` in `.padding(.{edge}, N)` — off-scale, design review
- L174: `6` in `spacing: N` — off-scale, design review
- L197: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L203: `14` in `.padding(N)` — off-scale, design review
- L262: `2` in `spacing: N` — off-scale, design review
- _…3 more in this file_

**`frontend/apps/ios/Pantopus/Features/Mailbox/Disambiguate/DisambiguateMailFormView.swift`** (1 occurrences; values: 2×1)
- L181: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/CategoryBodies.swift`** (5 occurrences; values: 2×4, 3×1)
- L103: `2` in `spacing: N` — off-scale, design review
- L143: `2` in `spacing: N` — off-scale, design review
- L340: `2` in `spacing: N` — off-scale, design review
- L390: `3` in `.padding(.{edge}, N)` — off-scale, design review
- L519: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/CommunityBody.swift`** (7 occurrences; values: 1×1, 2×4, 3×1, 6×1)
- L160: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L161: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L309: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L357: `2` in `spacing: N` — off-scale, design review
- L493: `3` in `.padding(.{edge}, N)` — off-scale, design review
- L524: `2` in `spacing: N` — off-scale, design review
- L643: `1` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/Components/BarcodeView.swift`** (1 occurrences; values: 1×1)
- L33: `1` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/Components/BidderProfileCard.swift`** (4 occurrences; values: 2×3, 3×1)
- L42: `2` in `spacing: N` — off-scale, design review
- L95: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L104: `3` in `spacing: N` — off-scale, design review
- L135: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/Components/CertifiedConfirmGate.swift`** (1 occurrences; values: 2×1)
- L132: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/Components/CertifiedTermsSheet.swift`** (1 occurrences; values: 2×1)
- L106: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/Components/CouponHero.swift`** (4 occurrences; values: 2×3, 3×1)
- L120: `2` in `spacing: N` — off-scale, design review
- L125: `3` in `spacing: N` — off-scale, design review
- L222: `2` in `spacing: N` — off-scale, design review
- L358: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/Components/OtherBidsStrip.swift`** (2 occurrences; values: 2×1, 3×1)
- L43: `3` in `spacing: N` — off-scale, design review
- L120: `2` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/Components/PostSummaryCard.swift`** (6 occurrences; values: 2×1, 3×3, 5×2)
- L51: `3` in `spacing: N` — off-scale, design review
- L101: `3` in `spacing: N` — off-scale, design review
- L107: `5` in `.padding(.{edge}, N)` — off-scale, design review
- L108: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L117: `5` in `spacing: N` — off-scale, design review
- L125: `3` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/CouponBody.swift`** (4 occurrences; values: 2×3, 7×1)
- L142: `2` in `spacing: N` — off-scale, design review
- L169: `2` in `spacing: N` — off-scale, design review
- L270: `2` in `spacing: N` — off-scale, design review
- L330: `7` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/MemoryBody.swift`** (2 occurrences; values: 1×1, 2×1)
- L241: `1` in `spacing: N` — off-scale, design review
- L344: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/MailboxItemDetailShell.swift`** (2 occurrences; values: 2×1, 120×1)
- L154: `120` in `Spacer(minLength: N)` — off-scale, design review
- L219: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/MailboxItemDetailView.swift`** (1 occurrences; values: 100×1)
- L60: `100` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Components/BookletPager.swift`** (2 occurrences; values: 1×2)
- L96: `1` in `spacing: N` — off-scale, design review
- L173: `1` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Components/CertifiedStampBadge.swift`** (6 occurrences; values: 1×1, 2×3, 6×1, 9×1)
- L25: `2` in `spacing: N` — off-scale, design review
- L34: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L41: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L43: `9` in `.padding(.{edge}, N)` — off-scale, design review
- L44: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L78: `1` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Components/CombinedSenderCarrierCard.swift`** (4 occurrences; values: 2×3, 3×1)
- L115: `2` in `spacing: N` — off-scale, design review
- L169: `2` in `spacing: N` — off-scale, design review
- L219: `3` in `spacing: N` — off-scale, design review
- L228: `2` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/MailDetailView.swift`** (9 occurrences; values: 1×1, 2×1, 3×4, 10×1, 14×1, 110×1)
- L49: `110` in `.padding(.{edge}, N)` — off-scale, design review
- L278: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L345: `3` in `spacing: N` — off-scale, design review
- L353: `3` in `.padding(.{edge}, N)` — off-scale, design review
- L364: `3` in `spacing: N` — off-scale, design review
- L390: `3` in `.padding(.{edge}, N)` — off-scale, design review
- L421: `1` in `spacing: N` — off-scale, design review
- L507: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L549: `10` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Variants/BookletDetailLayout.swift`** (5 occurrences; values: 1×1, 2×1, 3×1, 10×1, 14×1)
- L141: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L164: `10` in `.padding(.{edge}, N)` — off-scale, design review
- L235: `3` in `.padding(.{edge}, N)` — off-scale, design review
- L262: `1` in `spacing: N` — off-scale, design review
- L307: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Variants/CertifiedDetailLayout.swift`** (8 occurrences; values: 3×3, 9×2, 11×1, 14×1, 18×1)
- L325: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L384: `11` in `.padding(.{edge}, N)` — off-scale, design review
- L403: `18` in `.padding(.{edge}, N)` — off-scale, design review
- L532: `9` in `.padding(.{edge}, N)` — off-scale, design review
- L554: `9` in `.padding(.{edge}, N)` — off-scale, design review
- L576: `3` in `.padding(.{edge}, N)` — off-scale, design review
- L595: `3` in `.padding(.{edge}, N)` — off-scale, design review
- L696: `3` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Variants/CommunityDetailLayout.swift`** (24 occurrences; values: 1×2, 2×9, 3×4, 5×1, 6×4, 9×1, 10×1, 14×1, 17×1)
- L302: `3` in `.padding(.{edge}, N)` — off-scale, design review
- L325: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L326: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L353: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L438: `2` in `spacing: N` — off-scale, design review
- L459: `2` in `spacing: N` — off-scale, design review
- L473: `3` in `spacing: N` — off-scale, design review
- L479: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L487: `6` in `spacing: N` — off-scale, design review
- L494: `6` in `spacing: N` — off-scale, design review
- L496: `3` in `.padding(.{edge}, N)` — off-scale, design review
- L552: `3` in `.padding(.{edge}, N)` — off-scale, design review
- _…12 more in this file_

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailboxMap/MailboxMapView.swift`** (46 occurrences; values: 1×3, 2×4, 3×4, 5×7, 6×7, 7×2, 9×1, 10×7, 11×1, 14×6, 18×3, 80×1)
- L47: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L202: `2` in `spacing: N` — off-scale, design review
- L211: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L224: `6` in `spacing: N` — off-scale, design review
- L230: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L244: `5` in `spacing: N` — off-scale, design review
- L342: `18` in `.padding(.{edge}, N)` — off-scale, design review
- L366: `10` in `spacing: N` — off-scale, design review
- L394: `80` in `Spacer(minLength: N)` — off-scale, design review
- L444: `10` in `spacing: N` — off-scale, design review
- L462: `10` in `spacing: N` — off-scale, design review
- L498: `18` in `.padding(.{edge}, N)` — off-scale, design review
- _…34 more in this file_

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailboxRoot/MailboxRootContent.swift`** (3 occurrences; values: 5×2, 14×1)
- L92: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L133: `5` in `.padding(.{edge}, N)` — off-scale, design review
- L188: `5` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Marketplace/MarketplaceView.swift`** (23 occurrences; values: 2×1, 3×2, 5×2, 6×2, 7×1, 10×9, 14×3, 22×2, 110×1)
- L76: `10` in `spacing: N` — off-scale, design review
- L95: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L117: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L166: `10` in `spacing: N` — off-scale, design review
- L200: `22` in `.padding(.{edge}, N)` — off-scale, design review
- L231: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L232: `10` in `.padding(.{edge}, N)` — off-scale, design review
- L248: `10` in `spacing: N` — off-scale, design review
- L261: `110` in `.padding(.{edge}, N)` — off-scale, design review
- L268: `10` in `spacing: N` — off-scale, design review
- L288: `22` in `.padding(.{edge}, N)` — off-scale, design review
- L313: `3` in `spacing: N` — off-scale, design review
- _…11 more in this file_

**`frontend/apps/ios/Pantopus/Features/Me/MeView.swift`** (11 occurrences; values: 2×2, 5×1, 6×2, 10×1, 14×4, 22×1)
- L147: `22` in `.padding(.{edge}, N)` — off-scale, design review
- L178: `14` in `spacing: N` — off-scale, design review
- L180: `2` in `spacing: N` — off-scale, design review
- L287: `2` in `spacing: N` — off-scale, design review
- L302: `10` in `.padding(.{edge}, N)` — off-scale, design review
- L329: `6` in `spacing: N` — off-scale, design review
- L342: `5` in `.padding(.{edge}, N)` — off-scale, design review
- L346: `6` in `.padding(N)` — off-scale, design review
- L394: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L434: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L435: `14` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Membership/MembershipDetailView.swift`** (8 occurrences; values: 1×1, 2×4, 3×2, 50×1)
- L216: `3` in `spacing: N` — off-scale, design review
- L295: `2` in `spacing: N` — off-scale, design review
- L333: `3` in `spacing: N` — off-scale, design review
- L341: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L388: `1` in `spacing: N` — off-scale, design review
- L419: `50` in `.padding(.{edge}, N)` — off-scale, design review
- L440: `2` in `spacing: N` — off-scale, design review
- L506: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Nearby/NearbyMapView.swift`** (21 occurrences; values: 1×3, 2×1, 5×2, 6×6, 7×1, 10×3, 14×3, 18×1, 80×1)
- L174: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L182: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L190: `6` in `spacing: N` — off-scale, design review
- L196: `5` in `spacing: N` — off-scale, design review
- L219: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L235: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L350: `18` in `.padding(.{edge}, N)` — off-scale, design review
- L369: `10` in `spacing: N` — off-scale, design review
- L424: `10` in `spacing: N` — off-scale, design review
- L455: `80` in `Spacer(minLength: N)` — off-scale, design review
- L558: `10` in `spacing: N` — off-scale, design review
- L577: `6` in `spacing: N` — off-scale, design review
- _…9 more in this file_

**`frontend/apps/ios/Pantopus/Features/PrivacyHandshake/PrivacyHandshakeWizardView.swift`** (14 occurrences; values: 1×1, 2×6, 10×5, 14×2)
- L74: `2` in `spacing: N` — off-scale, design review
- L94: `14` in `.padding(N)` — off-scale, design review
- L164: `10` in `spacing: N` — off-scale, design review
- L181: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L182: `2` in `spacing: N` — off-scale, design review
- L200: `10` in `spacing: N` — off-scale, design review
- L202: `1` in `.padding(.{edge}, N)` — off-scale, design review
- L203: `2` in `spacing: N` — off-scale, design review
- L225: `10` in `spacing: N` — off-scale, design review
- L247: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L248: `2` in `spacing: N` — off-scale, design review
- L265: `14` in `.padding(N)` — off-scale, design review
- _…2 more in this file_

**`frontend/apps/ios/Pantopus/Features/Profile/EditProfileStickyBar.swift`** (1 occurrences; values: 2×1)
- L20: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Profile/Professional/Components/CertCard.swift`** (2 occurrences; values: 2×2)
- L20: `2` in `spacing: N` — off-scale, design review
- L43: `2` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Profile/Professional/Components/CompanyField.swift`** (1 occurrences; values: 1×1)
- L20: `1` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Profile/Professional/Components/LinkCard.swift`** (1 occurrences; values: 1×1)
- L19: `1` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Profile/Professional/Components/ProVerifyBadge.swift`** (1 occurrences; values: 2×1)
- L25: `2` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Profile/Professional/Components/VisRow.swift`** (1 occurrences; values: 2×1)
- L19: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Profile/Professional/ProfessionalProfileView.swift`** (2 occurrences; values: 1×1, 3×1)
- L114: `1` in `spacing: N` — off-scale, design review
- L128: `3` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Profile/PublicProfileChrome.swift`** (5 occurrences; values: 2×2, 3×3)
- L194: `3` in `spacing: N` — off-scale, design review
- L202: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L279: `3` in `spacing: N` — off-scale, design review
- L325: `3` in `spacing: N` — off-scale, design review
- L333: `2` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Profile/PublicProfileNeighbor.swift`** (18 occurrences; values: 1×4, 2×4, 3×1, 5×2, 6×1, 9×3, 10×1, 50×1, 120×1)
- L287: `120` in `.padding(.{edge}, N)` — off-scale, design review
- L418: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L487: `9` in `.padding(.{edge}, N)` — off-scale, design review
- L505: `9` in `.padding(.{edge}, N)` — off-scale, design review
- L525: `2` in `spacing: N` — off-scale, design review
- L526: `3` in `spacing: N` — off-scale, design review
- L569: `5` in `spacing: N` — off-scale, design review
- L577: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L578: `1` in `.padding(.{edge}, N)` — off-scale, design review
- L651: `1` in `spacing: N` — off-scale, design review
- L663: `10` in `.padding(.{edge}, N)` — off-scale, design review
- L668: `50` in `.padding(.{edge}, N)` — off-scale, design review
- _…6 more in this file_

**`frontend/apps/ios/Pantopus/Features/ReviewClaims/ReviewClaimDetailComponents.swift`** (1 occurrences; values: 2×1)
- L49: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/ReviewClaims/ReviewClaimDetailView.swift`** (2 occurrences; values: 2×2)
- L225: `2` in `spacing: N` — off-scale, design review
- L266: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Shared/ContentDetail/Bodies/PostThreadComponents.swift`** (3 occurrences; values: 2×2, 3×1)
- L104: `2` in `spacing: N` — off-scale, design review
- L140: `3` in `spacing: N` — off-scale, design review
- L160: `2` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Shared/ContentDetail/Bodies/StatsTabsBody.swift`** (4 occurrences; values: 2×3, 6×1)
- L147: `2` in `spacing: N` — off-scale, design review
- L301: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L370: `2` in `spacing: N` — off-scale, design review
- L374: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Shared/ContentDetail/Headers.swift`** (1 occurrences; values: 2×1)
- L56: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Shared/ContentDetail/Headers/PostAuthorHeader.swift`** (1 occurrences; values: 2×1)
- L114: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Shared/Feed/FeedComponents.swift`** (4 occurrences; values: 5×1, 9×1, 14×2)
- L53: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L124: `9` in `spacing: N` — off-scale, design review
- L126: `5` in `spacing: N` — off-scale, design review
- L140: `14` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Shared/Form/FormShell.swift`** (1 occurrences; values: 1×1)
- L186: `1` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Shared/GroupedList/GroupedListView.swift`** (10 occurrences; values: 2×2, 3×1, 6×1, 14×1, 18×4, 22×1)
- L87: `18` in `.padding(.{edge}, N)` — off-scale, design review
- L135: `18` in `.padding(.{edge}, N)` — off-scale, design review
- L145: `18` in `.padding(.{edge}, N)` — off-scale, design review
- L164: `18` in `.padding(.{edge}, N)` — off-scale, design review
- L202: `2` in `spacing: N` — off-scale, design review
- L213: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L220: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L285: `3` in `.padding(.{edge}, N)` — off-scale, design review
- L334: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L356: `22` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Shared/Identity/IdentitySwitcherPillRow.swift`** (3 occurrences; values: 3×1, 5×1, 6×1)
- L51: `6` in `spacing: N` — off-scale, design review
- L57: `5` in `spacing: N` — off-scale, design review
- L78: `3` in `.padding(N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Shared/Identity/IdentitySwitcherSheet.swift`** (7 occurrences; values: 1×1, 3×1, 6×2, 10×1, 14×2)
- L73: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L75: `10` in `spacing: N` — off-scale, design review
- L113: `3` in `spacing: N` — off-scale, design review
- L114: `6` in `spacing: N` — off-scale, design review
- L123: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L124: `1` in `.padding(.{edge}, N)` — off-scale, design review
- L143: `14` in `.padding(N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Shared/ListOfRows/ListOfRowsView.swift`** (16 occurrences; values: 2×11, 3×3, 7×1, 52×1)
- L76: `2` in `spacing: N` — off-scale, design review
- L474: `2` in `spacing: N` — off-scale, design review
- L557: `7` in `.padding(.{edge}, N)` — off-scale, design review
- L630: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L688: `3` in `spacing: N` — off-scale, design review
- L910: `2` in `spacing: N` — off-scale, design review
- L919: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L976: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L984: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L1001: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L1260: `2` in `spacing: N` — off-scale, design review
- L1314: `2` in `.padding(.{edge}, N)` — off-scale, design review
- _…4 more in this file_

**`frontend/apps/ios/Pantopus/Features/Shared/MailItemDetail/ChainOfCustodyTimeline.swift`** (4 occurrences; values: 1×1, 2×2, 3×1)
- L139: `2` in `spacing: N` — off-scale, design review
- L163: `3` in `.padding(.{edge}, N)` — off-scale, design review
- L194: `2` in `spacing: N` — off-scale, design review
- L206: `1` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Shared/MailItemDetail/MailItemDetailShell.swift`** (6 occurrences; values: 1×1, 2×3, 3×1, 60×1)
- L256: `2` in `spacing: N` — off-scale, design review
- L323: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L334: `3` in `spacing: N` — off-scale, design review
- L388: `1` in `.padding(.{edge}, N)` — off-scale, design review
- L435: `60` in `.padding(.{edge}, N)` — off-scale, design review
- L455: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Shared/MapListHybrid/MapListHybridPreview.swift`** (8 occurrences; values: 5×1, 6×2, 10×2, 14×1, 18×1, 60×1)
- L157: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L186: `6` in `spacing: N` — off-scale, design review
- L189: `5` in `spacing: N` — off-scale, design review
- L208: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L256: `18` in `.padding(.{edge}, N)` — off-scale, design review
- L290: `10` in `spacing: N` — off-scale, design review
- L312: `60` in `Spacer(minLength: N)` — off-scale, design review
- L324: `10` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Shared/MapListHybrid/MapListHybridShell.swift`** (2 occurrences; values: 14×2)
- L114: `14` in `.padding(.{edge}, N)` — off-scale, design review
- L185: `14` in `.padding(.{edge}, N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Shared/Wizard/Blocks/RequirementsCardBlock.swift`** (2 occurrences; values: 1×1, 2×1)
- L66: `1` in `.padding(.{edge}, N)` — off-scale, design review
- L67: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Shared/Wizard/Blocks/UploadSlotsBlock.swift`** (1 occurrences; values: 2×1)
- L152: `2` in `spacing: N` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Status/StatusWaitingView.swift`** (7 occurrences; values: 2×2, 6×2, 10×2, 14×1)
- L91: `6` in `spacing: N` — off-scale, design review
- L97: `10` in `.padding(.{edge}, N)` — off-scale, design review
- L98: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L112: `10` in `spacing: N` — off-scale, design review
- L131: `2` in `spacing: N` — off-scale, design review
- L163: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L171: `14` in `.padding(N)` — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/SupportTrains/StartTrain/StartSupportTrainWizardView.swift`** (39 occurrences; values: 1×1, 2×10, 3×1, 5×1, 6×10, 10×12, 14×4)
- L75: `10` in `.padding(.{edge}, N)` — off-scale, design review
- L76: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L104: `6` in `spacing: N` — off-scale, design review
- L137: `6` in `spacing: N` — off-scale, design review
- L184: `10` in `spacing: N` — off-scale, design review
- L186: `2` in `spacing: N` — off-scale, design review
- L201: `10` in `.padding(.{edge}, N)` — off-scale, design review
- L237: `2` in `spacing: N` — off-scale, design review
- L238: `6` in `spacing: N` — off-scale, design review
- L246: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L247: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L286: `10` in `spacing: N` — off-scale, design review
- _…27 more in this file_

**`frontend/apps/ios/Pantopus/Features/TokenAccept/TokenAcceptView.swift`** (13 occurrences; values: 1×1, 2×2, 3×1, 6×4, 10×2, 14×3)
- L103: `6` in `spacing: N` — off-scale, design review
- L109: `6` in `spacing: N` — off-scale, design review
- L138: `3` in `.padding(.{edge}, N)` — off-scale, design review
- L150: `2` in `spacing: N` — off-scale, design review
- L161: `14` in `.padding(N)` — off-scale, design review
- L180: `2` in `.padding(.{edge}, N)` — off-scale, design review
- L188: `14` in `.padding(N)` — off-scale, design review
- L200: `10` in `spacing: N` — off-scale, design review
- L202: `1` in `.padding(.{edge}, N)` — off-scale, design review
- L221: `10` in `.padding(.{edge}, N)` — off-scale, design review
- L222: `6` in `.padding(.{edge}, N)` — off-scale, design review
- L249: `6` in `spacing: N` — off-scale, design review
- _…1 more in this file_


## Android — off-scale layout spacing

**95 files** contain off-scale layout spacing. 870 total occurrences.

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/PantopusTextField.kt`** (1 occurrences; values: 2×1)
- L99: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/PersonaCard.kt`** (4 occurrences; values: 1×1, 2×1, 3×1, 6×1)
- L89: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L178: `1` in `padding(<edge> = N.dp)` — off-scale, design review
- L178: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L180: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/audience_profile/AudienceProfileScreen.kt`** (46 occurrences; values: 1×2, 2×8, 3×2, 5×5, 6×7, 7×1, 9×1, 10×12, 11×1, 14×5, 22×1, 28×1)
- L171: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- L188: `1` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L324: `14` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L403: `14` in `.padding(N.dp)` — off-scale, design review
- L420: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L432: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L636: `22` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L654: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- L727: `14` in `.padding(N.dp)` — off-scale, design review
- L736: `9` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L745: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L760: `5` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- _…34 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/audience_profile/broadcast_detail/BroadcastDetailScreen.kt`** (7 occurrences; values: 1×1, 2×3, 3×1, 6×1, 7×1)
- L315: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L315: `7` in `padding(<edge> = N.dp)` — off-scale, design review
- L318: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L374: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L648: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L687: `1` in `padding(<edge> = N.dp)` — off-scale, design review
- L687: `6` in `padding(<edge> = N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/audience_profile/compose_broadcast/ComposeBroadcastScreen.kt`** (12 occurrences; values: 2×3, 3×3, 5×3, 6×2, 7×1)
- L239: `5` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L341: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L341: `7` in `padding(<edge> = N.dp)` — off-scale, design review
- L449: `5` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L532: `5` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L729: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L760: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L785: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L785: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L787: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L856: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L925: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/audience_profile/edit_persona/EditPersonaScreen.kt`** (38 occurrences; values: 1×5, 2×2, 3×7, 5×3, 6×13, 7×4, 9×1, 11×1, 14×1, 46×1)
- L248: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L250: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L304: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L326: `3` in `padding(<edge> = N.dp)` — off-scale, design review
- L326: `7` in `padding(<edge> = N.dp)` — off-scale, design review
- L349: `1` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L395: `1` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L418: `3` in `padding(<edge> = N.dp)` — off-scale, design review
- L418: `7` in `padding(<edge> = N.dp)` — off-scale, design review
- L508: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L593: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L704: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- _…26 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/auth/reset_password/ResetPasswordScreen.kt`** (1 occurrences; values: 6×1)
- L288: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/auth/sign_up/SignUpScreen.kt`** (2 occurrences; values: 2×1, 6×1)
- L378: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L661: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/business_profile/BusinessProfileScreen.kt`** (5 occurrences; values: 2×3, 96×1, 100×1)
- L138: `100` in `padding(<edge> = N.dp)` — off-scale, design review
- L222: `96` in `Spacer(Modifier.h/w(N.dp))` — off-scale, design review
- L325: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L397: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L805: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/ceremonial_mail/CeremonialMailWizardScreen.kt`** (13 occurrences; values: 2×4, 6×4, 10×3, 14×2)
- L126: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L126: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- L199: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- L202: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L274: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L332: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L376: `14` in `.padding(N.dp)` — off-scale, design review
- L378: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L428: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L524: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L678: `14` in `.padding(N.dp)` — off-scale, design review
- L680: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- _…1 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/ceremonial_mail_open/CeremonialMailOpenScreen.kt`** (43 occurrences; values: 1×2, 2×2, 3×1, 6×15, 7×2, 10×5, 14×10, 18×2, 22×2, 28×1, 80×1)
- L240: `6` in `Spacer(Modifier.h/w(N.dp))` — off-scale, design review
- L417: `22` in `Spacer(Modifier.h/w(N.dp))` — off-scale, design review
- L511: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L556: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L556: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L556: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L556: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L558: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L580: `1` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L607: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L607: `28` in `padding(<edge> = N.dp)` — off-scale, design review
- L634: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- _…31 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/compose/gig/GigComposeMagic.kt`** (2 occurrences; values: 2×1, 10×1)
- L362: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- L565: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/compose/listing/ListingComposeWizardScreen.kt`** (25 occurrences; values: 1×1, 2×5, 3×3, 6×4, 7×1, 9×2, 10×1, 28×4, 96×4)
- L291: `28` in `padding(<edge> = N.dp)` — off-scale, design review
- L291: `96` in `padding(<edge> = N.dp)` — off-scale, design review
- L292: `28` in `padding(<edge> = N.dp)` — off-scale, design review
- L292: `96` in `padding(<edge> = N.dp)` — off-scale, design review
- L864: `3` in `padding(<edge> = N.dp)` — off-scale, design review
- L872: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L879: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L880: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L884: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L931: `3` in `padding(<edge> = N.dp)` — off-scale, design review
- L965: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L981: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- _…13 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/compose/pulse/PulseComposeScreen.kt`** (1 occurrences; values: 2×1)
- L795: `2` in `.padding(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/contentdetail/ContentDetailShell.kt`** (34 occurrences; values: 1×1, 2×2, 3×2, 5×2, 6×9, 10×10, 14×2, 18×3, 22×2, 120×1)
- L139: `6` in `Spacer(Modifier.h/w(N.dp))` — off-scale, design review
- L148: `22` in `padding(<edge> = N.dp)` — off-scale, design review
- L185: `18` in `Spacer(Modifier.h/w(N.dp))` — off-scale, design review
- L189: `22` in `Spacer(Modifier.h/w(N.dp))` — off-scale, design review
- L196: `120` in `Spacer(Modifier.h/w(N.dp))` — off-scale, design review
- L328: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L329: `5` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L365: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- L383: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- L393: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L467: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- L469: `5` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- _…22 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/contentdetail/InvoiceDetailScreen.kt`** (1 occurrences; values: 14×1)
- L74: `14` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/creator_inbox/CreatorInboxScreen.kt`** (24 occurrences; values: 2×4, 3×2, 5×2, 6×7, 10×1, 11×2, 14×2, 18×2, 22×1, 28×1)
- L289: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- L296: `14` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L313: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L383: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L411: `5` in `padding(<edge> = N.dp)` — off-scale, design review
- L411: `11` in `padding(<edge> = N.dp)` — off-scale, design review
- L417: `5` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L529: `3` in `Spacer(Modifier.h/w(N.dp))` — off-scale, design review
- L565: `6` in `Spacer(Modifier.h/w(N.dp))` — off-scale, design review
- L569: `6` in `Spacer(Modifier.h/w(N.dp))` — off-scale, design review
- L573: `6` in `Spacer(Modifier.h/w(N.dp))` — off-scale, design review
- L691: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- _…12 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/discoverhub/DiscoverHubScreen.kt`** (2 occurrences; values: 150×1, 172×1)
- L153: `150` in `padding(<edge> = N.dp)` — off-scale, design review
- L159: `172` in `padding(<edge> = N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/explore/ExploreMapScreen.kt`** (31 occurrences; values: 1×2, 2×2, 3×2, 5×3, 6×5, 10×6, 11×1, 14×6, 18×2, 28×1, 80×1)
- L174: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L174: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L534: `11` in `padding(<edge> = N.dp)` — off-scale, design review
- L535: `5` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L600: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L605: `3` in `padding(<edge> = N.dp)` — off-scale, design review
- L681: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L868: `18` in `padding(<edge> = N.dp)` — off-scale, design review
- L868: `18` in `padding(<edge> = N.dp)` — off-scale, design review
- L893: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L965: `5` in `padding(<edge> = N.dp)` — off-scale, design review
- L1036: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- _…19 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/feed/FeedScreen.kt`** (5 occurrences; values: 10×1, 14×1, 22×2, 80×1)
- L213: `22` in `padding(<edge> = N.dp)` — off-scale, design review
- L244: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- L244: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L283: `80` in `Spacer(Modifier.h/w(N.dp))` — off-scale, design review
- L327: `22` in `padding(<edge> = N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/feed/pulse/PulsePostCard.kt`** (4 occurrences; values: 2×2, 9×1, 14×1)
- L125: `9` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L133: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L239: `14` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L325: `2` in `padding(<edge> = N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/gigs/GigsFeedScreen.kt`** (24 occurrences; values: 2×5, 3×1, 5×4, 6×2, 10×6, 14×3, 22×2, 110×1)
- L141: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- L187: `2` in `.padding(N.dp)` — off-scale, design review
- L189: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L215: `5` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L243: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L247: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L293: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L321: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- L329: `5` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L383: `5` in `padding(<edge> = N.dp)` — off-scale, design review
- L383: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- L385: `5` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- _…12 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/gigs/quickpost/PostGigV1Screen.kt`** (2 occurrences; values: 2×1, 5×1)
- L647: `5` in `.padding(N.dp)` — off-scale, design review
- L733: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/gigs/tasks_map/TasksMapScreen.kt`** (24 occurrences; values: 1×1, 5×2, 6×6, 7×1, 10×5, 14×5, 18×3, 28×1)
- L159: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L222: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L224: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L245: `5` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L285: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L285: `18` in `padding(<edge> = N.dp)` — off-scale, design review
- L290: `7` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L361: `18` in `padding(<edge> = N.dp)` — off-scale, design review
- L361: `18` in `padding(<edge> = N.dp)` — off-scale, design review
- L447: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L482: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L534: `1` in `padding(<edge> = N.dp)` — off-scale, design review
- _…12 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/handshake/PrivacyHandshakeScreen.kt`** (10 occurrences; values: 2×4, 10×4, 14×2)
- L107: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L184: `14` in `.padding(N.dp)` — off-scale, design review
- L201: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L292: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L318: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L343: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L353: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L417: `14` in `.padding(N.dp)` — off-scale, design review
- L438: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L469: `10` in `.padding(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/bills/BillDetailScreen.kt`** (2 occurrences; values: 3×2)
- L324: `3` in `padding(<edge> = N.dp)` — off-scale, design review
- L326: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/calendar/MonthStripHeader.kt`** (5 occurrences; values: 2×1, 3×1, 6×1, 10×2)
- L90: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- L94: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L241: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L248: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L275: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/documents/DocumentDetailScreen.kt`** (1 occurrences; values: 80×1)
- L292: `80` in `Spacer(Modifier.h/w(N.dp))` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/documents/UploadDocumentFormScreen.kt`** (3 occurrences; values: 2×3)
- L277: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L570: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L705: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/emergency/AddEmergencyInfoFormScreen.kt`** (1 occurrences; values: 100×1)
- L142: `100` in `padding(<edge> = N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/guests/AddGuestFormScreen.kt`** (2 occurrences; values: 2×1, 3×1)
- L327: `3` in `padding(<edge> = N.dp)` — off-scale, design review
- L337: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/invite_owner/InviteOwnerFormScreen.kt`** (3 occurrences; values: 2×1, 3×2)
- L435: `3` in `padding(<edge> = N.dp)` — off-scale, design review
- L477: `3` in `padding(<edge> = N.dp)` — off-scale, design review
- L633: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/members/InviteMemberWizardSheet.kt`** (1 occurrences; values: 2×1)
- L223: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/hub/HubScreen.kt`** (1 occurrences; values: 96×1)
- L192: `96` in `Spacer(Modifier.h/w(N.dp))` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/hub/sections/HubSections.kt`** (11 occurrences; values: 2×5, 3×1, 5×2, 6×3)
- L120: `6` in `.padding(N.dp)` — off-scale, design review
- L313: `3` in `padding(<edge> = N.dp)` — off-scale, design review
- L422: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L434: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L575: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L605: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L726: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L789: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L809: `5` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L859: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L1129: `5` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/hub/today/TodayDetailScreen.kt`** (3 occurrences; values: 2×3)
- L356: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L549: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L622: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/identity_center/IdentityCenterScreen.kt`** (14 occurrences; values: 1×2, 2×2, 6×4, 10×1, 14×4, 18×1)
- L250: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L251: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L274: `14` in `.padding(N.dp)` — off-scale, design review
- L277: `14` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L301: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L318: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L351: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L375: `1` in `padding(<edge> = N.dp)` — off-scale, design review
- L375: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L401: `1` in `padding(<edge> = N.dp)` — off-scale, design review
- L401: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L499: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- _…2 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/chat/ChatListScreen.kt`** (11 occurrences; values: 5×1, 6×1, 7×1, 10×3, 14×3, 22×2)
- L101: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- L146: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L150: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L226: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L240: `5` in `padding(<edge> = N.dp)` — off-scale, design review
- L282: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L287: `7` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L341: `22` in `padding(<edge> = N.dp)` — off-scale, design review
- L368: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- L368: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L437: `22` in `padding(<edge> = N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/chat/ConversationRow.kt`** (9 occurrences; values: 1×2, 2×1, 3×1, 6×4, 14×1)
- L54: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L176: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L177: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L201: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L216: `1` in `padding(<edge> = N.dp)` — off-scale, design review
- L216: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L253: `1` in `padding(<edge> = N.dp)` — off-scale, design review
- L253: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L255: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/conversation/ChatConversationScreen.kt`** (98 occurrences; values: 1×6, 2×8, 3×9, 5×7, 6×20, 7×3, 9×5, 10×21, 13×2, 14×15, 18×1, 22×1)
- L277: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L277: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- L280: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L303: `1` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L304: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L326: `5` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L388: `1` in `padding(<edge> = N.dp)` — off-scale, design review
- L388: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L407: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L407: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L409: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L435: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- _…86 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/conversation/ai/AiComponents.kt`** (4 occurrences; values: 6×1, 10×3)
- L82: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- L85: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L115: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- L121: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/newmessage/NewMessageScreen.kt`** (18 occurrences; values: 2×1, 5×1, 6×1, 9×1, 10×5, 11×2, 14×4, 18×2, 22×1)
- L190: `9` in `padding(<edge> = N.dp)` — off-scale, design review
- L265: `18` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L275: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L298: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- L298: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L300: `11` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L309: `5` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L330: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L432: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L432: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- L466: `18` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L526: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- _…6 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/search/ChatSearchScreen.kt`** (5 occurrences; values: 1×1, 2×1, 3×1, 6×2)
- L110: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L113: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L203: `1` in `padding(<edge> = N.dp)` — off-scale, design review
- L203: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L205: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/disambiguate/DisambiguateMailFormScreen.kt`** (2 occurrences; values: 96×1, 110×1)
- L116: `96` in `Spacer(Modifier.h/w(N.dp))` — off-scale, design review
- L131: `110` in `padding(<edge> = N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/MailboxItemDetailScreen.kt`** (1 occurrences; values: 100×1)
- L176: `100` in `padding(<edge> = N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/MailboxItemDetailShell.kt`** (1 occurrences; values: 120×1)
- L165: `120` in `Spacer(Modifier.h/w(N.dp))` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/CategoryBodies.kt`** (3 occurrences; values: 2×2, 3×1)
- L111: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L391: `3` in `padding(<edge> = N.dp)` — off-scale, design review
- L637: `2` in `padding(<edge> = N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/CommunityBody.kt`** (5 occurrences; values: 1×1, 2×3, 6×1)
- L205: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L205: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L371: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L591: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L729: `1` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/CouponBody.kt`** (1 occurrences; values: 7×1)
- L403: `7` in `padding(<edge> = N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/MemoryBody.kt`** (2 occurrences; values: 1×1, 2×1)
- L361: `1` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L503: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/BidderProfileCard.kt`** (3 occurrences; values: 2×2, 3×1)
- L146: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L165: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L211: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/CertifiedConfirmGate.kt`** (1 occurrences; values: 2×1)
- L283: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/CertifiedTermsSheet.kt`** (1 occurrences; values: 2×1)
- L170: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/CouponHero.kt`** (1 occurrences; values: 3×1)
- L175: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/OtherBidsStrip.kt`** (2 occurrences; values: 2×1, 3×1)
- L67: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L145: `2` in `padding(<edge> = N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/PostSummaryCard.kt`** (6 occurrences; values: 2×1, 3×3, 5×2)
- L86: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L152: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L152: `5` in `padding(<edge> = N.dp)` — off-scale, design review
- L154: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L177: `3` in `padding(<edge> = N.dp)` — off-scale, design review
- L179: `5` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/MailDetailScreen.kt`** (8 occurrences; values: 1×1, 3×4, 10×1, 14×1, 110×1)
- L146: `110` in `padding(<edge> = N.dp)` — off-scale, design review
- L455: `3` in `padding(<edge> = N.dp)` — off-scale, design review
- L457: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L518: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L543: `3` in `padding(<edge> = N.dp)` — off-scale, design review
- L613: `1` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L722: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L770: `10` in `padding(<edge> = N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/components/BookletPager.kt`** (1 occurrences; values: 1×1)
- L340: `1` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/components/CertifiedComponents.kt`** (8 occurrences; values: 1×1, 2×4, 3×1, 6×1, 9×1)
- L75: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L75: `9` in `padding(<edge> = N.dp)` — off-scale, design review
- L78: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L96: `1` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L212: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L321: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L385: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L387: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/variants/BookletDetailLayout.kt`** (5 occurrences; values: 1×1, 2×1, 3×1, 10×1, 14×1)
- L224: `3` in `padding(<edge> = N.dp)` — off-scale, design review
- L291: `1` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L362: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L395: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L444: `10` in `padding(<edge> = N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/variants/CertifiedDetailLayout.kt`** (8 occurrences; values: 3×3, 9×2, 11×1, 14×1, 18×1)
- L406: `3` in `padding(<edge> = N.dp)` — off-scale, design review
- L497: `9` in `padding(<edge> = N.dp)` — off-scale, design review
- L534: `9` in `padding(<edge> = N.dp)` — off-scale, design review
- L569: `3` in `padding(<edge> = N.dp)` — off-scale, design review
- L597: `3` in `padding(<edge> = N.dp)` — off-scale, design review
- L809: `18` in `padding(<edge> = N.dp)` — off-scale, design review
- L840: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L880: `11` in `padding(<edge> = N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/variants/CommunityDetailLayout.kt`** (22 occurrences; values: 1×2, 2×8, 3×4, 5×1, 6×4, 9×1, 10×1, 14×1)
- L349: `3` in `padding(<edge> = N.dp)` — off-scale, design review
- L443: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L443: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L560: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L591: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L611: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L612: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L642: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L653: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L661: `3` in `padding(<edge> = N.dp)` — off-scale, design review
- L731: `3` in `padding(<edge> = N.dp)` — off-scale, design review
- L747: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- _…10 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mailbox_map/MailboxMapScreen.kt`** (33 occurrences; values: 1×2, 2×1, 3×1, 5×4, 6×2, 7×1, 9×1, 10×7, 14×7, 18×5, 56×1, 80×1)
- L191: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L191: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L202: `56` in `padding(<edge> = N.dp)` — off-scale, design review
- L524: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L579: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L581: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L626: `5` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L748: `18` in `padding(<edge> = N.dp)` — off-scale, design review
- L748: `18` in `padding(<edge> = N.dp)` — off-scale, design review
- L822: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L857: `80` in `Spacer(Modifier.h/w(N.dp))` — off-scale, design review
- L887: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- _…21 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mailbox_root/MailboxRootContent.kt`** (3 occurrences; values: 5×2, 14×1)
- L134: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L174: `5` in `padding(<edge> = N.dp)` — off-scale, design review
- L245: `5` in `padding(<edge> = N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/marketplace/MarketplaceScreen.kt`** (25 occurrences; values: 2×1, 3×1, 5×1, 6×2, 7×1, 10×12, 14×3, 22×2, 110×2)
- L172: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L176: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L260: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L309: `110` in `padding(<edge> = N.dp)` — off-scale, design review
- L310: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L311: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L371: `22` in `padding(<edge> = N.dp)` — off-scale, design review
- L410: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- L410: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L448: `110` in `padding(<edge> = N.dp)` — off-scale, design review
- L449: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L450: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- _…13 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/membership/MembershipDetailScreen.kt`** (7 occurrences; values: 1×1, 2×3, 3×2, 50×1)
- L335: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L470: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L512: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L514: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L571: `1` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L612: `50` in `padding(<edge> = N.dp)` — off-scale, design review
- L660: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/nearby/map/NearbyMapScreen.kt`** (22 occurrences; values: 1×3, 2×1, 5×1, 6×6, 7×1, 10×3, 14×4, 18×2, 56×1)
- L172: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L172: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L182: `56` in `padding(<edge> = N.dp)` — off-scale, design review
- L437: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L499: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L501: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L522: `5` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L558: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L744: `18` in `padding(<edge> = N.dp)` — off-scale, design review
- L744: `18` in `padding(<edge> = N.dp)` — off-scale, design review
- L820: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L902: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- _…10 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/posts/PulsePostDetailScreen.kt`** (1 occurrences; values: 100×1)
- L108: `100` in `padding(<edge> = N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/profile/EditProfileScreen.kt`** (1 occurrences; values: 2×1)
- L571: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/profile/PublicProfileChrome.kt`** (5 occurrences; values: 2×2, 3×3)
- L228: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L230: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L281: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L314: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L316: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/profile/PublicProfileNeighbor.kt`** (14 occurrences; values: 1×1, 2×3, 3×1, 5×2, 6×1, 9×3, 10×1, 50×1, 120×1)
- L222: `120` in `Spacer(Modifier.h/w(N.dp))` — off-scale, design review
- L345: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L419: `9` in `padding(<edge> = N.dp)` — off-scale, design review
- L446: `9` in `padding(<edge> = N.dp)` — off-scale, design review
- L466: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L470: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L516: `5` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L534: `1` in `padding(<edge> = N.dp)` — off-scale, design review
- L534: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L593: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- L634: `50` in `padding(<edge> = N.dp)` — off-scale, design review
- L660: `5` in `padding(<edge> = N.dp)` — off-scale, design review
- _…2 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/profile/PublicProfileScreen.kt`** (1 occurrences; values: 100×1)
- L137: `100` in `padding(<edge> = N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/profile/professional/ProfessionalProfileScreen.kt`** (5 occurrences; values: 2×3, 3×1, 22×1)
- L264: `3` in `padding(<edge> = N.dp)` — off-scale, design review
- L553: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L666: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L678: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L1120: `22` in `Spacer(Modifier.h/w(N.dp))` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/review_claims/ReviewClaimDetailScreen.kt`** (3 occurrences; values: 2×3)
- L381: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L435: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L649: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/root/PantopusBottomBar.kt`** (1 occurrences; values: 3×1)
- L157: `3` in `padding(<edge> = N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/content_detail/Headers.kt`** (1 occurrences; values: 2×1)
- L86: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/content_detail/bodies/BodyReactionsBody.kt`** (3 occurrences; values: 2×1, 3×1, 6×1)
- L376: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L484: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L581: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/content_detail/bodies/StatsTabsBody.kt`** (2 occurrences; values: 2×1, 6×1)
- L324: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L403: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/feed/FeedComponents.kt`** (4 occurrences; values: 5×1, 9×1, 14×2)
- L89: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L160: `9` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L162: `5` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L173: `14` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/form/FormShell.kt`** (1 occurrences; values: 1×1)
- L238: `1` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/grouped_list/GroupedListScreen.kt`** (9 occurrences; values: 2×2, 3×1, 6×1, 14×1, 18×3, 22×1)
- L207: `18` in `padding(<edge> = N.dp)` — off-scale, design review
- L238: `18` in `padding(<edge> = N.dp)` — off-scale, design review
- L264: `18` in `padding(<edge> = N.dp)` — off-scale, design review
- L339: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L358: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L467: `3` in `padding(<edge> = N.dp)` — off-scale, design review
- L493: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L554: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L610: `22` in `padding(<edge> = N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/identity/IdentitySwitcherPillRow.kt`** (3 occurrences; values: 3×1, 5×1, 6×1)
- L65: `3` in `.padding(N.dp)` — off-scale, design review
- L67: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L84: `5` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/identity/IdentitySwitcherSheet.kt`** (7 occurrences; values: 1×1, 3×1, 6×2, 10×1, 14×2)
- L102: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L105: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L132: `14` in `.padding(N.dp)` — off-scale, design review
- L155: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L159: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L205: `1` in `padding(<edge> = N.dp)` — off-scale, design review
- L205: `6` in `padding(<edge> = N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/list_of_rows/ListOfRowsScreen.kt`** (13 occurrences; values: 2×8, 3×3, 7×1, 52×1)
- L493: `7` in `padding(<edge> = N.dp)` — off-scale, design review
- L582: `2` in `Spacer(Modifier.h/w(N.dp))` — off-scale, design review
- L650: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L700: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L749: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L1061: `2` in `Spacer(Modifier.h/w(N.dp))` — off-scale, design review
- L1065: `2` in `Spacer(Modifier.h/w(N.dp))` — off-scale, design review
- L1102: `2` in `Spacer(Modifier.h/w(N.dp))` — off-scale, design review
- L1561: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L1832: `3` in `padding(<edge> = N.dp)` — off-scale, design review
- L1855: `52` in `padding(<edge> = N.dp)` — off-scale, design review
- L1972: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- _…1 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/mail_item_detail/ChainOfCustodyTimeline.kt`** (5 occurrences; values: 1×1, 2×2, 3×1, 11×1)
- L127: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L150: `3` in `padding(<edge> = N.dp)` — off-scale, design review
- L167: `11` in `padding(<edge> = N.dp)` — off-scale, design review
- L193: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L211: `1` in `padding(<edge> = N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/mail_item_detail/MailItemDetailShell.kt`** (10 occurrences; values: 1×1, 2×4, 3×1, 6×2, 60×1, 96×1)
- L133: `96` in `Spacer(Modifier.h/w(N.dp))` — off-scale, design review
- L202: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L236: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L262: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L420: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L432: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L435: `3` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L475: `1` in `padding(<edge> = N.dp)` — off-scale, design review
- L562: `60` in `padding(<edge> = N.dp)` — off-scale, design review
- L582: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/map_list_hybrid/MapListHybridPreview.kt`** (11 occurrences; values: 5×1, 6×2, 10×2, 14×4, 18×2)
- L89: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L89: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L112: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L177: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L222: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L224: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L244: `5` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L305: `18` in `padding(<edge> = N.dp)` — off-scale, design review
- L305: `18` in `padding(<edge> = N.dp)` — off-scale, design review
- L393: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L434: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/map_list_hybrid/MapListHybridShell.kt`** (4 occurrences; values: 14×3, 56×1)
- L186: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L186: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L198: `56` in `padding(<edge> = N.dp)` — off-scale, design review
- L210: `14` in `padding(<edge> = N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/wizard/blocks/RequirementsCardBlock.kt`** (1 occurrences; values: 1×1)
- L78: `1` in `padding(<edge> = N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/wizard/blocks/UploadSlotsBlock.kt`** (1 occurrences; values: 2×1)
- L244: `2` in `Spacer(Modifier.h/w(N.dp))` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/status/StatusWaitingScreen.kt`** (8 occurrences; values: 2×2, 6×2, 10×3, 14×1)
- L83: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L157: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L157: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- L160: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L208: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L238: `14` in `.padding(N.dp)` — off-scale, design review
- L260: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L360: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/support_trains/edit_signup/EditSignupFormScreen.kt`** (1 occurrences; values: 100×1)
- L116: `100` in `padding(<edge> = N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/support_trains/start_train/StartSupportTrainWizardScreen.kt`** (1 occurrences; values: 10×1)
- L844: `10` in `padding(<edge> = N.dp)` — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/token_accept/TokenAcceptScreen.kt`** (18 occurrences; values: 1×1, 2×2, 3×1, 6×8, 10×3, 14×2, 22×1)
- L177: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L204: `3` in `padding(<edge> = N.dp)` — off-scale, design review
- L227: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L254: `14` in `.padding(N.dp)` — off-scale, design review
- L275: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L302: `14` in `.padding(N.dp)` — off-scale, design review
- L324: `2` in `padding(<edge> = N.dp)` — off-scale, design review
- L347: `10` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L355: `1` in `padding(<edge> = N.dp)` — off-scale, design review
- L368: `6` in `padding(<edge> = N.dp)` — off-scale, design review
- L368: `10` in `padding(<edge> = N.dp)` — off-scale, design review
- L437: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- _…6 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/you/me/MeView.kt`** (12 occurrences; values: 1×1, 2×2, 5×1, 6×2, 14×5, 22×1)
- L208: `14` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L210: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L326: `2` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L412: `6` in `Arrangement.spacedBy(N.dp)` — off-scale, design review
- L433: `6` in `.padding(N.dp)` — off-scale, design review
- L437: `1` in `padding(<edge> = N.dp)` — off-scale, design review
- L437: `5` in `padding(<edge> = N.dp)` — off-scale, design review
- L480: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L519: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L549: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L549: `14` in `padding(<edge> = N.dp)` — off-scale, design review
- L606: `22` in `padding(<edge> = N.dp)` — off-scale, design review

