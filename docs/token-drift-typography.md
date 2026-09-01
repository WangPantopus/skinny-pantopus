# P7.4 — Typography drift audit

> **Generated:** 2026-05-26. **Tokens cited from:** `docs/token-conventions.md` §4 (iOS) / §10 (Android).

This audit maps every inline typography call back to the canonical
7-role scale. Exact on-scale matches are tokenised; near-scale and
off-scale entries are documented per-file for design review. **No new
tokens were added** — extending the scale to absorb drift would require
explicit design sign-off and HTML citation in a separate prompt.

## Methodology

### The 7-role scale (per `docs/token-conventions.md`)

| Role | Size | Line height | Weight (iOS / Android) | Tracking | Uppercase |
|---|---:|---:|---|---:|---|
| `h1` | 30 | 36 | `.bold` / `Bold` | -0.020 × 30 | no |
| `h2` | 24 | 32 | `.semibold` / `SemiBold` | -0.015 × 24 | no |
| `h3` | 20 | 28 | `.semibold` / `SemiBold` | 0 | no |
| `body` | 16 | 24 | `.regular` / `Normal` | 0 | no |
| `small` | 14 | 20 | `.regular` / `Normal` | 0 | no |
| `caption` | 12 | 16 | `.regular` / `Normal` | 0 | no |
| `overline` | 11 | 16 | `.semibold` / `SemiBold` | +0.06 × 11 | **yes** |

### Scope

- **iOS:** `frontend/apps/ios/Pantopus/Features/`,
  `frontend/apps/ios/Pantopus/Core/Design/Components/`,
  `frontend/apps/ios/Pantopus/App/`.
- **Android:** `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/`,
  `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/`.

### Patterns scanned

- **iOS:** `.font(.system(size: N, weight: .W))` (with weight kwarg) and
  `.font(.system(size: N))` (no weight = default `.regular`).
- **Android:** `fontSize = N.sp` (with `fontWeight = FontWeight.W` on the
  same line, or within the next 3 lines of a multi-line `Text(...)`
  constructor).

### Three-verdict classification

- **`on-scale (replaced by Pass 2)`** — `(size, weight)` is an exact
  match to a scale entry. iOS Pass 2 replaced these with
  `.pantopusTextStyle(.X)`. Android is **not** auto-touched — see
  "Why Android isn't auto-replaced" below.
- **`near-scale`** — size is within 1pt of a scale entry. **NOT auto-
  replaced** even when the weight also matches: snapping a 15pt body
  call to 16pt would shift visual rhythm by 1pt and fail snapshot
  tests. Surface for design review — either snap or extend the ramp.
