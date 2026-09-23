Accepting a listing offer or trade now holds the listing as `pending_pickup`, and the apps show that hold. The coordinator approved option (a): code only, no migration. There are two commits: backend, then iOS and Android.

## 1. Backend: an accept holds the listing

**Problem.**
- `acceptOffer` and the trade accept wrote `Listing.status = 'reserved'`, and trade completion wrote `'traded'`.
- `listing_status` is `{draft, active, pending_pickup, sold, archived}` (production baseline `20260908234526:667`), so each of those writes failed. Nothing checked the error.
- As a result:
  - an accepted listing stayed `active`, and other buyers could keep making offers on an item already promised;
  - a completed trade left both listings for sale.

**Reproduced** on master's routes (real routers on the retained stack, seller `…0001`, buyers `…0002` and `…0003`):
- The seller accepted an offer: 200, the offer was accepted and the other one declined. But the listing stayed `active` with `active_offer_count` 2.
- A direct write of `'reserved'` fails: `invalid input value for enum listing_status: "reserved"`.
- `…0003` then made a new $38 offer on the promised item: 201, and the count went to 3.

**Change:**
- **`listingOfferService.acceptOffer`:**
  - First holds the listing with a conditional `active → pending_pickup` update, which resets the offer count. A write error fails the accept, and a listing that is no longer `active` gets 409 "Listing is no longer available".
  - Then accepts the offer. If that write fails, the listing goes back to `active` with its count.
  - A failure to decline the other offers is logged.
- **`completeTransaction`:** a failed `sold` write now fails the request and reopens the offer; before, it answered 200.
- **Decline and withdraw:** a failed offer-count write is logged.
- **`tradeService`:**
  - Accept holds every listing in the trade, all or nothing (409 if any is no longer `active`). A failed trade write releases them.
  - Completion marks the listings `sold` (with `sold_at`), not the invalid `traded`. A failure reopens the trade.
  - Cancel releases held listings.
- **`routes/pays.js`:** checkout for an accepted offer accepts a `pending_pickup` listing. `active` stays accepted for offers accepted before this fix; `reserved` could never occur.

**Verified** (same routes with this commit; the trade case also mounts the real trade router):
- **Offers:** an accept puts the listing in `pending_pickup` with count 0 and declines the other offer. A new offer gets 409 "Listing is not accepting offers".
- **Checkout:** the accepted buyer's `POST /api/payments/intent` passes the payable check and reaches PaymentIntent creation. The harness only lets its owner fixture create Stripe objects, so it stops there. Master would refuse with 409 "Listing is not payable".
- **Seller's status control:** it still moves the listing between `active` and `pending_pickup`.
- **Offer completion:** the buyer completes; the offer is `completed` and the listing `sold` with `sold_at`.
- **Trades:** an accepted trade holds both listings, and a buyer offer on either gets 409. Completion marks both `sold` and the trade `completed`.

**Checks:**
- The 17 backend suites that touch the marketplace pass (284 tests).
- `tests/checkoutIntent.test.js` now seeds its accepted-offer listing as `pending_pickup` instead of `reserved`. This intentionally changes what that fixture represents.

## 2. iOS and Android: a held listing reads "Pickup pending"

**Problem.** The listing detail showed a held listing like any other: "Make offer" for everyone but the seller. The server now refuses that offer.

**Reproduced:** NATIVE_BEFORE

**Change:**
- A `pending_pickup` listing shows the existing "Pickup pending" status pill: the My Listings wording, with the clock icon and warning tone.
- For everyone but the seller, the dock's primary button is a disabled "Pickup pending" in place of "Make offer". "Message" stays.
- The seller keeps "View offers".
- Android moves the status pill into a small helper, so `project` stays under detekt's complexity limit.

**Verified:** NATIVE_AFTER

## Web

No change needed:
- Web shows Make Offer / View Offer only for `active` or `reserved` listings, so a held listing already shows neither.
- Its listing page already shows a "PENDING PICKUP" chip.

## For the founder

- **Data check.** `evidence/founder-count-query.sql` in the bundle is read-only. It counts:
  - active listings with an accepted offer;
  - active listings in an accepted trade;
  - completed-trade listings not marked sold;
  - open offers on promised listings.

  On my local stack it returns `1|0|0|1`, which is one of my own fixtures.
- **Product gap, not built.** No route cancels an accepted offer or trade. Today the seller's status control is the only way back to `active`, and the accepted offer stays accepted.

Evidence: `.pantopus-recovery/audits/20260923-stream1-listing-pending-pickup-r1/`, MANIFEST `MANIFEST_SHA`.

**Limits:** local harness, synthetic identities, Stripe test mode only.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
