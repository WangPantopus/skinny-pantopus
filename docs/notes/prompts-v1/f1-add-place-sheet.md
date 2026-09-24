# Add a place (signed-in address search + save)
id: f1-add-place-sheet · platforms: web/ios/android · isNew: True · frames: 9

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Add a place
THIS IS A NEW SHEET. Nothing like it exists for a signed-in user today.
PLATFORMS: web as a centred modal on 1440x900 and a bottom sheet on 390x844 mobile web; iOS 393x852 sheet at the medium detent with a grabber; Android 412x915 Material 3 bottom sheet.
WHERE IT LIVES: a sheet over the Place tab and over Today - it never takes over the tab bar, which stays visible and dimmed behind it.
HOW THE USER GETS HERE: Today's empty state CTA "Preview an address"; Your places empty state and its "+ Add"; the widget-tap landing when there is no place; the Place file address row when empty.
THE ONE JOB: a signed-in person with no place types one address and saves it, and lands on Today running on it.

CONTENT (exact copy, this density):
Title: "Add a place". Field label: "Street address". Typed value in the suggestions frame: "1402 NE 3".
Suggestion list, five rows, plain text, no icons, no thumbnails:
- 1402 NE 3rd Ave, Camas, WA 98607
- 1402 NE 3rd Ct, Camas, WA 98607
- 1420 NE 3rd Ave, Camas, WA 98607
- 1402 NE 33rd Ave, Vancouver, WA 98663
- 1402 N 3rd St, Ridgefield, WA 98642
Selected suggestion shows as a single confirmed line above the button. Primary button: "Save".
Privacy line, one sentence, as a caption under the button: "A private bookmark for your account. Nobody else can see it."
Geocode failure copy: "We couldn't find that address."
Unsupported region copy, shown after typing "1402 NE 33rd Ave, Portland, OR": "We only cover Clark County, Washington right now."
Duplicate copy: "You already saved this as 'Mom's house' on 4 Sep 2026." and the button becomes "Use for Today".

THE VISUALIZATION DECISION: a deliberately compact sheet - one focused field at the top with the caret already in it and the keyboard up on natives, suggestions as an unadorned list directly under the field, one primary button, one privacy sentence. That is the whole surface. It is explicitly NOT a mini-funnel: no map, no map pin, no satellite thumbnail, no grade, no score, no "here's what you'll get" list, no progress dots, no step counter, no second page. The reading happens on Today one second later; this sheet's only claim is "bookmark it". Sheet height stays at one detent across all nine frames so the error and duplicate states do not resize the sheet under the user's thumb - they replace the suggestion list in place.

STATES TO DRAW (one frame each):
1. Idle - empty focused field, button disabled, privacy line already visible.
2. Typing / suggestions - the five rows above.
3. Geocode failure - the message replaces the suggestion list, field keeps the typed text.
4. Unsupported region - Portland address typed, the Clark County line, no suggestions.
5. Saving - button in its loading state, field locked, suggestions cleared.
6. Saved - the sheet mid-dismiss with Today behind it already carrying the new header chip "1402 NE 3rd Ave - Only you".
7. Duplicate of an existing saved place - the "Mom's house" line, button swapped to "Use for Today".
8. Offline - field disabled, "You're offline. We can't look up an address right now."
9. Error.

DO NOT: do not use the words "home", "claim" or "household" anywhere on this sheet - claiming is a much heavier promise than this CTA makes, and routing these buttons at claiming instead of here is exactly the mistake this sheet exists to prevent. Do not add a map, a preview card, a grade, a score, or a second step. Do not offer a route into the signed-out /start funnel.

