# Snap capture tray (batch session)
id: f10-snap-capture-tray · platforms: web/ios/android · isNew: True · artboards: 25

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Today's stack (capture tray) · f10-snap-capture-tray

TYPE: NEW. A sheet on iOS, Android and mobile web, and a modal on web desktop. It opens over Mail Day, which stays visible behind the scrim.

ATTACH: Mail Day populated on iOS, Android and web 390 (the host behind the scrim); the shipped web "Snap and sell" listing modal (the drop-target pattern to mirror); the Foundations board.

PLATFORMS & VIEWPORTS
- iOS 393x852, sheet at the large detent, plus one landscape frame at 852x393.
- Android 412x915, full-height Material 3 bottom sheet.
- Web 1440x900, centred modal.
- Web 390x844, bottom sheet.

WHERE IT LIVES & HOW PEOPLE ARRIVE: Mail tab → Mail Day → this tray.

Entry points:
- "Scan today's stack" in the Mail Day header.
- The same button in the Mail Day empty hero.
- The "Scan mail" chip on Today (iOS, now active). It first switches to Mail → Mail Day, runs the checks and opens the scanner, so the tray always returns over Mail Day.

Before anything opens, the app checks for a claimed home and for bill access.

On iOS and Android, the system document scanner then shoots the pages: VisionKit on iOS, ML Kit on Android. This tray opens when the scanner returns them. Pantopus draws nothing inside the scanner.

On web, "Scan today's stack" opens this tray directly, with a file picker.

Hand-off: "Done" closes the tray. Pages keep uploading and are read in the background. What happens next depends on the reads:
- If a piece has already been read when Done is tapped, Confirm what we read opens at once for it.
- Otherwise Maya lands on Mail Day, which shows one row per piece. When the first read finishes, a polite status line appears under the Mail Day header: "1 piece ready to check · Check now".
- Nothing opens on its own after she has acted on Mail Day.
Close differs in one way only: Close always returns to Mail Day and never opens Confirm what we read. Pages keep uploading either way.

WHO AND WHEN: Maya Chen at HOME A, Mon 19 Oct 2026, 6:05 PM. HOME A has Maya and Sam Ortega, who can see bills, and Alex Kim, a guest with access until Sun 1 Nov, who cannot see bill photos or amounts. At 6:04 PM Maya scanned 8 pages (4 letters) from tonight's stack in one scanner session. Every page came back as its own piece. By 6:05 she has already joined pages 1–2 and pages 6–8 with "Same letter as previous", so the tray shows 5 pieces. She is checking the pages before she closes the tray.

THE ONE JOB: Turn a scanned stack into grouped, uploading pieces in one sitting, with no stop between pages.

FIRST FIVE SECONDS:
1) The row of page thumbnails with their upload rings.
2) The count "8 pages · 5 pieces of mail" under the title, and the audience line.
3) "Done (5)".
Primary action: "Done (5)".

CONTENT (house style fixtures, plus these additions)
Title "Today's stack" · Close. Pinned under the title: count "8 pages · 5 pieces of mail" and live status "5 of 8 pages uploaded".

Thumbnails, in scan order:
- Pages 1–2: Clark Public Utilities bill, joined as one stacked thumbnail labelled "2 pages", uploaded.
- Page 3: City of Vancouver water bill, page 1, "Uploading, 60%".
- Page 4: the same water bill, page 2, uploaded, not yet joined.
- Page 5: Larkspur Loop HOA dues notice, uploaded.
- Pages 6–8: Chase statement, joined as one stacked thumbnail. Page 6 is uploaded, page 7 is uploading, and page 8 failed. The stack caption reads "3 pages · Page 8 didn't upload" with a "Retry page 8" button, and its ring shows the combined value in text: "1 of 3 uploaded".

The captions under the thumbnails read "Page 1–2", "Page 3" and so on. Senders are not shown here, because reading happens after upload.

