# Home basics: move-in date + restore the mover rows
id: f6-home-basics-rows · platforms: web/ios/android · isNew: False · frames: 9

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Home settings — the Home Info section
THIS IS: an EXTENSION of the existing designed screen "Home settings" (per-home settings). This already exists and is already designed in the Pantopus design system — open it, keep everything, and change only what is listed below.
PLATFORMS: web 1440×900 desktop and 390×844 mobile web; iOS 393×852; Android 412×915.
WHERE IT LIVES: Place tab → your claimed home → Settings → Home Info.
HOW THE USER GETS HERE: Settings from the home header overflow; the place file's "Moved in" row (tap to set) deep-links here with the date row already focused; the undo toast after dismissing the moving checklist ("Show again") lands here too.
THE ONE JOB: correct the move-in date that switches the whole 60-day mover experience on, and get a dismissed moving checklist back.

CONTENT — home "4312 NW Sierra Dr, Camas, WA 98607", owner Dana Whitfield, today is Wednesday 16 September 2026. Add exactly two rows to Home Info, under the existing Address and Home name rows:
1. "Moved in" · value "August 28, 2026" · native date control (iOS inline date picker in a sheet, Android M3 date picker dialog, web date input). Persistent helper line under the value: "Shows your first-week steps for 60 days."
2. "Moving checklist" · trailing text action "Show again". This row renders ONLY while the checklist is dismissed. When it was never dismissed the row is absent, not greyed.

THE VISUALIZATION DECISION: two plain settings rows in the existing list grammar — label left, value right, chevron. No card, no illustration, no new section header. The only real decision is the helper line: without it "Moved in" reads as trivia rather than the switch that turns the mover experience on, so it sits under the value in bodySmall / text.secondary and must survive a 320dp column unwrapped and untruncated. When the date is unset the value reads "Not set" in text.muted and the helper line still shows, so the consequence of setting it is legible before anything is set. This is the correction path that does not exist on iOS or Android today, where move-in date can only ever be stamped as "today" from an add-home checkbox — so the row must read as editable at a glance, not as a fact being reported back.

FRAMES (one each):
- Move-in date unset ("Not set")
- Set and editable, date control open
- Date in the future (Oct 12, 2026): inline note "Your first-week steps will start when you move in", semantic.warning, save still allowed
- Date more than 60 days ago (Apr 3, 2026): "Your first-week steps have finished", save still allowed
- Saving (value slot shows progress, row disabled)
- Save error: "We couldn't save that. Try again." on semantic.errorBg with a Retry text button, old value still visible
- Permission-denied: a non-owner member sees the date as a read-only value captioned "Only the owner can change this"
- Dismissed (restore row present)
- Never dismissed (restore row absent)

DO NOT: do not turn this into an onboarding step, a "finish setting up your home" card, or anything carrying a percentage or progress bar. Do not use a red/destructive treatment for the two out-of-window notes — the date is not wrong, it only means the mover rows will not appear. Do not drop the helper line to save vertical space, and do not render a disabled-looking control for the non-owner case.
