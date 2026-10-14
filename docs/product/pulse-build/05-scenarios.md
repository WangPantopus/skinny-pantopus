# Scenario catalogue: what "tested end to end" means

**The founder's standard (October 13, 2026): no unit tests, no UI-test code, no snapshot additions, no coverage work.** What counts is launching the real apps, **web, iOS and Android**, against a real local backend and database, and doing every feature, flow, scenario and edge case by hand, then doing it again on the other clients. This file is the minimum list. It is not a ceiling: when you can think of a way to break something, try it, and add the scenario here in your PR.

**How to use it.** For each slice you build or touch: run section A on every screen you changed, and the slice's list in section B. A scenario is done only when you **saw the expected result on screen** in every client that has that surface, the state is still right **after relaunch or reload**, and it looks right **to the other account**. Your PR body ends with a line such as `Scenarios run: A1–A14, S5.1–S5.16; web ✓ iOS ✓ Android ✓; not run: S5.12 (needs a physical phone)`. Anything that fails goes to the owning stream's status file under "Requests" the same day. Fixtures are synthetic and removed afterward (`04-verification.md`).

**Which client checks what.** *Owner streams* (PI, PA) run every scenario for their platform and also look at server-created content on **web** (cheap: your stream has a web dev server). *PB, PS, PC* run their flows through the **web** where a surface exists (the existing Pulse feed and post page, the moderator console, the public pages) and through **iOS or Android** for new endpoints (ask PI or PA to run it, or run it yourself). *PV* runs **cross-client round trips** at every sweep (section C). The existing web app must keep working through all of this: the old feed and post pages must render every new type, label, status and field without errors.

## A. Cross-cutting checks (every slice, every screen you touch)

- **A1 Two accounts.** The author, and a second person who sees the other side (the neighbor, the asker, the giver, the requester). Where audience matters, a third: an outsider, and a signed-out browser.
- **A2 Relaunch.** iOS: terminate and launch. Android: force-stop and launch. Web: hard reload. State is unchanged; drafts, follows and marks are still there.
- **A3 Bad network.** Airplane mode in the middle of an action; slow responses; a 500 from the server (stop the backend mid-flow). The screen says so plainly, keeps what the person typed, and offers retry. **Double-tap and retry never create two of anything** (one post, one reply, one claim, one follow).
- **A4 Empty, loading, error and quiet states** are present, honest and offer a next step. Nothing is invented to fill space.
- **A5 Words.** A 5,000-character post; one long word with no spaces; emoji; accented and non-Latin text; right-to-left text; numbers and times in the viewer's time zone (change the device zone); a window that crosses daylight-saving time.
- **A6 Accessibility.** Largest text sizes (iOS accessibility sizes, Android 2× font); VoiceOver and TalkBack reach and name every control and every state ("N new", "Helpful", "Following", the label); dark mode; a small phone and a large phone; nothing carries meaning by color alone.
- **A7 Roles.** The same screen as each label: Resident, New here, Nearby, Visitor, Official, Business, curator; a household-invited member (household-verified, not address-verified); a signed-out person; an under-attested account; a banned or slowed account.
- **A8 Old and odd data.** Older posts (legacy types, no `read_scope`, no topic), a post with no replies, a post whose author deleted their account, a post with a removed photo. An **older app build** against the new backend (no crash). The existing web feed and post page against new data.
- **A9 People controls.** A blocked user, a muted user, a muted topic, a hidden post, a reported post: gone from every path (feed, detail, search, notifications), and undoable.
- **A10 Concurrency.** Two devices acting at once: two people tap "I'd like it", two Helpful marks, a reply while the author deletes the post, a follow while the post resolves. One clear winner, no crash, no duplicate, no stale "available".
- **A11 Limits.** Each cap (daily, weekly, per offer, per minute) shows a plain sentence with when it resets, and actually resets.
- **A12 Notifications.** What should arrive, when (instant vs. digest vs. never), the words, quiet hours, and that tapping opens the right screen from a **cold start and a warm start**. Locally this means the in-app list and the push payload log; physical delivery cannot be verified here and the PR says so.
- **A13 Deep links and tab state.** The link or push opens the right tab and screen; back goes where a person expects; the tab bar is visible; the selected tab survives relaunch.
- **A14 Clean slate.** A brand-new account with no home, no posts, nothing; then a long-lived account with hundreds of items.

