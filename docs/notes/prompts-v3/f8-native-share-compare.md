# Share + compare actions on the native address preview
id: f8-native-share-compare · platforms: ios/android · isNew: False · artboards: 19

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Share + compare actions on the native address preview · f8-native-share-compare

TYPE: EXTENSION of the existing designed screen "Place launch / T0 address preview" (iOS and Android). This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed. Keep the hero and the section groups exactly as they are. Replace the aha card with the f8-seasonal-aha Mon 19 Oct default (in its converted native anatomy), and add one TextActionRow under the card.
- iOS: both buttons are new; the screen has no share control today. The sticky wall stays exactly as in the screenshot.
- Android: "Share this address" currently sits inside the sticky wall, under "Continue" and the 24-hour line. Remove it from the wall and redraw it as the first button of the pair, 16dp below the aha card. After the move, the wall keeps only its sentence, "Continue" and its 24-hour line.

ATTACH: (1) iOS address preview, scrolled so the aha card and the sticky wall are both visible. (2a) Android address preview showing the sticky wall with its current "Share this address" link under "Continue". (2b) Android address preview scrolled to the aha card. (3) The finished f8-seasonal-aha iOS and Android default frames, which supply the aha card. (4) The f8-og-compare-card no-name frame, used as the share-sheet thumbnail. (5) The existing address OG card, used as the share-address header image. (6) The Foundations frames for TextActionRow, InlineErrorRow and OfflineNotice.

PLATFORMS & VIEWPORTS: iOS 393×852 and Android 412×915 only. Web has its own compare sheet, so draw no web frames here. Draw every system share sheet as a surface.sunken frame with a 1px text.secondary keyline, labelled "system UI"; Pantopus does not design its contents beyond the header it supplies.

WHERE IT LIVES & HOW PEOPLE ARRIVE: Place tab. On both apps the address preview is the Place tab's root for anyone signed out, and for a signed-in account with no saved place. The row appears on every render of this preview, in both cases; draw the signed-out case. It never appears on Today or on a saved place's file. The person types an address into the Place launch field and taps "See your place". The row sits under the aha card ("What stands out"), about one screen down. The only entry point is the aha card on this preview. No push, widget or deep link lands here.
This surface receives the typed address and the finished preview, including the aha card. It hands off in two ways. "Compare with a friend" makes a pantopus.com/start compare link, then opens the system share sheet. The friend opens that link in a browser (it does not open the app in v1), sees the compare share card "A place in Camas, WA · Yours?" in the chat, and lands on the web compare arrival page. "Share this address" opens the system share sheet with the address link the Android app already sends; that link includes the full address.

WHO AND WHEN: Someone new at PLACE B. It is Mon 19 Oct, 6:10 PM. A signed-out visitor on the iPhone app has just typed 1107 NE Birchfield Ct, Camas, WA 98607 and wants to send the readings to a friend without sending the address.

THE ONE JOB: Let someone send this reading to a friend in one tap, without a native compare screen and without competing with the save.

FIRST FIVE SECONDS: The eye lands first on the aha card's headline and deadline chip, with its bordered VoteWA row at the card's foot. Second, it reaches the two borderless text buttons and their caption below the card. Third, it reaches the sticky wall. The screen's single primary action stays "Continue" in the sticky wall. The new row has no primary.

CONTENT (deltas to the fixtures)
- Header: the PLACE B address. Nothing is saved yet, so the header shows the address with no ScopeChip.
- Aha card above the row: draw f8-seasonal-aha's Mon 19 Oct default exactly as that prompt specifies, in its native anatomy. That means the overline "WHAT STANDS OUT", the deadline chip "in 7 days · Mon 26 Oct", the voter-registration headline and its two detail lines, the hollow mark with "On record, not confirmed" and the caption "Washington Secretary of State · statewide · as of Mon 19 Oct", the sunken follow-up row "Keep this address to set a reminder before Mon 26 Oct", and, inside the card under the follow-up row, the bordered outbound row "Check or update at VoteWA ↗".
- New row: "Share this address" · "Compare with a friend".
- Caption under the row, sentence 1 (tied to Compare, a surface delta to the Foundations caption): "The compare card shows your city and your readings — never your address, and no name." Sentence 2: "Anyone with the link can see this card until Mon 2 Nov."
- Sticky wall: as in the screenshot. iOS unchanged. Android minus the share link. Its sentence stays "Keep this address handy. Choose whether to save it privately after sign-in.", then "Continue", then the line "Your preview stays on this device for up to 24 hours while you sign in."
- iOS compare share-sheet header: title "A place in Camas, WA · Yours?", the compare card as the thumbnail image, subtitle "pantopus.com".
- iOS share-address header: title "1107 NE Birchfield Ct, Camas, WA 98607", the existing address OG card as the image, subtitle "pantopus.com".
- Android Sharesheet: title "Compare your place with mine", with the card thumbnail in the preview.
- Offline top line (frames 5, 13 and 18): "You're offline · as of 6:08 PM".
- Worst case: iOS AX5 text, the two buttons stacked, and both caption sentences wrapping above the sticky wall.

