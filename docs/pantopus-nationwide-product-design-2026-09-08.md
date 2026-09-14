# Pantopus: useful from the first person

## Nationwide product and experience design

**Date:** September 8, 2026  
**Status:** Detailed proposal for product, design, and engineering review.  
**Platforms:** Web, iOS, and Android.  
**Scope:** Product documentation and an illustrative design companion. Application implementation, source integrations, and release work are proposed rather than performed by this document.

**Product requirement:** For valid U.S. locations nationwide, Pantopus discovers relevant nearby, service-area, regional, state, and national information; turns verified findings into useful actions; and adapts its depth to available sources. Local signup counts do not affect access. A town does not wait for a local Pantopus launch.

**Working promise:** Discover something useful you did not know you could do. Make the next step easy. Keep it useful when life changes.

**Read with:** [Interactive experience companion](designs/pantopus-nationwide-experience-2026-09-08.html) and [the earlier proposal](pantopus-next-stage-design-2026-09-08.md). The companion uses fictional fixtures and local session state. Its successful interactions do not demonstrate real availability, persistence, notifications, source accuracy, or user demand.

The earlier proposal remains preserved. This design changes its acquisition and sequencing assumptions: nationwide availability replaces a single-community launch gate; individual usefulness leads the first complete journey; the private-question and followed-event journeys remain important. Settling-in households are one useful cohort among many, rather than the eligibility boundary for the product. Existing Home, Pulse, and Beacon commitments continue.

### Reading guide

| Read this part | To decide |
| --- | --- |
| 1–3 | What the product promises, how it fits together, and what is in scope. |
| 4–6 | What people see, how screens behave, and how the interface stays simple. |
| 7 | What each utility delivers, including evidence, visualization, and failure behavior. |
| 8–10 | How nationwide discovery, personal relevance, privacy, and AI work together. |
| 11–14 | How to sequence delivery, verify quality, and resolve open design questions. |
| Appendix A | Backend contracts, source acquisition, current-code mapping, and implementation acceptance. |
| Appendix B | Complete journeys, state transitions, social connections, and measurement. |

## 1. Product thesis and outcomes

Pantopus should become useful before someone has a local network, a complete household inventory, or a habit of posting. It should help people understand an everyday thing, discover a relevant possibility, and move forward. That thing may be an address, a bill, a product, a public program, an event, a document, or a practical question.

The first outcome must be concrete: someone finds a relevant borrowing option, understands a bill change, reaches the correct product manual, saves a real event with the correct time, or knows which local organization handles a need. Information earns its place by helping a person decide or act.

The core loop is **bring or discover → understand → choose an action → keep privately → return when useful**. A social connection is one possible next action. It is not a prerequisite for the loop.

The longer-term social ambition remains substantial: local conversation, relationships, trusted publisher updates, commerce, paid help, and chat. Individual utility gives people a reason to arrive and return while those networks develop. The team must test whether that relationship actually forms; a well-designed utility does not automatically produce a successful social network.

### 1.1 Outcomes to design for

| Outcome | Observable evidence | Insufficient substitute |
| --- | --- | --- |
| Immediate usefulness | The user understands or completes a real next step using a sourced result. | A generated paragraph, dashboard impression, or animated reveal. |
| Low effort | A person completes the chosen task without unnecessary account, location, inventory, or preference setup. | A short onboarding flow that postpones all value. |
| Discovery | A relevant option the person did not know about changes a real decision. | Novel trivia or an irrelevant discount. |
| Dependable memory | A saved item is retrievable with its accepted details and correct audience. | A toast without durable storage. |
| Useful return | Someone returns for a saved item, a meaningful change, a relevant reply, or another real task. | A notification open with no useful destination. |
| Nationwide quality | These outcomes are measured across metros, towns, and rural locations. | Aggregate results dominated by a few cities. |

### 1.2 People and situations

Support renters, owners, people considering a move, established residents, people living alone, shared households, rural residents, visitors exploring an area, and address-free followers. Offer the relevant capability without assuming every person is a homeowner, gardener, parent, driver, or bill payer.

Ask about a situation only when the answer changes the next result. An address does not establish ownership, occupancy, income, membership, or household composition. A person browsing a place may not live there. A shared product link expresses interest, not ownership.

## 2. Scope, retained foundations, and deliberate boundaries

### 2.1 Keep and improve

- Home usefulness, authorized household tools, saved places, and supported address intelligence.
- Pulse questions and conversation, Beacon discovery/following/publishing, Marketplace, gigs, and chat.
- Entry continuity across links, authentication, retry, and app reopening.
- Explicit audience and identity boundaries; address-free following; existing eligibility enforcement.
- Reliable in-app updates and correctly scoped notification destinations.

### 2.2 Add or substantially extend

- A nationwide source-discovery and maintenance service that operates for any entered location.
- Account-owned private saved items, reviewed actions, and source-linked change watches.
- One shared capture flow for supported links, text, images, and documents.
- A consistent result/detail interface across opportunities, bills, products, events, and address insights.
- Higher-value transformations: relevant access, comparisons, explanations, practical plans, and visual interaction.
- Shared data semantics across web, iOS, and Android, with platform-native presentation.

### 2.3 Boundaries of the first release

The first complete release supports a defined set of item types and source classes. It does not claim universal understanding of every uploaded document, exhaustive discovery of every local resource, current inventory from static pages, or unrestricted reservations across providers.

A supported photo can help identify a product; product-specific instructions require an adequate match. A public service may require personal eligibility confirmation. A screenshot is a dated observation unless it can be connected to an authoritative current source. Actions involving payment, publication, bookings, or sharing require their own explicit confirmation and appropriate integration.

Sunlight based on building geometry, sophisticated bill tariffs, live borrowing inventory, and automated source monitoring each have independent data gates. They can be added without withholding the national core from users elsewhere.

## 3. Information architecture

Use four stable consumer destinations: **Home · Nearby · Following · Inbox**. These are the working labels to test for comprehension. Home/Pulse/Beacon remain product pillars; brand labels can appear in appropriate secondary contexts. Do not redesign navigation again for each new data category.

| Destination | The question it answers | Primary content | Secondary access |
| --- | --- | --- | --- |
| Home | What could help me, and what should I keep track of? | One useful discovery; relevant attention items; upcoming saved plans. | Saved items, my places, household tools, documents, bills, products. |
| Nearby | What is useful or happening in this area? | Discoveries and real local activity, clearly distinguished. | Pulse, events, Marketplace, gigs/help, map and area controls. |
| Following | What changed from people and organizations I chose? | Actual permitted publisher updates. | Explore publishers, manage follows, My Beacon and creator tools. |
| Inbox | What needs a response or review? | Updates, Messages, and Mail as distinct categories. | Notification preferences, unread filters, conversation identity controls. |

### 3.1 Scope belongs next to the content it controls

Home defaults to **Only you**. A separate location control establishes the place used for discovery. It must not visually imply that selecting a location changes record ownership or grants household access.

An explicit workspace selector opens an authorized household workspace. Shared items name that household. A private saved item can reference any permissible place without becoming visible to the people who live there.

Nearby has its own browsing area. Following is address-free. Messages and Mail retain their existing identity and access scopes. A change in one scope must not silently change the audience of a draft or the destination of a save.

### 3.2 Navigation and continuity

Keep existing deep links working through route adapters. A notification, saved item, publisher link, or search result should open the exact permitted object after login. Restore the intended destination and in-progress review after recoverable failures. A removed or restricted object opens an explained access state, not an unrelated dashboard.

On phones, keep four labeled bottom destinations, respect safe areas, and avoid an unlabeled central button that looks like a fifth destination. A persistent labeled capture action can live in the Home header and other relevant screens. Native share extensions provide the fastest entry from another app.

On desktop, use a left rail with the same destinations. A main content column holds the current task; a detail pane can preserve list context. Avoid turning available screen width into extra unrelated modules.

## 4. Experience and visual design system

### 4.1 Rich content, simple first view

The screen reveals information in three layers:

1. **Result:** one useful conclusion, the minimum essential condition, and one primary action.
2. **Decision:** the alternatives, details, and requirements needed to choose confidently.
3. **Evidence:** source material, dates, calculations, assumptions, and coverage.

Conditions that could invalidate the headline remain visible in layer one. Do not hide an eligibility restriction, missing appointment, estimated value, or added cost behind an information icon. Secondary technical metadata belongs in layer three.

A typical Home viewport should communicate where the person is, what one thing is useful, and how to bring something in. It should not require them to interpret a grid of ten scores. Optional content is progressively revealed, and the primary action is visually stable as data loads.

### 4.2 Visual language

Use an editorial, calm presentation: readable text, deliberate spacing, restrained surfaces, meaningful imagery, and generous touch targets. Reuse existing brand and semantic theme primitives where they work. Pantopus should feel consistent across utility, social, and commerce surfaces.

| Element | Working design specification |
| --- | --- |
| Typography | Native system typography on mobile; existing accessible web stack. Body approximately 16 px/sp equivalent; primary results 24–32; secondary information 14; avoid essential text below 14. Support user text scaling. |
| Hierarchy | One page title and one dominant result or task. Use sentence case. Put labels next to values and units beside numbers. |
| Spacing | A common 4/8-based spacing scale; approximately 16–20 side padding on phones; 24–32 between meaningful sections. Do not make density depend on tiny text. |
| Surfaces | One restrained card style for bounded objects. Prefer open rows and separators for collections. Avoid a card inside every other card. |
| Color | Neutral readable surfaces with one consistent brand accent. Semantic color is supplementary to words and icons. No red/green-only comparisons or arbitrary health-like scores for places. |
| Controls | One primary action per decision group; descriptive secondary links. Target at least 44 pt on iOS and 48 dp on Android; similarly comfortable effective touch targets on web. |
| Icons | Use the existing icon family with visible labels for unfamiliar actions. Do not require recognition of an icon to understand a source state or audience. |
| Imagery | Use relevant, rights-cleared source imagery with useful captions. Generated art must not represent evidence, an exact product part, or a real geographic scene. |
| Numbers | Stable formatting, explicit units, tabular figures for aligned comparisons. Show intervals and missing values where precision is unsupported. |
| Theme | Design and inspect both light and dark appearances; preserve contrast on actual surfaces and source images. |

These are design targets, not claims of an audited design system. Test contrast, text scaling, target sizes, and reading order in implementation.

### 4.3 Motion has a job

