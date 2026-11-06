# Study files

The consolidated design and [46-field matrix](../property-fields.md) lead this package. The following files preserve earlier work so a reviewer can inspect the original reasoning or change the model assumptions.

| File | Use and vintage |
| --- | --- |
| [Provider replacement review (PDF)](provider-replacement-review.pdf) | Original 14-page review of the two supplied proposals, vendor roles, app flows, postal/fulfillment dependencies and initial national design. Predates the large eight-state test and the final backend/worker placement decision. |
| [Nationwide property sourcing plan (PDF)](nationwide-property-sourcing-plan.pdf) | Original six-page acquisition, field/asset and cost plan. Its market and timing assumptions are scenarios. |
| [Field sourcing design (XLSX)](field-sourcing-design.xlsx) | Exploratory mapping of the 46 screenshot fields and subject rules. Availability tiers describe expected sourcing routes. Use the later test for measured fill. |
| [Sourcing and cost model (XLSX)](sourcing-and-cost.xlsx) | Editable labor, infrastructure, traffic, API and bulk assumptions, scope and jurisdiction acquisition inventory. Its blank/unreviewed queue represents the initial planning baseline. |
| [Public-record field test (XLSX)](public-records-field-test.xlsx) | **Public edition.** Measured totals for 14,660,226 records, all 46 fields, per-source/subject results, exact-address experiment aggregates and extra usable fields. The public edition omits individual property identifiers, listing URLs and household-level examples. |

The founder’s original DOCX, PDF and screenshots were reviewed as design inputs (they stay outside this public repository with the address-level evidence); both studies' verdicts are summarized in the [package README](../README.md#the-founders-two-design-documents). No raw supplier data or unlicensed source dump is included.

**Superseded in these files** (they are kept as they were; the package's documents govern):
- The review PDF's recommendation to license a national bulk property baseline and a licensed postal processor, and the cost workbook's metered and bulk scenarios, are comparisons only: the founder chose no subscriptions and no paid ATTOM plan ([decisions.md](../decisions.md)).
- Its "top-five search recall" target is replaced by exact-unit precision and wrong-unit controls ([parity-and-acceptance.md](../parity-and-acceptance.md)).
- Any ATTOM bridge for uncovered counties is replaced by the county routing in [cost-and-rights.md](../cost-and-rights.md#7-the-attom-transition-county-by-county): no paid plan, no long-term bridge.
- Local schedules (Clark, week-by-week stages) are test fixtures and sizes, not a launch boundary or dates ([build-plan.md](../build-plan.md)).
