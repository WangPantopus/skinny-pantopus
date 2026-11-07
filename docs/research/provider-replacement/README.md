# Replacing ATTOM, Smarty and Lob: research, design and build plan

November 5, 2026; updated November 7. PR #3418, merged on the founder's OK. This package is the research, design and plan.
The build is under way ([HANDOFF.md](HANDOFF.md)), and nothing is decided beyond what [decisions.md](decisions.md) marks as
the founder's. This package merges PR #3418 (national coverage, sources, prices,
the ATTOM flow, unit floor plans) and PR #3433 (code audit, the 46-field test by property type, identity contract,
rights, costs, service objectives) into one plan. Code re-checked on master `ffd28e60a1`.

## The goal

The founder's direction (November 5): Pantopus runs its own address, property and mail systems, so it never pays
ATTOM, Smarty or Lob subscriptions, **nationwide from day one**, with a better experience, availability and reliability
than today. **Replace nothing until the replacement is fully built behind flags and proven;** then switch, one vendor
at a time. No paid ATTOM plan.

## The answer, vendor by vendor

| Vendor | Today | What Pantopus builds | What stays rented | Switches when | Work |
|---|---|---|---|---|---|
| **Smarty** | A mandatory second postal check after Google (up to 2.5 s more); no production key since Oct 9 | Reads the USPS answer Google already returns, completely and correctly | Google's per-request USPS answer (a USPS license later, if volume justifies it) | The postal truth set passes (gate G5) | WP3, WP14 |
| **ATTOM** | Three endpoints, five stored copies | A national address registry and property index from public records, household facts, floor-plan sheets, values from official records | Nothing | Per county and property type, when gates G1-G4, G6 and G7 pass; other counties show labeled partial results | WP5-WP12, WP15 |
| **Lob** | Prints and mails verification and invitation postcards, per piece | One mail interface: no double mailing, returned cards handled, a second printer | Printing and postage, per piece | The real-mail pilot passes; keeping Lob per piece is the founder's choice | WP13, WP16 |

USPS's delivery database can only be licensed, and printing and postage are always bought per piece; everything else
can be Pantopus's own. Details: [architecture.md](architecture.md).

## What the research found

- **Coverage.** 55.7% of Americans (range 52-61%) live where a county or state publishes building facts free in bulk;
  23.2% (21-27%) where those include bedrooms or baths. 35.5% live where only per-property lookup sites exist, 6.5%
  where the county sells its file ([sourcing.md](sourcing.md), [county-survey.md](county-survey.md)).
- **Fields.** Across 14,660,226 assessment records in eight states, public records filled 41 of Property details' 46
  fields somewhere (16.3 per record on average); the five never found are the ATTOM ID and the four value-estimate
  fields. Condo interiors depend on the county: bedrooms, baths and area together on 92.1% of Dallas condos, 95.6% in
  Boston, 14.2% in Cook ([property-fields.md](property-fields.md)).
- **Code** ([current-system.md](current-system.md)): a building without its unit (`D`/`N1`) or a never-checked address
  passes the address check and can auto-verify a claim; Google's adapter drops USPS footnotes and the home-or-business
  flags and reads two field names Google never sends; the iOS and Android apps in the stores reject unknown `source`
  values and say "ATTOM" in copy; returned postcards are ignored in the Home flow; Block Founders cards can be mailed
  twice after a timeout; the value card can show an assessed total as an estimate and a missing trend as "flat".
- **Terms** ([cost-and-rights.md](cost-and-rights.md)): Google allows keeping its results 30 days, deleting its
  coordinates after 30 days, and forbids sending made-up addresses.
- **Money.** The public-records route was modeled at $47,500 to build and $30,480 a year including labor, or about
  $5,400 of cash in year one if the founder supplies the labor, with no data fees.

## Decisions

The founder decided the goal, nationwide scope, no paid ATTOM plan, replace nothing until proven, the seven corrections
from the #3433 review, on November 6 D1, D2, D5 and P1 and the bar: really exceed these three services, and on November 7
landing built work first and D9. Open, with recommendations: D6-D8, D10-D12 and proposals P2-P5. All in [decisions.md](decisions.md).

