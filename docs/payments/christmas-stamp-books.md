# Christmas stamp books

Implementation proposal approved November 7, 2026. This change is **off by default** (`MAIL_STAMPS_ENABLED`); it does not configure or activate hosted billing.

## Product contract

- Three free sends per personal account, granted once. Existing/scheduled cards are not charged retroactively.
- One digital stamp sends one new Christmas card to one recipient, including cards by email or share link. A reply uses the existing free reply/messaging flow. Receiving and ordinary letters stay free.
- Books: 5 stamps / US$2.99; 20 / US$7.99; 50 / US$14.99. These are one-time consumable purchases, not subscriptions. Native clients display the store's localized price; configure the US prices above in each store.
- Purchased stamps never expire, are shared across the account's devices and web, and are not cash or transferable. This is digital delivery, not postal postage.
- A successful send consumes free stamps first. Failed or retried sends do not consume an additional stamp. Taking a card back before pickup/claim or expiration of an unclaimed invitation returns the original stamp once. Deleting delivered mail does not return it.
- At most 50 new cards per rolling 24 hours, including subsequently withdrawn cards. Existing recipient, block and escrow abuse checks still apply.
- Refunding or disputing a book removes its entire credit grant once. If stamps were spent, a negative paid balance blocks further sending until repaid; receiving/replies remain available. Old provider events cannot reinstate a refunded grant.

## Existing flows and accounting

The existing Christmas composers show stamp balance and book choices. Web opens Stripe Checkout in a separate tab so the draft remains intact. Native apps use StoreKit 2 and Play Billing. Each passes the signed-in account binding to the store. The backend fetches authoritative transaction data from the provider, checks environment/product/account, and records the credit. A client amount or claimed success never grants credit.

`MailStampPurchase` stores the unique provider reference and verified book. `MailStampLedger` is the append-only balance record (welcome, purchase, spend, return, revoke). Both tables and balance/purchase RPCs are service-role-only. The existing `Mail` row's insertion trigger serializes on the sender and deducts a credit in the same transaction as the card. The existing per-card request ID provides send idempotency. There is no new parallel mail table, and the cash wallet and earned collectible stamps are unchanged.

`GET /api/mailbox/cards` advertises `postage_enabled`. Updated composers send `use_stamp: true`; when charging is enabled, older clients receive `CARD_UPDATE_REQUIRED` before spending anything. Turning the flag off returns the old one-card-per-day behavior. Existing received cards, Sent, claims and take-back continue working. Receipt confirmation, balances and refund reconciliation remain available when new sales are disabled.

Endpoints (authenticated):

- `GET /api/mailbox/stamp-books`: balance, server catalog, store account binding.
- `POST /api/mailbox/stamp-books/checkout`: server-priced web checkout, with an idempotency request UUID.
- `POST /api/mailbox/stamp-books/confirm`: provider receipt verification and idempotent crediting. It accepts no credit quantity or price.

Stripe uses the existing signed webhook route for completed checkout and refund/dispute events. Apple and Google transactions are checked directly on confirmation and by `mailStampReconciliation` every 10 minutes (100 oldest eligible purchases per pass, each at least an hour since its last check). Google consumption follows durable crediting on the server, with client consumption/recovery as a fallback. Apple transactions are finished only after backend confirmation; unfinished transactions are retried when the composer opens or resumes. Provider failures leave the transaction recoverable. The scheduled sweep continues to require provider API access; monitor failed provider checks and backlog before expanding volume.

## Founder setup and release

Only the founder applies hosted migrations, adds hosted secrets, changes production configuration or submits store releases. No credentials belong in this public repository.

