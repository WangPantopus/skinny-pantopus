# Claimed — what came with you
id: f1-claim-receipt · platforms: web/ios/android · isNew: False · artboards: 22

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Claimed — what came with you · f1-claim-receipt

TYPE: EXTENSION of the existing designed screen "Verified success" (the post-claim and post-verify success screen). This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed. Keep its success headline and subline exactly as they are.

ATTACH:
- The existing Verified success screen on web 1440, web 390, iOS and Android.
- The place file (Place tab) on web 1440, showing its top banner slot and its fact rows.
- Today with the "Saved place · Only you" chip, for reference.

PLATFORMS & VIEWPORTS: Web 1440x900 with the left sidebar. Web 390x844. iOS 393x852. Android 412x915.

WHERE IT LIVES & HOW PEOPLE ARRIVE: Place tab. People reach it in four ways.
1. The claim-and-verify flow ends here when the address is confirmed (drawn case: the postcard code is accepted). In that same step the server creates the home, copies the saved place's pickup day, dates and keeper to it, and removes the duplicate saved-place entry.
2. The first time the place file opens after a claim, its banner slot shows the one-time claim receipt banner (LandingBannerSlot), which links here. In the slot's precedence it sits after invite and reissue and before compare arrival: invite > reissue > claim receipt > compare arrival > mailbox arrival > setup > verify.
3. From then on, the place file row "What moved when you claimed" opens the same manifest as a Place-tab page with that title.
4. The deep link /app/place?verified=1 still shows the receipt later.
What this screen receives: the list of carried items, any item that failed to move, and the people in the household (at the moment of claim, only the claimer). What it hands on: Today now uses the home (same sections, no chip). Each date keeps its own visibility control (Only you / Household) in the Date sheet.
Only the person who claimed sees this receipt; people who join later never get it.

WHO AND WHEN: Mon 19 Oct, 6:10 PM. On Mon 28 Sep Maya Chen saved HOME A. She confirmed Tuesday as her pickup day, entered two dates and named Ollie. She requested a postcard and has just typed its code. The home is created now, so nobody else is in the household yet. Delta: Sam Ortega joins on Wed 21 Oct after her invitation; the revisited-receipt frames are drawn on Mon 26 Oct, when he is a member.

THE ONE JOB: Name every fact that moved from the saved place to the home, and ask before the one privacy change the move causes.

FIRST FIVE SECONDS:
1. The eye hits the existing headline first, then the summary sentence.
2. Second, the manifest rows with their scope pairs and scope captions.
3. Third, the consent question. Its two peer buttons are the actions that matter here.

CONTENT (fixtures apply; the deltas are below)
Caption under the existing headline: "Address confirmed by postcard · Mon 19 Oct".
Summary line: "Your pickup day, 2 dates and Ollie came with you."
Section label: "Came with you". Header: the caption word "Was" before the ScopeChip "Saved place · Only you" (struck state), then the caption word "Now" before "Your household".
Manifest, one row per carried item. The count in the summary always equals the rows drawn.
- Pickup day · "Tuesday · garbage every week, recycling every other week · next recycling tomorrow". Caption: "Everyone in this household will see this." Scope pair: Only you → household. The pickup day is shared by the address.
- Lease ends · "in 163 days · Wed 31 Mar 2027". Caption: "Notice due Mon 1 Mar 2027 · reminder Sat 30 Jan 2027". Scope pair: Only you → household (pending). The linked Notice deadline row moves with its lease row and is shown as this caption; it is not counted as a separate date.
- Warranty ends · "Water heater · in 54 days · Sat 12 Dec 2026". Scope pair: Only you → household (pending).
- Ollie (your keeper) · "Otter". Caption: "Everyone in this household will see this." Scope pair: Only you → household.
Consent block at the moment of claim (nobody else has joined):
- Question: "Share the 2 dates you entered with people who join this household?"
- Caption: "It's just you here for now. Until you choose, only you will see them. You can change this for each date later."
- Two peer buttons: "Share with the household" and "Keep them private to me".
Consent block on the revisited receipt, Mon 26 Oct (Sam has joined):
- Question: "Share the 2 dates you entered with Sam?"
- Caption: "Until you choose, only you will see them. You can change this for each date later."
- Rows on that day: Lease ends "in 156 days · Wed 31 Mar 2027"; Warranty ends "Water heater · in 47 days · Sat 12 Dec 2026"; Pickup day "Tuesday · garbage every week, recycling every other week · next recycling in 8 days · Tue 3 Nov".
Below the manifest:
- A FactCount line "11 on file", with category pips and the link "See your place file". It is not a manifest row.
- Closing line: "Today now uses this home."
Worst case (frame 8): a failed item with a long name, "Tankless water heater and recirculation pump", whose row wraps to two lines at 390, plus the adjusted counts.

