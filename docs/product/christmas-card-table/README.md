# The Christmas card on the table: start here

November 6, 2026. This is the handoff for the session that builds it. It holds everything from the design session: what the founder asked for, what they approved, what the working sample proved, and what to build. Read this file, then [design.md](design.md), [build-plan.md](build-plan.md) and [pictures.md](pictures.md).

Nothing here is built yet. No app code changed. This branch adds only this folder.

## What the founder asked for

Christmas cards are live in production since November 6 (`mailbox`, `mail_extras`, `holiday_cards`). Looking at Look it over on their phone, the founder asked, in their own words:

- Make it "feel real paper mail, and elegant, fancy, cool", so that holding the phone feels like "actually holding a paper mail". "The goal is to make this the best ever."
- Consider the iPhone Duo, "as that phone could give users even much better user experience".
- Make cards shareable: "share through email, copy link for others to receive their mail, share a picture of the mail that they have received here on social media, Instagram, Facebook, etc."
- "It is also important to have those sharable pictures cool looking so users on other social media will be attracted to come over here to use Pantopus and try as well."
- Later: if pictures need one universal size, say what it is, and check that it works across phone sizes, "especially on Android".

## What the founder approved, in order

1. The direction, in plain words: the whole phone becomes the table (below). They answered "Yes, make the sample".
2. The working sample, after using it: "Yes, plan the build".
3. This plan and handoff: "commit and push all the work, and give me a prompt to kick off the new session to build everything".

Starting the new session with that prompt is the approval to build. Don't ask for it again. Everything else the founder needs to decide or do is listed under "Founder steps" in [build-plan.md](build-plan.md).

## The idea in one paragraph

Full screen, but not of the photo. Stretching a picture to fill a phone cuts off half of it (on the snowman card, both kids), blurs it, and loses the border, caption, stamp and postmark, so it looks like Instagram instead of mail. Paper feels real because of its edges, its shadow and what it's lying on. So the whole phone becomes the table: the app's bars go away, and the open envelope (flap up, patterned lining) sits behind a card nearly as wide as the phone. You do it by hand: turn the envelope over, pull the flap, pull the card out, swipe it over. Morning light from a window falls across everything and moves as you tilt the phone. On the iPhone Duo, the card is a folded card: picture on the left page, note on the right, with the crease on the real hinge.

## Decisions already made

These stand unless the founder changes them. Don't reopen them.

- **The look:** exactly the sample, including the red envelope, green and gold lining, gold wax seal with the Pantopus stamp mark, window light and cloth table. The art files in `sample/a/` are the real art, not placeholders.
- **The note's handwriting:** La Belle Aurore. The caption stays in Nothing You Could Do.
- **One shape for every picture:** 15:16. New pictures come at 1500 × 1600. The 49 existing pictures get trimmed, not redone ([pictures.md](pictures.md)).
- **Tables:** four cloth colours, one per picture, from [designs-table.json](designs-table.json).
- **Share pictures:** the note and the sender's name stay off unless the person turns on "Show the note". Then only the first name shows. An address never shows. A sealed card shares as the sealed envelope.
- **Copy link on a card you received:** a public page for that card's picture with "Send this card to someone". No note, no names. Sign-ups from it credit the person who shared it.
- **Copy link when sending:** a new choice on "Who it's for". One link, one person: the first to open it keeps the card, and they join to read it, as with email. It counts as that day's card, and it can be taken back until it's opened.
- **The founder's earlier rules stay:** one card per sender per day, a card by email or link is seen only inside Pantopus, sending closes December 31, and Sent never says whether a card was opened.
- **What stays:** the tabs on every other screen, the Mailbox (its card row gets the new paper at the same size), the 49 pictures and captions, the five sending steps, and Sent. Look it over keeps its content and gains one button, "Open it the way they will".
- **Switch:** a new launch key, `card_table`, off until the founder turns it on. With it off, every app looks and works exactly as it does today.
- **No new tables and no migration.** If the build finds it needs one, stop and ask the founder.

## The working sample

It's a real, touchable web page, built from the art in this folder. It is the design: when this folder and the sample disagree, the sample wins.

- **The founder's copy:** https://claude.ai/artifact/RFfTfkf389VUi3aLjQUZe9. It's private to the founder, so a session can't open it.
- **Run it yourself:** serve `sample/` with any static server and open it. For a phone-sized look, use headless Chrome or a simulator's Safari.
- **Jump to any moment:** in the page's console, `__sample.go('front' | 'back' | 'flap' | 'rising' | 'out' | 'outback')`, `__sample.openSheet()`, `__sample.openDuo()`.
- **Pictures of it:** [reference/](reference/) has phone stages, sizes, Duo poses, share pictures and all 49 pictures with their table colours.

What's in it:

- `sample/index.html`: the page. Its script has every number that matters: layout, springs, thresholds, poses, words.
- `sample/share.html`: the scene the share pictures are drawn from. Its numbers are the layout for each picture.
- `sample/a/`: the art. Envelope layers, wax seal, paper, grain, light, stamps, postmark, three trimmed pictures, tables, share pictures.
- `sample/art/`: the scripts that made the art. Height maps and lighting in numpy, Chrome for type. See "Remaking the art" in [pictures.md](pictures.md).

What it proved, and what it didn't:

