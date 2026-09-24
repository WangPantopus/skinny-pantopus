# Pantopus UX research brief (v2, 16 Sep 2026)

Inputs: 12 research topics (onboarding, notifications, widgets, dates, risk data display, trust and provenance, household, capture, companion ethics, accessibility, share/compare/civic, competitive teardown), plus Claude Design prompting guidance. These were checked against house-style-v1, the surface index (59 surfaces), design doc §1, §2 and §5, and the critique findings.

**How evidence is weighted.** Four kinds of source count as strong: platform rules (Apple HIG, App Review, Android quality tiers), standards (WCAG 2.2, EPA's AQI technical document, RCW statutes, FEMA and USGS terminology), peer-reviewed field or lab studies (Nickerson & Rogers, Fishbane et al., Consolvo et al., Kelley et al., Bias in the Loop, Wintle et al., Silverman & Barasch, Fitz et al.), and contrast ratios computed from our own tokens. Vendor data (Chameleon, Airship, LandingAI, Duolingo's blog) only sets direction, and no number from it appears in a prompt. App Store review samples (50 per app) show which themes recur; they are not measurements. Unverified figures are left out on purpose, including X/WhatsApp OG specs, the "63% abandon after one missed day" claim, and the Airship opt-in medians.

**Governing idea.** The founder wants "easiest to understand without losing substance". The research reaches that goal in one way throughout: **say the fact on the surface in plain words, give its source and scope, then put the detail one tap away**. Progressive disclosure is how complexity gets reduced; information is not removed.

---

## 1. The 22 principles

