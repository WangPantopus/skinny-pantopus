# Email verification handoff carrying the held address
id: f1-email-verify-handoff · platforms: web · isNew: False · artboards: 19

Use the Pantopus house style pasted above and the Foundations components from prompt 00, by exact name.

SCREEN: Email confirmation handoff carrying the saved address · f1-email-verify-handoff

TYPE: EXTENSION of the existing designed screens "Check your email" (the page shown after registering) and the email confirmation landing. These screens already exist in the Pantopus design system. The attached screenshots are exact. Keep everything and change only what is listed. Wherever the host says "verify your email", write "confirm your email", because "verify" is reserved for address verification.

ATTACH: (1) a web capture of the current "Check your email" page at 1440 and 390; (2) the current confirmation landing; (3) the /start register form, for continuity; (4) the saved state (03-saved) from the f1-save-confirmation project, if drawn; (5) the Foundations board.

PLATFORMS & VIEWPORTS: Web only: 1440x900 and 390x844. Frames 1-3 and 7-16 are auth-shell pages with no tab bar and no sidebar. Frames 4-6 and 18 show where confirming lands: the save confirmation's 03-saved page inside the Place shell (sidebar at 1440, four-tab bar at 390).

WHERE IT LIVES & HOW PEOPLE ARRIVE: The auth shell, between register and the Place tab. Entry points: (1) submitting register from /start after looking up an address, when the server stores the address against the new account; (2) the link in the email, often opened on another device or in a mail app's in-app browser with no cookies; (3) reopening "Check your email" later in the same browser.
WHERE IT LEADS: The confirm action (code or link) opens the save confirmation's 03-saved page directly, exactly as that project draws it: status line "Email confirmed.", title "Saved privately" with its tick, the address line, the body sentence and the three actions. There is no timed auto-advance, it never lands on the pre-save Save button, and never on a sign-in page. Held mode only: if the hold has expired when the person confirms, the confirm opens the save confirmation's recovery state instead: 04a (held row) if this device still has the address, otherwise 04b (blank field). This page never draws its own recovery row. If a different account is signed in on the device that opens the link, it goes to the save confirmation's account-switched state (06). In the saved-at-registration mode, 06 says the address is saved to the account that registered and nothing was saved to this one.

WHO AND WHEN: At 12:20 PM on Sat 10 Oct, the day after moving from Portland, Jordan Lee registers on his work laptop after looking up 1107 NE Birchfield Ct and lands on "Check your email". At 6:10 PM he taps the link in Mail on his iPhone (web-390). These frames are dated Sat 10 Oct, the fixture save day.

THE ONE JOB: Keep the looked-up address safe across the confirm-your-email gap, and let the person finish on whichever device they are using.

FIRST FIVE SECONDS: The eye lands first on the headline "Check your email", then on the sentence saying the address is already saved, with the address chip beneath it, then on the code field. The single primary action is "Confirm email".

CONTENT:
The headline stays "Check your email".
Saved at registration (default wherever the sign-in provider allows it): under the headline, "Saved privately. Confirm your email to keep your account." Chip: the AddressChip default state, "1107 NE Birchfield Ct" with "Camas, WA 98607", with no hold message, followed by "Only you will see this."
Held until confirmation (fallback): under the headline, "We're holding 1107 NE Birchfield Ct for you. Confirm your email to save it." Chip: the AddressChip held variant with the same address, followed by "Only you will see this." and then the dated hold line "We're holding it for 7 days, until Sat 17 Oct."
Host line (changed): "We sent a link and a 6-digit code to jordan.lee@example.com."
Code: the label "Or enter the code from the email", one 6-digit input, and the button "Confirm email". The code stays valid at least as long as the link.
Resend: "Resend the link", with the hint beside it "Can't find it? Check your spam or junk folder." After a resend, announce once: "Sent. You can send another link in 1 minute." During that minute the control is disabled with the reason "You can send another link in 1 minute". No ticking countdown. After the minute, the control re-enables silently and the reason line disappears.
Wrong code: "That code doesn't match. Check the newest email from Pantopus, or resend the link."
Expired code: "This code has expired. Send a new link and use the code in the newest email." with "Send a new link".
Confirmed (same device and different device, identical): the save confirmation's 03-saved page exactly, with only "Email confirmed." above its title. No extra "Saved … to your account." line.
No address held: the untouched original copy, no chip, no sentence, code field still present.
Hold ended before confirming (held fallback only, frame 11): the person reopens "Check your email" after the hold ended. Under the headline: "We stopped holding that address. Confirm your email, then save it again." The chip uses the AddressChip expired fill only, as a label with no action; its board caption is replaced by that sentence. The code field and Confirm email stay; confirming opens the save confirmation's 04a or 04b.
Link expired: "This link has expired." with "Send a new link". The chip stays, with "We're still holding 1107 NE Birchfield Ct." (held fallback) or "1107 NE Birchfield Ct is still saved to your account." (saved at registration).
Send failed: saved mode "We couldn't send the email just now. Your address is still saved. Try again."; held fallback "We couldn't send the email just now. We're still holding your address. Try again." Button "Try again".
Offline: saved mode "You're offline. Your address is still saved. Enter the code when you're back online."; held fallback "You're offline. We're still holding your address. Enter the code when you're back online."

