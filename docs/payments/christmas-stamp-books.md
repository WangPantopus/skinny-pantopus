# Christmas stamp books

Implementation proposal approved November 7, 2026. This change is **off by default** (`MAIL_STAMPS_ENABLED`); it does not configure or activate hosted billing.

## Product contract

- Three free sends per personal account, granted once. Existing/scheduled cards are not charged retroactively.
- One digital stamp sends one new Christmas card to one recipient, including cards by email or share link. A reply uses the existing free reply/messaging flow. Receiving and ordinary letters stay free.
- Books: 5 stamps / US$2.99; 20 / US$7.99; 50 / US$14.99. These are one-time consumable purchases, not subscriptions. Native clients display the store's localized price; configure the US prices above in each store.
- Purchased stamps never expire, are shared across the account's devices and web, and are not cash or transferable. This is digital delivery, not postal postage.
- Stamps only send Christmas cards, which can be sent until December 31 ends where the sender lives. Books stop selling when `MAIL_STAMPS_SALES_LAST_DAY` (default `2026-12-26`) ends there, so a late book can still be used: checkout answers 410, `GET /api/mailbox/stamp-books` says `sales_open: false` and the apps hide the books and say so. Balances, receipt confirmation, sending and take-back keep working. Whether leftover stamps later send letters or next season's cards is a founder decision; the apps promise only that unused stamps stay in the account.
- Deleting an account deletes its stamp history. Its purchase receipts stay with no owner (`user_id` null), so a late refund can still be recorded against them; they grant nothing to anyone, and the refund sweep skips them.
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

Only the founder applies hosted migrations, adds hosted secrets, changes production configuration or submits store releases. Enter credentials in the existing secret-management system, never Git, PRs or chat. The steps below describe this implementation; they do not claim the provider accounts have been configured.

### 1. Prepare staging and the product records

Apply `supabase/migrations/20261108010000_christmas_stamp_books.sql` to isolated staging and deploy the API, worker and web. Keep production `MAIL_STAMPS_ENABLED=false`. Use the existing staging release process; merging backend changes into master can deploy production and apply migrations automatically, so merging is part of the founder-controlled release.

Create these three products in **both** native stores under bundle/package `com.pantopus.app`. The IDs must match exactly and cannot be replaced with Stripe price IDs.

| Stamps | Product ID | US price | Display name | Short description |
| --- | --- | --- | --- | --- |
| 5 | `com.pantopus.stamps.5` | $2.99 | 5 Christmas stamps | 5 digital stamps for Christmas cards. |
| 20 | `com.pantopus.stamps.20` | $7.99 | 20 Christmas stamps | 20 digital stamps for Christmas cards. |
| 50 | `com.pantopus.stamps.50` | $14.99 | 50 Christmas stamps | 50 digital stamps for Christmas cards. |

These are repeatable consumable books. The apps display native localized prices. One stamp sends one card to one recipient; stamps do not expire. They are not physical postage, subscriptions, gifts of cash or transferable balances.

### 2. Stripe: web checkout

