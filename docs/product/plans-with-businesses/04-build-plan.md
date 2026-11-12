# Plans with businesses: the build plan

November 11, 2026 · Status: a plan. No session is started and nothing is built.
The founder asked on November 11 for the design and the documents, not the build.
This says how the build would run when the founder says go. It builds the
[contract](03-build-contract.md) to the [design](02-design.md).

## What people get, step by step

| Step | What changes for people | Earns |
| --- | --- | --- |
| 0. By hand | Three businesses host a weekly plan from the owner's own account. Nothing in the app changes | By invoice |
| 1. Remember the venue | Nothing visible. Pantopus can count plans and guests at each public place | No |
| 2. A business hosts | A verified business posts a free plan at its place. Guests see the place, "Hosted by", the filter and the fold | No |
| 3. Paid spots | A price on a spot, pay to join, refunds, the payout, the two rates, the roster | Yes |
| 4. The doors | Bring a friend, people you know are going, "Near you this week", "New here", follower notices, "come back" | Makes the 15% true |
| 5. Repeats | "Every Saturday" in the composer | More of the same |
| 6. The desk on the web | Post, see the roster and read the statement on a wide screen | Keeps businesses |

Each step ships on its own, behind the switch, and leaves the app working. A
neighbor's plan is checked for sameness at every step.

## The switches

| Switch | Kind | Starts | Hides |
| --- | --- | --- | --- |
| `plans_business` | A `FeatureFlag` row, like `plans_sports` | Off | "Host as", every business plan, the filter, the fold, the roster, the statement, every new route and notice |
| `plans_business_kids` | A `FeatureFlag` row | Off | A business's plans of the kids' kind, until a lawyer has read the rules |
| `biz=1` | A request marker, not a switch | Sent by app builds that carry step 2 | Keeps business plans away from builds that can't draw them |

Order when turning on: the server and migrations first, then store builds that
send `biz=1`, then `plans_business` for test accounts in staging, then for the
first businesses in production, then for everyone. A business's plan is invisible
to anyone until both that person and the business have the switch.

## Who builds what, in order

Each step is one server session (which also takes the web), then one iOS and one
Android session in parallel once the server PR is merged. Sessions are started by
the founder from prompts written when the founder says go. Each works in its own
worktree and branch, does all of its own work with no subagents, verifies in the
real apps, and merges its own PRs through the shared queue after green checks.

### Step 0 · By hand (the founder; no code)

- Pick three businesses: a kids' activity, a sports clinic, a café or bar.
- The owner posts a weekly plan from their own account at their place. A café,
  court or gym is a public place, so this works today.
- A paid one collects with a business invoice after the plan. The invoice picker
  lists only people who have messaged the business's page, so guests message it
  first.
- Count for four weeks: plans posted, asks, who came, who came back.

### Step 1 · Remember the venue (server; apps only if needed)

- One migration: `Plan.place_ref`.
- `createPlan` and `editPlan` save the picker's `place_id`.
- The funnel report gains plans and guests per venue.
- First check whether the apps send `place_id` when posting. If not, one line in
  each app, in step 2's app PRs.
- Small enough to ship on its own, and it gives the line for a sales
  conversation: "74 people came to your café through Pantopus last month."

### Step 2 · A business hosts (server and web share page; then iOS, Android)

Server:

- Migration: `business_user_id`, `business_location_id`, `label`,
  `guests_can_invite`; the widened checks; the two flag rows; the two
  permissions; `way_in` on requests.
- `GET /api/plans/host-as`; posting as a business; the card's `business`, `label`
  and public `place`; `host=` and the fold; `biz=1`.
- The business's limits; the chat written in as the business.
- `GET /api/businesses/:id/plans`.
- The share page draws D6 without a price.

Apps: G1, G2, G3 (free), G7 unchanged, B1, B2 without Price, B3, B6, P1's parts.

### Step 3 · Paid spots (server; then iOS, Android)

Server:

- Migration: `price_cents`, `currency`, the price check, the request's payment
  columns, the `paying` status, `plan_payment`.
- Joining with a payment, `confirm`, the hold and its release, the waitlist
  hold, refunds by the rule, cancel with refunds, the payout after the plan, the
  two rates and the saved fee.
- The roster and check-in. The proof line.
- The notices of section 7 that carry money.

