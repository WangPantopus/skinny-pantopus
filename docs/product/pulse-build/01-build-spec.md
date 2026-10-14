# Pulse build spec

What the system does, in terms a stream can build and check. The reasoning is in the PR 625 design; the founder's decisions of October 13, 2026 and the PR's review (October 3) are folded in. Numbers marked **(default)** are proposals to tune in the first town; change them in one place (a constant or the `PostCategoryTTL` table), not scattered.

## 1. Scope

**Built:** everything in the PR 625 design, in the order of [`03-delivery-plan.md`](03-delivery-plan.md).

**Not built here:** crime or "suspicious person" posts; a politics topic; businesses posting; following people; personas; any ranking by engagement; ads or targeting from Pulse data; accounts for people under 18; street-level addressed asks (the Street Organizer's Phase 2 model, which opens with Crew Day streets); the Crew Day price path inside conversations (Crew Day software is not built); passwordless sign-up. The text channel and reply-by-email are R4 and need the founder's provider accounts.

**The one-sentence promise:** "I can participate here without taking on another thing to manage."

## 2. Navigation: five tabs

`Place · Today · Pulse · Plans · Messages`

| Tab | Answers | Holds | Change from today |
|---|---|---|---|
| Place | What's true about my address and home? | Unchanged | none |
| Today | What do I need to do or know today? | Unchanged, plus cards for plans I've joined (already built) | none in R1; an "Around you" card and the Right now card later |
| Pulse | What are neighbors saying and asking? | The Pulse page (section 3), the composer, conversations, Known, Upcoming | replaces the Nearby tab; opens on the feed, not a map |
| Plans | What's on, and what am I going to? | The Plans map and list, hosting, requests, **Your plans** (the design's "My plans"), later Crew Day bookings | new tab; the same Plans screens, mounted here |
| Messages | Who is talking to me? | Unchanged | none; its tab id stays `mail` so links, saved state and UI tests keep working |

- **The Plans tab appears only while the existing `plans` switch is on** for the person. With it off the bar is `Place · Today · Pulse · Messages`. The bar must handle the switch changing while the app runs (selection falls back to Pulse if the Plans tab disappears).
- **Nearby's other content moves, it does not vanish.** *Connections* opens from the Pulse tab's top-right menu (existing screen, unchanged). The *neighborhood meter* and the "Set up a home" prompt become one quiet-state card at the top of the Pulse page, shown only while the town is sparse or the person has no home. The Beacons row stays hidden (launch cut).
- **Deep links and pushes.** `/app/nearby` (and the iOS/Android equivalents, plus the three server pushes that use it) opens the Pulse tab. New routes: `/app/pulse`, `/app/plans`. Post and feed links open Pulse; plan links open Plans. `/app/place`, `/app/today`, `/app/chat`, `/app/mailbox` are unchanged.
- **The opening tab is unchanged** (whatever the app opens on today).
- **Web navigation is unchanged** in this build (new builds are mobile-only). The web keeps its Pulse feed and its `/app/nearby` page; nothing there may break.
- **Pulse as a screen.** On iOS Pulse is today a sheet opened from Nearby; on Android a pushed route. Both become the tab's root (a real tab, with the tab bar visible).

## 3. The Pulse page

Top to bottom (wireframes 1, 4 and 2 of `pulse-screens/`):

1. **Header:** "Pulse", a search button, the **area pill** (the town, with the distance dial). In the first release a town is one space; the pill lists the person's town and "another place", and shows street and neighborhood entries only when those areas are open for them (section 14).
2. **Views:** `Nearby` · `Following` · `Known`. (There is no Nearby tab any more, so the view keeps its name.)
3. **Topic chips:** `All` + the 12 topics (section 4), horizontally scrolling. A chip filters; it joins nothing.
4. **Quiet-state card** (neighborhood meter / "Set up a home"): only when sparse or no home.
5. **Right now card:** only while something affects many homes (R3).
6. **Groups, then posts.** Groups in this order: your street, your neighborhood, the town. Each has a header ("YOUR STREET · NW 23RD AVE", "YOUR NEIGHBORHOOD · PRUNE HILL", "AROUND CAMAS"). Newest first inside a group. **Only groups for areas that are open appear**, so at launch there is one group, "AROUND {TOWN}".
7. **New conversations** wait behind a pill at the top ("↑ 3 new conversations") and never move the page.
8. **The end:** "You're caught up" · "That's everything new around {Town} since {this morning|yesterday|…}." · a "Show earlier" link. **Nothing loads by itself.** Pull to refresh and the pill are the only ways new items arrive.

