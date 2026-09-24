# Ballot: product, data and build-guide review

September 23, 2026. Research and recommendations requested by the founder; **not implementation or launch authorization**. Read alongside the [build guide](ballot-build-guide-2026-09-23.md) and [first-person loop](first-person-loop-design-2026-09-16.md). Recommendations below concern the product and its information handling, not candidates, parties or voting choices.

## Decision proposed

Test a smaller election-information panel inside Pantopus. Do not commit to the full national reading room on the evidence currently available.

The proposed panel can deliver a concrete service: collect official election links and checked dates for a place the user already cares about. That fits Place and Today and does not require other Pantopus users. However, the guide has not demonstrated that this service will cause account creation, continued use after the election, or revenue. Those are separate product hypotheses.

The distinction matters: **a useful visit is not necessarily a reason to create an account, and an account created in October is not necessarily an active household in December.** The guide's strongest untested claim is that ballot lookup is the strongest reason for a stranger to enter an address. Its four-election annual recurrence claim also must not become a promise for every address.

Keep the official-source requirements, public access to information, separation of documents from commentary, optional reminders, lack of candidate recommendations, and existing navigation. Reduce the first release to the information the team can maintain accurately. Make expansion conditional on actual coverage, operating capacity and retained-user evidence.

## What the research establishes

