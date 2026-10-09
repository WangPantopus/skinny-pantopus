# First-launch scope flags (2026-10-01)

For the first launch the founder cut eight features (direction of 2026-09-27; see the "LAUNCH SCOPE" block in the
coordination hub). Two keys came later: `gift_funds` (2026-10-06) and `mailbox` (founder decision of 2026-10-09, with
the Instant Screens work). They are **hidden behind flags, not deleted**: every screen, route, API, job and test is still
in the code, and any feature comes back by switching its flag on. This document says what each flag hides, how to switch
one back on, and the calls that were made while hiding them.

## The switches

One key list is shared by all four codebases. A feature is **off** unless its key is listed; `all` switches every
feature on.

| Key | Cut | What it hides |
|---|---|---|
| `beacon` | 1. Beacon and creator tools | Beacon pages and the Beacons feed, following publishers, audience management and the Audience bell/stream, creator inbox, broadcasts, membership tiers, Beacon push settings |
| `personas` | 2. Personas and identity switching | Persona pages, the identity "Switch"/Identity Center and View-as, persona DMs, the web "Professional" profile (with `open_gigs`) |
| `marketplace` | 3. Marketplace | Listings (browse, detail, create, Snap & sell), offers and trades, My Listings, saved listings, Market chat filter and listing cards, Items on maps, the receipt's Marketplace stats |
| `open_gigs` | 4. Open Gigs marketplace | Posting tasks for bids (every composer, Hire help, Post task, checklist Hire, Ask a neighbor), browse/search/map, bids, offers and counters, task Q&A, My bids, Tasks widgets, the rebook rail. **Kept:** task detail and lifecycle for tasks you are part of, My tasks, payments, tips |
| `public_scheduling` | 5. Public scheduling | Every Scheduling entry, booking pages, event types, availability, team scheduling, My bookings, booking reminders. **Kept:** invoices, packages and payouts screens; the scheduling engine |
| `business_directory` | 6. General business directory | Discover businesses, business search results and filters, the business map layer and the map's business filters, the Discover hub (needs #3 and #4 too). **Kept:** business pages by link, creating and running a business, the Explore Map with its Posts layer |
| `household_extras` | 7. Household extras | Home bills, packages, pets, polls and the family calendar (tiles, tabs, cards, "+" actions, reminders, Today/Hub rows, activity rows, notification toggles); package tracking in the mailbox (native package mail reads as plain mail: no tracking, Share ETA, Report issue or virtual unboxing; the unboxing screen and the mailbox menu's "Scan an item", which opens it). **Kept:** Place bill benchmark and its opt-in, the address calendar, health score, tasks, issues, documents, emergency, access, guests, members |
| `mail_extras` | 8. Mail extras | Writing letters (Compose / Write a letter / Send mail), ceremonial letters, certified mail and e-signing, Family Mail Party, community mail, mail event invitations, translations; the Stamps postage wallet and its header actions (call 9); Earn, the mailbox's offer and ad earnings (call 12). **Kept:** the mailbox for received mail, vacation hold, My Mail Day, the vault and the Stamps gallery |
| `gift_funds` | 9. Support Train gift funds (added 2026-10-06 by L3) | The organizer's gift fund: Start a Train's "Gift funds" option, the Manage gift fund section, the "Gift Funds" support type on Train pages, and the fund enable and contribution routes (403 `GIFT_FUNDS_UNAVAILABLE`). No app can take a contribution yet, and the payee, holding, fee and non-member questions wait for the founder (status/FOUNDER.md, L3). **Kept:** everything else about Trains |
| `mailbox` | 10. Mailbox (added 2026-10-09, founder decision; `docs/product/instant-screens-contract-2026-10-09.md` §9) | The mailbox for received mail: Incoming, Counter and Vault, the Me / Home / Biz drawers, letters and the item detail, My Mail Day, vacation hold, mail search, the Stamps gallery, the Hub's mail tile, "Scan mail" chip and Mailbox shortcut, mail rows in Today, the Hub, the briefings and activity, mail notification settings, and the assistant's mail tools. The tab that read **Mail** reads **Messages** and opens the conversation list; its badge counts unread messages. The server sends no mail notifications, pushes or emails, counts no mail in badges or lists, and skips Mail Day and the other mailbox jobs. **Kept:** address verification by postcard ("Verify your address by mail"), home permissions (`mailbox.view` and the rest), all Mailbox code |

A surface that belongs to two cut features shows only when **both** are on.

## Switching a feature back on

List its key (comma-separated, or `all`) in each place, then redeploy / rebuild:

| Codebase | Setting | Where it is read |
|---|---|---|
| Backend | env `LAUNCH_FEATURES` | `backend/utils/featureFlags.js` (`isLaunchFeatureEnabled`) |
| Web | env `NEXT_PUBLIC_LAUNCH_FEATURES` (inlined at build) | `frontend/apps/web/src/lib/featureFlags.ts` (`launchFeatures`) |
| iOS | build setting `PANTOPUS_LAUNCH_FEATURES` (Config/*.xcconfig → Info.plist `PantopusLaunchFeatures`); Debug builds also read the env var | `Pantopus/Core/Environment/LaunchFeatures.swift` |
| Android | `PANTOPUS_LAUNCH_FEATURES` in the build's `.env` or environment (→ BuildConfig) | `app/src/main/java/app/pantopus/android/core/LaunchFeatures.kt` |

Example: `LAUNCH_FEATURES=marketplace` on the backend plus the same key in the web, iOS and Android builds brings the
Marketplace back everywhere. Switch the backend first so notifications and feeds return before the screens do.

Tests run with every feature on (`backend/jest.config.js`, `frontend/apps/web/tests/setup.ts`, and
`LaunchFeatures.overrideForTesting` in the native unit tests), so the kept code stays covered.

## How the hiding works

- **Entry points** (nav items, tabs, menus, tiles, buttons, FAB actions, cards, prompts) check the flag.
- **Direct entry** is turned away: web middleware sends hidden app pages to `/app/place` and hidden public pages to
  `/`; native deep links and pushes into a hidden screen are dropped or land on the existing "not in the app yet"
  placeholder; route guards catch any other stray link.
- **Server-composed content:** notification types only a cut feature produces are not created and are left out of
  lists and badge counts; Hub, Home dashboard, Today/briefing and Home activity feeds leave out cut items; senders that
  exist only for a cut feature (bill and calendar reminders, the no-bid nudge, the urgent-task push, booking reminders,
  Mail Day and the other mailbox jobs) are skipped; the AI assistant neither offers nor drafts listings or open tasks.
- **No API route returns 404 for a cut feature:** the clients hide the UI, and shared endpoints serve kept features.

## Calls made while hiding (founder's standing instruction: take the recommended option and record it)

1. **Rebook rail hidden whole** while `open_gigs` is off: its only action, "Rebook", opens the open-task composer
   for the old task's category, and posting it opens the task to every bidder; it does not book the same helper.
   The "rebooking a known crew" that replaces Open Gigs is the repeat Crew Day of the street-organizer design
   (`docs/product/street-organizer-design-2026-09-27.md`), which is not built yet. Rejected: a rail of helpers with
   no action (dead UI under "Rebook a favorite helper"). The 2026-09-27 verification map kept the rail in scope;
   it comes back with `open_gigs`, or with a direct-rebook action once one exists.
2. **Mail of a cut kind reads as plain mail** (certified, ceremonial, community, party invitation): it is mail the user
   received, so only the cut controls (sign, RSVP, translate, Mail Party) are hidden; iOS no longer sends a ceremonial
   letter to its hidden reader. Package mail reads as plain mail too while `household_extras` is off (package
   tracking is cut #7), as the web already did.
3. **Discover hub** needs `business_directory`, `open_gigs` and `marketplace`: it is rails of businesses, open tasks
   and listings. People/profile search stays.
4. **Task stepper** reads "Open → Assigned" instead of "Bidding → Bid Selected" and drops "Compare Bids".
5. **Booking reminders** are skipped; the job's completion sweep (scheduling engine state) keeps running.
6. **Invoices, packages and payouts** are never gated, even where they sit under Scheduling routes.
7. **Home activity feeds** (dashboard recent activity, timeline) leave out bill, package, pet, poll and calendar
   records; the Members & Security audit log keeps every row.
8. **Marketing and legal pages** (landing, about, terms, privacy) are unchanged.
9. **The mailbox itself stays**, with My Mail Day, the vault and the Stamps gallery: they cover all received mail
   (stamps are earned from any mail, packages and the vault), not only letters. Only their letter controls go (Write
   a letter, the Stamps dock's "Send mail"), and so does the Stamps **postage wallet** with its header actions ("Gift
   a stamp", "More actions"): it was sample data with no backend and only served sending letters (#1374 and
   `claude/stream4-mail-flag-gaps`). Stream 4, the mail owner, confirmed on 2026-10-01 that Mail Day and the gallery
   stay; the 2026-09-27 verification map had counted them as letter-only.
10. **Bill trends on the Home dashboard stays** (read-only, with the neighborhood benchmark and its opt-in): bills
   stay as the input to bill explanation. Adding, editing and tracking bills is hidden.
11. **The Explore Map stays on every platform** with the layers in scope: Posts on the web (it now opens on Posts),
   posts and homes on iOS and Android. Its business and task layers, the web map's business filters (categories, Open
   Now, Trust lens) and a toggle with a single layer are hidden. Rejected: hiding the whole web map, which also took
   away the in-scope Posts map that the native apps keep.
12. **Earn is hidden with `mail_extras`** (the mailbox's Earn drawer, Earn Wallet, the vault's Earn group, the earn
   routes and links). This goes beyond the literal #8 list: Earn's offer and ad earnings never reach the withdrawable
   wallet, so people would "earn" money they cannot cash out, and its unaudited routes (the risk-review job, a repeated
   open counted twice) would be live at launch. Stream 4 decided it on 2026-10-01 (01:09:54Z) and Stream 1 approved
   it; it comes back with `mail_extras` and needs a cash-out path before then.
13. **Mailbox jobs (2026-10-09, IS-Server):** while `mailbox` is off, the jobs that send something or make something a
   person would see are skipped: Mail Day, the mail interrupt events, the vault digest, Stamps awards, community-mail
   moderation, mail-party expiry and the Earn risk review (Stamps and Earn catch up from counts when the mailbox
   returns). Three keep running because they keep stored data correct: the purge of letters deleted more than 30 days
   ago (a deletion people were promised), vacation-hold dates, and letter escrow expiry (its notice to the sender is
   already dropped). The mail notification Lambda's pushes (`mail_summary`, `mail_urgent`) are refused at
   `/api/internal/briefing/reminder-push`.
14. **Letters to a contact need both mail keys:** the email or text that tells a non-member about a letter, and the
   `mail_claimed` / `mail_escrow_*` notices, go out only with `mailbox` and `mail_extras` both on (a surface of two cut
   features).

## Known limits

- Data created before the cut (an old listing, bid or bill) stays in the database; it is not shown, but it is not
  deleted either.
- Native apps read the switches at build time, so bringing a feature back to phones needs a new app build.
- Mail that arrives while `mailbox` is off is stored as before; nobody is told about it until the mailbox returns.
