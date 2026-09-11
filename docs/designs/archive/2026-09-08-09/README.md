# September 8–9 product design archive

Historical working material from the Pantopus product-design discussion, copied into Git so it does not depend on temporary directories or a conversation session. Start with the [current collection index](../../../pantopus-product-design-index-2026-09-09.md). Current proposals take precedence over these earlier drafts and iterations.

## Editable visualization fragments

- [Initial Home/Nearby concept](fragments/pantopus-next-stage.html): the original proposal's interface exploration, before the nationwide direction was expanded.
- [Bill insight](fragments/pantopus-bill-insight.html): editable source for the [standalone bill concept](../../pantopus-bill-insight-concept-2026-09-08.html).
- [Place conversations, first iteration](fragments/place-conversations.html): earlier place layout.
- [Place conversations, latest iteration](fragments/place-conversations-v2.html): editable source for the [latest standalone place concept](../../pantopus-place-page-concept-2026-09-09.html).

These fragments use the conversation visualization host's CSS/runtime conventions. Preserve them as authoring sources; opening a fragment directly is not a complete rendering test. The exported concepts in `docs/designs` include their rendering wrapper. People, bills, posts, schedules, and offers are fictional examples.

## Drafts and authoring scripts

- [Technical draft](drafts/pantopus-tech-design.md) and [journey draft](drafts/pantopus-journeys-design.md) were integrated and edited into the nationwide design's appendices. They are superseded working drafts.
- [Reader renderer](authoring/pantopus-render-design.mjs) generated the nationwide HTML reader.
- [Reader/companion QA](authoring/pantopus-doc-qa.mjs) ran the historical Playwright checks below.
- [Initial-concept preview server](authoring/pantopus-design-qa.py) served the first visualization for review.
- [One-off integration script](authoring/pantopus-integrate-design.py) records how the drafts were integrated. **Do not rerun it against the completed document:** it targets earlier markers and can duplicate content.

Scripts are preserved unchanged as historical source, not installed tooling or CI. They contain original local repository, temporary-output, dependency, or visualization-runtime paths. Review and adapt those paths in a separate copy before use; original paths can write to the main checkout or temporary evidence files. No runtime dependency installation or script execution is part of preserving this archive.

## Historical design evidence

The [reader report](evidence/pantopus-reader-qa.json) records 10/10 checks passing with no browser errors. The [nationwide companion report](evidence/pantopus-concept-qa.json) records 34/34 checks passing with no browser errors. These are historical prototype results, not new runs on the publication branch or application acceptance evidence.

| Screenshots | Coverage |
| --- | --- |
| [Reader desktop](evidence/pantopus-reader-desktop.png), [dark](evidence/pantopus-reader-dark.png), [mobile](evidence/pantopus-reader-mobile.png) | The formatted design document. |
| [Companion desktop](evidence/pantopus-concept-desktop.png), [dark](evidence/pantopus-concept-dark.png), [mobile](evidence/pantopus-concept-mobile.png) | Nationwide interface overview and responsive examples. |
| [Companion bill](evidence/pantopus-concept-bill.png), [bill mobile](evidence/pantopus-concept-bill-mobile.png), [event mobile](evidence/pantopus-concept-event-mobile.png), [opportunity dark mobile](evidence/pantopus-concept-opportunity-dark-mobile.png) | Specific detail flows and visual states. |
| [Bill 360 light](evidence/pantopus-bill-360-light.png), [360 dark](evidence/pantopus-bill-360-dark.png), [736 light](evidence/pantopus-bill-736-light.png), [736 dark](evidence/pantopus-bill-736-dark.png), [final](evidence/pantopus-bill-final.png) | The focused standalone bill exploration. |

Some historical companion captures include a transition or temporary toast; modal screenshots capture the visible viewport. They are QA records, not final marketing assets. None of these screenshots or reports verifies the latest place-page implementation, real data, moderation, persistence, accessibility acceptance, or live provider availability.

The [manifest](manifest.json) inventories the collected artifacts and their provenance. Source SHA-256 values identify original bytes; a separate published hash and change note identify the place document's collection-link update.
