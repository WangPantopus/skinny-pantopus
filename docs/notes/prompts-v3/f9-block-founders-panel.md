# Block Founders (rank vs tier, slot meter, postcard allowance)
id: f9-block-founders-panel · platforms: web/ios/android · isNew: False · artboards: 23

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Block Founders · f9-block-founders-panel

TYPE: EXTENSION of the existing designed screen "Block Founders" (today the section under Place › Your block). This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed:
(1) The section moves to the Nearby tab.
(2) Rank and tier become two different shapes in two different rows.
(3) The postcard allowance becomes a counter above the address inputs.
(4) A postcard front/back preview sits above the send button.
(5) Place › Your block shrinks to one pointer row.
(6) The unlock meters lose their bars and "N of M" fractions and are stated in words (see CONTENT). The only fractions left are the SlotMeter's "2 of 5 open" and the allowance counter "N of 6 postcard invites left this week".
(7) The old tier line "Founding Neighbor · slot 3 of 5. Permanent.", the old teaser about a permanent founding rank kept forever, and any caption set in text.muted are all replaced by the strings in this prompt.
(8) The postcard composer moves directly under the tier block. Below it come the roster (first 3 rows, then "Show all N"), then the unlock meters. On phones the counter is the first thing under the tier block.
Keep every other existing element unchanged, including the four address inputs (Street address, City, ST, ZIP), except any progress bar or "N of M" fraction, which is removed.

ATTACH: the current Block Founders section on web 1440, web 390, iOS and Android; the current Place › Your block screen; the current Nearby tab; the Foundations board.

PLATFORMS & VIEWPORTS:
- Web 1440x900 with the left sidebar. Match the content width in the attached Nearby screenshot. Invite rewards and Block Founders sit in a 720-wide column. The cells map block below spans the full content width.
- Web 390x844 with the bottom tab bar.
- iOS 393x852.
- Android 412x915, Material 3.

WHERE IT LIVES & HOW PEOPLE ARRIVE: Nearby tab, directly under Invite rewards and above the cells map. Entry points:
(a) Nearby tab.
(b) The Place › Your block pointer row, which switches to Nearby and scrolls here.
(c) Invite rewards: "Go to postcard invites" on its hero, and its per-join row (Row A), scroll to the counter and move accessibility focus to it.
(d) "See your block" on the address-verified success screen. The rank is already assigned when the person arrives. The panel heading gets a one-time highlight fade and accessibility focus.
(e) Deep link /app/nearby?section=block.
(f) Redirects: the old web route /app/place/block and the place file's "Meet the block" row both land on /app/nearby?section=block, with the same landing as (d).
There is no push or widget entry: Founding and referral content is never pushed. The flows spec has no journey through here. The closest is flow-04 step 12, a locked Nearby control, so reuse its LockedActionRow wording.

WHO AND WHEN: Maya Chen, owner at HOME A, Mon 19 Oct 2026 at 6:10 PM. Her address was confirmed by postcard on Thu 8 Oct, which made her Block Founder #3 and one of the first 5 in the Founding window. Three neighbors have joined with her link, so she gets 6 postcard invites a week. She has already sent 2 and wants to send one to the house two doors down. Other viewers: Sam Ortega, a household member whose address is not verified (teaser frames); Jordan Lee at PLACE B (saved-place frame); Theo R., an invented neighbor on Fisher's Landing who verified after that block's window closed (rank-without-tier frame).

THE ONE JOB: Give each thing one name (the rank is kept, the tier is scarce and dated) and show this week's earned postcard allowance before it is spent.

FIRST FIVE SECONDS: First, the rank badge with the large numeral 3. Second, the separate Founding Neighbor block with its five-segment meter and date. Third, directly below, the counter "4 of 6 postcard invites left this week". Primary action: "Send postcard invite".

