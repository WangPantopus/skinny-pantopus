# Earn removed — drawer, status strip, calm landing
id: f9-earn-removal · platforms: web/ios/android · isNew: False · frames: 9

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Mailbox nav, hub status strip, and the /earn landing
PLATFORMS / VIEWPORTS: web 1440×900 and 390×844 · iOS 393×852 · Android 412×915
THIS IS: an EXTENSION of three existing designed Pantopus surfaces — the mailbox drawer/nav, the hub status strip (its inbox_offers item), and the /earn wallet route. These already exist and are already designed in the Pantopus design system — open them, keep everything, and change only what is listed below.

WHERE IT LIVES: Mail tab → mailbox drawer (the Earn section); Today tab → hub status strip (the inbox_offers chip); plus the /earn deep link reached from old bookmarks and old pushes.

THE ONE JOB: take the cash-Earn promise off every surface for the users who never earned, without hiding money from the few who did.

CONTENT (exact strings, this density):
- Mailbox drawer rows, ineligible variant: Mail Day · Scan mail · Mail pieces (12) · Forwarding · Mailbox settings
- Eligible variant: the same rows plus Earn · $18.50
- Hub status strip today, before: "3 mail pieces waiting" · "Recycling Thursday" · "Earn $12 this week" — after: "3 mail pieces waiting" · "Recycling Thursday"
- Ineligible arrival at /earn → mailbox root carrying one neutral line: "Earn has closed. Everything else in your mailbox is where you left it."
- Eligible wallet, read-only: balance $18.50 · "Mail scan bonus · Aug 14, 2026 · $6.00" · "Referral payout · Jul 2, 2026 · $12.50" · footer "Payouts are paused. Your balance stays here."

THE VISUALIZATION DECISION: the drawer simply has one fewer row — no gap, no stale badge, no orphaned section header. Draw both variants SIDE BY SIDE in the same frame on a shared baseline grid, aligned row-for-row, so a reader can verify that the rows below Earn shift up by exactly one row height and nothing is left behind: no divider stranded above Mailbox settings, no 48px void, no section label "Earn" with nothing under it. Label the eligible variant as the exception, not the default. The status strip re-flows the same way: three chips become two chips that redistribute across the strip's full width — the strip never renders a hole or a ghost chip. The ineligible landing is the ordinary mailbox root with one neutral line above the list in the standard info-line slot, at bodySmall, not an error banner.

STATES TO DRAW (one frame each, 9 total):
1. Web desktop mailbox nav — ineligible and eligible variants side by side
2. Web mobile Mail tab drawer — ineligible
3. Today hub status strip — before (3 chips) and after (2 chips) in one frame
4. iOS mailbox drawer — ineligible
5. Android mailbox drawer — eligible (the exception)
6. Eligibility loading — drawer at its FINAL height with no Earn row and no skeleton row reserved for one
7. Ineligible arrival landing — web mobile mailbox root with the one neutral line
8. Eligible wallet, read-only — iOS
9. Offline with a cached payload still carrying inbox_offers — Android, and still no Earn chip (gate on the flag, not the cache)

UX REASONING TO KEEP: a 404 on a route the app itself linked last week reads as a broken product, not a policy — and locking someone out of their own pending payout to tidy the IA would be the worst outcome here. Default to hidden while eligibility is unknown, because native will otherwise flash the row before the payload arrives.

DO NOT: do not draw a 404, a "no longer available" page, an empty-state illustration where the row was, a "coming back soon" teaser, or a greyed/disabled Earn row; do not reserve a skeleton row during eligibility loading; do not leave a badge, divider or section header behind.