LAYOUT & VISUALIZATION
- The share pair sits outside the aha card, on the page surface, not in a card of its own. Its top edge is 16pt (16dp) below the card's bottom edge. So the bordered VoteWA row inside the card never touches the borderless pair, and the pair reads as a separate group.
- Draw the TextActionRow share-compare variant as on the Foundations board: two text buttons side by side, in bodySmallMedium primary.700, with no fill, no border and no icon. Separate them with spacing only, 8pt minimum. Each button is 44pt tall on iOS and 48dp tall on Android.
- One status line sits directly under the pair, between the pair and the caption. It holds exactly one of: the offline reason "You're offline. Compare needs a connection.", "Link copied", or the InlineErrorRow. When nothing needs saying, it takes no space.
- The two-sentence caption, in caption type and text.secondary, always sits below the status line and never disappears.
- The order of emphasis, top to bottom, is: aha card (its bordered outbound row included), the text pair, sections, sticky primary. So sharing is always available but never outranks the save.
- There is no name field in v1, so the card is always anonymous. The caption says so in words, so the button never suggests a personalised card. The token cannot be revoked, so sentence 2 states who can see the card and until when.
- If the compare link cannot be made, only the Compare button changes, and "Share this address" stays live.

INTERACTION, MOTION & HAPTICS
- "Compare with a friend" makes the link, then opens the system share sheet. On iOS this is the iOS share sheet, whose header shows the card title and image. On Android it is the system Sharesheet.
- Making the link: the Compare button cannot be tapped again. If it takes 1s or longer, the 12pt spinner replaces the start of the label, as on the Foundations board (S2), and the label reads "Making a link…". Under 1s nothing changes. Under Reduce Motion there is no spinner and the words stay. Share stays live throughout.
- Cancelling the iOS sheet returns to idle with no message. Android reports no cancel, so draw no cancelled state there.
- Android with no share targets shows an inline line and "Copy link". Copying shows "Link copied" in the status line, and it stays until the person leaves. On Android 13 and later the system also shows its own clipboard confirmation; keep the inline line for older versions and for screen readers.
- Rate-limited link attempt: the InlineErrorRow in the status line, with its own copy and a time estimate (not drawn; see Notes).
- Haptics: one light tick on "Link copied" only.
- Motion: system share sheets follow the OS Reduce Motion setting. The only app-drawn change is the minting label, which swaps instantly.

FOUNDATIONS COMPONENTS USED: TextActionRow (share-compare variant; states idle, minting, copied, offline; the outbound variant appears inside the aha card). InlineErrorRow (link failed, rate limited). OfflineNotice (FreshnessLine offline line at the top, plus the per-control reason caption). The aha card uses KindGlyph (tile), StatusChip (deadline), ProvenanceMark, SourceCaption and TextActionRow (outbound) exactly as drawn in f8-seasonal-aha.

ACCESSIBILITY
- Reading order: overline, headline, chip, detail, source with mark word, follow-up row, VoteWA row, "Share this address", "Compare with a friend", status line (when present), caption (both sentences), sections, sticky wall. Keep scroll padding so the sticky wall never hides focus.
- Spoken labels. Share: label "Share this address", hint "Opens the share sheet. The link includes this address." Compare: label "Compare with a friend", hint "Opens the share sheet. The card shows your city, not your address." VoteWA row: "Check or update at VoteWA, opens in browser".
- Minting: Compare reads "Making a link…".
- Offline: Compare stays focusable and reads "Compare with a friend, dimmed, Compare needs a connection."
- The error row and "Link copied" are polite status announcements. The error's Retry is spoken "Retry compare link".
- The share-sheet image is described by the web compare card's text alternative. Nothing extra to draw.
- At AX5 and 200%, the buttons stack full-width, each with its own target, and every caption line wraps.
- Every frame must read correctly in greyscale. No state is shown by colour alone.

