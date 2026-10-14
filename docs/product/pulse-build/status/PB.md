# PB status: Backend and data

Owner: the PB session. Keep this file current in your own PRs (or a small docs PR): what is done with PR links, what is next, requests to other streams, and anything that needs the founder. Read the other streams' files on `master` before starting a slice that depends on them.

## Done

- **S1 rule cleanups** (server half, in review): Heads-ups about crime and suspicion (`theft`, `vandalism`, `suspicious`, `scam`, `crime_incident`) are refused at creation with `400 ALERT_KIND_NOT_ALLOWED`; `official_notice` and `public_safety` only from Official or curator accounts, each with `sourceUrl` (stored as `post_metadata.source_url`); an edit can't switch a post to a refused kind; businesses can't post to the Place feed (`403 BUSINESS_CANNOT_POST`, also from `POST /api/businesses/:id/posts`). Old posts of those kinds stay readable and editable. The seeder now sends each alert's source. Contract §1, §2.5 and §8 updated.

## Next

- S4 topics (the 12 topics, the feed's topic filter, topic mutes with `areaId`, listed and undoable).
- Then `canReadPost`, `labelFor` and the `PulseArea` migration with the three town boundaries, ready for the table approval (S5).

## Requests (to other streams)

- → PI, PA (S1 client half): remove Theft, Vandalism, Suspicious and Scam from the Heads-up kinds, and default the kind to Hazard (both composers default to Theft today, which the server now refuses). Residents may create `road_hazard`, `power_outage`, `weather_damage`, `hazard`, `other`, `missing_pet`. Remove the business owner dashboard's compose button: `POST /api/businesses/:id/posts` now always answers `403 BUSINESS_CANNOT_POST` with a readable sentence.
- → PS (or whoever the founder names for the general web app): the web composer's alert types (`frontend/apps/web/src/components/feed/composer/SafetyAlertFields.tsx`) still list theft, vandalism, suspicious and scam. The server refuses them with a clear toast and keeps the draft; dropping the four buttons is a small web fix.
- → PV: `scripts/pulse/accounts.cjs` creates `@example.invalid` emails, which the backend's sign-in validation rejects ("Please enter a valid email address."), so the accounts can't sign in to the web or the apps. `@example.com` (also reserved) works; PB moved its own local accounts.

## Needs founder

- Tick **New tables** in the README before any table migration (S5) can merge.
- Deploy note for S1: deploy the seeder no later than the backend. The backend refuses a curator public-safety alert without a source link; the updated seeder sends one, and an older backend ignores the extra field.