LAYOUT & VISUALIZATION: This is a short receipt, not a celebration.
Order, top to bottom: existing seal and headline (its reveal plays once; under Reduce Motion it is static) → the confirmation caption → existing subline → summary → "Came with you" manifest → consent block → FactCount line → closing line → the existing "Now available" list → "Go to your place".
"Go to your place" is an outlined secondary button while a choice is pending. It becomes a filled button after a choice. Leaving through it, or any other way, keeps the dates private.
Change only these two host tokens: the filled button → primary.700; the "Now available" overline → text.secondary.
The revisited page (from the place file row) has the title "What moved when you claimed", the confirmation caption, the summary, the manifest, the consent block if still pending (or the result line once chosen), and the FactCount line. It has no seal, no reveal, no "Now available" list, and no primary action: the person is already in Place and leaves with the platform back control.
Manifest rows are flat rows on surface.raised, with no card per item. Each row is a DateRow-style line with these parts:
- a leading KindGlyph (the keeper row uses the keeper avatar at 24pt instead);
- the item name and value on the primary line;
- a caption;
- the ProvenanceMark "You added this" on the pickup and date rows;
- a trailing ScopeChip scope-change pair: person glyph → small arrow → house glyph. Pending shows a dashed house glyph until the person chooses;
- under the pair, a scope caption in text.secondary. Pending date rows: "Only you → Your household · waiting for your choice". Pickup and keeper rows: "Only you → Your household". After Keep private, date rows: "Only you · kept private". After Share, date rows: "Only you → Your household". At AX5 the caption wraps under the pair.
The ProvenanceMark tick already means "you added this". Do not add a second tick to mean "moved"; the scope pair and the "Came with you" label show the move. Print the legend word once: "✓ You added this".
The migration shows on each row, not once in prose, so each row can be checked against what Maya remembers typing.
If there are no dates, there is no consent block. If nothing moved, the screen is the plain existing success screen plus "Today now uses this home." Never draw an empty list or "0 items".

INTERACTION, MOTION & HAPTICS: The two consent buttons are peers of equal size and weight.
- Share. Each date's pair becomes a solid house glyph with a 200ms cross-fade, and its scope caption updates. At claim, the line reads "Everyone who joins this household will see these 2 dates. · Undo". On the revisited page, it reads "Shared with Sam · Undo". Only after Maya leaves the screen does Sam get one grouped household notification row, "Maya shared 2 dates". At claim, nobody is notified.
- Keep private. Each pair becomes person → person, and its scope caption updates. The line reads "Only you will see these 2 dates. You can change this in each date. · Undo".
- Both Undo buttons stay until Maya leaves the screen and return the block to the pending question.
- Leaving without choosing keeps the dates private. The pending pair stays pending on the revisited page, and the question is asked again there.
- Either choice plays one light haptic tick on native.
- Retry on a failed row retries that item only. After a successful Retry, the row joins the manifest and every count (summary, question, result line) updates.
- Phase 2: Ollie's pose settles to relaxed once. Under Reduce Motion this is a static swap, and the glyph changes are instant.

FOUNDATIONS COMPONENTS USED: ScopeChip (scope-change pair; pending, declined and struck states; footer sentence form), ProvenanceMark, KindGlyph, DateRow (row grammar), FactCount, InlineErrorRow (carry failed variant), InlineUndo, LandingBannerSlot (one-time claim receipt banner), FactRow ("What moved when you claimed" receipt link), KeeperStrip avatar (phase 2), OfflineNotice, WarmingSkeleton (row skeleton).

