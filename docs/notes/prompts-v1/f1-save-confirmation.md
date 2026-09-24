# Saved - Today now uses this address
id: f1-save-confirmation · platforms: web/ios/android · isNew: False · frames: 7

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Saved - Today now uses this address
THIS IS AN EXTENSION of the existing designed screen "Keep this address handy" (the pending-place confirmation) - this already exists and is already designed in the Pantopus design system: open it, keep everything, and change only what is listed below. On web it stops being its own route and becomes the success STATE of the save; on iOS and Android it stays the route it already is.
PLATFORMS: web 1440x900 and 390x844; iOS 393x852; Android 412x915.
WHERE IT LIVES: Place tab -> the save moment, immediately before Today.
HOW THE USER GETS HERE: the /start funnel's continue-with-preview; the email verification landing; the add-a-place sheet (which skips straight to the saved frame).
THE ONE JOB: tell the user in one sentence what the save actually changed, and hand them to Today.

CONTENT (exact copy, this density):
Title swaps from "Keep this address handy" (pre-save) to "Saved privately" (saved).
Body, revised - the current copy ("a private bookmark... setting up a Home is a separate step") is now wrong by omission, because the save also sets Today and enables the morning briefing: "1402 NE 3rd Ave, Camas, WA 98607 is the address Today runs on now, and your morning briefing can use it. Setting up a Home is still a separate step."
Three actions in strict weight order: primary "See Today", secondary "Set up a Home", tertiary "View saved places".
Caption under the action stack: "Only you can see this."
Recovery copy: "We couldn't read the address you previewed on this device." with a focused field labelled "Street address", the value the user retypes (1402 NE 3rd Ave, Camas, WA 98607) and one button, "Save it".
Account-switched copy: "This preview was started on a different account, so we didn't save it." with primary "Preview it on this account".
Save-error copy: "We couldn't save that. Your browser blocked the storage we use to hold it." with "Try again".

THE VISUALIZATION DECISION: a two-state title with a single small confirming glyph - one tick in primary.DEFAULT at body size next to the title, nothing more. The saved address renders once, as a single line under the title, not as a card and not repeated in the body. The three actions stack in strict visual weight order: filled primary, outlined secondary, plain text tertiary, so "See Today" is unmistakably the exit. The privacy sentence is a caption under that stack, never a second paragraph. The recovery frame keeps the SAME title and swaps only the body for a focused address field, so a lost draft reads as "type it again" rather than as an error page: no error red, no warning glyph, no full-page error illustration in that frame.

WHY the recovery frame is first-class, not an afterthought: the previewed address lives in a device-local browser draft with a 24-hour life, so anyone who registers on a laptop and verifies on their phone arrives here with nothing at all. Draw that frame at the same polish as the happy path.

STATES TO DRAW (one frame each):
1. Pre-save confirm - title "Keep this address handy", address line, primary "Save".
2. Saving - actions disabled, quiet inline progress, address line intact.
3. Saved - title "Saved privately", tick, revised body, three actions, caption.
4. Preview lost / expired / different device - the inline recovery field.
5. Save error (browser storage failure) - message plus "Try again", address still shown.
6. Account switched (expectedUserId mismatch) - must visibly refuse to save.
7. Offline - saved state shown from cache with "See Today" enabled and the other two actions disabled with a reason.

DO NOT: do not celebrate - no confetti, no full-bleed illustration, no "Congratulations", no animated checkmark. Do not promote "Set up a Home" to the primary action. Do not draw the recovery or account-switched frames as dead-end error pages. Do not imply the save created a Home or told anyone else anything.

