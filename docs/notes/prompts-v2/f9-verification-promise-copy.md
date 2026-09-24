# Verification promise lists (one name per thing, no withdrawn fee promise)
id: f9-verification-promise-copy · platforms: web/ios/android · isNew: False · artboards: 21

Use the Pantopus house style pasted above and the Foundations components from prompt 00, by exact name.

SCREEN: Verification promise lists · f9-verification-promise-copy

TYPE: EXTENSION of four designed surfaces: the "Verify this address" sheet (web sheet, iOS verify flow, Android sheet), "Verified success" (web page, iOS and Android last flow step), the Place file "Proof" row, and the Place file mover row "Meet the block". This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed.

ATTACH: (1) The web Verify this address sheet at 1440 and 390, unlock list open, plus its pending state ("Enter your postcard code"). (2) The web Verified success page. (3) The iOS verify flow: the unlock-list step and the final step. (4) The Android verify sheet and its final step, as drawn by the verify sheet prompt. (5) The Place file Proof row (FactRow) from the Place file designs, web 390 and iOS. (6) The Place file mover section ("Meet the block" row) from the Place file designs on web, iOS and Android; if it isn't designed yet, attach the Place file output. Never attach the old Just Moved card. (7) The prompt 00 Foundations board, for the SlotMeter RankBadge, its neutral date pill, and PushCopy. Do not copy shapes from the current Block Founders panel: it still has a warning-tinted countdown pill.

PLATFORMS & VIEWPORTS: web 1440x900 and 390x844 · iOS 393x852 · Android 412x915. On Android, the verify sheet is drawn by the verify sheet prompt; here, apply the same lists to it and its success step, and change the mover row. The Android sheet inherits these contract strings word for word.

WHERE IT LIVES & HOW PEOPLE ARRIVE
- The verify sheet opens from: Place tab → Place file → Proof row → "Verify"; the Place dashboard verify banner; the "Verify address" link on any LockedActionRow; the invitation-accepted screen. The caller supplies the header reason line; keep it exactly as the host draws it. This is the one shared verify sheet, parameterised by that reason string. Its method picker, pending state and code entry belong to the verify sheet prompt; this prompt changes only its lists and where they sit.
- Verified success is reached three ways: on web, a correct postcard code redirects to pantopus.com/app/place?verified=1; on iOS and Android, it is the flow's last step; when a document or landlord check finishes later, a notification opens it.
- The mover row sits in the Place file's mover section while the move-in date is recent, on web, iOS and Android. The old Just Moved card on the Place dashboard was merged into these mover rows; draw the line there.
- Hand-off: success leads to Nearby → Block Founders panel, where rank, tier and invite allowance live. Afterwards the Proof row shows how and when the address was confirmed.

WHO AND WHEN: Maya Chen owns HOME A, 2418 NE Larkspur Loop. She requested a postcard on Thu 15 Oct. On Mon 19 Oct 2026 at 6:10 PM it has arrived, so her sheet is in the host's pending state. She opens Place file → Proof, reads what verifying adds, enters the code and lands on success. Two homes on her block verified before her. Her block's Founding window shows 3 of 5 slots open and closes Sun 25 Oct. Sam Ortega is a household member (joined by invite, address not verified, no postcard requested); he sees the method picker with the same lists under the household reason header.

THE ONE JOB: Wherever verification is offered, say plainly what it adds and what it doesn't, with one name per thing (Block Founder is the rank, Founding Neighbor is the first-5 badge) and never the withdrawn fee promise.

FIRST FIVE SECONDS: Sheet: first the "What this unlocks" heading, then its two visible rows, then the host's method rows (nothing is primary); in Maya's pending state, the code field instead. Success: first "Address verified" with its method-and-date line, then the rank badge, then the existing primary action.

CONTENT (fixture deltas only)
- Maya's rank after verifying: Block Founder #3. Tier: Founding Neighbor, slot 3 of 5. Window closes Sun 25 Oct.
- Invite allowance for a new verifier with 0 invited neighbors joined: 3 postcard invites this week. Rule: +1 a week per neighbor this person invited who then joined, up to 6. Neighbors who join on their own add nothing.
- Pending example (Maya, before she enters the code): postcard mailed Thu 15 Oct, expected Thu 22 Oct (7 days; a postcard usually takes 5–7).
- Worst case: Block Founder #148, 6 invites (3 base + 3 from neighbors she invited), the address wrapping to two lines at 390.

