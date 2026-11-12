# One graph: the four shared pieces (plan, November 11, 2026)

**Status: approved as a direction, not to be built yet.** On November 11 the
founder approved the four pieces, including the one new table, and said the
build waits: the designs, the architecture and the build documents come first,
so the build can start the day the founder says go. Nothing is built.
Read against master `a250ae7824` and the open
[Plans with businesses PR](https://github.com/WangPantopus/skinny-pantopus/pull/3964).
It sits beside the [business file plan](../business-catalog-claim-plan-2026-11-11.md).

## What this is for

The founder's aim: every part of Pantopus connects as one graph, and a business
can do business wherever the app has a place for it. Plans is the first such
place. More will follow.

Each feature that lets a business in has to answer the same four questions:

1. Is this person acting for this business?
2. Where is this happening?
3. Does this business already know this person?
4. What was sold, and what does Pantopus keep?

Today each feature answers them its own way. This plan gives each question one
answer that every feature uses, and builds those answers inside the Plans build
so Plans is the first feature on shared ground.

## The short version

| Question | What exists | What is missing | Size |
| --- | --- | --- | --- |
| 1. Acting for a business | One permission check, used everywhere. Five different ways of asking for it | One helper and one rule for who is shown | Small. No data change |
| 2. Where | Homes and business locations each have an address table, matched by one shared address fingerprint. Named venues carry a map id | Nothing ties a business location to its venue id, and a plan saves neither | Small. Added columns |
| 3. Knowing the person | Worked out again each time from invoices, bookings, tasks and chats | A stored record per business and person | Medium. **One new table** |
| 4. The sale and the fee | One payment table, one fee rate, one refund service, one 48-hour payout wait | The payment doesn't say what was sold or which rule set the fee. A business has no statement | Small. Added columns, one route |

A correction to what I told the founder earlier: I said sales and fees were
separate in each feature. That was too strong. The payment record and the base
fee rate are already shared. The gap is narrower, and it is the last row above.

## The graph in plain words

- **Who:** a person, a home, a business. A business is already a full account,
  so it can sit anywhere a person can: in a chat, on a review, as the one paid.
- **Where:** an address or a named place.
- **Lines between them that exist today:** a person on a business's team; a
  person following a business; a home endorsing a business; a home keeping a
  business as a favorite or vendor; an invoice paid; a booking; a task taken; a
  chat; a review.
- **What is missing is not the lines.** It is the four shared answers that let a
  new feature add its lines cheaply and let everything be read together.

## Piece 1. Acting for a business

**Today.** The check itself is shared: `checkBusinessPermission` in
`backend/utils/businessPermissions.js`, with one list of permissions. Each
feature asks for it differently:

| Feature | How the request names the business |
| --- | --- |
| Posts | `postAs: "business"` with `businessId` |
| Tasks | `beneficiary_user_id`, then `gigs.post` |
| Scheduling | `owner_type: "business"` with `owner_id`, through `assertCanManageOwner` |
| Chat | `canActAsBusiness` and `actingBusinessInRoom` in `chatBusinessAccess.js` |
| Invoices, catalog, pages | The business id in the address of the request |
| Plans, as drafted | `host_as: { business_user_id }`, then `plans.post` |

Each also decides for itself who is shown as the author and what is logged.

**The shared piece.** One helper, `actingForBusiness(req, permission)`:

- Reads the business from the request, in whichever of the shapes above the
  feature already uses.
- Runs the existing permission check. A failed lookup refuses; it never guesses.
- Answers with the business, the staff member and their role, or one of three
  standard refusals: not on the team, not allowed to do this, could not check.
- Writes the audit line the business dashboard already keeps.

One rule goes with it: **the business is the public author, and the staff
member is never named** to anyone outside the team. Posts and chat already keep
this rule. It becomes the rule for every feature.

**What it changes.** New features call the helper. Plans is the first. The
five existing features keep working as they are and move to it when they are
next touched. No request shape changes for any shipped app.

**Needs.** No data change. `plans.post` and `plans.manage` join the permission
list, as the Plans contract already says.

## Piece 2. One identity for a place

**Today.**

- Addresses live in two tables: `HomeAddress` for homes and `BusinessAddress`
  for business locations. Both carry an `address_hash` made by the same
  function, which is how a business address is compared with a home today.
- Named venues carry a map id such as `osm:node/123`. The Plans place picker,
  the post venue picker and Moments all use it, in that one form.
- A plan saves neither. It keeps a name, an address and a point.
- A business location has an address but no venue id, so nothing says "this
  coffee shop on the map is this business".

**The shared piece.** One text key, `place_ref`, with three forms:

| Form | Means |
| --- | --- |
| `addr:<hash>` | An address, by the fingerprint both address tables already carry |
| `osm:<type>/<id>` | A named place from the map index |
| `loc:<id>` | A business's location |

And one small service that, given any of the three, answers with the others it
is known to equal:

- A business location knows its address fingerprint already.
- A business location learns its venue id when the owner picks their place in
  "Find your business" (step 3 of the business file plan), or confirms a
  suggested match. Until then the link is absent, not guessed.

**What it changes.**

- `BusinessLocation` gains `place_ref` (the venue it is, when known).
- `Plan` gains `place_ref` and `business_location_id`. The Plans contract
  already adds both; this plan only fixes the form of the key.
- Posts and Moments keep the venue id they are given, in the same form.
- "Everything at this place" becomes one question: the business there, its
  plans, the posts and Moments tagged there.

**Rule.** A home's address is never part of this. `addr:` keys for homes are
not joined to anything public, and no page lists what happens at a home.

**Needs.** Added columns only.

## Piece 3. Knowing the person

**Today.** There is no record that a business knows a person. Each feature
works it out:

- Invoices: `knownInvoiceRecipients` in `backend/routes/businesses.js` reads
  invoices, bookings, tasks and chats every time.
- The Plans contract adds `new_to_business` and `way_in` on each request, worked
  out from Plans alone. So someone who has paid this business three invoices
  would count as new the first time they join its plan, and the business would
  pay 15% for a customer it already had.
- Reviews are tied to a task, not to having paid.

**The shared piece.** One new table, one row for each business and person:

| Field | Meaning |
| --- | --- |
| The business, the person | The pair |
| First met | When, in which feature, and by which way in |
| Who brought them | Pantopus, or the business's own doing |
| Last activity | When, and in which feature |
| Paid | How many times, how much in all, and when last |

One function writes it, `recordBusinessContact`, called when an invoice is
paid, a plan is joined or its spot paid, a booking is made, or a business takes
a task. Writing to a business does not make a row. Existing invoices, bookings
and tasks fill it once at the start.

**What it gives.**

- **A fair fee.** "New to this business" is one lookup across every feature.
- **The statement** (piece 4) names the customers Pantopus brought.
- **Proof-backed reviews.** A review can require a paid line here. This is
  step 6 of the business file plan.
- **Who a business may invoice or message** becomes one read, not four.
- **Later:** "came back" offers, and anything else that needs to know a
  business's own customers.

**Rules.**

- A business's staff see a first name and what was bought. No address, phone,
  email or last name. The Plans contract's rule 7 becomes the rule everywhere.
- Blocking a business removes the person from its list.
- Deleting an account deletes its rows. The table goes on the account-deletion
  list on the day it is created.
- The record is of dealings that happened. Following or viewing a page creates
  no row.

**Needs.** One new table. **This needs the founder's approval.**

## Piece 4. The sale and the fee

**Today.** More is shared than it looks:

- One `Payment` table holds every card payment: who paid, who is paid, the
  amount, the fee Pantopus kept, the payout.
- One function sets the base rate, `getEffectiveFeeRate`: 15%, the founding
  10%, a verified type's lower rate, or an override.
- One refund service, and one 48-hour wait before a payout.

**What is missing.**

- **The payment doesn't say what was sold.** A task has its own column, a
  booking has another, and an invoice is recorded as a task payment with the
  invoice id tucked in a note. A plan spot would add a fourth way.
- **The payment doesn't say which rule set the fee.** It keeps the amount, not
  the rate or the reason.
- **A business cannot read its own money.** No route shows it what it sold,
  what Pantopus kept and why. The `finance.view` permission exists and nothing
  uses it for a business.
- **Two new rules in the Plans contract are written as Plans-only:** the "own"
  rate (5% plus the card fee), and paying out 48 hours after the event ends
  instead of after the charge.

**The shared piece.**

- `Payment` gains five columns: what kind of thing was sold, its id, the fee
  rate that applied, the fee basis (`pantopus` or `own`), and the earliest time
  the payout may go.
- The fee rule and the payout time become inputs to the shared payment service,
  not branches for Plans. A class booked through scheduling can then use the
  same rule without new money code.
- One statement route for a business, by month, across every feature: what was
  sold, to how many people, how many were new and who brought them, what
  Pantopus kept at which rate, card fees, and what was paid out. The Plans
  statement in the contract becomes its Plans part.

**What it does not change.** No existing payment is rewritten. Old rows have
the new columns empty and are read the old way. Rates stay what the founder has
set; this plan adds no rate.

**Needs.** Added columns and one route. The statement screen is the Plans
contract's board B5, widened to all features.

## How it fits the Plans build

The pieces ride the steps of the Plans build plan. No step is added.

| Plans step | Piece built with it |
| --- | --- |
| 1. Remember the venue | Piece 2: the form of `place_ref`, and the small service |
| 2. A business hosts | Piece 1: the helper, with Plans as its first caller |
| 3. Paid spots | Piece 4: the payment columns and the rule inputs. Piece 3: the table, written when a spot or an invoice is paid |
| 4. The doors | Piece 3 decides "new to this business" |
| 6. The desk on the web | Piece 4: the statement, across features |

Four lines of the Plans contract change:

- Section 5.5: the permission check goes through the helper.
- Section 4.1: `place_ref` takes the forms above.
- Section 4.2: `new_to_business` is read from the shared record, and the fee
  rate and basis are saved on the payment as well as on the request.
- Section 11.2: the statement is the shared one.

The contract's rule "no new table in steps 1 to 4" would change to "one new
table, at step 3".

## What comes after Plans

With the four pieces in place, letting a business into another feature is
mostly that feature's own screens:

| Feature | What it would still need |
| --- | --- |
| Scheduling and classes (built, switched off) | Move its owner check to the helper; its payments already use the shared table |
| Catalog checkout (built, refused today) | The sale columns, then switching it on |
| Tasks for a business (built, switched off) | Already records who was paid; gains the customer record |
| Moments and posts at a business's place | Piece 2 only |
| Business directory (built, switched off) | The business file's catalog, and piece 2 |

## What the founder decides

Decided on November 11: items 1 and 2. Items 3 and 4 stand as this plan
answers them; the founder has not confirmed them one by one.

1. Go ahead with the four pieces inside the Plans build.
2. One new table, for the customer record (piece 3).
3. Whether a customer who first came through an invoice or a booking counts as
   the business's own in Plans. This plan says yes: the business found them.
4. Whether the business statement shows every feature from its first day, or
   Plans first. This plan says every feature, because invoices are live now.

## Not checked

- How many businesses and paid invoices exist in production. The first fill of
  the customer record depends on it.
- Whether shipped app builds send anything that the helper would refuse. The
  plan keeps every existing request shape for that reason.
- The scheduling and task payment paths were read, not run.
- Sales tax and the accountant's read are open in the Plans proposal and stay
  open here.
- This is not legal advice. Keeping a record of a person's dealings with a
  business should be in the lawyer's read with the rest of Plans.
