# Plans with businesses: the contract between the server, the web and the apps

November 11, 2026, updated November 12 · Status: the contract the build follows.
On November 12 the founder said go for the first round: steps 1 and 2 on the
server and the web share page, with a free plan only (the
[build plan](04-build-plan.md) has the order). Paid spots are not approved yet.
Read against master `8f7ac268e8`. It follows the [proposal](01-proposal.md) and
the [design](02-design.md).

Where this says "today", the code was read. Where it says "new", nothing exists.

## 1. What it is

A verified business hosts a plan at one of its own locations, free or with a
price on each spot. A guest joins and pays in the app. Pantopus keeps a fee from
the business's payout, at a rate set by how the guest arrived. Everything rides on
the Plans tables, routes and screens that exist; a neighbor's plan is untouched.

**The shared pieces.** On November 11 the founder approved four pieces that every
business feature shares (`docs/product/business-graph/02-shared-pieces-contract.md`,
PR #3965, called "the shared contract" below). Four places here stand on them:
who may post for a business (5.5), the key for a place (4.1), who is new to a
business and how a sale is recorded (4.2), and the statement (11.2). Where this
contract and the shared one differ on those, the shared one decides.

## 2. Decisions

D1 to D6 are the proposal's, recorded as recommended. The founder said yes to the
proposal on November 11 and was told these six would be taken as accepted; none
has been confirmed one by one. C1 to C9 are calls this contract makes; each is
open until the founder confirms it.

| | Decision | Value |
| --- | --- | --- |
| D1 | What leads | Paid spots for classes, clinics and tutors. Venues host free |
| D2 | First businesses and place | Kids' activities and sports clinics, in Camas, Washougal and Vancouver |
| D3 | The fee | 15% on a guest Pantopus brings (10% founding). 5% plus the card fee on the business's own guest (founding: the card fee only, for a year) |
| D4 | Who may host | Verified businesses only |
| D5 | Refunds | Full refund until 24 hours before the start, and whenever the business cancels. None for a no-show |
| D6 | Order | By hand first, then the steps in the [build plan](04-build-plan.md) |
| C1 | "Verified" | `BusinessProfile.verification_status` is `document_verified` or `government_verified`, and the page is published. `self_attested` is not enough, for any kind. Stricter than D4 for adult plans, because every business plan says "Verified business" |
| C2 | The rate follows the way in, every time | A returning guest who joins from the map is charged at 15% again. The other choice is 15% on a guest's first paid plan with a business only. This contract keeps the first, as the boards show it |
| C3 | Ties go to the business | If a guest has both an own way in and a Pantopus one, the own rate applies |
| C4 | Followers and "come back" are the business's own | A guest who follows the business, or who joins from "Same clinic next week?", is at the own rate |
| C5 | Plans for children get their own switch | `plans_business_kids`, off until a lawyer has read the rules, as `plans_playdates` was |
| C6 | Size | 1 to 30 spots, as today. A class of more than 30 is not a small plan |
| C7 | Paid plans with approval come second | The first paid build lets guests in right away. "I approve each" on a paid plan is step 3b |
| C8 | A refunded card fee is Pantopus's cost | The card company keeps its fee on a refund. Pantopus absorbs it in the first build and counts it |
| C9 | Old app builds never see a business's plan | The server sends business plans only to a request that says it can draw them (section 5.1) |

### Calls the build made (steps 1 and 2, November 12)

Made while building, from what the code is. Each is the founder's to change.

| | Call | Why |
| --- | --- | --- |
| B1 | The business is the plan's host. `Plan.host_user_id` is the business's own account, and the staff member who posted is kept in `posted_by_user_id` | Every screen, notice and chat line that names a host then names the business with no special case. A code path somebody missed stops a staff member doing something; it cannot show a guest a staff member's name |
| B2 | `plans.post` and `plans.manage` go to the owner, admins and editors by default | There is no "manager" role: the roles are owner, admin, editor, staff and viewer. Staff and viewers get neither. An owner can still grant or refuse either one person by person |
| B3 | A plan meets only at a storefront, an office or a warehouse that is on the map | A location of unknown type, a service area, a mailing address or a business working from a home may be someone's home (rule 3) |
| B4 | The business's team sees a guest's first name only, and no distance, address standing, connections or other plans | The design's sixth principle, applied to the people list, the requests list and the invitation lists |
| B5 | The assistant's nudges and "Plans you'd like" leave a business's plan out | A nudge can't know whether the person's app can draw it (C9). The doors that bring guests are step 4 |
| B6 | A plan's hidden post row is written under the business's account like any plan's, with none of the fields that list a post on a business's page | So a plan never shows up as a post on the page or in the team's posts list |
| B7 | The business's team is not in a plan's chat yet. The room is the guests', and the business's own lines appear in it ("Lacamas Pickleball Club changed the place") | A room the business's account is in belongs to the business inbox, which any team member who may write in the business's task chats can open, whatever their Plans permissions, and which pushes them each guest's message with the guest's display name. The team joins a plan's chat when Plans has its own rule for it: `plans.manage`, first names, and no inbox. Planned with the roster in step 3 |
| B8 | When a business may no longer host (unpublished, no longer verified, or its switch turned off), its plans are hidden from everyone new, and the people already in or waiting, and the team, keep reading them | So a guest can still leave and the team can still cancel. Nobody new can find or join one, and asking again from the waitlist is refused |
| B9 | When a business leaves Pantopus (its account is no longer a business), the Plans job cancels its open plans and tells the people in, waiting or invited | Nobody is left on its team to run them |
| B10 | A notice about a business's plan that is sent without a request (an invitation, the team's news) goes only to a person who has the switch | A notice must not open a plan the person's app answers 404 for. An invited address still gets its email, which opens the web page |