**Rules:** order comes only from choices the person can see (area, topics, follows, time). Replies, reactions and time spent never move a post. Quiet days say so ("Quiet on NW 23rd today") and point to Known or Upcoming; nothing is invented. A post leaves the views when it resolves or ages out and stays searchable. **Follow is not on the card** (review): it lives on the conversation page and in the card's "…" menu.

**A post card** (top to bottom): name · label · distance · time ("Maya · Resident · 0.1 mi · 1h") with the type name on the right ("OFFER"); the words, photo or invitation; place and topic ("NW 23rd Ave · Gardening", and "Ends Wed 4pm" for heads-ups); then the type's one action, the reply count, and a status when resolved ("✓ Answered", "Gone", "Reunited"). Everything else is in "…".

## 4. Posts

### Types and how each ends

`post_type` values (the six the composer offers): `ask_local` (Ask), `share` (Share, new), `offer` (Offer, new), `alert` (Heads-up), `event` (Event), `lost_found` (Lost and found). Older types stay readable (they render as a generic card) and can no longer be created.

| Type | One action | Ends when | `resolution` | Window **(default)** |
|---|---|---|---|---|
| Ask | Answer | The asker marks a reply Helpful → `answered`. Seven days with replies but no mark → `closed`. Seven days with **no replies** → `closed_unanswered` (review fix 7: it never counts as solved) | `answered` · `closed` · `closed_unanswered` | 7 days |
| Share | Reply | Ages out of the views after 3 days; stays searchable | `expired` | 3 days |
| Offer | I'd like it | The giver chooses a requester → `claimed`; others are told it's gone. Otherwise ages out | `claimed` · `expired` | 7 days |
| Heads-up | Seen it | The time it names | `expired` | named time; 48 h if none |
| Event | Going | It happens; the card then reads "Happened · N went". Archived 24 h after it ends | `happened` | event end + 24 h |
| Lost and found | It's mine (found) · Seen it (lost) | The author marks it reunited, or 14 days | `reunited` · `closed` | 14 days |