LAYOUT & VISUALIZATION
- Order inside the sheet, top to bottom: host reason header → "What this unlocks" (2 rows + "and 3 more") → rank caption → "Also once you verify" → the host's method rows (or, in the pending state, the host's "Enter your postcard code" step) → "What verifying doesn't do" as a collapsed disclosure below the methods. At 390 the first method row (or the code field) stays inside the first viewport. Draw no primary button the host doesn't have.
- Block 1, "What this unlocks": GrantLimitList, verify-sheet variant, exactly as the contract defines it: five lock rows, 44pt, 16pt lock glyph in text.secondary plus a verb phrase in body text.primary, no sub line. Two rows show, then the disclosure "and 3 more". Each row is one line at default size (two at most), never three; 12pt between rows. Directly under the list, one caption in bodySmall text.secondary: "Your Block Founder number is set when your address is confirmed."
- Block 2, "Also once you verify": its heading uses exactly the same heading style as "What this unlocks" in the attached screenshot (if unclear, h3 20/28/600 text.primary). Plain text rows, no glyph, not part of GrantLimitList, each a body text.primary line with a bodySmall text.secondary sub line. Row A, the invite allowance. Row B, the Founding line, drawn only while the block's window is open and the method in view can finish before it closes.
- Block 3, "What verifying doesn't do": on the sheet, a collapsed disclosure; on success, an overline with the same three plain rows, no glyphs.
- Success: rank and tier are two shapes from the prompt 00 SlotMeter. Rank is the RankBadge: squared, radius md, surface.sunken, numeral plus the overline "Block Founder". Tier is the neutral date-pill shape (surface.sunken, text.strong), no warning tint. Each has its own row; never side by side in one sentence.
- Proof row (FactRow): verified carries the FILLED ProvenanceMark with its word "Official" printed once; pending carries no mark (the pending line is the status); unverified and saved place carry no mark.
- In the sheet's pending state, the host's status line is LockedActionRow, pending variant, with the same pending string as the Proof row.
- Degrade: window closed or lookup failed → the Founding row and the tier row are absent everywhere and nothing replaces them. Rank lookup failed on success → InlineErrorRow in the rank slot.
- Before/after frame: one row at its old three-line height beside its new one-line height, rhythm measurements labelled. The list gets shorter; draw it shorter.

INTERACTION, MOTION & HAPTICS: "and 3 more" and "What verifying doesn't do" expand in place with a 200ms height change; under Reduce Motion they appear instantly. The whole Proof row is the target and opens the sheet. The mover row keeps its existing tap. iOS success plays one light haptic tick; Android success uses the platform confirm haptic once; web has none. No confetti, no badge animation. Success announces "Address verified" as a status message. The later-check notification uses interruption level Active (Android DEFAULT), not Time Sensitive, and is drawn with PushCopy on the Notes artboard only.

FOUNDATIONS COMPONENTS USED: GrantLimitList (verify-sheet variant, unchanged: five rows, 2 + "and 3 more") · SlotMeter (RankBadge and neutral date pill only; no meter here) · FactRow (Proof row: missing, pending, known, not at this tier) · ProvenanceMark (filled, verified Proof row only) · LockedActionRow (pending variant, inside the sheet) · InlineErrorRow · WarmingSkeleton (row skeleton, rank and allowance rows only) · OfflineNotice (read-only variant) · PushCopy (Notes only).

ACCESSIBILITY: Sheet reading order: reason header, What this unlocks, its rows, disclosure, rank caption, Also once you verify, method rows or code field, What verifying doesn't do. Success reading order: title, address, method line, rank, tier, allowance, what verifying doesn't do, actions. Spoken labels: badge "Block Founder number 3 on this block"; pill "Founding Neighbor, slot 3 of 5"; Proof row "Proof, address confirmed by postcard, Monday October 19 2026, official". The lock glyph is decorative; the list heading carries the meaning. Both disclosures are buttons announcing their expanded state. Targets 44pt / 48dp / 44px. In greyscale, rank and tier differ by shape alone. At iOS AX5 and Android 200%, rows wrap, the badge stacks above its caption, and the sheet scrolls.