## B. Scenarios by slice

### S1 Rule cleanups
- S1.1 In each composer (web, iOS, Android) a resident cannot choose theft, vandalism, suspicious or scam for a Heads-up; the API refuses them with `ALERT_KIND_NOT_ALLOWED` and a plain sentence.
- S1.2 An Official or curator account can post a public-safety notice only with a source link; without one it is refused.
- S1.3 A business identity cannot post to the Place feed (`BUSINESS_CANNOT_POST`); its other abilities (the business page, replies where allowed) are unchanged.
- S1.4 Old posts of those kinds and old business posts still render on all three clients.

### S2 Tolerant decoding
- S2.1 Serve each client a feed, a post, a comment list and a notification list containing an unknown `post_type`, unknown enum values (`author_label`, `resolution`, `action.kind`), extra fields, missing optional fields and nulls: nothing crashes, the bad item renders as a generic card, the rest are fine. (A tiny local stub server is acceptable for this one scenario; say so.) Also on an **Android Release (R8) build**.
- S2.2 The same on the **existing web** feed and post page.

### S3 Five tabs
- S3.1 `plans` off: four tabs (Place, Today, Pulse, Messages). On: five. Flip the switch in the database while the app runs: the tab appears and disappears without a restart; if you were on Plans when it disappears you land on Pulse.
- S3.2 Each tab opens its own root; re-tapping pops to root; the Messages badge is correct; selection survives relaunch.
- S3.3 Links: `/nearby`, `/pulse`, `/plans`, a post, a plan, a chat, the three server pushes that used `/nearby`, each from a cold and a warm start.
- S3.4 Connections opens from the Pulse menu; Beacons stays hidden; the neighborhood meter card and "Set up a home" show in the right states and nowhere else.
- S3.5 Large text and a small phone: five labels stay readable; TalkBack and VoiceOver name each tab and its selected state.
- S3.6 Sign out, sign in as someone else: no trace of the first account; the right tabs for the second.
- S3.7 Place, Today and Messages still behave exactly as before (smoke each). Web: `/app/nearby` still loads.

### S4 Topics
- S4.1 All plus the 12 topics, "More" reveals the rest; picking one filters; picking another replaces it; All resets; it resets on relaunch.
- S4.2 Mute a topic in your town: it vanishes from Nearby and Following; other topics stay; undo from the preferences page restores it; (when two areas exist) the same topic in the other area is unaffected.
- S4.3 The legacy Sports lane still works and appears under "Sports and fitness". Posts with no topic show only under All.
- S4.4 A topic with nothing in it shows a quiet message, not a blank.

### S5 Areas, labels, walls (the privacy-critical slice)
- S5.1 Every label appears correctly on cards **and** replies, as text: Resident (verified address inside the town), New here (postcard pending), Nearby (verified in a neighboring town), Visitor, Official, Pantopus (curator). A household-invited member is **not** Resident.
- S5.2 A verified resident moves house: their label changes everywhere the next time anyone reads; old posts keep working.
- S5.3 Distance: a reader with a verified home sees rounded values ("0.6 mi", "nearby" when few homes are close); a reader without a home sees none; two readers see different values for the same post; a signed-out reader and the public web see none; the exact point never appears.
- S5.4 **The privacy matrix** (`04-verification.md`): every actor × every post scope × every read path, on every client that exercises the path: the new feed, the legacy feed with someone else's coordinates, the map, saved, the post by link, comments, likes, share, notifications that quote a post. A restricted post never reaches anyone outside its audience by any path.
- S5.5 Share: a restricted post offers no share link; a public post's link opens signed out; with sharing off it does not.
- S5.6 Adult attestation: the first post asks once; declining blocks posting politely; it is remembered; an under-18 date of birth is refused at sign-up.
- S5.7 Limits: a New here account's third town post in a day, a Visitor's non-Ask, a Visitor's second Ask in a day each show the plain sentence and reset time; a Resident is unaffected; the limit really resets (move the clock by changing the stored times).
- S5.8 The area pill shows the town; "another place" lets a Visitor browse read-only and ask but not post other types.
- S5.9 Only open areas appear: a closed street or neighborhood is offered nowhere; set its `opened_at` and its group and picker entry appear without an app update; posting there needs a verified home inside it (`NEEDS_VERIFIED_ADDRESS`).

