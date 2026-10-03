# Launch order, cuts and the two pilot journeys

**Date:** September 26, 2026.
**Amends:** [`NEXT_STEPS.md`](../../../NEXT_STEPS.md) sections 1–6 (order and pre-pilot scope). Sections 0 and 7 are unchanged.
**Design detail:** [first-person loop amendments](../design-amendments/first-person-loop-amendments.md). **Backlog order:** [acceptance tiers](../acceptance-tiers/remaining-work-tiers.md). **Index and open decisions:** [README](../README.md).
**Checked at:** `origin/master` `7bdef3e8c`, 2026-09-27T04:11Z.

## 1. Promise, customer and hypothesis

- **Promise:** "Know what matters for your home, and stay on top of it."
- **Customer:** first-time homeowners in Vancouver–Camas–Washougal, recruited through agents' closing gifts, home inspectors, local first-time-buyer and moving groups, and the founder's own street. Anyone else can still sign up, and renter dates (lease end, notice deadline) stay.
- **Hypothesis:** households keep Pantopus when it catches something relevant they weren't tracking and reminds them reliably about what recurs. The address reveal is how people arrive; it is not why they stay.
- **Decision rule:** if households enjoy the reveal but don't act on anything by weeks four and eight, fix the recurring job before adding features.

## 2. The two pilot journeys

Both follow one chain: relevant fact → suggested action → confirm it applies and choose the date → save → reminder → record progress. Saving an address never accepts a suggestion; only "Add this reminder" does.

### J1. Pickup: reliability

| Step | Behavior |
|---|---|
| Fact | The area's pickup schedule, marked unconfirmed until the household confirms it. |
| Action | "Set your pickup day." The household confirms each service and its day. Providers can differ within one city: the memo cites a Camas notice that sends recycling and yard-debris customers to Waste Connections' holiday schedule, separate from city garbage. That page returned 403 to our fetch, so confirm it by hand. |
| Reminder | The night before: "Recycling tomorrow. Bins out tonight." Quiet days send nothing. |
| Progress | A "Bins out" button on the notification records that the household acted. It changes no stored state, so next week's reminder is untouched. |
| Stress test | Holiday moves inside the pilot: Thanksgiving (Thursday, November 26), Christmas (Friday, December 25) and New Year's Day (Friday, January 1). Daylight saving time ends Sunday, November 1, so evening reminder times cross a clock change at the start. |

**Gaps at `7bdef3e8c`:**
- Pickup reaches people only as a morning-briefing line the day before; the evening briefing does not use the address calendar (`backend/services/context/eveningBriefingService.js`).
- The calendar code has no holiday or exception handling.
- Pickup writes need home access (`mutate_home_pickup_calendar`), so a saved place cannot hold a pickup day.
- Neither native app registers notification buttons.

### J2. Radon: discovery

