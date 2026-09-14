# Technical appendix: nationwide discovery and useful saved things

**Status: proposed architecture, September 8, 2026.** This appendix describes new implementation work. Repository references identify inspected source, not deployed behavior. The checkout was on `master` during drafting, with unrelated local files preserved. No application implementation, migration, provider enrollment, deployment or live account action was performed. Current remote PR/CI and release state were not reverified by this appendix and must not be inferred from historical handoff statements.

## 1. System boundary and nationwide promise

The backend should accept a location anywhere in the supported U.S. geography and resolve useful possibilities without a city whitelist, household membership, neighbor activity or a municipal partnership. National datasets establish a baseline; relevant local sources add specificity when discoverable. The product promise is a nationwide request path with honest source coverage, not identical information at every address.

Discovery and persistence are separate operations. A signed-out visitor can inspect public results. Saving requires an account and explicit intent. A saved address is a private location bookmark; it is not residency verification, ownership or permission to access a Home. User-provided files and personal records must not enter shared public caches.

Use PostgreSQL/PostGIS and the existing worker infrastructure initially. Avoid a separate graph database or an unrestricted autonomous browsing agent. Relations, spatial joins, versioned evidence and bounded extraction jobs are sufficient for the first implementation.

## 2. Location and source resolution

Create a `LocationContext` from a typed place/address, current coordinates or a saved location. Preserve input accuracy: a ZIP centroid cannot become an exact household location. Resolve country/territory, state, county-equivalent, incorporated place where applicable, timezone, optional tribal jurisdiction, and relevant service areas. Administrative jurisdiction and postal city are different fields. Unincorporated places must resolve through county and regional providers without requiring a city record.

| Scope | Matching rule | Example and qualification |
| --- | --- | --- |
| Local/place | Distance or verified service boundary | A market nearby; proximity does not prove delivery or eligibility. |
| County | County-equivalent identifier | County Extension office or public department. |
| Regional/service area | Published polygon or explicit served-area list | Water system, library district, regional utility; may cross counties. |
| State/territory | Administrative code | State agency, university service or statewide program directory. |
| National | Supported country/territory | A national service directory queried by distance or geography. |
| Online | Remote delivery plus explicit geographic restrictions | An online workshop accessible from this location; do not pretend it is nearby. |

The resolver evaluates these scopes together. A relevant online service may be more useful than a distant local office. “More local” is a ranking input, not automatic authority or precedence. Apply precedence only to truly substitutable facts, such as a system-sourced water boundary over a modeled candidate, while retaining disagreement evidence.

Use three acquisition paths:

1. **Known national indexes:** periodically ingest bulk files or query documented APIs, normalize IDs/geometries and build spatial indexes. Resolve location against this local store first. Shared observations are keyed by source record and geographic scope, not user.
2. **Known authority routing:** a national institution directory links to state and county organizations. Maintain verified parent/child authority links and their public domains. This is a registry of source organizations, not a whitelist of launch cities.
3. **On-demand source discovery:** for missing categories, search using jurisdiction names and service intent, identify likely responsible organizations, then inspect their actual pages. Search snippets nominate candidates; they are not evidence for a displayed fact. Reuse successfully validated sources for later visitors.

Detect documented platforms before generic extraction: ArcGIS feature/map services, Socrata catalogs, CKAN resources, RSS/Atom, iCalendar, structured JSON-LD, then HTML tables/text and PDFs. Platform adapters need domain, dataset ID, schema mapping and coverage metadata; they should not contain bespoke business logic for every municipality. Sources that require login, unsupported rendering or an agreement return an access state rather than triggering bypass attempts.

Set an interactive budget and return partial, useful results promptly; source discovery continues in a bounded background job. Initial targets, subject to measurement: cached first results within two seconds and a discovery pass within sixty seconds. Enforce maximum URLs, bytes, tokens and cost per pass. A timeout returns “not yet checked” for that category, never “nothing exists here.” Add a negative-cache expiry to avoid repeated expensive searches without freezing a rural location into a permanent empty state.