| # | Principle | Evidence (strength) | Governs |
|---|---|---|---|
| P1 | **Show the fact before asking for an account.** The account wall goes where the person wants to keep something, and it says what they get in one line. | Apple HIG Managing accounts; App Review 5.1.1(v); Baymard 18% abandon on forced account; Duolingo about +20% DAU from moving sign-up later (self-reported) — strong | f8-seasonal-aha, f8-compare-reveal, f8-compare-arrival-header, f1-save-confirmation, f1-email-verify-handoff |
| P2 | **Never make someone retype a value we still hold.** Offer it as a one-tap choice. Holds last at least 20 h, and the screen states how long. | WCAG 3.3.7 (A), 2.2.6; Firebase anonymous account linking — strong | f1-email-verify-handoff, f1-save-confirmation, f1-add-place-sheet, x-date-sheet, f10-extraction-confirm |
| P3 | **Verification never blocks the save.** Offer a pasteable 6-digit code next to the email link. | NN/g registration and passwordless guidance; WCAG 3.3.8 / G218 — moderate | f1-email-verify-handoff |
| P4 | **No tours, carousels or auto-opened asks.** Each ask sits inline in the section it completes. There are at most 3–4 first-week asks, and only asks the person can complete at their tier count. | NN/g onboarding (tutorials did not help); Apple HIG onboarding; Chameleon (vendor, direction only); GOV.UK "Cannot start yet" — strong | f1-today-tab, x-place-file, f3-household-block, f4-today-pickup-card, f5-today-calendar-strip, f11-keeper-naming |
| P5 | **No completion fractions or closed rings with empty slots.** Name the next step instead. Absence is a neutral list, not a gap in a shape. | Nunes & Drèze 2006; Kivetz et al. 2006; Villar et al. 2013 (stalled indicators increased drop-off); Consolvo UbiFit — strong | f1-today-tab, x-place-file, f11-keeper-strip, f9-invite-rewards-card |
| P6 | **Ask for push permission only right after an action that makes the purpose obvious**, and show the exact notification. The in-context card is the decision. There is never a second "Yes". | Apple UserNotifications; Android POST_NOTIFICATIONS; NN/g permission requests (+12%); Apple HIG Privacy pre-alert rules — strong | f4-notification-primer, f4-briefing-optin-card, f4-today-pickup-card, f3-household-notifications |
| P7 | **Handle denial per platform and never nag.** iOS denied → Open Settings at the notification page. Android denied once → ask again once. Android blocked → Settings. Amber appears only when a switch the person turned on cannot be delivered. | Android permission docs ("don't link to settings to convince"); App Review 4.5.4 — strong | f4-notification-primer, f4-briefing-optin-card, f4-notification-settings |
| P8 | **Push copy is a canonical string.** Title ≤30 characters with the caveat first. Body ≤40 characters, street label only, no amounts. There is a hidden-preview placeholder. Interruption level matches real urgency. | Android notification design (30/40); Apple HIG Notifications and Managing Notifications; App Review 4.5.4 — strong | f4-*, f1-today-air-band, f3-household-notifications |
| P9 | **One notification per real-world thing.** Batch low-urgency items, stop reminders once the item is resolved, update in place, and never send marketing, keeper or re-engagement pushes. | Apple HIG; NN/g; Android grouping; Fitz et al. 2019 (3×/day batching helped; none at all raised FoMO) — strong | f3-household-notifications, f4-notification-settings, x-date-sheet, f11-keeper-strip |
| P10 | **Silence must be readable.** Show a receipt of what was checked, per provider. The all-clear appears only when every check has returned OK. | Buell & Norton 2011; NN/g empty states; Statuspage component model; Pielot & Rello — strong | f1-today-tab, f5-today-calendar-strip, f7-today-widget, f4-briefing-optin-card, x-place-file |
| P11 | **Loading: refresh in place.** Skeletons only for cold full-page loads of about 2–10 s. No indicator under 1 s. Stale data keeps its values plus its age, judged per fact. | NN/g skeletons and response times; HIG Widgets/Loading; Android WT-3 — strong | f1-today-tab, f7-widget-tap-landing, f7-today-widget, f1-today-air-band |
| P12 | **Each hazard sits on its own authority's scale, in the authority's words, as word + number inline.** Never combine layers into a grade. Say "hazard" or "potential", never "100-year". | Zillow score removal (2025); USGS; FEMA; USFS WHP; Wintle 2019 (66% vs 32%); Budescu 2009; Schneider 2023 — strong | f8-scale-strips, f6-place-section-details, f8-og-compare-card, f8-compare-*, f8-seasonal-aha |
| P13 | **AQI is the only coloured scale.** It uses EPA ColorVision Assist hues everywhere, with separators, a two-tone marker, the category name off the fill, EPA's own health text, and "301+". | EPA TAD May 2026; WCAG 1.4.1/1.4.11; computed contrast 1.07–2.37:1 between neighbouring hues — strong | f1-today-air-band, f8-scale-strips, f7-today-widget, x-provenance-sheet |
| P14 | **Provenance is shape plus a word, and scope is separate from confidence.** Official datasets are FILLED with a scope word ("county-wide"). HOLLOW is only for facts a household can confirm. At least 12 pt, 3:1 contrast, a spoken name. | Piccardi 2020 (0.13% mobile citation clicks); Kelley 2009 (blanks misread); NN/g icon labels; EPA/WRC scope statements; van der Bles 2019/2020 — strong | x-provenance-sheet, every data surface |
| P15 | **Comparisons overlay two marks on one shared track, in a fixed row order,** with a neutral "Different band" tag and no winners. Frozen readings carry their date. | Ondov 2018; Gleicher 2011; Kelley 2010 ("same place every time"); Schultz 2007 — moderate | f8-compare-reveal, f8-compare-arrival-header, f8-og-compare-card |
| P16 | **Report flows close the loop.** Confirm receipt, give a check-by date, keep a persistent "checking" state, and show the outcome in place. Offer a self-fix first. Authority-owned facts link out to the authority (FEMA LOMA, radon test kit). | DSA Art. 16; Google Maps contributions; Zillow Edit Facts; FEMA LOMC; Recycle Coach reviews — strong | x-provenance-sheet, f4-today-pickup-card, x-place-file |
| P17 | **Holiday moves and per-household frequency are the core pickup job.** Seed only the weekday. Frequency is Not set until confirmed. Draw one "moved for a holiday" state everywhere, and the push follows the moved day. | Camas 2026 brochure (10 holiday moves); Camas vs Clark County recycling rules; ReCollect guidance; Recycle Coach 1-star reviews — strong | f4-today-pickup-card, f5-today-calendar-strip, x-place-file, f3-household-calendar, f7-today-widget, x-date-sheet |
| P18 | **Dates: type document dates, anchor recurrence explicitly, remind against the action date, show the whole reminder series, and word statutes exactly** ("must arrive by"; per-method voter deadlines). | NN/g date input; GOV.UK approximate dates; RFC 5545; RCW 59.18.200, 29A.08.140, 84.56.020; Clark BOE; Fishbane 2020; Nickerson & Rogers 2010 — strong | x-date-sheet, x-place-file, f5-today-calendar-strip, f6-place-section-details, f8-seasonal-aha |
| P19 | **Undo instead of confirm for routine actions, and undo does not expire on a timer.** Anything that notifies the household waits until the undo window closes. Destructive confirms name what survives. | NN/g confirmation dialogs; WCAG 2.2.1, 3.3.4; Flutter/Material snackbar behaviour — strong | f3-bills-list, f3-bill-detail-web, x-date-sheet, f10-mail-day-triage, f10-*, f1-your-places |
| P20 | **Machine reads are unconfirmed until a person commits them.** Ground each value to the label it was printed beside. Correction is the path with the least effort. A failed read shows blanks, not $0.00. | Bias in the Loop (N=2,784); Nutrient; Microsoft Content Understanding; Box HITL; Expensify PR; Vasconcelos 2023 — strong | f10-extraction-confirm, f10-bill-provenance, f10-mail-day-triage |
| P21 | **The companion reflects obligations and never guilt.** No distress poses, no decay while the person is away, no pushes, no streaks. Skip closes the slot, and it can be reopened from the place file. | Consolvo 2008 / Fish'n'Steps; Silverman & Barasch; PLOS One run streaks; NN/g confirmshaming; Apple HIG onboarding — strong | f11-keeper-strip, f11-keeper-naming, f10-mail-day-triage |
| P22 | **Accessibility is a gate on every frame.** 4.5:1 text and 3:1 graphics, computed from our tokens (text.muted fails at 2.54; primary.DEFAULT with white fails at 4.10; primary.700 passes at 5.93). 44pt/48dp targets. AX5/200% and greyscale frames. No gesture-only actions. | WCAG 2.2; Apple Larger Text and Differentiate Without Color criteria; Android 14 font scaling; NN/g seniors research — strong | all 59 |