## 3. Rules that hold everywhere

1. **A neighbor's plan is unchanged.** No new field is required on any existing
   request. With `plans_business` off, every Plans response is byte-for-byte
   today's.
2. **A price needs a business.** A database check refuses `price_cents` on a plan
   with no `business_user_id`. No route can put a price on a neighbor's plan.
3. **A business never hosts at a home.** `place_kind` is `public` and the place is
   one of the business's active locations.
4. **One order.** Lists sort as today. No field, flag or payment changes a plan's
   position. `backend/jobs/organicMatch.js` states the same rule for ranking.
5. **The fee is fixed when the guest pays.** The way in, the rate and the refund
   deadline are saved on the request then, and later changes to rates or rules do
   not touch it.
6. **Money moves only on the server's word.** A request becomes "in" when the
   payment service says the charge succeeded, never on the app's say-so.
7. **Privacy as in the design.** A business's staff get no address, distance,
   phone, email or last name from any Plans route.
8. **Additive data only.** Added columns and widened checks. No new table in
   Plans. The shared `BusinessCustomer` table belongs to the shared contract and
   is built in the business graph's phase A, before Plans step 3. No applied
   migration is edited.

## 4. Data

All columns are added to existing tables, nullable or defaulted, so deployed apps
and the current server ignore them.

### 4.1 `Plan` (added columns)

| Column | Type | Meaning |
| --- | --- | --- |
| `place_ref` | `text` | The shared key for a place, in one of the forms of the shared contract, section 3.1. For a neighbor's plan at a public place it is the picker's id, such as `osm:node/123`. For a business's plan it is the location's own `place_ref` when it has one, and null until then. Step 1. The picker already sends `place_id` (`planPlaces.js:237`); a plan does not save it today |
| `business_user_id` | `uuid`, references `User(id)`, deleted with it | The business hosting. Null on a neighbor's plan. For a business's plan `host_user_id` is the same account (B1) |
| `posted_by_user_id` | `uuid`, references `User(id)`, set null when they are deleted | The staff member who posted it. Sent only to the business's own team |
| `business_location_id` | `uuid`, no foreign key | The business location used. The plan keeps its own copy of the point and address, as `place_home_id` does |
| `label` | `text` | The label key the business chose (section 4.4) |
| `price_cents` | `integer`, 100 to 50000 | The price of one spot. Null means free |
| `currency` | `text`, default `'USD'` | |
| `guests_can_invite` | `boolean`, default `false` | "Bring a friend". True only on a business's plan |
| `series_id` | `uuid` | The plans of one repeat share it. Step 5 |

Checks:

- `plan_business_is_host`: `business_user_id IS NULL OR business_user_id = host_user_id`.
- `plan_business_public`: a business's plan is at a public place and names its
  location (`business_location_id`).
- `plan_business_fields`: on a neighbor's plan `posted_by_user_id`,
  `business_location_id` and `label` are empty and `guests_can_invite` is false.
- `plan_label_form`: a label is a short lowercase key.
- `auto_rules` gains the value `open` ("right away, anyone"), allowed only where
  `business_user_id IS NOT NULL` (`plan_open_needs_business`).
- Step 3 adds `plan_price_needs_business`:
  `price_cents IS NULL OR business_user_id IS NOT NULL`.
- `plan_playdate_rules` is widened so it applies only where
  `business_user_id IS NULL`. Today it forces a playdate to approve by hand; a
  business's kids' class may let families in right away.

