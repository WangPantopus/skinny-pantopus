# Saved — Today now uses this address
id: f1-save-confirmation · platforms: web/ios/android · isNew: False · artboards: 18

Use the Pantopus house style pasted above and the Foundations components from prompt 00, by exact name.

SCREEN: Saved — Today now uses this address · f1-save-confirmation

TYPE: EXTENSION of the existing designed screen "Keep this address handy", the pending-place confirmation. This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed. On web it becomes the success state of the save on the Place tab, inside the Place shell, not a separate page. On iOS and Android it stays the screen it already is.

ATTACH: (1) the current "Keep this address handy" screen on iOS and Android; (2) a web capture of it at 1440 and 390; (3) the /start sticky save bar reading "Keep this address handy", for continuity; (4) Today's location row with the "Saved place · Only you" chip; (5) the Foundations board.

PLATFORMS & VIEWPORTS: iOS 393x852 · Android 412x915 · web 1440x900 (Place shell with the sidebar, content column 560 wide) · web 390x844 (four-tab bar).

WHERE IT LIVES & HOW PEOPLE ARRIVE: Place tab, the save moment just before Today. Entry points:
(1) /start → "Keep this address handy" → register: lands on 03-saved, because the address was saved at registration. /start → "Keep this address handy" → sign in: the save runs on arrival, showing 02-saving only if it takes 1s or longer, then 03-saved. The person never taps Save twice. The native launch funnel works the same way.
(2) The email confirmation page, whose code or link opens 03-saved directly with "Email confirmed." as a status line at the top, never the pre-save Save button, because the person already asked to keep the address.
(3) Recovery arrivals: when the /start draft is lost or expired on arrival, or the person confirms their email after the hold has expired (held mode), this screen opens in recovery: 04a when the server or this device still has the address, otherwise 04b. The email page does not draw its own recovery; it routes here.
The Add a place sheet does not open this screen: it reuses this screen's saved sentence as a status line. The previous step hands over the address the server holds (the device's own copy is only a backup, not the normal cross-device path) and the account it was started under. Where actions lead: See Today goes to Today in its warming state, location row "1107 NE Birchfield Ct · Saved place · Only you". Claim this address opens the existing claim flow. See your places opens Your places. This screen never asks for notification permission.

WHO AND WHEN: Jordan Lee looked up 1107 NE Birchfield Ct on his work laptop at lunch on Sat 10 Oct, the day after moving from Portland, and registered. At 6:10 PM that day he confirms his email on his iPhone and arrives here. These frames are dated Sat 10 Oct, the fixture save day.

THE ONE JOB: Say in one sentence what the save changed, then hand the person to Today.

FIRST FIVE SECONDS: The eye lands first on the title "Saved privately" with its tick, then on the one sentence naming what changed, then on the filled "See Today" button, the single primary action.