1. Apply `supabase/migrations/20261108010000_christmas_stamp_books.sql` to staging, then production after staging validation. Deploy the API and worker with stamp sending disabled.
2. Configure three **consumable** products on App Store Connect and Google Play, all under bundle/package `com.pantopus.app`: `com.pantopus.stamps.5`, `com.pantopus.stamps.20`, `com.pantopus.stamps.50`. Disable multi-quantity on Google. Add descriptions, prices, screenshots and review information, and obtain store approval.
3. Configure backend/worker secrets through the existing secret-management process:
   - Existing `STRIPE_SECRET_KEY`, Stripe webhook secret and endpoint; use the matching test/live key. Web checkout uses inline server prices, so Stripe product IDs are not needed.
   - `MAIL_STAMPS_APPLE_ISSUER`, `MAIL_STAMPS_APPLE_KEY_ID`, `MAIL_STAMPS_APPLE_KEY` (PKCS#8 P8 key, with actual newlines) for the App Store Server API.
   - `MAIL_STAMPS_GOOGLE_SERVICE_ACCOUNT` (JSON service-account credentials) with Android Publisher access to this app. `MAIL_STAMPS_GOOGLE_PACKAGE` defaults to `com.pantopus.app`; do not point production at the debug package.
   - `MAIL_STAMPS_SANDBOX=true` for the isolated staging/sandbox environment, `false` for production. Never mix environments. Apple TestFlight uses Sandbox; use the staging API for that billing validation.
   - `FRONTEND_URL` for the web checkout return URL; `MAIL_STAMPS_ENABLED=true` only when launch-ready. `mailbox` and `holiday_cards` must also be in `LAUNCH_FEATURES`. Keep the reconciliation worker running.
4. Validate real Stripe test-mode checkout/webhook retries, StoreKit sandbox and Play license-tester purchases. Verify pending/cancelled purchases, app termination after payment, account switching, consumption, repeated receipts, and refunds after some credits have been spent. Confirm one shared balance across all three apps.
5. Release the updated native apps, verify the supported versions, then enable the backend flag. Test one live purchase and refund per provider under founder control. Check provider payout/tax configuration before accepting live purchases.

The local UI can verify unavailable-store states without credentials; that is not evidence of a completed store payment. Store product setup, sandbox end-to-end payments and live charges are release gates, not implied by a successful build.

## Validation record

Local validation on November 7, 2026, using isolated Supabase/API and synthetic sender/recipient accounts:

- Web: all three book prices, unavailable-checkout handling, full send, take-back, zero/returned balance and reload persistence exercised in the browser.
- iOS simulator: authenticated composer, shared balance, unavailable App Store state, full send (1 → 0), take-back (0 → 1), and Send another card verified. A later cold-relaunch check was interrupted by Device Hub automation losing its window; cold-relaunch persistence remains a release check on iOS.
- Android emulator: authenticated composer, shared balance, unavailable Google Play state, full send (1 → 0), take-back (0 → 1), and correct balance after force-stop/relaunch verified.
- Real local API/database: three-credit grant, same-request retry, concurrent overspend rejection, old-client refusal, claim/read without recipient charge, 50-send cap, expiry return, duplicate/cross-account purchase rejection, terminal refund/debt handling, ordinary-mail exemption and authenticated direct-write denial passed. Purchase/refund accounting was exercised with synthetic SQL transactions; this does not verify provider payments.
- Sales disabled: balances and confirmation endpoint remain available; new checkout returns 404.
- Web typecheck and changed-component lint passed. Android `ktlintCheck`, `detekt` and debug build passed. iOS simulator build, strict SwiftLint and SwiftFormat checks passed. The broader `make lint` design-token guard still reports the repository's existing literal backlog; this change adds no token-guard findings.
- Existing targeted backend tests: 44 passed. Full backend run: 341 suites passed, 1 skipped, 1 failed (a gig lifecycle assertion returned 401 instead of 409); the failing file passed all 240 tests on focused rerun. No new unit tests were added.

Not verified: Stripe/StoreKit/Play sandbox or live purchases, provider refunds, physical devices, hosted migration/deployment, and iOS cold-relaunch persistence. Keep the PR draft and stamp sales off until the founder setup and release checks above are complete. Raw operator logs, synthetic login files and receipt fixtures remain outside Git.