| Evidence | Implication for Pantopus | What it does not establish |
|---|---|---|
| Pew's January 2024 survey found 45% of U.S. adults considered information for local voting decisions easy to find, versus 59% for presidential elections. [Pew study](https://www.pewresearch.org/journalism/2024/07/24/how-americans-get-local-political-news/) | There is a documented information-access problem around local elections. | Willingness to install Pantopus, share an address with it, or pay for it. The remaining respondents cannot all be described as finding information difficult. |
| VOTE411 offers address-based races and candidate responses; Ballotpedia offers a free sample-ballot tool with candidate comparisons and measure information within its coverage. [VOTE411](https://www.vote411.org/ballot), [Ballotpedia's product description](https://news.ballotpedia.org/2024/02/06/announcing-ballotpedias-upgraded-sample-ballot-lookup-tool/) | Basic lookup and side-by-side candidate information already have alternatives. | That Pantopus cannot compete, or that its visual treatment alone will create adoption. |
| Democracy Works announced continued Google support for the 2026 midterms on September 9, including voting-location data through the free Civic Information API. [Announcement](https://www.democracy.works/news/continuing-our-partnership-with-google-for-the-2026-midterm-elections) | The election API should not be confused with the discontinued representatives endpoint. It remains a relevant integration option. | Complete contest, candidate, document or ballot-style coverage at every address. |
| VIP says ballot information is included in some cases and data is usually published two to three weeks before an election. [VIP FAQ](https://www.votinginfoproject.org/faq) | Validate coverage before promising a full ballot. Replace the guide's four-week publication expectation. | That an empty response means no election or no contest. |
| Democracy Works documents election-specific dates/guidance, authority information and contact-based pricing/test access. [API documentation](https://developers.democracy.works/api/v2) | Obtain coverage, display rights, support and cost information before deciding whether to curate nationally. | A known price, a signed partnership, or a substitute for all candidate-document ingestion. No provider was contacted during this review. |

Pantopus's possible distinction is the connection between a place, its public jurisdictions, official documents, and the everyday information already associated with that place. That is a hypothesis about product usefulness, not a demonstrated competitive advantage. It should be tested against a much simpler official-links card before investing in maps, comparisons and AI.

## How it could add value, have little effect, or reduce value

**Add value:** a visitor completes a useful lookup without registering, then voluntarily saves the place because Pantopus can continue providing useful address information. An existing resident can find checked election dates and official services without leaving the context of their home. A later, well-sourced local reading room could consolidate documents that currently require multiple official sites.

**Have little growth effect:** people arrive for a single deadline or sample ballot, find it and leave. This still delivers a public service. It does not prove an acquisition strategy, and it does not justify expanding the feature to improve vanity metrics. The government count may attract curiosity without causing any ongoing use.

**Reduce value:** the card promises an exact ballot but supplies partial data, public information is gated behind a home claim, reminders are unexpected, or election content takes attention and engineering time away from working household features. A wrongly personalized deadline can also undermine confidence in unrelated Place information. These are product risks inferred from the proposed design; no user study in this review establishes their incidence.

For existing users, make the panel dismissible and keep election reminders independently optional. People who do not use election information should still receive the same household utility. Do not make political interest, party, eligibility, citizenship or inferred preferences part of acquisition targeting or onboarding.

The first-person-loop design already identifies the missing bridge: saving a place should lead to useful Today information and recurring household tasks. Verify that actual bridge before spending substantially on Ballot acquisition. An attractive seasonal entry point cannot compensate for an unfinished first week.

## Mockup review: source inspected, rendering unverified

The supplied `Pantopus Ballot.html` contains all 20 named boards. Their nested HTML templates were decoded and read without executing their scripts. The local-file browser preview was blocked by browser security policy. This review therefore assesses the authored content and interaction specifications; it does **not** certify spacing, contrast, clipping, animations or device usability.

The source has a coherent structure: Place contains the practical card; a contest separates quoted statements, records, third-party judgments and place data; the plan is separate from candidate choices. That separation is worth preserving and testing with users.

Several parts need a content or usability decision:

- **Practical task before the stack.** The anonymous mockup leads with nine governments, while the guide's P0 primary button opens the governments illustration. Test a direct official-information action first. The stack can remain an optional explanation. Nine layers at 1.2 seconds each is 10.8 seconds before overhead; an automatic story need not precede a repeat visitor's task.
- **Match the promise to the release.** The canvas shows 13 decisions and a full ballot. P0 has neither contests nor candidates. Use wording such as “Election information for this address” until exact coverage is established, and label national fallback as official links. Do not advertise the full mockup experience for the thin release.
- **The four-square glyph describes the collection, not the world.** A hollow mark cannot substantiate “nobody filed that kind of document.” Prefer “Not available in Pantopus” unless the source explicitly establishes non-filing. Add plain labels; users should not have to memorize four materials to open a race.
- **Statements need an authorship label.** An official pamphlet is the publisher of candidate statements and filed arguments, not necessarily their factual verifier. VOTE411 explicitly distinguishes unedited candidate responses from certified accuracy. [VOTE411 explanation](https://www.vote411.org/ballot) Keep that distinction visible without adding an app verdict on the statement.
- **Selection remains an editorial act.** Removing party colors does not answer which questionnaire, topic, endorsement or record is included. Document inclusion rules, coverage gaps and source dates consistently. A filled glyph or a longer record must not be presented as candidate quality.
- **Helpful context is compatible with neutrality.** “No caption tells you what it means” should not prohibit units, denominators, geography, estimate years, margins of error or what an office actually administers. District statistics must not imply an incumbent caused an observed outcome.
- **Personal delivery claims need personal evidence.** “Your ballot should arrive today” and “Your ballot is in the mail” are stronger claims than a county mailing schedule or sender match establishes. Use the official mailing window; an envelope classification can say “Election-office mail” without asserting its contents or delivery time.
- **Show the content gap in usability testing.** Test the honest empty page alongside the well-populated mockups. Do not publicly launch the reading room merely because empty states work technically.

## Smaller November experiment

The recommended first release is a bounded information card in a named pilot jurisdiction, with nationwide official-link fallback if that fallback can be verified. This is a proposed reduction of P0, not a new implementation order.

| Include in the experiment | Defer until its value and prerequisites are established |
|---|---|
| Election-office identity and verified official links | Government-count sharing and comparison tokens |
| Checked dates, local-time semantics, source and last verification time | Animated peel and arbitrary-pin contest discovery |
| Clear supported/partial/unavailable states | Candidate statements and endorsement/rating ingestion |
| Public access; optional save-place follow-up | Federal money and voting-record charts |
| One understandable reminder opt-in, only if existing delivery is verified | AI clerk and model-written measure explanations |
| Dismissal, correction route and a complete feature-disable path | Home-specific levy calculation until local assumptions are validated |

The title can remain the founder's decision. The important condition is that the interface accurately names what it supplies. Access to official public information should not require proving occupancy. A residence claim protects private household capabilities; it does not establish voter registration, ballot eligibility or ballot style.

For an anonymous full-address lookup later, give the user a clear explanation that their submitted address is sent to the named data provider. Do not silently repurpose a household address or use sign-in as a substitute for disclosure. State/county official links can be provided without building an anonymous exact-ballot service now.

Offer saving after the useful information is visible. The account proposition is continued address utility and user-chosen reminders. It should not imply that the app is necessary to access an official ballot or registration service.

The one-week estimate is not supported by an end-to-end coverage, delivery or release assessment. Existing adapters reduce work, but the proposed P0 also contains three clients, public sharing, comparison tokens, event migrations, reference-data curation, deep links and notifications. Remove optional work before fixing a date, and include editorial maintenance and release review in the estimate.

## Corrections needed before a builder relies on the guide

These are specification defects or source-code observations, not claims that an unbuilt Ballot feature has failed in production.

**Coverage and empty states — sections 4, 5.3–5.4, 7.2 and 11.** Google's elections endpoint lists elections available to query. It is not a complete future calendar. [Google electionQuery](https://developers.google.com/civic-information/docs/v2/elections/electionQuery) A state match is also insufficient to establish that a county or city election applies to a particular home. Keep separate states for verified empty, not yet published, unsupported, partial, stale and failed. Unknown must not become `on_ballot: false`, “none this year,” or “nothing scheduled.” Supply an official lookup in unresolved states. A partial provider omission does not establish that a contest does not exist.

**Google identifiers, ordering and provenance — sections 5.2 and 5.4.** Google documents `district.id` as an identifier relative to its scope, not necessarily an OCD ID; `electionId` is numeric; candidate order has its own `orderOnBallot` field; and `officialOnly` defaults to false. [Google voterInfoQuery contract](https://developers.google.com/civic-information/docs/v2/elections/voterInfoQuery) Separate internal election IDs from provider IDs. Build explicit jurisdiction mappings, retain official-source provenance, use supplied order fields, and label order unverified when absent. A generic state fallback cannot support the promised exact printed order. Keys must also distinguish primary variants, seats, terms and same-day special elections; a normalized office name and date alone may collide.

**Geography vintage and representation — sections 4, 5.3 and 5.15.** The guide pins 119th congressional boundaries. Census now documents 120th district products and cautions that even collected boundaries may not match subsequent changes for the November election. [Census district products](https://www.census.gov/programs-surveys/decennial-census/about/rdo/congressional-districts.html) Version by geography type, vintage and election applicability; reconcile with election-office data. Keep official map geometry separate from the simplified decorative peel. Dropping holes and secondary polygons is unsuitable for authoritative containment. Key shape caches by layer/vintage/GEOID, not bare GEOID.

**The existing geocoder cache is not exact-address evidence — section 3.** At the inspected checkout, `composeCivicDistricts` uses **geohash-6**, not the table's geohash-7. It retains display districts and three legislative codes, not the complete normalized government/GEOID set. Two points sharing a cache cell may fall on opposite sides of a boundary. Reuse the adapter, but verify or extend its identity contract before using its output for an exact ballot. [Existing adapter](../backend/services/placeSectionAdapters.js)

**Government counts — section 5.3.** Separating electoral districts from governments is correct. The proposed government list still omits townships and treats geographic school/county areas as governments without establishing their administrative status. Census distinguishes independent school governments from systems administered by other governments. [Census definitions](https://www.census.gov/topics/public-sector/government-organization/about/glossary.html) Adding a county's taxing layers does not prove exhaustive coverage of all governments. Retain “identified jurisdictions” or a carefully supported minimum rather than making the count exact automatically. Deduplicate by typed identity, not numeric GEOID alone.

**County deadline scoping — section 5.6.2.** The guide correctly notices that the existing `applyPrecedence` works per kind, but its workaround is unsafe: a county-specific title on a state-scoped row still matches homes throughout the state. Keep genuine county scope and repair election-specific precedence using an explicit event identity, or omit that local deadline until supported. Do not change pickup precedence inadvertently. [Calendar implementation](../backend/services/addressCalendarService.js)

**Dates and method-specific meaning — sections 5.2, 5.6 and 7.2.** Do not use display titles as deadline identifiers. Preserve event identity, applicable geography, method, date-only versus instant, local timezone, cutoff and the distinction between received-by and postmarked-by. A state can contain multiple timezones; “once per state at 6 p.m.” is not a sufficient delivery contract. Keep Election Day separate from every registration, request and return deadline. Washington's official page confirms October 16, October 26 and November 3 for the stated general-election milestones. [Washington elections page](https://www.sos.wa.gov/elections) These do not validate the guide's nationwide 8 p.m. card/push templates.

**Mailing guidance — sections 7.2 and 7.8.** The legal cutoff and a practical mailing recommendation serve different purposes. USPS recommends mailing before Election Day and at least a week before an election office's receipt deadline; the app should link current official guidance rather than infer a universal safe mailing date. [USPS mailing recommendations](https://about.usps.com/kits/kit600/kit600_v04-2026_041.htm) Do not make a last-day generic push imply that every listed return method remains usable.

**Reminder consent and count — sections 1, 5.6 and 7.6.** “All opt-in” conflicts with the default-on preference. The listed P0 schedule contains five potential dates before the mover reminder, rather than three. The current briefing generator considers every day inside `lead_days` and deduplicates per kind, not per election delivery. Specify a single per-user/election budget, semantic deduplication, explicit consent, election-location timezone, quiet-hour behavior, corrected-date cancellation and account/departure handling. General briefing consent should not silently enable a new election reminder category. [Existing generator](../backend/services/context/usefulnessEngine.js)

**“You moved” is not established by occupancy creation — sections 3 and 5.6.** `_createOccupancy` writes `start_at: now` when the app membership is created. That is not proof of a physical move. Use already-confirmed move information if it exists; otherwise use conditional copy such as “If you've moved, check your registration.” Do not generate a personalized move claim from an account event. [Occupancy service](../backend/services/occupancyAttachService.js)

**Freshness and feature rollback — sections 5.15–5.16.** `readThrough` serves a retained stale payload on a fetch error without a caller-supplied maximum stale age. A timestamp alone does not make stale locations or instructions safe to use. Define field-specific expiration and an official-link fallback; retain historical documents separately from current instructions. Recheck freshness at send time. Address changes must retire home-keyed cached ballots, plans and reminders. The guide intentionally leaves election calendar rows visible when `ballot_p0` is off; that is not a complete emergency disable mechanism. [Cache implementation](../backend/services/placeSectionCache.js)

**Document absence and candidate status — sections 5.10 and 7.5.** A missing row does not prove “did not respond,” “no prior elected office,” “no endorsements,” or “neither candidate filed.” Record which source was checked, its coverage, and whether a questionnaire was actually sent to each candidate. Oregon explicitly notes that pamphlet participation is optional and that its pamphlet is not a comprehensive ballot preview. [Oregon publication explanation](https://content.govdelivery.com/accounts/ORSOS/bulletins/3b2c109) Source identity and response status need separate treatment. Also avoid classifying every judicial contest as nonpartisan without jurisdiction-specific evidence.

**Publication and correction lifecycle — sections 5.10 and 6.** A corrected document must become current atomically, invalidate page and clerk caches, and retain its correction history. The proposed uniqueness key omits prompt and language, so multiple answers on one topic or translated editions from one source can collide. Publication checks, immutable source/version identity and review evidence are needed before bulk ingestion. Verify source display and republication terms; this review did not clear those rights. Public contest pages also need a defined source when the per-home provider cache has expired or nobody has previously loaded that contest.

**Clerk guarantees — section 5.14.** Matching a substring establishes that a quote occurs in a document; it does not establish that the generated sentence is supported by that quote or preserves its context. Unquoted measure rewrites further weaken the promise of a receipt for every sentence. Keyword refusal and temperature zero do not prove safety. NIST identifies erroneous generated content and misleading generated justifications/citations as risks. [NIST GenAI profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf) Start with document search and complete attributed excerpts. Defer freeform interpretation until omission, contradiction, prompt-injection, correction and unavailable-source cases are evaluated. Documents remain data, never instructions to the model. Browser-only chat history also does not, by itself, establish provider-side zero retention.

**Levy and finance presentation — sections 5.11–5.13.** The multiplication is straightforward; validating what the inputs mean is not. Distinguish an illustrative first-year gross amount from an incremental change against a replaced levy. Confirm the relevant assessment year, taxable base, applicable exemptions and official estimate assumptions. Washington's revenue department documents levy categories and exemptions. [State school levy guidance](https://dor.wa.gov/taxes-rates/property-tax/state-school-levy-property-tax-tips) Use a rate-only display or an official calculator until those semantics are supported. For later federal charts, document committee aggregation, amended reports, time periods and receipt-category definitions against [FEC methodology](https://www.fec.gov/campaign-finance-data/about-campaign-finance-data/methodology/); do not translate an API total into an unsupported small-donor claim.

## Privacy details worth resolving now

The guide's no-voter-file and no-vote-choice rules reduce collection, but they do not establish the broader “nothing new about the user” claim.

- A signed compare token prevents modification; it does not hide its contents. The intersection of county, school and special-district identities can narrow an address substantially. City-only artwork does not remove those fields from a token. For a first sharing experiment, omit the complete district set and personal name. State clearly what is shared before copying a link.
- A `homeId` cache key hides the address in the key, not in a raw provider response. Store only the normalized fields required; specify cache expiry, deletion, address-change invalidation and access checks. Verify log, proxy, analytics and error-monitoring redaction. `Cache-Control: no-store` does not control server logs or internal database writes.
- Public contest URLs, outbound links and clerk prompts can reveal interests even if dedicated funnel metadata excludes candidates. Exclude sensitive paths/payloads from session replay, advertising integrations and generic analytics; use an appropriate referrer policy. Do not infer voting intention from reading behavior.
- Plans keyed only by election can collide across users and homes on a shared device. Scope local storage to the correct identity, clear on logout/account change, and cancel scheduled notifications. Web local storage does not erase itself on a particular day while the page is closed; use truthful expiry semantics rather than an unconditional deletion promise.
- A household plan must not expose another person's method or participation status. Sharing official dates can be user initiated without displaying who has or has not planned.
- The guide records a chosen voting method in `ballot_plan_saved`. That is not a candidate choice, but it is additional election-related behavior. It is unnecessary for measuring whether account creation leads to continued Pantopus use. Prefer an aggregate save event without method.

These are design and data-flow concerns. No production privacy breach was reproduced in this review.

## How to determine whether it actually grows Pantopus

Measure four different outcomes in the existing funnel, without collecting political preferences or whether anyone voted:

| Outcome | Suggested definition |
|---|---|
| Immediate usefulness | A visitor reaches an official resource or completes the information task they came for; optional task feedback. A link click is a proxy, not proof of completed registration. |
| Incremental acquisition | Additional completed accounts with a saved place per eligible visitor exposed to the experiment, compared with a concurrent control. Preserve existing anonymous-to-account attribution. |
| Continued product use | Acquired users return in a defined later window and use at least one non-election Pantopus function. Count people, not event totals. |
| Operating cost and harm signals | Curation/review time, support load, missing coverage, corrected facts, unintended notifications, latency, dismissal, opt-out and account deletion. |

The guide's 60% card-view, 50% contest-open, 30% plan-save and 0.3 compare targets are unvalidated planning targets, not market benchmarks. A teaser view does not prove an address was entered because of Ballot. A share-button click does not prove a recipient received a share. Stage-specific metrics should only be used after the relevant stage exists.

Run an initial comprehension/usability study with roughly 8–12 prospective users as a practical recruiting target, not a representative sample. Ask them to find the official information and explain what Pantopus knows versus does not know. Include supported and unsupported addresses, sparse content, and someone who wants to use the app without election reminders. Do not solicit candidate preference or turnout. Observe where they expect a ballot versus a link and what, if anything, makes saving worthwhile.

Then compare the existing address entry experience with a modest election-information entry treatment in a supported area. Keep accurate official information accessible to everyone; test presentation and the save invitation, never accuracy or deadline availability. Predefine the smallest acquisition improvement worth the total cost and the observation period using actual baseline traffic. There is no defensible numerical conversion forecast or sample-size calculation without that baseline.

Compare people acquired during the same dates and channels. A before/after comparison across election season can confuse demand changes with feature effect. Week-four retention alone is insufficient if that week still falls before Election Day. Add a post-election observation window, such as late November through December for the proposed fall launch, and count continued non-election use.

Useful experiment outcomes include:

- Useful official-link visits but no incremental retained households: keep a low-maintenance seasonal card if its cost is acceptable; do not infer that the reading room is warranted.
- Incremental saved places but no later utility use: repair the existing onboarding/Today bridge before expanding Ballot.
- Sustained additional non-election use with manageable information operations: consider one jurisdiction's reading room next, after verifying its sources.
- Material comprehension, accuracy or unsolicited-reminder failures: disable the affected information/reminders and repair the contract before expanding.

This review has no production analytics, user interviews, acquisition spend, engineering capacity or provider quote. It cannot settle commercial impact from desk research alone.

## Operating and verification requirements

Name an owner and backup for source review, corrections and election-day incidents. Track official source changes, not just successful HTTP fetches. A 24-hour response target does not address a wrong deadline reported shortly before a cutoff: the operator needs an immediate way to suppress affected guidance and route users to the election office. Store review timestamps and source-version identity separately from fetch timestamps.

Use the existing acceptance catalog rather than starting a second tracker. Before releasing a jurisdiction, compare approved public/test addresses with official sample ballots and election-office information. No private household addresses need to enter committed fixtures. Verification should include:

- Known complete, known partial, unavailable and verified-empty responses; more than one upcoming election.
- Addresses on opposite sides of a boundary, split precincts, unincorporated places and changed map vintages.
- State/county deadline coexistence, different local timezones, received/postmarked semantics and corrected deadlines.
- Opt-in, opt-out, duplicate attempts, quiet hours, address/account changes, late delivery and full feature disable.
- Official-link ownership, source changes, correction propagation and failure fallback.
- Anonymous address/log handling, shared-device plans and share-token contents.
- Installed native callers and web through actual API/persistence where relevant; device/provider delivery remains a separate acceptance boundary.

Fictional fixture journeys are useful for UI and integration behavior. They cannot prove coverage or correctness of real election data. No new implementation or testing was performed by this research review.

## Scope, evidence and next decision

Reviewed the 877-line original build guide, decoded content of the 20 HTML mockup boards, first-person-loop context, project handoff/reconciliation, relevant existing backend contracts and the linked public sources. The HTML was not visually rendered. No live authenticated election-provider queries, national coverage audit, data licensing clearance, device testing, user research or production funnel analysis was performed.

Local inspection was on `master` at `cef95ab67`, with pre-existing modified and untracked user work preserved. Read-only remote inspection found master `5cf4a26c35f79e04503a2e734ef6a1582e90af24`; [CI 35953685236](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35953685236) was in progress at that check. Open PRs were 46, 397, 405 and 406. This snapshot is not a deployment or acceptance claim and must not replace the coordinator's live status. No application code, migration, running service, PR or external message was changed by the review.

The next founder decision is whether to fund the bounded official-information experiment, naming its jurisdiction, maintenance owner and non-election activation behavior. If yes, revise the guide's contradictory contracts before a builder starts, confirm real source coverage, and test the existing save-place-to-Today journey. P1–P3 remain proposals contingent on evidence.