## 3. Evidence, freshness and coverage contracts

Implement normalized `Source`, `SourceObservation`, `Candidate` and `CoverageObservation` records. Keep schema and transformation versions so corrected parsers can reprocess stored evidence where retention rights permit.

| Record | Required fields and meaning |
| --- | --- |
| `Source` | Stable ID; publisher; authority relationship; canonical URL/domain; acquisition method; external dataset ID; scope/geometry; supported categories; attribution/license and storage restrictions; access status; expected cadence; adapter version. |
| `SourceObservation` | Source/native record ID; fetched time; published/updated time when actually supplied; effective start/end; source timezone; HTTP validators; normalized content hash; extraction version; evidence pointers; upstream status. |
| `Candidate` | Kind, title, proposed useful outcome, responsible organization, location/delivery mode, applicability expression, action URL/contact, date/price fields, evidence IDs, limitations, expiry, deduplication key. |
| `CoverageObservation` | Category and scope attempted; checked time; result state; source count; known limits; next retry; explanation suitable for the UI. |

Coverage states should distinguish `available`, `partial`, `not_checked`, `not_found_in_checked_sources`, `unsupported`, `temporarily_failed`, `requires_access`, and `stale`. An HTTP 200 is not proof of complete coverage. A directory count of zero is only zero in that directory. Record rural, tribal and territorial gaps explicitly.

Freshness uses multiple clocks. `fetched_at` means Pantopus checked the source; it does not refresh a five-year-old statistic. `source_updated_at` means the publisher changed a record. `effective_at` and `expires_at` describe applicability. A fetched page lacking dates may support a contact link but not a confident deadline. Recurring schedules need timezone, exceptions and an observation date; calendar expansion alone cannot establish that this year's event is happening.

Use field-level evidence: a normalized value points to a source record, JSON pointer, text span or PDF page and extraction confidence. Retain short excerpts or hashes where permitted, rather than indiscriminately copying whole websites. Track geographic confidence separately from extraction confidence and source authority. A perfectly parsed modeled polygon is still a modeled polygon.

Each displayed possibility needs a concrete next step, explanatory match and supporting evidence. Rank by applicability, actionability, freshness, user interest and novelty; use distance only when meaningful. Do not invent a numeric universal “truth score.” Suppress duplicate organizations and syndicated copies using canonical IDs, addresses and source relationships. Preserve conflicting authoritative dates as a conflict requiring confirmation.

## 4. Personal records and restricted sources

Introduce owner-scoped tables instead of adding nullable `home_id` branches throughout household APIs.

| Contract | Fields and behavior |
| --- | --- |
| `SavedItem` | `id`, `owner_user_id`, kind, user title/note, optional location, source reference, approved snapshot reference, captured version, state, created/updated times. Kinds include possibility, place, post, link, document and personal note. A save succeeds even if enrichment fails. |
| `Action` | Owner, optional saved item, kind, user-reviewed fields, due/start/end, timezone, recurrence, reminder preference, state and completion provenance. States distinguish suggested, ready, scheduled, done, dismissed and blocked. |
| `Watch` | Owner, saved item/source target, explicit predicate, baseline version, frequency, notification preference, last evaluation, last notified change, paused/deleted state and failure status. Saving does not silently authorize push notifications. |

Use database ownership policies plus API authorization for every read/write; service-role queries must apply explicit owner predicates. Add client request IDs and uniqueness constraints for retry-safe saves and action creation. A Home action remains a separate household record; copying a personal item into a Home is a reviewed destination action with household permissions, never an automatic conversion.

Public web sources may retain an attributed, permitted snapshot. Restricted Pantopus posts, household records and other access-controlled sources require different treatment: reauthorize source access on display, enrichment, refresh, notification construction and export. A bookmark must not become a permanent access bypass. On revocation, preserve the user's independently authored note and bookmark shell, redact restricted source-derived fields, stop dependent watches and show an unavailable-source state. Source deletion, cancellation, access revocation and temporary fetch failure are distinct events.