COPY: "Share this address" · "Compare with a friend" · "The compare card shows your city and your readings — never your address, and no name." · "Anyone with the link can see this card until Mon 2 Nov." · Minting: "Making a link…" · Error (InlineErrorRow): "We couldn't make the compare link. · Retry" · Offline top line: "You're offline · as of 6:08 PM" · Offline reason: "You're offline. Compare needs a connection." · Android, no targets: "No apps to share with. Copy the link instead." with the button "Copy link" · Status: "Link copied" · iOS headers: "A place in Camas, WA · Yours?", "1107 NE Birchfield Ct, Camas, WA 98607", "pantopus.com" · Android title: "Compare your place with mine" · Rate limited (not drawn): "Too many links just now. Try again in a few minutes."

EDGE CASES
- Longest address: in frame 7, draw the preview and the iOS share-address header for "12808 NE 28th Street, Unit 214, Vancouver, WA 98684". The header title wraps to two lines and never truncates.
- AX5 (iOS) and 200% (Android): the buttons stack.
- Slow network: the minting label and spinner appear only after 1s, and Share stays live.
- Link failed: the InlineErrorRow sits in the status line between the pair and the caption; both caption sentences stay visible below it, and both buttons are enabled again.
- Rate limited: the same slot, with the rate-limit copy and its time estimate.
- Offline: the cached preview stays readable under "You're offline · as of 6:08 PM". Compare is disabled with its reason in the status line, and Share still works.
- No share targets (Android only).
- Many or zero items and large numbers do not apply to this row.
- Tier: the row shows on this preview whether the viewer is signed out or signed in with no saved place. It never shows on a signed-in Today or a saved place's file.
- Sends from the apps are not counted in the spread metric yet. Nothing on screen changes because of this; list it on Notes.

INSTEAD OF
- Instead of filled or outlined buttons, draw plain text buttons at full target size — because "Continue" must stay the only primary at the moment of sign-up.
- Instead of leaving the Android share link in the sticky wall (or drawing it twice), move it into the pair under the aha card — because the wall holds only the one primary and no share action.
- Instead of tucking the pair directly under the card's bordered VoteWA row, leave the 16pt gap outside the card — because two variants of one component stacked tight read as one control.
- Instead of an app-drawn Material 3 chooser, draw the system Android Sharesheet with its title and thumbnail — because Android guidance forbids custom share lists.
- Instead of a bare URL in the iOS sheet header, draw the card title and image — because the header is what the sender checks before sending.
- Instead of a caption that says "never your address" about both buttons, name the compare card in the caption and say in Share's hint that the link includes the address — because Share does send the address.
- Instead of copy such as "Send your card", write the anonymous caption with its expiry — because the recipient sees "A place in Camas, WA", with no name, and the link cannot be taken back.
- Instead of a red error banner that replaces the caption, draw the InlineErrorRow in the status line above the caption — because only one control failed and the privacy words must stay visible before a retry.

DONE WHEN
- Each frame shows exactly one filled primary ("Continue"), and no share action remains in the Android sticky wall.
- Both buttons measure 44pt/48dp with an 8pt/8dp gap, and the pair sits 16pt below the aha card.
- The caption states, before the tap, that the compare card is anonymous and who can see it until when, and it stays visible in the error, copied and offline frames.
- A reader can tell that "Share this address" sends the address and "Compare with a friend" does not.
- The iOS header shows the card title and image. Android shows the system Sharesheet titled "Compare your place with mine".
- Offline and error frames keep "Share this address" usable.

