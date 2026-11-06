# Replacing ATTOM, Smarty and Lob nationwide

**Recommendation, November 5, 2026.** Build the address and property lookup inside the Pantopus backend. Give nationwide imports a separate worker and a versioned index. Keep ATTOM spending at $0. Qualify a permitted postal check and physical mail fulfillment separately. Those two capabilities have different costs and evidence requirements from a property lookup.

This is a design, code audit and measured sourcing study. The field experiment ran on existing equipment. No application cutover, vendor cancellation, schema migration or production rights approval was performed. The code baseline for this edition is [master at e49cb33a6a](https://github.com/WangPantopus/skinny-pantopus/tree/e49cb33a6a9281bf19aa9e1dfd5c0dec10a02c25).

All three named subscriptions can in principle be retired independently once their exit gates pass. Universal 46-field parity across every U.S. property has no defensible source guarantee. Actual postcards still require production and postage, and authoritative postal evidence still requires approved access.

## The decision by service

| Service | What Pantopus needs | What we can own | What still needs supply or independent proof |
| --- | --- | --- | --- |
| ATTOM | Property and parcel characteristics, owner-visible county records, property valuation and ZIP sales trends. Other flows consume selected fields and optional ownership evidence. | Nationwide lookup, local-ID mapping, public-source ingestion, provenance, household corrections, cached reads, coverage reporting. | Field availability varies by jurisdiction and property type. Exact vendor IDs and model outputs belong to the vendor. Unit inventories, sales, ownership evidence and validated valuations can require separate rights or a different product decision. |
| Smarty | Postal deliverability and secondary-address signals in Add Home, claims and Mailbox Check. Some extra unit lookup is gated. | Address normalization, candidate ranking, exact unit matching, decisions, correction and recovery UX, independent unit evidence. | Current authoritative postal evidence requires an approved source for that use. A county address or geocoder match cannot attest to mail delivery. |
| Lob | Physical production and mailing of verification cards and Block Founders invitations, plus tracking callbacks. | Templates, admission, codes, retries, suppression, recipient opt-outs, dispatch reconciliation and permissions. | A printer/mail house or an operated print-and-post process, postage, and a way to reconcile production and delivery outcomes. Real pieces have a per-piece cost. |

**Nationwide** covers the 50 states and D.C. with separately tracked Puerto Rico, Guam, the U.S. Virgin Islands, American Samoa and the Northern Mariana Islands. Military, rural-route, PO-box and general-delivery destinations need their own behavior. Every location gets a lookup or recovery path. A location earns a coverage claim only after its source, field, property type and display rights pass review.

## ATTOM during the transition

Two directions matter together. The founder reported $0 current ATTOM subscription spend and wants to avoid starting one. A [later handoff in the parallel research PR](https://github.com/WangPantopus/skinny-pantopus/blob/5d514f94d45c46575ec978ccd43d1213685bc71d/docs/research/HANDOFF-replace-attom-lob-smarty.md) records a preference to keep ATTOM available during migration **only for counties Pantopus has not yet covered**. Preserve that conditional routing option. Default to independent records and $0 new spend. Enable the bridge only under an existing, confirmed authorization covering the exact use. Without it, return a labeled partial result. Stop calls county by county as sources qualify. ATTOM commercial cancellation, if applicable, is national and requires a separate founder decision. [Bridge, budget and exit gates](delivery-and-cost.md#county-by-county-attom-transition)

## What the free test established

Across eight states and 39 property-type/source groups, **14,660,226 distinct assessment accounts, tax lots or parcels** qualified. **41 of the 46** screenshot fields had a usable direct, derived or explicitly qualified result somewhere. The mean was **16.3 fields per record**. The missing five were the ATTOM ID and the four automated valuation fields. Florida supplied all 67 county rolls. Massachusetts supplied 350 municipal extracts plus Boston’s separate assessment layer. The other tests covered Los Angeles, Cook, Dallas, King, New York City and Philadelphia.

| Subject | Distinct records | Mean fields of 46 |
| --- | ---: | ---: |
| House | 11,245,408 | 17.0 |
| Townhouse or rowhouse | 460,040 | 20.2 |
| Residential condo | 2,685,854 | 12.9 |
| Apartment building or complex | 166,891 | 14.9 |
| Office property | 102,033 | 15.5 |

This deliberately selected sample measures field presence under documented rules. A single apartment property may contain hundreds of homes. Source presence alone establishes neither correctness nor nationwide availability. [Field results and scoring rules](property-fields.md) · [Nationwide sourcing and experiments](nationwide-sourcing.md)

## Which original design wins?

Use the **infrastructure PDF** as the engineering base. It handles different property subjects, jurisdiction connectors, time, rights, partial answers and evaluation. Its mail scope omits the printing and delivery that Pantopus actually buys. Use the **Word memo** for physical fulfillment, protected addresses, contract exit, independent source families, competing-dataset concerns, clean provenance and operating cost. Its baseline assumes Lob address checks and Smarty typeahead. The application uses other providers for those jobs. Both proposed local ramp-ups yield to the nationwide requirement. Representative counties are test fixtures, not a geographic launch boundary.

The combined design adds three things neither proposal proved: a field-by-field audit against the actual application, a no-fee multistate experiment, and a clear boundary between app authorization, postal evidence and shared property facts. Primary documents are titled *Pantopus Address & Property Infrastructure Research* and *Replacing Lob, Smarty and ATTOM*. Their recommendations are inputs to this design. [Original comparison and code review](studies/provider-replacement-review.pdf)

## Use the package

| Reader or decision | Document |
| --- | --- |
| What each vendor supplies, which route/feature uses it, and what can replace it | [Application and vendor contracts](application-contracts.md) |
| Public versus licensed inputs, nationwide acquisition order, how exact-unit lookup works, and how to interpret the trial | [Nationwide sourcing](nationwide-sourcing.md) |
| Every screenshot row, its ATTOM field and the measured fill by property type | [46-field matrix](property-fields.md) |
| Backend placement, request/response contract, data model, rights, imports, serving, privacy and failure behavior | [Architecture](architecture.md) |
| Postal and printer migration, guarded rollout, costs and acceptance criteria before any subscription exit | [Delivery and economics](delivery-and-cost.md) |
| Audit or reproduce the counts, find a jurisdiction, inspect the wider ATTOM display fields | [Evidence file guide](evidence/README.md) |
| Presentation copies and editable planning models | [Study files](studies/README.md) |

A separate [county-source survey in PR #3418](https://github.com/WangPantopus/skinny-pantopus/pull/3418) classifies acquisition routes and estimates the share of people living in areas with a source. Its population estimates use a different denominator from the assessment-record counts here. This package stands on its own and leaves that branch under its author’s control.
