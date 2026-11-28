# Christmas cards, the next round: contract for the four sessions

Written by the coordinating session on 2026-11-28. The founder's plan is `PLAN.md` beside this file (five waves).
This file wins where the two differ: it records what the founder asked for on November 28 after the plan was
reviewed, and the fixes to the plan's holes. Read `AGENTS.md` in the repository first; it still governs.

## 0. How we work

- Four sessions, one area each. Nobody edits another area; ask the coordinating session instead.
  - **server**: `backend/`, `supabase/migrations/`, and this contract's copy in `docs/product/`.
  - **web**: `frontend/apps/web/`, `frontend/packages/`.
  - **iPhone**: `frontend/apps/ios/`.
  - **Android**: `frontend/apps/android/`.
- Branch from `origin/dev`, open every PR with `--base dev`. Never push or merge to master.
- **Do not merge your own PR.** When a PR is up, its CI is green and you have used it in the real app, end your turn
  with: the PR number, the head commit, what you used it in, and what you could not check. The coordinating session
  reads the whole diff and releases the merge for that exact commit. After that, announce any further push before
  you make it.
- Small PRs, in the order section 7 gives. No new unit tests; update or remove an existing test only when an intended
  change breaks it.
- Verify in the real apps against a real local backend and database, with the switch **on and off** (section 1), after
  a reload or relaunch, and from the other person's side where there is one. Name what you could not check.
- Local stack: `scripts/pulse/stream-runtime.sh start <stream>`. Streams: server `ps`, web `pv`, iPhone `pi`,
  Android `pa`. Check `docker ps` first; if yours is taken, pick a free one of `pb pi pa ps pc pv` and say so. Stop
  only your own processes, by PID or port, never by pattern. Card test tools: `~/.pantopus-review/handoffs/card-table-tools`
  (rewrite their paths; a card with a photo needs the env listed in your memory note "Card table test kit").
- The repository is public: no secrets, tokens, real people's data or real photos in Git, PRs, screenshots or chat.
- Never reorder the catalog: Christmas with Jesus Christ stays first in `COLLECTIONS` and `OPENING`.

## 1. The switch (founder, November 28)

One switch for everything in this round, Wave 1 included.

- Server: env `CARD_IMPROVEMENTS`, read by `cardImprovementsOn()` in `backend/utils/featureFlags.js` with the same
  `isOn` rule as `CARD_GUEST_OPEN`: **on unless set to `0`**.
- **On**: the new experience. **Off**: sending and receiving cards exactly as they were before Wave 1 merged
  (commit `e56e1bcd1`, PR 5195): same screens, same order, same words, same refusals, same emails and timing, and
  the same API answers (no new fields).
- The server says so on each read that a screen draws from: `improved: true`, absent when off. At least
  `GET /api/mailbox/cards`, `GET /api/mailbox/claim/:mailId`, and any other read whose screen differs.
- A client draws the new experience only where the read it drew from carried `improved: true`. It keeps no copy of
  the switch beyond that read's own lifetime, so flipping the env changes every client at its next load.
- A client that doesn't know the field (a build already in the stores) keeps its old screens; whatever the server
  does differently for it must still be correct there.
- Cards already sent keep working when the switch goes off (a right-away card stays delivered, a photo on a list
  card stays readable to its recipients, a name on a link envelope stays). Off changes what can be done next, never
  what was done.
- `CARD_GUEST_OPEN` and `CARD_MEDIA_FREE` / `CARD_MEDIA_FREE_LIMIT` stay as finer emergency switches; they count
  only while `CARD_IMPROVEMENTS` is on.
- A plain defect fix with nothing a person would call a different experience (a crash, a privacy hole) stays on both
  sides; list each one in the PR. Everything else follows the switch.

## 2. Wave 1 under the switch (server, web)

PR 5195 is merged to `dev` with only guest opening behind `CARD_GUEST_OPEN`. Read `git show e56e1bcd1` and put each
of its changes behind section 1's switch, so that off is the code path from before it:

- guest opening of a card (`POST /claim/:mailId/open`, guest card media, the web `/open/[mailId]` table and
  `GuestKeepSheet`): off answers and draws as before PR 5195;
