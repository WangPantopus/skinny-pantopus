# The architecture: one graph

November 11, 2026 · Read against master `e3c79b6791`. Nothing here is built.

This is the map. The two contracts say exactly what is built
([shared pieces](02-shared-pieces-contract.md), [business file](03-business-file-contract.md)),
and the [build plan](04-build-plan.md) says in what order.

## 1. The aim

Every part of Pantopus connects, and a business can do business wherever the
app has a place for it. Three bodies of work get there:

| Work | What it gives | Where it is written |
| --- | --- | --- |
| The business file | Businesses arrive, are found, claim their page and prove who they are. Pantopus knows their public record | [The plan](../business-catalog-claim-plan-2026-11-11.md), [the contract](03-business-file-contract.md) |
| The four shared pieces | One answer each to: who is acting, where, does the business know this person, what was sold | [The four pieces](00-the-four-pieces.md), [the contract](02-shared-pieces-contract.md) |
| Plans with businesses | The first place a business sells inside a neighbor feature | [PR #3964](https://github.com/WangPantopus/skinny-pantopus/pull/3964) |

## 2. What the graph is made of

### The things

| Thing | Stored as | Notes |
| --- | --- | --- |
| A person | A `User` row | |
| A business | A `User` row with `account_type = 'business'`, plus `BusinessProfile` | So a business can already be the one paid, a member of a chat, a reviewer's subject |
| A home | `Home`, with its address in `HomeAddress` | Private. About 100 tables hang off a home |
| A business location | `BusinessLocation`, with its address in `BusinessAddress` | A business has one or more |
| A named place | A map id, `osm:<type>/<id>` | Parks, cafés, shops. Read from the monthly places index, not stored as rows |
| A public record | `PublicBusinessRecord` (new, step 2 of the business file) | A licence, a registration. One row per source record |
| A sale | A `Payment` row | Every card payment in the app |

### The lines

| From | To | The line | Stored in | State |
| --- | --- | --- | --- | --- |
| Person | Business | On its team, with a role | `BusinessSeat`, `BusinessTeam` | Live |
| Person | Business | Follows it | `BusinessFollow` | Live |
| Home | Business | Endorses it for a kind of work | `NeighborEndorsement` | Built, shown with the directory (off) |
| Home | Business | Keeps it as favorite, vendor or blocked | `HomeBusinessLink` | Live |
| Business | Person | Invoiced and was paid | `BusinessInvoice`, `Payment` | Live |
| Person | Business | Booked a time | `Booking` | Built, off |
| Business | Person | Took their task | `Gig.accepted_by` | Built, off |
| Person | Business | Wrote to it | Chat rooms | Live |
| Person | Business | Reviewed it | `Review` | Tied to a task today |
| Business | Location | Works here | `BusinessLocation` | Live |
| Location | Named place | Is this place on the map | `BusinessLocation.place_ref` | **New (piece 2)** |
| Business | Public record | This record is ours | `PublicBusinessRecord.business_user_id` | **New (business file)** |
| Business | Person | Knows them: first met, who brought them, what they paid | `BusinessCustomer` | **New (piece 3)** |
| Sale | The thing sold | What it was for, at what rate and why | `Payment.sold_type`, `sold_id`, `fee_pct`, `fee_basis` | **New (piece 4)** |
| Plan | Business, location | Hosted by, held at | `Plan.business_user_id`, `business_location_id`, `place_ref` | New (Plans) |
| Plan request | How the guest came | The way in | `PlanRequest.way_in` | New (Plans) |

Nothing above needs a graph database. The graph is the tables the app already
has, with four lines added and one way of reading them.

## 3. The four questions every feature asks

```
            a request arrives at a feature
                        │
     ┌──────────────────┼───────────────────┬──────────────────────┐
     ▼                  ▼                   ▼                      ▼
 1. WHO ACTS       2. WHERE            3. KNOWN?              4. THE SALE
 actingFor-        placeRefs           BusinessCustomer       Payment +
 Business()        (place_ref key)     recordBusinessContact  priceSale()
     │                  │                   │                      │
 the business is   one key for an      first met, who         what was sold,
 the public        address, a named    brought them,          the rate, the
 author; staff     place or a          what they paid         basis, when it
 are never named   business location                          pays out
     │                  │                   │                      │
     └──────────────────┴─────────┬─────────┴──────────────────────┘
                                  ▼
                 the business's statement, its customer list,
                 "everything at this place", proof-backed reviews
```

## 4. Where each feature stands

| Feature | 1. Who acts | 2. Where | 3. Known | 4. Sale | To let a business in |
| --- | --- | --- | --- | --- | --- |
| Invoices (live) | Own check | None | Recomputed | Recorded as a task payment | Write the sale columns and the customer record. No screen changes |
| Chat with a business (live) | Own helper | None | None | None | Nothing now. Moves to the helper when touched |
| Plans (designed) | To build | To build | To build | To build | The Plans build, on the four pieces |
| Scheduling (built, off) | Own helper | The location's address | None | Shared payment, typed | Helper, customer record, sale columns; then the switch |
| Catalog checkout (built, refused) | Own check | None | None | Refused by the server | Sale columns; then allow it |
| Tasks for bids (built, off) | Own check | A point | None | Shared payment | Customer record |
| Business posts and replies (live for replies) | Own check | A point and a name | None | None | Piece 2 only |
| Moments (live for people) | None | A venue id | None | None | Piece 2: "at this business" |
| Directory (built, off) | None | The location's point | None | None | The catalog, piece 2, the switch |

## 5. How a business arrives and becomes part of it

1. **Found.** The owner types a name. Pantopus searches its public records and
   the catalog and asks "Is this you?" (business file, steps 2 and 3).
2. **Proved.** A code goes to the phone, the domain or the address an official
   record already lists. Minutes, not days.
3. **Linked.** The page is tied to its public record and to its place on the
   map (piece 2).
4. **Selling.** It invoices, hosts a plan, takes a booking. Each sale is
   recorded the same way (piece 4), by a staff member acting for it (piece 1).
5. **Known.** Each person it deals with becomes a line it can see (piece 3),
   with who brought them.
6. **Read back.** One statement, one customer list, reviews with proof.

## 6. Rules that hold across all of it

1. **Homes stay private.** No public page lists what happens at a home. A
   home's address is never joined to a business, a place page or a record.
2. **People's names stay private.** A business's staff see a first name and
   what was bought. Owner names from public records are used only to check a
   claim.
3. **Staff are never named.** The business is the public author.
4. **Every public fact shows its source and date.** A weak match is never
   published.
5. **Nobody pays to be seen.** No payment or rate changes the order of a list.
6. **The fee is fixed when the person pays**, with its rate and its reason
   saved. Later changes do not touch it.
7. **Money moves only on the payment service's word.**
8. **Additive data only.** Added columns and widened checks, and the tables
   the founder has approved. No applied migration is edited.
9. **Everything new is behind a switch that is off**, and with it off the app
   is exactly today's app.
10. **Nothing is sent to a business or a person** outside the product's own
    notices until the founder decides to.

## 7. The switches

| Switch | Turns on | Needs |
| --- | --- | --- |
| `business_claim` | "Is this you?", the proof steps, the licence lines on a claimed page | Business file steps 2 and 3 |
| `business_file` | The owner's file ("confirm or fix") and expiry alerts | Step 4 |
| `business_statement` | The statement and the customer list for a business, and a person's "businesses that know me" | Pieces 3 and 4 |
| `plans_business`, `plans_business_kids` | Plans with businesses | PR #3964 |
| `business_directory` (exists, off) | Public listings and search | Step 5 |

Pieces 1 and 2, the payment columns and the customer record's writing have no
switch: they change nothing anyone sees.

## 8. New data, in one list

| What | Kind | Approved |
| --- | --- | --- |
| `BusinessCustomer` | New table | Yes, November 11 |
| `PublicBusinessRecord` | New table | **Not yet** |
| `Payment`: `sold_type`, `sold_id`, `fee_pct`, `fee_basis`, `payout_after` | Added columns | Covered by the four pieces |
| `BusinessLocation`: `place_ref`, `place_ref_source`, `place_ref_at` | Added columns | Covered by the four pieces |
| `BusinessVerificationEvidence.evidence_type`: three more values | Widened check | With business file step 2 |
| `Review.paid_customer` | Added column | With step 6 |
| Four switches | Rows in `FeatureFlag` | With each step |
| The Plans columns | In PR #3964 | With Plans |
| A second table or a search service for public listings | Step 5 | **Not yet; decided then** |

## 9. Where files live

- **Nothing in steps 1 and 2** stores files.
- **From business file step 3:** a private storage bucket of its own. One
  prefix holds each source's monthly copy, never changed after it is written.
  One prefix holds the built index the server reads.
- The map-derived index (OpenStreetMap) stays its own file, apart from the
  catalog index. They are joined when read, never merged into one stored
  database, so each keeps its own licence.

## 10. What this does not decide

- Public pages for businesses that have not claimed (step 5).
- Businesses posting in Pulse. The rule today is that they reply only.
- Ads, paid placement or any ranking for money. Rule 5 forbids it.
- Other countries. The catalog covers them; their registers are not read yet.
