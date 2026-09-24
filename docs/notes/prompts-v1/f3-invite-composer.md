# Invite a co-resident
id: f3-invite-composer · platforms: web/ios/android · isNew: False · frames: 9

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Invite a co-resident (email, username, link, QR)
THIS IS: an EXTENSION of the existing designed screen "Invite a co-resident" / the household invitation composer. This already exists and is already designed in the Pantopus design system — open it, keep everything, and change only what is listed below. Web already has all three channels and is close to a no-op; iOS is email-only today and gains Username and Link/QR; Android has email and username and gains QR.
PLATFORMS: web 1440×900 and 390×844; iOS 393×852 (sheet with detents); Android 412×915 (modal bottom sheet).
WHERE IT LIVES: Place tab → your claimed home → Members → Invite.
HOW THE USER GETS HERE: the Members roster "Invite" (and "Add guest", with Guest preselected); the "Who lives here with you?" block's "Invite by email" and "Share a link"; the home dashboard FAB; the place file's empty "People" row.
THE ONE JOB: send one household invitation by whichever channel you actually have for that person.

CONTENT — home "4312 NW Sierra Dr, Camas, WA 98607"; today Wed 16 Sep 2026.
Channel chips: Email (default) · Username · a secondary text action "Share instead".
Email field: "priya.raman@gmail.com". Username field: "@tovalind", resolving to a person row "Tova Lindgren · @tovalind".
Role chips: Member · Guest. Guest adds an access window row "Until Oct 1, 2026".
Optional note: "You'll see the pickup day and the household calendar — I already put the lease end and the Clark PUD due date in there."
Link-exposure warning, rendered the moment "Share instead" is chosen and NOT after sending: "Anyone with this link can join your household until it expires. Send it to one person."
Review manifest, four label/value rows: Home — 4312 NW Sierra Dr, Camas WA · Role offered — Member · Access — Ongoing · Expires — Sep 30, 2026 (14 days).
Post-send recovery panel: "Invitation sent to priya.raman@gmail.com", the link pantopus.com/j/7K4M-QD2X, a QR block, "Copy link", "Share", "Expires Sep 30, 2026".
Reissue state copy: "This invitation stopped working when your household's invite rules changed. Send it again?" with "Reissue".

THE VISUALIZATION DECISION: the channel picker swaps EXACTLY ONE field and never reflows the form — draw Email, Username and Link at identical total height with the recipient field in the identical position, so switching channels does not move the role chips or the primary button under the user's thumb. Email stays the visually primary path and Link/QR sit behind the "Share instead" secondary, which asks for no recipient at all, because Link is the channel that widens exposure and its warning has to arrive at the point of choosing rather than in a panel after the decision is made. The review step is a plain manifest — four label/value rows, no illustration, no celebration — because its only job is to be checkable before a stranger gets access to the household calendar. The QR renders inside the recovery panel at a size that scans from a phone held across a table, with the copyable link directly beneath it, never as the hero of the screen.

FRAMES (one each): form (Email, default) · per-channel validation error ("We don't recognise @kbeckwit" on the username channel; malformed email on Email) · review / confirm · sending · sent + recovery panel with link and QR · needs reissue · permission-denied (a member without invite rights sees the reason, not a hidden button) · error · offline (send disabled, "You're offline").

DO NOT: do not move the link-exposure warning into the post-send panel, and do not soften it into a caption. Do not let the form change height or reflow when the channel changes. Do not make the QR or the shareable link the default path — Email is the default for a reason. Do not show a success state until the send actually succeeded.
