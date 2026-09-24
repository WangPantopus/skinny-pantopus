# Snap capture tray (batch session)
id: f10-snap-capture-tray · platforms: web/ios/android · isNew: True · frames: 8

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Snap capture tray (batch session)
PLATFORMS + VIEWPORTS: iOS 393×852 (sheet over Mail Day, large detent); Android 412×915 (Material 3 full-height bottom sheet); web 1440×900 desktop modal and 390×844 mobile web modal.
THIS IS: a NEW sheet/modal. It sits OVER the Mail Day triage screen, which stays visible behind the scrim. On web, mirror the shipped SnapSellListingModal pattern (file input with capture=environment on mobile, drag-and-drop target on desktop); on iOS it wraps the system camera picker, on Android CameraX.
WHERE IT LIVES: Mail tab → Mail Day → capture tray.
HOW THE USER GETS HERE: the persistent "Scan today's stack" affordance on Mail Day; the Mail Day empty hero CTA; the Hub "Scan mail" action chip.
THE ONE JOB: turn a physical stack into a batch of uploads in one session, without leaving the screen between pieces.

CONTENT (real density — a Wednesday-evening stack of 6):
Viewfinder filling the sheet on native; on web desktop, a drop target reading "Drag photos here, or choose files". A live counter "3 photos". A persistent thumbnail strip along the bottom of this session's shots — shot 1 a Clark Public Utilities envelope, shot 2 an NW Natural bill page, shot 3 a visibly blurry frame — each thumbnail carrying its own small delete control and a "Retake" affordance on long-press/hover, plus a per-file progress ring. Actions: "Add another" as the large default, "Done (3)" as the commit. One privacy line, verbatim and always visible: "Photos are stored privately to your home and never shown to neighbors."

THE VISUALIZATION DECISION:
Batch-first. The thumbnail strip is the PERSISTENT element of the sheet — it never collapses, never appears only after the second shot — and "Add another" is the default action, so "shoot the whole stack now, confirm later" is the path of least resistance and "Done" is the deliberate exit. Put the counter and both actions inside one-handed reach: bottom third on native, bottom-right on desktop. The strip scrolls horizontally and the newest shot enters at the right and stays pinned in view. Per-file progress lives on the thumbnail, not in a banner. With zero shots the strip is a single empty slot with a caption, not a blank region.

STATES TO DRAW (each its own frame; all 8 on iOS, then repeat "capturing", "upload failed" and "no camera" on Android and on web desktop):
camera permission denied → plain explanation, "Open Settings", and a "Choose from photos instead" fallback · no camera (web desktop) → file picker and drop target only, no dead viewfinder chrome · capturing · uploading · upload failed (per-item retry, the rest of the batch preserved and still committable) · rejected file with a SPECIFIC reason ("IMG_4417.HEIC is 31.4 MB — mail snaps have to be under 25 MB" and "statement.pdf isn't a photo — take a picture of the page instead") · offline (shots held locally, "Will upload when you're back online", Done still works) · no claimed home, checked BEFORE the viewfinder ever opens ("Mail snap needs a claimed address", routing onward, never a viewfinder the user cannot save from).

WHY IT IS SHAPED THIS WAY (do not optimise away): the spec says only "wire the existing CTAs to the camera", which invites a one-shot picker — shoot, sheet, back to an empty screen, shoot again. That is the wrong shape for a stack of mail on a Tuesday evening. Run the claimed-home and finance-permission checks before the viewfinder, or a household member photographs a bill and is then told they cannot save it.

DO NOT: do not design a one-shot picker that dismisses after each photo. Do not put the privacy sentence behind an info icon or a "learn more" link. Do not show a single batch-level spinner that hides which file failed.