| Interaction | Motion purpose | Working behavior | Reduced-motion behavior |
| --- | --- | --- | --- |
| Open an item | Preserve the relationship between summary and detail. | Short 180–240 ms expansion/transition; keep focus and back position coherent. | Direct state change with clear heading/focus. |
| Change a chart assumption | Explain how values relate. | Interpolate affected marks over roughly 200–300 ms, retaining labels and units. | Update marks and announce the final comparison. |
| Save | Confirm the object entered the chosen private destination. | Brief check/state transition after persistence; do not animate success before it exists. | Persistent saved label and confirmation. |
| Review a source change | Direct attention to changed fields. | One restrained highlight on changed rows; no looping pulse. | Text labels identify old and new fields. |
| Progressive results | Explain that supported results are arriving. | Stable placeholders or simple progress text; append or fill reserved sections without shifting a user's target. | Same content without shimmer. |
| Sunlight/time exploration | Reveal the relationship between time and modeled light. | User-controlled, interruptible movement with a visible time label. | Step controls and static snapshots. |

Never use motion to simulate data collection, invent activity, conceal waiting, or pressure completion. No confetti for every save, decorative parallax over reading, automatic moving maps, or looping ambient charts. Users can stop motion; background work continues independently of animation. Actual timing should be tuned on slower devices.

### 4.4 Accessibility is part of the design contract

Design against WCAG 2.2 AA for applicable web behavior and native platform accessibility expectations; verify actual criteria rather than treating this statement as certification. Keyboard navigation, visible focus, meaningful headings, screen-reader labels, semantic tables, and native control behavior are required. Charts have a concise explanation and accessible data alternative. Pointer-only interactions have touch and keyboard equivalents.

Support text enlargement without clipping values or hiding actions. At narrow widths, stack comparisons and controls. A map is optional to completing a task. Errors identify the field and correction. Live announcements report completed changes rather than every intermediate animation frame. Long tasks expose cancel/retry where meaningful.

## 5. Screen-by-screen design

### 5.1 Arrival and first useful result

Honor a shared link or item first. If a visitor arrives without an object, show the short promise and two clear starts: **Explore a place** and **Show Pantopus something**. Following a known publisher remains directly available. Do not insert a household setup questionnaire in front of a chosen task.

Place entry accepts a town, ZIP, address, or manually selected map point, explaining when more precision is necessary. Location permission is optional. A visitor can explore public information before creating an account; account creation is requested when they choose a durable private save or another account-dependent action. Preserve the result through authentication.

First results show a useful sourced discovery as soon as one is ready. Explain ongoing work plainly: “Checking local programs.” Do not show invented percentages. If little is found, offer the applicable regional/state/online layer and the capture route. Keep “not checked,” “could not verify,” and confirmed absence distinct internally.

### 5.2 Home

Recommended order:

| Position | Content | Behavior |
| --- | --- | --- |
| Header | Home; Only you; profile/workspace access. | Private scope is persistent and understandable. |
| Place context | Named browsing/saved place, or Add a place. | Changing it refreshes relevant discoveries without modifying household rights. |
| Intake | “Show Pantopus something”; Share a link, Photo, Document inside its sheet. | One entry surface instead of a tool catalog. |
| Primary area | A meaningful attention item when urgent; otherwise one useful discovery. | Prioritize real relevance, not a permanently mandated hero. |
| Upcoming | A short list of accepted personal plans and selected shared items. | Distinguish Only you from the named household per item. |
| Saved items | Direct route to retained items and search. | Always reachable, including when there is no fresh discovery. |
| Explore more | A small set of relevant opportunities and address topics. | Explicit Show more; no need to endlessly scroll for basic tasks. |

Avoid repeating the same item in attention, upcoming, and discovery with three different titles. A quiet Home is a successful state when everything is handled. Say “Nothing needs your attention” only when the required personal checks succeeded; a failed check gets a recoverable section-level state.

### 5.3 Capture sheet and interpretation review

The complete capture sheet supports **Link or text · Photo · Document**. P1 exposes only its supported link/text intake. Photo and Document enter the sheet when their protected storage and promised interpretation are ready; do not show disabled future tools as if they already work. If a release supports file storage before interpretation, label the action **Keep this document**, explain that it stores the original, and avoid promising analysis. Native sharing can skip the chooser. Explain the private destination before importing. Process only the selected content; do not imply inbox, photo-library, or account access beyond what the user granted.

Show the original alongside interpreted facts where space permits, or one tap away on a phone. The review title names the recognized object: “Review this event,” “Confirm this appliance,” or “Review these bill details.” Show uncertain fields with editable values. If type detection is wrong, allow Change type without re-uploading.

For unsupported content, preserve access to the original, explain the limitation, and offer a plain private note or source bookmark if that capability is supported. Do not manufacture a task solely to fill the screen.

### 5.4 Opportunity detail

Above the fold: a concrete outcome, provider, place/access scope, important condition, and the next action. Below: why it fits, requirements, location/schedule, source, and Save.

Prefer “Check borrowing options” when only a program is known; “Reserve” requires a legitimate reservation destination. Use “You may qualify” only with a reason and a remaining question. Use “Confirmed by provider” only after an actual provider result. The action label must describe what the next tap does.

An eligibility question appears inline when it changes the next step; it does not open a long profile builder. Explain why the answer matters. Membership numbers or other sensitive credentials are not necessary for basic program discovery; let the provider handle sign-in unless a supported connection is explicitly chosen.

### 5.5 Saved items and item detail

Saved items combine supported types in one private collection with search and light filters such as Upcoming, Documents, Products, and Places. Do not require users to choose a folder for every save. Recent and meaningful upcoming items get practical ordering; users can pin a small number.

Every detail view separates **Accepted details**, **Your notes**, and **Source**. The source's new version cannot overwrite the user's correction silently. Provide a stable item URL/deep link and explicit actions: edit, set a reminder, review a change, move to a supported destination, or delete. Household sharing is a separate reviewed action.

Deletion explains whether it removes the private item, stops its watch, or affects a shared record. Undo is available for reversible local/personal deletion when retention rules permit. A saved restricted post retains an authorized reference; revocation removes readable source previews rather than preserving an unauthorized copy.

### 5.6 Review change

Lead with the meaning: “The organizer changed the start time.” Show only changed fields first, with old and proposed values, time zone, source, and source date. Expand to the full item if needed.

Actions: **Update my saved item**, **Keep my version**, and an optional **Review later**. Until acceptance, the saved item and its reminders retain their existing values. If acceptance affects a reminder, show the proposed reminder adjustment in the same review. Conflicting edits explain which value changed locally and which changed at the source.

Dismissal does not unsubscribe from every future change. Separate item-watch settings from one change decision. Repeated refreshes of the same source version must not create repeated unread items.

### 5.7 Nearby

Start with a clearly named area and useful discovery. Offer **Discover · Community · Marketplace · Help** as secondary views, with Events accessible within discovery and community. Validate these labels with users; avoid adding another permanent global tab for each category.

Discovery results identify their provider/source. Community items identify the actual author and audience. Public-program information must not appear to be a post from a fabricated neighbor. Map/list choice preserves filters and selection. A person can manually expand travel time or area; sparse supply does not silently change their scope.

Metro discovery needs deduplication, neighborhood/transit filtering, and relevance ranking. Rural discovery needs regional/state/online services and sensible user-selected travel ranges. Both need the same evidence and interaction quality.

Marketplace and Help retain real listings, availability, provider identities, and transaction states. A useful private item can lead to an explicitly prepared listing, question, or help request. No inventory, gig, or review is generated as if another user supplied it.

### 5.8 Following and Inbox

Following shows permitted updates from explicit follows. Discovery and creator management remain secondary. Explain publisher identity and real update history. Saving an event and following its publisher are separate actions; neither silently performs the other.

Inbox uses **Updates · Messages · Mail**. Updates includes relevant replies and reviewable changes; Messages retains the identity under which a conversation occurs; Mail retains existing digital-mail scopes. Do not collapse all three into a universal unread feed that obscures their meaning. Read state is durable, and each row opens its exact permitted destination.

## 6. Shared component and state contracts

### 6.1 Opportunity/result card

Required content: stable item identity; concrete headline; short explanation; essential limitation; relevant scope; one primary action; private-save affordance; source/details access. Optional content: meaningful source image, short comparison, next relevant time, or a small diagram.

The backend supplies a supported presentation type and typed fields. The client uses designed components. AI output must not introduce arbitrary HTML, new action types, or a unique page layout for every request.

**Low-friction saving:** when a public card/detail already shows the exact item and Only you destination, **Save privately** is the deliberate confirmation and can persist immediately, with Undo. Do not add a second full-screen review for an unchanged bookmark. Use expanded review for interpreted or uncertain fields, calendar/reminder commitments, household destinations, and publication. If authentication interrupts a save, return to the retained item and a compact confirmation with the signed-in identity; signing in itself does not submit an unreviewed action.

| State | Visible treatment | Recovery/action |
| --- | --- | --- |
| Loading | Stable structure and plain explanation of work underway. | Retain navigation; cancel long intake when possible. |
| Partial | Render the verified portion; identify any missing fact that affects the decision. | Ask one relevant question or open the source. |
| Empty | Explain the scope searched without claiming the world contains no options. | Change interests/area or bring an item. |
| Stale | Retain useful historical information with its date, when appropriate. | Recheck; suppress time-sensitive promises. |
| Source unavailable | Distinguish failure from cancellation or disappearance. | Retry or open the source; keep accepted private records. |
| Save pending | Disable duplicate submission and retain the review. | Recover through idempotent retry. |
| Saved | Persistent destination and accepted values. | Open item; undo where supported. |
| Offline | Label cached content and queued drafts. | Save as draft locally if supported; do not claim server save or external completion. |
| Access revoked | Explain unavailable source without cached restricted content. | Keep permitted user-authored notes; choose another action. |
| No remaining attention | Quiet, useful completion state. | Saved items and new capture remain available. |

### 6.2 Action semantics

Keep three dimensions separate. **Persistence status** describes draft, pending, saved, or failed storage. **Action lifecycle** uses suggested, ready, scheduled, completed, dismissed, or blocked. **Outcome provenance** records none, provider handoff opened, provider-confirmed, or user-reported, with a timestamp and evidence where applicable. Review has its own reviewed version/time; it is not proof of storage or completion.

Clients derive precise labels from those fields: Saved privately, Reminder scheduled, Opened at provider, Confirmed by provider, or Marked complete by you. A provider link click keeps the action uncompleted. A completed action must identify its confirmation or user-report provenance. Saving a reminder does not prove delivery. A manual checkmark records the person's claim, not an observed real-world event. These semantics are shared by the API and analytics.

Make undo and editing obvious for reversible private actions. Public posting and household sharing get a preview of the exact payload, identity, and audience. A changed identity invalidates a previous publication preview.

## 7. Utility and discovery feature specifications

Each capability uses the common result, detail, evidence, and save structure. The unique part should be the information and the interaction that explains it, rather than a completely different product shell.

