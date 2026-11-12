# The four shared pieces: the contract

November 11, 2026 · Read against master `e3c79b6791`. Nothing here is built.
The founder approved the four pieces and the one new table on November 11.

This is what the server, the web and the apps build against. The reasons are in
[the four pieces](00-the-four-pieces.md); the map is [the architecture](01-architecture.md).

## 1. Calls this contract makes

Each is open until the founder confirms it.

| | Call | Value |
| --- | --- | --- |
| S1 | Request shapes | No shipped request changes. New features send `acting_as: { "business_user_id" }`. Plans keeps `host_as`, as its contract is written |
| S2 | A business location's map id | Set only by the owner's own pick or confirmation. Never guessed |
| S3 | Who brought a customer, by feature | The table in section 4.3 |
| S4 | The first meeting decides | `first_basis` is written once and never changed |
| S5 | A person can hide, not erase | Hiding removes them from the business's list. The row stays so a fee is never charged twice for the same person |
| S6 | Invoices keep their payment type | An invoice payment stays `gig_payment` in `payment_type`; the new `sold_type` says `invoice`. Changing the old value would touch every reader |
| S7 | The statement is by the day of sale | A sale counts in the month it was paid. Payouts are listed by the day they were sent |
| S8 | Who reads the customer list | `insights.view`. The statement needs `finance.view`. No new permission |
| S9 | Chat alone makes no customer | A row is written when something is paid, booked or joined. Writing to a business is not a dealing |

## 2. Piece 1: acting for a business

### 2.1 The helper

`backend/services/businessActing.js`

```
actingForBusiness({ businessUserId, actorUserId, permission, needsVerified = false })
```

Answers one of:

```json
{ "ok": true,
  "business": { "id": "…", "name": "…", "username": "…", "verified": true },
  "actor": { "user_id": "…", "role_base": "admin" } }
```

```json
{ "ok": false, "status": 403, "code": "not_your_business", "error": "You're not on this business's team." }
```

| Refusal | Status | When |
| --- | --- | --- |
| `business_not_found` | 404 | No such business account |
| `not_your_business` | 403 | No active membership |
| `not_allowed` | 403 | On the team, without this permission |
| `business_not_verified` | 403 | `needsVerified`, and the status is not `document_verified` or `government_verified`, or the page is not published |
| `business_check_unavailable` | 503 | A lookup failed. Never treated as yes |

It wraps `checkBusinessPermission` in `backend/utils/businessPermissions.js`; the
permission logic is not copied.

### 2.2 The rule that goes with it

- The business is the public author. Author fields carry the business's
  account.
- The staff member's id is saved where the feature has a place for it
  (`host_user_id` on a plan, the sender on a chat message) and is sent only to
  the business's own team.
- One audit line per action, through `writeAuditLog`, named `<feature>.<verb>`.

### 2.3 Who uses it

| Feature | When |
| --- | --- |
| Creating an invoice | In phase A, as its first user |
| Plans, the claim routes | From their first build |
| The statement and the customer list | From their first build |
| Posts, tasks, scheduling, chat, the other invoice routes | When each is next changed. Not before |

### 2.4 Done when

- An invoice is created through the helper and no other check, and reaches the
  customer as it does today.
- Each refusal above is reached by a real request on a local backend.
- A staff member's name or id appears in no response a guest receives.

## 3. Piece 2: one identity for a place

### 3.1 The key

`place_ref`, text, one of:

| Form | Pattern | Means |
| --- | --- | --- |
| Named place | `osm:(node\|way\|relation)/<digits>` | An element of the places index. The form the pickers and Moments already use |
| Business location | `loc:<uuid>` | A `BusinessLocation` row |
| Address | `addr:<64 hex>` | An `address_hash`, the fingerprint `HomeAddress` and `BusinessAddress` both carry |

### 3.2 Data

`BusinessLocation` gains:

| Column | Type | Meaning |
| --- | --- | --- |
| `place_ref` | `text`, checked against the named-place pattern | The place on the map this location is. Null until known |
| `place_ref_source` | `text`: `owner_pick`, `owner_confirmed` | How it was learned |
| `place_ref_at` | `timestamptz` | When |

An index on `place_ref` where it is not null. `Plan` gains `place_ref` and
`business_location_id` in the Plans contract.

### 3.3 The service

`backend/services/placeRefs.js`

| Function | Answers |
| --- | --- |
| `parsePlaceRef(text)` | The form and its id, or null |
| `refsOfLocation(locationId)` | `{ loc, addr, osm }` for a business location; `osm` only when set |
| `locationsAt(ref)` | The published businesses' active locations at this named place or address |
| `samePlace(a, b)` | True when two keys are known to be one place |

