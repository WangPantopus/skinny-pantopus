# Claude Design prompt pack — shared preamble and per-prompt template

Claude Design has **no repo access**, so every prompt must be self-contained. The founder's existing
system lives in two Claude Design projects (both returned 403 to me, so I cannot quote them — the
prompts tell Claude Design to open them):

- https://claude.ai/design/p/019e16cb-d2a9-77b0-b9e0-370dbe3856ba?via=share
- https://claude.ai/design/p/c65a37ac-191a-4cdc-9f30-602926979fd6?via=share

All existing Pantopus screens are already designed there. So most prompts are **"extend this existing
screen"**, not "design a new screen" — that distinction is the single most important thing to get right,
or the output will drift from a shipped app.

---

## BLOCK A — paste at the top of every prompt (the house style)

> **Pantopus design system.** Before designing, open these two projects and use them as the source of
> truth for every token, component and layout convention:
> https://claude.ai/design/p/019e16cb-d2a9-77b0-b9e0-370dbe3856ba?via=share and
> https://claude.ai/design/p/c65a37ac-191a-4cdc-9f30-602926979fd6?via=share
> All existing Pantopus screens are already designed there — match them. Do not invent a new visual
> language, a new card style, a new type scale or a new icon set.
>
> **Design direction:** clean, trustworthy, warm.
>
> **Tokens** (shared source of truth, mirrored on iOS and Android — use these names, never raw hex):
> - Primary sky-blue ramp 50→900, `primary.DEFAULT #0284c7`, `primary.500 #0ea5e9`, `primary.700 #0369a1`
> - Surfaces: `base #FFFFFF` · `raised #F9FAFB` · `sunken #F3F4F6` · `app #F6F7F9` · `muted #F8FAFC`
> - Text: `primary #111827` · `strong #374151` · `secondary #6B7280` · `muted #9CA3AF` · `inverse #FFFFFF`
> - Borders: `default #E5E7EB` · `strong #D1D5DB` · `focus #0284c7` · `subtle #F3F4F6`
> - Semantic: `success #059669` / `successBg #F0FDF4` · `warning #D97706` / `warningBg #FFFBEB` ·
>   `error #DC2626` / `errorBg #FEF2F2` · `info #0284c7` / `infoBg #F0F9FF`
> - Identity pillars: personal `#0284C7` · home `#16A34A` · business `#7C3AED` · professional `#D97706`
> - Dark mode: surface `base #0F172A` · `raised #1E293B` · `app #020617`; text `primary #E5E7EB` ·
>   `secondary #94A3B8`; border `default #1F2937` · `focus #38BDF8`
> - Type scale: h1 30/36/700 · h2 24/32/600 · h3 20/28/600 · body 16/24/400 · bodySmall 14/20/400 ·
>   label 13/18 · caption 12/16/400 · overline 11/16/600 uppercase +0.5 tracking
>
> **House rule:** every colour is a semantic token. If a colour you want is not in the list above, you
> are designing something the system cannot express — pick the nearest token instead.
>
> **Draw both light and dark.**

## BLOCK B — the honesty rules (Pantopus-specific; most designers would miss these)

These are product rules, not style preferences. They come from the design doc's §2 and they have to be
visible in the pixels:

> - **Unverified data must look unverified.** Anything sourced from a city default rather than confirmed
>   by the household carries a visible "unconfirmed" treatment, consistently, on every surface it appears
>   on (calendar row, push, widget, compare card). Design that treatment once and reuse it.
> - **"Only you" vs "your household."** A saved place is private; a claimed home is shared with
>   co-residents. Every surface that shows address data says which it is.
> - **Never imply a claim about a neighbour's home.** Comparison surfaces are about *places and sources*,
>   never "your neighbour's house."
> - **Silence is a valid state.** "Nothing needs your attention today" is a designed state, not an error
>   or an empty shell — and it only shows when every check actually succeeded.
> - **Sources are shown, not hidden.** Where a fact comes from a public dataset, the source is on the
>   surface ("FEMA flood zone", "AirNow, today", "County radon zone (EPA)").

## BLOCK C — platforms and viewports

> - **Web:** 1440×900 desktop and 390×844 mobile web. Four-tab bottom bar on mobile, left sidebar on desktop.
> - **iOS:** 393×852 (iPhone 15/16 Pro). Native nav patterns, sheets with detents.
> - **Android:** 412×915. Material 3 patterns, bottom sheets.
> - **Navigation is fixed at four tabs: Place · Today · Nearby · Mail.** Do not add a tab, rename one, or
>   propose a fifth. Every screen must be reachable from those four plus deep links.

## BLOCK D — what every prompt must specify (the per-screen template)

```
[BLOCK A] [BLOCK B] [BLOCK C]

SCREEN: <name>
PLATFORM(S): <web / iOS / Android>
THIS IS: <a NEW screen> | <an EXTENSION of the existing designed screen "<name>"> 
WHERE IT LIVES: <tab> → <parent screen> → <this>
HOW THE USER GETS HERE: <nav / CTA on X / push notification / widget tap / deep link URL>
THE ONE JOB: <a single sentence — what the user accomplishes>

CONTENT (use this exact copy and this realistic density — no lorem):
  <real strings from the design doc, real addresses, real dates, realistic worst case>

THE VISUALIZATION DECISION:
  <the specific layout/chart/encoding, and why — this is the part that must not be generic>

STATES TO DRAW (each as its own frame):
  <loading / empty / error / offline / unverified / tier-gated / permission-denied — only the real ones>

DO NOT:
  <the specific failure mode for this screen>
```

## Ordering principle for the pack

Group prompts by **build phase** (the founder builds top to bottom), not by feature number:
hygiene → bridge → checklist → dates → household → compare → movers → widgets → phase 2.
Within a phase, web first (the doc ships backend+web first, natives follow).
