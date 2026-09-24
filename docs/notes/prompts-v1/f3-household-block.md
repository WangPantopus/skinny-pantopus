# Who lives here with you (household block)
id: f3-household-block · platforms: web/ios/android · isNew: False · frames: 7

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

THIS IS NOT A NEW SCREEN. It is one new card added to two screens that already exist and are already designed in the Pantopus design system: the place file (the Place tab's index) in its People section, and the home dashboard. Open both, keep everything, and add only this card. Same card in both hosts, one shared dismissal.

PLATFORMS: web 1440x900 and 390x844, iOS 393x852, Android 412x915.

WHERE IT SITS: Place tab -> your place file -> People section. Reached by scrolling the Place tab index (no nav action), by the Members roster empty state re-offering it, and mirrored on the home dashboard. No push, no deep link.

THE ONE JOB: ask a new resident, once, who else lives at this address, and make inviting them a two-tap job on the screen they actually see.

CONTENT (use these exact strings): Title "Who lives here with you?". Privacy sentence "They see the same pickup day, calendar and bills. Nothing about your home is shared with anyone else." Primary "Invite by email". Secondary "Share a link". Tertiary "Just me". Context: 1428 NE Maple St, Camas WA 98607; viewer Dana Whitfield, moved in Aug 22 2026; today is Sep 16 2026. Directly above this card sits the existing verify banner "Verify this address to send neighbor messages" - draw it, and keep this card quieter than it. Undo toast: "Just you, then." + "Undo". Permission-denied line: "You and 2 others live here". Collapsed roster row: "Dana, Sam and Priya live here" + "View".

THE VISUALIZATION DECISION: a two-CTA block, not a hero. Stack order: title, privacy sentence at bodySmall over two lines, primary and secondary buttons side by side (stacked below 360), then "Just me" alone on the last line. The block must survive a 320dp column with the privacy sentence intact - wrap it, never clamp it with an ellipsis. "Just me" is a real text button at the secondary label's size and weight, not a greyed afterthought, because declining is a legitimate answer. Card on surface.raised with border.default, no accent fill, no illustration, no avatar placeholders - there is nobody to draw yet. Shows only when members_active === 1 or within 7 days of the viewer's own occupancy start.

WHY IT LIVES HERE (do not optimise this away): there is no Home tab in the four-tab nav and both natives land on Place, so a dashboard-only card would be seen by a minority of new residents. And "Just me" must be reversible - undo toast plus a re-offer from the roster - so a mis-tap is not a dead end.

STATES TO DRAW, each its own frame:
1. Loading - skeleton at the card's real height, no spinner.
2. Visible - three CTAs, verify banner above; also show it at 320dp.
3. Dismissed with undo - card collapsed, toast with Undo.
4. Permission-denied - a member without members.manage sees read-only "You and 2 others live here", no invite CTAs.
5. Member count > 1 - block gone, replaced by the roster row.
6. Dismiss PATCH failed - card unchanged, no error toast, retried silently.
7. Offline - CTAs disabled with a one-line reason.

DO NOT: do not turn this into a full-bleed onboarding hero, a modal or a coach mark; do not add an illustration or ghost avatars; do not grey out, shrink or hide "Just me"; do not shorten the privacy sentence to make the card fit - that sentence is the reason a person agrees to invite someone.
