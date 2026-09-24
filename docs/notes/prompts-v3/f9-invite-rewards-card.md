# Invite rewards (what a join actually pays)
id: f9-invite-rewards-card · platforms: web/ios/android · isNew: True · artboards: 19

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Invite rewards · f9-invite-rewards-card

TYPE: NEW card, placed inside the existing designed screen "Nearby". That host screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed: add this card as the first card on the tab.
- On web the card is entirely new; web has no referral UI today.
- On iOS and Android, remove the referral block from the profile insight cards and leave one pointer row in its place: "Invite rewards" with the caption "Your link and rewards are in Nearby" and a chevron that switches to Nearby and scrolls here. Match the old block's frame, padding and type for this card, and treat the contents below as new.

ATTACH: the current Nearby tab on web 1440, web 390, iOS and Android; the current iOS and Android profile referral block; the Foundations board.

PLATFORMS & VIEWPORTS:
- Web 1440x900 with the left sidebar. Match the content width in the attached Nearby screenshot. Invite rewards and Block Founders sit in a 720-wide column. The cells map block below spans the full content width.
- Web 390x844 with the bottom tab bar.
- iOS 393x852.
- Android 412x915, Material 3.

WHERE IT LIVES & HOW PEOPLE ARRIVE: The top of the Nearby tab, above Block Founders and the cells map. Entry points:
(a) Opening the Nearby tab.
(b) "See what this earns" on the confirmation after sharing the link.
(c) "See how you earn more" under the Block Founders counter. It scrolls here, fades a highlight once and moves accessibility focus to the card title.
(d) Deep link /app/nearby?section=rewards: the same landing as (c). A signed-out web visitor is sent to sign in and returns to this card afterwards.
(e) The profile pointer row on iOS and Android.
The card hands off in two ways. "Go to postcard invites" (the hero text button, and Row A) scrolls to the Block Founders counter; it never sends anything. "See the map" (Row B) goes to the cells map with the viewer's area open. The card is never pushed, and no widget shows it. No flows-spec journey passes through it.

WHO AND WHEN: Maya Chen, owner at HOME A, Mon 19 Oct 2026 at 6:10 PM. Her address was confirmed by postcard on Thu 8 Oct. She shared her link in September. Three neighbors have joined since, and she opens Nearby to see what that got her. Earlier states use the same Maya: Fri 9 Oct (no one has joined yet), Sat 10 Oct (Dana joined) and Tue 13 Oct at 6:10 PM (Hannah K. joined 3 minutes ago; the cached counts still read 2). In the unverified frame the viewer is Sam Ortega, a household member whose address is not verified.

THE ONE JOB: Say honestly what each neighbor who joins pays, right where the link is copied.

FIRST FIVE SECONDS: First, the link row with "Copy link". Second, the hero "6 postcard invites this week". Third, the two unlocked reward rows. Primary action: "Copy link", the only filled button in the card.

CONTENT: Use the house style FIXTURES. The deltas for this screen follow; list every one of them on the Notes artboard.
- Title: "Invite rewards", with the ScopeChip sentence "Only you will see this."
- Link row: label "Your link for neighbors" · "pantopus.com/join/maya-4k2p" · "Copy link" · "Share link". Below it: "People who open your link see that you can earn rewards when they join, and they get their own address reading." · "Preview what they see". Sam's link: "pantopus.com/join/sam-7h3q".
- Hero (h2): "6 postcard invites this week". Underneath: "3 base + 3 earned · 4 left · resets in 7 days · Mon 26 Oct" · the text button "Go to postcard invites".
- Stage ledger: "Sent your link 11" → "Joined 3" → "Address verified 1", with the caption "Rewards count neighbors who join." A "See who joined" disclosure opens "Dana · joined Sat 10 Oct" · "Luis M. · joined Mon 12 Oct" · "Hannah K. · joined Tue 13 Oct".
- Reward rows. They come from the server, and each is one row. There are three:
  - Row A, unlocked: "Each neighbor who joins: +1 postcard invite every week, up to +3" · "Earning +3, the most" · a chevron. The whole row goes to the Block Founders counter.
  - Row B, unlocked: "3 neighbors join: details for each area on the map, like posts and Founding slots" · "Unlocked" · "See the map".
  - Row C, next locked: "10 neighbors join: Block Builder badge" · "7 more neighbors who join".
  - With three joins there is nothing beyond the next locked row, so no "More rewards" row shows.
