# Saved-address public details

October 20, 2026 · **Proposed; founder approval required before implementation.**

## Proposal for approval

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

**Decision requested:** approve these three destinations, static Block/Money,
the Home-only exclusions and app-side preview adaptation, or specify changes.

## Engineering handoff

### Verified starting point

- The requested worktree was clean on `claude/elated-shamir-1c5174` at
  `1aad10359`; it contained no saved proposal or implementation commits.
- Created `codex/saved-place-public-details` in that same worktree and rebased
  it onto freshly fetched master `7f4e931d5` (PR #2541 merged). Its conditional
  chevrons and nullable EPA-distance handling must be preserved.
- Open PRs were checked on October 20. None implements these saved-place
  destinations. Recheck before editing, especially #2535 (iOS Place launch
  lifecycle), #2496 (Today assistant context), and any later navigation work.
- This document is the only change. Approval, implementation, app verification
  and merge remain outstanding. A draft PR is not design approval or evidence
  that the feature works. Master CI was still pending at the initial check.

### Reuse map

- iOS: `Features/Place/Launch/SavedPlaceRootView.swift` renders
  `PlacePreviewContent` in `PlacePreviewBody.swift`; `previewSections` has no
  open callback. Extend that callback only at the saved-root caller. Reuse
  `PlaceDetailView`, `PlaceDetailViewModel`, `PlaceStoreReads`,
  `PlaceRiskDetailContent` and `PlaceCivicDetailContent`.
- iOS already carries `savedPlaceId` in the detail model for Today. Risk
  currently constructs a fridge-card model and always renders the checklist;
  gate both before enabling saved-place Risk. The existing Ask guard already
  excludes saved places.
- Android: `ui/screens/place/SavedPlaceRootScreen.kt` renders
  `PlacePreviewFindings` / `PreviewSections` in `launch/PlaceLaunchScreen.kt`.
  Add the saved-root callback and reuse the detail group layouts. Extend
  `detail/PlaceDetailViewModel.kt` and its copy loader to accept an explicit
  saved-place anchor; today they require a Home ID. Reuse
  `data/saved_places/SavedPlacesRepository.kt` and the saved-place Today path
  in `today/TodayTabViewModel.kt`. Do not reuse its newest-address selection.
- Backend reference only: ownership checks in `routes/savedPlaces.js` scope
  both endpoints to the caller. `routes/public.js:placePreviewWithBallot` and
  `services/placePreviewService.js` compose public preview envelopes;
  `services/placeIntelligenceService.js:composeSavedPlaceToday` returns only
  weather, air, alerts and daylight. No Home lookup is needed.

Keep the adapters small and adjacent to the existing DTO/store code. Carry
source, coverage, status and per-section `as_of` through unchanged. Never
render a failed refresh as a fresh successful read; preserve allowed cached
content with the existing stale/offline notice. A 403/404 or account change
must clear the rejected account/place copy. Guard unsupported preview responses
and old responses without `sections` rather than opening a blank page.

### Kickoff prompt after approval

> Resume in the existing `pulse-pi-ios-build-2ae310` worktree on
> `codex/saved-place-public-details`. Read this proposal and record the founder's
> actual approval or requested amendments before writing app code. Check Git,
> open PRs and CI, then rebase onto current master. Implement the approved
> saved-address Today, Risk and Civic navigation in both native apps using
> existing layouts and stores, with exact saved-place binding and no Home-only
> requests or modules. Leave web and backend contracts unchanged. Verify the
> full checklist above on a simulator and emulator against a real local stack,
> including a Home account. Write no new unit tests; run relevant existing
> checks. Update this PR's scope and validation to describe the implementation,
> merge only after green CI and real-app verification, and report the merged
> PR and any verification limits. Preserve unrelated work and keep secrets and
> local fixture/evidence files out of Git and chat.
