# Pantopus product and experience design collection

Collected September 9, 2026 on `codex/product-and-place-design`, based on master commit `6fbdcce1203780b475bd209ed4f6fc5e03bfb487`.

This collection preserves the product strategy, business and acquisition direction, nationwide utilities, UI concepts, and place-centered social design developed in this discussion. These are proposals and illustrative prototypes. They do not establish implemented features, purchased data access, provider coverage, or release acceptance.

## Start here

| Artifact | What it contains |
| --- | --- |
| [Nationwide product design](pantopus-nationwide-product-design-2026-09-08.md) · [formatted reader](pantopus-nationwide-product-design-2026-09-08.html) | The individual-utility strategy, nationwide discovery, source acquisition, AI boundaries, feature details, experience design, engineering contracts, journeys, measurement, and delivery phases. |
| [Nationwide experience companion](designs/pantopus-nationwide-experience-2026-09-08.html) | Fictional interactive Home, Nearby, Following, Inbox, discovery, private saves, bill explanation, and event-change flows. |
| [Places and social conversations](pantopus-place-social-design-2026-09-09.md) | Place identity, posting and replies, maps, quiet and viral places, sensitive-location boundaries, moderation, and engineering requirements. Includes Recent conditions, Offers, and Visit info with trust, expiry, correction, and acceptance rules. |
| [Latest place-page concept](designs/pantopus-place-page-concept-2026-09-09.html) | The expanded place interface: Conversations, Upcoming, Visit info, conditions and offers. Fictional session-only behavior. |
| [Bill explanation concept](designs/pantopus-bill-insight-concept-2026-09-08.html) | The focused visual bill scenario and its interactive explanation. Fictional inputs and hypothetical comparisons. |
| [Original next-stage proposal](pantopus-next-stage-design-2026-09-08.md) | The owner's starting proposal, preserved as context. The nationwide design updates its launch and acquisition assumptions. |

The strategy preserves Pulse/Feed, Beacon, Marketplace, Gigs, chat, weather, air quality, home/apartment/condo information, elections, trash/recycling, and the other existing capabilities. Nationwide individual usefulness supplies the initial value while social participation develops. Place conversations extend that direction; they do not remove existing features or turn the product into a venue-rating system.

## Earlier iterations and working material

The [design archive](designs/archive/2026-09-08-09/README.md) preserves four editable visualization fragments, two temporary design drafts, four historical authoring/QA scripts, two QA reports, and fifteen screenshots. The main documents above take precedence over archived drafts and earlier UI iterations.

The archive includes the initial Home/Nearby concept, standalone bill explanation, original place concept, and latest place concept source. Standalone exports above can be opened directly in a browser; the archived fragments were designed for the conversation visualization host and are not equivalent standalone exports. Some exported rendering assets use public CDN URLs.

## Preservation and verification

- Four earlier documents/prototypes were recovered byte-for-byte from commit `6664315bb6d9e0036723f79bad8c9e3b1202ff05`; that commit's unrelated advertisement and migration runbook changes were not imported.
- The new place document and its export came from the original working checkout. Only the document's relationship paragraph was updated to link to the collected local documents and index. The working checkout's originals remain intact.
- Relevant temporary design files and visualization sources were copied into the archive. The [manifest](designs/archive/2026-09-08-09/manifest.json) records source and collected hashes. Temporary operator logs, database archives, device evidence, and unrelated application work are outside this collection.
- Publication checks cover artifact completeness, copied-byte integrity, document links, HTML structure, and a documentation-only Git diff. All fifteen archived screenshots were visually inspected for scope and private data.
- The historical nationwide reader report records 10 passing checks; the nationwide experience report records 34 passing checks. These reports describe their original prototype runs. They do not validate the later place-page concept or application behavior. The latest place concept has not received browser, native, backend, or scale acceptance testing.

The next product action is to review the nationwide work packages and the place proposal's phased sequence, choose the first implementation slice, and refresh its code assumptions against the release branch. Existing reliability and release work remains in the [project handoff](PROJECT_HANDOFF.md); this collection does not alter that operational backlog.
