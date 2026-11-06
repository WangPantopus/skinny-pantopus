# Experience: what people see on web, iOS and Android, and the "same or better" gates

November 5, 2026. Proposed; nothing here is built or approved. The screens keep their layouts, styling and navigation
(`AGENTS.md`); what changes is what blocks a person, what the screens say when evidence is missing, and where each
fact comes from. Founder direction that shapes every screen (November 5): people **confirm looked-up facts instead of
typing them**, and a refresh **never shows less than before** ("better to show something than nothing").

Success means what people keep (correction 1 from the #3433 review): if Add Home now asks for a fact that ATTOM used to
prefill, that is a regression, not parity.

## The screens

File paths are on master `ffd28e60a1`; each work package in [build-plan.md](build-plan.md) lists the files it touches.

### Add Home: the address step

Web `app/(site)/(app)/app/homes/new/page.tsx`; iOS `Features/Homes/AddHome/AddHomeWizardView.swift` and
`AddHomeWizardViewModel.swift`; Android `ui/screens/homes/add_home/AddHomeWizardScreen.kt` and
`AddHomeWizardViewModel.kt`.

| Situation | Today | After the postal adapter (WP3) |
|---|---|---|
| A normal house | Google, then Smarty: up to 5 s of checks | One Google check, up to 2.5 s; same result |
| A building needing a unit (`D` or `N1`) | Often accepted without the unit (OK at 0.85; a claim can auto-verify) | "This building needs a unit number. Which one is yours?" The typed text is kept; nothing is mailed until a unit is given |
| A unit USPS doesn't know (`S`) | "Missing unit", which reads wrong to someone who typed one | "We couldn't confirm unit 4B with USPS. Check the number, or continue and we'll confirm it by mail" (the continue path waits on D1a's rule) |
| USPS gave no answer (blank DPV) | Accepted at 0.75 | "We couldn't check this address with USPS yet." Pending, never OK; a background re-check |
| PO box, mail-drop store, business, mixed use, vacant | Refused or flagged as today | The same refusals, with Google's own PO-box and business flags instead of Smarty's |
| Google is down | "Address verification is temporarily unavailable" unless a recent check exists | Decision D1a: finish Add Home with the home unverified; no postcard and nothing unlocked until a background re-check passes; if it fails, "Please check this address" |
| No address keys in production (today since Oct 9) | New addresses can't be checked there | Only a Google key is needed (the founder adds it) |

### Add Home: "Tell us about your home"

Web, same page; iOS `AddHomeDetailsSection.swift`; Android `AddHomeDetailsSection.kt`.

