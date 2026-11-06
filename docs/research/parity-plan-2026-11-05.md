# Parity plan: proving each replacement matches or beats ATTOM, Lob and Smarty

November 5, 2026. Proposed, not approved. For every service the code uses today (inventory in section 1 of
[replace-attom-lob-smarty-2026-11-05.md](replace-attom-lob-smarty-2026-11-05.md)), this lists the replacement, how
parity is proven before switching, what would make it better, and how to switch back. Verification follows
`AGENTS.md`: real web, iOS and Android apps against a real local backend; no new unit tests.

## Smarty (Phase 1)

| Service today | Replacement | Proof before switching | Better than today |
|---|---|---|---|
| USPS deliverability (DPV match code) | Google's USPS answer (`dpvConfirmation`) | Replay a golden set through the decision engine with Google only: redeemed postcards (deliverable), returned postcards (undeliverable), known vacant addresses, known mail-drop stores, and stored addresses that carry Smarty's answers. Same verdict on at least 99%; every disagreement reviewed | One call instead of two (up to 2.5 s less in Add Home) |
| Vacant flag | Google `dpvVacant` | Same replay | — |
| Mail-drop store (CMRA) | Google `dpvCmra` | Same replay; no disagreements allowed | — |
| Home or business (RDI) | Google's `metadata.residential/business`; when blank, place and parcel types (rule already used for Smarty's "unknown"; needs the founder's yes) | Same replay, counting how often Google leaves it blank and how the verdict changes | County land use and NSI occupancy added later |
| DPV footnotes | Google's footnotes | Same replay | — |
| Unit lookup (off by default) | National address record units (Phase 2) | Unit match on a golden set of multi-unit buildings | Units proven by redeemed postcards |

Switch back: the Smarty provider stays in the code until Phase 1 has run cleanly; with a key it can be turned on again.

## Lob (Phase 5)

| Service today | Replacement | Proof before switching | Better than today |
|---|---|---|---|
| Verification postcards (two flows) | Lob per piece (kept, no subscription) plus a backup printer behind the mail-provider switch | Both printers send test-mode cards end to end in both flows; the code card redeems on all three apps | No single printer can stop verification |
| Block Founders postcards | Same | Same test-mode run | — |
| Delivery webhooks | Kept; returned and re-routed home postcards now fail the attempt (today `homePostcardService.js:79` ignores them) | Test-mode return events | The person learns quickly and is offered another way to verify |
| Cost per verification | Fewer postcards through the proof ladder | Postcards per verified household measured before and after | Lower mail cost |

Switch back: the mail-provider switch picks the printer; Lob stays the default until the backup has sent real cards.

## ATTOM (Phases 2-4, county by county)

| Service today | Replacement | Proof before switching a county | Better than today |
|---|---|---|---|
| Add Home prefill (type, bedrooms, baths, size, lot, year built) | County or state record from the shards; estimates labeled; household one-tap answers | Fill rate of our record at least ATTOM's for the core fields on Pantopus homes in that county, or the missing fields asked at Add Home | No wait on a vendor; corrections by residents |
| Place "Your home" card (facts, value, outline) | Stored copy of our record; value service | Same fill check; value check below | Source and date on each fact |
| Property details (owners, full county record) | Our record mapped to the same groups (building, construction, heating, parking, lot, parcel, value) | A 50-home sample per new connector compared field by field with the county's own lookup page: codes mapped correctly, no field lost | Fixes ATTOM errors (Clark sample: 2 full baths not 1, Camas not "Clark", composition roof not "Concrete"); weekly freshness where counties publish weekly |
| Value estimate and range (AVM) | Pantopus estimate from county value, public sales and FHFA trend | Median error measured on held-out recent sales per state; a point estimate and range shown only where the error meets the bar set in the Phase 4 plan, otherwise assessed value plus trend | Shows why the number is what it is |
| ZIP sales trend | FHFA index plus county sales | Trend direction and size checked against county sales | Public, explainable |
| Exemption check | County exemption fields (for example Clark's senior and disability flags) | Sample of homes with known exemptions per county | Straight from the county |
| Today sky house outline | County footprints and stories, FEMA USA Structures, NSI stories | Visual check on a sample of homes on all three apps | — |
| AI context (Pulse, neighborhood facts, seasonal checklist) | The same profile fields from our record | Pulse and checklist read the same fields on a sample | — |
| Owner-name match, parcel shadow (both off) | Not replaced; owner names stay out | — | — |

**How counties switch:** the source router sends a county to our record once its proof passes; complaints and
corrections are watched for two weeks; switching back is one router change for that county. Stored ATTOM copies are
used only to measure fill rates and to pick samples, never copied into our record (confirm the ATTOM license allows
that use).

**When ATTOM is cancelled:** when the share of Pantopus homes still served by ATTOM falls below the bar in the Phase 3
plan (founder's OK), or when buying the remaining counties' files costs less than the subscription.

## Where the replacement can't match at first

- Counties with no free file (about 42% of Americans) until their files are requested or bought; households and
  labeled estimates fill the gap.
- Bedrooms and baths where counties publish only basics (about 34%), until residents confirm them.
- Value accuracy in states without public sale prices (TX, UT, ID, NM, KS, MO).
- Deed, mortgage and lien history (not used today).

## Measures watched after each switch

Fill rate per field and county; share of facts from county, household, estimate and ATTOM fallback; Property details
and Add Home latency (p95); address-check agreement on the golden set; postcards per verified household; ATTOM calls
per day and cost; corrections per 1,000 homes.
