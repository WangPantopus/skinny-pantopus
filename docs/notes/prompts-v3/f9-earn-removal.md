# Earn entries removed + a calm landing for old links
id: f9-earn-removal · platforms: web/ios/android · isNew: False · artboards: 18

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Mailbox drawer, status strip on Today, and old Earn links · f9-earn-removal

TYPE: EXTENSION of three existing designed screens: "Mailbox drawer" (the mailbox left nav on web 1440), the status strip on the Today tab (existing component "Hub status strip"; that name is internal only, and no screen or label says Hub), and "Earn Wallet". This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed.
In this prompt, "eligible" means an account with at least one Earn transaction that is available or paid. These rules govern every surface:
1. The Earn section and its row appear only for eligible accounts.
2. The status strip's offers chip is removed for everyone, eligible or not. Eligible people reach their balance only through the drawer's Earn Wallet row.
3. Old Earn links land on the Mail root with one neutral line for accounts that are not eligible.
4. The wallet stays open, read-only, for eligible accounts.

ATTACH: the mailbox nav on web 1440, and the drawer on web 390, iOS and Android, each with its Earn section · the status strip on Today with its offers chip (web, iOS, Android) · the Earn Wallet (web and iOS) · the Mail root on web 390 and iOS, including the mailbox-arrival pill if one exists.

PLATFORMS & VIEWPORTS: Web 1440x900 (left sidebar plus the mailbox nav) and 390x844 (bottom tab bar, drawer). iOS 393x852 (native drawer as in the screenshot). Android 412x915 (Material 3 navigation drawer).

WHERE IT LIVES & HOW PEOPLE ARRIVE
- Mail tab → mailbox drawer → Earn section.
- Today tab → status strip.
- Old links, from bookmarks and from pushes sent before this change: /app/mailbox/earn, /app/mailbox/earn/wallet and pantopus://mailbox/earn.
An old link hands over only its destination. Eligibility decides where it lands:
- Eligible: the wallet.
- Not eligible: the Mail root.
- Eligibility still unknown: the app holds. Under 1s it shows nothing. After 1s it shows the Mail root's WarmingSkeleton (row skeleton), with no Earn line and no Earn row.
- Signed out: sign-in first, preserving the destination, then the same decision.
No journey in the flow spec passes through here.

WHO AND WHEN: Mon 19 Oct 2026, 6:10 PM. Maya Chen at HOME A never earned anything. She taps an old September bookmark to /app/mailbox/earn. Sam Ortega, a member of HOME A, earned $18.50 this summer. He is the exception: he opens the drawer on Android and still finds his wallet.

THE ONE JOB: Take the cash-Earn promise off every surface for people who never earned, without hiding money from the few who did.

FIRST FIVE SECONDS
- Drawer: an ordinary list where nothing looks missing.
- Landing: first the selected Mail tab, then the one neutral line, then the mailbox list. The only action on the line is "Hide this".
- Wallet: first the balance, then the history, then the footer.

CONTENT (fixture deltas only)
- Deltas: Sam's $18.50 balance, and two history rows, both available:
  - "Mail scan bonus · Fri 14 Aug · $6.00"
  - "Offer reward · Thu 2 Jul · $12.50"
- Drawer, not eligible: the rows in the screenshot minus the Earn section. Expected rows: Mail Day · Map · Vacation hold · Stamps · Unboxing · Vault · Records · Settings. If the screenshot differs, keep the screenshot and record the difference.
- Drawer, eligible: the same rows, plus the section header "Earn" and the row "Earn Wallet" with "$18.50" trailing.
- Status strip before (everyone): "3 mail pieces waiting" · "Recycling and garbage tomorrow" · "2 offers available". After (everyone, including Sam): "3 mail pieces waiting" · "Recycling and garbage tomorrow". If the attached strip words the pickup chip differently, use its text.
- Old-link landing: the Mail root with the Mail tab selected, and the line "Earn isn't available right now. Everything else in your mailbox is where you left it." with the text button "Hide this".
- Wallet, read-only: title "Earn Wallet", balance "$18.50", the two history rows, and the footer "Earn isn't available right now. Your balance stays here." No offers, no "earn more", no withdraw button.
- Pending product decision, drawn only as an inset: the text link "Ask about your balance" under the wallet footer, opening the existing support contact.
- Paid out in full (eligible, $0.00): the drawer row shows "$0.00". The wallet shows balance "$0.00", the same two rows each captioned "Paid", and the footer "Everything you earned has been paid."
- Eligibility check failed on an old link: the Mail root with "We couldn't check your Earn balance · Retry".
- Worst case: a balance of "$1,204.75" with 40 history rows, and the eligible drawer (Earn section plus all 8 other rows) at AX5.