| | Today | After |
|---|---|---|
| Opening the step | Waits for property suggestions (ATTOM up to 10 s) | Opens at once. Facts the record has are filled in; while a lookup finishes, the empty fields say "Looking up public records…" and fill in by themselves (the #3439 pattern) |
| Where facts come from | "Public records (ATTOM)" / "Data from public records via ATTOM." | One line under the fields: "From Clark County Assessor's records, updated Oct 31, 2026", and a small source tag per field ("County", "Your entry") |
| A fact the record lacks | Address hints or a blank field to type | One-tap questions for only the missing facts ("Bedrooms? 2 · 3 · 4 · Other"), prefilled from the floor-plan sheet for an apartment when one exists |
| A condo or apartment | ATTOM's building-level numbers can fill a unit's fields | Unit facts only for the exact unit; otherwise "We found the building. Your unit's details weren't in the county record" and the one-tap questions |
| Typed values | Kept (iOS "Prefill only") | Kept everywhere; a late result never changes a touched field; before the Home is created, filled-in fields get a short "Review what we found" |
| No record at all | "No ATTOM property record was available…" | "We couldn't find public records for this address. Tell us the basics; you can change them anytime" |
| Store builds not yet updated | — | Keep working; they show their generic "Public records" wording, and the fields still prefill (section "Old store builds") |

### Place: "Your home"

Web `components/place/detail/YourHomeDetail.tsx`; iOS `Features/Place/Detail/PlaceHomeDetailContent.swift`; Android
`ui/screens/place/detail/PlaceHomeDetailContent.kt`. Roles stay as today: owners see value and the exemption check,
renters see rent sections, guests see neither.

- Opens at once from the Home's stored copy (master waits up to 3.5 s and then shows "Couldn't load this").
- Facts carry a source line ("County record, updated Oct 31, 2026"); household-filled facts say so.
- A building-only match shows the building's facts, labeled, and "Add your unit to see your home's own details".
- The value block is never empty when the county has any value ([architecture.md](architecture.md#8-the-value-card-is-never-empty-and-an-estimate-shows-only-where-measured)):
  county market and assessed values with the tax year, the last recorded sale (or "Sale prices aren't public in Texas"),
  the area's price trend from the FHFA index, and a Pantopus estimate only where its error has been measured.

### Property details (verified owners)

Web `app/(site)/(app)/app/homes/[id]/property-details/page.tsx`; iOS `Features/Homes/PropertyDetails/`; Android
`ui/screens/homes/property_details/`.

- The same groups as today: Building, Construction, Heating and cooling, Parking, Lot, Parcel and records, Value.
- Every row from the record for the matched subject, with its source; the footer names the publisher and date ("From
  Clark County Assessor's weekly file · updated Oct 31, 2026") instead of "via ATTOM".
- Condos and apartments get a "Your unit" group and a "Building" group; building figures never appear as the unit's.
- "Is this right?" on each group: a correction shows as the household's value with the county value underneath.
  Parcel identity and tax figures accept only "Report a problem", which goes to review.
- Rows the record doesn't hold are left out, as today; the owner can add the household's own values.
- The Pantopus ID replaces the "ATTOM ID" row.

### Home value card

Web `components/home/PropertyValueCard.tsx`; iOS `Features/Homes/HomeDashboardView.swift`; Android
`ui/screens/homes/HomeDashboardScreen.kt`; server `GET /api/homes/:id/property-value`. Same content as Place's value
block. Old builds keep receiving today's field names and allowed `source` values (a record-based profile is
`source: cache`), so their card stays visible.

### Today's sky house

iOS `Features/Place/Detail/TodaySkyHouse.swift`; Android `ui/screens/place/detail/TodaySkyHouse.kt`; server
`services/place/houseShape.js`. The outline comes from county building facts, then FEMA's building footprints, then the
plain house. Nothing new to see.

### Exemption check (owners)

Straight from the county's exemption fields. "No exemption on record" and "The county's file doesn't say" stay
different answers.

### Mailbox Check

Web `components/place/detail/IdentityDetail.tsx`; iOS `Features/Place/Detail/PlaceIdentityDetailContent.swift`;
Android `ui/screens/place/detail/PlaceIdentityDetailContent.kt`. Findings keep their wording today (they already read
`D` and `S` correctly); each says when USPS was last checked, and a check older than 30 days runs again when the screen
opens (Google's 30-day limit).

### Postcards

iOS `Features/Homes/VerifyLandlord/Postcard/`; Android `ui/screens/homes/verify_landlord/postcard/`; web Home
verification pages.

| | Today | After WP13 |
|---|---|---|
| A card comes back undeliverable | Home flow: the request keeps waiting until the code expires | "Your postcard came back undeliverable. Check the address and send another, or verify another way" |
| A send times out | Verification cards retry with a key; a Block Founders invite can be mailed twice | Every send shows "Sending…" until the printer confirms; nothing is mailed twice |
| Lob is down | Nothing can be mailed | A second printer takes new cards once qualified; cards already accepted finish with the first |

### Pulse, AI answers and the seasonal checklist

They read the same profile fields, so they inherit the record's facts and labels; nothing new to see.

## When something fails

| What fails | What people see | What they can do |
|---|---|---|
| Google (address check) | D1a's rule: Add Home finishes unverified | Everything except mail proof and unlocked features; a background re-check |
| Index storage | Stored Home copies keep every screen working; a new address's fields say "Looking up…" | Continue; fields fill in when storage returns |
| A bad import | Nothing: the previous release keeps serving | — |
| A county withdraws a file or a license lapses | Those facts disappear with "The county no longer publishes this" | Household entries stay |
| The printer | "We'll mail your card as soon as we can" with the request saved | Wait, or another proof method |
| No record anywhere | Labeled estimates in their own slot and one-tap questions | Enter the basics; change them anytime |

## Old store builds

Builds already in the stores keep working through the whole switch ([architecture.md](architecture.md#15-compatibility-with-the-apps-in-the-stores)):
the server answers them in today's vocabulary and never labels county data "ATTOM". What they show differently: the
Add Home card reads "Public records" with generic wording instead of "Public records (ATTOM)". New builds that ship
first (WP2) show the real source.

## The "same or better" release gates

No vendor is switched off in a county, for a property type or for a flow until every gate that applies has passed on
measured results. Methods and sample sizes: [parity-and-acceptance.md](parity-and-acceptance.md).

| # | Gate | Measured as | Passes when |
|---|---|---|---|
| G1 | Property details stay useful | Field fill per county and property type on the record, against ATTOM's fill on the same addresses (live trial calls for internal evaluation only, kept at most 24 hours, counts kept) | Every field ATTOM filled is filled at least as often, or the gap is covered by G2's one-tap questions and the founder accepts it |
| G2 | Add Home asks nothing new | For each county and type, the facts a person must enter that ATTOM prefilled at comparable addresses | Zero new typed facts; a one-tap confirmation of a looked-up value doesn't count as typing |
| G3 | Exact units | Precision of automatic unit links; wrong-unit rate on adjudicated invalid units | Precision ≥ 99.5% (with its interval); wrong-unit < 0.1% on about 3,000 invalid cases; no unit shows building figures |
| G4 | Measured speed | p95 for address resolve, property read and Add Home's details step on web and real devices | Within the service objectives and never slower than today's measured p95 |
| G5 | Dependable verification | Postal decisions against the adjudicated postal truth set | No `D`/`N1`, `S` or blank DPV reaches OK; every UNDELIVERABLE, PO_BOX, CMRA and business case in the set refused; agreement shown per category |
| G6 | Recoverable failures | Fault drills for each row of "When something fails" on all three apps | Every failure has a next step; nothing typed is lost on reload or relaunch; the other household member's view is right |
| G7 | The value card is never empty | Share of owner Homes with any official value whose card shows one | 100% where the county has a value; an estimate appears only in measured markets |

Each gate is checked by using the apps (web in a browser, iOS in a simulator, Android in an emulator) against a real
local backend and database, persisting through reload and relaunch, and on the other person's view where there is one.
What can't be checked that way (hosted services, physical phones, live mail, live billing) is named in each work
package.

## Copy, proposed

Plain words, inside the existing design language. Final wording goes to the founder with each work package's plan.

| Where | Text |
|---|---|
| Fields while a lookup runs | "Looking up public records…" |
| Source line | "From <publisher>'s records, updated <date>" |
| Household value | "From your household" with "County record: <value>" underneath |
| Building only | "We found the building. Which unit is yours?" |
| No record | "We couldn't find public records for this address. Tell us the basics; you can change them anytime." |
| Estimate slot | "Estimate for similar homes nearby" (never in a record field) |
| Sales not public | "Sale prices aren't public in <state>." |
| Area trend | "Prices in this ZIP rose <x>% last year (FHFA House Price Index)." |
| Unit required | "This building needs a unit number. Which one is yours?" |
| Unit not confirmed | "We couldn't confirm unit <unit> with USPS. Check the number, or continue and we'll confirm it by mail." |
| Postal pending | "We couldn't check this address with USPS yet. We'll try again shortly." |
| Card returned | "Your postcard came back undeliverable. Check the address and send another, or verify another way." |
