# Appendix: every PR merged on 2026-09-23 (generated from GitHub)

## Live additions — checked 2026-09-23T23:50:35Z

The187-row table below is the original handoff snapshot on master1a15514cc. These later merges are also done; check both sections before starting a repair. Current master is `b8815ad5095c0e848d1f3f45f36f1195aacdc8e3`. Event times are GitHub-reported; merge SHAs are verified in Git.

| PR | Merged (UTC) | Merge commit | Branch | Title |
|---|---|---|---|---|
| [#389](https://github.com/WangPantopus/skinny-pantopus/pull/389) | 21:09:55 | `cef95ab67864ccca3ca243cc0d936a87d342cc8f` | `claude/stream1-api-offer-error-copy` | fix(api): offer and completion routes stop echoing raw database errors |
| [#391](https://github.com/WangPantopus/skinny-pantopus/pull/391) | 21:47:44 | `61c64f9c1778b9b11fda12dd0cfa4762fff3bef0` | `claude/docs-handoff-2026-09-23` | docs: session handoff and backlog status for 2026-09-23 |

| [#394](https://github.com/WangPantopus/skinny-pantopus/pull/394) | 23:42:23 | `b8815ad5095c0e848d1f3f45f36f1195aacdc8e3` | `claude/coord-merge-batch-4` | Combined reviewed batch: #356, #388, #325, #392 |
| [#356](https://github.com/WangPantopus/skinny-pantopus/pull/356) | 23:42:25 | `29e064edc3b70cc06acd72d568211b1e32ac6218` | via batch4 #394 | Native error copy (C-15) |
| [#388](https://github.com/WangPantopus/skinny-pantopus/pull/388) | 23:42:25 | `0d2e9848f3c0212d8da1d4a2c371df3758f22a54` | via batch4 #394 | Native mail trust chips |
| [#325](https://github.com/WangPantopus/skinny-pantopus/pull/325) | 23:42:25 | `cc3d41f5b14f4ca2cb6cbe56db263462246409a9` | via batch4 #394 | Native mail-task conflict handling and vacation dates |
| [#392](https://github.com/WangPantopus/skinny-pantopus/pull/392) | 23:42:25 | `68b31f2e984f16d456fa5f444fdda666618c946e` | via batch4 #394 | Native business-profile location decode |

## Preserved original snapshot

Check this list before starting any fix: if a matching PR is here, the work is done and on master `1a15514cc`. "via" says how each PR landed: a combined batch, or on its own.

| PR | Merged (UTC) | Via | Branch | Title |
|---|---|---|---|---|
| #199 | 16:51 | batch 1 #353 | `claude/stream3-ios-local-block-state` | fix(ios): keep personal block state on Local profile reopen |
| #200 | 00:29 | serial | `claude/stream2-r06-letter-residency-currency` | fix(residency-letters): stop verifying a letter once the issuer's admission ends (R06) |
| #201 | 00:44 | serial | `claude/stream2-r06-public-letter-status` | fix(web): show revoked or expired residency letters as such on the public checker (R06) |
| #202 | 01:01 | serial | `claude/stream3-connection-request-block-gate` | fix(backend): refuse connection requests across a personal block |
| #203 | 01:25 | serial | `claude/stream3-web-profile-block-follow` | fix(web): hide Follow after a personal block and surface refused follows |
| #204 | 01:37 | serial | `claude/stream1-p06-disputed-capture-freeze` | fix(payments): record a disputed gig capture, then freeze it |
| #205 | 01:43 | serial | `claude/stream2-r06-letter-resident-role` | fix(residency): only resident roles may issue residency letters or passes (R06) |
| #206 | 01:49 | serial | `claude/stream2-r06-letter-issue-reason` | fix(web): show the server's reason when a residency letter or pass cannot be issued (R06) |
| #207 | 03:23 | serial | `claude/stream2-r06-android-letter-issue-error` | fix(android): surface residency-letter issue failures and keep the purpose (R06) |
| #208 | 16:51 | batch 1 #353 | `claude/stream2-r06-ios-letter-issue-error` | fix(ios): surface residency-letter issue failures on the Identity screen (R06) |
| #209 | 05:05 | serial | `claude/stream2-d07-role-change-expiry-payload` | fix(web): keep member role changes independent of the expiry field (D07) |
| #210 | 05:59 | serial | `claude/stream1-android-large-text-dark-sheets` | fix(android): keep gig detail readable at large text and in dark sheets |
| #211 | 05:14 | serial | `claude/stream1-p04-no-show-release` | fix(gigs): release the poster's hold when the worker no-shows |
| #212 | 01:52 | serial | `claude/stream2-hub-home-columns` | fix(hub): read Home coordinates from map_center_lat/lng and fail closed (D09) |
| #213 | 08:07 | serial | `claude/stream3-native-booking-notification-routes` | fix(native): open booking notification links on iOS and Android |
| #214 | 16:51 | batch 1 #353 | `claude/stream3-native-cold-start-link-binding` | fix(native): keep a cold-start deep link for the same account's re-sign-in |
| #215 | 16:51 | batch 1 #353 | `claude/stream3-ios-settings-block-count` | fix(ios): count personal blocks in the Settings Blocked users row |
| #216 | 04:33 | serial | `claude/stream3-booking-invitee-notification-link` | fix(scheduling): send invitees to My bookings, not the host booking detail |
| #217 | 03:29 | serial | `claude/stream2-hub-household-gate` | fix(hub): gate household cards and the primary Home on current access |
| #218 | 07:28 | serial | `claude/stream2-hub-verify-banner-android` | fix(android): show the hub "Verify your address" banner only while claim/verify is pending |
| #219 | 16:51 | batch 1 #353 | `claude/stream2-hub-verify-banner-ios` | fix(ios): show the hub "Verify your address" banner only while claim/verify is pending |
| #220 | 03:33 | serial | `claude/stream2-p3-home-scope` | fix(mailbox): scope phase-3 Home records and map pins to the caller's Homes |
| #221 | 16:51 | batch 1 #353 | `claude/stream3-ios-profile-null-names` | fix(ios): decode profiles whose names are still null |
| #222 | 03:37 | serial | `claude/stream2-p3-record-links` | fix(mailbox): only a Home's household may link or unlink its record mail |
| #223 | 03:42 | serial | `claude/stream2-p3-mail-columns` | fix(mailbox): phase-3 own-mail readers read existing Mail columns |
| #224 | 16:51 | batch 1 #353 | `claude/stream3-ios-applock-offer-after-deep-link` | fix(ios): show the app-lock offer after a replayed deep link lands |
| #225 | 03:46 | serial | `claude/stream2-mailday-settings-save` | fix(mailbox): Mail Day settings save more than once |
| #226 | 04:43 | serial | `claude/stream2-mailday-settings-save-error` | fix(web): show why a Mail Day settings save failed |
| #227 | 04:49 | serial | `claude/stream2-home-delete-reason` | fix(web): keep the server's reason when a Home delete is refused |
| #228 | 03:51 | serial | `claude/stream2-hub-today-calendar` | fix(hub-today): pickup reminders read the caller's authorized calendar |
| #229 | 04:15 | serial | `claude/stream1-bid-block-gate` | fix(gigs): refuse bids across a personal block |
| #230 | 04:20 | serial | `claude/stream2-hub-mail-counts` | fix(hub): count Home and personal mail with the columns Mail has |
| #231 | 08:58 | serial | `claude/stream3-android-dm-safety-failure-alerts` | fix(android): tell the user when a DM block or report fails |
| #232 | 03:55 | serial | `claude/stream3-blocked-viewer-profile-search` | fix(privacy): hide a blocker's profile and search entry from the person they blocked |
| #233 | 04:02 | serial | `claude/stream2-v2-mail-item-access` | fix(mailbox): privacy fix — v2 mail routes check the caller may read the mail |
| #234 | 04:06 | serial | `claude/stream2-party-join-home` | fix(mailbox): privacy fix — only a party session's household may join it |
| #235 | 04:11 | serial | `claude/stream1-account-delete-money-guard` | fix(accounts): keep account deletion from erasing payments in flight |
| #236 | 16:51 | batch 1 #353 | `claude/stream3-ios-account-deletion-signout` | fix(ios): end the session plainly after the account deletes itself |
| #237 | 04:24 | serial | `claude/stream1-schema-drift-reads` | fix(gigs,ai): read the real Gig/Listing tables and columns |
| #238 | 04:29 | serial | `claude/stream1-retire-gig-status-route` | fix(gigs): retire the dormant direct gig-status write |
| #239 | 04:36 | serial | `claude/stream2-m01-home-mail-visibility` | fix(mailbox): privacy fix (M01 a) — members see only the Home letters the Home rule allows |
| #240 | 04:58 | serial | `claude/stream3-business-inbox-start` | fix(business): let neighbors start a conversation with a business again |
| #241 | 06:28 | serial | `claude/stream1-ios-tip-receipt-refresh` | fix(ios): refresh the gig after a tip is confirmed or canceled |
| #242 | 04:54 | serial | `claude/stream2-mail-send-extracted-default` | fix(mailbox): send stores its sender, delivery, attention and visibility fields |
| #243 | 05:09 | serial | `claude/stream2-web-mailbox-counter-route` | fix(web): mailbox Counter reads the drawers' existing counter tab |
| #244 | 05:19 | serial | `claude/stream1-webhook-write-failures` | fix(stripe): don't acknowledge a webhook whose payment record failed to save |
| #245 | 10:25 | serial | `claude/stream3-booking-host-link-align` | fix(notifications): send hosts and invoice recipients to pages that exist |
| #246 | 05:22 | serial | `claude/stream1-withdrawal-reversal-check` | fix(wallet): don't mark a withdrawal reversed when the reversal credit failed |
| #247 | 06:39 | serial | `claude/stream2-web-mailbox-real-home` | fix(web): mailbox Home pages use the user's Home instead of a 'home_1' stub |
| #248 | 06:32 | serial | `claude/stream2-p3-records-asset-fields` | fix(mailbox): records read the asset's brand, model, purchase and warranty columns |
| #249 | 06:46 | serial | `claude/stream2-home-notification-links` | fix(notifications): Home notices open the Owners and Members pages that exist |
| #250 | 06:51 | serial | `claude/stream2-mail-notification-links` | fix(web): a /app/mailbox/:mailId link opens the letter, not an empty drawer |
| #251 | 16:51 | batch 1 #353 | `claude/stream3-android-you-help-legal-routes` | fix(android): open the real Help, Terms and Privacy screens from You |
| #252 | 16:51 | batch 1 #353 | `claude/stream3-android-chat-link-dm-person-mode` | fix(android): open a chat link to a direct room as the person thread |
| #253 | 10:38 | serial | `claude/stream1-poster-fault-fee` | feat(gigs): charge poster-fault fees from the existing payment hold (P04/P05) |
| #254 | 11:16 | serial | `claude/stream1-poster-fault-fee-clients` | feat(gigs): show the poster-fault fee line on web, iOS and Android (P04/P05) |
| #255 | 12:07 | serial | `claude/search-terms-escape-ilike` | fix(search): escape free-text search terms before they enter ILIKE filters |
| #256 | 09:27 | serial | `claude/web-plain-transport-errors` | fix(web): plain copy for transport failures instead of raw axios text |
| #257 | 20:07 | batch 3 #387 | `claude/stream2-native-notification-links` | fix(native): notification links open the letter, the Mail tab and a neighbor message |
| #258 | 08:17 | serial | `claude/stream3-invoice-received-notification` | fix(business): notify the customer when a business sends an invoice, unless blocked |
| #259 | 08:21 | serial | `claude/stream1-change-order-duplicate` | fix(gigs): answer a repeated change-order submit with the order already sent |
| #260 | 09:32 | serial | `claude/stream2-web-route-drift-cleanups` | fix(web): Mail Day dismiss lasts the day, no dead Hub context call, plain Home help error |
| #261 | 08:12 | serial | `claude/stream2-mail-compat-retry-narrow` | fix(mailbox): retry a send without newer columns only when a column is missing |
| #262 | 16:51 | batch 1 #353 | `claude/stream3-ios-chat-link-dm-person-mode` | fix(ios): open a chat link to a one-to-one DM as the person thread |
| #263 | 09:36 | serial | `claude/stream2-place-intelligence-invalid-id` | fix(place): a malformed Home id is a 400 on the intelligence and systems routes |
| #264 | 16:51 | batch 1 #353 | `claude/stream1-android-sheet-errors` | fix(android): keep gig sheet failures visible inside the sheet |
| #265 | 09:41 | serial | `claude/stream2-mail-attn-member-check` | fix(mailbox): letters reach residents, and a Home letter's attention person must live there |
| #266 | 16:51 | batch 1 #353 | `claude/stream3-ios-nav-drawer-bottom-inset` | fix(ios): let the menu's last row scroll clear of the tab bar |
| #267 | 09:51 | serial | `claude/stream2-web-compose-send-error` | fix(web): a failed send explains itself inside the compose modal |
| #268 | 09:56 | serial | `claude/stream2-geo-error-detail` | fix(geo): keep provider errors in the server log, not in the response |
| #269 | 09:07 | serial | `claude/stream1-paid-change-order-guard` | fix(gigs): refuse a price change while a task's payment hold is live |
| #270 | 10:00 | serial | `claude/stream2-mailbox-list-sender` | fix(mailbox): the v1 list returns each letter's sender, so rows stop showing "Pantopus" |
| #271 | 09:02 | serial | `claude/stream1-account-delete-history-guard` | fix(users): refuse account deletion while payment history must be kept |
| #272 | 10:06 | serial | `claude/stream2-web-owners-emergency-load-error` | fix(web): Owners and Emergency pages say when they could not load, instead of looking empty |
| #273 | 09:12 | serial | `claude/stream2-business-team-attn` | fix(mailbox): a letter filed into Business keeps its recipient and attention person |
| #274 | 09:16 | serial | `claude/stream2-bill-fanout-attn` | fix(mailbox): a bill letter for one person does not become a household bill |
| #275 | 09:45 | serial | `claude/stream2-mail-sender-gate` | fix(mailbox): residents can send letters to their own Home (stacked on #265) |
| #276 | 09:22 | serial | `claude/stream2-fanout-attn-all` | fix(mailbox): a letter for one person creates no household record (stacked on #274) |
| #277 | 10:20 | serial | `claude/stream1-web-gig-error-messages` | fix(web): show the server's reason when a gig detail action fails |
| #278 | 12:28 | serial | `claude/stream2-home-asset-categories` | fix(records): structure, system and vehicle assets can be saved |
| #279 | 16:51 | batch 1 #353 | `claude/stream3-native-invoice-notification-links` | fix(native): open invoice notifications on the invoice screen (iOS and Android) |
| #280 | 12:56 | serial | `claude/stream2-fanout-failures` | fix(mailbox): "Save to records" and "Create task" from a letter work, and failures are reported |
| #281 | 10:29 | serial | `claude/stream3-business-invoice-block-gate` | fix(business): don't let a business invoice someone who blocked it |
| #282 | 10:34 | serial | `claude/stream3-business-owner-notifications` | fix(business): send business-account notifications to the people who run it |
| #283 | 13:10 | serial | `claude/stream1-no-show-reasons` | fix(gigs): say plainly why a no-show can't be reported |
| #284 | 10:13 | serial | `claude/stream2-home-gigs-route` | fix(home): the Home help card loads the household's tasks |
| #285 | 16:51 | batch 1 #353 | `claude/stream1-android-error-toast-colour` | fix(android): colour gig detail error toasts as errors |
| #286 | 16:51 | batch 1 #353 | `claude/stream1-server-error-copy` | fix(apps): plain wording for a server failure on Android and iOS |
| #287 | 16:51 | batch 1 #353 | `claude/stream1-paid-price-types-hidden` | feat(gigs): don't offer price changes on a task with a live payment hold |
| #288 | 11:23 | serial | `claude/stream2-magic-post-task-format` | fix(gigs): magic posts without a task format no longer fail |
| #289 | 13:39 | serial | `claude/stream1-approve-price-write` | fix(gigs): don't approve a change order whose price change wasn't saved |
| #290 | 13:22 | serial | `claude/stream1-web-change-order-banner` | fix(web): word the change-order banner for the viewer; one approve per click |
| #291 | 13:15 | serial | `claude/stream2-web-home-location-shape` | fix(web): "My Home" uses the Home's stored coordinates when posting a task |
| #292 | 16:51 | batch 1 #353 | `claude/stream3-native-owner-booking-links` | fix(native): open Home- and Business-owned booking notifications again |
| #293 | 11:48 | serial | `claude/stream3-relationships-block-concealment` | fix(relationships): a block reads as no relationship to the person blocked |
| #294 | 11:30 | serial | `claude/stream2-gig-create-empty-fields` | fix(gigs): an optional task field left empty no longer fails the post |
| #295 | 11:51 | serial | `claude/stream3-neighbor-reply-block-copy` | fix(neighbor-messages): don't tell a blocked recipient they blocked the sender |
| #296 | 11:35 | serial | `claude/stream2-gig-detail-cookie-viewer` | fix(gigs): a task's page and edit form know the signed-in web viewer |
| #297 | 11:39 | serial | `claude/stream2-gig-origin-home-guard` | fix(gigs): posting from a Home requires access to that Home |
| #298 | 11:43 | serial | `claude/stream2-gig-browse-cookie-viewer` | fix(gigs): task lists know the web viewer and leave out blocked people's tasks |
| #299 | 11:58 | serial | `claude/stream3-web-settings-load-guard` | fix(web): don't let Settings or Privacy save defaults after a failed load |
| #300 | 12:04 | serial | `claude/stream3-web-business-create-type` | fix(web): creating a business no longer fails at Basic info |
| #301 | 16:51 | batch 1 #353 | `claude/stream1-bid-failure-reasons` | fix(apps): say why a bid or delivery proof was refused, with a payout-setup step |
| #302 | 16:51 | batch 1 #353 | `claude/stream1-confirm-completion-step` | fix(apps): ask before "Confirm completion" charges the held payment |
| #303 | 16:51 | batch 1 #353 | `claude/stream1-notification-gig-back` | fix(apps): keep a notification's gig on top of its list; open gig links over an open gig |
| #304 | 19:22 | batch 2 #374 | `claude/stream3-native-hub-bell-unread` | fix(native): light the hub bell for unread notifications |
| #305 | 16:51 | batch 1 #353 | `claude/stream3-native-my-businesses-count-copy` | fix(native): say "N businesses" on My businesses |
| #306 | 16:51 | batch 1 #353 | `claude/stream3-native-business-verified-chip` | fix(native): show the business's real verification state in its header |
| #307 | 16:51 | batch 1 #353 | `claude/stream3-ios-notifications-section-header` | fix(ios): stop list rows showing through pinned section headers |
| #308 | 19:22 | batch 2 #374 | `claude/stream3-native-forbidden-server-message` | fix(native): show the server's reason when a request is refused (403) |
| #309 | 19:22 | batch 2 #374 | `claude/stream3-native-chat-send-refused` | fix(native): a refused chat send shows the server's reason and no Retry |
| #310 | 14:41 | serial | `claude/stream3-create-full-entity-type-validation` | fix(business): validate create-full's business_type against the entity types |
| #311 | 13:45 | serial | `claude/shared-ux-web-error-reasons` | fix(web): show the server's reason when a request fails, never codes or 5xx internals |
| #312 | 19:22 | batch 2 #374 | `claude/stream1-tip-dock-limit-copy` | fix(apps): tip dock parity on iOS and a plain tip-limit message |
| #313 | 16:51 | batch 1 #353 | `claude/shared-ux-ios-profile-close` | fix(ios): let the profile cover close, and close it when a link lands in a tab |
| #314 | 16:51 | batch 1 #353 | `claude/shared-ux-hub-status-routes` | fix(apps): Hub status pills and the menu's My Listings open the right screens |
| #315 | 19:22 | batch 2 #374 | `claude/shared-ux-you-identity-rows` | fix(apps): You → Home and Business rows open My homes / My businesses, not placeholders |
| #316 | 19:22 | batch 2 #374 | `claude/shared-ux-placeholder-way-back` | fix(apps): placeholders say plainly what's missing and always offer a way back |
| #317 | 14:48 | serial | `claude/stream3-web-business-entity-type-select` | fix(web): pick the business type from a list instead of typing a key |
| #318 | 14:54 | serial | `claude/stream3-web-chat-room-access-state` | fix(web): a chat room you can't open says so instead of inviting a message |
| #319 | 16:51 | batch 1 #353 | `claude/stream3-web-chat-send-failures` | fix(web): chat send failures explain themselves and offer Retry |
| #320 | 19:22 | batch 2 #374 | `claude/stream2-native-mail-actions-honest` | fix(native): mail action tiles only offer actions that happen |
| #321 | 19:22 | batch 2 #374 | `claude/stream2-native-home-dashboard-tabs` | fix(native): Home dashboard tabs open their sections |
| #322 | 13:52 | serial | `claude/shared-ux-web-offline` | fix(web): say when the app is offline instead of leaving screens unexplained |
| #323 | 13:58 | serial | `claude/stream2-web-records-photo-hidden` | fix(web): the record page no longer offers a photo upload that can't happen |
| #324 | 14:03 | serial | `claude/stream2-web-record-post-gig` | fix(web): a record's "Post Gig" opens the real task form |
| #326 | 14:17 | serial | `claude/stream2-web-coupon-unavailable` | fix(web): the coupon page says coupon orders aren't available yet |
| #327 | 14:33 | serial | `claude/stream2-web-mailbox-task-post-gig` | fix(web): mailbox task "Post as Gig" opens the real task forms |
| #328 | 13:26 | serial | `claude/stream2-coupon-order-disabled` | fix(backend): disable the coupon order route until orders are real |
| #329 | 19:22 | batch 2 #374 | `claude/shared-ux-ios-single-back` | fix(ios): exactly one working Back on pushed screens |
| #330 | 19:22 | batch 2 #374 | `claude/stream3-native-help-email-fallback` | fix(native): say where to write when no email app is set up, at support@pantopus.com |
| #331 | 19:22 | batch 2 #374 | `claude/stream3-ios-chat-list-live` | fix(ios): keep the Messages list live after you open a conversation (S3-30) |
| #332 | 19:22 | batch 2 #374 | `claude/stream3-native-password-context-band` | fix(native): the password screen shows your own email, not a sample one |
| #333 | 19:22 | batch 2 #374 | `claude/shared-ux-ios-keep-content-on-refresh-failure` | fix(ios): a failed refresh keeps what's on screen and says so |
| #334 | 19:22 | batch 2 #374 | `claude/shared-ux-ios-nearby-sheet-back` | fix(ios): Nearby's Pulse, Tasks and Marketplace sheets get a Back that closes them |
| #335 | 16:51 | batch 1 #353 | `claude/stream3-web-chat-share-card-errors` | fix(web): sharing a task or listing card into chat says why it failed (S3-16) |
| #336 | 16:51 | batch 1 #353 | `claude/stream3-web-profile-message-errors` | fix(web): a profile's Message button says why a conversation couldn't start (S3-17) |
| #337 | 16:51 | batch 1 #353 | `claude/stream1-android-wizard-chrome` | fix(android): wizard footers and step readouts follow the form |
| #338 | 19:22 | batch 2 #374 | `claude/shared-ux-settings-signout-confirm` | fix(apps): Settings asks before signing out |
| #339 | 20:07 | batch 3 #387 | `claude/stream1-magic-draft-decode` | fix(apps): magic drafts with a follow-up question decode on iOS and Android |
| #340 | 16:51 | batch 1 #353 | `claude/stream1-android-magic-category` | fix(android): magic drafts map the backend's category names |
| #341 | 16:51 | batch 1 #353 | `claude/stream1-android-magic-post-category` | fix(android): magic posts send the backend's category name |
| #342 | 19:22 | batch 2 #374 | `claude/stream1-gigs-new-link` | fix(apps): a gigs/new link opens the task composer |
| #343 | 16:51 | batch 1 #353 | `claude/shared-ux-web-dead-links` | fix(hub): Discover's Businesses rail loads, and Discover links open real pages |
| #344 | 16:51 | batch 1 #353 | `claude/shared-ux-matched-businesses-route` | fix(posts): matched-businesses no longer 500s when it hydrates live data |
| #345 | 16:51 | batch 1 #353 | `claude/shared-ux-web-jump-back-in-icons` | fix(web): Hub "Jump Back In" tiles show icons, not icon names |
| #346 | 20:07 | batch 3 #387 | `claude/stream2-native-earn-honest` | fix(native): Earn cash-out shows the real wallet; offer money is marked not cashable |
| #347 | 16:51 | batch 1 #353 | `claude/stream2-asset-photos-private` | feat: record photos in private storage, signed for assets.view; Add photo back on web |
| #348 | 19:22 | batch 2 #374 | `claude/stream3-native-privacy-unsaved-cards` | fix(native): hide the Privacy cards that never saved (S3-29) |
| #349 | 20:07 | batch 3 #387 | `claude/stream3-native-delete-account-path` | fix(native): make Delete account easy to find, and say what blocks it (S3-32) |
| #350 | 20:07 | batch 3 #387 | `claude/stream3-native-privacy-your-data-rows` | fix(native): Privacy's Your data rows open real screens; a failed load offers Try again (S3-09, S3-10) |
| #351 | 19:22 | batch 2 #374 | `claude/shared-ux-web-post-detail-errors` | fix(web): post detail says "not found" only when the post is gone |
| #352 | 19:22 | batch 2 #374 | `claude/stream3-web-dead-links` | fix(web): links that 404 (S3-19, S3-21, S3-27) |
| #353 | 16:51 | serial | `claude/coord-merge-batch-1` | chore: combined merge of 36 reviewed PRs (batch 1) |
| #354 | 19:22 | batch 2 #374 | `claude/stream3-web-settings-account-placeholders` | fix(web): Settings account rows lead somewhere instead of "coming soon" (S3-24, S3-38) |
| #355 | 19:22 | batch 2 #374 | `claude/stream3-web-profile-load-error` | fix(web): a profile that fails to load offers Try again instead of /login (S3-25) |
| #357 | 19:22 | batch 2 #374 | `claude/shared-ux-web-hub-discover` | fix(web): Hub Discover drops the always-empty People tab and says when it couldn't load |
| #358 | 19:22 | batch 2 #374 | `claude/stream3-web-slot-notify-button` | fix(web): hide the booking page "Get notified" button until it does something (S3-20) |
| #359 | 19:22 | batch 2 #374 | `claude/stream1-gig-items-array` | fix(gigs): task item lists are stored and served as arrays |
| #360 | 19:22 | batch 2 #374 | `claude/shared-ux-web-action-queue` | fix(web): Hub Action queue shows the owner's tasks and no longer invents to-dos |
| #361 | 19:22 | batch 2 #374 | `claude/shared-ux-web-comment-actions` | fix(web): comment delete asks first, Ctrl+Enter can't post twice, failed likes say so |
| #362 | 19:22 | batch 2 #374 | `claude/shared-ux-organic-match` | fix(jobs): organic business matching calls find_businesses_nearby with its real parameters |
| #363 | 19:22 | batch 2 #374 | `claude/stream2-household-mail-drawer` | fix(backend): household letters sent from compose land in the Home drawer |
| #364 | 19:22 | batch 2 #374 | `claude/stream3-web-waitlist-join` | feat(web): "Get notified when times open" joins the waitlist (S3-20 follow-up) |
| #365 | 20:07 | batch 3 #387 | `claude/stream1-listing-offer-seller` | fix(apps): listing "Make offer" sends a real offer; the seller card shows the real seller |
| #366 | 19:22 | batch 2 #374 | `claude/stream1-price-changes-unavailable-api` | fix(gigs): refuse a price change on every task until one can be settled |
| #367 | 19:22 | batch 2 #374 | `claude/stream3-web-trust-claims` | fix(web): no sample stats or unearned "verified" labels on business and booking pages |
| #368 | 19:22 | batch 2 #374 | `claude/stream2-mail-sender-business-trust` | fix(mailbox): a letter shows "verified business" only for a verified business its sender may send for |
| #369 | 19:22 | batch 2 #374 | `claude/stream2-web-mailbox-failures` | fix(web): Mailbox failures say so, opened letters refresh the lists, and no fake translation |
| #370 | 19:22 | batch 2 #374 | `claude/stream2-web-compose-send-as` | fix(web): compose picks "Send as" from your businesses; a choice that can't be used is never dropped silently (stacked on #368) |
| #371 | 20:07 | batch 3 #387 | `claude/stream3-native-business-profile-verified-claims` | fix(native): business pages claim verification only when verified; honest Report, Book and Call |
| #372 | 20:07 | batch 3 #387 | `claude/stream3-native-chat-verified-claims` | fix(native): chat claims verification only when the data says so |
| #373 | 20:07 | batch 3 #387 | `claude/stream3-native-profile-identity-claims` | fix(native): public profiles and View as show no sample people or unearned "verified" |
| #374 | 19:22 | serial | `claude/coord-merge-batch-2` | chore: combined merge of 34 reviewed PRs (batch 2) |
| #375 | 20:07 | batch 3 #387 | `claude/stream1-items-decode-offers-label` | fix(apps): stored item lists open on Android; "Open to offers" on offers-priced tasks; task screens stop unbacked "verified" claims |
| #376 | 20:07 | batch 3 #387 | `claude/stream1-web-offers-label` | fix(web): an offers-priced task shows "Open to offers" without "$1" |
| #377 | 20:07 | batch 3 #387 | `claude/stream1-price-types-hidden-all` | feat(apps): no price change orders on any task; say why on pending ones |
| #378 | 20:07 | batch 3 #387 | `claude/stream1-trust-claims-web-api` | fix: package task routes answer 501 until real; web "Verified Neighbor" and "Verified" filter follow real verification |
| #379 | 20:07 | batch 3 #387 | `claude/stream1-web-seller-view-offers` | fix(web): a seller reaches the offers on their listing |
| #380 | 20:07 | batch 3 #387 | `claude/stream2-web-home-dead-ends` | fix(web): Home dead ends: landlord invite 404, attachment pickers, Request help, no-estimate copy |
| #381 | 20:07 | batch 3 #387 | `claude/stream2-web-visit-access-row` | fix(web): drop the visit setup's dead "Link an access code" row |
| #382 | 20:07 | batch 3 #387 | `claude/stream1-web-view-offer` | fix(web): "View Offer" shows the buyer's own offer instead of a new-offer form |
| #383 | 20:07 | batch 3 #387 | `claude/stream3-native-scheduling-trust-claims` | fix(native): scheduling lists real people and drops unearned verified checks |
| #384 | 20:07 | batch 3 #387 | `claude/stream3-native-policy-copy` | fix(native): Help and the creator inbox state only the rules the app enforces |
| #385 | 19:22 | batch 2 #374 | `claude/coord-ci-db-image-fallback` | ci: retry the schema replay from the public ECR mirror when ghcr.io refuses the image |
| #386 | 20:07 | batch 3 #387 | `claude/stream2-share-eta-sender` | fix(backend): share-ETA notices come from the member; Home member lookups return members |
| #387 | 20:07 | serial | `claude/coord-merge-batch-3` | chore: combined merge of 20 reviewed PRs (batch 3) |