COPY (sentence case, identical on web, iOS and Android)
List heading: "What this unlocks". Visible: "Message your neighbors" · "Get a residency letter" · disclosure "and 3 more". Expanded: "Show your Residency Pass" · "Share what you pay in rent (Real Rent)" · "Earn a Block Founder rank".
Rank caption: "Your Block Founder number is set when your address is confirmed."
Also once you verify: "Send up to 3 postcard invites a week" / "Plus 1 a week for each neighbor you invite who joins, up to 6." Only while the window is open: "Become a Founding Neighbor" / "3 of 5 slots open on this block · Goes to homes verified by Sun 25 Oct".
What verifying doesn't do: "Every reading, reminder and date stays free, verified or not." · "Verifying doesn't change any fees." · "It confirms you live here. It isn't a background check."
Success: "Address verified" · "2418 NE Larkspur Loop, Vancouver, WA 98684" · "Address confirmed by postcard · Mon 19 Oct 2026" · badge + "Your rank on this block" · pill "Founding Neighbor · slot 3 of 5" / "One of the first 5 verified homes on this block." · "3 postcard invites this week" / "Each neighbor you invite who joins adds 1 a week, up to 6." · link "See your block on Nearby".
Rank failed: "We couldn't load your block details." + button "Retry" (spoken "Retry block details").
Proof row: unverified "Verify this address to become a Block Founder here." + "Verify" · pending "Postcard mailed Thu 15 Oct · expected in 3 days · Thu 22 Oct" · verified "Address confirmed by postcard · Mon 19 Oct 2026" · saved place "Claim this address first" (grey, no action).
Other methods, same pattern: "Address confirmed by document · Mon 19 Oct 2026" · "Address confirmed by landlord · Mon 19 Oct 2026" · "Address confirmed by Maya Chen · Mon 19 Oct 2026" (only on a household member's Proof row, such as Sam's; depends on the owner-attestation proposal).
Mover row, before: "Verify this address to become a Block Founder here." After: "You're Block Founder #3 on this block."
Offline: OfflineNotice line "You're offline. What verifying adds stays readable." · reason caption under the disabled method rows or code field "Verifying needs a connection."
Push when a later check finishes: title "Your address is confirmed" · body "See what verifying added." If the notification prompt already owns this push, its copy wins.
Date rule exception: Founding dates carry no relative count. Write "Sun 25 Oct", never "in 6 days" (house AVOID: warning-tinted countdowns on perks). All other dates beyond tomorrow keep the relative count.
Removed everywhere: "Permanent 0% marketplace fee", "permanent"/"permanently", "The Nearby cells map in detail", "Post to your block", "6 postcard invites a week instead of 3".

EDGE CASES: The long address wraps, never truncates. A 3-digit rank widens the badge; the numeral is never cut. Maximum allowance: "6 postcard invites this week" / "3 base + 3 from neighbors you invited". Window closed or lookup failed: no Founding row, no tier row; the list still reads "and 3 more". If the usual time of the method in view runs past the closing date, the Founding row is not drawn: in Sam's method picker (postcard 5–7 days, 6 days left) it is absent; in Maya's pending state (code in hand) it is drawn. Slow network: title and method line render from the verify response; rank and allowance rows show row skeletons; the tier row has no skeleton and appears only when loaded. Offline: OfflineNotice above the list, the list stays readable, and the method rows (or code entry) are disabled, still focusable, with the reason caption. Already verified: the sheet never opens.

INSTEAD OF
- Instead of "your permanent rank", draw "Your rank on this block" — because a verification can lapse and nothing yet guarantees the rank survives that.
- Instead of "#3" before verifying, draw "Earn a Block Founder rank" — because the number can change before the code is entered, and the panel shows no rank to unverified people.
- Instead of a warning-tinted countdown pill, draw a neutral date pill — because the badge is a perk, not an obligation.
- Instead of one chip shape for both names, draw the squared RankBadge and the round tier pill — because the rename works only if readers see the difference.
- Instead of a bare "Verified" or check badge, draw the method and date with the filled mark — because a bare badge reads as an endorsement.
- Instead of adding invites and Founding as extra unlock rows, draw them under "Also once you verify" — because the verify-sheet list is one shared contract list and both still need verification.
- Instead of "for each neighbor who joins", draw "for each neighbor you invite who joins" — because only converted invites raise the allowance.
- Instead of a primary button above the methods, keep the host's unranked method rows — because the verify sheet recommends no method.

DONE WHEN: No frame contains "permanent", "0%", the cells-map row or "instead of 3". "Block Founder" and "Founding Neighbor" never share a sentence. In greyscale, rank and tier differ by shape. Every verification mention reads "Address confirmed by <method> · <date>", identical on success and the Proof row. The unlock list matches the contract's five strings and "and 3 more" on web, iOS and Android. At 390 the first method row or code field is in the first viewport. The Founding row never appears when the method can't finish before closing. No row exceeds two lines at default size. Invite numbers follow 3 + 1 per invited neighbor who joins, up to 6.