ARTBOARDS
1. f8-native-share-compare · ios · 01-idle · light — the dense default: aha card (with the VoteWA row), the pair 16pt below it, the two-sentence caption and the sticky wall in one viewport.
2. f8-native-share-compare · ios · 02-minting · light — Compare reads "Making a link…" with the 12pt spinner replacing the start of the label; Share live.
3. f8-native-share-compare · ios · 03-compare-share-sheet · light — the iOS share sheet at medium detent, drawn as the labelled "system UI" frame, header "A place in Camas, WA · Yours?" with the card image and "pantopus.com".
4. f8-native-share-compare · ios · 04-link-error · light — InlineErrorRow "We couldn't make the compare link. · Retry" between the pair and the caption; both caption sentences visible; both buttons enabled.
5. f8-native-share-compare · ios · 05-offline · light — "You're offline · as of 6:08 PM" at the top; Compare disabled with "You're offline. Compare needs a connection." in the status line; Share enabled; caption visible.
6. f8-native-share-compare · ios · 06-share-address-sheet · light — drawn as the labelled "system UI" frame; header image = the existing address OG card; title 1107 NE Birchfield Ct, Camas, WA 98607.
7. f8-native-share-compare · ios · 07-share-address-long · light — drawn as the labelled "system UI" frame; header image = the existing address OG card; title 12808 NE 28th Street, Unit 214, Vancouver, WA 98684 wrapping to two lines.
8. f8-native-share-compare · android · 08-idle · light — the pair 16dp below the card with the caption; the link removed from the sticky wall, which shows its sentence, "Continue" and the 24-hour line only.
9. f8-native-share-compare · android · 09-minting · light — "Making a link…" with the spinner replacing the start of the label.
10. f8-native-share-compare · android · 10-sharesheet · light — the system Sharesheet, labelled "system UI", titled "Compare your place with mine", with the thumbnail.
11. f8-native-share-compare · android · 11-no-targets · light — inline "No apps to share with. Copy the link instead." and "Copy link".
12. f8-native-share-compare · android · 12-link-copied · light — "Link copied" in the status line above the caption; annotation: "Android 13+ also shows the system clipboard confirmation; keep the inline line for older versions and for screen readers".
13. f8-native-share-compare · android · 13-offline · light — offline top line; Compare disabled with its reason; Share enabled.
14. f8-native-share-compare · ios · 14-ax5 · light — buttons stacked full-width, both caption sentences wrapped, sticky wall with scroll padding.
15. f8-native-share-compare · android · 15-200pct · light — the same at 200% text, pair stacked.
16. f8-native-share-compare · ios · 16-greyscale · light — frame 1 in greyscale.
17. f8-native-share-compare · ios · 17-idle · dark — dark twin of frame 1.
18. f8-native-share-compare · android · 18-offline · dark — dark twin of frame 13.
19. f8-native-share-compare · Notes — list every invented string: the iOS header titles and subtitle, the Android title, the no-targets line, "Anyone with the link can see this card until Mon 2 Nov." (the date must equal the link's real expiry, which is not yet set; the web compare sheet uses the same sentence), "You're offline · as of 6:08 PM", "We couldn't make the compare link.", "Retry compare link", "Too many links just now. Try again in a few minutes.", the Share hint "Opens the share sheet. The link includes this address.", "Keep this address to set a reminder before Mon 26 Oct", and the long address "12808 NE 28th Street, Unit 214, Vancouver, WA 98684". Record surface deltas: caption sentence 1 now names "the compare card" (Foundations reads "The card shows…"); caption sentence 2 is a surface addition; the minting spinner appears only after 1s (no indicator under 1s); the Android share link moved out of the sticky wall into the pair (contract: no actions inside the sticky wall). Record assumptions: the visitor is an unnamed newcomer, not Jordan Lee (who already saved PLACE B on Sat 10 Oct) and not Dana (the fixture's compare sender on other surfaces); the row also shows for a signed-in account with no saved place. Omitted states: iOS cancelled (identical to frame 1, no message); Android link error (same InlineErrorRow as frame 4); rate-limited link attempt (InlineErrorRow in the status line with its own copy and time estimate, invented, not drawn). Flag these open items: sends from the apps are not counted in the spread metric, which understates spread rather than inflating it (the acceptable direction), and the app-open event added with the widget work brings the recorder for free; compare links open in the browser, not the app, so the web compare pages must carry the app download link; the compare link carries the seeded voter headline without its confidence, so a card sent from the apps would lose the hollow mark until the link gains a confidence field; the compare mint is rate-limited the same way as the address preview.

BATCH PLAN: Turn 1: artboards 1-6, then wait for "continue". Turn 2: artboards 7-12, then wait for "continue". Turn 3: artboards 13-18, then wait for "continue". Turn 4: artboard 19.