LAYOUT & VISUALIZATION
Draw both drawer variants side by side on one shared baseline grid, aligned row for row. Label them above the frames, not in the UI: "Most people" and "Has Earn history, the exception". In the first, the rows below Earn move up by exactly one section height. Leave nothing behind: no stranded divider above Settings, no 48px gap, no "Earn" header with nothing under it, no stale badge.

The status strip reflows for everyone. Two chips share the strip's full width, or the native strip scrolls as the screenshot shows. There is never a hole or a ghost chip. Sam's strip is identical to Maya's.

The landing is the ordinary Mail root. Place one plain line directly under the Mail header and above the first list row: bodySmall in text.secondary on the app surface (text.strong if the host surface is sunken, never text.muted). No glyph, no fill, no border, no red. A trailing 44pt text button reads "Hide this". If the mailbox-arrival pill is showing, this line replaces it for this visit. The landing has no back-to-tab button, because it already is the Mail root with the Mail tab selected.

The wallet keeps its existing layout. The history is plain rows, and the footer is a caption in text.secondary.

INTERACTION, MOTION & HAPTICS
- The Earn row never animates in or out. It renders only once eligibility is known.
- The landing line fades in once over 200ms, and is static under Reduce Motion.
- "Hide this" removes the line in place with a 150ms collapse (a cross-fade under Reduce Motion) and dismisses it for good on this account, on every device.
- Retry refetches in place.
- Wallet rows are tappable only if they already are in the screenshot.
- No haptics.
- The drawer opens from its menu button. Its existing edge swipe is an extra.

FOUNDATIONS COMPONENTS USED
- InlineErrorRow:
  - the fail-closed rule: the Earn row renders nothing when the lookup fails;
  - the provider-unreachable variant, on the base surface with no errorBg, only for the old-link retry: "We couldn't check your Earn balance · Retry".
- WarmingSkeleton: row skeleton for the Mail root while an old link holds. Never for the Earn row.
- OfflineNotice with FreshnessLine (offline variant).

ACCESSIBILITY
- The drawer announces its real count: 8 items when not eligible, 9 when eligible.
- The landing line is a polite status message, announced once. "Hide this" has the spoken label "Hide note about Earn".
- Retry's spoken label is "Retry Earn balance check".
- Wallet reading order: balance → history, as a list ("Mail scan bonus, Friday 14 August, 6 dollars"; "Offer reward, Thursday 2 July, 12 dollars 50") → footer.
- Targets: 44pt on iOS, 48dp on Android, 44px on web.
- Text contrast is at least 4.5:1, and no state relies on colour.
- At AX5, amounts drop below their labels, drawer rows wrap, and the landing line wraps to several lines.

COPY: every string above, plus:
- Offline, eligible: "You're offline · as of 5:52 PM" above the cached wallet and the cached drawer.
- Offline on an old link while eligibility is unknown: the cached Mail root with "You're offline · as of 5:52 PM", and no Earn line and no Earn row.
No upsell, no gating copy, no "coming back", no "closed", and no promise of future earnings. No footer may suggest that Earn will resume.

EDGE CASES
- Eligibility loading: draw the drawer at its final height, with no Earn row and no skeleton row held for one.
- Lookup failed: hide the row, and show no error in the drawer.
- Offline with a cached eligibility answer: a cached "eligible" counts as known, so Sam still sees his row and wallet. A cached "not eligible", or no cached answer, hides the row.
- The strip never shows an offers chip, even when a cached payload still carries the offers item.
- Long balances and 40 history rows scroll.
- Paid out in full: "$0.00", the history, and the paid footer.
- A household member and an owner are treated the same, because eligibility belongs to the person, not the home.
- Signed out: sign-in preserving the destination, then the same landing.

INSTEAD OF
- Instead of a 404 or a "no longer available" page, land on the Mail root with one neutral line — because a 404 on a link the app sent last week reads as a broken product.
- Instead of a greyed or disabled Earn row, remove the row and close the gap — because an inert row promises something that isn't there.
- Instead of a skeleton row while eligibility loads, draw the final drawer without Earn — because a row that flashes and vanishes looks broken.
- Instead of "coming back soon" or any teaser, say Earn isn't available right now — because we can't date its return and must not claim it has ended.
- Instead of hiding the wallet from everyone, keep it read-only for eligible accounts — because locking someone out of their own money is the worst outcome here.
- Instead of an offers chip for eligible people, route them through the drawer's Earn Wallet row — because "offers available" invites earning that no longer exists.
- Instead of the "isn't available" line when the check failed, show Retry — because this person may hold a balance.
- Instead of a tinted error band for that retry, use InlineErrorRow on the base surface — because an old link must never look like an error page.