Index: `(business_user_id, status)` where `business_user_id IS NOT NULL`.

### 4.2 `PlanRequest` (added columns)

| Column | Type | Meaning |
| --- | --- | --- |
| `way_in` | `text` | How the guest arrived (section 6.2). Saved for free plans too |
| `brought_by_user_id` | `uuid` | The guest whose invitation or link it was |
| `new_to_business` | `boolean` | True if the business had no record of the guest when they joined. Read from `isNewToBusiness` (the shared `BusinessCustomer` record), so a guest who has already paid this business an invoice is not new. Step 3 |
| `payment_id` | `uuid`, references `Payment(id)` | Null on a free plan |
| `unit_price_cents`, `paid_cents` | `integer` | The price of a spot when they paid, and the total |
| `fee_basis` | `text`: `pantopus` or `own` | Which rate applied |
| `fee_pct` | `numeric(5,2)` | The rate, saved |
| `refund_until` | `timestamptz` | The end of the free window, saved |
| `refunded_cents` | `integer`, default 0 | |
| `hold_expires_at` | `timestamptz` | While paying: when the held spot is released |
| `checked_in_at` | `timestamptz` | |

`status` gains `paying`: the spot is held while the card is confirmed. It counts
as a taken seat. Every existing status keeps its meaning.

**The shared record.** A joined or paid request calls `recordBusinessContact`
(shared contract, section 4.2). A paid one's `Payment` row also carries
`sold_type = 'plan_spot'`, `sold_id`, `fee_pct`, `fee_basis` and `payout_after`,
and its fee is priced by `priceSale` (shared contract, section 5). Step 2 ships
before the shared record exists: until then a guest who joins a free business
plan is saved on the request only (`way_in`), and the record's first fill reads
those earlier requests too.

### 4.3 Other additive changes

- `Payment.payment_type` gains `plan_payment`, as `booking_payment` was added for
  scheduling.
- `FeatureFlag` rows `plans_business` and `plans_business_kids`, both off, in the
  shape of `20261025160000_plans_sports_flag.sql`.
- `FunnelEvent` types (section 11), widened as `20261031190000_plan_invites.sql`
  did.
- Business permissions `plans.post` and `plans.manage`: two values added to the
  `business_permission` list, and role defaults that give both to admins and
  editors (B2). Owners hold every permission. `finance.view` already exists and
  gates the statement.
- `PlanInvite.host_user_id` already names whoever sent the invitation. A guest's
  "Bring a friend" invitation uses the same table with the guest's id there; no
  column is added. The rule that only the host invites (`planInvites.js:175`)
  becomes "the host, a business's staff, or a guest who is in when
  `guests_can_invite` is true".
- `UserFeedPreference` or the Plans settings store gains the "people I know can
  see business plans I'm going to" choice. The build picks the existing settings
  home for Plans; no new table.

### 4.4 Labels

A fixed list per kind, kept in `planRules.js` and mirrored in the apps. No free
text.

| Kind | For a business it reads | Labels |
| --- | --- | --- |
| `watch_party` | Watch party | Watch party, Trivia night, Game night |
| `playdate` | For kids | Kids' class, Open play, Story time, Camp day |
| `pickup_game` | Sports | Clinic, Open play, League night, Pickup game |
| `walk_coffee` | Walk or coffee | Meetup, Tasting, Group walk, Run club |
| `study_group` | Study | Tutoring, Test prep, Workshop |

### 4.5 Limits for a business

Kept beside `LIMITS` in `planRules.js`:

| | A neighbor, today | A business |
| --- | --- | --- |
| Upcoming plans | 3 | 40 |
| New plans a day | 5 | 20 |
| How far ahead | 14 days | 60 days |
| Spots | 1 to 30 | 1 to 30 |
| Where | Within 3 miles of home or of where they are | One of its own active locations; no distance check |

## 5. API

Errors keep today's shape: `{ error: <code>, message: <sentence for people> }`.
Every route stays behind `verifyToken` and `requireFeatureFlag('plans')`.

### 5.1 Who is sent a business's plan

A business's plan is in a response only when all three hold:

1. the viewer has `plans_business`;
2. the plan's business still passes C1 and has `plans_business`;
3. the request carries `biz=1`.

Without `biz=1` the lists, the map, the detail route and "Plans you'd like" behave
as if the plan did not exist (404 on its id). This is how `v=2` keeps old builds
on today's sports answers. Only app builds that can draw G1 to G6 send `biz=1`.