Supporting rules also written into the prompts: scarcity and deadlines are shown as dates and fail closed (FTC 2022, Mathur 2019). Referrals state the real formula, the cap and each invitee's stage (Dropbox; FTC endorsement guidance). Household roles are coarse, and their permissions are written as verbs identically on both sides of an invite (Google Home, Apple Home, Ring; Zeng & Roesner). "Just me" is a complete answer (Census: 29% of households are one person). Every entry takes a typed address; no location permission is ever requested (App Review 5.1.1(iv); Citizen and Life360 reviews and incidents). Stored document photos carry the minimum and name their audience per permission (FTC; GDPR Art. 25).

---

## 2. Onboarding model

1. **/start (anonymous).** Show the full preview: the four-row instrument, the seasonal aha, and sources. No account, location or push ask comes before this.
2. **First ask = keep it.** The WallBar/save CTA reads "Keep this address handy — Today and a night-before pickup reminder run on it." The typed address is held on the server for at least 7 days, and the interstitial says so.
3. **Register → place saved at once** (where the auth provider allows it). The interstitial reads "Saved privately. Confirm your email to keep your account." It offers a 6-digit pasteable code, "Resend the link", and a spam-folder hint. The link works on any device and opens the same saved state.
4. **Save confirmation** is one sentence and hands off to Today. It has no permission ask. The recovery frame shows the held address as a selectable row, "1107 NE Birchfield Ct, Camas — Save it". A blank field appears only when nothing was held.
5. **Today is the first screen.** No slides or coach marks. The first-week set follows the activation definition: **Save ✓ · Set your pickup day · Turn on a reminder or add the widget · Add one date or one person**. Each ask lives inline in its own section: the pickup card's "That's my day", the strip's "+ Add a date", the briefing card, and the household block. Today shows only one "Next: set your pickup day →" row, with **no fraction**, for **7 days** (matching the activation window). It disappears when the set is done or dismissed.
6. **Tier-locked steps.** At T1, the household step is grey with the reason "Claim this address first". It has no CTA and is not counted. Verify, profile and photo are never first-week asks.
7. **Declines.** Every ask pairs "Not now" (never shown again automatically) with a lasting decline ("Just me", "Skip", "No thanks"). The decline is stored on the server, can be undone, and has a way back through a place-file row or settings. Checklist state syncs across devices.
8. **Push ask.** It follows the first "That's my day" (inline: "Remind you the night before? 6:00 PM") or Yes on the briefing card, and goes straight to the OS dialog. The widget hint is offered once after a confirm or a denial, and at most once every 24 h.
9. **T1→T3 claim receipt.** It lists each item that moved. Dates stay "Only you" until "Share with the household" is tapped; leaving the screen keeps them private. The receipt is available later in the place file under "What moved when you claimed".
10. **Keeper naming (phase 2).** It opens only from a tap, after a value moment. It is one sheet and never auto-presented; this corrects design doc §F11's "second Today open".