Audience line, always visible, with ScopeChip "Your household". In Maya's frames (HOME A has a guest): "Only you and Sam can see these photos. Alex sees that mail arrived, not the photos or amounts."

Actions: native shows an outlined "Scan more" and a filled "Done (5)"; web shows an outlined "Add more photos" and a filled "Done (5)". The two buttons are the same size and sit side by side.

Worst case: 30 pages; a 12-page letter joined into one piece ("12 pages"); every upload failing at once.

LAYOUT & VISUALIZATION
Top to bottom: title and Close; the pinned count and live status line; the thumbnail row; the selected-page action row; the audience line; the retry row when any page failed; the two buttons.
On native the buttons sit in the bottom third; on web desktop, bottom-right. Both are within one-handed reach.

The thumbnail row is the persistent centre of the sheet: ThumbnailRail, capture-queue variant, with 96x128pt thumbnails and radius md.
- It scrolls sideways.
- The newest page enters at the right and stays in view.
- It never collapses.
- Each thumbnail carries its own ring with a text value.
- A joined piece is a stacked thumbnail with a "2 pages" label. The count counts pieces of mail, not photos.

Opening a joined piece: tapping a stacked thumbnail selects the piece and fans its pages out inline as separate 96x128 thumbnails under a bracket labelled "Chase letter · 3 pages" (the bracket label uses the page range when nothing is read: "Pages 6–8 · 3 pages"). Each fanned page can be selected and shows the action row. A removed page leaves its own "Page 8 removed · Undo" slot inside the bracket. Tapping the bracket label folds the stack again.

Selecting a thumbnail gives it a 2px ink outline plus a check badge, distinct from the focus ring. It also reveals a visible row of 44pt/48dp buttons:
- "Retake". On native it reopens the scanner for that page; on web it reopens the file picker or camera for that page.
- "Delete".
- "Same letter as previous", hidden on page 1. On a fanned page that is already joined (other than the first page of its piece), this button reads "Separate from previous letter".

Web 1440: a drop target fills the left of the modal, with "Drag photos of your mail here", "Choose files" and the caption. The queue sits beside it.
Web 390: "Take a photo" (opens the phone camera) and "Choose from photos", then the same queue.
No viewfinder chrome on web.

When data is missing:
- Zero pages (web only; native always returns with pages): one empty slot with the caption "Pages you add show up here".
- Scanner unavailable: the photo fallback frame.

INTERACTION, MOTION & HAPTICS
Tap selects a page or opens a stack. Long-press (native) and hover (web) are shortcuts to the same action row, never the only path.

Delete is instant, with no dialog. An InlineUndo, "Page 8 removed · Undo", sits in the page's slot until the tray closes.

"Scan more" reopens the scanner and appends pages. "Add more photos" on web reopens the picker.

Failed pages retry one by one, or all together from the retry row. Done works with failures and keeps them queued.

Close, Back and Escape never discard pages. The tray closes to Mail Day and every page keeps uploading. Pages are removed only with Delete, each with its own Undo. There is no discard dialog.

The guest check appears only the first time a guest taps "Scan today's stack". After that, the scanner opens directly and the audience line carries the limit.

In the no-claimed-home notice, "Add a due date" replaces the notice with the Date sheet. Never stack the two sheets.

"Add a due date" on the PDF rejection row closes the tray, keeping its pages uploading, then opens the Date sheet (create mode, Bill kind) over Mail Day. Never stack it on the modal.

Drag to reorder is not offered.

Motion: new thumbnails slide in from the right (200ms); a stack fans out over 200ms; under Reduce Motion both fade in. Rings fill without looping.
Haptics: one light tick when Done commits.

The tray works in portrait and landscape. In landscape, the queue sits on the left and the buttons on the right.