- the sealed card's reminder on Christmas morning (`backend/services/cardEmail.js`): off is the earlier timing;
- the code email's "Return to your Christmas card" link and the `?code=` handling;
- the sender's "no account needed" words on Look it over and elsewhere.

## 3. Wave 2: two free photo or voice cards, and photo and voice on a list

Wave 2 is PR 5203 (`origin/feat/holiday-cards-free-and-list-media`, one commit, all four areas, not merged, made in
another tool). Each session takes **its own area's files** from that branch, adds the switch and the fixes below, and
ships them in its own first PR; PR 5203 itself is then closed by the founder. Don't push to that branch.

Contract (on only; off is as before: a photo or voice needs a bought stamp, a list refuses them with
`CARD_MEDIA_ONE_PERSON`, `media.bought_stamp` is always sent):

- `GET /api/mailbox/cards` → `media.free_allowance: { limit, remaining }`; `media.bought_stamp` is left out while
  `remaining > 0` and sent as before once it is 0.
- A card on a free slot is marked `mail_extracted.card.media_free = true` (server only, never shown) and carries no
  `media_stamp`; past the allowance it is marked `media_stamp = 'paid'` as today.
- A list (`POST /cards/batch`, `/cards/batch/preview`) takes `photo`, `photo_alt`, `photo_live`, `voice`; free slots
  first, the rest bought; short of bought stamps → 402 `CARD_MEDIA_NEEDS_STAMP` with `needed_paid` and
  `free_media_remaining`.

Fixes the review found (all required):

1. **List retry** (server). PR 5203 ties the file only to the recipients that passed the checks, and a later request
   must have every one of its row ids already tied. So after one address is refused, the same list again, "Send the
   rest", or a second Look it over answers 410 `CARD_MEDIA_EXPIRED` for the whole list. Must work: the same list
   retried after a timeout; one address refused, then Send the rest; the refused address corrected (a new request ID)
   and sent with the same photo. Must still be refused: the file on an unrelated single card or an unrelated list.
2. **The allowance is exact** (server). It is counted in JavaScript outside the stamp lock, so sends at once can all
   take a free slot. Decide it where the stamp is decided (`mail_stamp_card_accounting`, under its per-person lock)
   with one additive migration that replaces that function as 20261111090000 did; a card without the mark is charged
   exactly as today.
3. **A recipient deleting the card must not hand the slot back** (server). Only taking the card back or its
   invitation expiring returns a slot; the count must not depend on `deleted_at`.
4. **The free hint** (web, iPhone; Android if it shows one). Show a "free" line only when the sender has at least
   one stamp of any kind; with no stamps at all, the stamp books line as before.
5. **Run it** (iPhone, Android). PR 5203's native changes were never run in a simulator or emulator. Send a single
   card and a list with a photo and with a voice greeting, with 0 bought stamps, on each.
6. Known and accepted: the iPhone build in the App Store checks its own bought-stamp count at Seal and at Look it
   over, so it keeps asking for a bought stamp until people update. Nothing to do server-side; don't claim otherwise.

## 4. Wave 3: sending, made easier

All of it only while `improved` is true.

**3.1 Pick a card first** (clients). Steps: Pick a card → Who it's for → Write on the back → Seal it for the day →
Look it over. The button on Pick a card reads "Choose who it's for" with no recipient yet, "Write on this card" with
one. Who it's for shows the chosen card's small picture and caption with "Change". Arriving with a person chosen
(Write back, Send one back, chat, profile): Pick a card, then Write. Arriving with a card chosen (a card's page,
Send this card again): Who it's for, then Write. Everything today's flow hangs on its first step (the day's card
already sent, the taken-back note, Back leaving the flow, a restored draft) moves to the new first step.

**3.2 A name on a link's envelope.** `to: { link: true, name? }`: optional, trimmed, runs of whitespace folded,
at most 40 characters; kept in `mail_extracted.card.to_name`; part of the request digest only when present (a card
without one keeps the digest it has today). Ignored when the switch is off. The form is the plan's 3.2 drawing.
Never on a public card page or a journey page.

**3.3 Right away, for someone on Pantopus.**
- `GET /api/mailbox/cards` → `arrivals.person_all`: before Christmas morning
  `['next_morning','now','sealed_christmas','christmas_morning']`, from then `['next_morning','now']`.
  `arrivals.person` is unchanged. `GET /api/mailbox/cards/arrivals?to=` gains `arrivals_all` the same way.