ACCESSIBILITY
- On arrival, focus starts on the headline (success) or on the page title "What moved when you claimed" (revisited); the summary is announced once as a status message (role=status).
- Reading order: headline, confirmation caption, subline, summary, manifest, consent block, FactCount, closing line, Now available, Go to your place.
- Header spoken as "Was: saved place, visible to only you. Now: visible to your household."
- The manifest is a list, announced with its real count ("4 items").
- Each row is one element. Example: "Lease ends, in 163 days, Wednesday 31 March 2027, you added this. Was visible to only you, household waiting for your choice."
- Result lines are announced politely; Undo is focusable.
- Targets are 44pt / 48dp / 44px. Scope is carried by glyph shape plus visible words, never by colour or strikethrough alone.

COPY
- Failed item: "We couldn't move your water-heater warranty · Retry".
- Summary when one date fails: "Your pickup day, 1 date and Ollie came with you." The question then reads "Share the date you entered with people who join this household?" (or "with Sam?" when revisited), and result lines use the same count.
- Phase 1 (no keeper): "Your pickup day and 2 dates came with you."
- Household already has a keeper: "Your household already has Pip (fox). Pip stays. Ollie is kept in your place file."
- A different address was claimed: "Today now uses 2418 NE Larkspur Loop. Mom's house is still saved."
- Place file banner: "Your pickup day, 2 dates and Ollie came with you · See what moved".
- Place file row: "What moved when you claimed".
- Offline: "You're offline. Only you will see your dates until you can choose."

EDGE CASES
- Phase 1 ships first: no keeper row, and the summary drops "and Ollie" (3 items).
- Dates only.
- Pickup day only: no consent block.
- A different address was claimed. Delta for that frame only: Maya's only saved place is "Mom's house" in Camas, and she claims 2418 NE Larkspur Loop. Nothing carries from Mom's house, so the plain success shows with the still-saved line, which wraps.
- The claim joins a household that already exists. Delta for that frame only: the household already has Sam and a keeper, Pip. The keeper line names which keeper is kept; the summary reads "Your pickup day and 2 dates came with you." (3 rows); the question reads "Share the 2 dates you entered with Sam?" with the caption "Until you choose, only you will see them. You can change this for each date later."
- Slow manifest (1 second or more): skeleton rows under the headline.
- Offline: the consent buttons are disabled with the reason, and the dates stay private.
- One date fails: the failed item sits below the manifest as an InlineErrorRow, and counts cover carried rows only.

INSTEAD OF
- Instead of "are now visible to everyone", draw the conditional question with dates pending, because silence is not consent.
- Instead of confetti, a badge or a progress bar, draw a plain manifest, because this is a receipt to check.
- Instead of "Ollie knows 11 things", draw a separate "11 on file" line, because a creature that "knows" reads like surveillance.
- Instead of a quietly missing row, draw the failed item with Retry and an adjusted count, because loss must be visible.
- Instead of a one-time banner as the only way back, draw the "What moved when you claimed" row, because receipts are revisited.
- Instead of glyph-only scope pairs and a bare strikethrough, draw the pair with its scope caption and "Was" / "Now" words, because a first-time reader cannot decode a dashed house.
- Instead of a filled "Go to your place" competing with the consent buttons, draw it outlined until a choice is made, because the choice matters more than leaving.
- Instead of naming Dana, name only real household members, because Dana is a friend who compared places and not a household member.

DONE WHEN: The counts equal the rows in every frame, including the consent question and result lines. Nothing is shared before a tap, and leaving keeps dates private. Each choice is stated as a fact, has Undo on screen, and can be reversed per date later. Every scope change has visible words. The same manifest opens again from the place file. Today shows the home without re-laying out. The confirmation caption names the method and date.