- The "Preview what they see" sheet, titled "What your neighbors see": "Maya invited you to Pantopus" · "See what's on public record for your address: flood, wildfire, air and radon." · "Maya can earn rewards from Pantopus, like extra postcard invites, when neighbors join." · "Type your address". Visible "Done".
- Worst case: a 14-word reward label and a 4-word label both fit in two lines without reflow. A fourth row sent by the server fits the same rhythm. Large counts: "Sent your link 140 → Joined 26 → Address verified 9".

LAYOUT & VISUALIZATION:
- Order: the link and the payoff sit in one card. Link row on top, then the hero, then the ledger, then the reward rows. The card never opens on what the person has not got.
- "Copy link" is the only filled button. "Go to postcard invites" is a text button in primary.700, never filled.
- The ledger is three labelled steps joined by arrows, each with its count. Counts sit next to their words. It has no bar, ring or percentage. At AX5 it stacks vertically.
- Unlocked rows sit on surface.base with a 3px primary.600 left rail, a verb or chevron, and one tap target. Locked rows sit on surface.sunken with a 3px left rail in text.secondary ink, and their requirement is printed in text.strong where the chevron would be.
- Show the unlocked rows plus the next locked row. Collapse anything after that into "More rewards (N)".
- Zero joins (Fri 9 Oct): the hero reads "3 postcard invites this week" with "3 base · 3 left · resets in 3 days · Mon 12 Oct". The ledger reads "No one has used your link yet." Row A is next: "1 more neighbor who joins". Then "More rewards (2)".
- One join (Sat 10 Oct): the hero reads "4 postcard invites this week" with "3 base + 1 earned · 4 left · resets in 2 days · Mon 12 Oct". The ledger reads "Sent your link 11 → Joined 1 → Address verified 0". Row A reads "Earning +1 · up to +3". Row B is next: "2 more neighbors who join". Then "More rewards (1)", which expands to Row C.
- Stale (Tue 13 Oct, 6:10 PM): the ledger reads "Sent your link 11 → Joined 2 → Address verified 1". The hero reads "5 postcard invites this week" with "3 base + 2 earned · 5 left · resets in 6 days · Mon 19 Oct". Row A reads "Earning +2 · up to +3". Row B is next: "1 more neighbor who joins". Then "More rewards (1)". The FreshnessLine reads "Updated 4m ago · Refresh", with "New joins can take up to 5 minutes to show." under it.
- All unlocked (26 joins): Rows A, B and C all read "Unlocked"; Row A reads "Earning +3, the most". Row C has no chevron and no destination.
- Not address-verified (Sam): the hero reads "Postcard invites need a verified address", with the LockedActionRow "Address verification needed to send postcard invites · Verify address" in place of the counts and the text button. Row A still states the formula and "1 more neighbor who joins", with no chevron. The link row shows Sam's link and is otherwise unchanged.
- Saved place only (Jordan): identical to Sam's frame, except that the text button "Claim this address" replaces the LockedActionRow. The ScopeChip sentence is unchanged.
- Degrade: if the rewards data fails, show the link row with "Copy link" and an InlineErrorRow beneath it. The link works in every state.
- Profile pointer row (iOS and Android): one row among the existing profile insight cards: "Invite rewards" · "Your link and rewards are in Nearby" · chevron.

INTERACTION, MOTION & HAPTICS:
- "Copy link" copies the link and shows "Link copied" as a status message, with no haptic.
- "Share link" opens the system share sheet with the title "See what's on record for your address". It is never a custom chooser. Cancelling is neutral.
- "Go to postcard invites" and Row A scroll to the Block Founders counter once, fade a highlight and move accessibility focus to it.
- An unlocked row with a destination is one tap target and goes there. A locked row expands in place with one sentence about the reward.
- Disclosures take 200ms. Under Reduce Motion they cross-fade.
- The preview sheet has "Done" and closes with Back or Escape.
- No confetti or count-up animation when a tier unlocks: the row simply switches to unlocked.
- "Refresh" reloads the counts in place without skeletons.
- The profile pointer row switches to Nearby and scrolls here once.