DONE WHEN
- Side by side, the two drawers differ by exactly one section and nothing else.
- No strip on any frame shows an offers chip, for anyone, online or offline.
- An old link never produces a 404, an error page or a tinted error band. The only error mark is InlineErrorRow's glyph when the check failed.
- Sam can still reach his $18.50 through the drawer, online and offline.
- A paid-out account still sees its history.
- Nothing on any frame invites anyone to earn or implies that Earn has ended or will return.

ARTBOARDS
1. f9-earn-removal · web-1440 · 01-mailbox-nav-both · light — both drawer variants side by side on one baseline grid.
2. f9-earn-removal · web-1440 · 02-status-strip-on-today-before-after · light — 3 chips above, 2 chips below.
3. f9-earn-removal · web-390 · 03-old-link-landing · light — Mail root, Mail tab selected, the neutral line with "Hide this". Inset: the hold after 1s (row skeleton, no Earn line).
4. f9-earn-removal · ios · 04-drawer-not-eligible · light — iOS drawer without Earn.
5. f9-earn-removal · android · 05-drawer-eligible · light — Sam's drawer with Earn Wallet $18.50. Inset: Maya's Android drawer without Earn, row-aligned.
6. f9-earn-removal · ios · 06-wallet-read-only · light — balance, two history rows, footer. Inset A: paid out in full ($0.00, rows captioned "Paid", paid footer). Inset B: the footer with "Ask about your balance" under it, labelled pending decision.
7. f9-earn-removal · ios · 07-eligibility-loading · light — drawer at final height, no Earn row, no skeleton.
8. f9-earn-removal · android · 08-offline-cached-strip · light — Maya offline: cached strip with two chips, no offers chip. Inset: Sam's offline drawer with the cached Earn Wallet row and the offline line.
9. f9-earn-removal · web-390 · 09-check-failed-old-link · light — Mail root with InlineErrorRow (no errorBg) and Retry.
10. f9-earn-removal · web-390 · 10-old-link-offline · light — cached Mail root with the offline line, no Earn line.
11. f9-earn-removal · web-390 · 11-drawer-not-eligible · light — the 390 drawer without Earn.
12. f9-earn-removal · android · 12-status-strip-on-today-after · light — two-up: the Android and iOS native strips on Today, each with two chips.
13. f9-earn-removal · android · 13-status-strip-eligible · light — Sam's strip on Today: the same two chips, no offers chip, no Earn chip.
14. f9-earn-removal · ios · 14-ax5-landing-and-drawer · light — the landing line, and the eligible drawer (Earn Wallet $18.50 plus 8 rows), at AX5.
15. f9-earn-removal · web-1440 · 15-greyscale · light — frame 1 in greyscale.
16. f9-earn-removal · web-1440 · 16-wallet-worst-case · light — $1,204.75 and 40 history rows.
17. f9-earn-removal · web-1440 · 17-mailbox-nav-both · dark — dark twin of frame 1.
18. f9-earn-removal · ios · 18-wallet-read-only · dark — dark twin of frame 6 (main frame, no insets).
19. f9-earn-removal · Notes — record:
- Invented strings: 3 mail pieces waiting; 2 offers available; Sam's $18.50 balance; both history labels and their dates ("Mail scan bonus" Fri 14 Aug, "Offer reward" Thu 2 Jul; not a referral payout, because F9 referrals now earn postcard invites); "Paid"; the footers; $1,204.75; 5:52 PM; "Hide this"; the landing line; "Ask about your balance".
- Any drawer rows or strip text that differ from the screenshots.
- Deviation from the design doc: the doc pushes the offers item for eligible accounts; this design removes the offers chip for everyone and routes eligible people through the drawer's Earn Wallet row.
- Deviation from research: research asked for a verb-led CTA back to a tab on the landing; dropped because the landing is the Mail root itself; "Hide this" is the only action.
- Omitted states: signed-out arrival (sign-in preserving the destination, then the same decision), plus any others.
- Engineering:
  - /earn/* redirects to the Mail root for accounts that are not eligible, replacing the design doc's 404.
  - Gate in both the Today payload and the native routers and drawers, defaulting to hidden, so native never flashes the row.
  - Drop the offers item from the Today payload for everyone, and ignore it in cached payloads.
  - Confirm that the Android pantopus://mailbox/earn branch exists.
  - Eligibility is cached per person, so offline eligible accounts keep their wallet.
  - Store the landing-line dismissal per account (server or synced preference).
- Open questions:
  - Does "Your balance stays here" match what really happens to balances, and is any payout path live?
  - Should the read-only wallet offer "Ask about your balance" to reach support? (Drawn as an inset in frame 6.)
  - Do pending (not yet available) Earn transactions exist? If so, they must count toward eligibility.

BATCH PLAN: Turn 1: artboards 1-6, then wait for "continue". Turn 2: artboards 7-12, then wait for "continue". Turn 3: artboards 13-18, then wait for "continue". Turn 4: artboard 19 (Notes).