### 7.1 Address intelligence: understand this place

**Inputs:** selected location and permissible public/property data. Preserve supported ATTOM, weather, AQI, alerts, daylight, environmental, water, and civic/election categories under their existing restrictions.

**Experience:** lead with the most useful current question or observation; keep topic navigation and source details available. A person considering a home gets appropriate public place information without learning about its occupants or acquiring household access. A verified member may reach additional authorized household records through an explicit workspace.

**Visuals:** seasonal comparisons, a clear daylight arc, small time-series trends, and maps only at defensible geographic resolution. A regional measure must visually read as regional. Explain observation versus estimate and source date. Avoid a single composite “good/bad home” score that hides assumptions.

**Actions:** save a public place, retain a question, compare a supported aspect, or open the responsible source. Contextual weather suggestions state the inputs and relevant assumptions; they must not imply knowledge of indoor conditions, health needs, or local restrictions that are absent. Civic information remains factual, sourced, and distinct from personalized political recommendations.

**Gate:** preserve missing/unknown states and existing provider licensing/access boundaries. Where current code already computes suggestions, audit its inputs and wording before expanding its authority.

### 7.2 Bills: understand what changed

**Inputs:** one or more user-selected bills and, where available, the applicable tariff/offer. Review billing period, usage, rate structure, fees, credits, and totals before comparison.

**Experience:** answer a specific question such as “Why is this bill higher?” Lead with the amount changed and the supported components. Account for unequal billing days. A single bill supports explanation of its lines; it cannot establish a previous-period increase without a baseline.

**Visuals:** a directly labeled waterfall or aligned before/after bars, a usage-per-day comparison, and a scenario control with visible assumptions. Keep arithmetic decomposition distinct from causal explanation. Show a small table alternative. Do not infer that weather or an appliance caused higher use from a bill alone.

**Illustrative fixture:** previous 600 kWh × $0.18 + $22 = $130; current 780 kWh × $0.20 + $24 = $180. With the previous-rate decomposition convention, usage contributes $32.40, rate $15.60, and fees $2.00. At the previous rate, current usage and current fees total $164.40. The three components sum to $50. This convention is a designed arithmetic explanation, not the only possible allocation of the rate/usage interaction.

**Actions:** correct a field, save the explanation, retain a question for the provider, or compare a genuinely obtainable offer. Complex tiered/time-of-use/net-metering bills need supported tariff models or a clearly limited line-item explanation. Public plan prices do not prove a personalized all-in quote.

### 7.3 Appliances: identify once, make future help easier

**Inputs:** a model plate, barcode/QR where useful, a receipt, or typed model. A general photo can suggest a category; it does not establish an exact production revision.

**Experience:** confirm the model and show the right manual or support path. Start with one useful task, such as finding the relevant maintenance section, rather than demanding a complete home inventory. Ownership records accumulate from actual use.

**Visuals:** readable model-label confirmation and manufacturer document highlights with page references. Show uncertainty before product-specific instructions. Do not draw a plausible replacement diagram and present it as manufacturer evidence.

**Actions:** open the relevant manual section, save the confirmed product, add receipt/warranty details, record user-reported maintenance, or inspect a candidate recall. Recall applicability includes the identifiers in the notice; no match is not a product safety certification. Do not silently publish a serial number or exact home location in a help request.

**Gate:** begin with supported manufacturers and document access. Where exact matching or appropriate content use is unavailable, provide the source lookup path and preserve the user's record.

### 7.4 Hidden access: use resources already available to you

**Inputs:** location and, only when relevant, confirmed membership or eligibility facts. Sources include library benefits, borrowing programs, passes, digital collections, local services, and appropriate assistance programs.

**Experience:** make the benefit concrete: what can be done, the important requirements, and how to start. A card might offer “Explore borrowing options” or “Check this library benefit.” Do not label a discount as free admission or a listed item as currently available.

**Visuals:** one relevant object/place image, compact requirements, and a simple next-step sequence. For comparison, show cost, effort, access conditions, and pickup/online method rather than an opaque recommendation score.

**Actions:** inspect conditions, answer a missing eligibility question, open the official process, save the program, or choose a supported watch. Program existence, possible eligibility, confirmed eligibility, and live availability are separate states. Location-based discovery itself grants no entitlement.

**Gate:** official source access and verifiable current rules. Membership authentication and live inventory are deeper integrations, not implied by the initial discovery feature.

### 7.5 Personal reach: what fits my actual time?

**Inputs:** selected origin, transport mode, time budget, departure time, and relevant accessibility/preferences explicitly chosen. Avoid requiring calendar access.

**Experience:** show useful destinations that fit a real constraint. Let a person adjust time or mode and see the tradeoff. Account for round-trip travel when the question is about usable time at a destination; opening hours and transit service need independent data.

**Visuals:** an interactive map with a clearly defined travel-time area plus an equivalent ranked list. Boundaries represent a modeled reach estimate, not a promise. A compact timeline can separate outbound travel, usable time, and return travel. In dense metros, use cluster/selection behavior rather than overlapping pins. In rural areas, allow explicit broader ranges and online alternatives.

**Actions:** inspect an option, compare two realistic choices, save a place or plan, and open routing. Do not make a no-car user inherit a driving radius. Missing transit data is a coverage state, not a claim of no transit.

**Gate:** routing provider terms, usable destination data, and transport-specific coverage. A simple reliable list can ship before a sophisticated reach map.

### 7.6 Sunlight and seasons: explore a supported model

**Inputs:** date, time, location, and the geometry necessary for the stated model. Existing sunrise/sunset and daylight duration are a separate lower-data capability.

**Experience:** answer a defined outdoor question, such as how modeled shade at a selected outdoor point changes with time. Let users scrub time or select seasonal dates. Expose the model date and important omissions without overwhelming the scene.

**Visuals:** a time-controlled scene or map with a visible timestamp, sun position, and an accessible sequence of static comparisons. Seasonal changes should be legible. Do not simulate precise indoor illumination from coarse elevation data; tree canopy, changed buildings, windows, and interiors can be unknown.

**Actions:** save a comparison or use the result as one input to a plan. No photorealistic certainty when geometry is incomplete.

**Gate:** test geometry coverage, age, model performance, and usefulness before committing this as a general nationwide feature. Show supported daylight information where detailed geometry is unavailable.

### 7.7 Development and route changes: what changed, and why does it matter?

**Inputs:** official permits, project notices, road/transit feeds, or published schedules with identifiable authority and dates.

**Experience:** explain what the record actually establishes, the affected area/time, and an applicable next step. Separate proposal, permit, scheduled work, active work, and completion. Match saved routes only when the user chose to keep them.

**Visuals:** a dated map overlay and a short change timeline. Show a supported alternate route comparison when available. Do not turn a filed permit into a prediction of completed construction or a guaranteed property-value effect.

**Actions:** save the source, inspect official details, review an affected plan, or watch a supported project. A changed webpage layout does not constitute a project update.

**Gate:** reliable local feeds; absence of coverage cannot block the rest of the nationwide experience.

### 7.8 Offers and purchase terms: make the commitment understandable

**Inputs:** canonical merchant offer, source terms, optional user-selected membership/provider details, and a dated screenshot when no live source is resolved.

**Experience:** explain the actual offer, its expiration, conditions, and relevant price changes. Make it clear whether a quoted amount is a published price, a scenario, or an account-specific provider response.

**Visuals:** price-over-time or side-by-side total-cost comparisons using identical periods and explicit assumptions. Show mandatory known fees; flag unknowns that prevent a valid total. Do not manufacture savings from unmatched products or hypothetical eligibility.

**Actions:** save terms, compare supported alternatives, open the provider, or set an available change watch. Affiliate/sponsored influence must be labeled and kept separate from the user's practical relevance criteria.

### 7.9 Events: turn interest into an accurate plan

**Inputs:** official event page/feed or an explicitly published Beacon event. A flyer requires review of missing year, time zone, occurrence, and location.

**Experience:** inspect the event, understand conditions, and save to **Only you** without joining a household. Following the organizer is optional. Source changes become reviewed updates.

**Visuals:** a concise date/time block, location access, requirements, and later a field-level change comparison. Use a simple upcoming agenda before building a full calendar product.

**Actions:** reviewed save, reminder setup, official registration, explicit sharing, or a later source-change decision. Saving in Pantopus does not claim Apple/Google Calendar synchronization. Reservation/registration completion needs independent confirmation.

### 7.10 Local expertise, service instructions, and learning

**Inputs:** official county/state institutions, Extension offices, service directories, CareerOneStop, and appropriate public program sources.

**Experience:** connect the person to the right organization and explain the next step: whom to contact, what to bring, what a published fee covers, or how to begin a supported training search. Surface the capability when relevant; rural residence does not imply farming interests.

**Visuals:** an action sequence or comparison of a few relevant options, with a source-backed checklist. Prefer practical instructions over another demographic or risk score.

**Actions:** open the correct form, save contact/source, prepare a private question, or set a personal follow-up. Location alone cannot establish qualification for assistance, a service price, or an appointment.

### 7.11 Additional location layers

Candidate layers include public recreation, local food/markets, recycling and disposal, charging access, soil/growing information, and water-provider discovery. Each must identify its user job, authoritative sources, actual coverage, next action, and measurable usefulness before entering the default Home selection.

This is an extension framework, not authorization to fill Home with every available dataset. Prefer a few useful outcomes. Some environmental/provider data may already exist in the code; add the missing transformation or service routing rather than duplicating the section.

## 8. Nationwide discovery and relevance

### 8.1 No city whitelist

Every supported US location runs the same discovery process. Seed national indexes and statewide sources before demand; discover institution and jurisdiction pages on demand; reuse shared source records. There is no minimum number of local users and no city-specific product activation switch.

Geographic scope includes proximity, actual service areas, county/regional coverage, state programs, and national/online access. Municipality boundaries, postal areas, school districts, library districts, and utility territories are different. Nearest institution is not necessarily the eligible provider. Unknown service-area matching remains a question rather than an inferred entitlement.

### 8.2 Rural depth and metro depth

| Context | What should improve results | What must remain stable |
| --- | --- | --- |
| Dense metro | More official sources; neighborhood and transit filters; deduplication; fine-grained schedules and accessible destinations. | Same evidence quality, private boundaries, understandable actions, and ability to avoid a map. |
| Small town/county | Regional providers, county services, shared library networks, useful wider travel choices. | Same national product access; no implication that a quiet social feed makes the app unusable. |
| Rural/unincorporated | Service districts, county/state/online programs, relevant public land and expert resources, explicit travel constraints. | No assumption of agriculture, car ownership, or lack of sophistication. |
| New or ambiguous location | User-confirmed location/pin; coarse discovery while more precise matching is unavailable. | No fabricated address certainty or unsupported household association. |