## 3. Notification model

**Five groups**, fixed before the first Android build. Each maps 1:1 to an Android channel and an iOS category/thread, and each name is permanent.

| Group | Contents | iOS level | Android importance | Default after grant |
|---|---|---|---|---|
| Briefings | Evening (6:00 PM) pickup and next-day items; morning (7:00 AM) date items | Active | DEFAULT | Evening on; morning on only if chosen on the card |
| Air & weather alerts | AQI ≥ the person's threshold; NOAA warnings | Time Sensitive at AQI ≥151 or a NOAA warning; otherwise Active | HIGH / DEFAULT | On, threshold 101 (matches the server) |
| Dates & bills | Reminder series for dates and bills | Active | DEFAULT | On only for rows where the person set a reminder |
| Household activity | Joins, leaves, bill_paid, calendar edits | Passive (bill_paid Active only for members who still see the bill as unpaid and due within 3 days) | LOW | Off until switched on from the household block or settings |
| Account & security | Sign-in, invitations to you | Time Sensitive | HIGH | On |

Rules:
- One push per trigger per day. Items due within the same hour merge into the briefing.
- Household events for one home within a window collapse into one notification that updates in place ("Sam paid 3 bills").
- Resolving an item cancels its scheduled reminders and replaces any reminder already delivered.
- A worsening AQI updates the existing alert rather than stacking a new one.
- A threshold alert fires once per crossing episode.
- Canonical strings:
  - Unconfirmed pickup: "Unconfirmed: pickup tomorrow" / "Recycling + garbage · city schedule".
  - Confirmed pickup: "Recycling + garbage tomorrow" / "Bins out tonight · Larkspur Loop".
  - Air alert: "Unhealthy air: AQI 176" / "AirNow, 4:00 PM · Larkspur Loop".
  - Household: "Sam marked Clark PUD paid" / "Due Fri 23 Oct · Larkspur Loop".
  - Lease: "Lease notice due in 14 days" / "Tell your landlord by Mon 1 Mar".
- Hidden-preview placeholders: "Pickup reminder", "Air quality alert", "Household update". The Android public version reads "Pantopus · Pickup reminder".
- Actions: unconfirmed pickup → "That's my day" (background confirm, rewrites the widget snapshot). Date reminder → "Done". No tray "Mark paid", because it fans out to the household and cannot show an undo. No action that only opens the app.
- Foreground: no banner. Highlight the matching card; the bell badge counts unread notifications only.
- Settings mirrors the OS state per group ("Off in Android settings · Open"), including Scheduled Summary ("Your iPhone may hold pickup reminders for your summary"). It shows "Last sent Mon 6:00 PM" or "Skipped tonight — nothing needed you". The iOS "Pantopus Notification Settings" link opens this page. A one-time migration line reads "Nothing you turned off was turned on."
- Never: marketing, Founding or referral pushes, keeper voice or avatar, streaks, "you haven't checked in", Critical level, Time Sensitive for pickup.
- iOS provisional authorization is **not** used for pickup, because it never reaches the lock screen. It may be tested for Household activity only, and it never counts toward activation.