### S6 The Pulse page
- S6.1 First visit: no posts (quiet message), a sparse town (meter card), no home ("Set up a home"), a quiet day ("Quiet on NW 23rd today" style): nothing invented.
- S6.2 New posts arrive while reading: the pill shows the right count; the page does not move until it is tapped; pull-to-refresh and the pill agree; polling stops when the screen is not visible.
- S6.3 "You're caught up" shows at the end with the correct "since this morning / yesterday / Tuesday" in the viewer's zone; reopening shows only newer items; "Show earlier" loads older items once; **nothing loads by itself while scrolling**; leaving before the end card was visible does not advance the marker.
- S6.4 Groups appear only for open areas, in order, newest first inside each; muted, hidden, blocked, held and removed items are absent.
- S6.5 Each of the six types renders its text, label, distance, time, one action and status; a legacy type renders a sane generic card; photos, long text and emoji are fine.
- S6.6 Offline: the last copy shows with "Couldn't refresh. Showing 3:42 PM."; retry works; relaunching offline still shows the saved copy; a failed pull-to-refresh keeps what was there.
- S6.7 A town with 100+ posts scrolls smoothly; memory is steady.
- S6.8 Views and chips combine (Following × topic); "…" menus carry the listed entries; Follow is not on the card.

### S7 Lifecycle
- S7.1 Run the lifecycle job against backdated rows: an Ask with no replies at day 7 becomes `closed_unanswered` and leaves the views; with replies and no Helpful mark, `closed`; a Share at day 3 leaves; an Offer at day 7 expires; a Heads-up at the time it names; an Event 24 hours after it ends becomes "Happened · N went"; Lost and found at 14 days or when reunited.
- S7.2 Day-6 reminder: an Ask with replies gets "Did a reply help?"; with none, "Still need an answer?" with both options working ("keep open 7 more days" works once).
- S7.3 A Helpful mark resolves immediately everywhere; unmarking the last one reopens an unclosed Ask; older clients still read a sensible `state`.
- S7.4 Status words on cards and conversations, on all clients: "✓ Answered", "Gone", "Reunited", "Happened · N went", "Ends Wed 4pm" in the viewer's zone; a heads-up crossing midnight; an event across a daylight-saving change.
- S7.5 Editing a post does not change its window; deleting a post with open claims or replies ends cleanly.

### S8 Composer
- S8.1 For each of the six types, type a natural sentence: the type, topic and "About" are suggested; each is changeable in one tap; the two promises ("Who can read", "Shown to") and the line "Showing it to gardeners doesn't limit who can read it." are always visible; a Visitor sees only Ask.
- S8.2 First post: the audience review appears once; later posts show one line; "Posting as {Name} [label]" is right for every label.
- S8.3 Photos: 1 to 9 attach, the tenth is refused; remove one; a failed upload retries; a very large image; **download the served image and confirm its location data is gone**; video and GIF follow the rule you chose.
- S8.4 Call-outs: "The house at 1412 NW 23rd leaves its trash cans out all week. Can someone say something?" shows the sheet with three options on both apps; the private note (signed, short template) reaches a real second account; "Tell the city" opens the form with the note; "Edit my post" returns with the text kept. Posting around the sheet through the API returns `422 COMPOSER_BLOCKED`.
- S8.5 **Things that must pass untouched:** "Who's a good plumber?", "Thanks Maya for the tomato cages!", "Harbor Plumbing fixed our heater the same day", "The corner of Main and 3rd has a pothole".
- S8.6 Private details: a house number, a plate and a phone number in the text prompt for blur or edit; a heated draft gets one suggestion and posts as written; a national-politics draft gets the note and posts as written.
- S8.7 Existing answers: an Ask similar to an earlier post (or a Known entry in R3) shows the card; "See answers" opens it; posting anyway takes one tap.
- S8.8 A sale ("Selling my couch, $50") is held; the author sees "Awaiting review, usually within 2 hours"; no one else sees it.
- S8.9 Share: no place refused with a clear sentence; the third Share in a week gives `SHARE_WEEKLY_CAP` with the reset; it rolls over after 7 days.
- S8.10 Drafts survive switching apps, killing the app, sign-out and back, and the sign-up flow; discard asks first; drafts are per account.
- S8.11 Offline post: clear state and retry; a double-tap on Post makes one post; the server's `422` shows properly if a client skipped the check.
- S8.12 5,000 characters, pasted huge text, emoji; the whole composer is usable with VoiceOver and TalkBack and its sheets announce themselves.