- **Ask reminder.** On day 6 the asker gets one reminder: with replies, "Did a reply help? Mark what helped."; with none, "Still need an answer?" (keep open 7 more days, or close). The digest carries a "Still unanswered" line for Asks with no replies (R3). Metrics count `answered`, `closed` and `closed_unanswered` separately.
- **Offers are free or loans** (review). A post that reads as a sale is held (section 12). Marketplace stays cut.
- **Offer claims.** `claim_mode` is `choose` (default) or `first`. In `choose`, anyone can tap "I'd like it" (up to 5 requests; later taps read "Enough requests already"); the giver sees the requests and picks one; the rest are told "Someone else got this one." In `first`, the first tap wins.
- **Event "Going"** is the existing like toggle on an `event` post, relabeled; no new table. Comments never count as going.
- **Share cap:** at most 2 Share posts per person per rolling 7 days, any label. A Share needs a place attached (a town, a park, a trail, a business's street): it is about somewhere.
- **Heads-up kinds a resident can create:** `road_hazard`, `power_outage`, `weather_damage`, `hazard`, `other`. `official_notice` and `public_safety` (and a sourced `crime_incident`) only for Official or curator accounts, with a source link, and never describing a person by appearance. `theft`, `vandalism`, `suspicious`, `scam` and `crime_incident` cannot be created by anyone else; the values stay in the database for old rows.
- **Photos** lose their location data on upload (existing for images; extend to video and GIF or refuse them). Up to 9 photos.

### Topics

A fixed list of 12, shown a few at a time with "More": `around_here` (Around here), `outdoors` (Outdoors), `gardening` (Gardening), `home_repairs` (Home and repairs), `food` (Food), `kids_schools` (Kids and schools), `pets` (Pets), `arts_culture` (Arts and culture), `sports` (Sports and fitness), `getting_around` (Getting around), `local_government` (Local government), `volunteering` (Volunteering). The existing `sports` id is kept (the Sports lane uses it). Nobody creates topics; they have no owners, counts or rules. Choosing a topic filters. "Mute this topic in this area" is a mute, not a membership. Track the share of posts tagged `around_here`; if it dominates, revisit the list.

## 5. The composer

One box: "Ask, share, or make a plan…" (wireframe 2). Pantopus suggests the rest; each is editable with one tap. **Rows:** Type (read from the words), **About** (renamed from "Place": the place or area the post is about), Topic. **Two promises are always shown:** *Who can read* (Public: anyone can read and share it; or Verified neighbors) and *Shown to* ("Nearby readers in Camas, and people who follow Gardening"), with the line "Showing it to gardeners doesn't limit who can read it."

- **Defaults:** town posts are Public; street and neighborhood posts are Verified neighbors. An author can narrow later or delete, never widen.
- **First post:** a short audience review ("Your first post: here's who can read it."), then one line to confirm. A first-time poster also confirms "I'm 18 or older" once (stored; posting is adults-only at launch).
- **Posting as:** the label the post will wear ("Posting as Dana [New here]").
- **Checks before posting** (service owned by PS; every check is fail-open except the two that must not post as written):
  - *Existing answers first:* "Neighbors asked something similar" with the Known entry; posting anyway takes one tap.
  - *Call-outs:* a post that names a home or accuses a person shows the sheet (wireframe 2, right): **Send a private note to that home** · **Tell the city** · **Edit my post** ("Ask in general: …"), plus "Recommending a business or thanking a neighbor by name is always fine." **This check blocks posting as written** (rule 2).
  - *Private details:* a visible house number, plate or phone number prompts blur or edit. **Blocks posting as written** (rule 4).
  - *Tone:* a heated draft gets one suggestion. **Never blocks.**
  - *National politics:* no topic exists; the composer says so.
- **Private notes are signed** (review fix 8) with first name and street. A home not on Pantopus gets the city form only in this build (no printed mail).
- **Drafts** survive switching apps, scrolling, opening another branch and sign-up. No code-only sign-up in this build.

## 6. Conversations

The post and its replies in a stable order, two levels deep (wireframe 3).

- **Two levels.** Replies to the post; replies to those, shown as "Replying to Priya". Deeper exchanges stay in that branch at the same indent. Long branches collapse ("6 more replies between Sam and Robin").
- **Stable order:** oldest first. New replies wait behind "↓ 2 new replies".
- **Helpful, not verified.** Only the Ask's author can mark replies "Helpful to Dana" (several allowed). The first mark resolves the Ask to `answered`.
- **Private thanks.** "Thank" sends the helper a private note; the thanker then sees "Thanked". No public likes or scores on people. (Replies keep the existing like heart only where it exists today; do not add counts that read as scores.)
- **Slowed exchanges.** When two people's back-and-forth turns heated, their replies to each other drop to one an hour in that conversation. Everyone else carries on. They are told plainly.
- **Offers, Going, Seen it** as in section 4. **Report** and **Mute** sit in each reply's "…".
- **Labels on every reply** ("Robin · Resident · 1.8 mi"). Businesses reply under their label only where someone asked about their kind of service, with a weekly cap (R4). Officials reply under their name.
- **Local government threads** (R4) get a "Residents only" view and a pinned, labeled summary of positions.
- **Drafts stay put** when scrolling or opening another branch.
- **Follow** is in the header ("Follow"/"Following"); its sheet is in section 7.

## 7. Following, notifications, digest

- **Follow targets:** a conversation, a topic in an area, a place (R4). Never a person. One tap says "Saved to Following. Notifications are off." The sheet (wireframe 3, right): "WANT UPDATES?" with **Daily recap of new replies** and **Notify me about each update** (both off), **FOLLOW FOR HOW LONG?** (*Until {it ends}* · *For a week* · *Keep following*), **Stop following**, and "Replies to you always reach Messages."
- **Following view:** followed conversations and the future posts of followed topics and places, same page rules.
- **Controls on every post's "…":** Why am I seeing this? · Follow this conversation · See more of this topic · Mute this topic in this area · Mute this person · Report a problem. "Why" cites only the person's own choices ("You're viewing Camas, all topics, newest first.") and never what others follow or mute. One **preferences page** lists every follow, mute and alert, each with an undo. After a few days of use one line offers: "Seeing too much? Mute what you don't care about."
- **Noise budget.** Instant: replies to you, a request on your offer, a decision a plan needs from you. Their choice: the daily digest at a time they pick, the weekly street digest (only where streets are open), alerts on follows. Never: "someone posted near you", trending alerts, unread counts meant to pull people back, re-engagement nudges. At most one push a day for anything not directly about you. **Quiet hours** (existing setting) hold every push overnight except Right now.
- **Daily digest** (R3): email or push at the chosen time; what's new by distance, the home's own items (pickup days, alerts), what plans need, "Still unanswered"; it ends the way the page ends ("You're caught up").

## 8. Known, Upcoming, Right now

- **Known** (R3): short, sourced answers to recurring questions (trash and recycling days, plumbers neighbors recommend, keys, library passes, burn rules). Each shows its sources (the conversations and official links) and **last confirmed**. Asking something Known covers shows the entry first; asking anyway and getting answers refreshes it. Recommendations list who recommended whom and when, newest first; **no star ratings; businesses cannot pay to appear or edit**. **No staff bottleneck** (review): official-sourced and neighbor-sourced entries look different; residents **Confirm**, **Suggest a correction** or flag **Outdated**; two matching confirmations publish a refresh; staff handle disputes. Pantopus (the curator) drafts entries from resolved Asks and official sources, labeled with their sources.
- **Upcoming** (R3): events posted in Pulse, official events and plans open to the area, in date order; "Going" is the only RSVP.
- **Right now** (R3): appears at the top of Pulse only while something affects many homes (outage, smoke, closure, storm, boil notice). Official information first, with its source and time; neighbors add **Me too** or **It's back**, never free text. It can start from several nearby homes reporting the same thing, labeled "Reported by neighbors" until an official source confirms. It ends when the official source clears it or reports stop. **Never for crime.**

## 9. From conversation to plan

"Suggest a plan" in a conversation's "…" opens the Plans host flow prefilled from the post (wireframe 5), creates a plan through the **existing Plans API and tables** (no second plans model), links it to the conversation (`Plan.source_post_id`), and posts the invitation back into the conversation. Only **Going** counts, and it lands in **Your plans** (Plans tab) and on Today. Kinds offered from a conversation: walk & coffee, pickup game, watch party (never playdates). For an "All of {town}" audience the plan uses the existing auto-accept rules (verified neighbors; anyone nearby for walks and pickup games; never plans at home). The toast reads "Added to your plans · Thu 6:00pm · View". Recurring plans, co-hosts (review) and the Crew Day option are later; the Crew Day option needs Crew Day software.

## 10. Identity, labels and permissions

Every post and reply shows the writer's relationship to the **area it is in**:

| Label | Who | Rule |
|---|---|---|
| **Resident** | Lives in the area, verified | Verified address (postcard, document, landlord or admin) for a home inside the area. A household invite does not count |
| **New here** | Says they live here; verification pending | A postcard was requested for a home in the area and is not yet confirmed |
| **Nearby** | A verified resident of a neighboring town | Verified home within the neighboring-town distance **(default 15 miles from the area's edge)** |
| **Visitor** | Signed in, no home here | The default |
| **Official** | A city, utility, school district or agency | `account_type = 'official'`, verified by staff |
| **Business** | A local business replying | A verified business account; replies only |
| **Pantopus** | The labeled curator account | `origin = 'curator'` |

| Can they… | Signed out | Visitor | Nearby | New here | Resident |
|---|---|---|---|---|---|
| Read public town posts | Yes | Yes | Yes | Yes | Yes |
| Reply at town level | No | Yes | Yes | Yes | Yes |
| Start a town post | No | Asks only, 1 a day | Yes | Yes, 2 a day | Yes |
| Add observations on place pages (R4) | No | Yes, dated | Yes | Yes | Yes |
| Read and post in a street or neighborhood | No | No | No | No | Their own areas |

- **Distance** is relative to the **reader's** home, rounded, shown to verified readers only, and **never on the public web**; where few homes are close it reads "nearby". A house number appears only inside the street area, and anyone can hide theirs.
- One account per adult, linked to their home. A ban applies to the person, not the household. After a move, areas switch with the verified home; old areas fade over a month with a goodbye line; posts stay.
- Public town posts show a first name and a label ("Dana · New here"). Full names and photos are optional.
- Deleting an account turns its replies into "Reply removed" (the thread keeps its shape) and removes its posts.

## 11. Privacy and audience

Audience is set by place, stated before posting, and never widened afterward. The household never appears in Pulse.

| Area | Who can read | Shows about the writer | Sharing |
|---|---|---|---|
| Household | Its members | Everything the household shares with itself | Never appears in Pulse |
| Street | Verified homes on that street | First name, street, distance | No share button; links open only for verified neighbors |
| Neighborhood | Verified homes in the neighborhood | First name, street, distance | Same |
| Town | Anyone, signed in or not | First name and label | Share links work |
| The web | Search engines and anyone | Public town posts only: first name and label, no street, no distance | Authors can remove a post from the web view |

- The feed and every read check the post's audience against the reader on the server. A client can no longer pick any coordinates and read any "place" post.
- A share link opens only a post its author made public (PR 2252 is the first piece).
- Photos lose location data. Screenshots can't be prevented; the composer reminds people that street posts are for neighbors.
- Pulse uses the verified home and the area a person picks. It never tracks live location.
- Nothing written, read, followed or muted in Pulse is sold or used to target offers. Offers live in one labeled "Local offers" spot (R4) and never use Pulse, household, Crew Day or Porchlight data.
- "Why am I seeing this?" never reveals what others follow, read or mute. No contact uploads, no "people you may know", no follower counts.

## 12. Safety and moderation

Prevent most harm in the composer, handle the rest with paid human moderators, and show every action to the person it affects. No volunteer admins.

**Rules** (shown in context): 1) talk about places, services and issues, not identifiable private people; 2) no call-outs of a home, car or person; 3) no personal attacks, slurs, threats or harassment; 4) no one else's private information; 5) no promotion except a business replying under its label; 6) local disagreement is welcome, national partisan politics has no topic; 7) emergencies go to 911 first.