- **Checked:** every gesture and the sealed flow in iPhone Safari on a simulator (iOS 27.0, iPhone 17 Pro), and the page inside the wrapper the artifact viewer adds. Layouts in headless Chrome at 375×667, 360×780, 412×915 and 440×956.
- **Not checked:** real phones, a real Android browser, or the page inside claude.ai's viewer (private, and the test browser isn't signed in).
- **Stood in for:** real tilt, because the viewer refuses the phone's motion sensor, so the sample's light follows a held finger and drifts by itself. Haptics may not fire. The Duo is a drawing of the phone, not the app on one. The share buttons mostly explain themselves.

The founder has used this sample. Its feel is approved, but it hasn't been judged on real sensors or on the Duo itself, so check those carefully when building.

## How the work is organised

The founder's standing rules for build sessions:

- **Opus 5.5 at max effort, and no subagents:** no Agent tool, no Workflow scripts. Each session does its own reading, coding and checking. Separate sessions are allowed; the founder said "if need to sessions please feel free".
- **No new unit tests.** If an intended change breaks an existing test, update or remove it in the same PR. Verify in the real apps with a real local backend and database, including relaunches and the other person's view (AGENTS.md).
- **Clear errors:** when something fails, people see what went wrong and what to do.
- **Don't idle or stop for approvals once this is running.** The founder doesn't want to be asked the same thing twice, or asked to accept things while away. Drive simulators with `simctl` and `idb` (`idb hinge`, `idb rotation`). Attach the simulator panel only when the founder is present, and never `detach` it.
- **Only the founder** spends money, enters credentials in consoles, changes hosted configuration, sends to real people or submits to the stores.
- **Plain words** for the founder: what people will see, on which apps, with times in Pacific. No internal terms.

Recommended setup, because one session can't hold three apps in its context:

| Session | Owns |
|---|---|
| Coordinator (the session this prompt starts) | The docs PR, the art for all 49 pictures, reviews, the three-app check, NEXT_STEPS and the flags doc, the founder report |
| Server + web | Key, designs data, sending by link, the web table, sharing, link page, public card pages |
| iPhone + Duo | Table, Duo poses, sharing, sending by link, Look it over, Sent |
| Android | Table, sharing, sending by link, Look it over, Sent |

The memory index (`MEMORY.md`) has the traps. Before starting, read at least these notes:

- Merging: `shared-master-merge-queue-2026-10-13`, `deploy-backend-supersede-starvation`, `gh-pr-merge-worktree-delete-branch`, `merge-helper-never-pipe`, `coordinator-pr-bar-auto-archive`.
- Sessions: `session-start-only-in-founder-turns`, `founder-context-handoff-85-percent-2026-11-05`, `session-handoff-fresh-not-fork`, `cross-session-message-limit-10`, `check-duplicate-session-before-building`.
- Machine: `parallel-sessions-stack-overload`, `worktrees-on-studio-extended`, `launch-kit-build-lock-internal`, `kit-cache-12h-wipe-android-restore`, `session-scratchpad-can-vanish`, `kit-stream-name-collision`.
- iOS: `pantopus-ios-swiftformat-before-push`, `ios-swiftui-env-closure-retention`, `swiftui-mac-harness-design-preview`, `pantopus-ios-simulator-verification-gotchas`.
- Duo: `duo-fold-idb-hinge`, `swiftui-overflow-readable-column-duo-hinge`, `duo-fold-rebuild-state-lessons`, `ios-duo-side-strip-occlusion-region`, `duo-mailbox-duomailbox-2026-11-04`.
- Android: `kit-android-build-with-launch-keys`, `compose-text-style-and-kit-new-stream-traps`, `compose-fixed-size-text-font-scale`.
- Web: `pantopus-web-jest-before-push`, `web-share-verify-in-sim-safari`, `web-checks-headless-not-hidden-pane`, `phone-browser-checks-in-sims`.
- Cards: `holiday-cards-build-2026-10-30`, `christmas-card-collections-2026-10-31`, `mail-preview-sent-design-2026-10-30`, `mail-card-test-tools-mps`, `christmas-card-memories-plan-review-2026-11-02`, `holiday-mail-design-share-2026-11-06`.

## Where things stood at handoff

- **Branch:** `claude/holiday-mail-design-share-4752f3`. It adds only this folder and is docs-only. Land it first so every session has it on master. It branched from `c9eb4aba88`; master had moved 22 commits when checked, none touching card files.
- **Other work on the same files:** open PRs #3580, #3581 and #3582 hide the tab row in chats (web, iOS, Android) and touch `MobileTabBar`, `AppShell`, `RootTabScreen` and the iOS tab hosts. #3598 (Face ID on sensitive screens, session running) touches the iOS app shell. Check their state and rebase. Re-run the duplicate check before building.
- **Private copies on this Mac:** kit folder `~/.config/pantopus/launch-kit/streams/CARDTABLE` has a copy of the sample, plus the simulator "Pantopus CARDTABLE" (shut down). Full-size picture crops are in `~/Downloads/christmasthanksgiving-cropped` and `~/Downloads/christmas-collections-cropped/<collection>`; they aren't in the repo.
- **Local test accounts and card tools:** kit `streams/HPC` (accounts, seed, clock) and `streams/MPS/tools` (backdate, clock, seed Sent). They work on stack `pantopus-hcv`, which is stopped and behind master's migrations. Bring it up to date, or use a new stack if there's room (about 4–5 stacks at once on this Mac).

## Other plans that touch this

[Card memories](../christmas-card-memories-plan-2026-11-02.md) (a photo, a voice greeting and a reply on a card) isn't built past its first step and will extend the same reader. Keep the back of the card and the ⋯ menu able to take those later. Don't build them now.