### S9 Conversations
- S9.1 Two levels: reply to the post, reply to a reply ("Replying to X"), a third-level reply stays in its branch at the same indent; a long branch collapses ("N more replies between A and B") and expands; oldest first.
- S9.2 "↓ N new replies": another account replies while you read; the pill counts; tapping merges and scrolls; nothing jumps under your thumb.
- S9.3 Helpful: the asker marks (several allowed), "✓ Helpful to {Name}" appears and the Ask reads Answered on the feed card, the detail and every client; a non-asker has no control and the API refuses (403); unmark works.
- S9.4 Thank: "Thanked" appears for the thanker; the helper gets a private notice; a second tap changes nothing; your own reply has no Thank.
- S9.5 Offers: "I'd like it" makes a request; the giver sees the list and picks; the others are told "Someone else got this one."; the sixth request says "Enough requests already"; two people request at the same moment; the giver deleting the offer mid-way ends cleanly.
- S9.6 Event: "Going" toggles, counts, persists after relaunch; a comment does not count; an ended event reads "Happened · N went". Heads-up "Seen it" and Lost and found "It's mine" (opens a private message to the poster with the post attached) and "Seen it" work.
- S9.7 Labels on every reply; a removed reply reads "Reply removed" with the thread intact; deleting a test account turns its replies into "Reply removed" and nobody else's replies vanish.
- S9.8 Report a reply; mute a person from "…"; a blocked person's replies are gone.
- S9.9 Heated pair (PS): two accounts trade heated replies; both are told plainly; their next reply to each other within an hour is refused; a third account replies freely.
- S9.10 A reply draft survives scrolling, opening another branch and switching apps; 200-reply threads stay smooth; a failed send is shown and retried without duplicates.

### S10 Following and controls
- S10.1 Follow a conversation: "Saved to Following. Notifications are off."; toggles persist; the three durations behave (resolve the Ask: "until it ends" ends; a week ends after a week; "Keep" stays); "Stop following" works; Following lists it and drops it when it ends.
- S10.2 Follow a topic in your area: Following shows its new posts; notifications stay off by default.
- S10.3 The preferences page lists every follow, mute and alert, each with a working undo, and an honest empty state.
- S10.4 "Why am I seeing this?" for a post seen by area, by topic filter, by follow and by time: only the reader's own choices; never anything about others.
- S10.5 Mute a person and a topic: gone from Nearby and Following; undo restores; replies to you still arrive; quiet hours hold pushes.
- S10.6 "Seeing too much? Mute what you don't care about." appears after a few days of use (move the first-use date) and goes away when dismissed; the funnel events were recorded.

