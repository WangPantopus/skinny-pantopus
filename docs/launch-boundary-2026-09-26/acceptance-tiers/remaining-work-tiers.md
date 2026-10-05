# Acceptance tiers for the pilot

**Status:** proposal to the coordinator.
**Overlays:** [`REMAINING_WORK_2026-09-11.md`](../../REMAINING_WORK_2026-09-11.md), which stays the authority for row definitions, evidence and closure. Tiers set order and acceptance depth only. This document closes, reopens and reassigns nothing.
**Checked at:** `origin/master` `7bdef3e8c`, 2026-09-27T04:11Z. The backlog has 80 rows: 13 closed (H01–H06, R01–R02, P03–P05, P08, G02) and 67 open, counting the P01 milestone as open.
**Index and open decisions:** [README](../README.md).

## Tiers

| Tier | Meaning | Acceptance depth |
|---|---|---|
| **1. Launch path** | Anything pilot households touch, anything a launch requires, and anything that moves money while it stays reachable | Full acceptance as the row defines it: real caller, API and persistence on each platform the row names |
| **2. Reachable, not promoted** | Still in the app but outside the pilot promise | One floor pass per platform (below), recorded in the row's notes as "floor-checked". This is not closure. |
| **3. Hidden for the pilot** | Removed from the app for the pilot | Deferred, with accepted evidence kept. **Empty while gigs and payments are reachable.** |

**The tier-2 floor:**
1. No private data is exposed, including coordinates.
2. The screen opens without a crash or hang.
3. Loading, empty and error states are truthful: no fake success, no false empty list.
4. Every visible action either works or clearly says it is unavailable.
5. Report and block are reachable wherever other people's content appears.

**In every tier:** security, privacy and money-correctness defects are fixed when they are found.

## Gigs and payments

They are reachable, and the founder has not decided to cut or hide them. While they stay reachable, their open rows are tier 1, because a money defect in front of real users is the worst failure.

If the founder decides to hide them, hiding means all three of:
- **Server:** put `requireFeatureFlag` (`backend/middleware/requireFeatureFlag.js`) on every route that creates a new obligation: posting a gig, bidding, booking, tipping and payout onboarding. The middleware returns 404 unless the flag is on globally, for internal roles or for listed beta users.
- **Clients:** remove the entry points; deep links land on an honest "unavailable" state.
- **Kept open:** wallet, withdrawal, refund and dispute paths for existing obligations.

Tier 1 then loses P01, P02, P06, P07, P09, P10 and A05's money actions, and I03 moves to tier 3. That frees Stream 1 for the loop build.

## Assignment of the 67 open rows

Narrowing alone moves 14 rows from full acceptance to the floor. Most of tier 1 is Home work and launch infrastructure, so ordering within it (see the critical path below) is the bigger lever.

### Tier 1 (53 rows)

| Area | Rows | Why |
|---|---|---|
| Home access | H07, H08 | Invitations and first use. Private setup → Tasks is J2's home path. |
| Household | R03 | Member removal is part of the household journey. |
| Place and dates | I01, I04, I05, I06, I07 | I01: the health score is on the dashboard pilot homeowners open. I04: local dates, recurrence and daylight saving underlie every reminder, and DST ends November 1. I05–I06: the facts behind J2 and Today. I07: views refresh after changes. |
| Records and privacy | D01, D02, D03, D05, D06, D07, D08 | Permissions, truthful writes, bill units, settings, the privacy fallback (D06), invitations and sharing (D07), documents (D08). |
| Bills | F01, F02, F03, F05 | F05 binds bill worker and reader versions, which bills on the hosted environment require. |
| Notifications and safety | N01, N02, N04, N05 | N05 is the reminder itself; N02 is a physical Android phone; N04 because Nearby posting stays reachable. |
| Accounts | A01, A02, A03, A04 | Sign-up, sessions, uploads, address coverage. |
| Interface | U01, U02, U03, U04, U05 | Scoped to tier-1 flows. U05's inventory covers everything reachable by definition. |
| Integration, operations, pilot | G01, G03, G04, G05, O01–O06, L01–L04 | No pilot without these. |
| Payments, while reachable | P01, P02, P06, P07, P09, P10, A05 | Money. A05's non-money actions (mail, profile, search) need only the floor. |

### Tier 2 (14 rows)

| Rows | Note |
|---|---|
| R04, R05, R06 | Ownership transfer, the lease lifecycle and residency letters. R05 returns to tier 1 if renters are recruited; renter dates are F5 kinds, separate from R05. |
| I02, I03 | Checklist internals. I03 is the Hire → gig link and moves to tier 3 if gigs are hidden. |
| D04, D09, D10 | One lifecycle for maintenance records; malformed-success handling; household leave and delete. The floor covers their truthfulness. |
| F04 | Contributor cohorts for pooled bill data. |
| M01, M02, M03, M04 | Mail and guests. M01's privacy enforcement is part of the floor and cannot be skipped. |
| N03 | Pulse and Beacon journeys. |

### Tier 3 (0 rows)

Empty until a hide decision (see above).

## Critical path for the first five households

A subset of tier 1, ordered by what the first five households (web and iOS) hit first:

1. **Hosting and delivery:** O01, O03, O04, O05, O06, L01, L03. These cover the hosted database upgrade, hosted configuration, the release manifest, deploy and rollback, store builds and push credentials, the paid bundle, and cutover. They are founder-owned, and production cutover needs its own review.
2. **Reminders:** N05, N01, I04, plus N02 if an Android phone is in the first five.
3. **Arrival and facts:** A01, A02, A04, I05, I06.
4. **Home path:** H08, then H07 for the household step, and D06.
5. **States on the journey screens:** U03.

## Suggested stream focus (for the coordinator)

| Owner | Focus |
|---|---|
| Stream 1 | Open P rows, unchanged while gigs and payments are reachable. |
| Stream 2 | Home tier-1 rows, critical path first: H08, I04, D06, then H07, the D rows, the F rows and R03. |
| Stream 3 | A01, A02, A04, N01, N05 (and N02); U03 on the journey screens; N04 in full. Then one floor pass over N03 and M01–M04 instead of full journeys. |
| Founder | The hosting and delivery rows. |
| Loop build (launch-order steps 1–4) | Unassigned; a founder decision. |