A reviewed personal calendar event may preserve user-entered commitments, while linked restricted descriptions remain governed by source permissions. Define this field provenance explicitly. Source updates propose a date change; they do not silently move a user's commitment. ICS export needs a stable UID and accurate timezone, but exporting a file does not prove a remote calendar was updated. Likewise, opening an application link is not applying, calling a number is not obtaining service, and saving a deadline is not delivering a reminder.

## 5. AI extraction and protected intake

Use AI for bounded interpretation: classify a source, extract structured fields, normalize a schedule, explain an already-supported match and propose an action. Deterministic rules own dates, geographic joins, unit conversions, expiry, permissions and eligibility predicates. Do not infer personal eligibility from an address or represent an area statistic as a parcel fact.

The extraction schema should require evidence IDs for each factual output, original date text, normalized date/timezone, missing fields, contradictions and confidence. Validate referenced evidence exists and actually contains the claimed value. Reject invented URLs, unsupported price/availability claims and ambiguous dates. An extraction model never publishes posts, enrolls users, submits applications, purchases items or modifies calendar commitments.

Treat all imported text, web pages, PDFs and metadata as untrusted content. They cannot override system instructions, request credentials or activate tools. The extraction worker receives only the relevant content and a strict schema, without account mutation tools. Keep model/prompt/schema versions and a labeled evaluation corpus; schema-valid JSON alone is not semantic accuracy.

Create a dedicated private intake route for pasted text, URLs, images and documents. Protected uploads use private object storage, opaque object IDs, short-lived authorized retrieval, MIME signature validation, malware scanning and bounded isolated document/OCR processing. Apply retention/deletion to originals, derivatives, extracted text and embeddings. Avoid sending unrelated private context to a model. Do not put signed URLs, document contents or typed addresses into ordinary logs.

A shared URL fetcher must enforce HTTP(S), public-network egress, DNS/IP validation at connect time and after redirects, private/reserved-address denial, redirect/byte/time limits, content-type checks and decompression limits. Run script rendering only in an isolated, credential-free worker when permitted and necessary. Respect source access restrictions and applicable reuse terms. Do not bypass logins, CAPTCHAs or blocked APIs. Failed fetches leave the saved original usable.

## 6. APIs, workers and change delivery

All names below are proposed, not existing deployed endpoints.

| API | Contract |
| --- | --- |
| `POST /api/discovery/resolve` | Location, optional interests/time horizon; returns context, candidates, category coverage and continuation token. Anonymous use is rate-limited. |
| `GET /api/discovery/runs/:id` | Owner/session-scoped progress and additional results; exposes no raw fetch logs. |
| `GET /api/discovery/items/:id/evidence` | Safe public evidence projection or authorized restricted projection. |
| `POST /api/personal/intakes` | Text, URL or authorized private object ID; creates a durable intake with explicit status. |
| `GET/POST/PATCH /api/personal/saved-items` | Owner-scoped retrieval, save and user edits; retry IDs and revision checks. |
| `POST /api/personal/actions` | Reviewable action creation; missing required fields return clarification state. |
| `POST/PATCH/DELETE /api/personal/watches` | Explicit watch configuration, pause and deletion. |
| `GET /api/personal/changes` | Durable changes with seen/dismissed state, independent of push delivery. |

Add jobs for source-index import, bounded source discovery, observation refresh, intake extraction, evidence validation, candidate materialization, watch evaluation, change delivery and retention cleanup. The first user in a geography can trigger discovery; subsequent users reuse public observations. Do not start one identical provider fetch for every watcher.

Use a single-flight key `(source_id, native_record_or_scope, requested_version)` for fetches, retry with jitter/backoff and respect provider rate limits. Poll cadence follows source volatility, official update cadence and active watches: hours for schedules where justified, days for directories, longer for published annual releases. Retain last-good observations with visible stale status; never label fallback data current.