### S11 Moderation baseline
- S11.1 Report a post and a reply: both reach the console queue (web) with context; a non-admin cannot open the console.
- S11.2 Hold: the author sees "Awaiting review, usually within 2 hours" on their own item; **nobody else** sees it on any path; approve makes it live; decline removes it with the rule, the reason and an appeal button.
- S11.3 Appeal: the author appeals; the console shows it; reversing restores the item and notifies; upholding closes it with a plain reason.
- S11.4 Slow mode after repeated removals: one post and three replies a day for 30 days, with plain messages; ban: cannot post or reply, can appeal; it applies to the person, not their household (another member is unaffected).
- S11.5 Automatic holds: a new account's link, several reports, a sale. Crisis: a self-harm phrase holds the post, shows the writer crisis resources, and records the staff alert.
- S11.6 Notices screens and their notifications open the right place from cold and warm starts, on both apps.
- S11.7 The console works at phone and desktop widths. The existing report flow still works. Held and removed items stay invisible on every read path (re-run the matrix rows).

### S12 Known, Upcoming, Right now, search (owners expand before starting)
- S12.1 Known: sources and "last confirmed" show; Confirm, Suggest a correction and Outdated work; two matching confirmations publish a refresh; official-sourced and neighbor-sourced entries look different; asking something Known covers shows the entry first; recommendations are newest first with no stars; a business cannot pay or edit.
- S12.2 Upcoming: events in date order; "Going" works; past events leave.
- S12.3 Right now: an official alert (inject one like the October 13 checks) shows the card; neighbors' "Me too" and "It's back" count; a neighbors-only card says "Reported by neighbors" until an official source confirms; it ends when cleared or reports stop; never for crime; pushes respect quiet hours except Right now.
- S12.4 Search: posts, Known and places in the area, with date, distance and state; includes resolved posts; excludes held, removed and unreadable ones; empty results; accents, emoji and tsquery-looking input (quotes, `&`, `|`, `:*`) are safe; fast on the volume fixture.

### S13 Digests
- S13.1 The daily digest: content order, "Still unanswered", an ending line; right local time across time zones and daylight-saving; once a day (run twice); nothing when nothing is new; it respects mutes, blocks and walls; the email renders in the local inbox in light and dark and as plain text; one push a day at most for anything not about you; quiet hours hold; the weekly street digest stays quiet while no street is open. **Nothing is sent to a real address.**

### S14 Plans bridge
- S14.1 "Suggest a plan" from a conversation is prefilled; only walk & coffee, pickup game and watch party are offered; the audience choices work; the invitation card appears in the conversation; Going and Not this time count; "sounds nice" does not; the toast and "Your plans" (and Today) show it; the plan links back; a closing line appears when it happens; with `plans` off nothing half-appears.

### R4 (owners write the full list before starting; minimum below)
- S15 Public web and guest browsing: signed out, a public town page and post show only first name and label, no street, no distance; a non-public post page is unavailable; the sitemap lists only public posts; "remove from the web view" makes the page vanish; share links open; in the apps "Pick a town" browses read-only and a draft survives sign-up.
- S16 Places and streets: opening a street area; the street wall; the Residents-only view; a building place shows no unit numbers.
- S17 Businesses and officials: the label, the weekly cap, no posting, Official verification in the console.
- S18 Text and email: STOP is honored; a one-word reply works; texts go only to people who replied first; reply-by-email lands in the right conversation.

## C. Cross-client round trips (PV at every sweep; owners for their own slices)

| Do this on | Then check on |
|---|---|
| iOS: post an Ask with a photo | Android and web: card, label, topic, photo, status |
| Android: reply, then mark Helpful from the asker's account | iOS and web: "Answered", the Helpful chip, the reply order |
| iOS: claim an Offer; Android: claim it too; giver chooses | both: one winner, the other told, the card says Gone |
| Android: follow, mute a topic | iOS: Following and the muted topic agree after a refresh |
| web console: hold a post | both apps: invisible to others, "Awaiting review" for the author; then approve and watch it appear |
| any client: delete the account used in a thread | all three: "Reply removed", thread intact |
| iOS: post as New here; sign the second account in on Android | label, limits and distance agree |
| DB: flip `plans`; set an area's `opened_at` | both apps and web change without a new build |

## D. What this file does not ask for

New unit tests, XCUITest or Compose test code, snapshot baselines for new screens, coverage numbers, or CI changes. Run the existing checks before you push (`04-verification.md`), update a test your intended change breaks, and put your effort into the scenarios above.