Measure discovery success and freshness across these contexts. The national quality audit is geographically diverse; it is not a plan to limit launch to the audited towns.

### 8.3 Ranking and editorial restraint

Retrieve broadly, then apply evidence, coverage, requirement, date, and access filters. Rank viable candidates using the user's expressed task, selected interests, practical effort, timeliness, and novelty. Do not infer sensitive personal characteristics from location. Users can say **Not relevant**, edit interests, or remove a place.

Source authority, extraction confidence, geographic match, eligibility, and current availability are distinct dimensions. They must not collapse into a single “92% trustworthy” badge. A fact can be well sourced yet irrelevant to this user; a compelling idea can have insufficient evidence.

No daily surprise quota. A previously shown program should not return indefinitely because it is easy to retrieve. A meaningful new version may justify a return; otherwise prioritize another task or a quiet state.

## 9. AI, evidence, and personal context

AI helps classify intake, extract facts, connect related concepts, explain evidence, translate content, and propose a next step. Deterministic calculations and explicit requirements determine arithmetic and applicability. Designed components present the result.

Keep the original document/source available during review. Each meaningful claim points to supporting material with retrieval and source dates. A fluent explanation without evidence cannot promote an unknown value to a known one. Untrusted webpage/document text is data, not an instruction to the application or its tools.

Personal context is progressive and explicit. A saved bill can improve the next bill comparison; a confirmed model improves the next product lookup; a chosen library improves benefit relevance. Users can inspect and delete retained context. Do not require broad email/calendar account access for the core experience. Optional future connections receive their own scoped design and permission review.

Fallbacks are designed experiences: a template explanation, supported fields only, original source, or a private note. An unavailable model does not make saved records inaccessible. Provider failures, model failures, and empty results remain distinguishable in internal diagnostics.

## 10. Privacy, public identity, and social connection

Private capture is the default. A personal record belongs to its account; a household record belongs to the authorized shared workspace; a public post has an explicit acting identity and actual audience. Neither saving a place nor receiving a public source result grants access to another household.

Private-to-public transitions use a separate blank composer. The person intentionally writes or selects the content to publish. Private text, exact home address, media, identity associations, bill identifiers, and serial numbers do not transfer by default. A final preview shows the payload, identity, and audience; submission is explicit.

Retain the two connected journeys from the earlier proposal: a private repair concern can become an independently composed public question and later a permission-aware private source bookmark; an address-free follower can save an event personally and review later organizer changes. Appendix B defines transitions and recovery in detail.

Product utility creates optional social entry points: ask, share an outing, recommend a program, request help, sell an item, or follow a relevant organizer. Maintain genuine supply and honest response states. A source listing is not a consenting publisher profile, a fabricated review, or an available gig worker.

## 11. Delivery sequence and work packages

The complete vision spans several releases. Ship a finished vertical journey before broadening categories or completing a cosmetic redesign of every surface. Existing reliability/release obligations continue alongside this work.

| Package | Product result | Frontend work | Backend/data work | Exit evidence |
| --- | --- | --- | --- | --- |
| P0: contracts and design validation | A coherent scope/audience model and tested first journey. | Review prototype, navigation comprehension, capture and result states. | Confirm existing contracts; source access/coverage audit; choose initial supported categories. | Users understand the outcome and ownership; selected sources support the promised actions. |
| P1: national discovery + private keep | Any US location can initiate discovery; a sourced program/link becomes a retrievable private item and can be explicitly shared as a public resource. | Home link/text intake, location context, result/detail, compact private-save confirmation, saved list, errors, safe public-card share, links to existing publishers. | Source registry, national seeds, on-demand discovery, evidence, protected intake, personal SavedItem, idempotent saves, public share projection with no private fields. | Real source → useful result → deliberate save → cross-session retrieval; public sharing leaks no private context; no local signup dependency. |
| P2: dependable return + existing insight improvements | Saved items, reviewed personal event plans and relevant changes provide continuing value. | In-app Updates, personal event review/agenda, change review, reminder setup, source/detail improvements; existing publisher follow remains explicit. | Supported watchers, source versions, account-owned event/action/reminder state, notification routing. | No silent overwrite; duplicate jobs do not create duplicate change items; address-free event save and exact permitted return work. |
| P3: bills + products | Two high-value capture categories use the shared experience. | Bill review/comparison, model confirmation/manual view, private product records. | Supported bill parsing/calculations, model/manual adapters, recall matching, evidence and file handling. | Meaningful task success with real selected inputs; unsupported structures handled honestly. |
| P4: reach + richer local discovery | More useful choices under time/access constraints. | Reach list/map, comparisons, richer benefits/events/services, metro filtering. | Routing, source expansion, event identity, service-area joins, licensed feeds where chosen. | Geographic quality evaluated across population densities; no false live availability. |
| P5: deeper social connections | Utility leads into real questions, replies, publisher plans, commerce, and help. | Blank composer/review, reply→private association, fuller followed-event journey, contextual marketplace/help entry. | Permission-aware associations; reuse the P2 account-event/change contract and existing social services. | Original connected journeys complete with real consenting test actors and correct boundaries. |
| P6: advanced modeling and live integrations | Detailed sunlight, richer change detection, and live provider actions where justified. | Model controls, precise change visuals, provider-action states. | Geometry validation, partner inventory/reservations, additional feed integrations. | Data-specific coverage and correctness gates; measurable value beyond simpler alternatives. |

Packages may overlap when their dependencies are satisfied. For example, evidence/source UI improvements and source acquisition can proceed together. Reliable notification and access work cannot be deferred merely because a later package mentions social connections. P1 must include its own usable return to the saved item; P2 extends that with monitored changes.

Do not gate national availability on completion of P6 or marketplace liquidity. Use capability/source gates, not a list of enabled cities. External spending, account creation, data agreements, and production cutover remain separately reviewable operational decisions.

## 12. Product validation and launch learning

Use a nationwide evaluation set spanning dense metros, small towns, rural/unincorporated areas, regional service boundaries, limited data, and new/ambiguous locations. Recruit people around real tasks and compare against how they currently solve them. Separate first-time discovery from expert/familiar use.

Prototype tasks evaluate comprehension and interaction. Real provider tests evaluate source accuracy and action feasibility. Live product cohorts evaluate usefulness and voluntary return. Do not use simulated replies, prototype saves, or generated inventory as adoption evidence.

Measure time and assistance to a useful result, factual/eligibility mistakes, successful next steps, voluntary second items, meaningful returns, and source-maintenance effort. Useful activation includes an immediate successful action even when the person does not save anything. Count external action completion only when observed or explicitly reported, and label self-report. Primary all-attempt denominators include failed/unsupported intake so success is not inflated by excluding difficult users; supported-input rates are separate diagnostics. Appendix B defines event semantics and cohort comparisons.

Nationwide marketing should demonstrate a real supported outcome. Broad geographic reach can coexist with one clear initial promise. Use bounded paid learning across geographic strata; measure acquisition cost per useful activated user and retained useful user, not downloads alone. Do not advertise specific borrowing inventory, savings, same-day reservations, or uniform local richness without support.

A weak result can mean discovery coverage, relevance, comprehension, action friction, or return usefulness failed. Diagnose the layer before adding another feature. Sustained value from one category supports deeper investment; attractive visuals with no changed behavior do not.

## 13. Review and acceptance checklist

### 13.1 Design acceptance

- A first-time user can explain the next useful action without being taught the navigation.
- The primary decision and any disqualifying condition are visible together.
- Users correctly distinguish Only you, a named household, and a public audience.
- Capture type errors and uncertain fields are correctable without restarting.
- A map/chart can be understood through text and alternative controls.
- Narrow screens, long labels, large text, dark mode, keyboard, and screen readers preserve the task.
- Reduced motion retains every piece of information and action.
- Empty, partial, unavailable, stale, offline, and revoked states have distinct recovery behavior.
- Source changes never silently overwrite accepted private details.
- No mock activity, arbitrary eligibility, or premature success is used to make the interface feel complete.

### 13.2 Engineering acceptance

- Account/household/public authorization is enforced on list, detail, search, files, previews, notifications, and old links.
- Every source-derived claim used for a decision can be traced to evidence and a version/date.
- Sources are refreshed centrally with bounded work; slow discovery does not block unrelated app use.
- Save/action/watch retries are idempotent at the application level.
- Unsupported documents, missing source fields, and denied provider access fail into the designed states.
- A new supported US location can initiate discovery without a prior local deployment or local user count.
- Membership/service-area assumptions are explicit; API emptiness is not treated as exhaustive absence.
- Cross-platform entry, authentication continuation, saved state, change review, and notification destinations are verified against a release candidate.

### 13.3 Documentation and companion acceptance

The companion is a review aid with fictional data. Test its local navigation, capture review, illustrative bill calculation, and event-change decisions. Inspect at phone and desktop widths, light/dark themes, and reduced motion. Record what it demonstrates and what is specified only. No prototype behavior is evidence of backend implementation.

## 14. Decisions to resolve through evidence

| Decision | Working default | What could change it |
| --- | --- | --- |
| First acquisition demonstration | Location → overlooked useful program → clear next step and private save. | Another supported intake category produces substantially better real first success and voluntary return. |
| Navigation labels | Home, Nearby, Following, Inbox. | Repeated observed confusion compared with a tested alternative. |
| Initial personal planning depth | Upcoming agenda and reviewed event/reminder saves. | Users repeatedly need a full calendar view or integration to complete the core task. |
| Initial product/manufacturer coverage | A documented supported set with exact-model confirmation. | Measured task demand and obtainable manufacturer content justify expansion. |
| Detailed sunlight | Separate data-validation track. | Coverage and model tests support honest useful outputs at the claimed resolution. |
| Discovery breadth | National availability with progressive source depth. | Source-quality findings change a category's presentation or supported access, without a city signup gate. |
| Notifications | Contextual opt-in for chosen reminders/meaningful changes; in-app alternatives always available. | User preference and delivery evidence tune frequency, not access to saved records. |
| Monetization | No new paid tier is required to validate the initial utility loop. | Outcome, operating-cost, and willingness-to-pay evidence supports a separately designed model. |

The product promise and nationwide requirement are the direction. Feature ordering, labels, and individual visual treatments remain testable design decisions. “Best experience” is an aspiration to evaluate through comprehension, successful action, trust, and repeated usefulness.

---

## Appendix A. Technical and source design

**Status: proposed architecture, September 8, 2026.** This appendix describes new implementation work. Repository references identify inspected source, not deployed behavior. The checkout was on `master` during drafting, with unrelated local files preserved. No application implementation, migration, provider enrollment, deployment or live account action was performed. Current remote PR/CI and release state were not reverified by this appendix and must not be inferred from historical handoff statements.