FOUNDATIONS COMPONENTS USED:
- ScopeChip, footer sentence form: "Only you will see this."
- TextActionRow, for "Share link" and "Preview what they see", including its copied state.
- FreshnessLine: "Updated 4m ago", plus a new stale variant "Updated 4m ago · Refresh" (record it on Notes).
- LockedActionRow, list-row variant, for the unverified viewer only.
- WarmingSkeleton (row skeleton), InlineErrorRow and OfflineNotice.
- SlotMeter is not drawn here; Founding details live in Block Founders.

ACCESSIBILITY:
- Reading order: title, link, copy, share, disclosure, hero, go to postcard invites, ledger, rows, more.
- Ledger: "11 neighbors sent your link, 3 joined, 1 with a verified address."
- Each row is one element, for example "10 neighbors join: Block Builder badge. Locked. 7 more neighbors who join." Row A is spoken "Each neighbor who joins: plus 1 postcard invite every week, up to 3. Earning 3, the most. Go to postcard invites, link." Row B is spoken "3 neighbors join: details for each area on the map, like posts and Founding slots. Unlocked. See the map, link."
- The link is spoken letter by letter on request.
- "Link copied" and "Updated" are polite live regions.
- Landings move accessibility focus to the card title.
- Targets are 44pt on iOS, 48dp on Android with 8dp gaps, and 44px on web.
- Locked versus unlocked shows as surface, rail and words, never opacity alone.

COPY: "Invite rewards" · "Only you will see this." · "Your link for neighbors" · "Copy link" · "Link copied" · "Share link" · "Preview what they see" · "Go to postcard invites" · "Sent your link" · "Joined" · "Address verified" · "Rewards count neighbors who join." · "No one has used your link yet." · "See the map" · "Unlocked" · "See who joined" · "More rewards (2)" · "More rewards (1)" · "Show fewer" · "Updated 4m ago · Refresh" · "New joins can take up to 5 minutes to show." · "We couldn't load your rewards just now. Retry" · "You're offline · as of 7:04 AM" · "Sharing needs a connection." · "Postcard invites need a verified address" · "Address verification needed to send postcard invites · Verify address" · "Claim this address" · "Your link and rewards are in Nearby" · "Done"

EDGE CASES:
- A long link wraps rather than truncating.
- Large counts, such as "Sent your link 140 → Joined 26 → Address verified 9".
- Zero, one, stale and all unlocked each get their own frame, with the values in LAYOUT.
- Slow network: the link row shows first and the rest shows row skeletons.
- Offline: "Copy link" stays enabled; "Share link" is disabled with "Sharing needs a connection."
- Not address-verified (Sam) and saved-place-only (Jordan) viewers get the variants in LAYOUT; they never see a postcard count they cannot send.
- Signed out on web: the deep link goes to sign-in and returns here.
- The card never shows cash, Earn, priority matching or gig matching.

INSTEAD OF:
- Instead of a list of every locked tier with distant counts, draw the unlocked rows, the next locked row and "More rewards (N)" — because far-off goals mostly record a shortfall.
- Instead of "An extra postcard invite this week", write "+1 every week, up to +3", and "Earning +1 · up to +3" rather than "+1 of up to +3" — because the reward repeats and has a cap, and nothing may read as a completion fraction.
- Instead of a 25-join tier or "6 postcard invites a week permanently", draw the three served tiers with "Block Builder badge" at 10 — because at 3 joins the person already has 6 a week, and the design doc renamed tier 4.
- Instead of "3 joined · 11 invited", a percentage, ring or progress bar, draw the stages Sent your link → Joined → Address verified with counts and "7 more neighbors who join" — because progress must match what counts, and "Invite" already means a household invitation.
- Instead of dimming locked rows, draw a sunken row with its requirement in words — because a locked row states a requirement rather than showing a faded promise.
- Instead of "Maya gets an extra postcard invite each week when you join", write "Maya can earn rewards from Pantopus, like extra postcard invites, when neighbors join." — because Maya is already at the +3 cap, and a reward behind a recommendation must be disclosed accurately.
- Instead of a filled "Send a postcard invite" button on the hero, draw the text button "Go to postcard invites" and make Row A a whole-row target — because it only scrolls to the composer, and the card has one filled action: Copy link.
- Instead of a leaderboard, a prize draw, confetti, the keeper, or "homes for every area", draw plain counts and rows and "details for each area on the map" — because rewards here are factual, not a game, and the map never shows a neighbour's home.