`biz=1` is read from the query string: on every route under `/api/plans` (reads
and writes), on `GET /api/posts/map`, and on `GET /api/businesses/:id/plans`. An
app that can draw a business's plan sends it on all of them. The business's own
team needs it too: without it they see none of their plans. Jobs and nudges have
no request, so a business's plan does not exist for them either (B5).

The viewer's side (1 and 3) always holds. The business's side (2) decides who
can find and join a plan; the people already in or waiting, and the team, keep
reading it after the business stops qualifying (B8).

### 5.2 Changed routes

- `GET /api/plans`, `GET /api/plans/mine`, the map pins: accept `biz=1`. The list
  and the pins also take `host=all|neighbors|businesses` (default `all`). With
  `biz=1`, a venue's later plans in the window are folded: its soonest plan is
  the row, or the pin, and carries `more_times`. The list's answer also carries
  `has_business_plans`, true when a business has a plan in the area and window
  whatever the filter says: the app shows the filter only then. "My plans" lists
  a business's plans under `hosting` for the team members who run them.
- A business's map pin is at its exact place for everyone, and adds `business`
  (`user_id`, `name`, `verified`), `label`, `label_text`, `place_name` and
  `more_times` (a number).
- `GET /api/plans/:id`: the card and detail gain the fields in 5.4.
- `POST /api/plans`: accepts `host_as`, `business_location_id`, `label`,
  `price_cents`, `guests_can_invite`, `repeat`. Section 5.5.
- `PATCH /api/plans/:id`: a business's plan can change its title, about, note,
  spots (never below seats taken), time, `label`, `auto_rules` and
  `guests_can_invite`, and can move to another of the business's own locations
  with `business_location_id`. A `place` is refused: a business's plan never
  meets at a place typed by hand. Moving the time by more than 30 minutes, or the
  place, asks everyone "Still coming?" as today, and from step 3 a guest who says
  no is refunded in full whatever the deadline. The price and the location cannot
  change once anyone has paid.
- `POST /api/plans/:id/requests`: on a paid plan, starts a payment. Section 5.6.
- `DELETE /api/plans/:id/requests/mine`: on a paid plan, refunds by the rule and
  answers with the refund.
- `POST /api/plans/:id/cancel`: on a paid plan, refunds every guest in full.
- `POST /api/plans/:id/invites` and `/invites/link`: open to a guest who is in
  when `guests_can_invite` is true.
- `GET /api/public/plans/:id`: for a business's plan, adds `business`, `place`,
  `price` and `label`. A neighbor's plan answers as today. A kids' plan from a
  business answers only while `plans_business_kids` is on.

### 5.3 New routes

| Route | Who | What |
| --- | --- | --- |
| `GET /api/plans/host-as` | Signed in | `{ businesses: [{ user_id, name, avatar_url, verified, kinds: [{ kind, name, labels: [{ key, text }] }], locations: [{ id, label, is_primary, address, latitude, longitude }], limits: { spots_max, days_ahead } }] }`: the businesses the person may post for. Empty for nearly everyone, and always without `biz=1`; the apps show "Host as" only when it isn't. Whether a business can take payments is added in step 3 |
| `POST /api/plans/:id/requests/mine/confirm` | The guest | Re-reads the payment and answers with the request. The app calls it when the payment sheet closes |
| `GET /api/plans/:id/roster` | Staff with `plans.manage` | Guests with first name, party size, note, `way_in`, `new_to_business`, `checked_in_at`, paid total |
| `POST /api/plans/:id/roster/:requestId/check-in` | Staff with `plans.manage` | Sets or clears `checked_in_at` |
| `GET /api/businesses/:id/plans` | Signed in, with `biz=1` | `{ items: PlanCard[], plans_hosted }`: the business's upcoming plans, soonest first and not folded, for the business page. Empty for anyone its plans don't exist for. The proof line is step 3 |
| `GET /api/businesses/:id/plans/statement?month=YYYY-MM` | Staff with `finance.view` | The statement (section 11.2) |
| `GET /api/plans/near-me` | Signed in | The one "Near you this week" card and the "New here" three, or nothing |

### 5.4 Fields added to a plan card (only with `biz=1`)