## 4. Visualization grammar

- **Provenance marks.** FILLED means official or confirmed. HOLLOW means on record, not confirmed. FILLED with a knocked-out TICK means you added it. Minimum size 12 pt, stroke ≥1.5 px, ink contrast ≥3:1. Spoken names: "official", "on record, not confirmed", "you added this". A legend or first-use label appears on every surface; standalone surfaces print the word. Filled vs hollow means nothing else anywhere. Founding slots use solid vs hatched plus a numeral; compare sender vs you use labelled pointers.
- **Scope word** in every caption: authority · scope · as-of ("EPA · county-wide", "FEMA · area zone · effective Sep 2021", "AirNow · observed 7:00 AM").
- **Scale strip** (one per authority). Horizontal track, least to most hazard, left to right. Discrete classes, dividers ≥3:1, keyline. Marker plus band name plus number beside the track. Row height 48 pt at detail size. States: "Not on record", "FEMA hasn't mapped flood hazard here", and "Non-burnable land cover". Each state is distinct from "very low".
  - Flood: 3 bands, Minimal (X) · 0.2% a year (shaded X) · 1% a year or more (A/V zones). The real zone code goes in the label.
  - Wildfire: USFS 5 classes, "Moderate · 3 of 5".
  - Radon: Zone 3 → 2 → 1, in words only ("Zone 1 — highest potential of EPA's 3 zones"), never "N of M".
  - Air: 6 equal-width EPA segments with the marker placed inside its segment, top segment "301+", ColorVision Assist hues. It is the only coloured track.