Apps: G4, G5, G6, the Price part of B2, B4, and the states in the design.

Step 3b, after 3 is live: approval on a paid plan (a saved card charged on
accept).

### Step 4 · The doors (server; then iOS, Android)

- Guests invite; `known_going` and its setting; `GET /api/plans/near-me`; the
  follower notice; "come back"; the way-in checks for each.
- Apps: D1 to D5, the setting in Plans settings.

### Step 5 · Repeats (server; then iOS, Android)

- `repeat` on posting, `series_id`, the series shown on B3 and the roster.

### Step 6 · The desk on the web (one web session)

- Plans under `app/business/[id]/`: the list, posting, the roster, the statement
  (B5), and the statement route.
- The monthly `plan_statement_ready` notice.

The statement route and the fee columns exist from step 3, so a business can be
sent its numbers by hand before step 6.

## Checks

Every PR, before merging:

- **The sameness check.** With `plans_business` off and then on: a neighbor posts
  each of the five kinds, a second account asks, is accepted, chats, leaves. The
  responses with no `biz=1` are compared with master's for the same seed.
- **The real apps.** iOS in a simulator, Android in an emulator, the web in a
  browser, against a local server and database, with the payment company's test
  keys from the founder's own env file (never printed or committed; live keys
  refused).
- **The other side.** Every flow is checked from the guest's phone and the
  business's.
- **After a relaunch**, the state is the same.
- **Existing checks:** the server's Jest and privacy gates, the migration check,
  web lint and type-check, the iOS and Android checks their guides name. No new
  unit tests; an existing test broken by an intended change is updated in the
  same PR.

The contract's "Done when" is the checklist for the last PR of each step.

## The founder's steps

In the order they come up.

| When | Step |
| --- | --- |
| Before anything | Confirm the decisions (D1 to D6, C1 to C9) |
| Step 0 | Find the three businesses and run it by hand |
| Before each server merge | Approve it: merging applies its migration to production |
| Before step 3 | One real charge, refund, delayed payout and bank payout on the live payment account. The accountant's answer on sales tax |
| After step 2's and step 3's app PRs | Cut store builds |
| Before real people | The privacy policy, the data inventory and the store privacy labels |
| Before kids' plans | The lawyer's read; then `plans_business_kids` |
| Before bars | The lawyer's read of the Washington promotion rule |
| To go live | `plans_business` in staging for test accounts, then the first businesses, then everyone |

## Traps known ahead of time

- **Old builds.** A build without `biz=1` must never receive a business's plan,
  or it will draw a paid plan with "Ask to join". Check with the store build that
  is on phones today.
- **The playdate check.** `plan_playdate_rules` is a table check; widening it
  means dropping and re-adding it in one migration, as the chat room checks were
  widened for plans.
- **The payout wait** is in the shared payment service. Change it for
  `plan_payment` only, and re-run the invoice and task payment checks.
- **Deleting accounts.** A new reference to `User` or `Payment` can fail the
  account-deletion contract test. Decide the delete rule before writing the
  migration.
- **Holds and quiet hours.** A held spot's clock starts when its push is
  released, not when it is queued.
- **Two flags per viewer.** A business plan's visibility depends on the viewer's
  flag and the business's. Test with one on and the other off, both ways.
- **Violet twice.** The kids' kind and the business color are the same. Build the
  badge from P1, not from the kind's tile.
- **The fold changes counts.** "See all 6" and list totals count folded plans
  once per venue or once per plan; pick one and use it on both apps.
- **Money in tests.** A test charge in the local rig needs the payment company's
  test webhook to reach the local server; without it only `confirm` moves a
  request, which hides webhook bugs.
- **Merging applies migrations to production.** Every server PR here has one.

## Done means

- A neighbor's Plans is unchanged, shown by the sameness check on the last PR.
- The contract's "Done when" passes on iOS, Android and the web desk.
- The switches are off in production until the founder turns them on.
- NEXT_STEPS has every merged PR and every founder step that is still open.

## Not in this plan

- Prompts for the build sessions. They are written when the founder says go.
- A "Sponsored" unit or a charge on free venue plans. A separate decision.
- Plans screens for guests on the web.
- Tips, deposits, packages, memberships, discounts and taxes.
