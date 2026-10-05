# Launch boundary, September 26, 2026

**Status:** Planning documents only. No application code, migration, configuration, workstream status or hub file was changed. Code facts were checked at `origin/master` `7bdef3e8c` (2026-09-27T04:11Z UTC); every cited file is unchanged since `89f3c6bac`.

**What this is.** On September 26 the founder reviewed a product memo, a critique of it, and the memo author's reply, then asked for the resulting direction to be written down in separate documents. These documents amend three existing ones without editing them:

| Folder | Document | Amends |
|---|---|---|
| `next-steps/` | [Launch order, cuts and the two pilot journeys](next-steps/launch-order-and-journeys.md) | [`NEXT_STEPS.md`](../../NEXT_STEPS.md) sections 1–6 |
| `design-amendments/` | [First-person loop amendments](design-amendments/first-person-loop-amendments.md) (F2–F5, F12, measurement, shipped radon copy) | [`first-person-loop-design-2026-09-16.md`](../first-person-loop-design-2026-09-16.md) |
| `acceptance-tiers/` | [Acceptance tiers for the pilot](acceptance-tiers/remaining-work-tiers.md) (order and depth for the 67 open rows) | [`REMAINING_WORK_2026-09-11.md`](../REMAINING_WORK_2026-09-11.md) |

The amended documents stay authoritative for everything not amended here. Once the founder confirms this direction, fold the amendments into them so there is still one checklist, one design and one backlog.

## Direction recorded at the founder's request

1. **Promise:** "Know what matters for your home, and stay on top of it." "Get it handled" waits until a service can actually do the work.
2. **First customer:** first-time homeowners in the seeded metro (Vancouver–Camas–Washougal). The product stays available everywhere and keeps renter dates.
3. **What the pilot tests:** discovery (something relevant the household wasn't tracking) and reliability (a recurring reminder that is right), through two journeys: radon and pickup.
4. **Cut from the pilot, code preserved:** compare card, widgets, Ballot P0 for November 3, keeper, mail snap, referral-tier rewards and naming.
5. **Pilot shape:** five households once one complete journey works on the hosted environment, then 30–50; eight weeks each.

## Still open (founder decisions)

- **Gigs and payments remain reachable; the founder has not decided to cut or hide them.** Their open rows therefore stay tier 1, and Stream 1 continues them.
- Who builds the loop while the three streams verify.
- Whether invited household members see pickup and bills (the F3 permission defaults).
- Android in the first households (Play internal testing), or a web path for Android partners.
- Where the new promise appears (store listing, onboarding, `/start`).
- The pilot start date. It depends on the hosted environment and the two journeys, not a calendar target.

## What does not change

- The three verification streams continue under the coordinator and the [coordination hub](../workstreams/README.md). The tiers document proposes order and depth; the coordinator decides assignments.
- Security, privacy and money-correctness defects are fixed wherever they are found.
- The September 16 decisions in `NEXT_STEPS.md` section 0 stand, except the pilot shape in the sixth (now first-time homeowners, five households first, then 30–50, eight weeks). Decision 8 (address-verified vs household-verified) stands; its implementation, F3b, is deferred for the pilot (see amendment A7).