FOUNDATIONS COMPONENTS USED: ThumbnailRail (capture queue: uploading, failed, joined, fanned) · ScopeChip (chip plus the named-audience line) · InlineUndo (removed page) · InlineErrorRow (upload failed) · OfflineNotice (queued writes) · LockedActionRow (names who can act) · DateSheet (create mode, Bill kind, from the PDF rejection and the no-claimed-home notice).

ACCESSIBILITY
Reading order, matching the visual order: title, count, live status, thumbnails left to right, action row, audience line, retry row, buttons.

Each thumbnail is one element:
- "Page 3 of 8, uploading, 60 percent. Actions: Retake, Delete, Same letter as previous."
- Joined: "Pages 1 and 2, one piece of mail, uploaded."
- Chase stack: "Pages 6 to 8, one piece of mail, 1 of 3 uploaded, page 8 didn't upload. Actions: Open pages, Retry page 8."

Upload status is a polite live region: "5 of 8 pages uploaded".

Close is labelled for assistive tech "Close, your pages keep uploading".

Targets are 44pt / 48dp / 44px, with 8dp gaps. No ring sits under a delete target.

The sheet has a visible Close and responds to Back and Escape, which never discard pages.

At AX5 and 200%, the row becomes a vertical list with the actions inline under each page, and the sheet scrolls; the count stays pinned.

Status is shown by ring plus words, never by colour alone.

COPY
Title, counts and status: "Today's stack" · "8 pages · 5 pieces of mail" · "5 of 8 pages uploaded" · "Uploading, 60%" · "Upload failed · Retry" (single page) · "3 pages · Page 8 didn't upload" · "1 of 3 uploaded" · "Chase letter · 3 pages" · "Pages 6–8 · 3 pages".

Buttons: "Retry page 8" · "Retry 3 pages" · "Retry 8 pages" · "Retake" · "Delete" · "Same letter as previous" · "Separate from previous letter" · "Scan more" (native) · "Add more photos" (web) · "Done (5)" · "Done (4)" · "Close".

Undo: "Page 8 removed · Undo".

Audience lines (named-audience sentence form):
- Maya's view with a guest in the household (used in frames 1–4 and 7–9): "Only you and Sam can see these photos. Alex sees that mail arrived, not the photos or amounts."
- When everyone in the household can see bills: "Only your household can see these photos: you and Sam."
- Alex's own tray: "Only Maya and Sam can see these photos once they're filed."

Offline:
- Native: "You're offline. Your pages are saved on this phone."
- Web: "You're offline. Your pages are saved on this device."
- On each page: "Will upload when you're back online".