**Ladder** (times are targets): Suggestion → **Held for review** ("Awaiting review, usually within 2 hours" on the author's own post; a likely rule break, a new account's link, several reports, a sale post) → **Removed** (the rule, the reason, an appeal button) → **Slow mode** (one post and three replies a day for 30 days) → **Ban** (plain reason, human appeal; applies to the person). Held and removed states, notices and appeals are the S11 baseline; reports exist for replies as well as posts.

**Guardrails.** No crime topic and no "suspicious person" post. A post suggesting self-harm is held, the writer sees crisis resources, and trained staff follow up. Threats go to law enforcement under the published policy; child sexual abuse material is reported to NCMEC as US law requires (**founder-owned setup**, see README). Moderators are paid staff; a quarterly public report lists posts held, removed and restored.

## 13. Businesses, officials, the curator

Businesses reply under their label only where someone asked about their kind of service (weekly cap, R4), cannot start posts, follow or message people first, or edit Known, and appear in Known only when residents recommended them. Offers from verified local businesses appear only in one labeled "Local offers" spot (R4), never in the conversation list. Officials post Heads-ups, Events and Right now updates under verified names; they cannot remove residents' replies to them. The labeled curator ("Pantopus · Camas") seeds sourced road closures, meeting agendas, events and Known entries, never invents neighbors, never posts opinions, and shrinks as residents take over.