### A.1 System boundary and nationwide promise

The backend should accept a location anywhere in the supported U.S. geography and resolve useful possibilities without a city whitelist, household membership, neighbor activity or a municipal partnership. National datasets establish a baseline; relevant local sources add specificity when discoverable. The product promise is a nationwide request path with honest source coverage, not identical information at every address.

Discovery and persistence are separate operations. A signed-out visitor can inspect public results. Saving requires an account and explicit intent. A saved address is a private location bookmark; it is not residency verification, ownership or permission to access a Home. User-provided files and personal records must not enter shared public caches.

Use PostgreSQL/PostGIS and the existing worker infrastructure initially. Avoid a separate graph database or an unrestricted autonomous browsing agent. Relations, spatial joins, versioned evidence and bounded extraction jobs are sufficient for the first implementation.

### A.2 Location and source resolution

Create a `LocationContext` from a typed place/address, current coordinates or a saved location. Preserve input accuracy: a ZIP centroid cannot become an exact household location. Resolve country/territory, state, county-equivalent, incorporated place where applicable, timezone, optional tribal jurisdiction, and relevant service areas. Administrative jurisdiction and postal city are different fields. Unincorporated places must resolve through county and regional providers without requiring a city record.

| Scope | Matching rule | Example and qualification |
| --- | --- | --- |
| Local/place | Distance or verified service boundary | A market nearby; proximity does not prove delivery or eligibility. |
| County | County-equivalent identifier | County Extension office or public department. |
| Regional/service area | Published polygon or explicit served-area list | Water system, library district, regional utility; may cross counties. |
| State/territory | Administrative code | State agency, university service or statewide program directory. |
| National | Supported country/territory | A national service directory queried by distance or geography. |
| Online | Remote delivery plus explicit geographic restrictions | An online workshop accessible from this location; do not pretend it is nearby. |

The resolver evaluates these scopes together. A relevant online service may be more useful than a distant local office. “More local” is a ranking input, not automatic authority or precedence. Apply precedence only to truly substitutable facts, such as a system-sourced water boundary over a modeled candidate, while retaining disagreement evidence.

Use three acquisition paths:

1. **Known national indexes:** periodically ingest bulk files or query documented APIs, normalize IDs/geometries and build spatial indexes. Resolve location against this local store first. Shared observations are keyed by source record and geographic scope, not user.
2. **Known authority routing:** a national institution directory links to state and county organizations. Maintain verified parent/child authority links and their public domains. This is a registry of source organizations, not a whitelist of launch cities.
3. **On-demand source discovery:** for missing categories, search using jurisdiction names and service intent, identify likely responsible organizations, then inspect their actual pages. Search snippets nominate candidates; they are not evidence for a displayed fact. Reuse successfully validated sources for later visitors.

Detect documented platforms before generic extraction: ArcGIS feature/map services, Socrata catalogs, CKAN resources, RSS/Atom, iCalendar, structured JSON-LD, then HTML tables/text and PDFs. Platform adapters need domain, dataset ID, schema mapping and coverage metadata; they should not contain bespoke business logic for every municipality. Sources that require login, unsupported rendering or an agreement return an access state rather than triggering bypass attempts.

Set an interactive budget and return partial, useful results promptly; source discovery continues in a bounded background job. Initial targets, subject to measurement: cached first results within two seconds and a discovery pass within sixty seconds. Enforce maximum URLs, bytes, tokens and cost per pass. A timeout returns “not yet checked” for that category, never “nothing exists here.” Add a negative-cache expiry to avoid repeated expensive searches without freezing a rural location into a permanent empty state.

### A.3 Evidence, freshness and coverage contracts

Implement normalized `Source`, `SourceObservation`, `Candidate` and `CoverageObservation` records. Keep schema and transformation versions so corrected parsers can reprocess stored evidence where retention rights permit.

| Record | Required fields and meaning |
| --- | --- |
| `Source` | Stable ID; publisher; authority relationship; canonical URL/domain; acquisition method; external dataset ID; scope/geometry; supported categories; attribution/license and storage restrictions; access status; expected cadence; adapter version. |
| `SourceObservation` | Source/native record ID; fetched time; published/updated time when actually supplied; effective start/end; source timezone; HTTP validators; normalized content hash; extraction version; evidence pointers; upstream status. |
| `Candidate` | Kind, title, proposed useful outcome, responsible organization, location/delivery mode, applicability expression, action URL/contact, date/price fields, evidence IDs, limitations, expiry, deduplication key. |
| `CoverageObservation` | Category and scope attempted; checked time; result state; source count; known limits; next retry; explanation suitable for the UI. |

Coverage states should distinguish `available`, `partial`, `not_checked`, `not_found_in_checked_sources`, `unsupported`, `temporarily_failed`, `requires_access`, and `stale`. An HTTP 200 is not proof of complete coverage. A directory count of zero is only zero in that directory. Record rural, tribal and territorial gaps explicitly.

Freshness uses multiple clocks. `fetched_at` means Pantopus checked the source; it does not refresh a five-year-old statistic. `source_updated_at` means the publisher changed a record. `effective_at` and `expires_at` describe applicability. A fetched page lacking dates may support a contact link but not a confident deadline. Recurring schedules need timezone, exceptions and an observation date; calendar expansion alone cannot establish that this year's event is happening.

Use field-level evidence: a normalized value points to a source record, JSON pointer, text span or PDF page and extraction confidence. Retain short excerpts or hashes where permitted, rather than indiscriminately copying whole websites. Track geographic confidence separately from extraction confidence and source authority. A perfectly parsed modeled polygon is still a modeled polygon.

Each displayed possibility needs a concrete next step, explanatory match and supporting evidence. Rank by applicability, actionability, freshness, user interest and novelty; use distance only when meaningful. Do not invent a numeric universal “truth score.” Suppress duplicate organizations and syndicated copies using canonical IDs, addresses and source relationships. Preserve conflicting authoritative dates as a conflict requiring confirmation.

### A.4 Personal records and restricted sources

Introduce owner-scoped tables instead of adding nullable `home_id` branches throughout household APIs.

| Contract | Fields and behavior |
| --- | --- |
| `SavedItem` | `id`, `owner_user_id`, kind, user title/note, optional location, source reference, approved snapshot reference, captured version, state, created/updated times. Kinds include possibility, place, post, link, document, bill, product, event and personal note; typed child records can hold category-specific details. A save succeeds even if enrichment fails. |
| `Action` | Owner, optional saved item, kind, user-reviewed fields/version/time, due/start/end, timezone, recurrence and reminder preference. Lifecycle: suggested, ready, scheduled, completed, dismissed, blocked. Persistence status and outcome provenance are separate as specified in §6.2; no ambiguous done field. |
| `Watch` | Owner, saved item/source target, explicit predicate, baseline version, frequency, notification preference, last evaluation, last notified change, paused/deleted state and failure status. Saving does not silently authorize push notifications. |

Use database ownership policies plus API authorization for every read/write; service-role queries must apply explicit owner predicates. Add client request IDs and uniqueness constraints for retry-safe saves and action creation. A Home action remains a separate household record; copying a personal item into a Home is a reviewed destination action with household permissions, never an automatic conversion.

**Shared time contract:** timed events retain UTC instants plus the IANA source timezone and original source text. All-day items retain local calendar dates rather than invented midnight instants. Date-only deadlines carry explicit date-only semantics until a time is chosen. Recurrence is anchored to the event timezone; clients consume the same server-normalized occurrences. Show source and viewer timezones when they differ. Validate DST gaps/overlaps, overnight events, all-day dates, missing year/timezone, recurrence exceptions, and a user traveling between zones. Do not resolve a missing timezone from a broad longitude band or silently guess an ambiguous occurrence.

Public web sources may retain an attributed, permitted snapshot. Restricted Pantopus posts, household records and other access-controlled sources require different treatment: reauthorize source access on display, enrichment, refresh, notification construction and export. A bookmark must not become a permanent access bypass. On revocation, preserve the user's independently authored note and bookmark shell, redact restricted source-derived fields, stop dependent watches and show an unavailable-source state. Source deletion, cancellation, access revocation and temporary fetch failure are distinct events.

A reviewed personal calendar event may preserve user-entered commitments, while linked restricted descriptions remain governed by source permissions. Define this field provenance explicitly. Source updates propose a date change; they do not silently move a user's commitment. ICS export needs a stable UID and accurate timezone, but exporting a file does not prove a remote calendar was updated. Likewise, opening an application link is not applying, calling a number is not obtaining service, and saving a deadline is not delivering a reminder.

### A.5 AI extraction and protected intake

Use AI for bounded interpretation: classify a source, extract structured fields, normalize a schedule, explain an already-supported match and propose an action. Deterministic rules own dates, geographic joins, unit conversions, expiry, permissions and eligibility predicates. Do not infer personal eligibility from an address or represent an area statistic as a parcel fact.

The extraction schema should require evidence IDs for each factual output, original date text, normalized date/timezone, missing fields, contradictions and confidence. Validate referenced evidence exists and actually contains the claimed value. Reject invented URLs, unsupported price/availability claims and ambiguous dates. An extraction model never publishes posts, enrolls users, submits applications, purchases items or modifies calendar commitments.

Treat all imported text, web pages, PDFs and metadata as untrusted content. They cannot override system instructions, request credentials or activate tools. The extraction worker receives only the relevant content and a strict schema, without account mutation tools. Keep model/prompt/schema versions and a labeled evaluation corpus; schema-valid JSON alone is not semantic accuracy.

Create a dedicated private intake route for pasted text, URLs, images and documents. Protected uploads use private object storage, opaque object IDs, short-lived authorized retrieval, MIME signature validation, malware scanning and bounded isolated document/OCR processing. Apply retention/deletion to originals, derivatives, extracted text and embeddings. Avoid sending unrelated private context to a model. Do not put signed URLs, document contents or typed addresses into ordinary logs.

A shared URL fetcher must enforce HTTP(S), public-network egress, DNS/IP validation at connect time and after redirects, private/reserved-address denial, redirect/byte/time limits, content-type checks and decompression limits. Run script rendering only in an isolated, credential-free worker when permitted and necessary. Respect source access restrictions and applicable reuse terms. Do not bypass logins, CAPTCHAs or blocked APIs. Failed fetches leave the saved original usable.

### A.6 APIs, workers and change delivery

All names below are proposed, not existing deployed endpoints.