CONTENT: Use the house style FIXTURES. The deltas for this screen follow; list every one of them on the Notes artboard.
- Header: "Your block · Fircrest" and the caption "Around NE Larkspur Loop". Under it, the line "Address confirmed by postcard · Thu 8 Oct" with the ScopeChip "Your household" attached to that line only.
- Rank: overline "BLOCK FOUNDER", numeral "3", caption "Permanent" (see Notes item e). Spoken as "Block Founder number 3, Permanent."
- Tier, in its own row:
  - Title "Founding Neighbor" and the line "You're one of the first 5 homes verified on this block."
  - A SlotMeter reading "2 of 5 open", with 3 taken (yours is segment 3, labelled "You") and 2 open, plus the neutral pill "Closes Sun 25 Oct". The window opened Sun 4 Oct, so 15 of 21 days have passed.
  - A "What is this?" disclosure: "A badge for the first 5 homes verified here within 21 days of the first. It's a badge only: no money and no fee change. Anyone who verifies later still gets a Block Founder rank."
- Composer, "Send a postcard invite", directly under the tier block:
  - Counter above the inputs: "4 of 6 postcard invites left this week" · "3 base + 3 earned from neighbors who joined" · "Resets in 7 days · Mon 26 Oct" · link "See how you earn more", which scrolls to Invite rewards.
  - The four existing inputs, filled: Street address "2430 NE Larkspur Loop" · City "Vancouver" · ST "WA" · ZIP "98684".
  - Postcard preview, drawn with the text the printed card carries today.
    - Front, white text on a primary.600 card: "Your block is forming" / "Verified neighbors on your street are already comparing bills, flood costs, and more."
    - Back: "A verified neighbor on NE Larkspur Loop invited this address to Pantopus. 3 homes near you are already verified." / "See what your address already knows — flood risk, air quality, what neighbors pay for utilities — free, no account needed:" / "pantopus.com/start" / small print: "This invitation was mailed through Pantopus; the sender chose the address but never wrote this text, and your address was not shared with anyone. To never receive another: pantopus.com/no-mail/R8QW2T".
    - Caption under the preview: "We print your street, never your name or house number."
  - Button "Send postcard invite", with the caption "One postcard per address. We never send reminders."
