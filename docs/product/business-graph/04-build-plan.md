# The build plan

November 11, 2026 · Nothing here is started. No session runs until the founder
says go.

One order for all three bodies of work: the four shared pieces, the business
file, and Plans with businesses ([PR #3964](https://github.com/WangPantopus/skinny-pantopus/pull/3964)).
The ready-to-paste brief for each session is in [the briefs](05-session-briefs.md).

## 1. What people get, phase by phase

| Phase | What changes for people | Earns money |
| --- | --- | --- |
| A. The ground | Nothing visible. Sales and customers start being recorded one way | No |
| B. The contractor file | A crew finds its state record, proves it by a code, and its page shows licence, bond and insurance | Yes: crews reach the 10% founding rate without a hand approval; households see proof before paying |
| C. Plans, steps 1 to 3 | A verified business hosts a plan and sells spots | Yes |
| D. The business's books | The statement, the customer list, and a person's "businesses that know me" | Keeps businesses |
| E. Find your business | Any business finds itself and proves it by domain or by mail | Brings businesses |
| F. The file | "Confirm or fix", more sources, expiry alerts | Keeps businesses |
| G. Plans, steps 4 to 6 | The doors, repeats, the desk on the web | Makes the 15% true |
| H. Listings and reviews | Public listings, search, paid-customer reviews | Later; each needs a decision |

## 2. The order, and why

```
A1 ─ A2 ─ A3 ─ A4          (server, one after another, small)
          │
          ├── B1 ─ B2 ─┬─ B3 web
          │            ├─ B4 iPhone
          │            └─ B5 Android
          │
          └── C  Plans steps 1–3   (its own sessions, from PR #3964)
                    │
                    D1 ─┬─ D2 web ─ D3 iPhone ─ D4 Android
                        │
E1 ─ E2 ─┬─ E3 web ─ E4 iPhone ─ E5 Android      (after B)
         F                                        (after E)
G  Plans steps 4–6                                (after C and D1)
```

- **A comes first** because B, C and D all stand on it, and it changes nothing
  anyone sees, so it carries no risk to ship early.
- **B and C can run side by side** after A. They touch different files: B the
  business create and claim screens, C the Plans screens.
- **D waits for C's first paid plan** only for its Plans lines. It can ship with
  invoices alone, which are live now.
- **E waits for B**, which builds the claim screens E extends.

## 3. Phase A: the ground (server only)

One session, four small PRs in this order. No screen changes, no switch.

| | PR | Contract | Checked by |
| --- | --- | --- | --- |
| A1 | `actingForBusiness` helper, with the invoice-create route as its first user (this phase changes invoices anyway) | [Shared pieces §2](02-shared-pieces-contract.md) | Each refusal reached on a local backend; a crew still sends an invoice from web, iPhone and Android |
| A2 | `place_ref`: the columns on `BusinessLocation`, the service | §3 | A location given a map id by hand answers `locationsAt`; a home-based one does not |
| A3 | `Payment` columns, `priceSale`, the fill of old rows, invoices writing `sold_type` | §5.1 to 5.3 | A $160 invoice paid in the payment provider's test mode pays the crew exactly what it does today, on web, iPhone and Android |
| A4 | `BusinessCustomer`, its function, the invoice call, the first-fill script | §4 | Section 4.6's four checks |

**Traps.**

- The transfer job reads `Payment` on a schedule. A3 must be read against
  `backend/jobs/processPendingTransfers.js` and run with jobs on, locally.
- A new table must pass the schema checks in CI and the account-deletion test.
  `BusinessCustomer` cascades on both accounts and links to no home.
- `priceSale` must give invoices the same cents as `calculateFees` does today.
  Compare both on a table of amounts before changing a caller.
- The first fill on production is the founder's step. The script prints first.

## 4. Phase B: the contractor file

| | Session | Builds | Contract |
| --- | --- | --- | --- |
| B1 | Server | `PublicBusinessRecord`, the loader for Washington and Oregon, the switch | [Business file §3.1, 3.2](03-business-file-contract.md) |
| B2 | Server | Search, claim, the phone code, the page's trust lines, the text sender behind `SMS_PROVIDER` | §3.3 to 3.6 |
| B3 | Web | "Is this you?" in the create wizard and on an existing page; the code step; the three lines on the public page | The boards |
| B4 | iPhone | The same | The boards |
| B5 | Android | The same | The boards |

**Before B2:** the founder has chosen the text-message provider, and five crews
have said whether the phone on their state record is one they answer.

**Checked by:** section 3.7 of the contract, on all three apps, with the real
Washington data loaded locally and a test phone.

**Traps.**

- The loader reads about 160,000 rows three ways. Page it, and never hold a
  whole dataset in memory on the worker.
- The search must never return `private_people`. Select columns by name.
- `backend/routes/businesses.js` matches `/:businessId` for any single word.
  The new `/find` and `/records/search` routes go above it, as `/discover` does.
- The iPhone wizard shows a refusal below the last step's buttons today. Fix
  that first, or the code step's errors will be missed.
- A crew may have several licences under one business number. The claim links
  one record; the page shows every record that shares the business number.

## 5. Phase C: Plans, steps 1 to 3

Built by the Plans sessions from PR #3964's own build plan. What changes for
them because of phase A:

- Posting as a business goes through `actingForBusiness`.
- `place_ref` takes the forms in the shared contract.
- "New to this business" is `isNewToBusiness`, and a paid spot calls
  `recordBusinessContact`.
- The fee is priced by `priceSale`, and the payment carries `sold_type`,
  `sold_id`, the rate, the basis and `payout_after`.

The note for the Plans session that makes these four edits to its contract is
in [the briefs](05-session-briefs.md).

## 6. Phase D: the business's books

| | Session | Builds |
| --- | --- | --- |
| D1 | Server | The statement route, the customer list, a person's list and "hide", the `business_statement` switch |
| D2 | Web | The statement page and the customer list in the business dashboard |
| D3 | iPhone | The same two screens; "Businesses that know me" under Settings |
| D4 | Android | The same |

**Checked by:** a month with two paid invoices and one refund adds up on the
statement; the customer list shows first names only; hiding removes the person
from the business's list and survives a relaunch.

## 7. Phases E to H

- **E. Find your business.** E1 builds the catalog index and stores it. E2 adds
  the merged search and the domain and mail proofs. E3 to E5 extend B's screens.
  The founder creates the bucket first.
- **F. The file.** One server session, then one per app.
- **G. Plans steps 4 to 6.** From PR #3964.
- **H.** Opened by the founder, one decision each.

## 8. Checks that apply to every phase

- Each change is used in the apps it touches: the web in a browser, the iPhone
  app in a simulator, the Android app in an emulator, against a real local
  backend and database. Changes are checked again after a reload or relaunch.
- Where two people are involved, both sides are looked at: the business's staff
  and the customer.
- With every new switch off, the app is today's app. This is checked, not
  assumed.
- Money is checked in the payment provider's test mode to the cent.
- No new unit tests. An existing test that an intended change breaks is updated
  in the same PR.
- Each PR is small, merged by its own session after green CI and the real-app
  check, through the shared merge queue.

## 9. Done means

- A crew in Camas can find its licence, prove it in minutes, and show it.
- A verified business can host a paid plan, and the customer it already had is
  not charged for as new.
- A business can read, for any month, what it sold in every feature, what
  Pantopus kept and why, and who Pantopus brought.
- A person can see which businesses hold a record of them and hide it.
- Letting a business into the next feature needs that feature's screens and
  four calls.

## 10. Not in this plan

Public listings for businesses that have not claimed; search across the
country; businesses posting in Pulse; ads or paid placement; other countries'
registers; sales tax.
