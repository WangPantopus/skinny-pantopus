# Pantopus Product Design — Address-Led Home Intelligence, the Trust Ladder & Onboarding

> **Scope.** This is a **product-level** design doc: the user model, the onboarding funnel, the US / non-US split, the feature-gating model, and how the 13 home-intelligence items blend into the *current* app without feeling bolted on. It deliberately does **not** design screens, layouts, or components — that's the next step, and it reads off this doc and the Step 1 `PlaceIntelligence` contract.
>
> **The decisions it makes (recommendations inside, marked ⟡ where they need your sign-off):** what the app *is* once address is central; how Address and Location differ; the five-tier trust ladder; one address-first onboarding funnel; the non-US experience; where each of the 13 lives; the gating matrix; the conversion mechanics.

---

## 1. Product thesis: make "your place" the gravity, not a bolt-on

Today the app asks for a verified address and gives back **trust** — "you know who you're dealing with." Trust is a means, not a reason to act. That's why the address feels like a chore: the payoff is abstract and deferred.

The 13 items change that. They make a verified address **immediately and daily valuable on its own** — your flood risk, today's air, your home's value, who your verified neighbors are. That is what converts the address from a gate into a *hook*. So the product move is not "add a home-tools module." It's:

> **Make "your place" the gravitational center of the app, and let Feed, Marketplace, Gigs, and Beacon orbit it as "things you do with your verified neighbors."**

The seamless blend follows from that framing: the home dashboard isn't a new destination grafted onto a social app — it becomes *the reason you have an account*, and the existing pillars become the social and economic life that happens around a place. Address is the connective tissue, not a feature.

---

## 2. The conceptual unlock: **Address ≠ Location**

The single most important distinction for this whole design — and the key to the non-US question — is that the product needs **three** levels of place, not one:

| Concept | Precision | Geography | What it unlocks | Complexity |
|---|---|---|---|---|
| **Verified Address** | exact, claimed, verified | **US only (for now)** | Home intelligence (the 13), neighbor messaging, mailbox, owner features, "verified neighbor" trust | High (Google/Smarty/Lob, async, fallible) |
| **Location** | approximate (city / area / coarse lat-lng) | global-capable | Neighborhood discovery scope (Feed / Marketplace / Gigs "near me") | Low |
| **None (global)** | — | global | Creator/Beacon layer — follow, fan, broadcasts, DMs, tiers | None |

Your instinct ("non-US addresses are too complicated, defer them") is right — but it only forces you to defer the **Verified Address** column. **Location** and **global** are cheap and don't touch the US-only address machinery. Keeping these separate is what lets non-US users have a real experience without you building international address verification.

Your codebase already encodes the bottom row: personas carry `verified_local`, so a follower can be a fan *without* being a verified-local neighbor. The ladder below just makes that distinction first-class across the app.

---

## 3. The Trust Ladder (the user model)

One model, five tiers. Each tier **unlocks more** — you never block the first taste, and verification is always an *unlock*, never a wall. This maps directly onto the per-section visibility tiers already in the `PlaceIntelligence` contract, so "preview" is a visibility level, not a second codebase.

| Tier | Name | What it requires | Region | What the user gets |
|---|---|---|---|---|
| **T0** | **Preview** | nothing (no account) | US | Type an address → instant dashboard **preview** on free layers (flood, AQI, density count, walk score, basic facts). The hook. |
| **T1** | **Account** | email / auth | **global** | Saved state, profile, **full Beacon** (follow / fan / broadcasts / DMs / tiers). *This is the non-US ceiling under the recommended option.* |
| **T2** | **Located** | approximate location set | US now (global = ⟡ future) | + neighborhood **discovery**: browse Feed, Marketplace, Gigs near you |
| **T3** | **Claimed (unverified)** | claim a home, US | US | + **full home dashboard** (all sections, per data availability) + home management (bills, maintenance, docs, emergency) + post/transact in the neighborhood |
| **T4** | **Verified** | verified address | US | + **neighbor messaging**, **mailbox**, "verified neighbor" badge, owner-only fields, residency letter; full trust in marketplace/gigs |

Notes:
- T0 and T3/T4 are inherently **US-only** (they require a US address). Non-US users live at **T1**, and at **T2** only if we enable global approximate-location discovery (the ⟡ decision in §5/§9).
- ⟡ **Decision — transact threshold:** do users *post/transact* in the neighborhood at T2 (located), T3 (claimed), or only T4 (verified)? Recommendation: **browse at T2, post/transact at T3**, with a "verify for the verified-neighbor badge" nudge — keeps the funnel moving while reserving the trust badge for verification.

---

## 4. Onboarding: one funnel, address-first hero, quiet skip

No two doors. One funnel that **leads with value, defers the wall, and biases toward address** — with region handled by *detection, not by asking the user*.

