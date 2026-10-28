# First-launch scope flags (2026-10-01)

For the first launch the founder cut eight features (direction of 2026-09-27; see the "LAUNCH SCOPE" block in the
coordination hub). Three keys came later: `gift_funds` (2026-10-06), `mailbox` (founder decision of 2026-10-09, with
the Instant Screens work) and `pulse_redesign` (founder decision of 2026-10-15, pausing the Pulse build). They are
**hidden behind flags, not deleted**: every screen, route, API, job and test is still
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
| `pulse_redesign` | 11. The Pulse redesign (added 2026-10-15, founder decision; the build kit is `docs/product/pulse-build/`) | What the Pulse build added from October 13: the five-tab bar with Pulse and Plans as tabs, the Pulse page (area picker, topic lanes, quiet card, post status), the conversation page, the audience picker, follow and card controls, Pulse preferences, Pulse-mode posting, offers and claims, Helpful and thanks, and the Ask reminder. With the key off the apps are the October 13 apps: four tabs (Place · Today · Nearby · Messages), and Pulse is the October 13 feed that opens from Nearby, with its composer and post page. The server refuses every `/api/pulse` route and a Pulse-mode post (403 `PULSE_REDESIGN_UNAVAILABLE`), stores no follow alert, Helpful, thanks or offer notices, and skips the Ask reminder job. **Kept:** the October 13 Pulse and everything it uses; the rules and fixes in call 15; all redesign code, tables and tests |

A surface that belongs to two cut features shows only when **both** are on.

## Switching a feature back on

List its key (comma-separated, or `all`) in each place, then redeploy / rebuild:

