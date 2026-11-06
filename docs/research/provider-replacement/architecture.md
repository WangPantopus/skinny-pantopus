# Architecture for the nationwide replacement

**Decision.** Pantopus remains the single client-facing backend. Implement a source-neutral property lookup module in that codebase. Isolate bulk ingest, data storage and resource limits from the application’s interactive traffic and routine mail/reminder workers. Introduce a separately deployed HTTP service if a second product needs the API or measured read traffic requires independent scaling or deployment. This avoids a second synchronous authentication, network and availability dependency on each property lookup.

## Ownership and execution

| Component | Responsibility | Existing integration |
| --- | --- | --- |
| Clients and Pantopus API | Authenticate the caller, resolve the canonical Home/address, apply the existing viewer policy, then compose the permitted response. | Add Home suggestions, Home create, Place/Today and `GET /api/homes/:id/property-details`. Current Home-detail checks owner access before reading vendor facts. [Home detail](../../../backend/services/homeDetailService.js) |
| Property lookup module | Resolve an address to a unit, building, parcel or candidates. Read the active regional index. Return allowed observations, source, scope, currency and coverage reason. | Replace the data acquisition inside the existing property intelligence and suggestion services. Keep ownership verification and postal decisions as separate interfaces. [Property intelligence](../../../backend/services/ai/propertyIntelligenceService.js) · [Suggestions](../../../backend/services/ai/propertySuggestionsService.js) |
| Import and index worker | Schedule licensed feeds, acquire files, checkpoint, normalize, validate, publish or quarantine. Use a separately limited process/queue for heavy work. | Pantopus already runs a separate pg-boss/cron worker. Its scheduler can coordinate imports without executing large rebuilds alongside ordinary app jobs. [Worker](../../../backend/worker.js) · [Job registration](../../../backend/jobs/pgBossJobs.js) |
| Serving storage | Keep versioned, access-controlled source and index files outside the app’s household tables. Cache hot indexes on the read side. Use a dedicated store if load or rights require it. | The [Places index reader](../../../backend/services/plans/placesIndex.js) already uses a manifest and a last-good index. Reuse that pattern where appropriate. Keep existing Home, HomeAddress, household corrections and claims in their current protected systems. |
| Postal and fulfillment adapters | Obtain purpose-limited delivery evidence or submit an admitted physical piece and reconcile its receipt. Only Pantopus decides access. | Existing validation engine and mail-dispatch interfaces. Provider callbacks use a vendor-specific signature verifier. [Address pipeline](../../../backend/services/addressValidation/pipelineService.js) · [Mail dispatch](../../../backend/services/addressValidation/mailVendorService.js) |

Two paths run independently:

1. **Interactive read:** client → Pantopus permissions → property lookup → indexed release → filtered response. Add Home can return editable known fields immediately. A miss returns a specific reason. The user never waits for a county download while opening Property Details.
2. **Refresh:** source register → scheduled connector → private staging → mapping and quality checks → new immutable index → atomic manifest change. The next read uses that release. A failed refresh leaves the previous allowed release active and reports an operational error.