Normalize before hashing so page chrome changes do not create alerts. Diff meaningful fields such as date, location, status, price or official instructions. Use a unique change key `(watch_id, observed_version, predicate_version, change_kind)` and transactional outbox for durable notification intent. Consumers remain idempotent because retries are expected. Recheck authorization and notification preferences immediately before delivery. A failed push leaves the durable change visible; duplicate jobs must not create duplicate user-visible changes.

## 7. Inspected code: reuse and missing contracts

References are repository-relative and include inspected one-based starting lines.

| Existing source | Reuse and required extension |
| --- | --- |
| `backend/services/placePreviewService.js:102` | Point-based public section composition without a Home; extend with opportunity/source resolution, not a Home requirement. |
| `backend/services/context/locationResolver.js:46` | Existing location preference handling is useful, but timezone inference uses broad geographic/longitude rules. Replace with maintained timezone boundary lookup and test DST/territorial cases. |
| `backend/services/ai/neighborhoodProfileService.js:117` | Census geography lookup; `:268` cached tract resolution and `:397` independent source composition. Preserve geographic vintages and add service-area relations. |
| `backend/services/context/contextCacheService.js:21` and `:119` | Provider/type/geohash caching and stale retrieval. Add source-record identity, validators, versions, rights and coverage observations. |
| `backend/serializers/placeIntelligenceSerializer.js:143` | Existing access/status/as-of/source/coverage envelope. Extend evidence and freshness semantics; static source labels are not provider validation. |
| `backend/services/placeSectionAdapters.js:384` | Existing water lookup uses county/city context. EPA polygons/PWSIDs support a stronger candidate-provider resolver with provenance. |
| `backend/routes/savedPlaces.js:7` and `:25` | Account-owned saved coordinates already exist. They are not the proposed universal SavedItem, Action or Watch contracts. |
| `backend/database/schema.sql:6240` and `:6856` | `HomeCalendarEvent` and `HomeTask` require `home_id`; preserve household ownership boundaries. |
| `backend/services/ai/agentService.js:745` | Authorized mail retrieval and strict JSON-schema output are useful patterns. General URL/PDF/OCR intake and evidence-grounded extraction remain new work. |
| `backend/routes/upload.js:1833` | Existing AI upload is image-only and documented as returning public URLs; unsuitable as the private-document intake contract. |
| `backend/worker.js:34`; `backend/jobs/pgBossJobs.js:19` | Separate workers, retries and singleton scheduling exist. Add source/item queues, outbox and per-change idempotency. |
| `backend/services/homeRecordWatchService.js:88` and `:182` | Narrow Home/PMMS baseline/watch evaluation pattern exists. General personal watches and source diffs do not follow automatically from it. |

## 8. Source catalog and access limits

These are documented acquisition candidates, not newly configured integrations. Confirm terms, working responses and operational budgets before implementation commitment.

