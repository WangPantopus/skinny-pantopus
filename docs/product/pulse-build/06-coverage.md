# Coverage: every part of the PR 625 design, where it is built, how it is checked

The founder's instruction of October 14, 2026: **finish everything in the design and have all of it in the app at launch.** This file is the check. It lists what the [PR 625 design](../pulse-product-design-2026-09-27.md) and its five wireframes ([`pulse-screens/`](../pulse-screens/)) require, the slice that builds each requirement, the build spec section that says exactly what, and the scenarios in [`05-scenarios.md`](05-scenarios.md) that prove it.

**How it is kept.** PV owns this file (one writer). At each sweep PV fills the **Verified** column with the date and the merged PR whose `Scenarios run:` line shows that the row's scenarios were run on every client that has the surface. A row with no slice, or past its slice's merge with no verification, is a finding on the board. Anyone who finds a requirement the design makes that is not here adds a row in a small PR and tells PV. The [launch bar](03-delivery-plan.md#the-launch-bar) needs every row verified, or the founder's written decision to ship that row dark.

**Marks in Slice:** **F** = needs something only the founder can provide (accounts, people, legal text, a published document). **X** = depends on another product that does not exist yet (slice S25, reserved).

## Summary and principles

| Requirement | Slice | Spec | Scenarios | Verified |
|---|---|---|---|---|
| One calm space per town; place is the membership, topics are filters | S4, S5, S6 | §3, §4, §10 | S4.1, S5.8, S6.1 | — |
| Six post types read from the words, each with its own ending | S7, S8 | §4, §5 | S7.1, S8.1 | — |
| Known, refreshed whenever someone asks again | S12 | §8 | S12.1 | — |
| Any conversation can become a plan | S14, S21 | §9 | S14.1, S21.1 | — |
| A service conversation can lead to a Crew Day | S25 (X) | §9 | none yet | — |
| Browsing, following and committing never imply one another | S9, S10, S14 | §6, §7, §9 | S9.6, S10.1, S14.2 | — |
| Who can read is shown apart from who it is shown to | S8 | §5 | S8.1 | — |
| Open to read, labeled to write, walled at the street | S5, S15, S16 | §10, §11, §14 | S5.4, S15.1, S16.1 | — |
| Time order and a page that ends at "You're caught up" | S6 | §3 | S6.3 | — |
| No volunteer admins; nothing invisible | S11 | §12 | S11.2 | — |
| Businesses reply under a label and cannot post | S1, S17 | §13 | S1.3, S17.1 | — |
| Nothing anyone does in Pulse targets offers or ads | S17, S19 | §11, §13 | S17.4 | — |
| Never manufacture activity: no invented neighbors, false urgency or "someone posted near you" | S6, S12, S13 | §3, §7, §8 | S6.1, S13.1 | — |

## Where Pulse lives

| Requirement | Slice | Spec | Scenarios | Verified |
|---|---|---|---|---|
| Four places (Home, Pulse, My plans, Messages) as the founder's five tabs | S3 | §2 | S3.1–S3.7 | — |
| Daily digest by email or push at a chosen time: what's new by distance, the home's own items, what plans need | S13 | §7 | S13.1 | — |
| Weekly street digest, quiet until streets open | S13 | §7 | S13.1 | — |
| Home records never enter Pulse | S5, S13 | §11 | S5.4, S13.1 | — |

## The first visit

| Requirement | Slice | Spec | Scenarios | Verified |
|---|---|---|---|---|
| A shared link to a public post opens that conversation, signed out | S15 | §11 | S15.1 | — |
| A shared link to a neighbors-only post shows "Only verified neighbors can read this" and nothing of the post | S15 | §11, appendix | S15.2 | — |
| Opening Pantopus directly: "Pick a town to look around", then that town's Pulse, read-only, without claiming to live there | S15 | §3 | S15.3 | — |
| A digest email shows the person's own item first, then the town's Pulse | S13 | §7 | S13.1 | — |
| Sign up only when posting or replying, by emailed or texted code, no password; the draft posts right after | S20 (text code F) | §5 | S20.1–S20.4 | — |
| Post at town level as "New here" with a daily limit until the postcard is confirmed | S5 | §10 | S5.7 | — |
| Every topic is on at first; after a few days one line: "Seeing too much? Mute what you don't care about." | S10 | §7 | S10.6 | — |
| Restricted spaces (a building's residents) still require verified access | S16 | §14 | S16.4 | — |

## The Pulse page (wireframe 1)

| Requirement | Slice | Spec | Scenarios | Verified |
|---|---|---|---|---|
| Header "Pulse" with search; area pill with the distance dial (street, neighborhood, town, another place) | S5, S6, S12 | §3 | S5.8, S5.9, S12.4 | — |
| Views Nearby, Following, Known | S6, S10, S12 | §3 | S6.8, S10.1, S12.1 | — |
| Topic chips filter and join nothing | S4 | §4 | S4.1 | — |
| Right now card only while something affects many homes | S12 | §8 | S12.3 | — |
| Posts grouped by street, neighborhood, town, newest first; label, distance, place, topic, one action | S6 | §3 | S6.4, S6.5 | — |
| New conversations wait behind a pill; nothing moves under the reader | S6 | §3 | S6.2 | — |
| The end: "You're caught up", "Show earlier"; nothing loads by itself | S6 | §3 | S6.3 | — |
| Order comes only from area, topics, follows and time | S6 | §3 | S6.4 | — |
| Quiet days say so and point to Known or Upcoming | S6, S12 | §3 | S6.1 | — |
| A post leaves Nearby when it resolves or ages out and stays searchable | S7, S12 | §4, §8 | S7.1, S12.4 | — |

## Posts and how they end

| Requirement | Slice | Spec | Scenarios | Verified |
|---|---|---|---|---|
| Card: name, label, distance, time; words or photo; place and topic; one action and replies; "…" | S6 | §3 | S6.5 | — |
| Ask: ends on Helpful, or 7 days; the day-6 reminder; unanswered counted apart | S7, S9 | §4 | S7.1–S7.3 | — |
| Share 3 days; Offer claimed or 7 days; Heads-up at its named time; Event "Happened · N went"; Lost and found reunited or 14 days | S7 | §4 | S7.1, S7.4 | — |
| Held, Removed and Resolved states; a lasting answer becomes Known | S11, S12 | §8, §12 | S11.2, S12.1 | — |

## Writing a post (wireframe 2)

| Requirement | Slice | Spec | Scenarios | Verified |
|---|---|---|---|---|
| One box; type, About and topic suggested, each editable in one tap | S8 | §5 | S8.1 | — |
| "Who can read" and "Shown to", always both, with "Showing it to gardeners doesn't limit who can read it." | S8 | §5 | S8.1 | — |
| The author can narrow who can read later, never widen | S9 | §5, §6 | S9.11 | — |
| First post opens a short audience review; "Posting as {Name} [label]" | S8 | §5 | S8.2 | — |
| Existing answers first ("Neighbors asked something similar") | S8, S12 | §5 | S8.7 | — |
| Call-outs: private note, the city's form, or edit; recommending a business or thanking a neighbor is never flagged | S8 | §5 | S8.4, S8.5 | — |
| Private details: photos lose location data; a house number, plate or phone number prompts blur or edit | S8 | §5 | S8.3, S8.6 | — |
| Tone: one suggestion, never blocks. National politics: no topic, the composer says so | S8 | §5 | S8.6 | — |
| Drafts survive sign-up, app switches and moving around a conversation | S8, S20 | §5 | S8.10, S20.4 | — |

## Conversations (wireframe 3)

| Requirement | Slice | Spec | Scenarios | Verified |
|---|---|---|---|---|
| Two levels; oldest first; "↓ N new replies" waits behind a pill; long branches collapse | S9 | §6 | S9.1, S9.2 | — |
| Helpful, not verified; private Thank; no public scores | S9 | §6 | S9.3, S9.4 | — |
| Offers: "I'd like it"; the giver chooses (or first claim) | S9 | §4, §6 | S9.5 | — |
| Heated exchanges slow down for the two people only | S9, S11 | §6 | S9.9 | — |
| Businesses reply under their label, only where asked, with a weekly cap | S17 | §6, §13 | S17.1 | — |
| Report and mute in each reply's "…" | S9, S11 | §6 | S9.8, S11.1 | — |
| Moderators can merge duplicate conversations | S23 | §12 | S23.1, S23.2 | — |
| Local government and Getting around: "Residents only" view; Local government gets a pinned, labeled summary | S16, S17 | §6 | S16.5, S17.5 | — |
| Officials and the curator can pin a source at the top of a conversation | S24 | §6 | S24.2 | — |
| "Reply removed" keeps the thread's shape | S9 | §10 | S9.7 | — |

## Topics and places

| Requirement | Slice | Spec | Scenarios | Verified |
|---|---|---|---|---|
| One conversation reachable through its area, topic, place page and Following | S6, S10, S16 | §3, §14 | S10.2, S16.2 | — |
| 12 fixed topics; nobody creates topics; specific interests come from search | S4, S12 | §4, §8 | S4.1, S12.4 | — |
| Place pages for a park, trail, lake, library, school zone, HOA, council district, apartment building | S16 | §14 | S16.2 | — |
| A place page: conversations, Upcoming events there, sourced facts, official updates, dated visitor observations | S16 | §14 | S16.2, S16.3 | — |
| Following a place grants nothing; nobody owns a page; restricted places show conversation to verified homes only | S10, S16 | §7, §14 | S16.4 | — |

## Following, notifications and the digest (wireframe 3, right)

| Requirement | Slice | Spec | Scenarios | Verified |
|---|---|---|---|---|
| Follow a conversation, topic or place; "Saved to Following. Notifications are off."; Stop following | S10 | §7 | S10.1, S10.2 | — |
| Follow for how long: until it ends, a week, keep | S10 | §7 | S10.1 | — |
| Notifications off, except replies to you | S10 | §7 | S10.1, S10.5 | — |
| Noise budget (always instant / your choice / never) and one push a day for anything not about you | S13 | §7 | S13.1 | — |
| "…" menu: Why am I seeing this, Follow, See more, Mute topic, Mute person, Report | S10 | §7 | S10.3–S10.5 | — |
| One preferences page with an undo for everything | S10 | §7 | S10.3 | — |
| Helper nudge: one quiet nudge when a question in a topic they chose sits unanswered | S13 | §7 | S13.2 | — |

## Known, Upcoming, Right now (wireframe 4)

| Requirement | Slice | Spec | Scenarios | Verified |
|---|---|---|---|---|
| Known entries with sources and "last confirmed"; asking shows the entry first; asking anyway refreshes it | S12 | §8 | S12.1 | — |
| Recommendations list who and when, newest first; no stars; businesses cannot pay or edit | S12 | §8 | S12.1 | — |
| Known uses only public posts and official sources; a walled post never feeds an entry or a count | S12 | §8 | S12.5 | — |
| Pantopus drafts entries; residents confirm, correct or flag outdated; two matching confirmations publish a refresh; staff settle disputes | S12 | §8 | S12.1 | — |
| Upcoming: events and official events and plans, in date order, "Going" | S12 | §8 | S12.2 | — |
| Right now: official first; "Me too" and "It's back"; "Reported by neighbors" until confirmed; ends when cleared; never for crime | S12 | §8 | S12.3 | — |
| A Heads-up tied to a Right now event ends with it ("Ends when power returns") | S12 | §8 | S12.6 | — |
| Known can cite public property facts (school zone, flood zone), never valuations or ownership | S12 | §8 | S12.1 | — |

## From conversation to plan (wireframe 5)

| Requirement | Slice | Spec | Scenarios | Verified |
|---|---|---|---|---|
| "Suggest a plan" from a conversation, prefilled; What, When, Where, Who can join | S14 | §9 | S14.1 | — |
| The invitation card posts back; only Going counts; "sounds nice" does not | S14 | §9 | S14.1 | — |
| A "Going" chip on a reply from someone going; "Not counted as going" under an interested reply | S14 | §9 | S14.2 | — |
| "Added to your plans" toast; lands in Your plans and Today; the conversation links to the plan and closes with a line | S14 | §9 | S14.1 | — |
| Any Event conversation can become a plan | S14 | §9 | S14.3 | — |
| A plan's audience: the conversation, the neighborhood, the town or invited people | S14 | §9 | S14.1, S14.4 | — |
| Repeats ("Every Thursday"); "Not this time"; "7 going · 2 can't make it this week"; co-hosts; a series pauses when the host stops | S21 | §9 | S21.1–S21.8 | — |
| Crew Day price from a service conversation, each household approving its own terms | S25 (X) | §9 | none yet | — |
| Support Trains offered from a conversation, details private to the train | S22 | §9 | S22.1–S22.5 | — |

## Identity, provenance and privacy

| Requirement | Slice | Spec | Scenarios | Verified |
|---|---|---|---|---|
| The seven labels and their rules | S5 | §10 | S5.1 | — |
| What each label can do; daily limits | S5 | §10 | S5.7 | — |
| Public posts show first name and label; neighborhood posts add street and distance; distances rounded, never on the public web | S5, S15 | §10, §11 | S5.3 | — |
| One account per adult; adult-only posting; a ban applies to the person | S5, S11 | §10 | S5.6, S11.4 | — |
| After a move areas switch; old areas fade over a month | S5 | §10 | S5.2 | — |
| Two homes: one primary for posting, a second for reading | S5, S24 | §10 | S24.1 | — |
| The wall table enforced on the server for every read path | S5 | §11 | S5.4 | — |
| Photos lose location data; "street posts are for neighbors" reminder | S8 | §5, §11 | S8.3 | — |
| "Why am I seeing this?" shows only the reader's own choices; no contact uploads, follower counts or "people you may know" | S10 | §7, §11 | S10.4 | — |
| Pulse never tracks live location | S5 | §11 | S5.10 | — |
| Account deletion removes posts; replies show "Reply removed" | S9 | §10 | S9.7 | — |
| Law-enforcement requests need legal process; a transparency report is published | S19 (F to publish) | §12 | S19.3 | — |

## Safety and moderation

| Requirement | Slice | Spec | Scenarios | Verified |
|---|---|---|---|---|
| The seven rules shown in context, and on one rules screen | S11 | §12 | S11.8 | — |
| The ladder (suggestion, held, removed, slow mode, ban); every action says what, which rule and why | S11 | §12 | S11.2–S11.4 | — |
| Appeals decided by a person | S11 | §12 | S11.3 | — |
| Private notes to a home: short templates, one per issue, reply or block, repeat senders reviewed | S8 | §5 | S8.4 | — |
| No crime-alert culture; sourced notices only from officials | S1 | §4 | S1.1, S1.2 | — |
| Crisis content: held, resources shown, staff alerted; mandatory-report queue | S11 (F for providers) | §12 | S11.5 | — |
| Paid moderators and published response hours | S11 (F) | §12 | S11.8 | — |
| Posts spreading unverified claims during an emergency are held | S23 | §12 | S23.3, S23.4 | — |
| A quarterly public report of held, removed and restored; moderation cost tracked | S19 (F to publish) | §12, §15 | S19.2, S19.3 | — |

## Businesses, officials, the curator

| Requirement | Slice | Spec | Scenarios | Verified |
|---|---|---|---|---|
| Businesses reply under "Business"; cannot start posts, follow, message first or edit Known | S1, S17 | §13 | S1.3, S17.1 | — |
| A labeled "Local offers" spot from verified local businesses, never in the conversation list, never targeted | S17 | §13 | S17.4 | — |
| Officials verified by staff post Heads-ups, Events and Right now updates; cannot remove residents' replies to them | S17 | §13 | S17.2 | — |
| The curator seeds sourced content, never invents neighbors, shrinks as residents take over | S12 | §13 | S12.1 | — |
| Crew Day providers' pages show credentials and what nearby homes said | S25 (X) | §13 | none yet | — |
| A business owner who lives here posts as a resident and replies as the business | S17 | §13 | S17.3 | — |

## Edge cases

| Situation | Slice | Spec | Scenarios | Verified |
|---|---|---|---|---|
| A quiet town: "Quiet today", Known, Upcoming, sourced posts, nothing invented | S6, S12 | §3 | S6.1 | — |
| A dense city: the smallest area is a few blocks | S16 | §14 | S16.1 | — |
| Rural roads: areas by drive time; distances read "nearby" | S16 | §14 | S16.1 | — |
| Apartment buildings: the building is the street area; unit numbers never shown; the building's Known page first | S16 | §14 | S16.4 | — |
| Moving; two homes | S5, S24 | §10 | S5.2, S24.1 | — |
| Visitors browse any town, ask and reply, add dated observations | S5, S15, S16 | §10, §14 | S5.8, S16.3 | — |
| An emergency leads with official information | S12, S23 | §8, §12 | S12.3, S23.3 | — |
| A heated local issue: Local government topic, Residents only view, slowed exchanges, official sources pinned | S9, S16, S24 | §6 | S9.9, S16.5, S24.2 | — |
| Duplicate questions: existing answers first; moderators merge | S8, S23 | §5, §12 | S8.7, S23.1 | — |
| People under 18 have no accounts | S5 | §10 | S5.6 | — |
| Lost pets: photo and last-seen area; closes when the pet is home | S7, S8 | §4 | S7.1 | — |

## How Pulse fits the rest of Pantopus

| Connection | Slice | Spec | Scenarios | Verified |
|---|---|---|---|---|
| Street Organizer: plans on a street appear in the street group ("N plans on your street → Plans") and the weekly street digest | S13, S16 | §2, §17 | S16.6 | — |
| Street Organizer: welcomes from the street (welcome cards) | S25 (X) | §14 | none yet | — |
| Crew Day: a service conversation leads to a price | S25 (X) | §9 | none yet | — |
| Support Trains: offered from a conversation by people who know the family | S22 | §9 | S22.1 | — |
| Porchlight and Mail: no connection | none | none | none | — |
| Home: pickup days and alerts ride in the digest, never in Pulse | S13 | §7 | S13.1 | — |
| Local offers: one labeled spot | S17 | §13 | S17.4 | — |
| Existing Pulse screens, components and styles are reused; a visual change to an existing screen goes to design review first | every slice | README rule 1 | A4 | — |

## Metrics and rollout

| Requirement | Slice | Spec | Scenarios | Verified |
|---|---|---|---|---|
| The ten metrics, and the never-goals (time in the app, daily opens, reply counts, posts per person, notification open rates) | S19, S24 | §15 | S19.1, S24.3 | — |
| Rollout phases and their gates (seed, town-wide, streets, places, next towns) | F | README | none | — |
| Seed content for the first town (Known, Upcoming, official sources) | S12 (F to approve) | §8, §13 | S12.1 | — |
| Areas are data: a street or place opens by setting `opened_at`; a new town is rows | S16 | §14 | S16.1 | — |
| The 14 first-time-user tasks, run in rounds of 8 to 10 people | PV prepares, F runs | §16 | none | — |

## Differences from the design that the founder decided

These are deliberate. Nobody "fixes" them back.

- Five tabs (Place · Today · Pulse · Plans · Messages) instead of the design's four places; the wireframes' bottom bar (Home, Pulse, My plans, Messages) is not built as drawn.
- The row the wireframe calls "Place" is **About**; "Added to My plans" reads **Added to your plans**; Follow is not on the card (it is on the conversation page and in "…").
- Offers: the giver chooses among up to five requests by default; first-come is the giver's option (the design said the first claim wins).
- A Share needs a place attached and each person gets two a week.
- Crime, suspicious, theft, vandalism and scam Heads-ups cannot be created; Official and curator accounts may post sourced public-safety notices.
- Pulse is built now, without waiting for the Crew Day launch, and without a feature flag.