ARTBOARDS
1. f1-claim-receipt · web-1440 · 01-only-you-so-far-pending · light: the dense receipt at code entry, all four rows with scope captions (two pending), the future-members question, outlined "Go to your place".
2. f1-claim-receipt · web-390 · 02-only-you-so-far-pending · light: the same, at phone width.
3. f1-claim-receipt · ios · 03-only-you-so-far-pending · light: the native equivalent.
4. f1-claim-receipt · android · 04-only-you-so-far-pending · light: the native equivalent.
5. f1-claim-receipt · web-1440 · 05-revisited-sam-pending · light: the "What moved when you claimed" page on Mon 26 Oct, asking "Share the 2 dates you entered with Sam?"; no primary action.
6. f1-claim-receipt · web-1440 · 06-revisited-choice-results · light: frame 5 twice, side by side: after Share (solid house glyphs, "Shared with Sam · Undo") and after Keep private (person → person, "Only you · kept private", the result line with Undo).
7. f1-claim-receipt · web-1440 · 07-choice-results-at-claim · light: frame 1 twice, side by side: after Share ("Everyone who joins this household will see these 2 dates. · Undo") and after Keep private (result line with Undo); both with filled "Go to your place".
8. f1-claim-receipt · web-390 · 08-carry-failed · light: the worst case: the long-named warranty as a wrapping InlineErrorRow, the adjusted summary and the one-date question.
9. f1-claim-receipt · web-390 · 09-nothing-to-carry · light: the plain success screen plus the closing line.
10. f1-claim-receipt · web-1440 · 10-phase1-pickup-and-dates · light: no keeper row, "Your pickup day and 2 dates came with you.", 3 items.
11. f1-claim-receipt · web-1440 · 11-dates-only · light: two date rows and the consent block.
12. f1-claim-receipt · web-390 · 12-pickup-only · light: one row with its caption, no consent block.
13. f1-claim-receipt · web-390 · 13-different-address · light: the plain success with "Today now uses 2418 NE Larkspur Loop. Mom's house is still saved." wrapping.
14. f1-claim-receipt · web-390 · 14-existing-keeper · light: the household already has Sam; summary "Your pickup day and 2 dates came with you."; question "Share the 2 dates you entered with Sam?"; the Pip line below the manifest.
15. f1-claim-receipt · web-1440 · 15-place-file-banner-and-row · light: the place file with the one-time banner and the persistent row.
16. f1-claim-receipt · web-390 · 16-loading · light: skeleton rows under the headline.
17. f1-claim-receipt · web-390 · 17-offline · light: disabled consent buttons with the offline reason.
18. f1-claim-receipt · ios · 18-ax5 · light: rows stacked, the scope pair and its caption on their own lines, buttons stacked full width.
19. f1-claim-receipt · web-390 · 19-greyscale · light: frame 2 in greyscale.
20. f1-claim-receipt · web-1440 · 20-only-you-so-far-pending · dark: dark twin of frame 1.
21. f1-claim-receipt · ios · 21-only-you-so-far-pending · dark: dark twin of frame 3.
22. Notes: assumptions (the home is created and the carry runs when the address is confirmed, so the household is only Maya at that moment; Sam joins Wed 21 Oct; the flow's claim and verification happen together; frame 14's existing household with Sam and Pip, and frame 13's "Mom's house", are frame-only deltas); the confirmation caption names whichever method was used (for example "Address confirmed by document · Mon 19 Oct"; also landlord confirmation or admin override), postcard is the drawn case; the linked Notice deadline moves with its lease row and is not counted; the claim receipt banner's place in the LandingBannerSlot precedence (after invite and reissue) is a proposed addition to the contract; every invented string (confirmation caption, section label, "Was" / "Now", the four scope captions, both consent questions and captions, both share result lines, the Keep private result line with Undo, "Maya shared 2 dates", Pip line, place file row and page title, offline line, "Tankless water heater and recirculation pump"); "Keep them private to me" kept as the one flow-approved exception to the Only you wording; the flow's "Only you → Household (pending)" is written with the canonical "Your household"; omitted states; and these open questions:
   - keeper visibility changes with no consent step;
   - the pickup day changes scope without consent, on the reasoning that the address shares it; confirm;
   - in frame 14, what happens if the existing household already has its own pickup day;
   - whether to ask for the move-in date at claim;
   - the first-week ticks and the widget label move silently;
   - the host headline "Your address is verified." is a bare claim; the caption adds method and date; confirm the headline wording;
   - the flow's question wording "with the people who live here" differs from the two questions used here.

BATCH PLAN
Turn 1: artboards 1-6, then wait for "continue".
Turn 2: artboards 7-12, then wait for "continue".
Turn 3: artboards 13-18, then wait for "continue".
Turn 4: artboards 19-22.