### 3.4 Rules

- `locationsAt` never answers with a location whose type is
  `home_based_private`, nor one of an unpublished business.
- An `addr:` key is never sent to an app and never appears in a link.
- Nothing here reads `Home` or `HomeAddress`. The home check stays where it is,
  in the business address check.
- A named place with no claimed business answers with nothing. Unclaimed
  listings are step 5 of the business file.

### 3.5 Done when

- A plan posted at a business location carries all three: the location, its
  named place when known, and its own copy of the name and point.
- `locationsAt` for a named place answers with the business that picked it, on
  a local backend, and with nothing for a home-based business.

## 4. Piece 3: the customer record

### 4.1 The table

```sql
CREATE TABLE public."BusinessCustomer" (
  business_user_id   uuid NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  first_met_at       timestamptz NOT NULL,
  first_feature      text NOT NULL CHECK (first_feature IN ('invoice','plan','booking','task')),
  first_way_in       text,
  first_basis        text NOT NULL CHECK (first_basis IN ('pantopus','own')),
  brought_by_user_id uuid REFERENCES public."User"(id) ON DELETE SET NULL,
  last_activity_at   timestamptz NOT NULL,
  last_feature       text NOT NULL,
  paid_count         integer NOT NULL DEFAULT 0,
  paid_cents         bigint  NOT NULL DEFAULT 0,
  first_paid_at      timestamptz,
  last_paid_at       timestamptz,
  hidden_at          timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_user_id, user_id),
  CHECK (business_user_id <> user_id)
);
```

- Indexes: `(user_id)`; `(business_user_id, last_activity_at DESC)`.
- Row security on; no grant to `anon` or `authenticated`; all access through
  the server, as `AppealPacketPurchase` is set up.
- Both links cascade, so deleting either account removes the rows and the
  account-deletion list needs no entry. No link to `Home`.

### 4.2 Writing it

One database function, `record_business_contact`, called through
`recordBusinessContact` in `backend/services/businessCustomers.js`:

```
recordBusinessContact({ businessUserId, userId, feature, wayIn, basis, broughtByUserId, at })
```

- No row: insert, with the first-meeting fields.
- A row: update `last_activity_at` and `last_feature` only. The first-meeting
  fields are never rewritten (S4).
- `paid_count`, `paid_cents`, `first_paid_at` and `last_paid_at` are counted
  again from the business's captured `Payment` rows from this person each time,
  so a repeated call cannot count a sale twice. A full refund takes the sale
  back out.
- It never throws into the caller. A failure is logged; the sale stands.

### 4.3 Who calls it, and who brought the person

| When | `feature` | `first_basis` if this is the first meeting |
| --- | --- | --- |
| An invoice is paid (`businesses.js`, where the invoice becomes `paid`) | `invoice` | `own`. A business invoices people it already knows |
| A plan spot is paid, or a free business plan is joined | `plan` | From the Plans way in (its contract, section 6.2) |
| A booking is made with a business (`bookingService.js`) | `booking` | `own` when the person came by the business's own link; `pantopus` when they came from a Pantopus list |
| A business is chosen for a task (`Gig.accepted_by`) | `task` | `pantopus`. The task board brought them together |

### 4.4 The first fill

One script, run once per database: read paid invoices, bookings and accepted
tasks oldest first and call the same function. On production it is the
founder's step; the script prints what it would write before it writes.

### 4.5 Reading it

| Reader | What it gets |
| --- | --- |
| `isNewToBusiness(businessUserId, userId)` | True when there is no row. The Plans fee uses this, not its own count |
| `knownPeople(businessUserId)` | Replaces the four reads in `knownInvoiceRecipients`, keeping its block and unpublished rules. The same people, plus anyone the new record adds |
| `GET /api/businesses/:businessId/customers` | The list for the business (below) |
| `GET /api/users/me/businesses` | For a person: the businesses that hold a record of them |
| `POST /api/users/me/businesses/:businessUserId/hide` | Sets `hidden_at` |

A customer, as a business's staff receive it:

```json
{ "user_id": "…", "first_name": "Priya", "first_met": "2026-11", "way_in": "map_list",
  "brought_by": "pantopus", "paid_count": 3, "last_activity": "2026-11-07" }
```

No last name, address, distance, phone or email. Hidden people are left out.
A person who has blocked the business is left out and gets no row from then on.

### 4.6 Done when

- An invoice paid on a local backend writes the row; paying a second writes no
  second row and the count reads 2; refunding one reads 1.
- A person with a paid invoice from a business is not "new" in that business's
  first plan.