1. Open the existing Pantopus Stripe account. Finish its activation, business, payout and tax settings before live sales. Select a **sandbox/test environment** first.
2. Put that environment's secret key in staging `STRIPE_SECRET_KEY`. The existing web checkout uses server-defined inline prices; **do not create Payment Links or copy Product/Price IDs into the app**. No new client publishable key is needed for this redirect checkout.
3. In **Workbench → Webhooks**, edit the existing destination for `/api/webhooks/stripe` if there is one. Use **Your account**, **Snapshot** payloads, and the existing compatible API version. Keep all existing event subscriptions and add `checkout.session.completed`, `charge.refunded` and `charge.dispute.created`. The route consumes snapshot `event.data.object`; thin events are not supported here. Stripe documents the [destination setup and signing secret](https://docs.stripe.com/webhooks).
4. The staging endpoint is `https://staging-api.pantopus.com/api/webhooks/stripe`; production is `https://api.pantopus.com/api/webhooks/stripe` (the hosts configured in the app release files; confirm the active deployment before registering). Set the **matching destination's** signing secret in `STRIPE_WEBHOOK_SECRET`. Test and live destinations have different secrets. Do not replace an existing destination's secret with one from a second destination or the local CLI.
5. Set staging `FRONTEND_URL=https://staging.pantopus.com` and `MAIL_STAMPS_SANDBOX=true`. Start from the app's stamp-book button, complete a Stripe test payment, then verify delivery in Workbench and the same balance after web reload. Retry the actual completed event: credit must not double. Refund that purchase in the sandbox and verify the book's entire grant is removed once. A generic CLI fixture without Pantopus metadata is not an end-to-end purchase test.
6. For production, keep the live `STRIPE_SECRET_KEY` and its matching webhook secret, `MAIL_STAMPS_SANDBOX=false` and `FRONTEND_URL=https://pantopus.com`. This code charges the fixed USD totals above and does **not** enable Stripe Tax automatic calculation or discount codes. If the chosen sales/tax setup requires automatic collection, add and validate that behavior before accepting those sales; a Dashboard setting alone does not add `automatic_tax` to these sessions.

Checkout currently accepts card payments. Credit is verified through Stripe and the signed webhook even if the buyer closes the return tab, following [Stripe's fulfillment model](https://docs.stripe.com/checkout/fulfillment?ui=full-page). Refunds, including partial refunds, revoke the entire book; use full-book refunds operationally.

### 3. Apple: iOS purchases and App Review

1. In **App Store Connect → Business**, have the Account Holder complete the Paid Apps Agreement and required banking/tax details. The agreement must be active for review purchases to work. In **Apps → Pantopus → Monetization → In-App Purchases → +**, create the three records above with type **Consumable**. Add their localization, US base price, intended storefront availability and review screenshot. Apple describes [product creation](https://developer.apple.com/help/app-store-connect/manage-in-app-purchases/create-consumable-or-non-consumable-in-app-purchases) and [review prerequisites](https://developer.apple.com/help/app-review/before-submitting-for-review/configure-in-app-purchases/).
2. In **Users and Access → Integrations → Keys → In-App Purchase**, generate an In-App Purchase key. Download its `.p8` once and store it privately. Set `MAIL_STAMPS_APPLE_ISSUER` to the Issuer ID, `MAIL_STAMPS_APPLE_KEY_ID` to the key ID and `MAIL_STAMPS_APPLE_KEY` to the complete PKCS#8 key on both API and worker. The deployment uses `docker run --env-file`, so store it on one line with literal `\n` separators (no wrapping shell quotes); the service converts them back to newlines. Secret managers that inject actual newlines also work. Use the [App Store Server API key](https://developer.apple.com/documentation/appstoreserverapi/creating-api-keys-to-authorize-api-requests), not an APNs key or shared subscription secret.
3. Add a Sandbox Apple Account under **Users and Access → Sandbox**. Test with a physical iPhone and the staging build/API. TestFlight billing is Sandbox; staging must have `MAIL_STAMPS_SANDBOX=true`. Product metadata may take up to an hour to propagate. Confirm purchase, cancellation, interrupted confirmation/relaunch, buying the same book again, account binding and a sandbox refund. The local simulator's unavailable-store screen does not verify these.
4. **For the production binary's review**, use a dedicated Pantopus review login. With public sales still off, put only that login's Pantopus user UUID in both `MAIL_STAMPS_PREVIEW_USERS` and `MAIL_STAMPS_APPLE_SANDBOX_USERS` on the production API/worker. Keep `MAIL_STAMPS_SANDBOX=false`. The first list exposes the actual paid flow before public rollout; the second directs only those Apple accounts to Sandbox. Normal accounts cannot use sandbox receipts. These lists contain Pantopus user IDs, not Apple IDs or emails. Keep review accounts for testing only; their sandbox credits must never become a real customer's balance.
5. Give App Review that dedicated login through its private review-information fields. Explain the path: **Mail → Send a Christmas card → Buy a stamp book**, then buy a book and send a card to the supplied test recipient. Explain three free sends, free receiving/replies, digital delivery, account-shared credits and the review account's Sandbox configuration. Keep it working during review and subsequent reviews.
6. Add all three products and the new iOS app version to the same draft submission. The first purchase of each type must accompany a new app version; see [Apple's submission rules](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase). Choose a controlled/manual release and submit only after sandbox acceptance passes.

This PR uses transaction lookup and periodic refund reconciliation. It does not expose an App Store Server Notifications endpoint; do not put the Stripe URL into Apple's notification fields.

### 4. Google Play: Android purchases

1. In the existing Play Console account, complete the payments profile. Open Pantopus → **Monetize with Play → Products → One-time products** and create the three products above. For each, create one **Buy** purchase option (for example, purchase option ID `standard`), set US/local prices and availability, and activate the option. Keep the option backward compatible; leave multi-quantity purchases disabled. Do not use Rent, subscriptions, pre-orders or extra offers for this launch. See the [current one-time product console flow](https://support.google.com/googleplay/android-developer/answer/16430488?hl=en).
2. In the existing Google Cloud project, enable **Google Play Developer API** and create a server service account. In **Play Console → Users and permissions**, invite its email and limit app access to Pantopus. Grant the billing permissions **View financial data, orders, and cancellation survey responses** and **Manage orders and subscriptions**, as specified in [Google's API setup](https://developers.google.com/android-publisher/getting_started). A general Cloud IAM role alone does not grant Play access.
3. Privately create/download its JSON key and set the complete compact, single-line JSON as `MAIL_STAMPS_GOOGLE_SERVICE_ACCOUNT` (no wrapping shell quotes) on API and worker. Set `MAIL_STAMPS_GOOGLE_PACKAGE=com.pantopus.app`. This credential is server-only; it does not belong in the APK or `google-services.json`.
4. Add the test Google account under **Settings → License testing**, and also add it to the internal-testing track. Upload/install the staging-API build with package **`com.pantopus.app`**. The usual local debug build has `.debug` appended and cannot test these production-package products. Use a Play-enabled phone/emulator signed into the license tester, opt into the track, and verify the purchase sheet says it is a test purchase. Track membership alone does not prevent real charges; see [Google's billing test guide](https://developer.android.com/google/play/billing/test).
5. With staging `MAIL_STAMPS_SANDBOX=true`, test approved, declined and pending payments, app termination after payment, relaunch recovery, a second purchase of the same book, switching Pantopus accounts, and refund/revoke in Order management. Stamps must commit before consumption, and retries must not grant again. Verify consumption so the product can be bought again.
6. Release a production-API build with the same package through the existing store release process after acceptance. Production uses `MAIL_STAMPS_SANDBOX=false`; license-tester receipts are intentionally rejected there. Keep license-tester billing checks on staging.

No Play Real-time Developer Notifications/Pub/Sub endpoint is implemented in this PR. Refund detection uses the existing worker's provider sweep; it is not instantaneous.

### 5. Configuration and launch order

| Setting | Isolated staging | Production before public launch |
| --- | --- | --- |
| `MAIL_STAMPS_ENABLED` | `true` for acceptance | `false` |
| `MAIL_STAMPS_SANDBOX` | `true` | `false` |
| `MAIL_STAMPS_PREVIEW_USERS` | optional | dedicated review/pilot Pantopus UUIDs only |
| `MAIL_STAMPS_APPLE_SANDBOX_USERS` | unnecessary | dedicated Apple review Pantopus UUIDs only |
| `MAIL_STAMPS_GOOGLE_PACKAGE` | `com.pantopus.app` | `com.pantopus.app` |
| `MAIL_STAMPS_SALES_LAST_DAY` | unset (`2026-12-26`), or an earlier date to test the closed state | unset (`2026-12-26`) |
| `FRONTEND_URL` | `https://staging.pantopus.com` | `https://pantopus.com` |
| `LAUNCH_FEATURES` | preserve existing values; include `mailbox,holiday_cards` | same; `card_table` is additionally required for sending by link |

All `MAIL_STAMPS_*` settings and provider credentials belong on both API and worker. Set comma-separated UUID lists with no wildcard. The review exception changes only Apple verification for its listed accounts; it does not switch Stripe or Google to test mode. Preview is opt-in server configuration and defaults to nobody. Existing balances, receipt confirmation and refund reconciliation remain available when public sales are off.

Release sequence:

1. Finish green PR checks and the local app checks below. Configure and pass the **real provider sandbox** matrix on isolated staging.
2. Founder approves the hosted migration/deploy, preserving unrelated hosted configuration. Deploy API, worker and web with public sales off. Enable only designated review accounts as above.
3. Complete native review/testing and release the updated iOS and Android builds. Verify the versions available to users. Old clients will receive an update-required response when paid sending is enabled.
4. Use a separate founder-controlled live pilot account in `MAIL_STAMPS_PREVIEW_USERS` (not in Apple's sandbox list) for one live purchase/refund per provider. Verify shared balance, consumption, webhook delivery and reconciliation. Only the founder performs the real charges/refunds.
5. After those checks pass, set `MAIL_STAMPS_ENABLED=true` on API and worker. This is one shared rollout across web, iOS and Android, not a web-only switch. Keep the reconciliation worker running and monitor its retry warnings/backlog. Checks run every 10 minutes but an individual purchase is normally eligible only once per hour, and volume/provider failures can delay refunds further.
6. To stop sales/paid sending, set `MAIL_STAMPS_ENABLED=false` and clear `MAIL_STAMPS_PREVIEW_USERS`. Existing credits and received cards remain; the old free daily sending rule resumes. Storefront deactivation is separate, and in-flight native receipts remain recoverable.

For each provider, acceptance must show: all three correct books; one payment grants exactly one book; retry does not duplicate; cancellation/pending does not credit; interrupted confirmation recovers; the other account cannot redeem the receipt; a consumed book can be repurchased; web/iOS/Android show the same saved balance; a refund after spending creates the expected debt; receiving and replying remain free. No new unit tests are needed for this operational acceptance matrix.

## Validation record

Local validation on November 7, 2026, using isolated Supabase/API and synthetic sender/recipient accounts:

- Web: all three book prices, unavailable-checkout handling, full send, take-back, zero/returned balance and reload persistence exercised in the browser.
- iOS simulator: authenticated composer, shared balance, unavailable App Store state, full send (1 → 0), take-back (0 → 1), Send another card and the same one-stamp balance after a cold relaunch verified. The earlier Device Hub window-control issue was resolved.
- Android emulator: authenticated composer, shared balance, unavailable Google Play state, full send (1 → 0), take-back (0 → 1), and correct balance after force-stop/relaunch verified.
- Real local API/database: three-credit grant, same-request retry, concurrent overspend rejection, old-client refusal, claim/read without recipient charge, 50-send cap, expiry return, duplicate/cross-account purchase rejection, terminal refund/debt handling, ordinary-mail exemption and authenticated direct-write denial passed. Purchase/refund accounting was exercised with synthetic SQL transactions; this does not verify provider payments.
- Sales disabled: balances and confirmation endpoint remain available; new checkout returns 404.
- Recipient browser: opened the received card and read the note; its balance remained 3, and its sending row retained the ordinary free daily behavior while public stamp sales were off.
- Review preview with public sales off: designated sender sees `postage_enabled=true` and its book panel in the browser; ordinary recipient sees `postage_enabled=false` and checkout is denied. Both retain the correct independent balance. Preview does not bypass provider verification.
- Web typecheck and changed-component lint passed. Android `ktlintCheck`, `detekt` and debug build passed. iOS simulator build, strict SwiftLint and SwiftFormat checks passed. The broader `make lint` design-token guard still reports the repository's existing literal backlog; this change adds no token-guard findings.
- Existing targeted backend tests: 44 passed, including a rerun after the review-account changes. The full backend/privacy CI job passed; the earlier local gig lifecycle timing failure also passed all 240 tests on focused rerun. No new unit tests were added.

Not verified: Stripe/StoreKit/Play sandbox or live purchases, provider refunds, physical devices and hosted migration/deployment. Keep stamp sales off until the founder setup and release checks above are complete. Raw operator logs, synthetic login files and receipt fixtures remain outside Git.