```json
{
  "business": {
    "user_id": "…", "name": "Example Pickleball Club", "avatar_url": null,
    "verified": true, "page_url": "…", "plans_hosted": 14,
    "proof": { "came": 118, "went_well_in_10": 9 }
  },
  "label": "clinic",
  "label_text": "Clinic",
  "place": { "name": "Example Pickleball Club", "address": "410 Example Street, Camas", "latitude": 0, "longitude": 0 },
  "price": { "cents": 1800, "currency": "USD", "per": "person" },
  "refund": { "until": "2026-11-20T18:00:00Z", "rule": "full_until_24h" },
  "how_people_get_in": "automatic",
  "known_going": { "count": 2, "people": [{ "display_name": "Maya", "avatar_url": null }] },
  "more_times": { "count": 3, "items": [{ "id": "…", "title": "Open play", "label": "open_play", "label_text": "Open play", "starts_at": "…", "timezone": "America/Los_Angeles" }] },
  "guests_can_invite": true
}
```

- A neighbor's plan has none of these keys. A business's plan has `business`,
  `label`, `label_text`, `place`, `price`, `guests_can_invite` and `more_times`.
- **As built in step 2:** `price` is `null`, which reads "Free"; `proof` is
  `null`; `refund` and `known_going` are not sent yet (steps 3 and 4).
  `more_times` is `null` unless the venue has later plans in the list's window;
  `items` holds the first six.
- `viewer.auto_rule` is `"open"` on a plan that lets anyone in right away.
- `place` on a card is public only for a business's plan. A neighbor's plan keeps
  `area` on the card and `place` in the detail for people who are in.
- `proof` is null until 20 checked-in guests have answered.
- `per` is `family` for a kids' plan, where a family takes one spot as today.
- `known_going` lists at most three connections who allow it.
- `host` stays in the card for old readers and names the business for a business
  plan, never the staff member.
- `my_request` gains `paid_cents`, `refund_until` and `refunded_cents`.

### 5.5 Posting as a business

`POST /api/plans` with `host_as: { "business_user_id": "…" }`:

1. The person may act for the business: `actingForBusiness`
   (`backend/services/businessActing.js`, the shared helper) with `plans.post`
   and `needsVerified`. Its refusals are answered as they are.
2. `needsVerified` is C1. A kids' kind also needs `plans_business_kids`.
3. `business_location_id` is one of its active locations. The plan copies the
   location's name, address and point. The home guard and the 3-mile check do not
   run.
4. `price_cents` set: the business's payout account can take charges and
   payouts. Otherwise `409 payouts_not_ready`, with a sentence that says where to
   finish setup.
5. `auto_rules` is `["open"]` for "right away" or empty for "I approve each". A
   paid plan is `["open"]` until step 3b.
6. `repeat: { "weekly_until": "YYYY-MM-DD" }` makes one plan a week up to that
   date, at most 12, all with one `series_id`. Each is a full plan with its own
   requests, chat and payments.
7. The business's account is the plan's host and the author of its hidden `Post`
   row, which is written like any plan's (B1, B6). The plan's chat is the guests'
   room: the business's own lines appear in it, and neither the business's
   account nor any team member is in it yet (B7). The team's view of the plan
   carries no `chat_room_id`.
8. One audit line in the business's log for each thing a team member does to a
   plan: `plans.post`, `plans.edit`, `plans.cancel`, `plans.accept`,
   `plans.decline`, `plans.remove`.

Refusals: the helper's `404 business_not_found`, `403 not_your_business`,
`403 not_allowed`, `403 business_not_verified` and
`503 business_check_unavailable`; then `409 payouts_not_ready`,
`422 validation` (location, label, price) and `429 too_many_plans`.

### 5.6 Joining a paid plan

`POST /api/plans/:id/requests` with `{ party_size, via }`:

1. The existing checks run (visible, not the host, asking open, eligible).
2. No spot for the party: `waitlisted`, with no payment. Nothing is charged to
   wait.
3. A spot: the request is saved as `paying` with `hold_expires_at` ten minutes
   out, and the payment is created for `unit_price × seats` with
   `payment_type = 'plan_payment'`, captured at once. The answer:

```json
{
  "request": { "id": "…", "status": "paying", "hold_expires_at": "…" },
  "payment": { "payment_id": "…", "amount_cents": 3600, "client_secret": "…", "customer_id": "…", "ephemeral_key": "…" }
}
```

4. The app shows the payment sheet. When it closes the app calls `confirm`.
5. The payment service's webhook, or `confirm`, moves the request to `accepted`
   and runs today's `admit` (chat, notices, funnel). A failed or abandoned payment
   leaves `paying` to expire; the job releases the spot and offers it to the next
   person waiting.
6. A second call while `paying` returns the same payment. The request row's
   unique `(post_id, user_id)` keeps it to one.

Seats are counted as today (`seatsFor`): party size up to four, one per family for
a kids' plan.

**A spot opens for someone waiting.** They get the notice and a hold of 30
minutes, counted outside quiet hours, to pay. Then it goes to the next person.