**Temporary ATTOM bridge.** The independent read path works with zero commercial calls. Where an existing agreement actually permits the transition, add an explicit per-county routing decision. A cleared county routes to Pantopus even when individual fields are sparse. An uncovered county may use the authorized bridge within its request budget, display and retention rules. Keep vendor responses in a separate expiring store. If no fresh licensed record is usable, render known facts immediately and only request/refresh in the manner the agreement permits. An outage or miss cannot silently reactivate billing. [Routing and retirement criteria](delivery-and-cost.md#county-by-county-attom-transition)

## Subjects, IDs and evidence

- Give Pantopus **independent, namespaced IDs** for an address, legal parcel, building, unit, condo interest, postal delivery point and assessment account as appropriate. Preserve `HomeAddress` as the app’s canonical user-facing address and `Home` as a private household resource. A property can exist before any Home is created. The registry must never manufacture a household from a public parcel.
- Store links with relationship type, effective interval, evidence and confidence. One parcel can hold several buildings. One building can cross parcels. A condo regime may have a common parcel plus distinct legal units and parking interests. A leased office suite may have only a parent building. A taxable account or local unit suffix is meaningful only in its jurisdiction and roll.
- Normalize directional prefixes, suffixes, units, aliases and ZIP while retaining the publisher’s spelling. Preserve leading zeros and full secondary designators. Do not derive unit numbers from the last digits of an assessor ID. Treat replatting, subdivisions, demolished buildings, unit renumbering and merged/split parcels as lineage events. A new economic or legal interest gets a new identity and a link to its predecessor.
- Each fact needs an explicit subject, field definition, value, unit of measure, source edition, source/as-of date, import date, entitlement, and fact status. Keep official observations, household corrections, manager-supplied data and model estimates separately attributable. Multiple copies of the same upstream roll count as one source family.
- Keep assessments, sales, rents, AVMs and neighborhood statistics distinct. An assessor land/building total can be shown with fiscal year. An individually deeded unit can have its own record. An office rent roll, room count for a leased apartment or portfolio valuation requires separate evidence. Household-entered corrections can serve their authorized audience without changing the public source of record.

These are logical entities and relationships. Reuse existing HomeAddress, Home, verification, cache and workflow primitives before designing database changes. A proposed new application table or hosted change requires the repository’s separate approval process. [Repository guide](../../../AGENTS.md)

## Match contract and user behavior

| Result | Server behavior | What the user sees |
| --- | --- | --- |
| Exact unit or exact single-property match | One supported account at the requested scope with sufficient identity evidence. Retain source/field-level quality separately. | Available facts and dates. An exact identity can still have unknown bedrooms or area. |
| Building or parcel only | Sufficient parent-level evidence, no supported child match. | Building or parcel facts labeled at their true scope. Prompt for a unit or allow private manual entry. A complex’s average unit area stays a building statistic. |
| Ambiguous | Multiple plausible interests, condo and parking, conflicting sources, or equally plausible units. | Ask for the missing unit/correction. Present only allowed, non-personal disambiguators. Never select the first candidate just to fill a screen. |
| Unsupported, incomplete, restricted or stale | Return a reason and source vintage where allowed. Serve dated last-known data only while its rights and freshness policy permit it. Use separate statuses for “unknown,” “inapplicable,” “restricted” and source outage. | Immediate partial screen or manual entry; household tools continue at the user’s authorized tier. An unavailable source cannot start paid fallback or grant household access. |

Illustrative **internal** return shape, using synthetic values. Adapt this inside the existing authorized route. The legacy clients continue receiving the shape they understand. Add new optional provenance/availability fields and stage updated clients before changing vendor-labeled copy.

```json
{
  "match": "building_only",
  "subject": {"kind": "building", "id": "demo-building"},
  "requested_subject": "unit",
  "release": "example-region-r2",
  "facts": [
    {"field": "building_count", "value": 2, "unit": "count", "scope": "parcel", "subject_id": "demo-parcel",
     "source": "Example assessment roll", "as_of": "2026-01-01", "status": "reported"}
  ],
  "unavailable": [{"field": "unit_living_area", "reason": "unit_record_missing"}]
}
```

For a condo lookup the county may confirm the exact unit and its build year while omitting interior details. For a managed rental, an authorized property-manager feed can establish the actual unit and effective floor plan. A model layout without a unit-to-plan mapping stays at the layout/building level. Unit existence, postal deliverability and household membership each have different requirements.

## Publication, reliability and rights

1. **Register before ingest.** Identify publisher, upstream origin, terms edition, license/fee, permitted uses (internal, consumer display, storage, transformation, export), refresh/expiry, required attribution and deletion/suppression duties. An unauthenticated download authorizes the observed technical test only. Default unresolved production entitlements to withheld.
2. **Checkpoint each jurisdiction and roll.** Hash the acquired file, enforce allowed fields, normalize independently, compare against its prior release, and reject incomplete archives, schema drift, disappearing IDs, implausible row counts or excessive ambiguous matches. Make repeated imports idempotent. Schedule by the publisher’s cadence. Retain a raw file only where permitted.
3. **Publish atomically.** A release records source versions, checksums, match-rule and mapping versions, coverage by class/field, and the previous snapshot. Publish all shards before the manifest pointer moves. Serving nodes validate the new release and can roll back per jurisdiction. Throttle concurrent fetches, CPU, memory and database connections. Size and monitor national storage independently of the private household database.
4. **Cache by subject, version and permitted use.** Store common public facts separately from an authorized Home response. Respect private/no-store response semantics. Bound negative caching and retry budgets. A release change invalidates stale misses. Do not serve a stale value after source withdrawal, rights expiration or a protected-address removal.
5. **Keep the clean source independent.** Existing vendor blobs, trial samples, client-submitted vendor data and restricted postal/Google responses stay outside the public index, training sets and provenance benchmarks. Plan contract-specific expiry for raw/derived copies, caches, exports, logs and backups. Audit legacy data separately with the founder. [Existing persistence inventory](../../provider-data-persistence-2026-11-01.md) · [ATTOM terms](https://api.developer.attomdata.com/legal) · [Google policies](https://developers.google.com/maps/documentation/address-validation/policies)
6. **Protect people and destinations.** Keep names, claim evidence, mail codes and private corrections outside the shared lookup. Apply suppression to search, detail, dispatch, replicas and restored backups, including substitute/confidential addresses. A withdrawal or recipient opt-out must take effect across versions. Avoid public raw shards and address-bearing logs. Limit search enumeration and default to the existing Home permissions.
7. **Monitor the user outcome.** Report exact-unit precision, ambiguity, match/field fill, age by source and jurisdiction, useful partial answers, lookup latency/error rate, publish failures/lag and restoration time. For postal and mail also measure invalid units, unanswered checks, duplicate submissions, unmatched callbacks, returns, code redemption and duplicate grants. [Targets and rollout gates](delivery-and-cost.md)

Start with read-only, rights-cleared data and a feature flag per capability. Establish national coverage in the register while incrementally publishing qualified sources. A new public service/API, the final database shape and hosting capacity are implementation decisions that remain open until the measurements justify them.