| Source | Acquisition and useful output | Limit |
| --- | --- | --- |
| [Census geocoder](https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html) | Address/coordinate geography API and batches; county/state/tract routing. | Address-range geocodes are not rooftop certification; retain benchmark/vintage and input accuracy. |
| [NIFA Extension network](https://www.nifa.usda.gov/about-nifa/what-we-do/extension) and [institution directory](https://www.nifa.usda.gov/grants/land-grant-university-website-directory) | Route national → state institution → county office; local expertise, classes and testing instructions. | Website directories, no unified national content API verified; exact services and fees vary. |
| [EPA water areas](https://www.epa.gov/ground-water-and-drinking-water/public-water-system-service-areas?tab=map) and [REST service](https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/Water_System_Boundaries/FeatureServer) | National polygons and PWSIDs, V3 March 2026; candidate supplier and official information joins. | Mixed modeled/authoritative boundaries; private wells and some systems absent. Not a tap test or guaranteed supplier. |
| [HRSA site downloads](https://data.hrsa.gov/data/download?titleFilter=Health+Center) | Daily CSV/XLSX of health-center service-delivery/look-alike sites; nearby contact/directions. | No appointment, personal cost or service-availability guarantee; preserve suppressed shelter addresses. |
| [USDA Local Food Directories](https://www.ams.usda.gov/local-food-directories/farmersmarkets) | Officially advertised developer API; markets, published times, offerings and payments. | API documentation returned 403 during research; authentication/rate limits and live responses unverified. Check operator schedules. |
| [USDA Service Centers](https://www.farmers.gov/working-with-us/service-center-locator) | State/county website locator for FSA/NRCS/Rural Development contacts. | No public bulk/API access verified; identifies an office, not funding eligibility. |
| [USDA SNAP retailer locator](https://www.fns.usda.gov/snap/retailer-locator) | Downloadable coordinates/CSV for authorized retailers. | Select current authorization data; historical authorization is not current acceptance, hours or inventory. |
| [FEMA IPAWS developer information](https://www.fema.gov/ko/emergency-managers/practitioners/integrated-public-alert-warning-system/technology-developers) | CAP public alerts from the All Hazards Information Feed. | Approved access/agreement required; archived alerts cannot substitute for a live feed. |
| [CPSC recalls API](https://www.cpsc.gov/Recalls/CPSC-Recalls-Application-Program-Interface-API-Information) | Structured recall records to keep a saved product useful. | Needs reliable brand/model or identifiers, not location alone; no match is not a safety certification. |
| [OpenEI utility-rate database](https://data.openei.org/submissions/5) | Tariff records for a future saved-utility/bill workflow. | Supplier/plan/usage must be confirmed; an address alone cannot establish a bill or personalized savings. Record tariff dates. |
| [Socrata](https://dev.socrata.com/) and [CKAN](https://docs.ckan.org/en/2.11/api/) | Reusable catalog/resource adapters for discovered public datasets. | Platforms are access mechanisms, not coverage guarantees; each publisher's schema, freshness and terms differ. |

Keep existing weather/AQI, supported ATTOM and environmental/civic sources available under their current authorization and provider contracts. Add sources because they support a useful decision or next step. A broad catalog is not itself a successful discovery experience.

## 9. Dependency work packages and acceptance

| Package | Depends on | Acceptance evidence |
| --- | --- | --- |
| A. Nationwide location contract | Existing location/preview code | Geographic fixtures include rural unincorporated areas, county boundaries, Alaska/Hawaii, tribal/territorial cases and ambiguous ZIPs; no city gating; accurate timezone or explicit uncertainty. |
| B. Source registry and safe ingestion | A | At least one bulk index, API, authority directory and generic document path; field evidence, rights, failure states and reproducible normalization; hostile URL/document cases rejected. |
| C. Discovery and ranking | A, B | First-user cold runs and cached repeats across a nationwide stratified sample; useful linked outcomes where supported; truthful coverage where absent; measured latency/cost and no inferred eligibility. |
| D. Personal persistence/private intake | Ownership design | Save succeeds without a Home and survives failed enrichment; cross-account access denied; restricted revocation redacts derivatives; originals/derivatives delete correctly. |
| E. Actions and watches | B, D | Reviewed dates/timezones; DST/recurrence/cancellation cases; duplicate retries harmless; source edits propose changes; no invented completion or reminder-delivery claim. |
| F. Queue/delivery reliability | E | Concurrent refresh collapses; crash/retry/outbox cases preserve one change; preference and authorization rechecks; stale/recovery states visible. |
| G. Release validation | A–F | Exact builds/migrations/flags and rollback reviewed; current CI, staging provider contracts and released-platform journeys independently verified. This appendix supplies none of those release approvals. |

Measure evidence-supported useful discoveries, explicit saves, completed user-confirmed actions and voluntary returns. Track bad matches, expired suggestions, failed extraction, missing coverage and notification regret alongside conversion. A nationwide technical path and working queues are necessary infrastructure; demand and sustained usefulness still require observed user behavior.