ARTBOARDS
1. f9-verification-promise-copy · web-1440 · 01-verify-sheet-expanded · light: Maya's sheet in the host's pending state; all five rows expanded, rank caption, Also once you verify with the Founding row, code field, What verifying doesn't do expanded.
2. f9-verification-promise-copy · web-1440 · 02-verified-success · light: Maya's full success page.
3. f9-verification-promise-copy · web-390 · 03-rhythm-before-after · light: one row at old three-line vs new one-line height, measured.
4. f9-verification-promise-copy · web-390 · 04-verify-sheet-collapsed · light: Sam's household reason header, two rows plus "and 3 more", Also once you verify without the Founding row, first method row in the first viewport.
5. f9-verification-promise-copy · ios · 05-verify-flow-list · light: iOS unlock-list step, expanded, Maya pending.
6. f9-verification-promise-copy · ios · 06-verified-success · light: iOS final step with badge and pill.
7. f9-verification-promise-copy · android · 07-verify-sheet-list · light: Android sheet with the expanded list and Also once you verify.
8. f9-verification-promise-copy · android · 08-verified-success · light: Android success step with badge and pill.
9. f9-verification-promise-copy · web-390 · 09-founding-closed-sheet · light: Maya's pending sheet with no Founding row, list still "and 3 more".
10. f9-verification-promise-copy · web-390 · 10-founding-closed-success · light: success with no tier row.
11. f9-verification-promise-copy · web-390 · 11-place-file-proof-rows · light: four stacked Proof rows: unverified, pending (no mark), verified (filled mark), saved place.
12. f9-verification-promise-copy · web-390 · 12-mover-row · light: Place file "Meet the block" row before and after verifying.
13. f9-verification-promise-copy · ios · 13-mover-row · light: the same on iOS.
14. f9-verification-promise-copy · android · 14-mover-row · light: the same on Android.
15. f9-verification-promise-copy · web-390 · 15-rank-failed-and-slow · light: success with InlineErrorRow in the rank slot; beside it, the slow state with row skeletons.
16. f9-verification-promise-copy · web-390 · 16-offline · light: sheet with OfflineNotice, list readable, method rows (or code entry) disabled with "Verifying needs a connection."
17. f9-verification-promise-copy · ios · 17-ax5 · light: success at AX5, stacked and scrolling.
18. f9-verification-promise-copy · web-390 · 18-greyscale · light: success at mobile width in greyscale.
19. f9-verification-promise-copy · web-1440 · 19-verify-sheet-expanded · dark: dark twin of 1.
20. f9-verification-promise-copy · ios · 20-verified-success · dark: dark twin of 6.
21. f9-verification-promise-copy · Notes: the later-check push drawn with PushCopy (Active level). List every invented string: the Also once you verify heading and rows (including "you invite who joins" and "Goes to homes verified by Sun 25 Oct"), the rank caption, the What verifying doesn't do rows, the pending dates, the landlord and person-name method lines, the offline line and reason caption, the rank-failed line, the success link, the push. Replaced strings with reasons: "Confirmed by postcard code" → "Address confirmed by postcard"; "and 4/5 more" → "and 3 more"; sub lines removed from list rows; "Also on this block" → "Also once you verify" (both need verification); "What stays the same" → "What verifying doesn't do"; "Closes Sun 25 Oct" on the sheet → "Goes to homes verified by Sun 25 Oct". Record the house-style date exception: Founding dates carry no relative count. Gated items left out of the list on purpose: residency claims (covered by the Residency Pass row), fridge cards and the verified badge (too minor for a two-row list; the badge is replaced by method + date), neighbor messages appear as "Message your neighbors"; postcard invites and the Founding tier sit in Also once you verify. Founder flags: confirm "stays free" and "doesn't change any fees" are true in the pricing model, and drop either row if uncertain rather than soften it; add "kept even if you move" only if the data model guarantees it; confirm whether posting to your block needs verification; run a confusion test on Founding Neighbor vs "First 5 on this block"; the "Address confirmed by Maya Chen" line depends on the owner-attestation proposal; the verify sheet prompt still uses older list verbs ("Send neighbor messages"…) and should adopt the contract strings, including on its new Android sheet; the Place file inventory lists only mail forwarding, utilities and voter registration as mover rows, so it must add "Meet the block" or this line has no host; extend the copy check beyond the public place test to the web, iOS and Android client files, or the platforms diverge on day one; confirm who owns the later-check push copy.

BATCH PLAN: Turn 1: artboards 1-6, then wait for continue. Turn 2: 7-12, then wait for continue. Turn 3: 13-18, then wait for continue. Turn 4: 19-21.
