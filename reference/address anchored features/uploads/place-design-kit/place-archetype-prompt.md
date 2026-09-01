# Step 2a — Foundation + the `Place` / ProfileDashboard archetype prompt

## Foundation: reuse what you have

The **Pantopus Design System** skill is the inherited foundation for every Claude Design prompt. Don't rebuild it. Each prompt opens by invoking it:

> *Use the Pantopus Design System skill. Include `colors_and_type.css`. Copy component recipes from `preview/` (buttons, inputs, chips, cards, avatars, icons) and layouts from `ui_kits/mobile/` + `ui_kits/web/`. Use the `ios-frame.jsx` device frame for mobile mocks.*

**Non-negotiables (from the skill) that every Place screen must honor:**

- Primary sky `#0284C7`; **Place pillar accent = Home green `#16A34A`** (section icons, chips, verified badge); CTAs/links stay sky blue.
- System font stack, no webfonts. Lucide icons, stroke 2, 16–24px. **No emoji in product UI.**
- Cards: white, `border #e5e7eb` + `shadow-sm`, `rounded-2xl` (16–20), padding 16–24. **No left-border color accents** — color lives in chips/icons/pills.
- App shell flat `#f6f7f9`. **No** stationery/serif/porch/wax-seal/seasonal tokens (mailbox & persona letters only). No gradients, no textures.
- Voice: plainspoken, second person, verbs-first CTAs, sentence case. **No "unlock," "seamless," "reimagine," no exclamation points, no em-dash AI cadence.**
- No "Loading…" — **shimmer skeletons.** Verified users get a green check badge on the avatar.

---

## The prompt (paste into Claude Design)

```
Use the Pantopus Design System skill — include colors_and_type.css, copy recipes from
preview/ and ui_kits/, and use ios-frame.jsx for the device frame. Honor the
non-negotiables (sky #0284C7 primary; Place accent = Home green #16A34A; system font;
Lucide stroke-2; white bordered cards, rounded-2xl, shadow-sm, NO left-border accents;
flat #f6f7f9 shell; NO stationery/serif/ceremony — this is product UI; voice plainspoken,
second person, verbs-first, sentence case, no "unlock"/"seamless"/exclamations; shimmer
skeletons, never "Loading…"; no emoji in product UI).

Design a NEW archetype for Pantopus: "Place" — the ProfileDashboard. iOS mobile first,
inside the ios-frame. Produce these three pieces on one canvas:

──────────────────────────────────────────────────────────────
1) THE SECTION-CARD ATOM — all five states (this is the reusable unit)
A single card pattern, shown five times so the states are visible side by side:
  • header row: a Lucide section icon (Home-green), a sentence-case title, an optional
    "as of <date>" caption right-aligned, and a chevron affording tap-through.
  • LOADED — title + 1–3 lines of content (real example values).
  • EMPTY — neutral "Nothing here yet" with a quiet hint, no error styling.
  • UNAVAILABLE — for ragged coverage: "Not available for your area yet." muted, no alarm.
  • STALE — same as loaded but with a subtle "as of <older date>" and a small refresh icon.
  • ERROR — "Couldn't load this" + a verbs-first "Try again" text button.
  • LOADING — a shimmer skeleton version of the card (no spinner, no "Loading…").

2) THE TWO SPECIAL CARDS
  • LOCKED card — the style for content the current tier can't see yet. Same card frame,
    content area replaced by a one-line reason + a verbs-first CTA. Show three:
      – "Save this place to see your home's exact details and value."   (create account)
      – "Claim your place to add bills, maintenance, and your tools."    (claim home)
      – "Verify your address to message neighbors."                      (verify address)
    Lock affordance is a small Lucide lock in the header, not a color-flooded card.
  • DENSITY BUCKET card — four variants, bucket text only, never a number:
      "Your block is starting to form" / "A few verified homes nearby" /
      "Growing activity near this area" / "No activity shown yet"
    CTA: "Be one of the first to verify on your block."

3) THE ASSEMBLED DASHBOARD — verified user (full access), iOS-framed
  • Top header: "Your Place" + the address line (e.g., "1421 SE Oak St, Portland") + an
    avatar top-right with a green verified check badge.
  • HERO "Today's Pulse" — a calm card that floats what matters now. Show the ALL-CLEAR
    state: a one-line reassuring summary + one useful non-urgent nudge. Then ALSO render an
    ALTERNATE hero card showing an active alert (e.g., air quality), urgency carried by a
    semantic chip + Lucide icon, never a left-border or a red flood-fill.
  • Then curated GROUPS, each a labeled section (overline label) holding section-cards,
    with this real content:
      TODAY — Weather "62°, clear"; Air quality "Good (38)"; "No active alerts"; sunrise/sunset.
      HEALTH & ENVIRONMENT — Lead/radon "Built 1979 — lead paint possible; test before
        renovation" (caption: "Screening, not a diagnosis"); Water "Portland Water Bureau ·
        no recent health-based violations"; Environment "2 EPA-regulated facilities within
        1 mile · regulated activity, not unsafe exposure".
      YOUR HOME — "Built 1979 · 1,840 sqft · est. value $612,000" with a small value sparkline.
      RISK & READINESS — Flood "Zone X — minimal risk"; an "Emergency plan" row.
      YOUR BLOCK — Density "A few verified homes nearby"; Permits in the UNAVAILABLE state
        ("Not available for your area yet").
      MONEY SIGNALS — Bill benchmark "Your electric bill is 12% above neighbors"; Incentives
        "Heat-pump rebate may apply — you may be eligible, verify"; Rent band "2BR market
        band $2,120–$2,600".
      CIVIC — "Your districts" + "Next election in 34 days · view your ballot".
      IDENTITY — "Verified" (with badge) + a "Generate a residency letter" row.
  • Show the Permits card UNAVAILABLE and density as a BUCKET, to prove section-by-section
    degradation. Let a couple of cards render as shimmer skeletons (still loading).
  • Bottom tab bar (Lucide): Place / Neighborhood / Beacon / Inbox, with Place active.
    Profile lives behind the header avatar, NOT in the tab bar.

Produce v1, then we'll refine spacing, the hero treatment, and card density.
```

---

## What this establishes, and what's next

This one prompt defines the **system** (the card atom + its states + the locked and density cards) and the **assembled shell** at the verified tier. Every Place screen after it is the same shell at a different trust tier — achieved by swapping which cards are locked.

The **first screen prompt to run next** is the **T0 preview**: the same shell, anonymous, with only the free sections live (Today, flood, density bucket, area-property teaser from Census) and everything else as the locked card we just defined, plus the soft-wall ("Create an account to save this place and see your exact home details"). It can borrow the preview framing from your existing A18 status/preview archetype.

**One thing to confirm before we run the screen prompts:** Place accent = Home green `#16A34A`? If yes, I'll lock it into the prompt header and we move to the launch-set screen prompts in order (T0 preview → onboarding hero → claimed/T3 → verification → the group detail screens). If you'd rather Place stay sky-blue-primary throughout, say so and I'll adjust.