## 14. Areas, places and streets

- **Launch areas:** the towns of the pilot (Camas, Washougal, Vancouver WA) as boundary polygons. Pulse opens in each as one public town space.
- **Street and neighborhood areas are data-gated, not flagged:** an area has `opened_at`; a street opens when it completes a Crew Day (or by staff once it would show a few new conversations a week without the curator). Neighborhoods use city-recognized boundaries where they exist, otherwise a labeled radius. Closed areas have no group, no picker entry and no street-level posting.
- **Place pages (R4):** buildings, HOAs and school zones first, then parks, trails and lakes. A place page shows conversations about the place, Upcoming events there, sourced facts, official updates under their names, and dated visitor observations. Following is optional and grants nothing. Restricted places (a building, an HOA) show conversation only to verified homes inside.
- **Apartment buildings:** the building is the street area; unit numbers are never shown. **Rural roads:** areas by drive time, distances read "nearby".

## 15. Metrics

Events are added with the slice that creates the behavior (names are suggestions; PB owns `funnelEvents.js`): `pulse_open`, `pulse_caught_up`, `pulse_post_created`, `pulse_reply_created`, `pulse_helpful_marked`, `pulse_follow`, `pulse_topic_muted`, `pulse_seeing_too_much_tap`, `pulse_composer_redirect` (call-out or private-detail sheet choice), `pulse_known_viewed`, `pulse_plan_suggested`, plus the report and hold rates from the moderation tables. **Never goals:** time in the app, daily opens, reply counts, posts per person, notification open rates.