**Step 3b, approval on a paid plan.** The card is saved when the guest asks
(`createSetupIntent`, which exists) and charged when the business accepts. A
charge that fails gives the guest two hours to fix it before the spot moves on.

## 6. Money

### 6.1 The two rates

| `fee_basis` | Pantopus keeps | The business gets, of $18.00 |
| --- | --- | --- |
| `pantopus` | `getEffectiveFeeRate(business)`: 15%, or the founding 10%, or an override. Pantopus pays the card fee out of it, as it does today | $15.30 (founding $16.20) |
| `own` | 5% plus the card company's actual fee on the charge. For a founding business inside its founding year: the card fee only | About $16.28 (founding about $17.18) |

`calculateFees` today takes a flat percent and Pantopus absorbs the card fee. The
`own` basis is a new branch: the fee is `round(amount × 0.05)` plus the fee the
card company reports for the charge.

### 6.2 The ways in

Saved as `way_in` when the request is created. The app sends what it knows in
`via`; the server trusts only what it can check, and otherwise uses `map_list`.

| `way_in` | The statement says | Basis | How the server checks it |
| --- | --- | --- | --- |
| `map_list` | Found on the map or list | pantopus | The default |
| `plans_you_like` | Plans you'd like | pantopus | A nudge for this plan was sent to this person |
| `today` | Today | pantopus | The "near you" card for this plan was served to this person |
| `new_here` | New here | pantopus | The same, within the household's first 30 days |
| `friend` | A neighbor brought them | pantopus | A `PlanInvite` for this plan from a guest, or a guest's link token |
| `assistant` | Ask Pantopus | pantopus | An assistant card for this plan was shown to this person |
| `own_invite` | Your invitation | own | A `PlanInvite` for this plan sent by the business's staff |
| `own_link` | Your link | own | The business's link token, which only staff can create |
| `follower` | A follower | own | A `BusinessFollow` row older than the plan |
| `come_back` | Came back | own | The "same time next week" offer for this series was sent to this person |
| `business_page` | Your page | own | Joined from the business's page, with no Pantopus way in recorded |

C3: if any own way holds, the basis is `own`, whatever `via` says.

**As built in step 2.** The ways that exist are checked: `own_invite` and
`own_link` (the guest holds an invitation to the plan; every invitation to a
business's plan is the business's until "Bring a friend" is built), `follower`,
and `business_page` (taken from `via`). Anything else is saved as `map_list`
until its screen is built in step 4. A neighbor's plan saves no way in.

### 6.3 Refunds

| What happens | Refund |
| --- | --- |
| The guest leaves before `refund_until` (24 hours before the start) | Full |
| The guest leaves after it, or doesn't come | None |
| The business cancels, or the plan is removed | Full, to everyone |
| The business moves the time by more than 30 minutes or changes the place, and the guest says they can't come | Full, whatever the deadline |
| The business removes the guest | Full |
| The payment never completed | Nothing was charged |

Refunds go through `paymentRefundService`. Pantopus returns its whole fee on a
full refund. The card company keeps its own fee; under C8 Pantopus absorbs that.

### 6.4 Payout

Today a captured payment waits 48 hours and is then sent to the business
(`COOLING_OFF_MS` in `stripeService.js`). For a plan payment the wait ends 48
hours after the plan's end, not after the charge, so a refund before the plan
never has to claw money back from a business. This is a change in the shared
payment service, limited to `plan_payment`.

### 6.5 What this build does not do

Tips, deposits, packages, memberships, discounts, promo codes, taxes and
invoices. A guest gets the payment service's emailed receipt. Sales tax is not
collected; see the proposal's "Not checked".

## 7. Notifications

Every notice follows today's rules: quiet hours, held pushes, one per event, and
for nudges the day's limit and "Fewer like this". Words are on board P2 of the
design.

| Type | To | When | New or today's |
| --- | --- | --- | --- |
| `plan_you_like` | Guest | A kind they asked about is posted nearby | Today's, now also for a business's plan, with the price |
| `plan_invite` | Guest | Someone invites them | Today's, now also from a guest |
| `plan_business_posted` | Follower | A business they follow posts | New |
| `plan_spot_opened` | Guest waiting | A spot is theirs to pay for | Today's, with the price and the hold |
| `plan_accepted` | Guest | They paid and are in | Today's, with "Paid $18" |
| `plan_refund_window` | Guest | Three hours before `refund_until` | New |
| `plan_cancelled` | Guest | The business cancels | Today's, with the refund line |
| `plan_refunded` | Guest | They left in time | New |
| `plan_come_back` | Guest | The day after a plan they said went well, if the series has a next one | New |
| `plan_guest_auto_joined` | Business | A guest joins | Today's |
| `plan_new_guest_found` | Business | A guest with a `pantopus` basis joins for the first time | New |
| `plan_guest_left` | Business | A guest leaves | Today's |
| `plan_full` | Business | The last spot is taken | New |
| `plan_host_summary` | Business | The morning of the plan | Today's, with "2 new to you" |
| `plan_payout_sent` | Business | A plan's payout is sent | New |
| `plan_statement_ready` | Business | The first of the month | New |

