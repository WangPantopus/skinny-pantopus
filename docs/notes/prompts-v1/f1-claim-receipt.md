# Claimed - what came with you
id: f1-claim-receipt · platforms: web/ios/android · isNew: False · frames: 9

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Claimed - what came with you
THIS IS: an EXTENSION. The host is the existing post-claim / post-verify success surface (web VerifiedSuccess at /app/place?verified=1, and the native equivalents after add-home / verify) - this already exists and is already designed in the Pantopus design system - open it, keep everything including its existing success headline, and add only the receipt described below.
PLATFORMS: web 1440x900 and 390x844, iOS 393x852, Android 412x915.
WHERE IT LIVES IN THE FOUR-TAB IA: Place tab, landing after the claim/verify flow completes.
HOW THE USER GETS HERE: finishing the claim or address-verification flow; and once, as a dismissible banner at the top of the place file the first time it is opened after a claim.
THE ONE JOB: name every fact that moved from the private saved place to the shared home, and get real consent for the one privacy change the promotion causes.

CONTENT (verbatim where given; densest realistic case, 2418 NE Ingle Rd, Camas WA 98607):
  Line under the existing headline: "Your pickup day, 2 dates and Ollie came with you."
  Manifest rows, each with its value and a tick — the counts in that sentence must always equal the rows drawn:
    - Pickup day - Tuesday - recycling every other week, next recycling Sep 22, 2026
    - Renters insurance renews - Nov 14, 2026
    - Furnace warranty ends - Dec 2, 2026
    - Ollie, your keeper - knows 11 things about this address
  Consent block: "The 2 dates you entered are now visible to everyone in this household." with the household named — Sam Ortega and Dana Whitfield — and two peer buttons: "Share with the household" / "Keep them private to me".
  Closing line: "Today now uses this home."

THE VISUALIZATION DECISION:
  A short receipt list, not a celebration. One row per carried item: tick, item name, value on the primary line. Each row carries a scope-change pair on its trailing edge drawn with the same two glyphs used everywhere else in the product — the private "Only you" glyph, a small arrow, the household glyph — so the migration is legible per row rather than asserted once in prose. The old "Saved place - Only you" chip is shown struck through in the header, replaced by the home glyph. Flat rows on surface.raised, no card-per-item, no illustration, no confetti: this is a manifest and its only job is to be checkable line by line against what the user remembers typing.

STATES TO DRAW (each its own frame; 7 on web, then the dense all-carried frame once on iOS and once on Android = 9 frames):
  all four carried (the dense case above) - nothing to carry (the plain existing success surface, no empty list, no "0 items") - dates carried only - pickup rule carried only - keeper carried (phase 2) - carry failed (the failed row named explicitly, errorBg, "We couldn't move your furnace warranty" + Retry, the other rows still ticked) - household-visibility consent declined (dates stay private to the actor, rows show the private glyph on both sides of the arrow)

WHY IT IS SHAPED THIS WAY (do not optimise this away): today a user loses the pickup rule, the dates and the keeper at the exact moment they invest most, because those are keyed to the saved place and nothing promotes them. The receipt is the proof that they did not. And turning a private bookmark into a household-visible record is a genuine privacy change, so it needs a choice on screen, never a silent migration.

DO NOT: do not draw confetti, a celebration illustration, a badge, a percentage or a progress bar — nothing here should read as "you are 60% complete". Do not let a failed carry render as a success with a row quietly missing, and do not describe the visibility change without offering the decline.