## 16. Acceptance: first-time users, unaided

Each round uses 8 to 10 people in the first town on the real app; any task fewer than 8 in 10 finish unaided is a design defect. Each task is also checked through the real screen, API and stored data.

1. Find a conversation about gardening nearby. 2. Reply without joining anything. 3. Explain who can read their post before publishing it. 4. Follow a conversation without turning on alerts. 5. Mute one topic in their town and keep the rest. 6. Turn a discussion into an invitation without signing anyone up automatically. 7. Find their trash pickup day in Known. 8. See an existing answer before asking the same question again. 9. Tell whether a reply came from a resident or a visitor. 10. Try to post about a specific house and choose the private note. 11. Find out why a post appears in their Pulse. 12. Reach "You're caught up" and know nothing is hidden below it. **Added for this build:** 13. Post a Share about a place and see why a third one this week is refused. 14. Find Plans from the tab bar and see Your plans.

## 17. How the PR 625 review's items were decided

| Review item | Decision |
|---|---|
| 1 Street surface and the meaning of Nearby | The Nearby tab is gone. Plans has its own tab with Your plans. Pulse's street group may show one line "N plans on your street → Plans" when plans are on. The seasonal "four homes are due" suggestion stays in Today (household data never enters Pulse). The opening tab is unchanged |
| 2 "No feed" in the Street Organizer | Amended in the same change (`street-organizer-design-2026-09-27.md`). The composer blocks call-outs and private details; it never blocks tone |
| 3 One model for the street | Addressed and bounded on the street (Street Organizer Phase 2, later), open at town level (this build). No street-level posting exists until a street opens |
| 4 Text channel | R4, after the founder's SMS provider |
| 5 Street areas open on Crew Day streets | Yes: `opened_at` is set when a street completes a Crew Day |
| 6 Offers not first-come by default | `claim_mode = choose`; first-come is the giver's option |
| 7 Unanswered Asks | `closed_unanswered`, "Still need an answer?", digest line, counted apart |
| 8 Private notes signed | First name and street; city form for homes not on Pantopus |
| Search | R3: posts, Known and places, scoped to the area, results with date, distance and state |
| Digest as a product | R3 (section 7); reply-by-email is R4 |
| Long threads need a gist | Local government threads: pinned labeled summary (R4) |
| Share cap | 2 a week per person |
| Follow off the card | Done (section 3) |
| "Place" → "About" in the composer | Done (section 5) |
| Distances | Reader-relative, rounded, verified only, never on the public web |
| Known without staff | Two confirmations publish a refresh (section 8) |
| Watch "Around here" | Tracked (section 4) |
| For-sale rule | Offers are free or loans; sale posts are held |
| Neighborhood boundaries | City-recognized, else a labeled radius |
| Cap business replies | Weekly cap (R4) |
| Co-hosts for recurring plans | Later |
| Quiet hours and accessibility | Quiet hours in section 7; accessibility below |