CONTENT:
Pre-save (01): title "Keep this address handy"; address line "1107 NE Birchfield Ct, Camas, WA 98607"; body "Today and a night-before pickup reminder run on it."; primary "Save"; caption "Only you will see this."
Saving (02): actions disabled, address intact, and the inline line "Saving…" only if the save takes 1s or longer.
Saved (03): title "Saved privately" with a tick; the same address line; body "Today now uses this address, and so will any reminders you turn on."; primary "See Today"; secondary "Claim this address" with caption "A separate step, only if you live here."; tertiary "See your places"; caption under the stack "Only you will see this." When arriving from the email page, a status line "Email confirmed." sits above the title. This is the exact page the email project draws as its confirmed landing; there is no separate "Saved … to your account." line (flow-01 step 8's line is folded into the title plus the address line).
Announced on save: "Saved privately. Today now uses 1107 NE Birchfield Ct."
Recovery, address still held on the server or on this device (04a): keep the pre-save title. Body "Save the address you looked up?" Then the AddressChip selectable recovery row "1107 NE Birchfield Ct, Camas — Save it", a text button "Different address", and the caption "Only you will see this."
Recovery, nothing held anywhere (04b): keep the pre-save title. Body "We stopped holding that address. Type it again to save it." Then a blank, focused "Street address" field, the button "Save it" and the caption.
Storage error (05, web only): "We couldn't save that. Your browser blocked the storage we use to hold it." with "Try again"; the address stays shown.
Save failed (05b, all platforms): an InlineErrorRow under the address: "We couldn't save that. Try again." with "Try again"; the address stays shown.
Account switched (06): "This preview was started on a different account, so we didn't save it." Primary "Preview it on this account"; text button "Switch account". Saved-at-registration version of 06: "1107 NE Birchfield Ct is saved to the account that registered. We didn't save anything to this account." with primary "Switch account" and no "Preview it on this account".
Offline (07): the saved state from cache, with "You're offline · as of 6:04 PM". See Today and See your places stay enabled (your places open from cache). Claim this address is disabled with the reason "You're offline. Claiming needs a connection."
Home variant (Maya, HOME A, saves 1107 NE Birchfield Ct): body "Today keeps using your home, 2418 NE Larkspur Loop." Primary "See your places"; tertiary "See Today"; no Claim button.
Chosen-place variant (Jordan had picked Mom's house with Use for Today): body "Today still uses Mom's house, the place you chose."
Viewed-location variant (Today runs on a location he looked at recently that is not a saved place): body "Today still uses the location you looked at recently." Pinned twin: "Today still uses the location you pinned."
Duplicate: the AddressChip duplicate variant showing only its message "You already saved this as “Mom’s house”" (its inline action hidden); primary "Use for Today"; if it is already Today's place, primary "See Today".

LAYOUT & VISUALIZATION: A title that switches between two states, with one small tick glyph in primary.700 at body size beside the saved title, and nothing more. Show the address once, as a single line under the title: not a card, and not repeated in the body. Stack the three actions full width in strict weight order: filled primary, outlined secondary, plain-text tertiary. "Only you will see this." is a caption under the stack, never a second paragraph. 01-pre-save is the host's existing before state; it appears only when the person arrives without having already asked to keep the address, for example in the native launch funnel before its Keep tap. The recovery frames keep the pre-save title and swap only the body, so a lost address reads as "pick it or type it", not an error page: no error red, no warning glyph, no illustration. The held row always wins; the blank field appears only when nothing is held anywhere. When data is missing, the address line never goes blank; it falls back to a recovery frame.

INTERACTION, MOTION & HAPTICS: Save swaps the title with a cross-fade of 200ms or less; the tick appears still, with no animated check. iOS and Android give one light haptic tick on the saved state. Saving disables the actions and shows "Saving…" only if the save takes 1s or longer. "Save it" on the held row saves in one tap and lands on 03-saved. "Different address" swaps the row for the field in place. See Today with no session (for example a mail app's in-app browser) opens Today after sign-in and keeps the saved address. With Reduce Motion on, every swap is instant.

FOUNDATIONS COMPONENTS USED: AddressChip (selectable recovery row; duplicate variant with its inline action hidden; always paired with the ScopeChip sentence) · ScopeChip (sentence form "Only you will see this.") · InlineErrorRow (save-failed variant, value kept) · OfflineNotice with FreshnessLine (offline variant).

ACCESSIBILITY: The saved confirmation, "Saving…" and "Email confirmed." are role=status, announced without moving focus. On arrival from an email link, focus starts on the title. Reading order: status line, title, address, sentence, See Today, Claim this address, its caption, See your places, scope caption. The tick is decorative; the title carries the meaning. The held row is one element with a 44pt / 48dp / 44px target that reads "Save 1107 NE Birchfield Ct, Camas". Buttons are 44pt / 48dp / 44px. A disabled Claim stays focusable and reads its reason. At AX5 the address and sentence wrap, and nothing truncates.

COPY: "Keep this address handy" · "Today and a night-before pickup reminder run on it." · "Save" · "Saving…" · "Saved privately" · "Email confirmed." · "Today now uses this address, and so will any reminders you turn on." · "See Today" · "Claim this address" · "A separate step, only if you live here." · "See your places" · "Only you will see this." · "Saved privately. Today now uses 1107 NE Birchfield Ct." · "Save the address you looked up?" · "1107 NE Birchfield Ct, Camas — Save it" · "Different address" · "We stopped holding that address. Type it again to save it." · "Street address" · "Save it" · "We couldn't save that. Your browser blocked the storage we use to hold it." · "We couldn't save that. Try again." · "Try again" · "This preview was started on a different account, so we didn't save it." · "1107 NE Birchfield Ct is saved to the account that registered. We didn't save anything to this account." · "Preview it on this account" · "Switch account" · "You're offline · as of 6:04 PM" · "You're offline. Claiming needs a connection." · "Today keeps using your home, 2418 NE Larkspur Loop." · "Today still uses Mom's house, the place you chose." · "Today still uses the location you looked at recently." · "Today still uses the location you pinned." · "You already saved this as “Mom’s house”" · "Use for Today" · "Flood, wildfire, air and radon readings work here. Pickup days and local deadlines are on file only in Clark County, WA for now."

EDGE CASES: The longest address, "12808 NE Lacamas Shores Rd, Unit 204, Camas, WA 98607", wraps to two lines. An address outside Clark County adds the layer line under the address. An already-saved address shows the duplicate variant. A mail app's in-app browser with no cookies still lands on 03-saved, never on a sign-in page; See Today there goes through sign-in and keeps the address. A confirm after the hold expired lands on 04a or 04b, never on 03-saved. A slow save never shows a full-page spinner. A save failure keeps the address and offers Try again. A claimed-home user gets the home variant. A person with a chosen place, or whose Today runs on a viewed or pinned location, gets the matching "still uses" body. A different signed-in account gets 06, which must visibly refuse to save; in saved-at-registration mode its only primary is Switch account.

INSTEAD OF:
- Instead of confetti, an animated check, a full-bleed illustration or "Congratulations", draw one still tick and one factual sentence — because a quiet acknowledgement is what people trust.
- Instead of "Set up a Home" as primary, keep See Today primary and Claim this address secondary — because Today is where the value is, and claiming is optional.
- Instead of a field when the server or this device holds the address, draw the one-tap held row — because nobody should retype what we hold.
- Instead of landing on the pre-save Save button after sign-in or registration, land on the saved state — because the person already asked to keep the address.
- Instead of a notification ask or "Turn on reminders" here, say only what changed — because permission is asked later, after a pickup day is confirmed.
- Instead of dead-end error pages for recovery or account switch, keep the title and give one clear next action — because the person is one tap from done.
- Instead of wording that implies a home was created or anyone was told, say "Saved privately" and "Only you" — because a saved place grants nothing and nobody else sees it.
- Instead of "Today now uses this address" when a chosen place, a home, or a viewed or pinned location stays in charge, name what Today still uses — because the sentence must be true.

DONE WHEN: Someone who registered on a laptop and confirmed on a phone sees "Saved privately" with the address and taps See Today, with nothing to retype and no second Save tap. The one sentence names what changed, truthfully. There is no celebration and no permission ask. The recovery frames look like the happy path, not like errors, and the email project's confirmed landing matches 03-saved exactly.

ARTBOARDS:
1. f1-save-confirmation · ios · 03-saved · light — "Email confirmed." line, title, tick, address, sentence, three actions (See Today, Claim this address, See your places), captions.
2. f1-save-confirmation · web-1440 · 03-saved · light — inside the Place shell with the sidebar.
3. f1-save-confirmation · android · 03-saved · light — same content as frame 1.
4. f1-save-confirmation · web-390 · 03-saved · light — four-tab bar.
5. f1-save-confirmation · web-1440 · 01-pre-save · light — Keep this address handy, Save (host's before state).
6. f1-save-confirmation · ios · 02-saving · light — actions disabled, "Saving…", address intact.
7. f1-save-confirmation · ios · 04a-recovery-held · light — held row plus Different address.
8. f1-save-confirmation · android · 04b-recovery-nothing-held · light — blank focused field plus Save it.
9. f1-save-confirmation · web-390 · 05-storage-error · light — web only.
10. f1-save-confirmation · android · 05b-save-failed · light — InlineErrorRow under the address, Try again.
11. f1-save-confirmation · web-1440 · 06-account-switched · light — refusal line, Preview it on this account, Switch account.
12. f1-save-confirmation · ios · 07-offline · light — cached saved state, See Today and See your places enabled, Claim disabled with its reason.
13. f1-save-confirmation · android · 08-home-user-saved · light — Maya's variant.
14. f1-save-confirmation · ios · 09-ax5 · light — frame 1 at AX5.
15. f1-save-confirmation · android · 10-greyscale · light — frame 3 in greyscale.
16. f1-save-confirmation · ios · 03-saved · dark — dark twin of frame 1.
17. f1-save-confirmation · ios · 04a-recovery-held · dark — dark twin of frame 7.
18. f1-save-confirmation · web-1440 · 99-notes · light — Notes: assumptions; frames dated Sat 10 Oct (fixture save day); every invented string (the saved body sentence, the Claim caption, "Saving…", the recovery lines, Switch account, the saved-at-registration 06 line, the offline reason, the home-variant, chosen-place, viewed and pinned sentences, the longest address); the arrival rule: register lands on 03-saved, sign-in runs the save on arrival, and 01-pre-save appears only when the person has not yet asked to keep the address; the recovery routing: a lost or expired draft and a confirm after the hold expired open 04a or 04b here, and the email project routes to them; flow-01 step 8's "Saved … to your account." is folded into "Saved privately" plus the address line; "View saved places" is renamed "See your places" to name its destination (f1-your-places entry updated to match); the duplicate chip shows its message only because the primary carries Use for Today; that the home variant's action order and its missing Claim button are assumptions; that See Today with no session goes through sign-in and keeps the address; that the inventory lists the Add a place sheet as an entry but this prompt follows f1-add-place-sheet, which shows the saved sentence as its own status line; omitted states, drawn only as copy (chosen-place, viewed, pinned and duplicate variants; the saved-at-registration 06 variant with Switch account as primary; the outside-Clark-County layer line).

BATCH PLAN: Turn 1: artboards 1-6, then wait for continue. Turn 2: 7-12, then wait for continue. Turn 3: 13-18.