A notice to a business goes to the staff who hold `plans.manage` and have the
switch (B10), and opens the plan as the business. Nothing is sent to the
business's own account. Each team member's asks bundle on their own, as a
neighbor host's do.

## 8. Jobs

In the five-minute Plans tick (`backend/jobs/planJobs.js`), after today's steps:

1. Release `paying` requests past `hold_expires_at`, then offer the spot on.
2. Send `plan_refund_window`.
3. Send `plan_come_back`.
4. Send `plan_business_posted` to followers, bundled per business per day.

Elsewhere:

5. The payment transfer job treats a `plan_payment` by section 6.4 and sends
   `plan_payout_sent`.

Built in step 2, in the same tick: the open plans of a business that has left
Pantopus are cancelled and the people in them are told (B9).
6. A monthly job on the first, 9 AM in each business's zone, sends
   `plan_statement_ready`. The statement itself is computed on request.

A repeat does not need a job: all its plans are created when it is posted.

## 9. Apps (iOS and Android)

Both apps send `biz=1` from the build that carries these screens. Screens follow
the boards; the files are where each lives today.

| Board | iOS (`Features/Plans/`) | Android (`ui/screens/plans/`) |
| --- | --- | --- |
| G1, G2 | `Map/PlansMapView`, `PlansSheetContent`, `PlansListColumn`, `PlanPinView` | `map/PlansMapScreen`, `PlansSheetContent`, `components/PlanPins`, `PlanRows` |
| G3, G5, G7 | The plan detail views and `PlanPinCard` | `detail/PlanDetailScreen`, `PlanGuestContent`, `PlanInContent` |
| G4, G6 | The ask sheet, plus the payment sheet the invoice screens use | `detail/PlanAskSheet`, plus the invoice payment sheet |
| D2, D4 | The Today cards for Plans | `today/PlansTodayCards` |
| D3 | `Host/PlanInviteSheet`, opened for a guest | `detail/PlanInviteSheet` |
| D5 | The after-plan state of the detail | `detail/PlanInContent` |
| B1 to B3 | `Host/PlanComposerRoot`, `PlanDetailsForm`, `PlanPreviewAndPosted` | `host/HostFlowScreen`, `HostDetailsContent` |
| B4 | `Host/PlanRequestsScreen` | `requests/PlanRequestsScreen` |
| B6 | The business page | The business page |

- Notices' buttons: "See the plan" opens the plan; there is no pay button on a
  notice.
- Links: a business's plan link opens G3. A business's own link carries its
  token; the app passes it back as `via`.
- Every new string, test id and accessibility label matches across the two apps,
  as the Android guide requires.
- Both stores require card payment, not in-app purchase, for a service used in
  person (the proposal quotes both rules).

## 10. Web

- The share page (`frontend/apps/web/src/app/(site)/plans/[id]/page.tsx`) draws
  D6 for a business's plan.
- The business's desk gains Plans under `app/business/[id]/`: a list of its
  plans, posting (B1 to B3 on a wide screen), the roster (B4) and the statement
  (B5).
- Guests do not join on the web. Plans screens for guests on the web stay "later",
  as decided on October 27.

## 11. Funnel and the statement

### 11.1 Funnel

New `FunnelEvent` types, each with `plan_id`, `kind` and `business` (true or
false) in its meta: `plan_pay_started`, `plan_paid`, `plan_pay_failed`,
`plan_refunded`, `plan_checked_in`, `plan_business_posted`. `plan_requested` and
`plan_accepted` gain `way_in`. The admin funnel report (`funnelReport.js`) gains a
business block: plans posted, guests by way in, new guests, refunds, paid totals
and the card fees Pantopus absorbed.

### 11.2 The statement

The statement is the business's shared one (shared contract, section 5.4), which
lists every kind of sale. The Plans figures below are its `plan_spot` part. Where
the two differ the shared contract decides, including the month a sale counts in
(the month it was paid). The Plans part is computed from `PlanRequest` rows of the
business's plans.