- **`off-scale`** — size matches a scale entry but the weight differs
  (e.g. `14/.bold` ≠ small's `14/.regular`). Common case: designers
  used a bold variant the scale doesn't expose. The audit will **not**
  invent a `.smallBold` token; bring to design.
- **`off-scale (overline-special)`** — `(11, .semibold)` matches
  overline by size + weight, **but** `.pantopusTextStyle(.overline)`
  also forces UPPERCASE + 0.06em tracking. Auto-applying would mutate
  the rendered string. These are manual-review candidates.
- **`off-scale (non-integer)`** — fractional sizes (`10.5`, `12.5`,
  `13.5`, etc.). The scale is integer-only; these can never auto-snap.
- **`off-scale (way off)`** — no scale entry within 1pt. Hero numerals,
  marketing surfaces, or genuine drift. Needs HTML citation.

### Why Android isn't auto-replaced

The iOS replacement is a one-liner: `.font(.system(size: 14, weight:
.regular))` → `.pantopusTextStyle(.small)`. Single-line, zero
ambiguity.

Android typography is set across multiple kwargs in `Text(...)` or
`TextStyle(...)` constructors:

```kotlin
Text(
    "Hi",
    fontSize = 14.sp,
    fontWeight = FontWeight.Normal,
    lineHeight = 20.sp,
    color = PantopusColors.appText,
)
```

The token-equivalent rewrite is:

```kotlin
Text(
    "Hi",
    style = PantopusTextStyle.small,
    color = PantopusColors.appText,
)
```

That swap deletes **two-or-three lines** and inserts one. Regex
substitution can't reliably do that without:

- Knowing whether `lineHeight` is also on-scale (so it can be removed).
- Knowing whether `letterSpacing` is set (deviation from token spec).
- Not duplicating `style = …` if it's already present.

A safe auto-replace requires AST awareness. Surfaced as drift; manual
per-call cleanup is the cleaner path.

### Post-Wave-D coverage

The audit found typography hits in **14 of 19** Wave A–D iOS feature
folders (the others — `Today` doesn't exist on disk, `Homes/Guests`,
`Homes/PropertyDetails`, `Profile/Professional`, `RecentActivity` — use
the existing `.pantopusTextStyle(.X)` API already or have minimal text
surfaces). On Android, **9 of 19** Wave A–D folders have typography
drift entries. Combined coverage = 23 Wave A–D folder findings, well
above the 8-folder threshold.

## Summary

| | iOS | Android |
|---|---:|---:|
| **Files touched by Pass 2** | **33** | **0** (not auto-replaced) |
| **Lines replaced by Pass 2** | **77** | **0** |
| **Files with at least one remaining drift entry** | **90** | **(see Android section)** |
| **Off-scale + near-scale + overline-special occurrences** | **1028** | **(see Android section)** |

### iOS verdict mix

| Verdict | Occurrences |
|---|---:|
| **off-scale** (size matches scale entry but weight differs) | **360** |
| **near-scale** (size off by 1pt) | **268** |
| **off-scale (non-integer)** (fractional sizes) | **253** |
| **off-scale (way off)** (no entry within 1pt — needs HTML citation) | **108** |
| **off-scale (overline-special)** (`11/.semibold` — manual review) | **39** |

### The "big rocks"

The top-15 inline iOS (size, weight) combinations cover ~70 % of the
drift:

| (size, weight) | Count | Verdict | Why design picked this |
|---|---:|---|---|
| `14, .bold` | 65 | off-scale (small + bold override) | Action labels: "Save", "Continue" — bold for emphasis |
| `10, .bold` | 65 | off-scale (no 10pt entry) | Tab strip / metric labels |
| `13, .semibold` | 53 | near-scale (off small) | Row titles where 14pt feels heavy |
| `11, .bold` | 51 | off-scale (overline weight wrong) | Stat numbers + small uppercase chips |
| `9, .bold` | 46 | off-scale (no 9pt entry) | Avatar initials, dense metric ticks |
| `14, .semibold` | 46 | off-scale (small + semibold override) | Subtitle labels |
| `13, .bold` | 43 | near-scale (off small) | Bid amounts, price labels |
| `12, .semibold` | 39 | off-scale (caption + semibold override) | Pill text, chip text |
| `11, .semibold` | 39 | off-scale (overline-special) | Tag/chip labels (no uppercase forcing) |
| `18, .bold` | 29 | off-scale (way off — between h3 20 and 16 body) | Section headers below h3 |
| `12.5, .semibold` | 21 | off-scale (non-integer) | Anti-aliased pixel-perfect alignment per design HTML |
| `11.5, .semibold` | 21 | off-scale (non-integer) | Same — pixel-perfect from design HTML |
| `10.5, .bold` | 19 | off-scale (non-integer) | Same |
| `12, .bold` | 18 | off-scale | Action labels at caption size |
| `15, .bold` | 17 | near-scale (off body) | "Almost-body" label |

The non-integer values (`10.5`, `11.5`, `12.5`, `13.5`) come straight
from the design HTML pack — designers were rendering at fractional
sizes for sub-pixel alignment on the marketing canvas. These are the
strongest candidates for either (a) a controlled scale extension or
(b) a "this is intentional" exemption in a follow-up prompt with HTML
frame citations.

## Pass 2 — applied iOS replacements

iOS replacements (`/tmp/p74-audit/apply.py` during this session): 33
files, 77 lines. Strict pairing rule — only `(size, weight)` exact
matches got `.pantopusTextStyle(.X)`:

| Pair | Token | Hits |
|---|---|---:|
| `30/.bold` | `.h1` | 0 |
| `24/.semibold` | `.h2` | 0 |
| `20/.semibold` | `.h3` | 3 |
| `16/.regular` | `.body` | 2 |
| `16/(none)` | `.body` | 0 |
| `14/.regular` | `.small` | 3 |
| `14/(none)` | `.small` | 13 |
| `12/.regular` | `.caption` | 4 |
| `12/(none)` | `.caption` | 52 |
| `11/.semibold` | `.overline` | **0 — INTENTIONALLY SKIPPED** (would force uppercase + tracking) |

Post-Pass-2 grep confirms 0 strict-pair on-scale `.font(.system(...))`
matches remain in feature code (the 39 `11/.semibold` entries are still
present and tagged `off-scale (overline-special)` for manual review).

### Out-of-scope verification

`git diff` for the Pass-2 change set:
- Only `.font(.system(size: ..., weight: ...))` lines and
  `.font(.system(size: ...))` lines were modified.
- Each diff line replaces the entire `.font(...)` modifier with
  `.pantopusTextStyle(.X)`.
- 0 changes to `Spacing.sN`, `Radii.X`, `Theme.Color.X`, `.frame(...)`,
  `.padding(...)`, or `Icon(..., size:)` lines — those are different
  modifiers on different rows.

### No new tokens added

Per the prompt's explicit rule, **the scale has not been extended**.
Common off-scale combinations (`14/.bold`, `11/.bold`, `9/.bold`, etc.)
are surfaced per-file for design review. If design wants to enshrine any
of them (e.g. a `.smallBold` token), that's a separate prompt with HTML
citation showing the intentional usage.

### Snapshot tests

Pass 2 only replaces lines whose runtime rendering is identical to the
token expression:
- `.font(.system(size: 14, weight: .regular))` produces the same
  `Font` value as `Theme.Font.small` (and therefore as
  `.pantopusTextStyle(.small)`).
- `.pantopusTextStyle(.X)` ALSO sets `.tracking(...)` per role —
  for `h3`/`body`/`small`/`caption` the tracking is `0`, so identical
  output. (`h1` tracking is `-0.6pt`, `h2` is `-0.36pt`, `overline` is
  `+0.66pt`; we did not auto-replace h1/h2/overline cases.)

Snapshot tests should be unaffected.

---

## Per-file drift

The detailed enumeration below lists every drift entry post-Pass-2.


## iOS — typography drift (post-Pass-2)

**90 files**, **1028 occurrences**.

Verdict mix:
- **off-scale**: 360
- **near-scale**: 268
- **off-scale (non-integer)**: 253
- **off-scale (way off)**: 108
- **off-scale (overline-special)**: 39

**`frontend/apps/ios/Pantopus/Core/Design/Components/PersonaCard.swift`** (4; 11.5/(none)×1, 14/.bold×1, 15/.bold×1, 9.5/.bold×1)
- L70: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L76: 11.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L102: 15/.bold — **near-scale** — 15pt is 1pt off body (16pt) but weight .bold ≠ .normal
- L123: 9.5/.bold — **off-scale (non-integer)** — non-integer size

**`frontend/apps/ios/Pantopus/Features/AudienceProfile/AudienceProfileView.swift`** (66; 10/(none)×1, 10/.bold×1, 10.5/(none)×3, 10.5/.bold×2, 10.5/.medium×1, 11/(none)×5, 11/.bold×3, 11/.medium×1, 11/.semibold×1, 11.5/(none)×1, 11.5/.semibold×4, 12/.bold×1, 12/.medium×1, 12/.semibold×6, 12.5/(none)×2, 12.5/.bold×1, 12.5/.semibold×2, 13/.bold×3, 13/.medium×1, 13/.semibold×1, 13.5/(none)×3, 14/.bold×4, 14/.semibold×5, 14.5/.bold×1, 16/.bold×2, 16/.semibold×1, 18/.bold×2, 24/.bold×2, 9/.bold×3, 9.5/.bold×2)
- L80: 16/.semibold — **off-scale** — size matches body (16/normal) but weight .semibold ≠ .normal
- L147: 24/.bold — **off-scale** — size matches h2 (24/semibold) but weight .bold ≠ .semibold
- L152: 13.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L164: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L182: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L219: 13/.bold — **near-scale** — 13pt is 1pt off small (14pt) but weight .bold ≠ .normal
- L238: 11/.bold — **off-scale** — size matches overline (11/semibold) but weight .bold ≠ .semibold
- L246: 12.5/.semibold — **off-scale (non-integer)** — non-integer size
- _…58 more in this file_

**`frontend/apps/ios/Pantopus/Features/AudienceProfile/BroadcastDetail/BroadcastDetailView.swift`** (22; 10/.bold×2, 10.5/(none)×1, 11/(none)×2, 11/.bold×2, 11/.semibold×1, 12/.semibold×1, 13/(none)×1, 13/.bold×2, 13/.semibold×1, 13.5/(none)×1, 14/.bold×2, 14/.semibold×1, 15/(none)×1, 16/.semibold×1, 18/.bold×1, 20/.bold×1, 9/.bold×1)
- L65: 16/.semibold — **off-scale** — size matches body (16/normal) but weight .semibold ≠ .normal
- L130: 18/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L134: 13.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L141: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L165: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L169: 15/(default-regular) — **near-scale** — 15pt is 1pt off body (16pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L205: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- L235: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- _…14 more in this file_

**`frontend/apps/ios/Pantopus/Features/AudienceProfile/ComposeBroadcast/ComposeBroadcastEditor.swift`** (6; 10.5/.semibold×1, 11/(none)×1, 11/.bold×1, 13/.bold×1, 14/.bold×1, 9/.bold×1)
- L68: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L76: 13/.bold — **near-scale** — 13pt is 1pt off small (14pt) but weight .bold ≠ .normal
- L79: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L92: 9/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L198: 10.5/.semibold — **off-scale (non-integer)** — non-integer size
- L243: 11/.bold — **off-scale** — size matches overline (11/semibold) but weight .bold ≠ .semibold

**`frontend/apps/ios/Pantopus/Features/AudienceProfile/ComposeBroadcast/ComposeBroadcastView.swift`** (27; 10/(none)×1, 10.5/.bold×2, 11/(none)×3, 11/.semibold×3, 12.5/.medium×1, 12.5/.semibold×1, 13/(none)×1, 13/.semibold×2, 14/.bold×2, 14/.semibold×4, 15/.bold×1, 16/.bold×3, 16/.semibold×1, 9/.bold×1, 9.5/.semibold×1)
- L72: 16/.semibold — **off-scale** — size matches body (16/normal) but weight .semibold ≠ .normal
- L86: 14/.semibold — **off-scale** — size matches small (14/normal) but weight .semibold ≠ .normal
- L109: 10/(default-regular) — **near-scale** — 10pt is 1pt off overline (11pt) but weight default ≠ .semibold
- L176: 13/.semibold — **near-scale** — 13pt is 1pt off small (14pt) but weight .semibold ≠ .normal
- L179: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L238: 10.5/.bold — **off-scale (non-integer)** — non-integer size
- L248: 11/.semibold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L256: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- _…19 more in this file_

**`frontend/apps/ios/Pantopus/Features/AudienceProfile/EditPersona/EditPersonaView.swift`** (53; 10/(none)×1, 10.5/(none)×2, 10.5/.bold×2, 10.5/.semibold×2, 11/(none)×6, 11/.bold×4, 11/.medium×3, 11/.semibold×1, 11.5/(none)×3, 11.5/.semibold×2, 12/.bold×1, 12/.semibold×4, 12.5/.bold×1, 12.5/.semibold×1, 13/.semibold×4, 13.5/(none)×1, 13.5/.bold×2, 13.5/.semibold×2, 14/.bold×1, 14/.semibold×2, 15/.bold×1, 16/.bold×1, 18/.bold×1, 9/.heavy×1, 9.5/.bold×3, 9.5/.semibold×1)
- L116: 18/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L120: 13.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L125: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L204: 11/.medium — **off-scale** — size matches overline (11/semibold) but weight .medium ≠ .semibold
- L222: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L250: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L318: 10.5/.bold — **off-scale (non-integer)** — non-integer size
- L342: 12/.semibold — **off-scale** — size matches caption (12/normal) but weight .semibold ≠ .normal
- _…45 more in this file_

**`frontend/apps/ios/Pantopus/Features/BusinessProfile/BusinessProfileView.swift`** (2; 10/.semibold×1, 11/.semibold×1)
- L272: 10/.semibold — **near-scale** — 10pt is 1pt off overline (11pt/.semibold); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L433: 11/.semibold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site

**`frontend/apps/ios/Pantopus/Features/Businesses/BusinessWaitlistView.swift`** (1; 15/.semibold×1)
- L56: 15/.semibold — **near-scale** — 15pt is 1pt off body (16pt) but weight .semibold ≠ .normal

**`frontend/apps/ios/Pantopus/Features/CeremonialMail/CeremonialMailWizardView.swift`** (25; 10/.bold×8, 11/(none)×1, 11/.bold×1, 12/.medium×1, 12/.semibold×3, 13/(none)×2, 13/.semibold×1, 14/.semibold×4, 14.5/.semibold×2, 15/.semibold×1, 18/.bold×1)
- L35: 12/.medium — **off-scale** — size matches caption (12/normal) but weight .medium ≠ .normal
- L88: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- L103: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- L139: 14/.semibold — **off-scale** — size matches small (14/normal) but weight .semibold ≠ .normal
- L143: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L177: 15/.semibold — **near-scale** — 15pt is 1pt off body (16pt) but weight .semibold ≠ .normal
- L214: 14/.semibold — **off-scale** — size matches small (14/normal) but weight .semibold ≠ .normal
- L262: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- _…17 more in this file_

**`frontend/apps/ios/Pantopus/Features/CeremonialMailOpen/CeremonialMailOpenView.swift`** (19; 10/.bold×2, 10/.semibold×1, 11/(none)×1, 11/.bold×1, 11/.semibold×1, 12/.semibold×1, 13/.semibold×1, 14/.bold×2, 16/.semibold×1, 6/.bold×2, 9/.bold×6)
- L118: 16/.semibold — **off-scale** — size matches body (16/normal) but weight .semibold ≠ .normal
- L305: 11/.semibold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L450: 9/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L471: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L491: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- L504: 12/.semibold — **off-scale** — size matches caption (12/normal) but weight .semibold ≠ .normal
- L519: 10/.semibold — **near-scale** — 10pt is 1pt off overline (11pt/.semibold); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L616: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- _…11 more in this file_

**`frontend/apps/ios/Pantopus/Features/Chat/ChatListView.swift`** (10; 10/.bold×1, 11.5/.medium×1, 13.5/(none)×2, 13.5/.medium×1, 14/.bold×2, 18/.bold×1, 20/.bold×1, 22/.bold×1)
- L79: 20/.bold — **off-scale** — size matches h3 (20/semibold) but weight .bold ≠ .semibold
- L82: 13.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L90: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L103: 11.5/.medium — **off-scale (non-integer)** — non-integer size
- L140: 18/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L143: 13.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L148: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L179: 22/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- _…2 more in this file_

**`frontend/apps/ios/Pantopus/Features/Chat/Conversation/AI/AICapabilityChip.swift`** (1; 12/.medium×1)
- L28: 12/.medium — **off-scale** — size matches caption (12/normal) but weight .medium ≠ .normal

**`frontend/apps/ios/Pantopus/Features/Chat/Conversation/AI/AIEstimateCard.swift`** (4; 10/(none)×1, 10.5/(none)×1, 11/.bold×1, 18/.bold×1)
- L24: 18/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L27: 10.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L35: 11/.bold — **off-scale** — size matches overline (11/semibold) but weight .bold ≠ .semibold
- L38: 10/(default-regular) — **near-scale** — 10pt is 1pt off overline (11pt) but weight default ≠ .semibold

**`frontend/apps/ios/Pantopus/Features/Chat/Conversation/ChatConversationView.swift`** (64; 10/(none)×1, 10/.bold×2, 10/.medium×2, 10/.semibold×2, 10.5/.bold×3, 10.5/.medium×2, 10.5/.semibold×2, 11/(none)×6, 11/.bold×2, 11/.heavy×1, 11/.medium×1, 11/.semibold×1, 11.5/(none)×1, 11.5/.bold×2, 11.5/.medium×1, 12/.bold×2, 12/.heavy×1, 12/.medium×2, 12/.semibold×1, 12.5/(none)×4, 12.5/.medium×1, 12.5/.semibold×1, 13/.bold×2, 13/.semibold×2, 13.5/(none)×1, 14/.bold×4, 18/.bold×2, 20/.bold×2, 9/.bold×4, 9/.heavy×1, 9/.semibold×1, 9.5/.bold×4)
- L214: 18/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L220: 12.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L240: 20/.bold — **off-scale** — size matches h3 (20/semibold) but weight .bold ≠ .semibold
- L246: 12.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L274: 12.5/.semibold — **off-scale (non-integer)** — non-integer size
- L296: 11/.medium — **off-scale** — size matches overline (11/semibold) but weight .medium ≠ .semibold
- L332: 13/.bold — **near-scale** — 13pt is 1pt off small (14pt) but weight .bold ≠ .normal
- L335: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- _…56 more in this file_

**`frontend/apps/ios/Pantopus/Features/Chat/ConversationRow.swift`** (2; 10.5/.bold×1, 9/.bold×1)
- L111: 10.5/.bold — **off-scale (non-integer)** — non-integer size
- L199: 9/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation

**`frontend/apps/ios/Pantopus/Features/Chat/NewMessage/NewMessageView.swift`** (17; 11/(none)×1, 11/.bold×1, 11/.medium×1, 11.5/(none)×1, 11.5/.medium×1, 12.5/(none)×1, 13/(none)×2, 13/.bold×1, 13.5/(none)×1, 13.5/.semibold×2, 14/.bold×1, 15/.medium×1, 16/.semibold×2, 18/.bold×1)
- L41: 15/.medium — **near-scale** — 15pt is 1pt off body (16pt) but weight .medium ≠ .normal
- L51: 16/.semibold — **off-scale** — size matches body (16/normal) but weight .semibold ≠ .normal
- L82: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L185: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L195: 11.5/.medium — **off-scale (non-integer)** — non-integer size
- L212: 13.5/.semibold — **off-scale (non-integer)** — non-integer size
- L261: 16/.semibold — **off-scale** — size matches body (16/normal) but weight .semibold ≠ .normal
- L264: 12.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- _…9 more in this file_

**`frontend/apps/ios/Pantopus/Features/Chat/Search/ChatSearchView.swift`** (4; 12.5/(none)×1, 14.5/.semibold×1, 15/.bold×1, 9/.bold×1)
- L56: 14.5/.semibold — **off-scale (non-integer)** — non-integer size
- L65: 12.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L98: 15/.bold — **near-scale** — 15pt is 1pt off body (16pt) but weight .bold ≠ .normal
- L133: 9/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation

**`frontend/apps/ios/Pantopus/Features/Compose/GigCompose/GigComposeMagic.swift`** (20; 10/(none)×1, 10/.bold×1, 10/.semibold×1, 10.5/(none)×1, 10.5/.bold×1, 10.5/.semibold×3, 11/(none)×3, 11/.bold×1, 12/.bold×2, 12/.semibold×1, 12.5/.bold×1, 13/.bold×1, 13.5/.bold×1, 14.5/(none)×2)
- L157: 10.5/.bold — **off-scale (non-integer)** — non-integer size
- L205: 14.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L214: 14.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L239: 12/.bold — **off-scale** — size matches caption (12/normal) but weight .bold ≠ .normal
- L246: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- L272: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L295: 10/.semibold — **near-scale** — 10pt is 1pt off overline (11pt/.semibold); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L299: 13.5/.bold — **off-scale (non-integer)** — non-integer size
- _…12 more in this file_

**`frontend/apps/ios/Pantopus/Features/Compose/ListingCompose/ListingComposePhotoStep.swift`** (6; 10/.bold×2, 11/.medium×1, 11.5/.semibold×1, 12/.semibold×1, 8/.bold×1)
- L71: 12/.semibold — **off-scale** — size matches caption (12/normal) but weight .semibold ≠ .normal
- L89: 11.5/.semibold — **off-scale (non-integer)** — non-integer size
- L108: 11/.medium — **off-scale** — size matches overline (11/semibold) but weight .medium ≠ .semibold
- L371: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- L410: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- L429: 8/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation

**`frontend/apps/ios/Pantopus/Features/Compose/ListingCompose/SuggestionsBanner.swift`** (21; 10/.bold×1, 10/.semibold×2, 10.5/(none)×2, 10.5/.bold×1, 10.5/.semibold×2, 11/(none)×5, 11.5/.bold×2, 12.5/.bold×1, 12.5/.semibold×1, 13/.semibold×1, 14/.semibold×1, 22/.bold×1, 28/.bold×1)
- L39: 10.5/.bold — **off-scale (non-integer)** — non-integer size
- L63: 10.5/.semibold — **off-scale (non-integer)** — non-integer size
- L139: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- L183: 10/.semibold — **near-scale** — 10pt is 1pt off overline (11pt/.semibold); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L201: 12.5/.bold — **off-scale (non-integer)** — non-integer size
- L204: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L233: 14/.semibold — **off-scale** — size matches small (14/normal) but weight .semibold ≠ .normal
- L269: 11.5/.bold — **off-scale (non-integer)** — non-integer size
- _…13 more in this file_

**`frontend/apps/ios/Pantopus/Features/Compose/PulseCompose/PulseComposeContent.swift`** (5; 10/.semibold×1, 13/.semibold×3, 14/.semibold×1)
- L144: 13/.semibold — **near-scale** — 13pt is 1pt off small (14pt) but weight .semibold ≠ .normal
- L185: 13/.semibold — **near-scale** — 13pt is 1pt off small (14pt) but weight .semibold ≠ .normal
- L356: 14/.semibold — **off-scale** — size matches small (14/normal) but weight .semibold ≠ .normal
- L497: 10/.semibold — **near-scale** — 10pt is 1pt off overline (11pt/.semibold); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L614: 13/.semibold — **near-scale** — 13pt is 1pt off small (14pt) but weight .semibold ≠ .normal

**`frontend/apps/ios/Pantopus/Features/ContentDetail/InvoiceDetailView.swift`** (3; 13/(none)×1, 14/.bold×1, 18/.bold×1)
- L45: 18/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L48: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L55: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal

**`frontend/apps/ios/Pantopus/Features/ContentDetail/ListingDetailView.swift`** (3; 13/(none)×1, 14/.bold×1, 18/.bold×1)
- L88: 18/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L90: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L112: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal

**`frontend/apps/ios/Pantopus/Features/ContentDetail/TransactionalDetailShell.swift`** (35; 10/(none)×1, 10/.bold×2, 10/.medium×1, 10/.semibold×1, 10.5/.medium×1, 11/.bold×1, 11/.medium×2, 11.5/.medium×2, 11.5/.semibold×1, 12/.bold×1, 12/.medium×2, 12.5/.semibold×2, 13/.bold×2, 13/.medium×2, 13.5/(none)×2, 13.5/.bold×2, 14/.bold×3, 14.5/.bold×1, 18/.bold×1, 22/.bold×1, 32/.heavy×1, 9/.bold×3)
- L103: 18/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L106: 13.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L111: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L263: 22/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L277: 32/.heavy — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L281: 12/.medium — **off-scale** — size matches caption (12/normal) but weight .medium ≠ .normal
- L295: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- L304: 11/.medium — **off-scale** — size matches overline (11/semibold) but weight .medium ≠ .semibold
- _…27 more in this file_

**`frontend/apps/ios/Pantopus/Features/CreatorInbox/CreatorInboxView.swift`** (24; 11/(none)×2, 11/.bold×1, 11/.medium×1, 11.5/.semibold×2, 12.5/(none)×3, 12.5/.bold×3, 13/(none)×1, 13/.semibold×1, 13.5/(none)×1, 14/.bold×1, 14/.semibold×1, 15/.bold×1, 15/.semibold×1, 18/.bold×1, 19/.semibold×1, 9/.bold×2, 9.5/.bold×1)
- L71: 15/.semibold — **near-scale** — 15pt is 1pt off body (16pt) but weight .semibold ≠ .normal
- L76: 11/.medium — **off-scale** — size matches overline (11/semibold) but weight .medium ≠ .semibold
- L150: 18/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L154: 13.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L162: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L185: 12.5/.bold — **off-scale (non-integer)** — non-integer size
- L188: 12.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L191: 12.5/.bold — **off-scale (non-integer)** — non-integer size
- _…16 more in this file_

**`frontend/apps/ios/Pantopus/Features/Explore/ExploreMapView.swift`** (23; 10/(none)×1, 10/.bold×2, 11/.medium×1, 11.5/.medium×1, 11.5/.semibold×1, 12/.bold×1, 12/.medium×1, 12/.semibold×2, 12.5/(none)×1, 13/(none)×1, 13/.bold×3, 13/.semibold×3, 14/.bold×2, 15/.bold×1, 9/.bold×2)
- L189: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L213: 12/.bold — **off-scale** — size matches caption (12/normal) but weight .bold ≠ .normal
- L217: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- L277: 11.5/.semibold — **off-scale (non-integer)** — non-integer size
- L381: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L404: 12/.medium — **off-scale** — size matches caption (12/normal) but weight .medium ≠ .normal
- L407: 12/.semibold — **off-scale** — size matches caption (12/normal) but weight .semibold ≠ .normal
- L452: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- _…15 more in this file_

**`frontend/apps/ios/Pantopus/Features/Feed/FeedView.swift`** (9; 11.5/(none)×1, 11.5/.bold×1, 13.5/(none)×2, 14/.bold×2, 18/.bold×1, 20/.bold×1, 22/.bold×1)
- L68: 22/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L115: 20/.bold — **off-scale** — size matches h3 (20/semibold) but weight .bold ≠ .semibold
- L118: 13.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L128: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L143: 11.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L146: 11.5/.bold — **off-scale (non-integer)** — non-integer size
- L199: 18/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L202: 13.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- _…1 more in this file_

**`frontend/apps/ios/Pantopus/Features/Feed/Pulse/PulsePostCard.swift`** (10; 10/.bold×1, 10.5/(none)×1, 11/.bold×1, 11/.medium×1, 11.5/(none)×1, 11.5/.medium×2, 12.5/(none)×1, 13/.semibold×1, 13.5/.semibold×1)
- L92: 13.5/.semibold — **off-scale (non-integer)** — non-integer size
- L98: 12.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L132: 13/.semibold — **near-scale** — 13pt is 1pt off small (14pt) but weight .semibold ≠ .normal
- L136: 10.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L166: 11/.medium — **off-scale** — size matches overline (11/semibold) but weight .medium ≠ .semibold
- L179: 11/.bold — **off-scale** — size matches overline (11/semibold) but weight .bold ≠ .semibold
- L205: 11.5/.medium — **off-scale (non-integer)** — non-integer size
- L233: 11.5/.medium — **off-scale (non-integer)** — non-integer size
- _…2 more in this file_

**`frontend/apps/ios/Pantopus/Features/Gigs/GigsCategoryChipRow.swift`** (1; 12.5/.semibold×1)
- L29: 12.5/.semibold — **off-scale (non-integer)** — non-integer size

**`frontend/apps/ios/Pantopus/Features/Gigs/GigsFeedView.swift`** (22; 10/(none)×1, 10/.bold×3, 11/.medium×1, 11.5/(none)×2, 11.5/.bold×2, 12.5/.medium×1, 12.5/.semibold×2, 13.5/(none)×2, 13.5/.medium×1, 14/.bold×3, 14/.semibold×1, 18/.bold×1, 20/.bold×1, 22/.bold×1)
- L80: 22/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L98: 13.5/.medium — **off-scale (non-integer)** — non-integer size
- L140: 12.5/.medium — **off-scale (non-integer)** — non-integer size
- L143: 12.5/.semibold — **off-scale (non-integer)** — non-integer size
- L191: 20/.bold — **off-scale** — size matches h3 (20/semibold) but weight .bold ≠ .semibold
- L194: 13.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L204: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L228: 11.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- _…14 more in this file_

**`frontend/apps/ios/Pantopus/Features/Gigs/QuickPost/PostGigV1View.swift`** (1; 9/.bold×1)
- L456: 9/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation

**`frontend/apps/ios/Pantopus/Features/Gigs/TasksMap/TasksMapView.swift`** (16; 10/.medium×1, 11.5/.semibold×1, 12/.medium×1, 12/.semibold×1, 12.5/(none)×1, 13/(none)×1, 13/.bold×3, 13/.semibold×2, 14/.bold×3, 15/.bold×1, 9/.bold×1)
- L101: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L139: 11.5/.semibold — **off-scale (non-integer)** — non-integer size
- L177: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L216: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L236: 12/.medium — **off-scale** — size matches caption (12/normal) but weight .medium ≠ .normal
- L239: 12/.semibold — **off-scale** — size matches caption (12/normal) but weight .semibold ≠ .normal
- L324: 15/.bold — **near-scale** — 15pt is 1pt off body (16pt) but weight .bold ≠ .normal
- L328: 12.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- _…8 more in this file_

**`frontend/apps/ios/Pantopus/Features/Homes/Calendar/MonthStripHeader.swift`** (3; 10/.semibold×1, 13/.semibold×1, 14/.bold×1)
- L116: 13/.semibold — **near-scale** — 13pt is 1pt off small (14pt) but weight .semibold ≠ .normal
- L162: 10/.semibold — **near-scale** — 10pt is 1pt off overline (11pt/.semibold); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L170: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal

**`frontend/apps/ios/Pantopus/Features/Homes/Documents/DocumentDetailView.swift`** (1; 11/.semibold×1)
- L348: 11/.semibold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site

**`frontend/apps/ios/Pantopus/Features/Homes/Documents/UploadDocumentFormView.swift`** (2; 13/.semibold×1, 8/.heavy×1)
- L323: 8/.heavy — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L365: 13/.semibold — **near-scale** — 13pt is 1pt off small (14pt) but weight .semibold ≠ .normal

**`frontend/apps/ios/Pantopus/Features/Homes/InviteOwner/InviteOwnerFormContent.swift`** (1; 9/.bold×1)
- L208: 9/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation

**`frontend/apps/ios/Pantopus/Features/Hub/Sections/HubSections.swift`** (26; 10/(none)×1, 10/.bold×4, 11/(none)×4, 11/.bold×1, 11/.semibold×1, 12/.bold×2, 12/.semibold×2, 13/(none)×1, 13/.bold×5, 13/.semibold×1, 16/.bold×1, 17/.bold×1, 20/.bold×1, 22/.bold×1)
- L34: 17/.bold — **near-scale** — 17pt is 1pt off body (16pt) but weight .bold ≠ .normal
- L114: 13/.semibold — **near-scale** — 13pt is 1pt off small (14pt) but weight .semibold ≠ .normal
- L124: 12/.bold — **off-scale** — size matches caption (12/normal) but weight .bold ≠ .normal
- L191: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- L201: 22/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L207: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L214: 13/.bold — **near-scale** — 13pt is 1pt off small (14pt) but weight .bold ≠ .normal
- L269: 20/.bold — **off-scale** — size matches h3 (20/semibold) but weight .bold ≠ .semibold
- _…18 more in this file_

**`frontend/apps/ios/Pantopus/Features/IdentityCenter/IdentityCenterView.swift`** (15; 10/.bold×1, 11/.bold×1, 11.5/(none)×2, 12/.medium×1, 12/.semibold×1, 13.5/(none)×1, 14/.bold×1, 14/.medium×1, 15/.medium×1, 15.5/.semibold×1, 16/.semibold×1, 18/.bold×1, 9/.bold×2)
- L62: 16/.semibold — **off-scale** — size matches body (16/normal) but weight .semibold ≠ .normal
- L152: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- L157: 9/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L166: 9/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L176: 15.5/.semibold — **off-scale (non-integer)** — non-integer size
- L181: 12/.medium — **off-scale** — size matches caption (12/normal) but weight .medium ≠ .normal
- L188: 11.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L194: 11.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- _…7 more in this file_

**`frontend/apps/ios/Pantopus/Features/ListingOffers/ListingOffersView.swift`** (5; 13/.semibold×2, 14/.semibold×2, 16/.semibold×1)
- L65: 13/.semibold — **near-scale** — 13pt is 1pt off small (14pt) but weight .semibold ≠ .normal
- L69: 16/.semibold — **off-scale** — size matches body (16/normal) but weight .semibold ≠ .normal
- L86: 13/.semibold — **near-scale** — 13pt is 1pt off small (14pt) but weight .semibold ≠ .normal
- L108: 14/.semibold — **off-scale** — size matches small (14/normal) but weight .semibold ≠ .normal
- L126: 14/.semibold — **off-scale** — size matches small (14/normal) but weight .semibold ≠ .normal

**`frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/CertifiedBody.swift`** (3; 11/.bold×1, 12/.semibold×1, 13/(none)×1)
- L59: 11/.bold — **off-scale** — size matches overline (11/semibold) but weight .bold ≠ .semibold
- L65: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L75: 12/.semibold — **off-scale** — size matches caption (12/normal) but weight .semibold ≠ .normal

**`frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/Components/BidCard.swift`** (2; 10/.heavy×1, 34/.heavy×1)
- L53: 34/.heavy — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L79: 10/.heavy — **near-scale** — 10pt is 1pt off overline (11pt) but weight .heavy ≠ .semibold

**`frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/Components/BidderProfileCard.swift`** (6; 11/.semibold×1, 13/.bold×1, 14/.heavy×1, 15/.heavy×1, 16/.heavy×2)
- L75: 15/.heavy — **near-scale** — 15pt is 1pt off body (16pt) but weight .heavy ≠ .normal
- L107: 16/.heavy — **off-scale** — size matches body (16/normal) but weight .heavy ≠ .normal
- L114: 16/.heavy — **off-scale** — size matches body (16/normal) but weight .heavy ≠ .normal
- L120: 14/.heavy — **off-scale** — size matches small (14/normal) but weight .heavy ≠ .normal
- L156: 11/.semibold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L176: 13/.bold — **near-scale** — 13pt is 1pt off small (14pt) but weight .bold ≠ .normal

**`frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/Components/CertifiedConfirmGate.swift`** (2; 10/.bold×1, 11/(none)×1)
- L107: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L134: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold

**`frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/Components/CertifiedTermsSheet.swift`** (2; 12/.semibold×1, 13/.bold×1)
- L108: 13/.bold — **near-scale** — 13pt is 1pt off small (14pt) but weight .bold ≠ .normal
- L127: 12/.semibold — **off-scale** — size matches caption (12/normal) but weight .semibold ≠ .normal

**`frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/Components/CouponHero.swift`** (2; 13/.heavy×1, 42/.heavy×1)
- L61: 42/.heavy — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L170: 13/.heavy — **near-scale** — 13pt is 1pt off small (14pt) but weight .heavy ≠ .normal

**`frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/Components/OtherBidsStrip.swift`** (3; 11/.bold×1, 18/.heavy×1, 9/.heavy×1)
- L70: 11/.bold — **off-scale** — size matches overline (11/semibold) but weight .bold ≠ .semibold
- L75: 18/.heavy — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L117: 9/.heavy — **off-scale (way off)** — no scale entry within 1pt — needs design citation

**`frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/Components/PolaroidFrame.swift`** (1; 11/.bold×1)
- L35: 11/.bold — **off-scale** — size matches overline (11/semibold) but weight .bold ≠ .semibold

**`frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/Components/PostSummaryCard.swift`** (2; 11/.semibold×1, 8.5/.heavy×1)
- L104: 8.5/.heavy — **off-scale (non-integer)** — non-integer size
- L120: 11/.semibold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site

**`frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/GigBody.swift`** (1; 13/.bold×1)
- L183: 13/.bold — **near-scale** — 13pt is 1pt off small (14pt) but weight .bold ≠ .normal

**`frontend/apps/ios/Pantopus/Features/Mailbox/ItemDetail/Bodies/MemoryBody.swift`** (8; 10/.semibold×1, 11/.semibold×2, 13/(none)×1, 13/.bold×1, 13/.semibold×2, 14/.heavy×1)
- L131: 13/.semibold — **near-scale** — 13pt is 1pt off small (14pt) but weight .semibold ≠ .normal
- L136: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L243: 11/.semibold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L246: 13/.semibold — **near-scale** — 13pt is 1pt off small (14pt) but weight .semibold ≠ .normal
- L251: 11/.semibold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L346: 14/.heavy — **off-scale** — size matches small (14/normal) but weight .heavy ≠ .normal
- L351: 10/.semibold — **near-scale** — 10pt is 1pt off overline (11pt/.semibold); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L370: 13/.bold — **near-scale** — 13pt is 1pt off small (14pt) but weight .bold ≠ .normal

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Components/BookletPager.swift`** (8; 11/(none)×2, 11/.bold×2, 11/.semibold×2, 13/(none)×1, 13/.bold×1)
- L99: 13/.bold — **near-scale** — 13pt is 1pt off small (14pt) but weight .bold ≠ .normal
- L102: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L129: 11/.semibold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L175: 11/.bold — **off-scale** — size matches overline (11/semibold) but weight .bold ≠ .semibold
- L180: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L185: 11/.bold — **off-scale** — size matches overline (11/semibold) but weight .bold ≠ .semibold
- L225: 11/.semibold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L281: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Components/CertifiedStampBadge.swift`** (2; 13/.bold×1, 9/.bold×1)
- L27: 9/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L31: 13/.bold — **near-scale** — 13pt is 1pt off small (14pt) but weight .bold ≠ .normal

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Components/CombinedSenderCarrierCard.swift`** (7; 10/.bold×1, 11/.bold×1, 11.5/(none)×1, 13/.bold×1, 13.5/.bold×2, 9.5/.bold×1)
- L89: 11/.bold — **off-scale** — size matches overline (11/semibold) but weight .bold ≠ .semibold
- L103: 13/.bold — **near-scale** — 13pt is 1pt off small (14pt) but weight .bold ≠ .normal
- L118: 13.5/.bold — **off-scale (non-integer)** — non-integer size
- L122: 11.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L172: 13.5/.bold — **off-scale (non-integer)** — non-integer size
- L208: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- L224: 9.5/.bold — **off-scale (non-integer)** — non-integer size

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/MailDetailView.swift`** (17; 10/.bold×2, 10.5/.semibold×1, 11/.bold×2, 11/.medium×1, 11/.semibold×3, 13/(none)×2, 13/.semibold×2, 14/.bold×2, 15/.bold×1, 24/.bold×1)
- L251: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L264: 11/.semibold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L272: 11/.medium — **off-scale** — size matches overline (11/semibold) but weight .medium ≠ .semibold
- L298: 24/.bold — **off-scale** — size matches h2 (24/semibold) but weight .bold ≠ .semibold
- L305: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L327: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L348: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- L367: 11/.semibold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- _…9 more in this file_

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Variants/BookletDetailLayout.swift`** (13; 10/.bold×1, 10.5/.semibold×1, 11/(none)×1, 11/.bold×2, 11/.semibold×2, 13/(none)×1, 13/.semibold×1, 14/.bold×2, 15/.bold×1, 19/.bold×1)
- L137: 15/.bold — **near-scale** — 15pt is 1pt off body (16pt) but weight .bold ≠ .normal
- L160: 10.5/.semibold — **off-scale (non-integer)** — non-integer size
- L190: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L195: 11/.semibold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L199: 19/.bold — **near-scale** — 19pt is 1pt off h3 (20pt) but weight .bold ≠ .semibold
- L204: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L230: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- L247: 11/.bold — **off-scale** — size matches overline (11/semibold) but weight .bold ≠ .semibold
- _…5 more in this file_

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Variants/CertifiedDetailLayout.swift`** (15; 10/.bold×3, 10.5/(none)×1, 11/(none)×2, 11/.bold×2, 11/.semibold×2, 12/.semibold×1, 12.5/.semibold×1, 13/(none)×1, 15/.bold×1, 18/.bold×1)
- L321: 15/.bold — **near-scale** — 15pt is 1pt off body (16pt) but weight .bold ≠ .normal
- L379: 12.5/.semibold — **off-scale (non-integer)** — non-integer size
- L400: 10.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L478: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L485: 11/.semibold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L489: 18/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L550: 12/.semibold — **off-scale** — size matches caption (12/normal) but weight .semibold ≠ .normal
- L571: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- _…7 more in this file_

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Variants/CommunityDetailLayout.swift`** (44; 10/.bold×3, 10.5/(none)×1, 10.5/.semibold×1, 11/(none)×3, 11/.bold×11, 11/.semibold×3, 12/.bold×1, 12.5/(none)×1, 12.5/.bold×1, 13/.bold×3, 14/.bold×5, 14.5/.bold×1, 15/.bold×1, 18/.bold×1, 19/.bold×1, 9/.bold×5, 9/.semibold×2)
- L233: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L238: 11/.semibold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L242: 19/.bold — **near-scale** — 19pt is 1pt off h3 (20pt) but weight .bold ≠ .semibold
- L273: 12/.bold — **off-scale** — size matches caption (12/normal) but weight .bold ≠ .normal
- L297: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- L319: 14.5/.bold — **off-scale (non-integer)** — non-integer size
- L323: 9/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L341: 11/.semibold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- _…36 more in this file_

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailboxMap/MailboxMapView.swift`** (27; 10/.bold×1, 10.5/.bold×1, 10.5/.medium×4, 10.5/.semibold×1, 11/.bold×1, 11/.semibold×1, 11.5/(none)×1, 11.5/.medium×1, 11.5/.semibold×2, 12/.bold×2, 12/.semibold×1, 12.5/.semibold×1, 13/(none)×1, 13/.bold×1, 13/.semibold×2, 14/.bold×3, 16/.bold×1, 9/.bold×1, 9.5/.bold×1)
- L204: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L251: 11.5/.semibold — **off-scale (non-integer)** — non-integer size
- L323: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L331: 12/.bold — **off-scale** — size matches caption (12/normal) but weight .bold ≠ .normal
- L409: 11.5/.medium — **off-scale (non-integer)** — non-integer size
- L427: 13/.semibold — **near-scale** — 13pt is 1pt off small (14pt) but weight .semibold ≠ .normal
- L431: 12/.bold — **off-scale** — size matches caption (12/normal) but weight .bold ≠ .normal
- L465: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- _…19 more in this file_

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailboxRoot/MailboxRootContent.swift`** (3; 10/.bold×2, 14/.semibold×1)
- L88: 14/.semibold — **off-scale** — size matches small (14/normal) but weight .semibold ≠ .normal
- L131: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- L186: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold

**`frontend/apps/ios/Pantopus/Features/Marketplace/MarketplaceView.swift`** (16; 11.5/(none)×2, 11.5/.bold×1, 11.5/.semibold×1, 12.5/.bold×1, 12.5/.semibold×1, 13.5/(none)×2, 13.5/.medium×1, 14/.bold×2, 18/.bold×1, 20/.bold×1, 22/.bold×1, 9/.bold×1, 9.5/(none)×1)
- L63: 22/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L79: 13.5/.medium — **off-scale (non-integer)** — non-integer size
- L115: 12.5/.semibold — **off-scale (non-integer)** — non-integer size
- L185: 20/.bold — **off-scale** — size matches h3 (20/semibold) but weight .bold ≠ .semibold
- L189: 13.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L197: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L221: 11.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L224: 11.5/.bold — **off-scale (non-integer)** — non-integer size
- _…8 more in this file_

**`frontend/apps/ios/Pantopus/Features/Me/MeView.swift`** (16; 10/.bold×1, 10/.semibold×1, 11/.semibold×1, 12/.medium×3, 13.5/(none)×2, 13.5/.semibold×2, 14/.bold×1, 18/.bold×2, 20/.bold×1, 26/.bold×1, 9/.bold×1)
- L135: 18/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L138: 13.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L145: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L182: 20/.bold — **off-scale** — size matches h3 (20/semibold) but weight .bold ≠ .semibold
- L186: 12/.medium — **off-scale** — size matches caption (12/normal) but weight .medium ≠ .normal
- L193: 12/.medium — **off-scale** — size matches caption (12/normal) but weight .medium ≠ .normal
- L203: 13.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L237: 26/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- _…8 more in this file_

**`frontend/apps/ios/Pantopus/Features/Membership/MembershipDetailView.swift`** (22; 10/.bold×2, 10.5/(none)×3, 10.5/.bold×1, 10.5/.semibold×1, 11/(none)×1, 11.5/.semibold×1, 12.5/.bold×1, 12.5/.semibold×2, 13/.semibold×2, 13.5/(none)×1, 13.5/.bold×1, 14/.bold×1, 15/.bold×1, 16/.semibold×1, 18/.bold×1, 22/.heavy×2)
- L71: 16/.semibold — **off-scale** — size matches body (16/normal) but weight .semibold ≠ .normal
- L125: 18/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L129: 13.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L136: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L196: 10.5/.bold — **off-scale (non-integer)** — non-integer size
- L218: 13.5/.bold — **off-scale (non-integer)** — non-integer size
- L231: 12.5/.bold — **off-scale (non-integer)** — non-integer size
- L247: 12.5/.semibold — **off-scale (non-integer)** — non-integer size
- _…14 more in this file_

**`frontend/apps/ios/Pantopus/Features/MyBids/MyBidsView.swift`** (3; 14/.medium×1, 14/.semibold×2)
- L119: 14/.medium — **off-scale** — size matches small (14/normal) but weight .medium ≠ .normal
- L157: 14/.semibold — **off-scale** — size matches small (14/normal) but weight .semibold ≠ .normal
- L174: 14/.semibold — **off-scale** — size matches small (14/normal) but weight .semibold ≠ .normal

**`frontend/apps/ios/Pantopus/Features/Nearby/NearbyMapView.swift`** (18; 10/(none)×1, 10/.medium×1, 11.5/.medium×1, 11.5/.semibold×1, 12/.bold×1, 12/.medium×1, 12/.semibold×1, 13/(none)×1, 13/.bold×3, 13/.semibold×2, 14/.bold×2, 9/.bold×2, 9.5/.bold×1)
- L161: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L203: 11.5/.semibold — **off-scale (non-integer)** — non-integer size
- L321: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L339: 12/.medium — **off-scale** — size matches caption (12/normal) but weight .medium ≠ .normal
- L342: 12/.semibold — **off-scale** — size matches caption (12/normal) but weight .semibold ≠ .normal
- L372: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L378: 13/.bold — **near-scale** — 13pt is 1pt off small (14pt) but weight .bold ≠ .normal
- L401: 11.5/.medium — **off-scale (non-integer)** — non-integer size
- _…10 more in this file_

**`frontend/apps/ios/Pantopus/Features/PrivacyHandshake/PrivacyHandshakeWizardView.swift`** (24; 11/(none)×2, 11.5/(none)×2, 11.5/.medium×1, 12/.semibold×1, 12.5/(none)×3, 12.5/.semibold×1, 13/(none)×2, 13/.bold×1, 13/.semibold×1, 14/.bold×1, 14/.semibold×2, 15/.semibold×2, 16/.bold×4, 22/.bold×1)
- L71: 22/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L76: 16/.bold — **off-scale** — size matches body (16/normal) but weight .bold ≠ .normal
- L82: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L110: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L124: 14/.semibold — **off-scale** — size matches small (14/normal) but weight .semibold ≠ .normal
- L153: 11.5/.medium — **off-scale (non-integer)** — non-integer size
- L157: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L184: 13/.semibold — **near-scale** — 13pt is 1pt off small (14pt) but weight .semibold ≠ .normal
- _…16 more in this file_

**`frontend/apps/ios/Pantopus/Features/Profile/PublicProfileChrome.swift`** (3; 10/.bold×2, 11/.semibold×1)
- L197: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- L328: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- L390: 11/.semibold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site

**`frontend/apps/ios/Pantopus/Features/Profile/PublicProfileNeighbor.swift`** (21; 10/.semibold×1, 10.5/(none)×4, 10.5/.bold×2, 11/(none)×2, 11/.bold×1, 11/.semibold×2, 11.5/(none)×1, 11.5/.semibold×1, 12.5/(none)×2, 12.5/.semibold×3, 13/.bold×1, 15/.bold×1)
- L484: 11/.bold — **off-scale** — size matches overline (11/semibold) but weight .bold ≠ .semibold
- L503: 11/.semibold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L536: 10/.semibold — **near-scale** — 10pt is 1pt off overline (11pt/.semibold); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L575: 10.5/.bold — **off-scale (non-integer)** — non-integer size
- L621: 10.5/.bold — **off-scale (non-integer)** — non-integer size
- L627: 11.5/.semibold — **off-scale (non-integer)** — non-integer size
- L653: 12.5/.semibold — **off-scale (non-integer)** — non-integer size
- L656: 10.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- _…13 more in this file_

**`frontend/apps/ios/Pantopus/Features/ReviewClaims/ReviewClaimDetailComponents.swift`** (9; 11/(none)×1, 12/.semibold×1, 14/.semibold×4, 15/.bold×2, 18/.bold×1)
- L51: 14/.semibold — **off-scale** — size matches small (14/normal) but weight .semibold ≠ .normal
- L61: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L68: 12/.semibold — **off-scale** — size matches caption (12/normal) but weight .semibold ≠ .normal
- L121: 15/.bold — **near-scale** — 15pt is 1pt off body (16pt) but weight .bold ≠ .normal
- L139: 14/.semibold — **off-scale** — size matches small (14/normal) but weight .semibold ≠ .normal
- L160: 14/.semibold — **off-scale** — size matches small (14/normal) but weight .semibold ≠ .normal
- L204: 18/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L232: 15/.bold — **near-scale** — 15pt is 1pt off body (16pt) but weight .bold ≠ .normal
- _…1 more in this file_

**`frontend/apps/ios/Pantopus/Features/ReviewClaims/ReviewClaimDetailView.swift`** (8; 11/(none)×1, 11/.semibold×2, 13/(none)×1, 14/.semibold×4)
- L202: 11/.semibold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L227: 14/.semibold — **off-scale** — size matches small (14/normal) but weight .semibold ≠ .normal
- L268: 14/.semibold — **off-scale** — size matches small (14/normal) but weight .semibold ≠ .normal
- L279: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L328: 14/.semibold — **off-scale** — size matches small (14/normal) but weight .semibold ≠ .normal
- L402: 11/.semibold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L405: 14/.semibold — **off-scale** — size matches small (14/normal) but weight .semibold ≠ .normal
- L429: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)

**`frontend/apps/ios/Pantopus/Features/Settings/About/AboutView.swift`** (1; 44/.heavy×1)
- L37: 44/.heavy — **off-scale (way off)** — no scale entry within 1pt — needs design citation

**`frontend/apps/ios/Pantopus/Features/Settings/Help/HelpCenterView.swift`** (1; 15/.semibold×1)
- L58: 15/.semibold — **near-scale** — 15pt is 1pt off body (16pt) but weight .semibold ≠ .normal

**`frontend/apps/ios/Pantopus/Features/Settings/SettingsTopBar.swift`** (2; 13/.semibold×1, 16/.semibold×1)
- L36: 16/.semibold — **off-scale** — size matches body (16/normal) but weight .semibold ≠ .normal
- L43: 13/.semibold — **near-scale** — 13pt is 1pt off small (14pt) but weight .semibold ≠ .normal

**`frontend/apps/ios/Pantopus/Features/Shared/ContentDetail/Bodies/BodyReactionsBody.swift`** (2; 11/.regular×1, 15/.regular×1)
- L135: 15/.regular — **near-scale** — 15pt is 1pt off body (16pt) but weight .regular ≠ .normal
- L308: 11/.regular — **off-scale** — size matches overline (11/semibold) but weight .regular ≠ .semibold

**`frontend/apps/ios/Pantopus/Features/Shared/ContentDetail/Bodies/PostThreadComponents.swift`** (7; 10/(none)×1, 10/.regular×1, 10.5/.regular×1, 10.5/.semibold×1, 11.5/.semibold×1, 12.5/.regular×1, 15/.bold×1)
- L110: 10/(default-regular) — **near-scale** — 10pt is 1pt off overline (11pt) but weight default ≠ .semibold
- L113: 10/.regular — **near-scale** — 10pt is 1pt off overline (11pt) but weight .regular ≠ .semibold
- L133: 10.5/.semibold — **off-scale (non-integer)** — non-integer size
- L147: 10.5/.regular — **off-scale (non-integer)** — non-integer size
- L181: 15/.bold — **near-scale** — 15pt is 1pt off body (16pt) but weight .bold ≠ .normal
- L184: 12.5/.regular — **off-scale (non-integer)** — non-integer size
- L254: 11.5/.semibold — **off-scale (non-integer)** — non-integer size

**`frontend/apps/ios/Pantopus/Features/Shared/ContentDetail/Bodies/StatsTabsBody.swift`** (1; 10/.semibold×1)
- L152: 10/.semibold — **near-scale** — 10pt is 1pt off overline (11pt/.semibold); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)

**`frontend/apps/ios/Pantopus/Features/Shared/ContentDetail/Headers/PostAuthorHeader.swift`** (1; 14/.semibold×1)
- L116: 14/.semibold — **off-scale** — size matches small (14/normal) but weight .semibold ≠ .normal

**`frontend/apps/ios/Pantopus/Features/Shared/ContentDetail/Headers/ProfileHeader.swift`** (2; 10/.bold×2)
- L204: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- L224: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold

**`frontend/apps/ios/Pantopus/Features/Shared/Feed/FeedComponents.swift`** (1; 12.5/.semibold×1)
- L51: 12.5/.semibold — **off-scale (non-integer)** — non-integer size

**`frontend/apps/ios/Pantopus/Features/Shared/FilterSheet/FilterSheetControls.swift`** (5; 13/.semibold×2, 14/.semibold×1, 15/.regular×2)
- L173: 15/.regular — **near-scale** — 15pt is 1pt off body (16pt) but weight .regular ≠ .normal
- L239: 15/.regular — **near-scale** — 15pt is 1pt off body (16pt) but weight .regular ≠ .normal
- L296: 14/.semibold — **off-scale** — size matches small (14/normal) but weight .semibold ≠ .normal
- L357: 13/.semibold — **near-scale** — 13pt is 1pt off small (14pt) but weight .semibold ≠ .normal
- L361: 13/.semibold — **near-scale** — 13pt is 1pt off small (14pt) but weight .semibold ≠ .normal

**`frontend/apps/ios/Pantopus/Features/Shared/FilterSheet/FilterSheetShell.swift`** (1; 18/.semibold×1)
- L93: 18/.semibold — **off-scale (way off)** — no scale entry within 1pt — needs design citation

**`frontend/apps/ios/Pantopus/Features/Shared/GroupedList/GroupedListView.swift`** (8; 10.5/.bold×1, 11/.bold×1, 11.5/(none)×1, 13.5/(none)×1, 14/.bold×1, 15/.medium×1, 16/.semibold×1, 18/.bold×1)
- L55: 16/.semibold — **off-scale** — size matches body (16/normal) but weight .semibold ≠ .normal
- L160: 11/.bold — **off-scale** — size matches overline (11/semibold) but weight .bold ≠ .semibold
- L189: 11.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L204: 15/.medium — **near-scale** — 15pt is 1pt off body (16pt) but weight .medium ≠ .normal
- L281: 10.5/.bold — **off-scale (non-integer)** — non-integer size
- L344: 18/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L347: 13.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L354: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal

**`frontend/apps/ios/Pantopus/Features/Shared/Identity/IdentitySwitcherPillRow.swift`** (1; 12/.bold×1)
- L65: 12/.bold — **off-scale** — size matches caption (12/normal) but weight .bold ≠ .normal

**`frontend/apps/ios/Pantopus/Features/Shared/Identity/IdentitySwitcherSheet.swift`** (6; 10/.bold×1, 11.5/(none)×1, 12.5/(none)×1, 14.5/.semibold×1, 16/.semibold×1, 9/.bold×1)
- L63: 16/.semibold — **off-scale** — size matches body (16/normal) but weight .semibold ≠ .normal
- L70: 12.5/(default-regular) — **off-scale (non-integer)** — non-integer size
- L116: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- L121: 9/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L130: 14.5/.semibold — **off-scale (non-integer)** — non-integer size
- L135: 11.5/(default-regular) — **off-scale (non-integer)** — non-integer size

**`frontend/apps/ios/Pantopus/Features/Shared/ListOfRows/ListOfRowsView.swift`** (8; 10/.semibold×1, 11/(none)×1, 11/.semibold×1, 13/.semibold×1, 16/.semibold×1, 18/.bold×1, 7/.bold×2)
- L78: 16/.semibold — **off-scale** — size matches body (16/normal) but weight .semibold ≠ .normal
- L83: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L96: 13/.semibold — **near-scale** — 13pt is 1pt off small (14pt) but weight .semibold ≠ .normal
- L178: 11/.semibold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L601: 18/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L997: 10/.semibold — **near-scale** — 10pt is 1pt off overline (11pt/.semibold); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L1379: 7/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L1414: 7/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation

**`frontend/apps/ios/Pantopus/Features/Shared/MailItemDetail/ChainOfCustodyTimeline.swift`** (5; 10/.bold×1, 11/(none)×2, 11/.bold×1, 9/.bold×1)
- L141: 11/.bold — **off-scale** — size matches overline (11/semibold) but weight .bold ≠ .semibold
- L147: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L160: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- L202: 9/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L213: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold

**`frontend/apps/ios/Pantopus/Features/Shared/MailItemDetail/MailItemDetailShell.swift`** (12; 10/.bold×1, 11/(none)×1, 11/.bold×1, 11/.semibold×2, 12/.bold×3, 13/(none)×1, 13/.semibold×1, 15/.regular×1, 9/.bold×1)
- L225: 15/.regular — **near-scale** — 15pt is 1pt off body (16pt) but weight .regular ≠ .normal
- L246: 12/.bold — **off-scale** — size matches caption (12/normal) but weight .bold ≠ .normal
- L315: 12/.bold — **off-scale** — size matches caption (12/normal) but weight .bold ≠ .normal
- L320: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- L337: 11/.semibold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L346: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L390: 12/.bold — **off-scale** — size matches caption (12/normal) but weight .bold ≠ .normal
- L416: 11/.bold — **off-scale** — size matches overline (11/semibold) but weight .bold ≠ .semibold
- _…4 more in this file_

**`frontend/apps/ios/Pantopus/Features/Shared/MapListHybrid/MapListHybridPreview.swift`** (11; 11/.semibold×2, 11.5/.medium×1, 11.5/.semibold×1, 12/.medium×1, 12/.semibold×2, 13/.semibold×2, 14/.bold×2)
- L103: 12/.semibold — **off-scale** — size matches caption (12/normal) but weight .semibold ≠ .normal
- L146: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L196: 11.5/.semibold — **off-scale (non-integer)** — non-integer size
- L241: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L247: 12/.medium — **off-scale** — size matches caption (12/normal) but weight .medium ≠ .normal
- L250: 12/.semibold — **off-scale** — size matches caption (12/normal) but weight .semibold ≠ .normal
- L275: 11.5/.medium — **off-scale (non-integer)** — non-integer size
- L333: 13/.semibold — **near-scale** — 13pt is 1pt off small (14pt) but weight .semibold ≠ .normal
- _…3 more in this file_

**`frontend/apps/ios/Pantopus/Features/Status/StatusWaitingView.swift`** (7; 10/.bold×1, 12/.semibold×1, 13/(none)×1, 14/.bold×1, 14/.semibold×2, 22/.bold×1)
- L78: 22/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L94: 12/.semibold — **off-scale** — size matches caption (12/normal) but weight .semibold ≠ .normal
- L133: 14/.semibold — **off-scale** — size matches small (14/normal) but weight .semibold ≠ .normal
- L157: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- L165: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L191: 14/.semibold — **off-scale** — size matches small (14/normal) but weight .semibold ≠ .normal
- L206: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal

**`frontend/apps/ios/Pantopus/Features/SupportTrains/StartTrain/StartSupportTrainWizardView.swift`** (37; 10/(none)×3, 10/.bold×4, 11/(none)×7, 11/.bold×1, 12/.medium×1, 12/.semibold×2, 13/(none)×4, 13/.bold×2, 13/.semibold×4, 14/.bold×1, 14/.medium×1, 14/.semibold×3, 15/.bold×1, 22/.bold×1, 9/.bold×2)
- L72: 12/.medium — **off-scale** — size matches caption (12/normal) but weight .medium ≠ .normal
- L88: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- L148: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L188: 14/.semibold — **off-scale** — size matches small (14/normal) but weight .semibold ≠ .normal
- L192: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L228: 15/.bold — **near-scale** — 15pt is 1pt off body (16pt) but weight .bold ≠ .normal
- L240: 14/.bold — **off-scale** — size matches small (14/normal) but weight .bold ≠ .normal
- L244: 9/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- _…29 more in this file_

**`frontend/apps/ios/Pantopus/Features/TokenAccept/TokenAcceptView.swift`** (22; 10/.bold×2, 10.5/.bold×1, 11.5/.semibold×1, 12/.medium×1, 13/(none)×4, 13/.bold×1, 13.5/(none)×2, 14/.bold×1, 14/.semibold×1, 16/.semibold×3, 18/.bold×3, 20/.bold×1, 22/.bold×1)
- L36: 16/.semibold — **off-scale** — size matches body (16/normal) but weight .semibold ≠ .normal
- L98: 16/.semibold — **off-scale** — size matches body (16/normal) but weight .semibold ≠ .normal
- L101: 22/.bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L106: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L112: 11.5/.semibold — **off-scale (non-integer)** — non-integer size
- L134: 10/.bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight .bold ≠ .semibold
- L152: 10.5/.bold — **off-scale (non-integer)** — non-integer size
- L156: 16/.semibold — **off-scale** — size matches body (16/normal) but weight .semibold ≠ .normal
- _…14 more in this file_


## Android — typography drift (Pass-2 NOT applied)

**81 files**, **845 occurrences**.

Verdict mix:
- **off-scale**: 335
- **near-scale**: 252
- **off-scale (way off)**: 122
- **on-scale (replaced by Pass 2)**: 97
- **off-scale (overline-special)**: 39

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/PersonaCard.kt`** (2; 14/Bold×1, 15/Bold×1)
- L99: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal
- L142: 15/Bold — **near-scale** — 15pt is 1pt off body (16pt) but weight Bold ≠ .normal

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/audience_profile/AudienceProfileScreen.kt`** (53; 10/(none)×1, 10/Bold×1, 11/(none)×5, 11/Bold×3, 11/Medium×1, 11/SemiBold×2, 12/(none)×6, 12/Bold×1, 12/Medium×1, 12/SemiBold×6, 13/Bold×3, 13/Medium×2, 13/SemiBold×1, 14/(none)×2, 14/Bold×2, 14/SemiBold×5, 16/Bold×2, 16/SemiBold×1, 18/Bold×2, 24/Bold×2, 9/Bold×4)
- L192: 12/Bold — **off-scale** — size matches caption (12/normal) but weight Bold ≠ .normal
- L198: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L204: 12/SemiBold — **off-scale** — size matches caption (12/normal) but weight SemiBold ≠ .normal
- L253: 16/SemiBold — **off-scale** — size matches body (16/normal) but weight SemiBold ≠ .normal
- L346: 24/Bold — **off-scale** — size matches h2 (24/semibold) but weight Bold ≠ .semibold
- L385: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal
- L408: 13/Bold — **near-scale** — 13pt is 1pt off small (14pt) but weight Bold ≠ .normal
- L431: 11/Bold — **off-scale** — size matches overline (11/semibold) but weight Bold ≠ .semibold
- _…45 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/audience_profile/broadcast_detail/BroadcastDetailScreen.kt`** (22; 10/Bold×2, 11/(none)×2, 11/Bold×2, 11/SemiBold×1, 12/(none)×3, 12/SemiBold×1, 13/(none)×1, 13/Bold×2, 13/SemiBold×1, 14/Bold×1, 14/SemiBold×1, 15/(none)×1, 16/SemiBold×1, 18/Bold×1, 20/Bold×1, 9/Bold×1)
- L123: 16/SemiBold — **off-scale** — size matches body (16/normal) but weight SemiBold ≠ .normal
- L195: 18/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L270: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L276: 15/(default-regular) — **near-scale** — 15pt is 1pt off body (16pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L331: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold
- L380: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold
- L388: 20/Bold — **off-scale** — size matches h3 (20/semibold) but weight Bold ≠ .semibold
- L395: 11/SemiBold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- _…14 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/audience_profile/compose_broadcast/ComposeBroadcastScreen.kt`** (31; 10/(none)×1, 11/(none)×5, 11/Bold×1, 11/SemiBold×3, 12/(none)×1, 13/(none)×1, 13/Bold×1, 13/SemiBold×2, 14/Bold×3, 14/SemiBold×4, 15/(none)×2, 15/Bold×1, 16/Bold×3, 16/SemiBold×1, 9/Bold×2)
- L233: 16/SemiBold — **off-scale** — size matches body (16/normal) but weight SemiBold ≠ .normal
- L245: 10/(default-regular) — **near-scale** — 10pt is 1pt off overline (11pt) but weight default ≠ .semibold
- L264: 14/SemiBold — **off-scale** — size matches small (14/normal) but weight SemiBold ≠ .normal
- L320: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal
- L328: 13/Bold — **near-scale** — 13pt is 1pt off small (14pt) but weight Bold ≠ .normal
- L334: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L347: 9/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L373: 15/(default-regular) — **near-scale** — 15pt is 1pt off body (16pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- _…23 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/audience_profile/edit_persona/EditPersonaScreen.kt`** (34; 10/(none)×1, 11/(none)×7, 11/Bold×2, 11/Medium×3, 11/SemiBold×1, 12/(none)×1, 12/Bold×1, 12/SemiBold×4, 13/SemiBold×4, 14/(none)×1, 14/Bold×2, 14/SemiBold×3, 15/Bold×1, 16/Bold×1, 18/Bold×1, 9/Black×1)
- L177: 18/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L254: 12/SemiBold — **off-scale** — size matches caption (12/normal) but weight SemiBold ≠ .normal
- L256: 12/SemiBold — **off-scale** — size matches caption (12/normal) but weight SemiBold ≠ .normal
- L261: 11/Medium — **off-scale** — size matches overline (11/semibold) but weight Medium ≠ .semibold
- L309: 15/Bold — **near-scale** — 15pt is 1pt off body (16pt) but weight Bold ≠ .normal
- L315: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L353: 16/Bold — **off-scale** — size matches body (16/normal) but weight Bold ≠ .normal
- L406: 11/Medium — **off-scale** — size matches overline (11/semibold) but weight Medium ≠ .semibold
- _…26 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/auth/LoginScreen.kt`** (1; 1/(none)×1)
- L231: 1/(default-regular) — **off-scale (way off)** — no scale entry within 1pt — needs design citation

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/ceremonial_mail/CeremonialMailWizardScreen.kt`** (29; 10/Bold×1, 11/(none)×1, 11/Bold×1, 12/(none)×5, 12/Medium×1, 12/SemiBold×3, 13/(none)×6, 13/SemiBold×1, 14/SemiBold×4, 15/SemiBold×1, 18/Bold×5)
- L140: 12/Medium — **off-scale** — size matches caption (12/normal) but weight Medium ≠ .normal
- L157: 18/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L163: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L216: 14/SemiBold — **off-scale** — size matches small (14/normal) but weight SemiBold ≠ .normal
- L221: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L279: 15/SemiBold — **near-scale** — 15pt is 1pt off body (16pt) but weight SemiBold ≠ .normal
- L284: 12/(default-regular) — **on-scale (replaced by Pass 2)** — matches caption (12/.normal)
- L335: 14/SemiBold — **off-scale** — size matches small (14/normal) but weight SemiBold ≠ .normal
- _…21 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/ceremonial_mail_open/CeremonialMailOpenScreen.kt`** (40; 10/Bold×2, 10/SemiBold×1, 11/Bold×1, 11/SemiBold×1, 12/SemiBold×3, 13/(none)×2, 13/Bold×1, 13/Medium×1, 13/SemiBold×3, 14/Bold×2, 14/SemiBold×2, 15/(none)×3, 16/SemiBold×1, 18/Bold×1, 18/Medium×3, 18/SemiBold×1, 19/(none)×1, 28/Medium×2, 6/Bold×2, 9/Bold×6, 9/SemiBold×1)
- L238: 18/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L243: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L258: 13/Bold — **near-scale** — 13pt is 1pt off small (14pt) but weight Bold ≠ .normal
- L293: 16/SemiBold — **off-scale** — size matches body (16/normal) but weight SemiBold ≠ .normal
- L385: 11/SemiBold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L395: 28/Medium — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L541: 18/Medium — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L577: 14/SemiBold — **off-scale** — size matches small (14/normal) but weight SemiBold ≠ .normal
- _…32 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/compose/gig/GigComposeMagic.kt`** (12; 10/(none)×1, 10/Bold×1, 10/SemiBold×1, 11/(none)×3, 11/Bold×1, 12/Bold×2, 12/SemiBold×1, 13/(none)×1, 13/Bold×1)
- L220: 12/Bold — **off-scale** — size matches caption (12/normal) but weight Bold ≠ .normal
- L225: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold
- L266: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L301: 10/SemiBold — **near-scale** — 10pt is 1pt off overline (11pt/.semibold); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L306: 12/SemiBold — **off-scale** — size matches caption (12/normal) but weight SemiBold ≠ .normal
- L373: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L376: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L393: 11/Bold — **off-scale** — size matches overline (11/semibold) but weight Bold ≠ .semibold
- _…4 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/contentdetail/ContentDetailShell.kt`** (33; 10/(none)×1, 10/Bold×2, 10/Medium×1, 10/SemiBold×1, 11/(none)×1, 11/Bold×1, 11/Medium×2, 12/(none)×2, 12/Bold×1, 12/Medium×2, 12/SemiBold×1, 13/Bold×2, 13/Medium×3, 14/Bold×3, 16/Bold×1, 18/Bold×1, 22/Bold×1, 32/ExtraBold×1, 9/Bold×6)
- L136: 18/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L154: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal
- L363: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L371: 22/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L398: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold
- L408: 11/Medium — **off-scale** — size matches overline (11/semibold) but weight Medium ≠ .semibold
- L423: 32/ExtraBold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L435: 12/Medium — **off-scale** — size matches caption (12/normal) but weight Medium ≠ .normal
- _…25 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/contentdetail/InvoiceDetailScreen.kt`** (3; 13/(none)×1, 14/Bold×1, 18/Bold×1)
- L86: 18/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L94: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L109: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/contentdetail/ListingDetailScreen.kt`** (3; 13/(none)×1, 14/Bold×1, 18/Bold×1)
- L120: 18/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L123: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L157: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/creator_inbox/CreatorInboxScreen.kt`** (22; 10/(none)×1, 11/(none)×2, 11/Bold×1, 11/Medium×1, 11/SemiBold×2, 12/(none)×3, 13/(none)×3, 13/SemiBold×1, 14/SemiBold×1, 15/Bold×1, 15/SemiBold×1, 18/Bold×1, 19/SemiBold×1, 9/Bold×3)
- L153: 15/SemiBold — **near-scale** — 15pt is 1pt off body (16pt) but weight SemiBold ≠ .normal
- L161: 11/Medium — **off-scale** — size matches overline (11/semibold) but weight Medium ≠ .semibold
- L240: 18/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L248: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L309: 12/(default-regular) — **on-scale (replaced by Pass 2)** — matches caption (12/.normal)
- L324: 11/SemiBold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L423: 11/SemiBold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L429: 9/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- _…14 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/explore/ExploreMapScreen.kt`** (17; 10/(none)×1, 10/Bold×1, 11/Medium×1, 12/Bold×1, 12/Medium×1, 12/SemiBold×2, 13/(none)×2, 13/Bold×1, 13/SemiBold×2, 14/Bold×2, 15/Bold×1, 9/Bold×2)
- L442: 13/Bold — **near-scale** — 13pt is 1pt off small (14pt) but weight Bold ≠ .normal
- L504: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal
- L548: 12/Bold — **off-scale** — size matches caption (12/normal) but weight Bold ≠ .normal
- L874: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal
- L905: 12/Medium — **off-scale** — size matches caption (12/normal) but weight Medium ≠ .normal
- L911: 12/SemiBold — **off-scale** — size matches caption (12/normal) but weight SemiBold ≠ .normal
- L972: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold
- L1096: 13/SemiBold — **near-scale** — 13pt is 1pt off small (14pt) but weight SemiBold ≠ .normal
- _…9 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/feed/FeedScreen.kt`** (5; 14/Bold×2, 18/Bold×1, 20/Bold×1, 22/Bold×1)
- L134: 22/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L196: 20/Bold — **off-scale** — size matches h3 (20/semibold) but weight Bold ≠ .semibold
- L230: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal
- L310: 18/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L334: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/feed/pulse/PulsePostCard.kt`** (4; 10/Bold×1, 11/Bold×1, 11/Medium×1, 13/SemiBold×1)
- L136: 13/SemiBold — **near-scale** — 13pt is 1pt off small (14pt) but weight SemiBold ≠ .normal
- L195: 11/Medium — **off-scale** — size matches overline (11/semibold) but weight Medium ≠ .semibold
- L221: 11/Bold — **off-scale** — size matches overline (11/semibold) but weight Bold ≠ .semibold
- L338: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/gigs/GigsFeedScreen.kt`** (13; 10/(none)×1, 10/Bold×3, 11/Medium×1, 12/(none)×1, 14/Bold×3, 14/SemiBold×1, 18/Bold×1, 20/Bold×1, 22/Bold×1)
- L165: 22/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L454: 20/Bold — **off-scale** — size matches h3 (20/semibold) but weight Bold ≠ .semibold
- L487: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal
- L585: 10/(default-regular) — **near-scale** — 10pt is 1pt off overline (11pt) but weight default ≠ .semibold
- L594: 14/SemiBold — **off-scale** — size matches small (14/normal) but weight SemiBold ≠ .normal
- L604: 12/(default-regular) — **on-scale (replaced by Pass 2)** — matches caption (12/.normal)
- L618: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal
- L641: 11/Medium — **off-scale** — size matches overline (11/semibold) but weight Medium ≠ .semibold
- _…5 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/gigs/tasks_map/TasksMapScreen.kt`** (14; 10/Medium×1, 12/Medium×1, 12/SemiBold×1, 13/(none)×1, 13/Bold×3, 13/SemiBold×2, 14/Bold×3, 15/Bold×1, 9/Bold×1)
- L185: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal
- L302: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal
- L367: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal
- L381: 12/Medium — **off-scale** — size matches caption (12/normal) but weight Medium ≠ .normal
- L387: 12/SemiBold — **off-scale** — size matches caption (12/normal) but weight SemiBold ≠ .normal
- L504: 13/SemiBold — **near-scale** — 13pt is 1pt off small (14pt) but weight SemiBold ≠ .normal
- L518: 13/Bold — **near-scale** — 13pt is 1pt off small (14pt) but weight Bold ≠ .normal
- L524: 10/Medium — **near-scale** — 10pt is 1pt off overline (11pt) but weight Medium ≠ .semibold
- _…6 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/handshake/PrivacyHandshakeScreen.kt`** (22; 11/(none)×2, 12/(none)×5, 12/SemiBold×1, 13/(none)×2, 13/Bold×1, 13/SemiBold×1, 14/Bold×1, 14/SemiBold×1, 15/SemiBold×2, 16/Bold×5, 22/Bold×1)
- L120: 15/SemiBold — **near-scale** — 15pt is 1pt off body (16pt) but weight SemiBold ≠ .normal
- L138: 13/Bold — **near-scale** — 13pt is 1pt off small (14pt) but weight Bold ≠ .normal
- L198: 22/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L206: 16/Bold — **off-scale** — size matches body (16/normal) but weight Bold ≠ .normal
- L210: 12/(default-regular) — **on-scale (replaced by Pass 2)** — matches caption (12/.normal)
- L213: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L219: 12/(default-regular) — **on-scale (replaced by Pass 2)** — matches caption (12/.normal)
- L239: 16/Bold — **off-scale** — size matches body (16/normal) but weight Bold ≠ .normal
- _…14 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/calendar/MonthStripHeader.kt`** (3; 10/SemiBold×1, 13/SemiBold×1, 14/Bold×1)
- L128: 13/SemiBold — **near-scale** — 13pt is 1pt off small (14pt) but weight SemiBold ≠ .normal
- L252: 10/SemiBold — **near-scale** — 10pt is 1pt off overline (11pt/.semibold); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L259: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/documents/FileTypeTile.kt`** (1; 8/ExtraBold×1)
- L57: 8/ExtraBold — **off-scale (way off)** — no scale entry within 1pt — needs design citation

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/members/InviteMemberWizardSheet.kt`** (1; 14/Normal×1)
- L295: 14/Normal — **on-scale (replaced by Pass 2)** — matches small (14/.normal)

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/pets/AddPetWizardSheet.kt`** (1; 14/Normal×1)
- L308: 14/Normal — **on-scale (replaced by Pass 2)** — matches small (14/.normal)

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/hub/sections/HubSections.kt`** (27; 10/(none)×1, 10/Bold×4, 11/(none)×4, 11/Bold×1, 11/SemiBold×1, 12/(none)×1, 12/Bold×2, 12/SemiBold×2, 13/(none)×1, 13/Bold×5, 13/SemiBold×1, 16/Bold×1, 17/Bold×1, 20/Bold×1, 22/Bold×1)
- L95: 17/Bold — **near-scale** — 17pt is 1pt off body (16pt) but weight Bold ≠ .normal
- L214: 13/SemiBold — **near-scale** — 13pt is 1pt off small (14pt) but weight SemiBold ≠ .normal
- L236: 12/Bold — **off-scale** — size matches caption (12/normal) but weight Bold ≠ .normal
- L327: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold
- L338: 22/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L346: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L365: 13/Bold — **near-scale** — 13pt is 1pt off small (14pt) but weight Bold ≠ .normal
- L426: 20/Bold — **off-scale** — size matches h3 (20/semibold) but weight Bold ≠ .semibold
- _…19 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/identity_center/IdentityCenterScreen.kt`** (12; 10/Bold×1, 11/Bold×1, 12/(none)×2, 12/Medium×1, 12/SemiBold×1, 14/Medium×1, 15/Medium×1, 16/SemiBold×1, 18/Bold×1, 9/Bold×2)
- L160: 16/SemiBold — **off-scale** — size matches body (16/normal) but weight SemiBold ≠ .normal
- L307: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold
- L332: 12/Medium — **off-scale** — size matches caption (12/normal) but weight Medium ≠ .normal
- L381: 9/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L407: 9/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L443: 14/Medium — **off-scale** — size matches small (14/normal) but weight Medium ≠ .normal
- L450: 12/(default-regular) — **on-scale (replaced by Pass 2)** — matches caption (12/.normal)
- L524: 15/Medium — **near-scale** — 15pt is 1pt off body (16pt) but weight Medium ≠ .normal
- _…4 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/chat/ChatListScreen.kt`** (6; 10/Bold×1, 14/Bold×2, 18/Bold×1, 20/Bold×1, 22/Bold×1)
- L106: 22/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L245: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold
- L324: 20/Bold — **off-scale** — size matches h3 (20/semibold) but weight Bold ≠ .semibold
- L355: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal
- L424: 18/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L444: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/chat/ConversationRow.kt`** (1; 9/Bold×1)
- L261: 9/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/conversation/ChatConversationScreen.kt`** (42; 10/(none)×1, 10/Bold×2, 10/Medium×2, 10/SemiBold×2, 11/(none)×5, 11/Bold×1, 11/Medium×1, 11/SemiBold×1, 12/Bold×3, 12/Medium×2, 13/Bold×2, 13/SemiBold×2, 14/(none)×4, 14/Bold×4, 18/Bold×2, 20/Bold×2, 9/Bold×4, 9/ExtraBold×1, 9/SemiBold×1)
- L307: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal
- L393: 9/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L419: 9/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L472: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L520: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L526: 11/Bold — **off-scale** — size matches overline (11/semibold) but weight Bold ≠ .semibold
- L558: 10/(default-regular) — **near-scale** — 10pt is 1pt off overline (11pt) but weight default ≠ .semibold
- L598: 9/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- _…34 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/conversation/ai/AiComponents.kt`** (4; 10/(none)×1, 11/Bold×1, 12/Medium×1, 18/Bold×1)
- L91: 12/Medium — **off-scale** — size matches caption (12/normal) but weight Medium ≠ .normal
- L127: 18/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L141: 11/Bold — **off-scale** — size matches overline (11/semibold) but weight Bold ≠ .semibold
- L147: 10/(default-regular) — **near-scale** — 10pt is 1pt off overline (11pt) but weight default ≠ .semibold

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/newmessage/NewMessageScreen.kt`** (13; 11/(none)×1, 11/Bold×1, 11/Medium×1, 13/(none)×3, 13/Bold×1, 14/Bold×1, 15/Medium×1, 16/SemiBold×2, 18/Bold×1, 20/SemiBold×1)
- L137: 15/Medium — **near-scale** — 15pt is 1pt off body (16pt) but weight Medium ≠ .normal
- L150: 16/SemiBold — **off-scale** — size matches body (16/normal) but weight SemiBold ≠ .normal
- L204: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L213: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L375: 20/SemiBold — **on-scale (replaced by Pass 2)** — matches h3 (20/.semibold)
- L384: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L503: 16/SemiBold — **off-scale** — size matches body (16/normal) but weight SemiBold ≠ .normal
- L533: 11/Bold — **off-scale** — size matches overline (11/semibold) but weight Bold ≠ .semibold
- _…5 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/search/ChatSearchScreen.kt`** (2; 15/Bold×1, 9/Bold×1)
- L163: 15/Bold — **near-scale** — 15pt is 1pt off body (16pt) but weight Bold ≠ .normal
- L216: 9/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/listing_offers/ListingOffersScreen.kt`** (4; 14/(none)×1, 16/(none)×1, 16/SemiBold×1, 20/SemiBold×1)
- L160: 20/SemiBold — **on-scale (replaced by Pass 2)** — matches h3 (20/.semibold)
- L199: 16/SemiBold — **off-scale** — size matches body (16/normal) but weight SemiBold ≠ .normal
- L209: 16/(default-regular) — **on-scale (replaced by Pass 2)** — matches body (16/.normal)
- L247: 14/(default-regular) — **on-scale (replaced by Pass 2)** — matches small (14/.normal)

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/disambiguate/DisambiguateMailFormScreen.kt`** (2; 13/(none)×1, 14/(none)×1)
- L186: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L330: 14/(default-regular) — **on-scale (replaced by Pass 2)** — matches small (14/.normal)

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/CertifiedBody.kt`** (3; 11/Bold×1, 12/SemiBold×1, 13/(none)×1)
- L98: 11/Bold — **off-scale** — size matches overline (11/semibold) but weight Bold ≠ .semibold
- L106: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L115: 12/SemiBold — **off-scale** — size matches caption (12/normal) but weight SemiBold ≠ .normal

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/GigBody.kt`** (1; 12/Bold×1)
- L216: 12/Bold — **off-scale** — size matches caption (12/normal) but weight Bold ≠ .normal

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/MemoryBody.kt`** (13; 10/SemiBold×1, 11/(none)×1, 11/SemiBold×2, 12/(none)×3, 13/(none)×1, 13/Bold×1, 13/SemiBold×2, 14/ExtraBold×1, 22/SemiBold×1)
- L126: 22/SemiBold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L134: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L179: 12/(default-regular) — **on-scale (replaced by Pass 2)** — matches caption (12/.normal)
- L220: 13/SemiBold — **near-scale** — 13pt is 1pt off small (14pt) but weight SemiBold ≠ .normal
- L228: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L272: 12/(default-regular) — **on-scale (replaced by Pass 2)** — matches caption (12/.normal)
- L365: 11/SemiBold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L371: 13/SemiBold — **near-scale** — 13pt is 1pt off small (14pt) but weight SemiBold ≠ .normal
- _…5 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/BidCard.kt`** (2; 10/Black×1, 34/Black×1)
- L83: 34/Black — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L122: 10/Black — **near-scale** — 10pt is 1pt off overline (11pt) but weight Black ≠ .semibold

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/BidderProfileCard.kt`** (6; 11/SemiBold×1, 13/Bold×1, 14/Black×1, 15/Black×1, 16/Black×2)
- L110: 15/Black — **near-scale** — 15pt is 1pt off body (16pt) but weight Black ≠ .normal
- L175: 16/Black — **off-scale** — size matches body (16/normal) but weight Black ≠ .normal
- L185: 16/Black — **off-scale** — size matches body (16/normal) but weight Black ≠ .normal
- L194: 14/Black — **off-scale** — size matches small (14/normal) but weight Black ≠ .normal
- L238: 11/SemiBold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L272: 13/Bold — **near-scale** — 13pt is 1pt off small (14pt) but weight Bold ≠ .normal

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/CertifiedConfirmGate.kt`** (2; 10/Bold×1, 11/(none)×1)
- L130: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L286: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/CertifiedTermsSheet.kt`** (4; 12/(none)×2, 12/SemiBold×1, 13/Bold×1)
- L174: 13/Bold — **near-scale** — 13pt is 1pt off small (14pt) but weight Bold ≠ .normal
- L182: 12/(default-regular) — **on-scale (replaced by Pass 2)** — matches caption (12/.normal)
- L213: 12/SemiBold — **off-scale** — size matches caption (12/normal) but weight SemiBold ≠ .normal
- L241: 12/(default-regular) — **on-scale (replaced by Pass 2)** — matches caption (12/.normal)

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/CouponHero.kt`** (3; 13/Black×1, 16/Black×1, 42/Black×1)
- L102: 42/Black — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L226: 13/Black — **near-scale** — 13pt is 1pt off small (14pt) but weight Black ≠ .normal
- L295: 16/Black — **off-scale** — size matches body (16/normal) but weight Black ≠ .normal

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/OtherBidsStrip.kt`** (3; 11/Bold×1, 18/Black×1, 9/Black×1)
- L111: 11/Bold — **off-scale** — size matches overline (11/semibold) but weight Bold ≠ .semibold
- L113: 18/Black — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L138: 9/Black — **off-scale (way off)** — no scale entry within 1pt — needs design citation

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/PolaroidFrame.kt`** (2; 11/Bold×1, 14/(none)×1)
- L77: 14/(default-regular) — **on-scale (replaced by Pass 2)** — matches small (14/.normal)
- L87: 11/Bold — **off-scale** — size matches overline (11/semibold) but weight Bold ≠ .semibold

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/PostSummaryCard.kt`** (1; 11/SemiBold×1)
- L187: 11/SemiBold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/StationeryCard.kt`** (2; 16/(none)×1, 20/(none)×1)
- L62: 16/(default-regular) — **on-scale (replaced by Pass 2)** — matches body (16/.normal)
- L72: 20/(default-regular) — **off-scale** — size matches h3 (20/semibold) but weight default-regular ≠ .semibold

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/MailDetailScreen.kt`** (19; 10/Bold×2, 11/Bold×2, 11/Medium×1, 11/SemiBold×3, 12/(none)×1, 13/(none)×3, 13/SemiBold×2, 14/Bold×2, 14/SemiBold×1, 15/Bold×1, 24/Bold×1)
- L114: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L121: 14/SemiBold — **off-scale** — size matches small (14/normal) but weight SemiBold ≠ .normal
- L150: 13/SemiBold — **near-scale** — 13pt is 1pt off small (14pt) but weight SemiBold ≠ .normal
- L365: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal
- L373: 12/(default-regular) — **on-scale (replaced by Pass 2)** — matches caption (12/.normal)
- L383: 11/SemiBold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L393: 11/Medium — **off-scale** — size matches overline (11/semibold) but weight Medium ≠ .semibold
- L423: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal
- _…11 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/components/BookletPager.kt`** (8; 10/Bold×1, 11/(none)×1, 11/Bold×2, 11/SemiBold×2, 13/(none)×1, 13/Bold×1)
- L211: 13/Bold — **near-scale** — 13pt is 1pt off small (14pt) but weight Bold ≠ .normal
- L219: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L253: 11/SemiBold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L343: 11/Bold — **off-scale** — size matches overline (11/semibold) but weight Bold ≠ .semibold
- L350: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L361: 11/Bold — **off-scale** — size matches overline (11/semibold) but weight Bold ≠ .semibold
- L407: 11/SemiBold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L500: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/components/CertifiedComponents.kt`** (6; 10/Bold×1, 11/Bold×1, 13/Bold×2, 8/SemiBold×1, 9/Bold×1)
- L82: 9/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L89: 13/Bold — **near-scale** — 13pt is 1pt off small (14pt) but weight Bold ≠ .normal
- L111: 8/SemiBold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L166: 11/Bold — **off-scale** — size matches overline (11/semibold) but weight Bold ≠ .semibold
- L269: 13/Bold — **near-scale** — 13pt is 1pt off small (14pt) but weight Bold ≠ .normal
- L366: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/variants/BookletDetailLayout.kt`** (13; 10/Bold×1, 11/(none)×1, 11/Bold×2, 11/SemiBold×2, 12/(none)×1, 13/(none)×1, 13/SemiBold×1, 14/Bold×2, 15/Bold×1, 19/Bold×1)
- L188: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L193: 11/SemiBold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L200: 19/Bold — **near-scale** — 19pt is 1pt off h3 (20pt) but weight Bold ≠ .semibold
- L208: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L236: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold
- L261: 11/Bold — **off-scale** — size matches overline (11/semibold) but weight Bold ≠ .semibold
- L294: 11/SemiBold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L301: 13/SemiBold — **near-scale** — 13pt is 1pt off small (14pt) but weight SemiBold ≠ .normal
- _…5 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/variants/CertifiedDetailLayout.kt`** (15; 10/Bold×3, 11/(none)×3, 11/Bold×2, 11/SemiBold×2, 12/Bold×1, 12/SemiBold×1, 13/(none)×1, 15/Bold×1, 18/Bold×1)
- L333: 11/Bold — **off-scale** — size matches overline (11/semibold) but weight Bold ≠ .semibold
- L384: 11/SemiBold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L396: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L407: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold
- L447: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L457: 11/SemiBold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L464: 18/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L471: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- _…7 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/variants/CommunityDetailLayout.kt`** (48; 10/Bold×3, 11/(none)×3, 11/Bold×11, 11/SemiBold×3, 12/(none)×8, 12/Bold×1, 13/Bold×3, 14/(none)×1, 14/Bold×5, 15/Bold×1, 18/Bold×1, 19/Bold×1, 9/Bold×5, 9/SemiBold×2)
- L277: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L282: 11/SemiBold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L289: 19/Bold — **near-scale** — 19pt is 1pt off h3 (20pt) but weight Bold ≠ .semibold
- L295: 12/(default-regular) — **on-scale (replaced by Pass 2)** — matches caption (12/.normal)
- L335: 12/Bold — **off-scale** — size matches caption (12/normal) but weight Bold ≠ .normal
- L361: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold
- L447: 9/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L455: 12/(default-regular) — **on-scale (replaced by Pass 2)** — matches caption (12/.normal)
- _…40 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mailbox_root/MailboxRootContent.kt`** (4; 10/Bold×2, 13/(none)×1, 14/SemiBold×1)
- L147: 14/SemiBold — **off-scale** — size matches small (14/normal) but weight SemiBold ≠ .normal
- L180: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold
- L214: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L251: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/marketplace/MarketplaceScreen.kt`** (6; 14/Bold×2, 18/Bold×1, 20/Bold×1, 22/Bold×1, 9/Bold×1)
- L151: 22/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L350: 20/Bold — **off-scale** — size matches h3 (20/semibold) but weight Bold ≠ .semibold
- L386: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal
- L549: 9/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L628: 18/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L653: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/membership/MembershipDetailScreen.kt`** (12; 10/Bold×2, 11/(none)×1, 12/(none)×1, 12/SemiBold×1, 13/SemiBold×2, 15/Bold×1, 16/SemiBold×1, 18/Bold×1, 22/Black×2)
- L141: 16/SemiBold — **off-scale** — size matches body (16/normal) but weight SemiBold ≠ .normal
- L213: 18/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L346: 12/(default-regular) — **on-scale (replaced by Pass 2)** — matches caption (12/.normal)
- L475: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold
- L483: 22/Black — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L493: 22/Black — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L499: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L527: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold
- _…4 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/my_bids/MyBidsScreen.kt`** (5; 14/(none)×1, 14/Medium×1, 14/SemiBold×2, 20/SemiBold×1)
- L252: 20/SemiBold — **on-scale (replaced by Pass 2)** — matches h3 (20/.semibold)
- L258: 14/(default-regular) — **on-scale (replaced by Pass 2)** — matches small (14/.normal)
- L316: 14/Medium — **off-scale** — size matches small (14/normal) but weight Medium ≠ .normal
- L349: 14/SemiBold — **off-scale** — size matches small (14/normal) but weight SemiBold ≠ .normal
- L374: 14/SemiBold — **off-scale** — size matches small (14/normal) but weight SemiBold ≠ .normal

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/my_posts/MyPostsScreen.kt`** (3; 14/Medium×1, 14/SemiBold×1, 20/SemiBold×1)
- L177: 20/SemiBold — **on-scale (replaced by Pass 2)** — matches h3 (20/.semibold)
- L220: 14/SemiBold — **off-scale** — size matches small (14/normal) but weight SemiBold ≠ .normal
- L262: 14/Medium — **off-scale** — size matches small (14/normal) but weight Medium ≠ .normal

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/nearby/map/NearbyMapScreen.kt`** (15; 10/(none)×1, 10/Medium×1, 12/Bold×1, 12/Medium×1, 12/SemiBold×1, 13/(none)×1, 13/Bold×3, 13/SemiBold×2, 14/Bold×2, 9/Bold×2)
- L390: 12/Bold — **off-scale** — size matches caption (12/normal) but weight Bold ≠ .normal
- L464: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal
- L750: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal
- L764: 12/Medium — **off-scale** — size matches caption (12/normal) but weight Medium ≠ .normal
- L770: 12/SemiBold — **off-scale** — size matches caption (12/normal) but weight SemiBold ≠ .normal
- L826: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L841: 13/Bold — **near-scale** — 13pt is 1pt off small (14pt) but weight Bold ≠ .normal
- L975: 13/SemiBold — **near-scale** — 13pt is 1pt off small (14pt) but weight SemiBold ≠ .normal
- _…7 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/posts/PulsePostDetailScreen.kt`** (3; 14/Medium×1, 14/SemiBold×1, 20/SemiBold×1)
- L135: 20/SemiBold — **on-scale (replaced by Pass 2)** — matches h3 (20/.semibold)
- L151: 14/Medium — **off-scale** — size matches small (14/normal) but weight Medium ≠ .normal
- L162: 14/SemiBold — **off-scale** — size matches small (14/normal) but weight SemiBold ≠ .normal

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/profile/PublicProfileChrome.kt`** (15; 10/Bold×2, 11/SemiBold×1, 12/(none)×7, 12/Bold×1, 14/(none)×3, 14/SemiBold×1)
- L119: 14/(default-regular) — **on-scale (replaced by Pass 2)** — matches small (14/.normal)
- L135: 12/(default-regular) — **on-scale (replaced by Pass 2)** — matches caption (12/.normal)
- L136: 12/(default-regular) — **on-scale (replaced by Pass 2)** — matches caption (12/.normal)
- L174: 14/SemiBold — **off-scale** — size matches small (14/normal) but weight SemiBold ≠ .normal
- L194: 12/Bold — **off-scale** — size matches caption (12/normal) but weight Bold ≠ .normal
- L233: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold
- L263: 14/(default-regular) — **on-scale (replaced by Pass 2)** — matches small (14/.normal)
- L278: 12/(default-regular) — **on-scale (replaced by Pass 2)** — matches caption (12/.normal)
- _…7 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/profile/PublicProfileNeighbor.kt`** (13; 10/SemiBold×1, 11/(none)×2, 11/Bold×1, 11/SemiBold×2, 12/(none)×1, 13/Bold×1, 14/Bold×1, 14/SemiBold×1, 15/Bold×2, 19/Bold×1)
- L337: 19/Bold — **near-scale** — 19pt is 1pt off h3 (20pt) but weight Bold ≠ .semibold
- L353: 12/(default-regular) — **on-scale (replaced by Pass 2)** — matches caption (12/.normal)
- L431: 11/Bold — **off-scale** — size matches overline (11/semibold) but weight Bold ≠ .semibold
- L439: 11/SemiBold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L475: 15/Bold — **near-scale** — 15pt is 1pt off body (16pt) but weight Bold ≠ .normal
- L479: 10/SemiBold — **near-scale** — 10pt is 1pt off overline (11pt/.semibold); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L653: 11/SemiBold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L730: 15/Bold — **near-scale** — 15pt is 1pt off body (16pt) but weight Bold ≠ .normal
- _…5 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/review_claims/ReviewClaimDetailScreen.kt`** (1; 14/(none)×1)
- L949: 14/(default-regular) — **on-scale (replaced by Pass 2)** — matches small (14/.normal)

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/root/PantopusBottomBar.kt`** (2; 10/(none)×1, 9/(none)×1)
- L138: 10/(default-regular) — **near-scale** — 10pt is 1pt off overline (11pt) but weight default ≠ .semibold
- L162: 9/(default-regular) — **off-scale (way off)** — no scale entry within 1pt — needs design citation

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/settings/about/AboutScreen.kt`** (1; 44/ExtraBold×1)
- L61: 44/ExtraBold — **off-scale (way off)** — no scale entry within 1pt — needs design citation

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/content_detail/bodies/BodyReactionsBody.kt`** (11; 10/(none)×2, 11/(none)×1, 12/(none)×2, 12/SemiBold×1, 14/(none)×2, 14/SemiBold×1, 15/(none)×1, 15/Bold×1)
- L117: 15/(default-regular) — **near-scale** — 15pt is 1pt off body (16pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L170: 14/SemiBold — **off-scale** — size matches small (14/normal) but weight SemiBold ≠ .normal
- L333: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L388: 12/(default-regular) — **on-scale (replaced by Pass 2)** — matches caption (12/.normal)
- L433: 14/(default-regular) — **on-scale (replaced by Pass 2)** — matches small (14/.normal)
- L436: 14/(default-regular) — **on-scale (replaced by Pass 2)** — matches small (14/.normal)
- L531: 12/SemiBold — **off-scale** — size matches caption (12/normal) but weight SemiBold ≠ .normal
- L535: 10/(default-regular) — **near-scale** — 10pt is 1pt off overline (11pt) but weight default ≠ .semibold
- _…3 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/content_detail/bodies/StatsTabsBody.kt`** (9; 10/SemiBold×1, 11/SemiBold×1, 12/(none)×1, 12/SemiBold×1, 14/(none)×1, 14/SemiBold×3, 20/Bold×1)
- L160: 20/Bold — **off-scale** — size matches h3 (20/semibold) but weight Bold ≠ .semibold
- L167: 10/SemiBold — **near-scale** — 10pt is 1pt off overline (11pt/.semibold); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L201: 14/SemiBold — **off-scale** — size matches small (14/normal) but weight SemiBold ≠ .normal
- L220: 14/SemiBold — **off-scale** — size matches small (14/normal) but weight SemiBold ≠ .normal
- L266: 14/(default-regular) — **on-scale (replaced by Pass 2)** — matches small (14/.normal)
- L301: 11/SemiBold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L328: 12/SemiBold — **off-scale** — size matches caption (12/normal) but weight SemiBold ≠ .normal
- L399: 14/SemiBold — **off-scale** — size matches small (14/normal) but weight SemiBold ≠ .normal
- _…1 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/content_detail/ctas/ActionRowCta.kt`** (3; 14/Bold×2, 14/SemiBold×1)
- L107: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal
- L167: 14/SemiBold — **off-scale** — size matches small (14/normal) but weight SemiBold ≠ .normal
- L197: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/content_detail/headers/PostAuthorHeader.kt`** (2; 12/(none)×1, 14/SemiBold×1)
- L136: 14/SemiBold — **off-scale** — size matches small (14/normal) but weight SemiBold ≠ .normal
- L143: 12/(default-regular) — **on-scale (replaced by Pass 2)** — matches caption (12/.normal)

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/content_detail/headers/ProfileHeader.kt`** (4; 10/Bold×2, 12/(none)×1, 20/Bold×1)
- L124: 20/Bold — **off-scale** — size matches h3 (20/semibold) but weight Bold ≠ .semibold
- L135: 12/(default-regular) — **on-scale (replaced by Pass 2)** — matches caption (12/.normal)
- L213: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold
- L246: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/filter_sheet/FilterSheetShell.kt`** (12; 11/SemiBold×1, 12/(none)×2, 13/SemiBold×2, 14/(none)×2, 14/SemiBold×1, 15/(none)×3, 18/SemiBold×1)
- L188: 18/SemiBold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L265: 11/SemiBold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L376: 14/(default-regular) — **on-scale (replaced by Pass 2)** — matches small (14/.normal)
- L425: 14/(default-regular) — **on-scale (replaced by Pass 2)** — matches small (14/.normal)
- L465: 15/(default-regular) — **near-scale** — 15pt is 1pt off body (16pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L542: 15/(default-regular) — **near-scale** — 15pt is 1pt off body (16pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L607: 15/(default-regular) — **near-scale** — 15pt is 1pt off body (16pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L673: 12/(default-regular) — **on-scale (replaced by Pass 2)** — matches caption (12/.normal)
- _…4 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/form/FormShell.kt`** (1; 10/SemiBold×1)
- L248: 10/SemiBold — **near-scale** — 10pt is 1pt off overline (11pt/.semibold); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/grouped_list/GroupedListScreen.kt`** (8; 11/(none)×2, 11/Bold×1, 12/(none)×1, 14/Bold×1, 15/Medium×1, 16/SemiBold×1, 18/Bold×1)
- L130: 16/SemiBold — **off-scale** — size matches body (16/normal) but weight SemiBold ≠ .normal
- L201: 11/Bold — **off-scale** — size matches overline (11/semibold) but weight Bold ≠ .semibold
- L260: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L348: 15/Medium — **near-scale** — 15pt is 1pt off body (16pt) but weight Medium ≠ .normal
- L356: 12/(default-regular) — **on-scale (replaced by Pass 2)** — matches caption (12/.normal)
- L559: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L594: 18/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L619: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/identity/IdentitySwitcherPillRow.kt`** (1; 12/Bold×1)
- L95: 12/Bold — **off-scale** — size matches caption (12/normal) but weight Bold ≠ .normal

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/identity/IdentitySwitcherSheet.kt`** (3; 10/Bold×1, 16/SemiBold×1, 9/Bold×1)
- L92: 16/SemiBold — **off-scale** — size matches body (16/normal) but weight SemiBold ≠ .normal
- L165: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold
- L211: 9/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/list_of_rows/ListOfRowsScreen.kt`** (6; 10/SemiBold×1, 11/SemiBold×1, 14/(none)×1, 18/Bold×1, 7/Bold×2)
- L320: 14/(default-regular) — **on-scale (replaced by Pass 2)** — matches small (14/.normal)
- L552: 18/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L1132: 10/SemiBold — **near-scale** — 10pt is 1pt off overline (11pt/.semibold); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L1717: 7/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L1739: 7/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L2052: 11/SemiBold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/mail_item_detail/ChainOfCustodyTimeline.kt`** (5; 10/Bold×1, 11/(none)×2, 11/Bold×1, 9/Bold×1)
- L131: 11/Bold — **off-scale** — size matches overline (11/semibold) but weight Bold ≠ .semibold
- L139: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold
- L152: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold
- L212: 9/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L220: 11/(default-regular) — **off-scale** — size matches overline (11/semibold) but weight default-regular ≠ .semibold

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/mail_item_detail/MailItemDetailShell.kt`** (12; 10/Bold×1, 11/(none)×1, 11/Bold×1, 11/SemiBold×2, 12/(none)×1, 12/Bold×2, 13/(none)×1, 13/SemiBold×1, 15/(none)×1, 9/Bold×1)
- L215: 15/(default-regular) — **near-scale** — 15pt is 1pt off body (16pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L247: 12/Bold — **off-scale** — size matches caption (12/normal) but weight Bold ≠ .normal
- L404: 12/Bold — **off-scale** — size matches caption (12/normal) but weight Bold ≠ .normal
- L422: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold
- L445: 11/SemiBold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L454: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L505: 12/(default-regular) — **on-scale (replaced by Pass 2)** — matches caption (12/.normal)
- L544: 11/Bold — **off-scale** — size matches overline (11/semibold) but weight Bold ≠ .semibold
- _…4 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/map_list_hybrid/MapListHybridPreview.kt`** (8; 11/SemiBold×2, 12/Medium×1, 12/SemiBold×1, 13/SemiBold×2, 14/Bold×2)
- L196: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal
- L311: 14/Bold — **off-scale** — size matches small (14/normal) but weight Bold ≠ .normal
- L323: 12/Medium — **off-scale** — size matches caption (12/normal) but weight Medium ≠ .normal
- L329: 12/SemiBold — **off-scale** — size matches caption (12/normal) but weight SemiBold ≠ .normal
- L456: 13/SemiBold — **near-scale** — 13pt is 1pt off small (14pt) but weight SemiBold ≠ .normal
- L462: 11/SemiBold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L502: 13/SemiBold — **near-scale** — 13pt is 1pt off small (14pt) but weight SemiBold ≠ .normal
- L508: 11/SemiBold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/status/StatusWaitingScreen.kt`** (9; 10/Bold×1, 12/(none)×1, 12/SemiBold×1, 13/(none)×1, 14/(none)×1, 14/Bold×1, 14/SemiBold×2, 22/Bold×1)
- L138: 22/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L145: 14/(default-regular) — **on-scale (replaced by Pass 2)** — matches small (14/.normal)
- L173: 12/SemiBold — **off-scale** — size matches caption (12/normal) but weight SemiBold ≠ .normal
- L213: 14/SemiBold — **off-scale** — size matches small (14/normal) but weight SemiBold ≠ .normal
- L218: 12/(default-regular) — **on-scale (replaced by Pass 2)** — matches caption (12/.normal)
- L246: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold
- L266: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L307: 14/SemiBold — **off-scale** — size matches small (14/normal) but weight SemiBold ≠ .normal
- _…1 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/support_trains/start_train/StartSupportTrainWizardScreen.kt`** (8; 10/(none)×3, 10/Bold×2, 9/(none)×1, 9/Bold×2)
- L338: 9/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L362: 10/(default-regular) — **near-scale** — 10pt is 1pt off overline (11pt) but weight default ≠ .semibold
- L527: 9/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L664: 10/(default-regular) — **near-scale** — 10pt is 1pt off overline (11pt) but weight default ≠ .semibold
- L670: 10/(default-regular) — **near-scale** — 10pt is 1pt off overline (11pt) but weight default ≠ .semibold
- L825: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold
- L834: 9/(default-regular) — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L1306: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/token_accept/TokenAcceptScreen.kt`** (21; 10/Bold×2, 12/(none)×1, 12/Medium×1, 13/(none)×4, 13/Bold×3, 14/Bold×1, 14/SemiBold×1, 16/SemiBold×3, 18/Bold×3, 20/Bold×1, 22/Bold×1)
- L102: 16/SemiBold — **off-scale** — size matches body (16/normal) but weight SemiBold ≠ .normal
- L169: 16/SemiBold — **off-scale** — size matches body (16/normal) but weight SemiBold ≠ .normal
- L175: 22/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L187: 13/(default-regular) — **near-scale** — 13pt is 1pt off small (14pt/.normal); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L211: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold
- L287: 16/SemiBold — **off-scale** — size matches body (16/normal) but weight SemiBold ≠ .normal
- L310: 10/Bold — **near-scale** — 10pt is 1pt off overline (11pt) but weight Bold ≠ .semibold
- L359: 12/(default-regular) — **on-scale (replaced by Pass 2)** — matches caption (12/.normal)
- _…13 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/you/me/MeView.kt`** (12; 10/Bold×1, 10/SemiBold×1, 11/SemiBold×1, 12/Medium×3, 14/Bold×1, 18/Bold×2, 20/Bold×1, 26/Bold×1, 9/Bold×1)
- L213: 20/Bold — **off-scale** — size matches h3 (20/semibold) but weight Bold ≠ .semibold
- L220: 12/Medium — **off-scale** — size matches caption (12/normal) but weight Medium ≠ .normal
- L235: 12/Medium — **off-scale** — size matches caption (12/normal) but weight Medium ≠ .normal
- L278: 26/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L330: 18/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- L336: 10/SemiBold — **near-scale** — 10pt is 1pt off overline (11pt/.semibold); weight matches but auto-snap shifts size 1pt (not applied — would fail snapshot)
- L422: 11/SemiBold — **off-scale (overline-special)** — (11, .semibold) matches overline by size+weight but using .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em tracking — manual review per call site
- L442: 9/Bold — **off-scale (way off)** — no scale entry within 1pt — needs design citation
- _…4 more in this file_