- A send with `to.user_id` and `arrival: 'now'` is taken only while the switch is on and `now` is open for them:
  `delivered_at` now, `special_delivery` true, `sealed_until` null, `take_back_until` null.
- One right-away card from a sender to the same person per day where the recipient lives: refused 429
  `CARD_SAME_DAY`, "You’ve already sent {name} a card right away today. This one can go with their morning mail."
  The database decides it too, under the pair lock `admit_one_card_per_morning` already takes: the server marks the
  card with the recipient's local date (`mail_extracted.card.instant_day`, server only, never shown) and one additive
  migration replaces that function to refuse a second card with the same sender, recipient and `instant_day`. A card
  without the mark is decided exactly as today.
- A list is unchanged: a person on a list still gets the card with their morning mail (`listArrival`), whatever the
  list's choice.
- The notice: exactly one per card, never none and never two, saying who it is from and nothing of the note. Use
  the existing special-delivery notice. If Pantopus already has quiet hours for pushes, follow them; if it has none,
  a card that lands between 10 p.m. and 7 a.m. where they live sends no push and is counted in that morning's notice.
- Words: title "Right away"; under it "Drops into their mailbox now, with a gentle notice."; when chosen, "This card
  delivers right away, so it can’t be taken back after you seal it." Next morning stays the first and default choice.

**3.4 Let it travel, off to begin with.** `GET /api/mailbox/cards` → `travel.default_on: false` while the switch is
on (absent when off). A client that reads `improved` starts its travel switch from `default_on` (absent means on, as
today). Title "Let this card travel"; under it "Let them pass this card on free to two people. Only your city
appears on the postmark — never your note, photo, or street address." Everything else about travelling is unchanged.

**3.5 Quick seal** (clients). After the first full sealing on this device (a device flag set when that ritual
ends), the sealing table shows one quiet text link, "Quick seal", under the main button, in the style of "Read it in
print". It runs one short seal-and-stamp beat into the same send the ritual ends in, for one card or a list, and
respects Reduce Motion. The first card on a device never shows it.

**3.6 The sealed card's "Not yet" line** (web). Readable on the dark cloth and clear of the title above it.

## 5. Wave 4 (starts after Wave 3; fields set then)

Settled now so nothing built earlier gets in its way:

- **4.1** No "Your daily briefings" notice or guidance card over a card on the path from a card's link; the welcome
  strip under the mantel only for a new account with an opened card and none sent, dismissible.
- **4.2 A photo as the card's front.** Option A (the quiet "Make a photo card" pill), three frames. And:
  - it **never travels** (no travel switch, never passed on) and never has a public page, a share picture or a video;
  - its caption is the sender's own words, so it lives in the card's private copy with the note, never in the Mail row;
  - it counts as a photo card for stamps (section 3);
  - emails and link previews show the sealed envelope, never the photo;
  - a build that doesn't know it must still show something right: a stock picture at the design's address and the
    photo inside the envelope as a card's own photo is today.

## 6. Wave 5 (held)

Thank-you cards need the founder's pictures; year-round cards need the Christmas wording taken out of all three apps
and the search checklist (`docs/seo/README.md`). Neither starts until the coordinating session says so.

## 7. Order of PRs

| Area | First PR | Second PR |
| :--- | :--- | :--- |
| server | the switch, Wave 1 under it, Wave 2 server with fixes 1–3, this contract into `docs/product/card-improvements-2026-11-28/` | Wave 3 server (3.2, 3.3 with its migration, 3.4) |
| web | reads `improved`, Wave 1 web under it, Wave 2 web with fix 4 | Wave 3 web (3.1–3.6) |
| iPhone | reads `improved`, Wave 2 iPhone with fixes 4–5 | Wave 3 iPhone (3.1–3.5) |
| Android | reads `improved`, Wave 2 Android with fixes 4–5 | Wave 3 Android (3.1–3.5) |

Clients build against this contract before the server's PR is merged. To use the real thing locally, run the backend
from the server session's pushed branch (the coordinating session sends its name); until then, check the off side
against `origin/dev`.