```json
{
  "month": "2026-11",
  "headline": { "pantopus_guests": 38, "pantopus_new": 31, "pantopus_fee_cents": 10260, "per_guest_cents": 270 },
  "totals": { "guests": 142, "plans": 20, "paid_cents": 255600, "came_back": 68, "pantopus_fee_cents": 19620, "card_fee_cents": 8549, "paid_out_cents": 227431 },
  "by_way_in": [{ "way_in": "map_list", "guests": 17, "new": 15, "basis": "pantopus", "rate_pct": 15, "fee_cents": 4590, "card_fee_cents": null }],
  "new_from_pantopus": [{ "first_name": "Priya", "plan_title": "Beginner clinic", "starts_on": "2026-11-07", "way_in": "map_list", "paid_cents": 1800, "fee_cents": 270 }]
}
```

A guest counts once per paid request. "New" is `new_to_business`. "Came" on the
proof line means checked in; the statement counts paid guests.

## 12. Who builds what

The [build plan](04-build-plan.md) has the order, the sessions and the checks.
In short: the server leads each step and merges first; the web share page and
desk go with the server; iOS and Android follow in parallel against the merged
server.

## 13. Done when

For each step, in the real apps against a local server and database, with test
payments:

1. A neighbor hosts, asks, is accepted and leaves a plan exactly as today, with
   `plans_business` on and off. The old app build sees no business's plan.
2. A business's staff member posts a paid plan; a guest on the other phone finds
   it on the map and in the list, pays, is in, gets the reminder and the chat.
3. The guest leaves inside the window and the refund shows on the test payment.
   A second guest leaves after it and gets none.
4. The business cancels and every guest is refunded.
5. A full plan: a third guest waits, a spot opens, they pay inside the hold.
6. Two guests join by different ways in; the roster and the statement show each,
   with the right rate, and the payout matches the statement to the cent.
7. The filter and the fold behave as P3 shows.
8. The share page shows the place and price for the business's plan and only the
   area for a neighbor's.
9. Everything above survives a relaunch, and reads the same on iOS, Android and
   the web desk.

Not checkable locally, to be named in each PR: real cards, real payouts to a
bank, pushes on physical phones, the store review.

## 14. The founder's steps

Only the founder does these.

1. Confirm D1 to D6 and C1 to C9.
2. A lawyer's read on businesses hosting children's sessions, before
   `plans_business_kids` goes on.
3. An accountant's answer on sales tax for classes in Washington.
4. A lawyer's read of the Washington rule on bar promotions, before bars are
   invited.
5. One real charge, refund, delayed payout and bank payout on the live payment
   account, which the release checklist still lists as founder checks.
6. Approve each migration's merge, since merging applies it to production.
7. Turn `plans_business` on for test accounts in staging, then for the first
   businesses, then for everyone.
8. Update the privacy policy, the data inventory
   (`docs/compliance/privacy-data-inventory.md`) and the store privacy labels
   before the switch goes on for real people.

## 15. Open questions

- How long the payment company lets a charge wait before its payout. A paid plan
  can be 60 days out; if the limit is shorter, the days-ahead limit for paid plans
  drops to match.
- Chargebacks. Today's invoice flow decides who bears a disputed charge; this
  contract follows it, and the build confirms what that is.
- Whether deleting a business with unpaid-out plan payments is refused. The
  account-deletion rules and their test decide; a new reference to `User` must not
  break them.
- Answered: neither app sends `place_id` when a plan is posted. The server
  accepts it as `place.place_id` since step 1; sending it is one line in each
  app, in the step 2 app work.
- Answered: a `self_attested` business shows "Verified" nowhere today.
- Answered: deleting a business account deletes its plans; deleting the staff
  member who posted one leaves the plan with the business. Before paid spots, a
  business with unpaid plan money must not be deletable.
- A backend rolled back to a build from before step 2 would show a business's
  plan as a neighbor's, to every app. Before rolling back that far, cancel the
  business plans that are open.
- Whether staff (the role) should post or run plans by default (B2).
- `way_in: business_page` is taken on the app's word in step 2. Nothing depends
  on it while plans are free. Before step 3 it must be checked on the server, or
  it moves to the Pantopus rate.
- A block between a guest and one team member personally is not applied to the
  business's notices to that member. The lists already hide such a guest from
  that member.
- The team's lists carry a guest's account id, which the app needs to invite or
  answer them. A team member could use it to open that person's profile.
- Whether people who book and cancel repeatedly need a limit. The first build
  counts refunds and absorbed card fees and sets no limit.
