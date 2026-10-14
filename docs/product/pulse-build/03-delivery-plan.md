# Delivery plan

Five releases, numbered slices, and who builds what. Weeks are estimates from the start of the build (about three to four sessions working in parallel); they move with decisions and verification, not typing. A slice is **done** when it is merged on `master`, verified in the real apps by its owning streams, and its row in the owners' status files says so.

**No feature flag:** a slice that is not ready is simply not reachable. Hold points (H1–H5) are in the [README](README.md#hold-points-what-replaces-a-feature-flag).

## Order and dependencies

```
R0  (days 0–3)   tools, runtime recipe, docs, Share fix                         [done / this PR]
R1  (weeks 1–3)  S1 S2 S3 S4 S5 S6 S7    safe ground, five tabs, feed core
R2  (weeks 3–6)  S8 S9 S10 S11           composer, conversations, following, moderation baseline
R3  (weeks 6–10) S12 S13 S14             Known / Upcoming / Right now / search, digests, plans bridge
R4  (weeks 10–15) S15 S16 S17 S18 S19    public web, places and streets, business and official, text, transparency
```

Critical path: **S2 → S7/S8** (older clients must tolerate new types before anyone can create them), **S5 → S6** (the feed needs areas, labels and walls), **S11 → S15** (moderation before any public exposure). PB leads every slice by about a week; clients build the screens against the contract and finish against the real backend as PB's PRs land.

## R0 — foundations (done or in this PR)

- Share leak fixed: [PR 2252](https://github.com/WangPantopus/skinny-pantopus/pull/2252).
- Tools on this Mac, `scripts/pulse/stream-runtime.sh`, `~/.config/pantopus/dev-env.sh`, this kit.
- Founder ticks "New tables" (needed before slice S5 and later table work merges).

## R1 — safe ground, five tabs, feed core

| Slice | What ships | PB | PI / PA | PS | PV |
|---|---|---|---|---|---|
| **S1 Rule cleanups** | Crime and suspicious kinds out; businesses reply only | Reject at creation (`ALERT_KIND_NOT_ALLOWED`, `BUSINESS_CANNOT_POST`); keep legacy rows readable | Remove those kinds and the business-to-Place option from the composers | — | Check old rows still render |
| **S2 Tolerant decoding** | No crash on unknown `post_type`, new fields, new enum values | — | Tolerant decoders for feed, post detail, comments, notifications; unknown type renders as a generic card (**H1: merge before S7**) | — | Replay a payload with unknown values on both apps |
| **S3 Five tabs** | `Place · Today · Pulse · Plans · Messages` | Server pushes and links `/app/nearby` → Pulse; plan links → Plans | Tab bar, tab roots, Plans tab on the `plans` switch (runtime-reactive), deep-link aliases, Connections in the Pulse menu, meter card relocation, UI-test ids | — | Large-text and small-phone check of five tabs; every push and link route |
| **S4 Topics** | The 12 topics as filters and mutes | Widen `Post_topic_check`; `topic` filter in the feed; topic mute with `areaId` | Topic chips; mute a topic in an area | — | — |
| **S5 Areas, labels, walls** | Town areas, `author_label`, `distance_text`, server-enforced `read_scope` on every read, adult attestation, label limits | Needs the table approval: `PulseArea` with Camas, Washougal, Vancouver; `canReadPost`; `labelFor`; `read_scope`/`area_id` on `Post`; limits; `POST /api/pulse/adult-attestation`, `GET /api/pulse/areas/*` | Show labels and distance on cards and replies; area pill; the adult confirmation | — | **Two-account privacy matrix** (see `04-verification.md`) across every read path |
| **S6 The Pulse page** | `GET /api/pulse/feed`, the page that ends | The feed, the new pill count, the seen marker, `quiet` states | Pulse root: groups, topic chips, new-conversations pill, "You're caught up", "Show earlier", quiet-state card, Following view as an empty shell until S10 | — | Walk acceptance tasks 1, 9, 12 |
| **S7 Lifecycle** | `share` and `offer` types, windows, resolution, the day-6 reminder | `expires_at`, `resolution`, `claim_mode`; `PostCategoryTTL` rows; auto-archive by type; `closed_unanswered`; `ask_still_open` push (**H1 first**) | Status, "Answered", "Gone", "Reunited", "Happened · N went" on cards; legacy cards still fine | — | Fast-forward the clock (job run) and check each type's ending |

## R2 — composer, conversations, following, moderation baseline

| Slice | What ships | PB | PI / PA | PS | PV |
|---|---|---|---|---|---|
| **S8 Composer** | One box, suggestions, audience promises, first-post review, checks, drafts | Pulse-mode fields in `POST /api/posts`; limits; Share cap; sale posts held | The composer screens (wireframe 2), audience review, "Posting as", draft persistence, call-out sheet, private-detail prompt, existing-answers card | `POST /api/pulse/composer/check` and `evaluateComposerChecks`; private notes (`/api/pulse/notes`); EXIF for video and GIF or refuse them | Tasks 3, 8, 10 |
| **S9 Conversations** | Two levels, Helpful, Thank, claims, Going, Follow | `GET /api/pulse/posts/:id`, replies after, helpful, thanks, `OfferClaim`, `CommentThanks`, "Reply removed" on account deletion | Conversation screen (wireframe 3), Helpful and Thank, "↓ N new replies", offers, Going, the Follow header | Slowed exchanges between two heated people | Tasks 2, 6, 9 |
| **S10 Following and controls** | Follow, preferences page, Why, mutes | `PulseFollow`, follows API, preferences API and summary, why, funnel events | Follow sheet (wireframe 3, right), Following view, preferences page, "Why am I seeing this?", "…" menu items, "Seeing too much?" line | — | Tasks 4, 5, 11 |
| **S11 Moderation baseline** | Held, removed, appeals, notices, reports on replies, slow mode and ban, console | `moderation_state` honored by every read path (shared with S5) | Notice and appeal screens; held state on the author's own post; report on replies | `ModerationAction`, `ModerationAppeal`, `/api/pulse/notices`, `/api/pulse/appeals`, console in `app/admin/reports`, crisis flow | Walk the ladder end to end with two accounts and a moderator |

## R3 — Known, Upcoming, Right now, search, digests, plans

| Slice | What ships | Streams |
|---|---|---|
| **S12 Known, Upcoming, Right now, search** | The Known tab and entries; Upcoming list; the Right now card; search over posts, Known and places | PB data and APIs (`KnownEntry`, `KnownConfirmation`, `RightNowEvent`, `RightNowReport`, search column); PS drafts Known entries from resolved Asks and official sources and writes the curator seeding; PI/PA screens (wireframe 4); official sources start with NWS and AirNow already ingested, utilities later (founder accounts) |
| **S13 Digests and the noise budget** | Daily digest by email and push, quiet hours honored, "Still unanswered" line, the weekly street digest ready for opened streets | PC jobs and templates (`DigestDelivery`), preferences; PB provides content queries; the founder approves any real send |
| **S14 Plans bridge** | "Suggest a plan" from a conversation; the invitation card; Going; "Your plans" and Today cards | PB (`Plan.source_post_id`, plan card in the conversation payload, creation through Plans services); PI/PA screens (wireframe 5) |

## R4 — public web, places and streets, business and official, text, transparency

| Slice | What ships | Streams |
|---|---|---|
| **S15 Public web and guest browsing** | Public town pages, search indexing, share links for public posts, "Pick a town to look around" in the apps | PC (web pages, sitemap, robots) with PB's public endpoints; PI/PA guest mode. **H2: waits for S11 and the founder's moderation cover** |
| **S16 Places and streets** | Place pages (buildings, HOAs, school zones, then parks); Residents-only view; street and neighborhood areas open per area; the street group with its plans line | PB (`PulseArea` kinds, opening rule), PS (rules per place), PI/PA |
| **S17 Businesses and officials** | Business replies under a label with a weekly cap; Official verification in the console; the "Local offers" spot; curator updates | PB, PS, PI/PA |
| **S18 Text channel and reply-by-email** | Text notices to text-only neighbors with a one-word reply; reply-by-email to a digest | PC. **Needs the founder's SMS and inbound-email accounts first** |
| **S19 Transparency and metrics** | The quarterly report numbers, the metrics dashboard rows | PS, PV |

## Release cuts

The founder cuts builds and deploys. **Order: backend, then web, then app builds.** Before each cut PV runs a release-candidate sweep: Release builds on iOS and Android (R8-shrunk), the production web build, every push and link route, two-account privacy matrix, offline start, large text, VoiceOver and TalkBack on the five tabs, and a read of the staging logs. A slice's PR says which cut it needs ("backend first").

## What each stream does in its first three days

- **PB:** read the code paths (`posts.js`, `feedService.js`, `trustState.js`), publish the S1 and S4 PRs (no tables needed), draft `canReadPost` and `labelFor` against a fixture, prepare the `PulseArea` migration for approval, source and simplify the three town boundaries.
- **PI / PA:** start the isolated runtime and a private simulator or emulator; ship S2 (tolerant decoding) first, then S3 (the five-tab bar). Build the Pulse page screens against the contract with fixture JSON while S5 and S6 land.
- **PS:** build `evaluateComposerChecks` (call-out, private details, tone, politics) with a small set of real examples and an accuracy note, and the private-note templates; draft the moderation tables for approval.
- **PC:** wait for R2, but read `pantopus-seeder` briefing handlers, `routes/internalBriefing.js`, `services/emailService.js`, `UserNotificationPreferences` and the public share page, and write the digest design note in the status file.
- **PV:** maintain `scripts/pulse/stream-runtime.sh`, write the two-account privacy matrix runner, fixture accounts and posts, and the evidence and sweep checklist; run the matrix against `master` today to record the baseline.
