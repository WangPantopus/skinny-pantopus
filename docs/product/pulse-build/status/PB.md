# PB status: Backend and data

Owner: the PB session. Keep this file current in your own PRs (or a small docs PR): what is done with PR links, what is next, requests to other streams, and anything that needs the founder. Read the other streams' files on `master` before starting a slice that depends on them.

## Done

- **S1 rule cleanups** (server half): [PR 2259](https://github.com/WangPantopus/skinny-pantopus/pull/2259), merged, verified on web, iOS and Android. Heads-ups about crime and suspicion (`theft`, `vandalism`, `suspicious`, `scam`, `crime_incident`) are refused at creation with `400 ALERT_KIND_NOT_ALLOWED`; `official_notice` and `public_safety` only from Official or curator accounts, each with `sourceUrl` (stored as `post_metadata.source_url`); an edit can't switch a post to a refused kind; businesses can't post to the Place feed (`403 BUSINESS_CANNOT_POST`, also from `POST /api/businesses/:id/posts`). Old posts of those kinds stay readable and editable. The seeder now sends each alert's source. Contract §1, §2.5 and §8 updated.
- **S4 topics** (server half, in review): the twelve topics in `Post_topic_check`, `?topic=` on the legacy Place feed, topic mutes with `areaId` (listed in `GET /api/posts/mute` as `topic_mutes`, undone by area), `PostMute.area_id`. Contract §2.9 and §4.1 updated.

## Next

- **One read check on every path** (S5, no table needed): move `canViewPost` into one shared function and use it on every path that returns a post. An inventory of the backend's post read paths found several that check access their own way, or not at all; the details went to the founder in chat. Each repair is its own small privacy PR.
- Then `labelFor` (built on `isVerifiedResident` in `utils/homePermissions.js`, which Plans already uses), `canReadPost`'s area scopes, and the `PulseArea` migration with the three town boundaries, ready for the table approval.

## Requests (to other streams)

- → PI, PA (S1 client half): remove Theft, Vandalism, Suspicious and Scam from the Heads-up kinds, and default the kind to Hazard (both composers default to Theft today, which the server now refuses). Residents may create `road_hazard`, `power_outage`, `weather_damage`, `hazard`, `other`, `missing_pet`. Remove the business owner dashboard's compose button: `POST /api/businesses/:id/posts` now always answers `403 BUSINESS_CANNOT_POST` with a readable sentence.
- → PI, PA (S4 client half): topic chips use `GET /api/posts/feed?topic=` today and `GET /api/pulse/feed?topic=` from S6; "Mute this topic in this area" uses `POST /api/posts/mute/topic` `{ topic, areaId }` (areas from S5; without `areaId` it mutes everywhere); the preferences list reads `topic_mutes` from `GET /api/posts/mute` and undoes with `DELETE /api/posts/mute` `{ entityType: 'topic', entityId, areaId? }`.
- → PS (or whoever the founder names for the general web app): the web composer's alert types (`frontend/apps/web/src/components/feed/composer/SafetyAlertFields.tsx`) still list theft, vandalism, suspicious and scam. The server refuses them with a clear toast and keeps the draft; dropping the four buttons is a small web fix.
- → PV: `scripts/pulse/accounts.cjs` creates `@example.invalid` emails, which the backend's sign-in validation rejects ("Please enter a valid email address."), so the accounts can't sign in to the web or the apps. `@example.com` (also reserved) works; PB moved its own local accounts.

## Needs founder

- Tick **New tables** in the README before any table migration (S5) can merge.
- Merge [PR 2252](https://github.com/WangPantopus/skinny-pantopus/pull/2252) (the Share fix; the README says before the streams start): the shared read check builds on its `canViewPost` change.
- Permission to fetch the three town boundaries (Camas, Washougal, Vancouver) from the US Census TIGERweb service: public domain, a few tens of KB of GeoJSON, saved to PB's scratch space, simplified and written into the `PulseArea` migration with its source.
- Deploy note for S1: deploy the seeder no later than the backend. The backend refuses a curator public-safety alert without a source link; the updated seeder sends one, and an older backend ignores the extra field.
- Deploy note for S4: the migration before the backend (the release workflow already migrates first).