**Region detected = US:**
1. Hero leads with the payoff, not the ask: *"See your home's flood risk, air quality, and verified neighbors — free, no account."*
2. User types an address → **instant T0 preview** of the dashboard on the free layers (you only need the lat/lng — no verification, no cost).
3. The soft wall comes *after* the taste: *"Create an account to save this home and unlock the full dashboard"* → T1, then claim → T3.
4. Verification is the next unlock, not a gate: a *"verify to unlock neighbor messaging + mailbox + your verified badge"* nudge → T4. Verification can pend (postcard/manual review) **without blocking** anything they already have.
5. A low-key secondary line — *"Just here to follow someone or browse? →"* — routes the social-intent user straight to T1 signup. **Present, not co-equal.**

**Region detected = non-US:** the address hero is **not shown** (see §5). Lead with the global value (the creators/communities on Beacon), go to T1. Home/address surfaces appear as a graceful *"coming to your region"* state, never a dead end.

**Deep-link arrivals (creator/persona/gig/listing share):** land on the contextual page with an in-context CTA (*"sign up to follow"*), bypassing the generic launch screen entirely. A large share of non-US traffic arrives this way — it's handled contextually, which is another reason a launch-screen fork is unnecessary.

---

## 5. The non-US experience (your question, answered)

**The honest reality first:** most of the *existing* app is already neighborhood-scoped, not just the new stuff. Feed posts are `neighborhood`-visibility and home-anchored; Gigs anchor to `origin_home_id`; Listings are radius-based. So a non-US user with **no location and no address** can't meaningfully use Feed / Marketplace / Gigs — those are hollow without a place. The one pillar that is genuinely global is **Beacon/personas** (the `verified_local` flag proves the system already supports remote fans).

So "can non-US users use other features?" resolves to a real decision about the **non-US floor**:

| Option | Non-US user gets | Cost to us | Verdict |
|---|---|---|---|
| **A — Beacon-only (global)** | Full creator/fan layer (follow, fan, broadcasts, DMs, tiers). Home + neighborhood show *"US-only for now."* | ~none (already supported) | ⟡ **Recommended now** |
| **B — Beacon + global neighborhood** | Above **+** neighborhood Feed/Marketplace/Gigs scoped by *approximate location* (no verified address) | Decouple "neighborhood scoping" from "verified address"; dilutes the "verified neighbor" premise globally | **Future**, deliberate investment |
| **C — Waitlist / dead-end** | "Not in your country yet" | none | **Avoid** — wastes installs and deep-link virality |

**Recommendation: A now, with the door open to B.** Non-US users are *not* dead-ended — they get the full creator/Beacon experience (often the exact reason they arrived, via a shared creator link), and everything home/neighborhood/verified shows a clean *"coming to your region"* state. You touch **zero** international-address complexity. When the company is big enough, B is a contained, deliberate step (make `Location` global so coarse location powers neighborhood discovery worldwide) — not a rewrite.

The principle to hold: **non-US = capped at T1 (and later T2), never blocked.** The cap is invisible-by-detection, graceful, and reversible.

---

## 6. How the 13 blend into the current app

The organizing rule: **every one of the 13 attaches either to the new "Your Place" dashboard or to an existing pillar, reusing existing primitives — none of them is a standalone menu item.** That is the seamless blend, concretely:

| # | Item | Where it lives | Reuses |
|---|---|---|---|
| 1 | Home dashboard | **"Your Place"** = the dashboard itself (`PlaceIntelligence` sections) | propertyIntelligenceService, neighborhoodProfile, context/briefing |
| 4 | Daily intelligence | Dashboard **"Today / Environment"** section — the daily reason to open | NOAA / AirNow / Open-Meteo / briefingComposer |
| 3 | Risk + emergency | Dashboard **"Risk"** section **+ upgrades the existing `Homes/Emergency`** form toward calibrated info | FEMA (live) + Emergency feature |
| 7 | Home value / equity | Dashboard **"Valuation"** section; equity ties to **Home → Bills** (add mortgage) | ATTOM AVM + Home>Bills |
| 2 | Tax appeal | Dashboard **"Valuation / Taxes"** subsection, **informational only** (legal-gated) | ATTOM assessment |
| 5 | Civic | Dashboard **"Civic"** section (placeholder until integrated) | — (build) |
| 6 | Permits | Dashboard **"Development"** section (coverage-gated placeholder) | — (build) |
| 12 | Block density | **Onboarding hook (T0) + dashboard "Neighborhood" section + "unlock your block" conversion mechanic** | NeighborhoodPreview (live) |
| 8 | Insurance scan | Extends **Home → Bills** + BillBenchmark "savings" angle (partner/compliance-gated) | BillBenchmark |
| 9 | Energy / utility | Extends **Home → Bills** + BillBenchmark (build-pending) | BillBenchmark |
| 11 | Residency letter | **Identity / Documents** capability off the verified address; extends **IdentityCenter / Home → Documents** | Lob (live) |
| 13 | Neighbor messaging | Extends existing **Chat + Mailbox**, T4 + T&S gate | Chat, Mailbox |
| 10 | Portable verified-ID | Extends **IdentityCenter**, T4+, partner-gated (future) | IdentityCenter |