DONE WHEN:
- In five seconds a reader can copy the link and say what they already earned (6 a week, 3 of them earned).
- "Copy link" is the only filled button, and nothing labelled "Send" appears on the card.
- The allowance numbers match Block Founders exactly ("4 left", "3 base + 3 earned", "resets in 7 days · Mon 26 Oct").
- Rows A and B land on real screens: the counter and the map.
- No viewer is shown a postcard allowance they cannot send.
- The zero state still feels usable and not like a failure.
- The card works with the rewards data failed.
- Every frame reads correctly in greyscale.

ARTBOARDS:
1. f9-invite-rewards-card · web-1440 · 01-three-joined · light — the dense default at the top of Nearby: link, hero with the text button, ledger, rows A and B unlocked, Row C locked, Block Founders peeking below.
2. f9-invite-rewards-card · ios · 02-three-joined · light — the same on iOS, with the "Link copied" status showing under the link row.
3. f9-invite-rewards-card · android · 03-three-joined · light — the same on Android.
4. f9-invite-rewards-card · web-390 · 04-none-joined · light — Fri 9 Oct, the realistic pilot state, "More rewards (2)".
5. f9-invite-rewards-card · ios · 05-one-joined · light — Sat 10 Oct, "Earning +1 · up to +3", "More rewards (1)".
6. f9-invite-rewards-card · web-390 · 06-all-unlocked · light — 26 joins, three unlocked rows, "Sent your link 140".
7. f9-invite-rewards-card · ios · 07-who-joined-and-more-expanded · light — the one-join state with "See who joined" and "More rewards (1)" both open.
8. f9-invite-rewards-card · web-390 · 08-join-preview-sheet · light — "What your neighbors see".
9. f9-invite-rewards-card · ios · 09-loading · light — link row plus row skeletons.
10. f9-invite-rewards-card · android · 10-error · light — link row plus InlineErrorRow.
11. f9-invite-rewards-card · web-390 · 11-stale-after-join · light — Tue 13 Oct: Joined 2, 5 invites, Row B "1 more neighbor who joins", "Updated 4m ago · Refresh".
12. f9-invite-rewards-card · ios · 12-unverified-viewer · light — Sam: hero replaced by the LockedActionRow, Row A with no chevron, link row with pantopus.com/join/sam-7h3q. Jordan (saved place only) is identical except that "Claim this address" replaces the LockedActionRow; the ScopeChip sentence is unchanged.
13. f9-invite-rewards-card · android · 13-offline · light — copy enabled, share disabled with its reason.
14. f9-invite-rewards-card · ios · 14-ax5 · light — rows stacked, ledger vertical.
15. f9-invite-rewards-card · web-1440 · 15-greyscale · light — frame 01 in greyscale.
16. f9-invite-rewards-card · ios · 16-profile-pointer-row · light — the profile insight cards with the single "Invite rewards" pointer row where the referral block was.
17. f9-invite-rewards-card · web-1440 · 01-three-joined · dark — the dark twin of 01.
18. f9-invite-rewards-card · web-390 · 04-none-joined · dark — the dark twin of 04.
19. Notes — assumptions; every invented string (both links, the names, the join dates, the counts 11, 140, 26 and 9, the share title, the preview copy, the profile pointer row, the ledger label "Sent your link"); the new FreshnessLine stale variant; omitted states (Jordan's frame, described under frame 12); and these items:
(a) "Only you will see this." is account scope, not address scope — confirm this use of the sentence form;
(b) the Foundations glossary lists Block Builder as a 25-join tier, but the served tier is 10 joins — fix the glossary;
(c) the unlocked Block Builder row has no destination yet;
(d) which stage counts as a join;
(e) whether the join page names the sender;
(f) whether joins before address verification count toward the allowance;
(g) the recipient disclosure is written once for every sender, including those at the +3 cap;
(h) server dependency: the rewards data needs a count of joined neighbors with a verified address, and it must return an error instead of zeros on failure, or the zero state will show in place of the error state;
(i) Row B's wording follows the cells map decision on the server's floor of 10 for home counts; update it if that floor changes;
(j) "Invite" in the glossary means a household invitation, while this card is titled "Invite rewards" for neighbor referrals, and this account also has a pending household invite (priya@example.com). Should the glossary add "Invite rewards — referral rewards; not a household invite"? Is "Sent your link" the right first-step label?

BATCH PLAN: Turn 1: artboards 1-6, then wait for "continue". Turn 2: artboards 7-12, then wait for "continue". Turn 3: artboards 13-18, then wait for "continue". Turn 4: artboard 19.