| API | Contract |
| --- | --- |
| `POST /api/discovery/resolve` | Location, optional interests/time horizon; returns context, candidates, category coverage and continuation token. Anonymous use is rate-limited. |
| `GET /api/discovery/runs/:id` | Owner/session-scoped progress and additional results; exposes no raw fetch logs. |
| `GET /api/discovery/items/:id/evidence` | Safe public evidence projection or authorized restricted projection. |
| `POST /api/personal/intakes` | Text, URL or authorized private object ID; creates a durable intake with explicit status. |
| `GET/POST/PATCH /api/personal/saved-items` | Owner-scoped retrieval, save and user edits; retry IDs and revision checks. |
| `POST /api/personal/actions` | Reviewable action creation; missing required fields return clarification state. |
| `POST/PATCH/DELETE /api/personal/watches` | Explicit watch configuration, pause and deletion. |
| `GET /api/personal/changes` | Durable changes with seen/dismissed state, independent of push delivery. |
| `POST /api/personal/changes/:id/accept` | Expected item revision, source version, reviewed field patch and idempotency key; atomically apply only the reviewed change or return a conflict review. |
| `POST /api/personal/changes/:id/decline` | Record the considered source version and keep accepted user values; no repeat notification for the same dismissed revision. |
| `DELETE /api/personal/saved-items/:id` | Remove the owned item and stop dependent watches under the defined undo/retention policy; does not delete its public source. |
| `DELETE /api/personal/intakes/:id` | Owner-authorized deletion of intake and governed originals/derivatives; explain any separately retained saved item. |

Track latest observed, user-accepted, and dismissed source versions separately. An open review on a second device cannot overwrite later user edits; its expected revision mismatch returns the actual conflict and preserves both versions for review. Replaying an accepted or declined request returns the prior logical result. Source refresh does not reopen a dismissed revision as a new change.

Add jobs for source-index import, bounded source discovery, observation refresh, intake extraction, evidence validation, candidate materialization, watch evaluation, change delivery and retention cleanup. The first user in a geography can trigger discovery; subsequent users reuse public observations. Do not start one identical provider fetch for every watcher.

Use a single-flight key `(source_id, native_record_or_scope, requested_version)` for fetches, retry with jitter/backoff and respect provider rate limits. Poll cadence follows source volatility, official update cadence and active watches: hours for schedules where justified, days for directories, longer for published annual releases. Retain last-good observations with visible stale status; never label fallback data current.

Normalize before hashing so page chrome changes do not create alerts. Diff meaningful fields such as date, location, status, price or official instructions. Use a unique change key `(watch_id, observed_version, predicate_version, change_kind)` and transactional outbox for durable notification intent. Consumers remain idempotent because retries are expected. Recheck authorization and notification preferences immediately before delivery. A failed push leaves the durable change visible; duplicate jobs must not create duplicate user-visible changes.

### A.7 Inspected code: reuse and missing contracts

References are repository-relative and include inspected one-based starting lines.

| Existing source | Reuse and required extension |
| --- | --- |
| [backend/services/placePreviewService.js](../backend/services/placePreviewService.js) (line 102) | Point-based public section composition without a Home; extend with opportunity/source resolution, not a Home requirement. |
| [backend/services/context/locationResolver.js](../backend/services/context/locationResolver.js) (line 46) | Existing location preference handling is useful, but timezone inference uses broad geographic/longitude rules. Replace with maintained timezone boundary lookup and test DST/territorial cases. |
| [backend/services/ai/neighborhoodProfileService.js](../backend/services/ai/neighborhoodProfileService.js) (line 117) | Census geography lookup; `:268` cached tract resolution and `:397` independent source composition. Preserve geographic vintages and add service-area relations. |
| [backend/services/context/contextCacheService.js](../backend/services/context/contextCacheService.js) (line 21) and `:119` | Provider/type/geohash caching and stale retrieval. Add source-record identity, validators, versions, rights and coverage observations. |
| [backend/serializers/placeIntelligenceSerializer.js](../backend/serializers/placeIntelligenceSerializer.js) (line 143) | Existing access/status/as-of/source/coverage envelope. Extend evidence and freshness semantics; static source labels are not provider validation. |
| [backend/services/placeSectionAdapters.js](../backend/services/placeSectionAdapters.js) (line 384) | Existing water lookup uses county/city context. EPA polygons/PWSIDs support a stronger candidate-provider resolver with provenance. |
| [backend/routes/savedPlaces.js](../backend/routes/savedPlaces.js) (line 7) and `:25` | Account-owned saved coordinates already exist. They are not the proposed universal SavedItem, Action or Watch contracts. |
| [backend/database/schema.sql](../backend/database/schema.sql) (line 6240) and `:6856` | `HomeCalendarEvent` and `HomeTask` require `home_id`; preserve household ownership boundaries. |
| [backend/services/ai/agentService.js](../backend/services/ai/agentService.js) (line 745) | Authorized mail retrieval and strict JSON-schema output are useful patterns. General URL/PDF/OCR intake and evidence-grounded extraction remain new work. |
| [backend/routes/upload.js](../backend/routes/upload.js) (line 1833) | Existing AI upload is image-only and documented as returning public URLs; unsuitable as the private-document intake contract. |
| [backend/worker.js](../backend/worker.js) (line 34); [backend/jobs/pgBossJobs.js](../backend/jobs/pgBossJobs.js) (line 19) | Separate workers, retries and singleton scheduling exist. Add source/item queues, outbox and per-change idempotency. |
| [backend/services/homeRecordWatchService.js](../backend/services/homeRecordWatchService.js) (line 88) and `:182` | Narrow Home/PMMS baseline/watch evaluation pattern exists. General personal watches and source diffs do not follow automatically from it. |

### A.8 Source catalog and access limits

These are documented acquisition candidates, not newly configured integrations. Confirm terms, working responses and operational budgets before implementation commitment.

