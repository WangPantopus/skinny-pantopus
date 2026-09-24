# Email verification handoff carrying the held address
id: f1-email-verify-handoff · platforms: web · isNew: False · frames: 7

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Email verification handoff carrying the held address (two surfaces - the verify-email-sent interstitial and the verification landing)
THIS IS AN EXTENSION of the existing designed screens "Check your email" (the register -> verify-email-sent interstitial) and the verification landing - both already exist and are already designed in the Pantopus design system: open them, keep everything, and change only what is listed below.
PLATFORMS: web only - 1440x900 desktop and 390x844 mobile web. These are auth-shell pages: no four-tab bar, and they exit into Place -> the save confirmation.
HOW THE USER GETS HERE: submitting register from the /start funnel with a previewed address; tapping the verification link in the email, often on a different device from the one that registered.
THE ONE JOB: keep the previewed address alive across the register -> verify-email -> return gap, so the person who opens the mail on their phone still gets the address they typed on their laptop.

CONTENT (exact copy, this density):
Interstitial headline stays "Check your email". Add one line under it: "We're holding 1402 NE 3rd Ave for you. Verify your email to save it."
Held-address chip content: 1402 NE 3rd Ave, Camas, WA 98607.
Existing supporting line, kept: "We sent a link to d.reyes@fastmail.com."
Resend control: "Resend the link", with the cooldown "You can resend in 0:47".
Verified on a different device: "Saved 1402 NE 3rd Ave to your account." then straight into the save confirmation's saved state.
Draft-expired copy: "We stopped holding that address." with a focused "Street address" field and "Save it".
Link-expired copy: "This link has expired." plus "Send a new link" AND, still present, "We're still holding 1402 NE 3rd Ave."
No-held-address frame: the untouched original verification copy, no chip, no held-address line.

THE VISUALIZATION DECISION: exactly one change to the interstitial - the held address renders as a small pinned address CHIP directly under the headline, so the user sees the thing being held instead of only reading about it. Chip spec: surface.raised fill, border.default hairline, radius pill, a 16px pin glyph in primary.DEFAULT, the street line at bodySmallMedium 14/20 and the city/state/ZIP at caption 12/16 in text.secondary, all on one line at desktop and wrapping to two at 390. Label only - never coordinates, never a map, never a satellite thumbnail. Nothing else on the interstitial moves. On the landing, the cross-device frame must be pixel-identical to the same-device frame: same chip, same confirmation, same wording. If the phone frame looks like a recovery path, the design has leaked the implementation detail this work exists to hide.

WHY: the held address is currently only a device-local browser draft, so the bridge fails silently for the single most common signup path - register on a laptop, open the mail on a phone. The server now holds the pending place, and the chip is the user-visible promise that it is held. Honesty rule: a held address is a saved place, not a home - carry "Only you will see this." as a caption under the chip.

STATES TO DRAW (one frame each):
1. Sent, address named - headline, held-address chip, the holding sentence, mail address, resend with cooldown running.
2. Verified on the same device - the brief hand-off frame, chip still shown, routing into the save confirmation.
3. Verified on a different device - identical to frame 2, plus "Saved 1402 NE 3rd Ave to your account."
4. No held address - plain verification copy, chip absent, layout does not leave a gap where it would have been.
5. Draft expired - "We stopped holding that address." with the inline re-entry field, in a neutral, not an error, treatment.
6. Verification link expired - "This link has expired.", "Send a new link", and the chip still present with "We're still holding 1402 NE 3rd Ave."
7. Error.

DO NOT: do not draw a map, a pin on a map, a street-view image or any thumbnail of the held address. Do not show coordinates. Do not make the different-device frame look degraded, apologetic or recovery-shaped. Do not bury the held address inside the body paragraph - it is a chip or it is nothing. Do not add a tab bar to these auth pages.