| Step | Behavior |
|---|---|
| Fact | The county's EPA radon zone, already on the `/start` aha card. The zone describes the county, not this home. |
| Applicability | "Was radon tested during your inspection or since you moved in?" Choices: Yes (optional date and result), No or not sure, Not now. |
| Action | "Add a radon test to your list." The EPA recommends testing every home in every zone and says its zone map should not be used to decide whether a particular home needs a test ([EPA](https://www.epa.gov/radon/epa-map-radon-zones-0)). No season is prescribed. |
| Save | On web this can be the account-creation moment: the chosen action survives signup through the existing address-preview draft. |
| Reminder | On the chosen date, with "Done" (optional result) and "Not now" (choose a new date). |
| Progress | Accepted, done, already handled or dismissed. "Already handled" is recorded but does not count as a discovery. |

**Gap at `7bdef3e8c`:** the shipped radon card promises a reminder that does not exist: "Claim it and we'll remind you when a test kit is due." (`backend/services/placePreviewService.js:311` and `:320`, shown on web, iOS and Android). Step 1 below removes the promise until J2 ships.

### Owner-entered dates (optional in the pilot)

Insurance renewal, HOA dues, and lease end and notice deadline for renters, using the kinds in the September 16 F5 design.

## 3. Order

| Step | Work | Notes |
|---|---|---|
| **0: now, in parallel, founder-owned** | Hosted environment, and one scheduled reminder on a physical iPhone (and an Android phone if Android is in the pilot) | Backend deployment is off: Deploy Backend run [36290490904](https://github.com/WangPantopus/skinny-pantopus/actions/runs/36290490904) passed while annotating "Backend deployment is disabled" (`vars.BACKEND_DEPLOY_ENABLED`). Also production keys, migrations, TestFlight, and a Play internal track if needed. Backlog rows O01–O06, L01–L03, N02, N05. Agents can prepare; the accounts and credentials are the founder's. |
| **1** | Truthfulness and security fixes | The radon follow-up promise (interim copy in amendment A3). The Founding label fails open (`backend/routes/public.js:557`). `normalizeFeedPostRow` copies raw `effective_latitude/longitude` (`backend/services/feedService.js:199`) and neither privacy function touches them. Hide cash Earn per decision 7. Curator label and seeder prompt lines, because the Nearby feed stays reachable. Verify each at the current head first and reuse any accepted fix. Not blocking: referral-tier rewards, the tier rename, collapsing the Founding names. |
| **2** | Bridge, J2 and measurement | F1 (saving an address sets the location); the minimum of F5 that J2 needs; J2 end to end on web and iOS; one first-use prompt; the chosen action preserved through signup; the new funnel events. |
| **3** | J1 and reminders people can act on | F4 night-before pickup and the quiet-day gate; holiday moves for the pilot's providers; notification buttons on iOS and Android; J1 end to end. |
| **4** | Smallest household journey | Invite → the accepted action becomes a Home task the partner can see and complete → the owner hears about it. Sharing pickup or bills waits for the permission-defaults decision. |
| **5** | Pilot | Five households, then 30–50 (section 5). |

**Pilot restrictions:** none while gigs and payments stay reachable. If the founder decides to hide them, the [tiers document](../acceptance-tiers/remaining-work-tiers.md#gigs-and-payments) lists what hiding requires.

**Estimates:** the September 16 estimates do not carry over. Re-estimate each step when it starts. The September 16 plan did not include this work: notification buttons on both native apps, holiday moves in the calendar, suggestion states and the new event types.

**Who builds steps 1–4:** open. The three streams are verifying the backlog, and gigs and payments keep Stream 1 busy while they are reachable.

## 4. Cut from the pilot (code preserved)

| Item | Where it was | Why | Revisit |
|---|---|---|---|
| Compare card and rotating headline | F8; NEXT_STEPS §3 | A hand-recruited pilot doesn't need sharing to learn whether people come back. | After week-four results |
| Home-screen widgets | F7; NEXT_STEPS §4 | About six days per native app; reminder reliability comes first. | After the pilot's first read |
| Ballot P0 for November 3, and the voter step | [ballot build guide](../../ballot-build-guide-2026-09-23.md); F6 | The election arrives before the pilot can start, and the hook would have no working bridge behind it. | 2027 |
| Keeper | F11 | Needs proven obligations to summarize. | After the pilot |
| Mail snap | F10 | Larger build; owner-entered dates cover the pilot. | After the pilot |
| Referral-tier rewards, tier rename, Founding names | F9 rows 6–7 | Growth mechanics; sharing is deferred. | When acquisition work resumes |
| Just-moved ticks on the account | F6 | Useful, not needed to test the hypothesis. | After the pilot |
| Appeal windows | F12 | The design was wrong for Washington (amendment A4). | Before the owner's next Notice of Value |

**Reachable but not promoted in the pilot:** the Nearby feed and posting, Beacon, Mail, scheduling, and gigs and payments while they stay reachable. They get the tier-2 floor check (tier 1 for anything that moves money), not onboarding or recruiting attention. The seeder keeps `briefing.py`, `home_reminders.py` and `alert_checker.py`; feed publishing is a separate decision.

## 5. Pilot

- **Start:** five households, once one complete journey works end to end on the hosted environment and a scheduled reminder has reached a physical phone. Expand to 30–50 after those five go two consecutive pickup weeks without a wrong or missed reminder.
- **Households, not individuals:** recruit whole households and note each person's phone. An Android partner needs either the Android app on a Play internal track or a working web path; the web reminder path is unverified.
- **Length:** eight weeks per household. Record each household's observation time and how many due dates actually fell inside it; eight weeks does not guarantee two bill cycles.
- **What can happen in a November–January window in Clark County:** weekly pickup plus three holiday moves; radon; freeze-prep suggestions; owner-entered dates; burn bans if a source is wired (the calendar kind exists). Both property-tax due dates (April 30, October 31) fall outside it, and appeal deadlines depend on each owner's notice date.

### Measures

| Measure | Definition |
|---|---|
| Activation | Within seven days: a saved place or a home, plus at least one accepted action (a J1 pickup day confirmed, or a J2 decision recorded). |
| Reminder funnel | Sent → acted (opened, or a button tapped) → completed → reported helpful. "Delivered" cannot be observed without extra client work, such as an iOS notification service extension. |
| Discovery | Times a household acted on something it wasn't tracking: J2 "No or not sure" followed by a test, plus interview answers. |
| Follow-through | Something scheduled, completed or decided because of Pantopus. |
| Household | The invited person accepted and acted at least once. |
| Retention | Handled at least one responsibility in week four and in week eight. App opens are not the measure. |
| Cost | Founder support minutes and data-upkeep minutes per household per week. |
| Honesty | Zero reminders that present an unconfirmed date as confirmed (carried over from September 16). |

**Interview, weeks two and eight:** "What did Pantopus help you notice or handle that would otherwise have slipped through?"

## 6. Open decisions

See the [README](../README.md#still-open-founder-decisions).