**Accessibility (every screen):** works with large type (iOS has fixed type sizes today: every **new** Pulse screen uses scalable type; do not copy the fixed sizes), VoiceOver and TalkBack name every control (labels, states, "N new" pills), dark mode, and no information carried by color alone (labels are text).

## Appendix: copy

Strings below are from the wireframes and are used verbatim on both platforms; shorten only with the same meaning and record it in the PR. Changes from the wireframes: "Place" row → **About**; "Added to My plans" → **Added to your plans**; Follow is not on the card.

- Page: `Pulse` · `Nearby` `Following` `Known` · chips `All` `Around here` `Outdoors` `Gardening` … · `YOUR STREET · {STREET}` `YOUR NEIGHBORHOOD · {NAME}` `AROUND {TOWN}` · `↑ {n} new conversations` · `You're caught up` · `That's everything new around {Town} since this morning.` · `Show earlier`
- Card: `I'd like it` `Seen it` `Going` `Reply` `Answer` `It's mine` · `{n} replies` · `{n} going` · `✓ Answered`
- Composer: `New post` `Cancel` `Post` · `Your first post: here's who can read it.` · `Ask, share, or make a plan…` · `+ Photo` · `PANTOPUS SUGGESTS · TAP TO CHANGE` · `Type` `About` `Topic` · `Who can read` `Public` `Anyone can read and share it` · `Shown to` `Nearby readers in {Town}` `and people who follow {Topic}` · `Showing it to gardeners doesn't limit who can read it.` · `Neighbors asked something similar` `See answers` · `Posting as {Name}`
- Call-out sheet: `This names a specific home` · `Posts about one house or person rarely fix things and can't be taken back. These usually work better:` · `Send a private note to that home` `Pick a short, friendly note. They can reply or not.` · `Tell the city` `Opens the city's request form with your note.` · `Edit my post` `Ask in general: "What are the rules for trash cans?"` · `Recommending a business or thanking a neighbor by name is always fine.`
- Conversation: `Conversation` `Follow` `Following` · `{n} replies · oldest first` · `Replying to {Name}` · `✓ Helpful to {Name}` · `Reply` `Thank` · `↓ {n} new replies` · `Reply to {Name}…`
- Follow sheet: `Saved to Following` `Notifications are off.` · `WANT UPDATES?` `Daily recap of new replies` `Notify me about each update` · `FOLLOW FOR HOW LONG?` `Until the work ends, Wed 4pm` `For a week` `Keep following` · `Stop following` · `Replies to you always reach Messages.`
- Right now: `RIGHT NOW` `Updated {time}` · `Official` · `{n} homes near you report it too` · `Me too` `It's back` · `Official updates first. The card ends when power is restored.`
- Known: `Known · {Town}` · `From {n} conversations · last confirmed {date}` · `Listed by most recent recommendation. Businesses can't pay to appear here or edit this page.` · `Ask again to refresh` `Suggest a correction` · `Sources: …`
- Plan: `Suggest a plan` · `What` `When` `Where` `Repeats` `Who can join` `Conversation` `{Neighborhood}` `All of {Town}` · `Only people who tap Going are counted. A reply like "sounds nice" doesn't sign anyone up.` · `Post the invitation` · `PLAN · HOSTED BY {NAME}` · `Going` `Not this time` · `{n} going · {n} can't make it this week` · `Added to your plans · {when}` `View` · `Not counted as going`
- Labels: `Resident` `New here` `Nearby` `Visitor` `Official` `Business` `Pantopus`
- Tab bar: `Place` `Today` `Pulse` `Plans` `Messages`