- **Compare.** One track per layer with two marks (the sender's labelled with their first name, and "You"). Same band → merged mark, "Same band". Different → neutral "Different band" tag. Fixed order Flood · Wildfire · Air · Radon. Frozen rows read "Air on Sat 12 Sep".
- **14-day strip.** 14 equal cells, one ink colour, provenance by shape. Class is carried by the list-row glyphs, not by hue. At most 3 marks then "+N". A holiday move shows the mark on the new day and a struck ghost on the usual day. Cells are not tap targets on native; the whole strip is one adjustable element that scrolls to the rows. Empty after a successful check → drawn cells plus "Checked — nothing in the next 14 days". Failure → no strip.
- **Year band.** 12 months with lanes You / City / County / State. On phones, marks are grouped per month with counts, and exact-day placement is only on desktop. Dates after the last published city calendar are drawn as projected.
- **Count of facts.** An integer ("11 on file") plus chips for the categories that are known. Unknown categories go in a "You can also add" list. There is no closed ring with outlined empties. At T1, only reachable categories exist.
- **Bill trend.** 12 columns filled primary.600 (or light fills with a primary.800 outline). The current month is labelled. The peer average is a single reference line with its k ("average of 14 homes nearby"). If there is too little data, the line is omitted. There is always a summary sentence and a "Show amounts" list.
- **Founding meter.** 5 segments, solid = taken and hatched = open, "3 of 5 open", a closing date in neutral tokens. Nothing is rendered on lookup failure or once closed.
- **Every chart** has a one-sentence takeaway, a spoken label and a list of the same facts. Swift Charts on iOS.

## 5. Accessibility rules (written into house style v2)

- **Contrast.** 4.5:1 for text and 3:1 for graphics, checked in light, dark and Increase Contrast.
  - text.muted is for placeholders and disabled text only.
  - On sunken surfaces, text is text.strong.
  - Buttons and links use primary.700 (5.93:1). Dark-mode links use #38BDF8.
  - Semantic hue goes on glyphs and borders; text on a tint is text.primary.
  - Dark mode needs its own card-edge token, because border.default on raised is 1.00:1.
- **Targets.** 44 pt / 48 dp with 8 dp spacing / 44 px web. A mark is never a target on its own.
- **Large text.** Every prompt adds AX5/200% and greyscale frames. At large sizes: pairs stack, segmented controls with long labels become radio rows, tiles drop to one column, sheets may scroll, and labels wrap instead of ellipsising. The tab bar uses Large Content Viewer.
- **Widgets.** Text ≥11 pt and never rasterised. At AX sizes, widgets fall back to text only.
- **Screen readers.** One element per row with custom actions. Sheets trap focus and each has a unique title. Status messages (Saved, Link copied, Marked paid · Undo, Uploading 2 of 3) are live regions. Deep-link highlights also move accessibility focus.
- **Gestures.** No pinch-, drag-, long-press- or hover-only actions. Viewers have zoom buttons, and their controls do not auto-hide while assistive tech is on. Every sheet has a visible Close/Done and responds to Back/Escape. No stacked sheets.
- **Timing and motion.** Undo does not expire on a timer and there are no seconds countdowns. Reduce Motion gives fades and static poses.
- **Focus and layout.** Focus is not obscured by sticky bars (scroll padding). Selection looks different from focus. Orientation is not locked. The extraction photo pane shrinks when the keyboard is up, at AX sizes, or in landscape.
- **Share card.** og:image:alt describes the readings, with no address.

## 6. Microcopy rules

- **Reading level and case.** Grade 6–8, sentence case. Buttons start with a verb ("Add a date", "Change pickup day", "Check or update at VoteWA").
- **Declines.** Equal weight and neutral. No creature emotion and no loss framing.
- **Hazards.** Plain meaning first, then the code: "Zone X — minimal flood hazard · FEMA". Use "hazard/potential" as the authority does. Write "1% chance each year (about 1 in 4 over 30 years)", never "100-year". Pair a word with a number.
- **Dates and deadlines.** Always show the weekday. Beyond tomorrow, add the relative count: "in 7 days · Mon 26 Oct". Tonight, Today and Tomorrow stand alone. Use "must arrive by". No invented clock times. No "midnight". Add a timezone only when the device is outside Pacific time.
- **Voter registration.** Wording is method-specific: "Online or mail voter registration for Nov 3 must arrive by Oct 26 in Washington." (80 characters). "In person: until 8 PM Tue 3 Nov." Never state or imply registration status. "I did this" reads "You marked this done" and stays Only you.
- **Scope strings.** Exactly two: "Saved place · Only you" and "Your household".
- **Attribution.** "Paid by Sam · 15 Oct". The wording is "marked paid", not "paid". Someone who has left reads "Sam (no longer here)".
- **Monitoring language.** No "still hasn't paid", no activity-watching copy.
- **Verification.** State the method and date: "Address confirmed by postcard · Sep 8". Never a bare "Verified".
- **Pantopus-authored posts.** Chip text "From Pantopus", not "curator".
- **Data ownership.** "On file for this address" and "See your place file", never "what we know" or "Ollie knows".
- **Errors.** Say what to do next. No "Oops", no "Are you sure?", no "Congratulations", no confetti.
- **Positioning.** Lead with public-record layers. Drop "your home's value" (it's modelled) and "verified neighbors" from the first clause. Name Nextdoor in plain text only.

---

## 7. Research-driven changes by surface

| Surface | Top changes (full list in perSurfaceChanges) |
|---|---|
| x-provenance-sheet | Generate first as the Foundations specimen. Marks ≥12 pt with spoken names. Add a Covers/scope line. Report reasons fit the fact type, with a self-fix first. Receipt, check-by date and checking/resolved states. FEMA/EPA link-outs. Row is the target. |
| x-date-sheet | Typed entry for document dates. "Not sure of the day". Lease asks notice length and creates a notice-deadline row. The full reminder series is drawn with real dates. Per-kind validity with suggested fixes. Tax appeal as a rule plus input. Voter registration is per-method and person-scoped. Undo does not expire. AX layout. |
| x-place-file | No fraction or ring; integer plus known chips. Asks capped at 3. Year band grouped by month on phones. Holiday moves. Lease reminder on the notice row. "What moved when you claimed" and "Your reports" rows. Keeper re-entry row. |
| f1-today-tab | "Next: …" row with no fraction, for 7 days. Per-provider receipt. All-clear only when everything is OK. Threshold crossings pinned for every arrival. "Add a place" label. `section=` landing. |
| f1-your-places | "+ Add a place" empty state. Inline undo that does not expire. Scope chip opens its control. |
| f1-add-place-sheet | Manual line-by-line fallback. Outside the pilot area, save anyway. Typo tolerance and proximity ranking. Duplicate → select. "No location needed" line. |
| f1-save-confirmation | Two recovery frames (held row vs blank). No permission ask. role=status. |
| f1-email-verify-handoff | Code field plus link. Saved at registration. Hold length stated. Spam hint. |
| f1-today-air-band | ColorVision Assist hues, separators, halo marker, "301+". EPA health text verbatim. Person's own threshold. Canonical push. |
| f1-claim-receipt | Conditional consent copy, private by default. Persistent receipt. Split the keeper row from the count. |
| f4-notification-primer | Only for indirect entries. "Continue" and "Your phone will ask next". Three denial frames. Canonical tray. Copy lists the real defaults. |
| f4-briefing-optin-card | Yes goes straight to the OS. Amber only on mismatch. List rows with 44 pt chips. Readable silence. |
| f4-today-pickup-card | Holiday-move state. Set-out time from the source. Canonical push. "That's my day" push action. Inline reminder ask. Verb a11y labels. |
| f4-notification-settings | Five groups with levels. OS-state mirror per group. Scheduled Summary frame. Threshold as radio rows. Migration line. Last-sent line. |
| f5-today-calendar-strip | One ink colour, shapes, not tappable per cell. Holiday ghost. Absolute plus relative dates. Correct civic rows. |
| f7-today-widget | Correct pt sizes. Full-width strip. Per-fact staleness. Region links. StandBy/tinted frames. Android dynamic colour. Smart Stack relevance. |
| f7-widget-howto-sheet | Android "Add to home screen" pin API. iOS "Edit → Add Widget". Illustration caption. AX scroll. |
| f7-widget-gallery | Verb-led description. Real snapshot preview when one exists. Dynamic colour. Correct sizes. |
| f7-widget-tap-landing | `section=` scroll and highlight. No hairline under 1 s. Android launch transition. |
| f8-scale-strips | Air row coloured. FEMA wording and 3 flood bands. Official datasets filled. Ink dividers. Radon in words. |
| f8-compare-reveal | Fixed order plus "Different band". Probability wording. Frozen dates. Authority next step. |
| f8-og-compare-card | Text moves to og:title, og:description and og:image:alt. ≥40 px type. Dated air. Radon "highest potential (county)". |
| f8-compare-sheet | Pre-mint so share is synchronous. AbortError is neutral. Expiry in the privacy line. |
| f8-seasonal-aha | Per-method voter copy plus an in-person phase. No "Quiet on every layer". Readable chip. |
| f3-household-notifications | Canonical ≤30-character titles. Passive and grouped. No amounts. Reminders cancelled when resolved. Join/leave rows. |
| f3-bills-list / f3-bill-detail-web | Undo before fan-out. "Next due". Name who can mark paid. Visibility line. |
| f3-invite-composer / f3b-invitation-decision | Capability captions from one string. Link limits or approval. Verb rows. Count-only preview. Open Home is primary. |
| f9-privacy-mirror | Draw the real public pin. "Same spot every time, about 0.3 mi". Hidden row. Server-rendered. |
| f10-extraction-confirm | Hollow until commit. Label-grounded crops. Blanks on failure. Values in the commit button. Shrinking pane. |
| f10-snap-capture-tray | System scanner plus an app-owned queue. Visible Retake/Delete. Page grouping. Named audience. |
| f11-keeper-strip / f11-keeper-naming | No distress. Obligations only. No push. Skip closes the slot. Tap-only entry. Reduce Motion. |

Build order for Claude Design:
1. Publish the Pantopus design system: tokens, the two projects' HTML, and core screenshots.
2. Prompt 00: Foundations board (x-provenance-sheet specimen, scope chips, silence receipt, stale row, locked row, one scale track, AQI track). Remix it into the system.
3. Hosts: Today and the place file.
4. Cards, then sheets, then widgets and OG.

Each prompt ends with an ARTBOARDS manifest and a BATCH PLAN of about 6 artboards per batch. Export HTML/PDF to `docs/design/exports/<surface-id>/` after every batch that is accepted, because Claude Design has no version history.

---

## Research deliberately not adopted

- A '1 of 4 done' fraction on Today, supported by the endowed-progress evidence (onboarding topic). Rejected in favour of naming only the next step. The companion-ethics evidence (Kivetz, Nunes & Drèze) and house invariant 6 treat any visible denominator as completion pressure. The bounded list still appears in the place file as ticked rows with no count.
- iOS provisional (quiet) authorization for the night-before pickup notice (onboarding topic). Rejected because provisional notices never reach the lock screen or show as banners, so they defeat the pickup trigger (notifications topic). It is kept only as an optional test for Household activity, and it never counts toward activation.
- Apple's title-case push titles ('Recycling Tomorrow · Unconfirmed'), from the competitive topic. Rejected in favour of sentence case with the caveat first ('Unconfirmed: pickup tomorrow'), which matches the product-wide sentence-case rule and the 30-character Android budget. Title case is an HIG preference, not a requirement.
- Keeping 'Not now' on a standalone iOS primer (notifications topic) vs. a single-button primer with no cancel (competitive/onboarding topics). Both were set aside by restructuring: the decision always happens on the in-context card or inline pickup ask, so the iOS primer, where it still exists, has one 'Continue'. Android keeps 'Not now', as its guidance requires.
- A 'Mark paid' notification action on bill reminders (notifications topic). Rejected because it fans out to the whole household, and a tray action cannot show the Undo that the household topic requires. The date reminder 'Done' action and the pickup 'That's my day' action are adopted.
- Retyping the amount (double entry) to beat visual checking (Barchard). Rejected because added correction effort reduces corrections (Bias in the Loop). We use source crops, label captions and values restated in the commit button instead.
- Numeric or categorical confidence scores on extracted fields and on provenance. Rejected per PAIR and the house rule. Uncertainty is shown as a text flag plus alternatives, and confidence as a sentence in the provenance sheet.
- Dropping Air from the compare instrument because frozen readings are not 'today' (share topic option). Rejected, because the standardized-label evidence favours keeping all four rows. Air stays, labelled 'Air on Sat 12 Sep'.
- A weekly, pausable Mail Day streak (companion topic's fallback). Rejected: no streak appears on any designed surface. The backend counter stays invisible.
- Letting members record 'I paid this' on bills (household topic). Not adopted into the v2 prompts, because it changes the finance.view permission model, which design rule 3 defers to. The prompts instead name who can mark a bill paid. This is flagged as a product decision.
- Routing all household activity into the evening briefing instead of sending it immediately (notifications/household topics). Rejected as a default, because bill_paid can matter within the day. Activity is Passive and grouped instead, and bill_paid is Active only for members for whom the bill is still due soon.
- A specific default photo-retention number (90 days) and a threshold-hysteresis margin. No sourced number exists, so both are left as explicit product decisions and are not written into the prompts.
- Renaming 'Block Founder' or 'Founding Neighbor' outright (trust topic). Not adopted: the prompts recommend a confusion test before any rename.
- Icon arrays on the scale strips (risk-dataviz topic). Not adopted on the strips, which stay as tracks. An array is allowed only if a probability picture is added to the detail or provenance sheet.
- Vendor and unverified figures used as specifications: Chameleon step completion, Airship opt-in medians, Userpilot checklist rates, X/WhatsApp OG image specs, OG safe-area percentages, '63% abandon after one missed day', 'CHI 2020 streak anxiety', and the '+60% Duolingo widget commitment'. These were used only for direction or excluded entirely.
- Hiding devices or controls a member can't use (a Zeng & Roesner household suggestion). Rejected for household-verified members, who have a path to unlock (Nielsen: show the control disabled and explain why). Hiding applies only when the person can never get access (T1 users never see attested controls).
- A per-cell tap target in the 14-day strip on native, which some v1 prompts implied. Rejected under the target-size evidence. Per-cell taps are kept only on desktop web, where cells are wide enough.
- The design doc's 14-day first-week window in x-place-file. Aligned to the 7-day activation window instead.