| Source | Acquisition and useful output | Limit |
| --- | --- | --- |
| [Census geocoder](https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html) | Address/coordinate geography API and batches; county/state/tract routing. | Address-range geocodes are not rooftop certification; retain benchmark/vintage and input accuracy. |
| [NIFA Extension network](https://www.nifa.usda.gov/about-nifa/what-we-do/extension) and [institution directory](https://www.nifa.usda.gov/grants/land-grant-university-website-directory) | Route national → state institution → county office; local expertise, classes and testing instructions. | Website directories, no unified national content API verified; exact services and fees vary. |
| [EPA water areas](https://www.epa.gov/ground-water-and-drinking-water/public-water-system-service-areas?tab=map) and [REST service](https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/Water_System_Boundaries/FeatureServer) | National polygons and PWSIDs, V3 March 2026; candidate supplier and official information joins. | Mixed modeled/authoritative boundaries; private wells and some systems absent. Not a tap test or guaranteed supplier. |
| [HRSA site downloads](https://data.hrsa.gov/data/download?titleFilter=Health+Center) | Daily CSV/XLSX of health-center service-delivery/look-alike sites; nearby contact/directions. | No appointment, personal cost or service-availability guarantee; preserve suppressed shelter addresses. |
| [USDA Local Food Directories](https://www.ams.usda.gov/local-food-directories/farmersmarkets) | Officially advertised developer API; markets, published times, offerings and payments. | API documentation returned 403 during research; authentication/rate limits and live responses unverified. Check operator schedules. |
| [USDA Service Centers](https://www.farmers.gov/working-with-us/service-center-locator) | State/county website locator for FSA/NRCS/Rural Development contacts. | No public bulk/API access verified; identifies an office, not funding eligibility. |
| [USDA SNAP retailer locator](https://www.fns.usda.gov/snap/retailer-locator) | Downloadable coordinates/CSV for authorized retailers. | Select current authorization data; historical authorization is not current acceptance, hours or inventory. |
| [FEMA IPAWS developer information](https://www.fema.gov/ko/emergency-managers/practitioners/integrated-public-alert-warning-system/technology-developers) | CAP public alerts from the All Hazards Information Feed. | Approved access/agreement required; archived alerts cannot substitute for a live feed. |
| [CPSC recalls API](https://www.cpsc.gov/Recalls/CPSC-Recalls-Application-Program-Interface-API-Information) | Structured recall records to keep a saved product useful. | Needs reliable brand/model or identifiers, not location alone; no match is not a safety certification. |
| [OpenEI utility-rate database](https://data.openei.org/submissions/5) | Tariff records for a future saved-utility/bill workflow. | Supplier/plan/usage must be confirmed; an address alone cannot establish a bill or personalized savings. Record tariff dates. |
| [Socrata](https://dev.socrata.com/) and [CKAN](https://docs.ckan.org/en/2.11/api/) | Reusable catalog/resource adapters for discovered public datasets. | Platforms are access mechanisms, not coverage guarantees; each publisher's schema, freshness and terms differ. |


#### A.8.1 Core category sources and additional integrations

The following source families complete the acquisition plan for the product categories specified above. These are source candidates and access routes, not a declaration of live Pantopus coverage.

| Source | Acquisition and product use | Access/interpretation boundary |
| --- | --- | --- |
| [IMLS library data](https://imls.gov/research-evaluation/surveys/public-libraries-survey-pls) | Annual downloadable national systems/outlets seed; follow official institution/state-network links to programs. | Directory metadata does not establish current benefits, eligibility, inventory, or exact service boundaries. |
| Official library/state-network pages | HTML/PDF/structured-feed extraction for borrowing, passes, learning and digital access; supported by sources such as [Idaho statewide resources](https://libraries.idaho.gov/lili/) and [Iowa's library directory](https://statelibraryofiowa.gov/i-want-0/find-library). | Confirm each program's service-area and membership rules; statewide coordination does not mean every offer is open to every resident. |
| [myTurn](https://myturn.com/api-docs/) | Authorized platform adapter for supported item browsing/borrowing functions. | Limited public API functionality and eligible subscriptions; no verified all-tenant national inventory feed. |
| [GE manual lookup](https://www.geappliances.com/ge/service-and-support/literature.htm) and other manufacturer support sites | Resolve confirmed models to manuals and support material. | Manufacturer-specific integration; no universal manual API or bulk illustration redistribution rights established. |
| [Schema.org Offer](https://schema.org/Offer) and [Awin offers](https://help.awin.com/apidocs/promotions) | Publisher markup and authenticated offer feed with terms, dates, regions and change filtering. | Visible terms still matter; network and advertiser membership affect access. Published price is not a personalized checkout quote. |
| [AT&T Broadband Facts](https://www.att.com/broadbandlabels/broadband-facts-machine-readable-plans/) | Machine-readable published plan labels for a supported internet-offer workflow. | [Provider explanation](https://www.att.com/support/article-modal/my-account/000100570/) distinguishes headline price from promotions and government taxes. Match plan/location/date; do not invent an all-in total. |
| [Ticketmaster Discovery](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/) | Keyed API with event IDs, locations, sale dates, status and source links. | Participating-platform coverage, quotas and terms; price ranges/status do not prove a specific available ticket. |
| Organizer feeds and [Schema.org Event](https://schema.org/Event) | Published iCalendar/RSS/structured event metadata and canonical pages. | Resolve occurrence, year, timezone and exceptions. A flyer alone cannot provide live updates. |
| [211 access process](https://register.211.org/Home/FAQs) and [Open Referral](https://openreferral.org/about/technology-overview/) | Obtain service data through authorized agreements; normalize organizations/services/locations using a common interchange model. | A trial has limited data; a schema is not a national dataset or a redistribution license. |
| [CareerOneStop APIs](https://api.careeronestop.org/api-explorer/) | Authenticated location-based job-center, training-provider and related resource queries. | Confirm relevant program details; a listing does not establish admission, free tuition or personal qualification. |
| [RIDB](https://ridb.recreation.gov/docs) and [NPS API](https://www.nps.gov/subjects/digital/nps-data-api.htm) | Recreation locations, activities, published fees/access and applicable alerts. | Federal/NPS coverage supplemented by local/state sources; documented discovery access is not guaranteed live campsite inventory or booking access. |
| [DOE AFDC station API](https://developer.nlr.gov/docs/transportation/alt-fuel-stations-v1/) | Keyed station, route-nearby and connector/access data for supported travel questions. | Station records/status are not real-time stall availability; retain verification dates and conditional/missing pricing. |
| [FCC broadband map and downloads](https://help.bdc.fcc.gov/hc/en-us/articles/10467446103579-How-to-Use-the-FCC-s-National-Broadband-Map) | Provider-reported availability and area/provider downloads; official address lookup where appropriate. | Building Fabric licensing and API access are distinct issues. A public bulk API is not assumed to be an unrestricted address-search API. Provider confirmation is needed for serviceability. |
| [ArcGIS discovery](https://developers.arcgis.com/rest/users-groups-and-items/search-reference/) and [feature queries](https://developers.arcgis.com/rest/services-reference/enterprise/query-feature-service-layer/) | Discover official publisher datasets, pin IDs, query supported spatial attributes. | A publishing platform supplies no uniform nationwide municipal schema; verify owner, fields, freshness and reuse terms per dataset. |
| [USDA Soil Data Access](https://sdmdataaccess.nrcs.usda.gov/WebServiceHelp.aspx) and [hardiness data](https://planthardiness.ars.usda.gov/pages/map-creation) | Spatial/tabular queries and GIS files for a supported growing/soil explanation. | Map-level estimates are not yard tests; respect attribution and derivative-map conditions. |
| [USGS 3DEP](https://www.usgs.gov/3d-elevation-program/about-3dep-products-services) | Elevation/lidar inputs to an evaluated outdoor sunlight model. | Coverage, acquisition age, building/tree representation and model validation determine usable resolution; no automatic indoor-sunlight capability. |
| Licensed routing/isochrone provider; [Mapbox isochrones](https://docs.mapbox.com/api/navigation/isochrone/) are one candidate; published [GTFS feeds](https://gtfs.org/documentation/schedule/reference/) for transit | Travel-time contours and route estimates for supported modes; agency schedules and supported real-time updates for transit. | Provider selection, access, licensing and geographic/mode coverage must be established for P4. Mapbox's documented isochrones cover walking/cycling/driving, not a transit service. Transit requires an appropriate routing engine/provider and usable feeds; venue hours are independent. |

Source onboarding must confirm the actual endpoint, credentials, quotas, permitted storage/display, current response shape, attribution and failure behavior. The public directory/source layer remains available without securing every deeper provider integration first.

Keep existing weather/AQI, supported ATTOM and environmental/civic sources available under their current authorization and provider contracts. Add sources because they support a useful decision or next step. A broad catalog is not itself a successful discovery experience.

### A.9 Dependency work packages and acceptance

| Package | Depends on | Acceptance evidence |
| --- | --- | --- |
| A. Nationwide location contract | Existing location/preview code | Geographic fixtures include rural unincorporated areas, county boundaries, Alaska/Hawaii, tribal/territorial cases and ambiguous ZIPs; no city gating; accurate timezone or explicit uncertainty. |
| B. Source registry and safe ingestion | A | At least one bulk index, API, authority directory and generic document path; field evidence, rights, failure states and reproducible normalization; hostile URL/document cases rejected. |
| C. Discovery and ranking | A, B | First-user cold runs and cached repeats across a nationwide stratified sample; useful linked outcomes where supported; truthful coverage where absent; measured latency/cost and no inferred eligibility. |
| D. Personal persistence/private intake | Ownership design | Save succeeds without a Home and survives failed enrichment; cross-account access denied; restricted revocation redacts derivatives; originals/derivatives delete correctly. |
| E. Actions and watches | B, D | Reviewed dates/timezones; DST/recurrence/cancellation cases; duplicate retries harmless; source edits propose changes; no invented completion or reminder-delivery claim. |
| F. Queue/delivery reliability | E | Concurrent refresh collapses; crash/retry/outbox cases preserve one change; preference and authorization rechecks; stale/recovery states visible. |
| G. Capability-specific release validation | Dependencies of every enabled capability; A–D for the initial discovery/save slice, plus E–F when actions/watches are enabled | Exact builds/migrations/flags and rollback reviewed; current CI, staging provider contracts and released-platform journeys independently verified. A completed discovery/save release need not wait for monitored-change features. Existing mandatory reliability checks still apply. |

Measure evidence-supported useful discoveries, explicit saves, completed user-confirmed actions and voluntary returns. Track bad matches, expired suggestions, failed extraction, missing coverage and notification regret alongside conversion. A nationwide technical path and working queues are necessary infrastructure; demand and sustained usefulness still require observed user behavior.

## Appendix B. Journeys, social connections, and measurement

Status: proposed behavior for web, iOS, and Android. This section specifies work to build and validate; it does not claim those capabilities are deployed. Nationwide availability starts with the first person in an area. Neighbor participation, household creation, and creator recruitment are never prerequisites for the core useful outcome.

### B.1 The core promise and first visit

Pantopus helps people discover useful things their location already gives them access to, understand what applies to them, and keep the things worth returning to. Deliver a concrete reveal before demanding extensive setup. An existing shared destination takes precedence over general onboarding.

An undecided visitor gets two starting actions: **Explore a place** and **Show Pantopus something**. Choosing an area accepts a town, ZIP, or manually selected location. Device location is optional and requested only after the person chooses it. Exact address entry is offered when a particular result needs finer geography. Neither location selection nor address entry verifies residency, establishes ownership, creates a household, or becomes a public profile field.

The capture path initially accepts a public link or user-written information. A flyer or screenshot can later provide another input after extraction quality and privacy have been validated. A private document remains private; an extracted address is not automatically adopted as the person's home. Pantopus must not promise it can retrieve authenticated pages or turn every picture into a reliable event.

For either entry, explain the pending operation: finding official sources, reading available information, or preparing a review. Return useful results as they become ready. Do not wait for every category, produce a long intake questionnaire, or require a conversation with an assistant.

### B.2 The reveal must earn the save

Present a small set of specific possibilities, such as borrowing a listed tool, accessing a library learning resource, or attending a published workshop. Each card answers: what can I do, why might this apply here, what does it require, and where can I verify or use it? Group remote benefits separately from physical destinations so a statewide digital service does not look like a nearby building.

Prefer evidence-rich results with understandable eligibility and a usable next step. Location alone does not establish interests, family status, income, age, or need. Optional preferences refine the selection. A card may say that a library lists a telescope; it cannot say the telescope is available today unless a permitted current source establishes that fact. A membership program, an eligible person, a particular item, and a reservation are separate states.

The visual treatment should help a decision: item or activity, cost conditions, approximate trip, relevant dates, and source. A map is optional when distance matters. Do not turn every answer into a map pin or generated paragraph. Show the source organization, source link, last check, and material uncertainty where they affect the next action.

Discovery widens through actual relationships: local institution, its service area, participating network, and applicable state or national resource. It never silently changes the selected browsing area or implies that a distant option is local. Each new area activates the same process without a population or signup threshold. Unknown coverage stays unknown; a failed provider request is not evidence that a town has no resources.

### B.3 Review, private save, and reliable return

**Save privately** uses the compact confirmation rule in §6.1: a public card/detail showing the exact item and **Only you** can be saved with that one deliberate tap and Undo. Use an expanded review for extracted commitments, uncertain fields, or changed destinations. Show the proposed title, source, relevant conditions, and any extracted date, time zone, or place; identify source fields and user additions. Missing details remain editable or explicitly unknown. **Saved** appears only after durable account-owned persistence.

Authentication may be required to keep a save across devices, but it must preserve the exact pending review. Signing in does not itself confirm the save. A personal collection does not require a Home. If an account-owned bookmark or planning record is missing from existing contracts, building it is part of this journey, not a reason to repurpose household records.

A saved item contains the source relationship, reviewed information, and the person's private additions. A permission-aware bookmark of Pantopus content rechecks access before showing a source preview. A public external source may be cached only under applicable source permissions and retention policy. Neither form authorizes public redistribution of personal notes or restricted source text.

Return begins with the saved collection, an approaching date, a material source change, or another deliberately followed interest. Refreshes preserve continuity: what was saved, what changed, and what action is available now. Quiet sources do not need manufactured updates. People can retrieve a save without accepting notifications, reconnecting an address, or remembering which feature produced it.

Deletion, mute, unfollow, and removing a saved item have distinct effects. Explain them at the action. Removing a bookmark does not delete its source; muting a publisher does not erase a personal plan. A user-authored private note can remain after source access is revoked, without retaining a readable copy of restricted content.

### B.4 Original journey: private repair to useful local answer

A person records a repair concern in a personal note or authorized household issue. The record clearly names its audience. **Ask nearby** opens a separate blank public composer; its title, text, media, private address, and household association are not copied or summarized into the question. The person writes the information they want to disclose.

Before submission, show the exact text, selected attachments, acting display identity, audience, and geographic area. If posting eligibility is missing, explain the existing requirement and retain the draft. Browse access does not imply posting permission. Changing identity, audience, area, or content invalidates the previous preview and requires another review. Only **Post question** submits.

A successful response opens the stored question. An unanswered question says so plainly. A real reply opens from Updates into that exact conversation. The person can mark the question solved or keep seeking help; a comment count does not establish a solved problem. Verified residency indicates a location relationship, not expertise or reliability.

**Save privately** can associate a permission-aware source bookmark with the private repair record. Review the destination before linking: personal and household visibility differ. The reply author gains no access to the private record, its existence, or the association. Household sharing requires appropriate permissions and a separate explicit action. Revocation removes readable source previews across saved lists, detail views, search, and notification entry paths.

This journey reuses genuine questions, replies, and notifications. It does not generate neighbors, seed fictional advice, guarantee a response, or make core discovery depend on response density.

### B.5 Original journey: address-free following to personal plan

A visitor opens a public Beacon, sees who publishes it, and can read permissible updates before signing in. Following is explicit and requires neither a home address nor a Beacon of their own. Sparse discovery must not appear to be a directory full of active publishers; creator information and last publication dates describe real activity.

An event update offers **Save to my calendar**. Review title, date, local time, time zone, venue or online destination, source, and **Only you** ownership. Reuse structured event data where available; extraction prepares a draft and never invents missing fields. Build account-owned calendar persistence if necessary. Saving in Pantopus does not claim to write to Apple Calendar or Google Calendar.

When the source changes, show **Review change** with previous and proposed values. The saved event stays unchanged until accepted. Cancellation receives a clear status and review action; it must not silently delete the person's record. Declining preserves existing values and records which source revision was considered. Reopening can show the current source again without repeatedly nagging about a dismissed revision.

Notification opt-out leaves the event and change review accessible in-app. Any later external-calendar export has its own explicit destination and capability statement; downloading an event file does not promise ongoing synchronization. Sharing with an authorized household is a separate reviewed operation.

### B.6 Existing pillars grow from successful individual use

Home holds personal and permitted household organization, useful location information, and saved actions. Pulse supports actual local conversation. Beacon supports intentional following and publishing. Consumer labels and grouping can be tested, but a navigation rewrite is not the dependency that creates first value.

Marketplace, paid gigs, and chat remain available through existing permissions and transaction flows. A repair card can offer a relevant route to search for paid help; a borrowing discovery can lead to an existing legitimate listing where appropriate. Pantopus must not manufacture listings, bookings, quotes, sellers, available workers, or chat participants to fill the experience.

Each transition previews what crosses the boundary. A gig composer may ask the person to select information for the request; it does not inherit a private issue or reveal the exact address automatically. Contacting a publisher or seller identifies the conversation's acting identity and recipient. Private, household, business, and audience conversations remain distinguishable in Inbox.

Social growth can follow useful objects: someone shares a public resource card, invites someone to an actual event, asks a real question, or recommends a genuine listing. Sharing constructs a reviewed public representation. It must never publish the private collection, annotations, eligibility answers, or household context surrounding that object. Claims of community activity come from real activity.

### B.7 Required states and cross-platform continuity

Every important surface must distinguish these states:

| State | Required behavior |
| --- | --- |
| First use | Explain one next action; allow address-free paths and permission refusal. |
| Loading | Identify the pending operation, retain selected context, and reveal completed independent results. |
| Successful empty | Say what was searched and found; offer another input or an explicitly chosen broader area. |
| Partial | Show verified results alongside missing categories or unresolved fields; do not call the whole request complete. |
| Error | Preserve confirmed records and recoverable drafts; retry the failed operation without recreating successful work. |
| Offline | Distinguish synchronized data from pending edits. Do not report new saves, posts, or reservations as completed. |
| Revoked or removed | Recheck access before display; explain unavailability and provide safe navigation without restricted cached text. |

Use exact audience labels: **Only you**, **Members of [household]**, **Public**, or **Restricted to [named audience]**, according to the actual visibility contract. Explain whether public content can be read outside Pantopus. Geographic relevance is not an access boundary. Changing accounts during a pending action requires identity and destination review; private drafts must not silently transfer into another account.

Public content may have a permitted preview. Restricted destinations never receive an unauthorized preview while authentication or membership checks are pending. Logout and account switching remove the previous account's private content from the visible interface and accessible caches. Offline status cannot override source authorization requirements; protected previews require a current authorized result under the defined access contract.

Use durable destinations that identify the source object and intended view, with authorization evaluated on arrival. Web links, app links, notifications, and authentication callbacks preserve that destination across sign-in, signup, retry, and installation where supported. A callback must not auto-post, auto-follow, or bypass a reviewed confirmation. Repeated taps and retries produce one logical action, with server-confirmed state reconciled across devices.

Notifications are pointers, not permission grants or a second database of private content. Keep sensitive detail out of lock-screen payloads. Distinguish an in-app update created, a delivery attempt, provider acceptance, device presentation, and a destination successfully opened. Test foreground, background, terminated app, signed-out arrival, account mismatch, muted source, and revoked access separately on supported platforms. Mark untested device behavior as unverified.

### B.8 Evidence must measure the promised outcome

Use a nationwide research matrix from the beginning: multiple states, metropolitan and small-town areas, rural and unincorporated addresses, renters and owners, address-free arrivals, and locations with thin or failed sources. Stratify geography and source conditions separately from household or interest cohorts. Do not make one metropolitan pilot a launch gate or treat a few rich library examples as national coverage evidence.

Observe these tasks without initial coaching: choose an unfamiliar area; find one usable possibility; explain its eligibility and availability; review and save it; recover from a failed save; retrieve it on another device; distinguish a stale or changed source; and explain what a shared card reveals. Add repair-question and event-change tasks when their implementations are ready. Simulated replies and staged changes test comprehension, not demand or organic retention.

Report metrics with explicit denominators:

- **All-attempt usefulness:** sessions with an evidenced useful outcome, divided by all genuine discovery/capture attempts, including unsupported inputs, errors, and no-result attempts. Disclose exclusions for abuse/test traffic. Report the outcome and its evidence type; a source handoff alone is not external completion.
- **Discovery yield:** sessions with at least one independently verified actionable result, divided by sessions that submitted a valid U.S. location or supported capture input. This is a supported-input diagnostic alongside the all-attempt rate. Retain timeouts, partial results, and no-result sessions in that denominator.
- **Useful activation:** unique new users with an evidenced first useful outcome, divided by unique new users attempting discovery/capture. Saving is optional; separate directly observed/provider-confirmed and self-reported outcomes.
- **Save activation:** unique new users with a confirmed reviewed save, divided by all unique new users entering discovery or capture. Also report the visitor-to-account funnel so authentication losses remain visible.
- **Useful return:** activated users who voluntarily return in a defined week and retrieve, update, or act on a saved item, divided by all activated users eligible for that observation window. Separate founder prompting and notification-driven returns.
- **Action evidence:** user-reported use, official-source handoff, and externally confirmed completion are separate measures. A link click is not a borrowed item or attended event.
- **Social outcomes:** eligible questions receiving a real reply or marked solved use submitted eligible questions as their denominator; reply and solved rates remain separate. Creator continuation uses real publishing creators.

Track false eligibility, stale dates, broken destinations, privacy misunderstanding, support time, and source-processing cost alongside conversion. Fix repeated boundary failures before increasing exposure. Agree experiment targets before collecting results; the proposal supplies no proven retention or acquisition benchmark.

### B.9 Delivery order and nationwide learning

**First: one complete source-discovery and reviewed-save slice.** A person anywhere can choose a location or submit a supported public link, receive grounded results with honest coverage, review one, save it privately, authenticate without losing intent, and retrieve it later. Include provenance, ownership, duplicate prevention, failure recovery, and cross-device return. This is the minimum coherent product; a large category menu and cosmetic redesign are not substitutes.

**Next: measured utility waves.** Expand source categories and refresh rules according to verified usefulness and geographic coverage. Add screenshot capture after review quality is demonstrated. Add change review and personal event planning on the same ownership foundation. Complete the private-question-to-real-answer journey and permission-aware association. Improve creator discovery and distribution using real publishers. Preserve reachable existing tools throughout.

Nationwide marketing is compatible with this plan. Describe the actual capability: Pantopus finds useful resources from available sources for the selected area, with coverage that varies. Avoid promises of every benefit, guaranteed savings, immediate inventory, or an active neighborhood everywhere. An experimental paid campaign is a learning tool, not proof of product-market fit.

Use bounded nationwide paid acquisition when the advertised slice works end to end, new locations can enter discovery, geography and channel are measurable, and spending has explicit authorization. Evaluate cost per confirmed activation and voluntary useful return, including thin-coverage locations. Increase investment when those outcomes justify it under pre-agreed economics; change the proposition or source strategy when they do not. A national learning sample replaces the assumption that Pantopus must wait for local social density before it can launch.

## Appendix C. Evidence and document provenance

### C.1 Current-source baseline

The design review used the local master checkout at a373b1094. It inspected existing product/source documents and relevant navigation, context, caching, worker, AI, and watch implementations. This identifies reusable code patterns, not verified production capabilities. A remote PR/CI refresh was attempted during this documentation task but the GitHub CLI could not connect; no fresh CI or deployment conclusion is made here. The existing release handoff remains the authority for operational work after its state is refreshed.

The original proposal's local-pilot and acquisition restrictions are superseded for this proposed product direction by the owner's explicit nationwide requirement. Its privacy boundaries and two connected journeys are retained and expanded. This document does not overwrite the original proposal or unrelated local work.

### C.2 Source-research limits

Source examples and access descriptions reflect official documentation reviewed in this conversation on September 8, 2026. No new provider account, paid subscription, production connector, bulk ingestion, or nationwide coverage certification was created. An official documentation page is evidence of an acquisition route, not proof that Pantopus already has its permissions or working integration. Recheck terms, current endpoints, source freshness, and field behavior during source onboarding.

### C.3 Companion scope

The [interactive companion](designs/pantopus-nationwide-experience-2026-09-08.html) is a standalone design artifact. All people, local programs, events, messages, prices used as fixtures, and simulated actions inside it are illustrative unless explicitly identified otherwise. It must display that status outside the product preview. It does not call providers, publish content, send notifications, store personal data on a service, or verify eligibility.

### C.4 Documentation verification

The formatted reader was checked in a local browser for working contents links, desktop and phone layout, light/dark appearance, print reflow, and script errors. The companion was checked at 1360, 390, 360, and 320 CSS-pixel widths, with visual review of its Home, bill, and opportunity screens. Checks also confirmed that reduced-motion preference disables screen animation, keyboard navigation enters the capture dialog, review retains focus, and Escape returns focus to the opening control. Local document links resolve.

Interactive checks cover navigation, separate eligibility/availability statements, private opportunity saving, an explicitly simulated provider handoff, reproducible bill comparisons, keeping or accepting an event change, private note review/save/retrieval, preservation of private records when changing the browse-area fixture, and reaching updates with phone notifications off. These checks use fictional session state. They do not validate production persistence, provider coverage, native platforms, notification delivery, AI accuracy, or user demand.

Application implementation and its tests were not changed or run for this documentation milestone. Accessibility requirements in the specification remain implementation acceptance targets; these artifact checks are not a complete accessibility audit or native-device certification.
