# PC — Channels and public web

You build how Pulse reaches people outside the app: the daily digest, the noise budget, email and text channels, and the public web pages that let anyone read a town's public conversation. **Start when R2 begins (about week 3)**; until then read, design and write the digest note. Read [README](../README.md), [build spec](../01-build-spec.md) (sections 7, 11, 14), [contract](../02-contract.md), [delivery plan](../03-delivery-plan.md) and [verification](../04-verification.md) first.

## Owns and does not own

- **Owns:** `backend/jobs/pulseDigest*.js`, `backend/services/pulse/digest/*`, Pulse email and text templates, the digest preferences handlers (columns on `UserNotificationPreferences`), `DigestDelivery`, the **public web pages** (new routes under `frontend/apps/web/src/app/`), the sitemap and `robots.ts` changes, and `frontend/apps/web/src/lib/publicShare.ts` changes.
- **PB owns** the data queries and public endpoints you call (`GET /api/public/pulse/*`); ask under "Requests". **PS owns** moderation: you never publish anything PS's states hide.
- **The web is mobile-only for new builds**, with the founder's recorded exceptions (the Plans share page, the moderator console and these public pages). Keep the web app's existing pages working.

## Code map (verified on master)

| What | Where |
|---|---|
| Briefings today (morning and evening, pushes, "Bins out"), scheduled by the seeder's Lambdas and delivered through the backend | `pantopus-seeder/src/handlers/briefing.py` → `backend/routes/internalBriefing.js` (`/api/internal/briefing/*`); preferences in `UserNotificationPreferences` (`daily_briefing_*`, `evening_briefing_*`, `quiet_hours_*`, `location_mode`) and `PUT /api/hub/preferences` |
| Email | `backend/services/emailService.js` (SMTP; staging uses Postmark; locally mail lands in the stream's inbox) |
| Text | `backend/services/smsService.js` only logs today; a real provider needs the founder |
| Public share page | `frontend/apps/web/src/app/posts/[id]/page.tsx` (Open Graph, "Open in Pantopus", Apple banner), `frontend/apps/web/src/lib/publicShare.ts` |
| Crawling | `frontend/apps/web/src/app/robots.ts` (production only; allows `/`, disallows `/app/`); there is **no sitemap** |
| Web middleware | `frontend/apps/web/src/middleware.ts` (gates `/app/*`; public routes are marketing, auth, `/start`, link pages) |

## Deliverables

- [ ] **Design note first** (status file): reuse the existing briefing pipeline and scheduler for the digest (no second scheduler); content and order; the ending line; what each channel carries; how "at most one push a day for anything not directly about you" and quiet hours are enforced in code; idempotency with `DigestDelivery`.
- [ ] **S13 Daily digest** (email and push at the person's chosen time and timezone): what's new by distance (street, neighborhood, town, only open areas), the home's own items (pickup days, alerts: reuse the briefing signals; household data goes in the digest, never into Pulse), what plans need, a "Still unanswered" line for Asks with no replies, an end ("You're caught up"). Preferences: `GET|PUT /api/pulse/preferences` handlers (contract 2.9), the weekly street digest ready but quiet until streets open. The noise budget lives in **one place** in code. **Nothing real is sent**: you verify against the local mail inbox and the push payload logs; the founder approves any real send and any provider account.
- [ ] **S15 Public web** (**hold point H2: waits for PS's S11 baseline and the founder's confirmation of moderation cover**): public town pages (a town's public conversation, Known, Upcoming), public post pages that show only first name and label (no street, no distance, no unlabeled identity), "Open in Pantopus", canonical and Open Graph tags, a **sitemap** of public posts and towns, `robots` that allow public pages, `noindex` for everything else, and the author's **remove from the web view** (it sets `allow_external_share = false`, so the page disappears). Server-render from PB's public endpoints with sensible caching; one slow query must not block a page.
- [ ] **S18 Text channel and reply-by-email** (needs the founder's SMS and inbound-email provider accounts first): street-level asks and offers reach text-only neighbors by text with a one-word reply (only to people who replied first; STOP always honored), and replying to a digest email can answer a conversation. Not before the founder provides accounts.

## Rules specific to this stream

- **Never publish what the wall hides.** Public pages and the sitemap read only through PB's public endpoints (public posts with sharing on). Re-run the privacy matrix's signed-out rows on every public PR.
- **Respect the noise budget and quiet hours in code,** not copy. Never "someone posted near you", trending, unread counts or re-engagement nudges.
- **Founder-only:** provider accounts, secrets, any real email or text, deploys, search-console setup, DNS.
- **Calm by default:** the digest ends; it is short; it carries nothing invented.

## Verification you own

Run the scenarios in [`05-scenarios.md`](../05-scenarios.md) for S13, S15 and S18 (digest, public web, text and email) through the local mail inbox and a signed-out browser. No unit tests.

Local: two accounts with different preferences get the right digest at the right local time (advance the clock by running the job with a forced "now"); nothing duplicates (run twice); quiet hours hold; a signed-out browser sees only public posts, with no street or distance, and a removed-from-web post 404s; the sitemap lists only public posts; the web app's existing pages still load.

## First three days

Read the briefing pipeline end to end and write the digest design note. Do not build before R2 starts; ask PB for the content queries you will need.
