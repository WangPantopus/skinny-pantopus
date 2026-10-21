# Saved-address public details

October 20, 2026 · **Approved by the founder on October 20, 2026; implementation in progress.**

## Approved design

Someone who saved an address privately and has no Home can open useful public
details from their Place tab. Reuse the current detail layouts on iOS and
Android. Keep the Place root, tabs, menu, styling and existing Home behavior.
No web changes, new tables, migrations, providers or paid services.

| Saved-address row | What opens | More than the root card |
| --- | --- | --- |
| Today: weather, air quality, alerts, daylight | Today, pushed inside Place for this saved-place ID | Existing weather detail and forecast, air-quality detail, alert information and daylight content, where supplied. |
| Risk: flood, seismic, wildfire; Health: lead/radon, drinking water, environment | Risk & readiness for this saved-place ID | Existing full summaries, source notes, qualifications/disclaimers and the available EPA facility list. Missing distance stays omitted; missing data is never treated as zero or safe. |
| Civic: districts and the ordinary election row, when present | Civic for this saved-place ID | Districts, available federal/state representatives and their existing contact links, local-government links and available election information. Coverage remains partial; no promise of city/county representatives. |
| Block and Money | Stay static, with no chevron | Keep their public cards and the existing **Set up this Home** action at the top; do not add another setup prompt. |

The separate Ballot card and its governments sheet keep their current actions
and flag. Only rows with a wired destination get a chevron. Error rows retain
their retry action; unavailable content keeps its explanation. The anonymous
and address-search preview keep their current navigation.

**Address binding.** Push the existing detail container with the selected
saved-place ID and group. Keep that address in the page header and use normal
Back to return to the same Place root. Do not switch to the Today tab or resolve
the newest saved place again: Today can choose a newer work/other address.

**Public content only.** Hide the emergency-plan checklist, fridge-card module
(including its locked teaser), block founders/invites, real-rent submission,
rate watch, Unlisted, Home records, pickup/calendar editors, household radon
tasks, verification prompts and Ask Pantopus about the Home. Do not instantiate
their loaders or send Home requests for a saved-place ID. Public county radon
information remains in Risk. Saving an address never grants Home access.

**Data choice: adapt the existing preview in the apps.** Today continues to
read `GET /api/saved-places/:id/today`. Risk and Civic read the existing owned
`GET /api/saved-places/:id/preview`, whose section envelopes already include
the extra summaries, disclaimers, facilities, districts and representatives.
Group the relevant Band-A envelopes into the existing `PlaceIntelligence`
presentation shape without fabricating Home membership, timestamps or missing
facts. Reuse the current account- and saved-place-scoped stores for immediate
display and refresh. Do not expand `/today` to fetch every public provider:
that would add work to every Today visit and couple its availability to unrelated
sections. No backend contract change is planned.

**Verification before merge.** On both the iOS simulator and Android emulator,
use a real local backend/database and synthetic saved-address and Home accounts.
Check all three destinations, the newer-work-address trap, Back, refresh,
provider error/unavailable states, offline first open and cached reopen,
relaunch, deletion/refusal, account switching and Home regressions. Record
actual results; no new unit tests. Merge only after real-app checks and green
CI. Hosted services and physical phones are not covered by local checks.

**Founder decision:** approved the recommended design and directed completion
of iOS and Android, verification against the local backend, and merge after
green CI, with no new unit tests.

## Implementation

Both apps push their existing detail container with the selected saved-place
ID. Today uses the existing saved-place Today endpoint; Risk and Civic adapt
only unlocked Band-A preview envelopes. Section status, source, coverage and
provider timestamps remain intact. Missing/unsupported preview sections show
an explicit empty state. The adapters do not invent a Home or a generated
server timestamp.

The saved root and details share an account- and address-scoped preview cache.
Transient refresh failures retain the last allowed copy with a notice;
403/404 clear rejected content. Saved Today preserves alert freshness rules.
Home-only controls and their loaders are excluded from saved-place pages,
while Home detail pages keep their existing content.

No web, backend contract, database schema or provider changes. No new unit
tests; the existing Android view-model test receives its added repository
dependency.

## Verification

Implementation and device verification are in progress. This document will
record the actual simulator/emulator results and CI before merge. Synthetic
accounts, credentials, raw logs, UI flows and screenshots remain outside Git.