LAYOUT & VISUALIZATION: Keep the host layout. Add only these, in this order under the headline: the status sentence, the AddressChip, the scope sentence, then (held fallback only) the hold-length line. The host line follows. Below it, the code block: label, one full-width input, the Confirm email button. Then the resend row with the spam hint. The chip is a label only: never a map, a pin on a map, a street image or coordinates. It sits on one line at 1440 and wraps to two lines at 390. The two confirmed frames at 390 are pixel-identical: same copy, same page as the save confirmation's 03-saved, nothing that looks like recovery. With no address held, the chip slot collapses and leaves no gap. The hold-ended and link-expired frames use neutral styling, no error red. Only wrong-code, expired-code and send-failed use the error glyph, and their text stays text.primary. Captions use text.secondary, never text.muted.

INTERACTION, MOTION & HAPTICS: Paste or type the full code into the one input, then tap Confirm email. The link opens the same saved page on any device. Confirm email shows inline progress only if it takes 1s or longer; never a full-page spinner. Page changes cross-fade in 200ms or less; with reduced motion on, changes are instant. Web has no haptics.

FOUNDATIONS COMPONENTS USED: AddressChip (default state in saved mode; held variant, extended with a date, in held mode; expired fill only, with its caption and action replaced, on the hold-ended frame) · ScopeChip (sentence form "Only you will see this.") · InlineErrorRow (wrong code; expired code; send failed) · OfflineNotice (form-offline variant).

ACCESSIBILITY: On load, focus starts on the headline. Reading order: headline, status sentence, chip (read as the full address), scope sentence, hold line, host line, code label and input, Confirm email, resend and hint. The code input is a single field with a numeric keypad and one-time-code autofill; paste is allowed; never six boxes. Errors are tied to the input and announced politely. "Email confirmed.", "Sent…" and the cooldown are announced once each. The pin glyph is decorative. At 200% text, the chip wraps, the code field and buttons go full width, and the email address breaks after the @. Every text passes 4.5:1. Targets are at least 44px.

COPY: "Check your email" · "Saved privately. Confirm your email to keep your account." · "We're holding 1107 NE Birchfield Ct for you. Confirm your email to save it." · "We're holding it for 7 days, until Sat 17 Oct." · "Only you will see this." · "We sent a link and a 6-digit code to jordan.lee@example.com." · "Or enter the code from the email" · "Confirm email" · "Resend the link" · "Can't find it? Check your spam or junk folder." · "Sent. You can send another link in 1 minute." · "You can send another link in 1 minute" · "That code doesn't match. Check the newest email from Pantopus, or resend the link." · "This code has expired. Send a new link and use the code in the newest email." · "Email confirmed." · "We stopped holding that address. Confirm your email, then save it again." · "This link has expired." · "Send a new link" · "We're still holding 1107 NE Birchfield Ct." · "1107 NE Birchfield Ct is still saved to your account." · "We couldn't send the email just now. Your address is still saved. Try again." · "We couldn't send the email just now. We're still holding your address. Try again." · "Try again" · "You're offline. Your address is still saved. Enter the code when you're back online." · "You're offline. We're still holding your address. Enter the code when you're back online."

EDGE CASES: The longest email, "jordan.lee-rivera.household@example.com", wraps after the @. The longest address, "12808 NE Lacamas Shores Rd, Unit 204, Camas, WA 98607", wraps inside the chip. After several resends, the same one-minute rule and spam hint apply. A slow confirm shows only inline progress. An in-app browser with no cookies still lands on the saved page. A confirm after the hold ended lands on the save confirmation's 04a or 04b. A different account signed in on the phone goes to the save confirmation's refusal state. The hold never lasts under 20 hours, and the page always states its length. A code never expires before the link does. With nothing held, no chip and no gap.

INSTEAD OF:
- Instead of "Verify your email to save it" as the default, write "Saved privately. Confirm your email to keep your account." — because the save happens at registration and confirming protects only the account.
- Instead of link-only confirmation, add a pasteable 6-digit code — because switching devices and spam folders stop people.
- Instead of six separate digit boxes, draw one input — because split boxes break paste and autofill.
- Instead of a ticking "0:47" resend countdown, announce the wait once in words — because timers are hard to use and read aloud badly.
- Instead of the address buried in a paragraph, a map or a thumbnail, draw the AddressChip — because people should see what is held, as a label only.
- Instead of "still saved" or the held chip in held mode's opposite, match the words to the mode: "holding" and the held variant only in held mode, "saved" and the default chip in saved mode — because the address is not saved until confirmation in held mode.
- Instead of a recovery row on this page when the hold has ended, route the confirm to the save confirmation's recovery — because one situation should have one destination and one set of words.
- Instead of a timed auto-advance, a degraded different-device frame or an extra confirmation line, open the save confirmation's 03-saved exactly on the confirm action — because nothing went wrong and both projects must draw the same page.
- Instead of a tab bar on the auth pages, keep the auth shell — because the person has not reached the app yet.