Scanner unavailable: "This phone can't run the page scanner. Take a photo of each page, or choose photos you already took." · "Take a photo" · "Choose from photos". On Android add the line "You can choose up to 100 photos at a time." (the number is the system picker's limit on that phone).

Camera off (iOS and web): "Pantopus can't use the camera. Turn on Camera in Settings, or choose photos you already took." · "Open Settings" · "Choose from photos". On web, the first sentence ends "…Turn on the camera in your browser settings, or choose photos you already took."

iOS camera purpose string: "Pantopus uses the camera to photograph bills and letters you choose to add to your home."

Rejected files (web):
- "scan_0412.png is 31.6 MB. Mail snaps must be under 25 MB. Save it smaller and try again."
- "statement.pdf: PDF bills aren't supported yet. Add the due date by hand instead." · "Add a due date"
- "notes.docx isn't a photo. Choose a JPEG, PNG or HEIC file."

Drop target: "Drag photos of your mail here" · "Choose files" · caption "JPEG, PNG or HEIC, up to 25 MB each." Web 390: "Take a photo" · "Choose from photos". Empty slot: "Pages you add show up here".

No claimed home (shown before any camera): "Mail snap needs a claimed address" / "Bills live with a claimed home. You can still add a due date for yourself." · "Add a due date" · "Claim this address".

Guest check (shown before any camera, first time only): "You can scan and file mail here" / "Only Maya and Sam can add bills or see amounts at 2418 NE Larkspur Loop." · "Scan and file" · "Close".

EDGE CASES
- 30 pages: the row scrolls and the count stays pinned.
- A 12-page letter shows one stack labelled "12 pages"; opened, it fans into 12 thumbnails that scroll inside the bracket.
- Some uploads fail: each failed page shows Retry, a single "Retry 3 pages" appears in the retry row above the buttons, and Done stays enabled.
- All uploads fail: the retry row above the buttons reads "Retry 8 pages"; "Done (5)" stays enabled and keeps every page queued.
- Slow network: rings sit at their true value, with no batch spinner.
- Offline: pages read "Will upload when you're back online" and Done works.
- HEIC files are converted before web thumbnails show, so there are no broken images.
- Scanner not supported (on iOS, or on low-memory Android): the fallback frame.
- Android never shows a camera-permission frame, because its scanner needs no permission.
- "Choose from photos" opens the system picker with multi-select and never asks for photo-library access.
- No claimed home (Jordan Lee at PLACE B, ScopeChip "Saved place · Only you") and guest (Alex Kim) are both checked before the scanner opens.

INSTEAD OF
- Instead of a Pantopus viewfinder with a strip inside it, draw a queue that opens after the system scanner returns, because the system scanners can't be customised and already handle edges and batches.
- Instead of "Add another" as the default action, draw an outlined "Scan more" beside a filled "Done", because the system scanner already shoots the whole stack in one go.
- Instead of a small delete glyph on each thumbnail and Retake only on long-press or hover, draw a visible action row for the selected page, because small and hidden controls get mis-tapped or missed.
- Instead of a joined stack you can't open, draw it fanning out into its pages under a bracket, because Maya must be able to remove or separate one page.
- Instead of a "Discard pages?" dialog on Close, draw Close as a safe exit that keeps the stack, because a mis-tap must not lose eight pages.
- Instead of "Photos are stored privately to your home and never shown to neighbors", draw the line that names who sees the photos, including the guest, because the real audience is inside the home.
- Instead of one batch spinner, draw a ring on each page with its own Retry, because people need to see which page failed.
- Instead of a camera-permission frame on Android, draw "This phone can't run the page scanner", and instead of a camera that opens and then refuses to save, draw the claimed-home and guest checks before the scanner, because those are the real failures.

DONE WHEN: Maya can:
- scan the whole stack (4 letters, 8 pages);
- group two-page letters, and open a stack to reach one page;
- remove a bad page with Undo;
- see by name who can see the photos, including what the guest sees;
- press Done, or Close, with a failed page still queued and nothing lost.

Also:
- the screen-reader order matches the visual order;
- nobody reaches a camera they cannot save from;
- every action has a visible 44pt/48dp control;
- nothing opens on its own after Maya has acted on Mail Day.

ARTBOARDS
1. f10-snap-capture-tray · ios · 01-queue-uploading · light — the dense case (8 pages, 5 pieces of mail) over Mail Day, with the guest audience line.
2. f10-snap-capture-tray · ios · 02-page-selected · light — page 4 selected, with the action row (Retake · Delete · Same letter as previous) visible; the count still reads "8 pages · 5 pieces of mail".
3. f10-snap-capture-tray · ios · 02b-water-joined · light — main storyboard: after "Same letter as previous" on page 4, the water bill is a "2 pages" stack; page 3 still uploading, page 8 still failed; "8 pages · 4 pieces of mail", "Done (4)".
4. f10-snap-capture-tray · ios · 03-page-removed · light — alternative branch: the Chase stack fanned out under "Pages 6–8 · 3 pages"; page 8 (a blank back page) removed, its slot inside the bracket reads "Page 8 removed · Undo"; "7 pages · 5 pieces of mail", "Done (5)".
5. f10-snap-capture-tray · android · 01-queue-uploading · light — the Material 3 full-height sheet.
6. f10-snap-capture-tray · web-1440 · 01-drop-target-with-files · light — the modal with the drop target, the queue and "Add more photos".
7. f10-snap-capture-tray · web-390 · 01-take-photo · light — "Take a photo" and "Choose from photos", with the queue.
8. f10-snap-capture-tray · ios · 04-all-uploaded · light — alternative branch: water joined, every ring complete; "8 pages · 4 pieces of mail", "8 of 8 pages uploaded", "Done (4)".
9. f10-snap-capture-tray · ios · 05-upload-failed · light — pages 3, 7 and 8 failed; the retry row reads "Retry 3 pages"; Done enabled.
10. f10-snap-capture-tray · web-1440 · 06-rejected-files · light — the three rejection rows under the queue.
11. f10-snap-capture-tray · ios · 07-offline · light — pages reading "Will upload when you're back online".
12. f10-snap-capture-tray · ios · 08-scanner-unavailable · light — the photo fallback.
13. f10-snap-capture-tray · android · 08-scanner-unavailable · light — the photo fallback with the picker limit line.
14. f10-snap-capture-tray · ios · 09-camera-off · light — Open Settings plus the photos fallback.
15. f10-snap-capture-tray · web-390 · 09-camera-off · light — browser camera blocked.
16. f10-snap-capture-tray · web-1440 · 10-no-camera-empty · light — the drop target only, with the empty-slot caption.
17. f10-snap-capture-tray · ios · 11-no-claimed-home · light — the notice sheet for Jordan Lee, with no camera.
18. f10-snap-capture-tray · ios · 12-guest-check · light — the first-time notice for Alex Kim before scanning.
19. f10-snap-capture-tray · ios · 13-landscape · light — 852x393, with the queue on the left and the buttons on the right.
20. f10-snap-capture-tray · ios · 14-ax5 · light — the vertical list at AX5, count pinned.
21. f10-snap-capture-tray · android · 15-font-200 · light — the vertical list at 200%.
22. f10-snap-capture-tray · ios · 16-greyscale · light — frame 1 in greyscale.
23. f10-snap-capture-tray · ios · 01-queue-uploading · dark — the dark twin of frame 1.
24. f10-snap-capture-tray · ios · 05-upload-failed · dark — the dark twin of frame 9.
25. f10-snap-capture-tray · web-1440 · 99-notes · light — Notes, with these items:
- A three-step strip: "Scan today's stack → system scanner (not drawn by Pantopus) → Today's stack".
- The main storyboard: frame 1, then frame 2, then frame 3 (join, "Done (4)" with page 3 still uploading and page 8 still failed), then Mail Day. Nothing has been read yet, so Maya lands on Mail Day. Frames 4 and 8 are alternative branches.
- Every invented string: Larkspur Loop HOA; Chase; the file names; Alex Kim as a guest until Sun 1 Nov; "Separate from previous letter"; "Add more photos"; "Retry page 8"; "Retry 3 pages"; "Retry 8 pages"; "3 pages · Page 8 didn't upload"; "1 of 3 uploaded"; the bracket labels; "pieces of mail"; "Close, your pages keep uploading"; the guest filing rule; the three audience variants; the picker limit line.
- Proposed Foundations additions: the 96x128 capture-queue thumbnail size; the fanned-stack bracket; the named-audience sentence form for photos ("Only your household can see these photos: you and Sam." and the guest variants), since the ScopeChip contract lists only two sentences today.
- The shared F10 wording: "Upload failed · Retry" and "Will upload when you're back online".
- Open values: the Android picker limit (drawn as 100; the real number comes from the system on each phone).
- Open decisions: single-page PDF support on web; what a guest's filed photos show to the guest; how long photos are kept.
- Omitted states.

BATCH PLAN: Turn 1: 1-6, then wait for "continue". Turn 2: 7-12, then wait. Turn 3: 13-18, then wait. Turn 4: 19-24, then wait. Turn 5: 25.