- Roster, "Block Founders here": "#1 Marisol T. · verified Sun 4 Oct" · "#2 Ken A. · verified Tue 6 Oct" · "#3 You · verified Thu 8 Oct". For Sam, the third row reads "#3 Maya C. · verified Thu 8 Oct". Then the text button "See Fircrest on the map".
- Unlock meters, last, each as one line of words with no bar: "Real rents on your block · needs 8 more rent reports" · "Ten verified homes · needs 7 more verified homes" · "'Growing block' status · needs 22 more verified homes". An unlocked meter reads its label plus the word "Unlocked" in text.primary, with an open-padlock glyph (not a tick), never green text.
- Worst case, the densest week: a roster of 12 founders shows the first 3, then "Show all 12"; the rank numeral can be 2 digits (#12); and one postcard is already in flight this week ("Postcard invite on its way to 2426 NE Larkspur Loop · sent Mon 19 Oct" under the counter).

LAYOUT & VISUALIZATION:
- Order on every platform: header, rank, tier, composer, roster, unlock meters.
- Rank and tier are two shapes in two rows and never share a sentence:
  - Rank badge: a squared badge (radius md) on surface.sunken with the numeral set in h1.
  - Tier block: a card row with the SlotMeter spanning its width. Draw five bounded capsule segments, never round dots. Taken segments are solid primary.600. Open segments use a diagonal hatch in text.secondary ink. Show the numeral label and a 2px elapsed bar in neutral tokens. The date pill is surface.sunken with text.strong.
- Allowance glyph row, directly above the inputs: six postcard glyphs in two labelled groups. "Base" has 3 plain glyphs. "Earned" has 3 glyphs, each with a small "+" corner badge. Used glyphs are drawn first, each crossed by one horizontal line through its middle on a sunken fill, under the group label "Used 2". Never use diagonal lines on the glyphs. Draw glyph outlines in text.secondary ink. Mark used glyphs with the line, never with filled-versus-hollow.
- The preview is two side-by-side thumbnails at 3:2. Tapping one enlarges it in place. The back must show the opt-out small print legibly when enlarged.
- Window closed or full, for someone who holds the tier (Maya from Mon 26 Oct): keep the "Founding Neighbor" title and "You're one of the first 5 homes verified on this block.". Drop only the SlotMeter and the date pill, with no message.
- Window closed or full, for someone who does not hold the tier: drop the whole tier block, with no message.
- Slot lookup failed: leave the whole tier block out and draw no skeleton for it. A holder's title and line stay only if they came back from a successful lookup.
- Place pointer row: "Your block · Fircrest", the caption "Block Founders and postcard invites are in Nearby", and a chevron.
- Saved place (Jordan): no tier, no roster count, no composer. One plain row: "Block Founder ranks are for verified addresses. Claim this address, then verify it, to get one." with the text button "Claim this address".

INTERACTION, MOTION & HAPTICS:
- "Send postcard invite" places the order. On success, the counter updates to "3 of 6 postcard invites left this week", a third glyph gets the used line, the status line reads "Postcard invite on its way to 2430 NE Larkspur Loop", and the phone gives one light haptic tick.
- The preview back updates as the street changes.
- Disclosures expand in place in 200ms; under Reduce Motion they cross-fade.
- Disabled controls stay focusable and read out their reason. A tap on a disabled control shows the same reason.
- A typed address is never cleared on error.
- The pointer row transition is a tab switch plus one scroll.
- Landings from entry points (c), (d), (e) and (f) scroll once, fade a highlight and move accessibility focus to the target.

FOUNDATIONS COMPONENTS USED:
- SlotMeter, Block Founders panel variant, including its separate RankBadge.
- ScopeChip: "Your household" on the address-confirmed line for the viewer's home; "Saved place · Only you" for Jordan.
- LockedActionRow: the list-row variant for Sam; the pending variant for Sam while his postcard code is in the mail. For Jordan, use no LockedActionRow: draw the plain row with the "Claim this address" link, as the LockedActionRow rules require for a saved place.
- StatusChip is not used; the date lives only in the SlotMeter pill.
- InlineErrorRow (on errorBg only for a failed send), WarmingSkeleton (row skeleton), FreshnessLine and OfflineNotice.

ACCESSIBILITY:
- Reading order: header, rank, tier, counter, inputs, preview, button, roster, unlock meters.
- SlotMeter: "Founding Neighbor slots: 2 of 5 open, closes Sunday October 25."
- Glyph row: "6 postcard invites this week: 3 base, 3 earned, 2 used, 4 left."
- Unlock meters are plain text lines, read as written; the padlock glyph is decorative.
- Preview images have alt text that repeats their printed words, including the opt-out line.
- The status line and errors are polite live regions.
- Targets are 44pt on iOS, 48dp on Android with 8dp gaps, and 44px on web.
- Rank versus tier is carried by shape plus words. Used glyphs are carried by the line plus the caption.

COPY: "Send a postcard invite" · "Street address" · "City" · "ST" · "ZIP" · "See how you earn more" · "What is this?" · "See Fircrest on the map" · "Show all 12" · "Used 2" · "Unlocked" · "Postcard invite on its way to 2430 NE Larkspur Loop"
- Exhausted: "0 of 6 postcard invites left this week" · "Resets in 7 days · Mon 26 Oct" · "You've used this week's postcards."
- Nearly spent: "1 of 6 postcard invites left this week". Fresh week: "6 of 6 postcard invites left this week".
- Send error: "We couldn't send to 2430 NE Larkspur Loop. This didn't use one of your postcards. Check the address and try again." · "Try again"
- Refused address: "We can't send a postcard invite to this address. This didn't use one of your postcards. Try a different address."
- Rate-limited: "You can send your next postcard at 6:22 PM. A short wait between postcards keeps any one block from getting a pile of them."
- Teaser (Sam): "Address verification needed to get a Block Founder rank · Verify address" · "Address verification needed to send postcard invites · Verify address"
- Pending teaser (Sam): "We're checking your postcard code — expected Thu 22 – Thu 29 Oct"
- No founders yet: "No Block Founders here yet. The first home verified here becomes Block Founder #1."
- Saved place (Jordan): "Block Founder ranks are for verified addresses. Claim this address, then verify it, to get one." · "Claim this address"
- Errors and offline: "We couldn't load Block Founders just now. Retry" · "You're offline · as of 7:04 AM" · "Sending a postcard needs a connection."

EDGE CASES:
- A long street wraps to two lines in its input and on the preview back.
- A 2-digit rank and a 12-row roster (3 shown, then "Show all 12").
- Holder after close: Maya from Mon 26 Oct keeps her title and line; only the meter and pill go.
- Rank without tier: Theo R., "Your block · Fisher's Landing", Block Founder #6, verified Wed 14 Oct after that block's window closed. No tier block at all.
- No founders on the block: the teaser layout on Forest Home.
- The allowance at 6 of 6, at 1 of 6, and at 0 of 6 with the reset day.
- Refused addresses: an address that already got a postcard in the last 90 days, an address that opted out, or an address already on Pantopus. All three get the same neutral message and never say why, because saying why is a claim about a neighbor's home.
- Rate-limited: the send button is disabled but focusable, with the rate-limit sentence under it.
- Slow network: skeletons show everywhere except the tier block.
- Offline: the composer is disabled, with "Sending a postcard needs a connection." under it.
- Tiers: address verified (Maya); household member not verified (Sam, teaser); Sam with a code in the mail (pending teaser); saved place only (Jordan, claim first). In Jordan's frame the header reads "Your block · near NE Birchfield Ct" with the ScopeChip "Saved place · Only you".

INSTEAD OF:
- Instead of rank and tier as matching chips in one sentence, draw a squared numeral badge and a separate meter row — because if they share a shape, the rename changes nothing a reader can see.
- Instead of a warning-tinted "closes in 6 days" countdown, draw the neutral pill "Closes Sun 25 Oct" — because a true deadline for a badge must not borrow the alarm styling kept for civic and bill dates.
- Instead of filled versus hollow segments, draw solid versus hatched capsules with "2 of 5 open" — because filled versus hollow means provenance only.
- Instead of an empty or skeleton meter on a failed lookup, draw no tier block at all — because an empty meter reads as five open, which is a false promise.
- Instead of removing a holder's Founding Neighbor title when the window closes, keep the title and drop only the meter and pill — because fail-closed withdraws the scarcity claim, not a badge someone already holds.
- Instead of unlock meters as "4 of 10" bars above the composer, write what is still needed in words at the bottom — because completion fractions are banned and the composer is the action.
- Instead of an allowance under the button, a single address field, or a preview with new wording, draw the counter above the four inputs and a preview of the card's real text above the button — because people should see what they have and exactly what goes out in their name before sending.
- Instead of a live "12 minutes" countdown, draw the fixed time "6:22 PM" — because countdowns pressure people.

DONE WHEN:
- A first-time reader can say which title is kept and which one ends on Sun 25 Oct.
- On a phone, "4 of 6 · 3 base + 3 earned" is the first thing under the tier block, readable before sending, and matches Invite rewards exactly.
- No bar, ring or "N of M" fraction appears anywhere except the SlotMeter's "2 of 5 open" and the allowance counter "N of 6 postcard invites left this week".
- The preview matches the printed card word for word, including the opt-out line.
- The tier block vanishes, with no message, for a non-holder when the window is closed or the lookup failed; a holder keeps the title.
- Sam sees the roster and an explained path, with no slot promise. Jordan sees one honest row, not a locked control.
- The verified success screen's "See your block" and the old /app/place/block route land here with focus on the heading.
- Every frame reads correctly in greyscale.

ARTBOARDS:
1. f9-block-founders-panel · web-1440 · 01-verified-rank-and-tier · light — the dense default: header, rank, tier, composer (counter 4 of 6, glyphs, four inputs, preview, button), roster, unlock meters in words.
2. f9-block-founders-panel · ios · 02-after-send · light — iOS right after sending: counter "3 of 6", three used glyphs, status line "Postcard invite on its way to 2430 NE Larkspur Loop".
3. f9-block-founders-panel · android · 03-verified-rank-and-tier · light — frame 01 on Android.
4. f9-block-founders-panel · web-390 · 04-postcard-preview-open · light — the back thumbnail enlarged in place, opt-out line legible.
5. f9-block-founders-panel · ios · 05-unverified-teaser · light — Sam: roster with "#3 Maya C." plus two LockedActionRows, no meter.
6. f9-block-founders-panel · ios · 06-pending-code-teaser · light — Sam with his code in the mail: the pending LockedActionRow, no link.
7. f9-block-founders-panel · ios · 07-window-closed-holder · light — Maya from Mon 26 Oct: rank, Founding Neighbor title and line, no meter, no pill.
8. f9-block-founders-panel · web-390 · 08-rank-without-tier · light — Theo R., Block Founder #6 on Fisher's Landing, no tier block.
9. f9-block-founders-panel · web-390 · 09-no-founders-yet · light — the teaser layout on Forest Home with the empty roster sentence.
10. f9-block-founders-panel · ios · 10-allowance-exhausted · light — 0 of 6, reset day, disabled send with its reason.
11. f9-block-founders-panel · android · 11-send-error · light — the address is kept, the error sits on errorBg.
12. f9-block-founders-panel · web-390 · 12-refused-address · light — the neutral refusal, the address kept, the counter unchanged.
13. f9-block-founders-panel · web-390 · 13-rate-limited · light — send disabled but focusable, with the rate-limit sentence "at 6:22 PM" under it.
14. f9-block-founders-panel · ios · 14-loading · light — row skeletons, no tier skeleton.
15. f9-block-founders-panel · android · 15-error · light — the panel InlineErrorRow.
16. f9-block-founders-panel · web-1440 · 16-place-pointer-row · light — Place › Your block reduced to one row.
17. f9-block-founders-panel · ios · 17-offline · light — composer disabled, age shown.
18. f9-block-founders-panel · web-390 · 18-saved-place-only · light — Jordan at PLACE B: header, ScopeChip, one plain row with "Claim this address".
19. f9-block-founders-panel · ios · 19-ax5 · light — badge above the tier, inputs stacked, glyphs wrapping, preview stacked.
20. f9-block-founders-panel · web-1440 · 20-greyscale · light — frame 01 in greyscale.
21. f9-block-founders-panel · web-1440 · 01-verified-rank-and-tier · dark — the dark twin of 01.
22. f9-block-founders-panel · ios · 10-allowance-exhausted · dark — the dark twin of 10.
23. Notes — assumptions; every invented string (Fircrest, Fisher's Landing, Forest Home, Theo R., the roster names and dates, the neighbor addresses, the opt-out code R8QW2T, the rent-report count, the pending date range, Jordan's header); omitted states (6 of 6 and 1 of 6 are captions only); the alternate rank caption "Yours while you live here" drawn beside the badge; and these items:
(a) whether the allowance resets on a fixed Monday or 7 days after each send;
(b) whether a clearer name than "Founding Neighbor" should be tested;
(c) a Founding window never restarts or extends silently, and a new window for the same block needs a stated reason;
(d) assumption: anyone who verifies later still gets a rank, since ranks are assigned first-come as the next number — confirm;
(e) ship "Permanent" only if the rank survives verification expiry; otherwise use "Yours while you live here". Engineering must confirm before build;
(f) the send error no longer says the postal service found no delivery point, which would help fix a typo but states a fact about a neighbor's address — decide;
(g) Jordan's row avoids "homes" and uses "Claim" only in "Claim this address", which the LockedActionRow rule requires;
(h) the preview must render from the same template as the printed card, so any wording change ships in both at once;
(i) the card back prints "3 homes near you are already verified.", a count under the server's floor of 10, to a stranger — decide whether it stays;
(j) which scope string belongs on the Block Founders header, since rank, allowance and link are per person and the roster names other households;
(k) the mailed date and code expiry for Sam's pending state live in the verify sheet, not here.

BATCH PLAN: Turn 1: artboards 1-6, then wait for "continue". Turn 2: artboards 7-12, then wait for "continue". Turn 3: artboards 13-18, then wait for "continue". Turn 4: artboards 19-23.