Read top to bottom, this is the blend: the dashboard is the new home base; the financial items fold into the Bills pillar you already have; identity/letters fold into IdentityCenter; messaging folds into Chat/Mailbox. Nothing arrives as an orphan.

⟡ **Naming decisions:** the dashboard's user-facing name ("Your Place" vs "Home" vs "Pulse, evolved"), and whether the daily layer keeps the **Pulse** brand. (Pulse stays the right name for the *priority-ranked daily feed*; the structured dashboard wants its own name.)

---

## 7. Feature-gating matrix

The concrete artifact that makes the whole model buildable. Rows = capability; columns = trust tier. ✅ available · 👁 preview/read-only · 🔒 locked (with the unlock) · — n/a. Region collapses into the tier ceiling: **non-US users see only the T1 (and ⟡ T2) columns**; T0/T3/T4 require a US address.

| Capability | T0 Preview | T1 Account | T2 Located | T3 Claimed | T4 Verified |
|---|---|---|---|---|---|
| Dashboard — free layers (flood, AQI, density, walk, basic facts) | 👁 | 👁 | 👁 | ✅ | ✅ |
| Dashboard — property facts + valuation (ATTOM) | — | — | — | ✅ | ✅ |
| Dashboard — risk / civic / development | — | — | — | ✅ | ✅ |
| Daily briefing / environment | — | — | 👁 | ✅ | ✅ |
| Home management (bills, maintenance, docs, emergency) | — | — | — | ✅ | ✅ |
| Beacon (follow / fan / broadcasts / DMs / tiers) | — | ✅ | ✅ | ✅ | ✅ |
| Neighborhood Feed | — | — | 👁 | ✅ post | ✅ |
| Marketplace / Listings | — | — | 👁 | ✅ | ✅ |
| Gigs | — | — | 👁 | ✅ | ✅ |
| "Verified neighbor" badge | — | — | — | 🔒 verify | ✅ |
| Neighbor messaging (#13) | — | — | — | 🔒 verify+T&S | ✅ |
| Mailbox | — | — | — | 🔒 verify | ✅ |
| Residency letter (#11) | — | — | — | 🔒 verify | ✅ |
| Insurance / energy savings (#8/#9) | — | — | — | 👁 benchmark | ✅ (partner-gated) |
| Portable verified-ID (#10) | — | — | — | — | 🔒 future |

(⟡ confirm the T2 "browse vs post" line and whether T2 is US-only or global per §5.)

---

## 8. Conversion mechanics (moving users up the ladder)

Each nudge is tied to a **concrete unlock**, never a dark pattern:

- **T0 → T1:** the soft wall *after* the preview taste — *"save this home + unlock the full dashboard."* The taste is the leverage.
- **T1 → T3:** *"claim your home to unlock your dashboard, bills, and home tools."*
- **T3 → T4:** two reinforcing pulls — (1) the unlock framing (*"verify to unlock neighbor messaging, mailbox, and your verified badge"*), and (2) the **density mechanic (#12)** as social pressure (*"be one of the first 5 verified on your block"*) — sparsity becomes urgency instead of a value-killer.
- **Non-US → engaged:** the creators they follow are the retention hook; the *"coming to your region"* states quietly build demand for expansion.

The whole funnel is designed so the **strongest, free, instant hook (address preview) sits first**, and every subsequent ask is justified by something the user already saw was valuable.

---

## 9. Open product decisions (need your call)

1. ⟡ **Non-US floor:** Option **A** (Beacon-only global) now? — recommended.
2. ⟡ **Neighborhood scope:** US-only-for-now, or global via approximate location (Option B)? Drives whether T2 is global.
3. ⟡ **Transact threshold:** browse at T2, post/transact at T3? — recommended.
4. ⟡ **Naming:** dashboard name + Pulse relationship + keep "Beacon."
5. ⟡ **IA / navigation:** where the dashboard lives in the tab bar (forces the open 4-tab decision); does it absorb the current DiscoverHub surface (today on sample data) or sit beside it?
6. ⟡ **T0 friction:** is the anonymous preview truly no-account, or a lightweight email capture? (Recommendation: truly no-account — the low commitment is what lowers the "why does it want my address" friction.)

---

## 10. What this sets up

The next step — the **screen + shared-archetype spec** — reads directly off this: the dashboard archetype renders the **trust tiers** (preview / claimed / verified) and the **gating matrix** as states; the onboarding screens implement the **single funnel** with the US / non-US detection branch; the financial/identity/messaging surfaces extend their existing pillars per §6. Resolve the §9 decisions (especially non-US floor + naming + IA) and the screen layer has everything it needs.