## How to read this package

| Document | What it holds | Read it if you are |
|---|---|---|
| [decisions.md](decisions.md) | Founder decisions with dates, superseded statements, open decisions and proposals | Anyone, first |
| [current-system.md](current-system.md) | Every ATTOM, Smarty and Lob call site and consumer, file:line on master | Building any package |
| [sourcing.md](sourcing.md) | National coverage, uncovered counties and prices, field fill by property type, the data source catalog | Choosing sources |
| [county-survey.md](county-survey.md) | All 150 largest counties and the 100-county national sample | Checking a county |
| [property-fields.md](property-fields.md) | The 46 Property details fields, measured by property type | Mapping fields |
| [unit-facts.md](unit-facts.md) | Condo and apartment units: how listing sites get them, the floor-plan sheet design | Building unit facts |
| [architecture.md](architecture.md) | The pieces, data flow, identity contract, fact precedence, postal adapter, mail, reliability, privacy, app compatibility | Designing or reviewing |
| [experience.md](experience.md) | What each screen shows on web, iOS and Android, and the "same or better" gates G1-G7 | Building any screen change |
| [parity-and-acceptance.md](parity-and-acceptance.md) | Truth sets, exact-unit precision, service objectives, sample design, how a switch is made | Proving a package |
| [reliability.md](reliability.md) | Measured speed against the service objectives, and every failure row and drill with its result (November 7) | Checking an objective, or rerunning a drill |
| [build-plan.md](build-plan.md) | Work packages WP0-WP16 with files, switches, gates, checks, rollout and rollback | Building |
| [cost-and-rights.md](cost-and-rights.md) | Costs, prices, the rights register and Google retention plans | Anything that costs money or keeps data |
| [public-records-requests.md](public-records-requests.md) | Requests for the 41 large counties without a free file, prices found, and why not to scrape lookup sites | Sending requests or buying a file |
| [statewide-inventory.md](statewide-inventory.md) | Every state's and territory's statewide parcel, assessment and building-fact files, ranked by homes gained beyond storage | Adding statewide sources (WP7) |
| [other-routes.md](other-routes.md) | Records-law bulk copies, state tax departments, clearinghouses, federal sets, what changed for the 41 counties, bedrooms and baths | Choosing the next route |
| [lookup-sites.md](lookup-sites.md) | One-home reads of county lookup sites: platforms, terms, robots, law by state, cost, and a recommendation for D2 | Deciding D2's open question |
| [mail-pilot.md](mail-pilot.md) | The real-mail pilot for each printer | Running the pilot |
| [HANDOFF.md](HANDOFF.md) | Where the work stands and the next steps | Continuing this work |

Evidence and tools: [evidence/](evidence/README.md) (every CSV, with `verify.py`), [county-survey/](county-survey/README.md)
(the survey's scripts and inputs), [studies/](studies/README.md) (#3433's workbooks).

## Reproducing the numbers

```bash
python3 -I docs/research/provider-replacement/evidence/verify.py
```

```bash
python3 -I docs/research/provider-replacement/county-survey/tools/estimate.py docs/research/provider-replacement/county-survey/data
```

The first reconciles the field test (14,660,226 records, 39 cohorts, 46 fields, 417 files, 3,235 county-equivalents);
the second prints the national coverage estimate. Neither needs a network, a key or a database.

## The founder's two design documents

Both were reviewed by both studies (kept outside the repository). The infrastructure PDF ("Pantopus Address & Property
Infrastructure Research") is the engineering base: national search with stated limits, connectors, property subjects,
partial answers, field-level rights and evaluation. The Word memo ("Replacing Lob, Smarty and ATTOM") supplies the
guardrails: printing and postage, contract exits (Smarty's no-competing-dataset clause, Lob's terms), clean provenance,
protected addresses and cost discipline. Neither read the app: the memo assumes Lob address checks and Smarty
autocomplete (the app uses Mapbox and Lob only for mail), the PDF leaves out the printing Lob actually does, and both
start with a local pilot, which the founder's nationwide direction replaces (representative counties are test fixtures,
not a launch boundary).