- Deleting the person's account removes the row. Deleting the business's does
  too.
- The customer list, read as staff, holds none of the five private fields.

## 5. Piece 4: the sale and the fee

### 5.1 Data

`Payment` gains:

| Column | Type | Meaning |
| --- | --- | --- |
| `sold_type` | `text`: `task`, `tip`, `invoice`, `plan_spot`, `booking`, `package`, `cancellation_fee` | What was sold |
| `sold_id` | `uuid` | The thing's own id: the invoice, the plan request, the booking |
| `fee_pct` | `numeric(5,2)` | The rate that applied, saved |
| `fee_basis` | `text`: `pantopus`, `own` | Why that rate |
| `payout_after` | `timestamptz` | The earliest the payout may be sent. Null means the 48 hours after capture that apply today |

All nullable. An index on `(payee_id, payment_succeeded_at)` if none serves the
statement. Existing rows are filled once: invoices from the invoice id in
`metadata`, bookings from `booking_id`, tasks from `gig_id`.

### 5.2 One way to price a sale

`priceSale` in `backend/stripe/stripeService.js`, beside `calculateFees`:

```
priceSale({ businessUserId, amountCents, basis = 'pantopus' })
  → { feePct, feeBasis, platformFeeCents, cardFeeBorneBy, amountToPayeeCents }
```

| Basis | Pantopus keeps | The card fee |
| --- | --- | --- |
| `pantopus` | `getEffectiveFeeRate(business)`: 15%, the founding 10%, a verified type's rate, or an override | Paid by Pantopus out of its fee, as today |
| `own` | 5%; nothing for a founding business in its founding year | Paid by the business: the amount the card company reports for the charge |

Invoices, tasks and bookings keep calling it with `pantopus`, so nothing they
charge changes. Plans is the first caller of `own`.

### 5.3 When the payout goes

The transfer job sends a payout when the cooling-off has ended **and**
`payout_after`, when set, has passed. A plan sets it to 48 hours after the plan
ends. Nothing else sets it yet.

### 5.4 The statement

`GET /api/businesses/:businessId/statement?month=YYYY-MM`, behind
`business_statement`, for staff with `finance.view`.

```json
{
  "month": "2026-11",
  "headline": { "pantopus_customers": 38, "pantopus_new": 31, "pantopus_fee_cents": 10260 },
  "totals": { "sales": 142, "customers": 97, "paid_cents": 255600, "refunded_cents": 3600,
              "pantopus_fee_cents": 19620, "card_fee_cents": 8549, "paid_out_cents": 227431 },
  "by_feature": [ { "sold_type": "plan_spot", "sales": 120, "paid_cents": 216000, "pantopus_fee_cents": 16200 },
                  { "sold_type": "invoice", "sales": 22, "paid_cents": 39600, "pantopus_fee_cents": 3420 } ],
  "by_way_in": [ { "way_in": "map_list", "basis": "pantopus", "rate_pct": 15, "customers": 17, "new": 15, "fee_cents": 4590 } ],
  "new_from_pantopus": [ { "first_name": "Priya", "what": "Beginner clinic", "on": "2026-11-07",
                           "way_in": "map_list", "paid_cents": 1800, "fee_cents": 270 } ],
  "payouts": [ { "sent_on": "2026-11-10", "cents": 61200 } ]
}
```

- Sales are `Payment` rows paid to the business in the month (S7).
- "New" and the way in come from `BusinessCustomer`.
- The Plans statement in the Plans contract (section 11.2) is this one's
  `plan_spot` part.

### 5.5 Done when

- An invoice paid after this build has `sold_type = 'invoice'`, its `sold_id`,
  a rate and `pantopus` as the basis, and its amounts are to the cent what they
  are today.
- The statement for a month adds up: paid, less refunds, less both fees, equals
  paid out plus what is still waiting.
- A payment with `payout_after` in the future is not sent by the transfer job;
  one without is sent as today.

## 6. Notices

None. The four pieces send nothing to anyone. The features on top of them do.

## 7. What the apps see

- With every switch off: no response changes.
- `business_statement` on: the statement and the customer list are new routes;
  only new screens call them.
- Old app builds never call the new routes and are sent no new field on an old
  one.

## 8. Open questions

- Whether a post saves the venue picker's id today. Moments does. If a post
  does not, the build adds `place_ref` to `Post`, an added column.
- Whether the index on `Payment` that the statement needs already exists.
- How a booking records that the person came by the business's own link. If it
  does not, bookings start as `own` and the rule in 4.3 is revisited when
  scheduling is switched on.
- The card company's fee for a charge is known only after capture. Where a
  payment's final business amount is shown before then, the wording says
  "about".
