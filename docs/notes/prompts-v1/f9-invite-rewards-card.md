# Invite rewards (what a referral actually pays)
id: f9-invite-rewards-card · platforms: web/ios/android · isNew: True · frames: 6

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Invite rewards card — what a referral actually pays
PLATFORMS: web 1440×900 desktop and 390×844 mobile web; iOS 393×852; Android 412×915.
THIS IS: a NEW card. It is net-new on web (web renders no referral UI at all today). On iOS and Android it replaces the referral block inside ProfileInsightCards, moved off the profile — so match that existing card's frame, padding and type, but treat the contents below as new.
WHERE IT LIVES: Nearby tab, the first card on the tab, directly above Block Founders and the cells map.
HOW THE USER GETS HERE: opening the Nearby tab; the post-share confirmation's "See what this earns"; the Block Founders allowance line "where did this come from?".
THE ONE JOB: say honestly what one referral pays, and say it where the link is actually copied.

CONTENT (exact strings, densest realistic case):
Link row, top of the card: "pantopus.com/join/ypw-4k2p" with a Copy button and caption "3 joined · 11 invited".
Hero line, immediately below: "4 postcard invites this week" with the split spelled out underneath — "3 base + 1 earned from a referral · resets Monday, Sep 21".
Tier rows beneath, each tappable to its destination:
1 neighbor joins → "An extra postcard invite this week" · Unlocked · → Block Founders
3 neighbors join → "Cells map detail: verified homes, founding slots and activity per cell" · Unlocked · "See the map" → Nearby cells map
10 neighbors join → "Founding Neighbor badge" · Locked · "7 more neighbors who join"
25 neighbors join → "Block Builder — the badge, and 6 postcard invites a week permanently" · Locked · "22 more neighbors who join"
Zero state: "0 joined · 0 invited", hero becomes "3 postcard invites this week", link still copyable. Stale-cache state: caption "Counts refresh every 5 minutes · last updated 10:37 AM" with a Refresh control.

THE VISUALIZATION DECISION:
Link and payoff in one frame. The link row sits on top, the live reward the user can feel today is the hero in heading2, and the locked tiers are demoted to a quiet secondary list below — with real tap targets, not decoration. With near-zero other users a 0/1/0/0 tier list is demoralising, so the card must never open on what the user has not got.
Locked and unlocked differ by more than opacity: an unlocked row sits on surface.base with a 3px primary.600 left rail, a verb and a chevron; a locked row sits on surface.sunken with a 3px border.strong left rail and, in place of a chevron, its requirement stated as a count — "7 more neighbors who join". A locked row states a requirement; it never shows a dimmed promise.
The whole tier table arrives from the server payload, not mirrored in client code — four copies already disagree — so draw the row so that a four-word payout and a fourteen-word payout both fit on two lines without the layout reflowing, and so an extra tier row can appear without breaking the rhythm.
Degrade: if the payload fails, show the link row and Copy alone. The link is always usable, in every state.

STATES TO DRAW (one frame each): zero referrals (the realistic pilot state) · partial progress at 3 of 10 · all tiers unlocked · loading · error · 5-minute cache serving stale counts right after a conversion.

DO NOT: do not draw a percentage, a progress ring or a progress bar — nothing here should read as "you are 30% complete". Progress is a count against a count. Do not list priority matching or any gig-matching payout; it does not exist. Do not call tier 4 anything but Block Builder, and never use Block Founder and Founding Neighbor as synonyms.
