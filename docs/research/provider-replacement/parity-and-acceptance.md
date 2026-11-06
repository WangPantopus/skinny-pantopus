# Parity and acceptance: proving each replacement before anything switches

November 5, 2026. Proposed, not approved. For every service the code uses today
([current-system.md](current-system.md)), this says how the replacement is proven, against what truth, how big the
samples are, and how a switch is made and undone. It replaces #3418's parity plan and folds in #3433's service
objectives and sample design. The gates people feel (G1-G7) are in [experience.md](experience.md#the-same-or-better-release-gates).

## Principles

1. **Adjudicated truth, not agreement with today's decisions** (correction 4). Today's engine accepts a building
   without its unit (`D`/`N1`) and a never-checked address (blank DPV); matching it would copy those errors.
2. **Truth is independent of the vendors.** No ATTOM, Smarty or Google output serves as truth, as a mapping source or as
   training data. Vendor copies already stored stay out of every evaluation set.
3. **Hard cases count.** Denominators include misses, negatives, ambiguous, restricted and stale cases, not only clean
   matches.
4. **Report by stratum** (state, urban or rural, property type, address format) with 95% intervals; a cell too small
   for a percentage shows its count. A national average never hides the worst group.
5. **Exact-unit precision is the identity measure** (correction 3), with ambiguity and wrong-unit controls. The old
   "top-5 match ≥ 98%" target is retired: it scored lists, while the apps act on one answer.
6. **No made-up addresses go to Google.** Google's terms (section 1.2) stop USPS checks for an account that sends
   artificially-created US or Puerto Rico addresses and report it to USPS. Synthetic cases run only offline, through
   the parser and engine with recorded answer shapes; live checks use real addresses only.
7. **Real addresses stay out of Git.** Truth sets hold real homes, so they live in private storage (proposal P1) or on
   the evaluator's machine; only counts and rates are published.
8. **Every gate is also checked in the apps:** web in a browser, iOS in a simulator, Android in an emulator, against a
   real local backend and database, through reload and relaunch, and on the other person's view.

Evaluation tools are scripts that print reports (like the county survey's), not new unit tests (`AGENTS.md`).

## Truth sets

### T1. Postal truth (for the Smarty exit, gate G5)

Target about 1,000 real, adjudicated cases (#3433's "500-1,000 to find failure modes"), at most five per building:

| Category | Cases | Evidence for the true answer |
|---|---:|---|
| Deliverable single-unit homes | 300 | Redeemed Pantopus postcards; consenting people's own addresses |
| Multi-unit, correct unit | 150 | Redeemed cards to units; building managers' unit lists |
| Multi-unit, unit missing (expect `D` / `N1`) | 100 | The same buildings entered without a unit |
| Unit given but not confirmed (expect `S` / `CC`) | 75 | Real mistyped units from shadow traffic (WP3), kept privately for this evaluation |
| Never checked or not in USPS's file (blank DPV) | 75 | New construction, rural and territory addresses, confirmed by a person |
| PO boxes, PO-box-only ZIPs | 50 | Consenting people's boxes; post-office box sections |
| Mail-drop stores (CMRA) | 50 | Public business addresses of mail-drop stores |
| Businesses and mixed use | 100 | Public business addresses; mixed-use buildings with homes above shops |
| Vacant | 30 | Returned cards marked vacant; confirmed by a person |
| Puerto Rico urbanizaciones, military APO/FPO/DPO, rural routes | 70 | Consenting people; published USPS formats |

Each case gets one true outcome (deliverable, unit required, unit unconfirmed, undeliverable, PO box, CMRA, business,
mixed use, vacant, unknown), the evidence type and a reviewer; a disagreement takes a second reviewer.

**Offline fixtures** cover every code path the live set can't guarantee: DPV `Y`/`N`/`D`/`S`/absent × footnotes `N1`,
`C1`, `CC`, `M1`, `M3`, `P1`, `F1` × vacancy and CMRA `Y`/`N`/absent × home, business and PO-box flags
true/false/unset × each `addressRecordType` × `cassProcessed` false, plus timeouts, server errors and malformed answers.
These are recorded answer shapes, replayed through the adapter and engine; none is sent to Google.

**Passes when:** no `D`/`N1`, `S` or blank-DPV case reaches OK or auto-verifies a claim; every undeliverable, PO-box,
CMRA and business case in the set is refused or flagged as the truth says; agreement is reported per category with its
interval; the claim, create, unit re-check and Mailbox Check paths give the same answer for the same case.

### T2. Identity truth (for the address registry and property lookup, gate G3)

| Part | What it holds |
|---|---|
| Positives | Exact units and single-unit homes with independent proof (redeemed postcards, county unit records, managers' unit lists) |
| Adjacent-unit controls | Neighbors in the same building or stack, which must resolve to different subjects |
| Out-of-range units | Unit numbers that don't exist in the building, which must not match |
| Building-only cases | Rental towers whose units have no records, which must return `building_only` |
| Ambiguous keys | Addresses whose normalized key matches several parcels (69,070 such keys in Cook alone) |
| Lineage | Recent splits, merges and renumbering |

Sample design (#3433 plus #3418's review): a floor in every state and D.C. (at least 20 cases each), territories and
rare formats as separate cohorts, then oversampling of condos, rentals, new builds, rural routes, mixed use and true
negatives; holdouts by building, jurisdiction and release so nothing is tuned on its own test. "Untested", "missing
field", "stale", "unsupported" and "no match" are recorded as different outcomes; no go-live claim while any required
geography has only an unexamined blank.

**Passes when:** automatic unit links have precision ≥ 99.5% with a lower 95% bound ≥ 99.0% (about 1,000 linked
positives with at most two errors); wrong-unit acceptance stays under 0.1% on adjudicated invalid units (about 3,000
independent cases with zero errors give a one-sided 95% upper bound near 0.1%; repeated variants of one building don't
count as independent); abstention (`building_only`, `ambiguous`) is reported separately from errors; at least 95% of
independently confirmed residential premises in a jurisdiction resolve to the right building without staff help.

### T3. Field accuracy (for each connector, gate G1)

- **Per connector:** 50 homes per county and property type compared field by field with the county's own public
  lookup page by a person: codes mapped to the right words, units of measure right, no field lost, nothing of another
  subject's scope. A connector ships when every displayed field is right on the sample or is withheld.
- **Against ATTOM's fill, not its values:** on a stratified sample of addresses per county and type (about 200), count
  which fields ATTOM fills and which the record fills. **The trial ended November 4, 2026, so this comparison doesn't
  run:** G1 uses T3's adjudicated sample alone, and no ATTOM call or stored ATTOM copy enters any evaluation.
- **Freshness:** each release's age by source and county; a source past its expected cadence is flagged.

### T4. Values (only if an estimate ships, decision D9)

- Held-out recorded sales per county, time-separated (fit on sales before a date, test on sales after it), arm's-length
  sales only, at least 200 test sales per county and property type.
- Measures: median absolute percentage error, share within ±10%, bias, interval coverage (an 80% range should contain
  75-85% of sales).
- Proposed bar for showing an estimate in a market: median error ≤ 8% and coverage within 75-85%; elsewhere no
  estimate. The founder sets the bar.
- The FHFA trend line is checked for direction and rough size against county sale medians, and always labeled as an
  area index.

### T5. Mail (for the Lob decision, D5)

- **Test mode:** both verification flows and Block Founders end to end on each printer, with delivered, returned,
  re-routed and failed events, duplicates and late events; the code redeems on all three apps.
- **Real-mail pilot (the founder runs it):** about 50 cards to consenting recipients in at least 10 states, including
  rural, multi-unit and, if offered, Puerto Rico addresses, on each printer being qualified. Measured: accepted, mailed,
  days to delivery, returns, redemption, duplicates (must be zero), opt-outs honored, cost per verified household.

## Service objectives

Proposed by #3433; measured, not assumed:

| Objective | Target | How it is shown |
|---|---|---|
| Address search (warm server) | p95 ≤ 150 ms, p99 ≤ 400 ms; on a device p95 ≤ 350 ms on a named network, excluding debounce | Coasts, interior, Alaska, Hawaii and territories separately, on web and real phones; cold and warm at twice projected peak |
| Address resolve | p95 ≤ 300 ms | Covered and uncovered areas, multi-unit and rural cohorts |
| Stored property read | p95 ≤ 400 ms | Known fields render first; enrichment continues separately |
| Availability of eligible reads | ≥ 99.9% a month (about 43 minutes of errors) | Complete answers counted apart from partial and unknown ones |
| Recovery | A bad release rolled back within 30 minutes | Rehearsed: lost worker, bad import, expired postal data, storage outage, database restore |
| Mail | A durable pending state for queued work; external attempts bounded by deadlines | Acceptance, dispatch lag, delivery, returns and redemption measured apart from API latency |

## Per-vendor parity

### Smarty (WP3, then WP14)

| Service today | Replacement | Proof | Better than today |
|---|---|---|---|
| Deliverability (DPV) | Google `dpvConfirmation` and footnotes | T1 and the offline fixtures | `D`, `S` and blank read correctly; one call instead of two |
| Vacant, CMRA | Google `dpvVacant`, `dpvCmra`, absent = unknown | T1 | Unknown is no longer "no" |
| Home or business (RDI) | Google `metadata.residential` / `business`; unset follows D1b | T1, counting how often Google leaves it unset and how verdicts change | County land use later |
| Footnotes | Google `dpvFootnote` | Fixtures | Unit-required codes (`N1`, `C1`) used |
| PO box | `addressRecordType` `P`, `metadata.poBox`, route `B` | T1 | The route rule works again (today's field name never matches) |
| Unit lookup (off) | Registry units (WP6) | T2 | Units proven by redeemed postcards |

Switching back: the Smarty adapter stays in the code until WP14; with a key it can be turned on again by configuration.

### ATTOM (WP5-WP12, then WP15)

| Service today | Replacement | Proof per county and type | Better than today |
|---|---|---|---|
| Add Home prefill | The record; one-tap questions for what it lacks | G1, G2 (T3) | No vendor wait; residents confirm |
| Place "Your home" | Stored record copy; value facts | G1, G7 | Source and date on each fact |
| Property details | The record in the same groups | T3's 50-home check; G1 | Fixes ATTOM errors where the county is right (a Clark County sample home differed on baths, city and roof material); weekly freshness where counties publish weekly |
| Value estimate and range | Official values, sales, the FHFA index; an estimate only where T4 passes | T4 | Explains each number |
| ZIP sales trend | FHFA index, labeled; county sale medians where public | T4's trend check | Public and explainable; never "flat" by default |
| Exemption check | County exemption fields | Sample of homes with known exemptions | Straight from the county |
| Sky house | County footprint, FEMA structures | Visual check on all three apps | — |
| AI, Pulse, checklist | The same profile fields | Spot check on a sample | — |
| Owner match and parcel classification (both off) | Not replaced | — | Owner names stay out |

### Lob (WP13, then WP16)

| Service today | Replacement | Proof | Better than today |
|---|---|---|---|
| Verification postcards (two flows) | Lob per piece and a second qualified printer behind one interface | T5 | No single printer can stop verification |
| Block Founders cards | Same interface, with an idempotency key | T5, duplicates zero | No double mailing |
| Delivery events | Normalized ledger; returned and re-routed cards end the Home attempt | T5's events | The person learns at once and gets a next step |
| Cost per verification | Fewer cards (the proof ladder) | Cards per verified household, before and after | Lower mail cost |

## How a switch happens

1. **Shadow:** the replacement runs beside today's path for a county, type or flow and logs counts only.
2. **Compare:** the truth sets and gates for that scope; the results go to the founder with the plain-words plan.
3. **Switch** that scope with its flag after the founder's OK.
4. **Watch** two weeks: corrections and "report a problem" per 1,000 Homes, wrong-unit reports, support contacts,
   latency, errors.
5. **Undo** is one configuration change for that scope; stored Home copies keep working either way. Nothing switches
   back to a paid call automatically.

## Where the replacement can't match at first

- Places without free building files: 35.5% of Americans live where only lookup sites exist, 6.5% where the county sells
  its file, 2.3% one-city or unconfirmed. Households and labeled estimates fill in until files are requested or bought
  (decision D2).
- Bedrooms and baths where counties publish basics only (32.5%), until residents confirm them.
- Value estimates in states without public sale prices (TX, UT, ID, NM, KS, MO): official values and the area trend
  only.
- Deed, mortgage and lien history (not used today).

## Measures watched after each switch

Fill per field, county and type; the share of facts from the record, households, sheets and estimates; ATTOM calls per
day (must reach zero, including background and operator paths); Add Home and Property details p95; postal outcomes per
category; wrong-unit reports; cards per verified household; returns; corrections per 1,000 Homes.