| Codebase | Setting | Where it is read |
|---|---|---|
| Backend | env `LAUNCH_FEATURES` | `backend/utils/featureFlags.js` (`isLaunchFeatureEnabled`) |
| Web | env `NEXT_PUBLIC_LAUNCH_FEATURES` (inlined at build) | `frontend/apps/web/src/lib/featureFlags.ts` (`launchFeatures`) |
| iOS | build setting `PANTOPUS_LAUNCH_FEATURES` (Config/*.xcconfig → Info.plist `PantopusLaunchFeatures`); Debug builds also read the env var | `Pantopus/Core/Environment/LaunchFeatures.swift` |
| Android | `PANTOPUS_LAUNCH_FEATURES` in the build's `.env` or environment (→ BuildConfig) | `app/src/main/java/app/pantopus/android/core/LaunchFeatures.kt` |

Store builds (`ios-beta.yml`, `android-beta.yml`) take the iOS and Android value from the GitHub Actions variable
`PANTOPUS_LAUNCH_FEATURES` (on the repository, or on the `ios-release` and `android-release` environments) and write it
into the build's `.env`. Unset, every cut feature stays hidden; a key the app doesn't know fails the build, and each
build's log lists the keys it carries. Every store build cut while the variable is set carries those keys. Staging
builds take the value from the `.env.staging` they are built from.

Example: `LAUNCH_FEATURES=marketplace` on the backend plus the same key in the web, iOS and Android builds brings the
Marketplace back everywhere. Switch the backend first so notifications and feeds return before the screens do. The
Mailbox is the exception: release its app builds first, because the backend switch also starts the morning mail notice,
which reaches people on older builds that have no Mail tab ([NEXT_STEPS](../NEXT_STEPS.md#mail-added-october-28) has the
order).

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
   `/api/internal/briefing/reminder-push`, and its morning notice at `/api/internal/briefing/mail-morning`. Since
   2026-10-27 (Mail tab, SRV-1) the Mail Day reminder doesn't run at all: the Mail tab has one morning notice. Since 2026-10-27 community-mail moderation, mail-party expiry and the Earn
   risk review need `mail_extras` as well (they serve only mail extras), and the Lambda's schedule has its own switch
   in the seeder stack, `MailEnabled` (off by default; turn it on with the Mailbox, see
   `docs/release/prod-config-checklist.md`).
14. **Letters to a contact need both mail keys:** the email or text that tells a non-member about a letter, and the
   `mail_claimed` / `mail_escrow_*` notices, go out only with `mailbox` and `mail_extras` both on (a surface of two cut
   features). With either key off, `POST /api/mailbox/send` refuses a letter to an email address or phone number
   (403 `MAIL_EXTRAS_UNAVAILABLE`), and the web page the email's link opens (`/open/<mail id>`, where the person
   previews the letter and signs in or signs up to claim it) is hidden.
15. **What stays while `pulse_redesign` is off (2026-10-15, founder decision):**
   - **Two rules from the Pulse build stay in force:**
     - Heads-ups about crime or suspicious people stay refused (`ALERT_KIND_NOT_ALLOWED`). Old posts of those kinds
       stay readable.
     - Businesses still can't start posts in the neighborhood feed (`BUSINESS_CANNOT_POST`). Their feed compose
       button stays gone.
   - **The privacy fixes made during the Pulse build stay on:**
     - the Share link check
     - replies and notifications across blocks
     - the profile and local-activity post walls
     - the pinned-post read check
     - audience read checks
   - **Some changes stay without the October 13 apps showing them:** posts end hourly, the feed radius is capped at
     100 miles, and posts keep a topic.
   - **Each lane gates its own code:** iOS and Android restore their October 13 Pulse screens behind the key. The
     server gate merges after them, so no app shows the redesign to a server that refuses it.

## Known limits

- Data created before the cut (an old listing, bid or bill) stays in the database; it is not shown, but it is not
  deleted either.
- Native apps read the switches at build time, so bringing a feature back to phones needs a new app build.
- Mail that arrives while `mailbox` is off is stored as before; nobody is told about it until the mailbox returns.
- The Pulse redesign's tables and columns stay in the database (its migrations are additive). Resuming the build
  and switching it back on is in `docs/product/pulse-build/README.md`.

## Database switches for new rules (not launch cuts)

Some newer rules are switched in the database instead, so they can be turned off in about a minute without a
deploy or an app build. Each is a `FeatureFlag` row; an admin flips it with
`POST /api/admin/feature-flags/<name>` and a body such as `{"enabled_globally": true}`.

| Flag | Default | What it turns on |
|---|---|---|
| `home_instant_claim` | off | Instant Claimed status (home claims plan, PR 3; founder decision 2026-10-25). Someone who adds a home where nobody else is on Pantopus, saying "I live here" or "I own it", gets it as a claimed home at once: household tools, the Home's own sections and invitations. Verifying the address is still what opens letters, neighbors' real rent, neighbor messages, mail and owner powers. The address watch holds high-risk claims for review (they stay a private setup), and a claim counts on the Neighborhood meter after 14 days. Turning it off stops new claims at once; homes already claimed keep their access. |
| `home_residency_probation` | off | Probation join (home claims plan, PR 4; founder decision 2026-10-25, residents only, never ownership). It ships off; the founder turns it on after testing with `POST /api/admin/feature-flags/home_residency_probation`. A request to join a household that nobody has answered for 7 days becomes probation (only requests saved in the last 30 days: when it's turned on, older unanswered requests stay pending, and the household can still answer them): the person stays provisional with no household records, mail or Plans trust, and the household is told. A reviewer's yes makes them a member, a no (or a challenge in the 7-day window, 14 days for a medium address watch) suspends them, and proving the address by postcard starts the usual postcard review. After a no they can't ask again; proving the address by postcard then opens a dispute in the Pantopus address review queue (`probation_dispute`) instead of restoring access: approving it restores their membership; after a rejection (the household's no stands) or a dismissal they can send proof again, which opens a new review. A high address watch holds the request. Turning it off again stops new probation at once; people already on probation stay until someone decides. |
| `home_removal_vote` | off | Resident removal vote (home claims plan, PR 5; founder decision 2026-10-25). It ships off; the founder turns it on only after testing and after the iOS and Android apps have voting screens (today only the web Members page has one), with `POST /api/admin/feature-flags/home_removal_vote` and `{"enabled_globally": true}`. Settled residents (verified adult members for at least 7 days since they were admitted) can vote to remove a current verified member below a manager who isn't an owner: a majority of the other settled residents, and at least 2 of them, within 7 days, one vote per Home at a time. The person keeps access while the vote is open and is told it's open and the result, never who voted. A vote to remove takes effect only when it closes after the full 7 days (founder, 2026-10-26; the hourly job applies it), so the person has time to prove the address by mail and contest first; a vote that can no longer reach a majority ends at once. Someone with proof of the address can contest, and a vote that passes then goes to Pantopus review: an admin is emailed (`ADMIN_ALERT_EMAIL`), and resolving the case with `POST /api/admin/address-review/:caseId/resolve` decides the vote (approved removes them; rejected or dismissed keeps them). Turning it off again stops new votes at once; votes already open run to their end. |