DONE WHEN: Someone can register on a laptop, paste the code there, or tap the link on a phone, and either way land on the save confirmation's "Saved privately" page with the same address and nothing to retype. The hold length is stated. Every held-mode line says "holding", never "saved". The two 390 confirmed frames are pixel-identical and match the save confirmation's 03-saved. A confirm after the hold ended reaches recovery, not a false saved page.

ARTBOARDS:
1. f1-email-verify-handoff · web-1440 · 01-sent-saved · light — headline, saved sentence, default-state chip, scope sentence, host line, code field, Confirm email, resend with spam hint.
2. f1-email-verify-handoff · web-390 · 01-sent-saved · light — chip wraps to two lines.
3. f1-email-verify-handoff · web-1440 · 02-sent-held · light — held sentence, held-variant chip, scope sentence and the 7-day hold line.
4. f1-email-verify-handoff · web-390 · 03-confirmed-other-device · light — the save confirmation's 03-saved in the Place shell with "Email confirmed." above the title.
5. f1-email-verify-handoff · web-390 · 04-confirmed-same-device · light — pixel-identical to frame 4.
6. f1-email-verify-handoff · web-1440 · 04-confirmed-same-device · light — same landing with the sidebar.
7. f1-email-verify-handoff · web-1440 · 05-wrong-code · light — code kept, InlineErrorRow.
8. f1-email-verify-handoff · web-390 · 05b-code-expired · light — InlineErrorRow with Send a new link.
9. f1-email-verify-handoff · web-390 · 06-resend-cooldown · light — Sent message, resend disabled with its reason.
10. f1-email-verify-handoff · web-1440 · 07-no-held-address · light — original copy, no chip, no gap.
11. f1-email-verify-handoff · web-390 · 08-hold-ended-before-confirm · light — held mode, page reopened after the hold ended: neutral, "We stopped holding that address. Confirm your email, then save it again.", chip in expired fill with no action, code field and Confirm email.
12. f1-email-verify-handoff · web-1440 · 09-link-expired · light — Send a new link, chip still present, held-fallback line.
13. f1-email-verify-handoff · web-390 · 10-send-error · light — held-fallback copy.
14. f1-email-verify-handoff · web-390 · 11-offline · light — saved-mode copy.
15. f1-email-verify-handoff · web-390 · 12-200pct-text · light — frame 1 content at 200% text in the 390 frame.
16. f1-email-verify-handoff · web-1440 · 13-greyscale · light — frame 1 in greyscale.
17. f1-email-verify-handoff · web-1440 · 01-sent-saved · dark — dark twin of frame 1.
18. f1-email-verify-handoff · web-390 · 03-confirmed-other-device · dark — dark twin of frame 4.
19. f1-email-verify-handoff · web-1440 · 99-notes · light — Notes: assumptions; frames dated Sat 10 Oct (fixture save day); every invented string (the email addresses, the code label and button, the spam hint, the cooldown lines, wrong-code and expired-code lines, the hold-ended line, the send-failed and offline lines in both modes, the still-saved and still-holding lines, the longest address and email); the changed host line; the dated extension of the contract's held string; the saved mode using the AddressChip default state, not the held variant; the AddressChip expired override on frame 11 (board caption "We're no longer holding this address." and action "Search again" replaced by the hold-ended sentence and no action, because recovery lives in the save confirmation); the routing rule that a confirm after the hold ended opens the save confirmation's 04a or 04b; the confirmed landing is the save confirmation's 03-saved exactly, and the earlier "Saved 1107 NE Birchfield Ct to your account." line is dropped (folded into "Saved privately" plus the address line); the rule that the code lasts at least as long as the link (link length to be set by the founder); how long an unconfirmed account and its saved place last is for the founder to set, and if it can lapse, the saved-mode page states the date, as the held mode does; which frames depend on the provider allowing save at registration; the handoff note that the save confirmation's 06 must say the address is saved to the registering account in saved mode; the 320px reflow (chip wraps, full-width controls, email breaks after @), not drawn; omitted states (confirming in progress, inline progress on Confirm email, drawn only as copy; send-failed saved mode; offline held mode).

BATCH PLAN: Turn 1: artboards 1-6, then wait for continue. Turn 2: 7-12, then wait for continue. Turn 3: 13-18, then wait for continue. Turn 4: 19.
