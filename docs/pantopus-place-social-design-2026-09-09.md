# Pantopus Places: conversations connected to the places in your life

**Date:** September 9, 2026  
**Status:** Product and engineering proposal; no application implementation in this milestone.  
**Relationship:** Addendum to the [nationwide product design](pantopus-nationwide-product-design-2026-09-08.md), now collected with this proposal on `codex/product-and-place-design`. The earlier nationwide design is preserved unchanged from `improve-product-feature` commit `6664315bb6d9e0036723f79bad8c9e3b1202ff05`. See the [design collection index](pantopus-product-design-index-2026-09-09.md) for the complete set and provenance. Existing Home, Pulse/Feed, Beacon, Marketplace, Gigs, chat, property intelligence, weather, air quality, elections, waste/recycling, and other utilities remain in scope.

## 1. The product idea

**Follow the places in your life. Join the conversations that matter there.**

A place becomes a durable meeting point for human posts, questions, moments, plans, and useful updates. The place supplies context; people and publishers remain the authors. Replies create relationships around a shared place, even when participants did not previously follow one another.

The distinctive experience is discovering an unfolding conversation: a sketch someone made at a cafe; a question about a park entrance; neighbors organizing a cleanup; a venue publishing a workshop; people adding memories of a former theater. A rating would not fulfill those needs. Do not introduce stars, a venue sentiment score, a leaderboard of best businesses, or a default “write a review” composer. Personal recommendations and criticism remain allowed within ordinary content rules; they are posts with authors and context, not inputs to an aggregate business score.

The underlying model is **person or Beacon → post and replies → place context → interested people**. A public place page is a discovery surface over eligible original content. It is not a new owner of the content or permission to copy it into a larger audience.

This is a strong candidate for connecting the individual-utility strategy to social use: someone follows a library after discovering a useful benefit, then returns for a workshop or discussion. That relationship is a hypothesis to test. A place-based social network still has a contribution and moderation cold start; the source-backed utility described in the existing design supplies value while conversations develop.

## 2. Concrete experiences

All examples below are fictional product scenarios, not live posts or sources.

| Place | Human expression | Interaction that makes it social |
| --- | --- | --- |
| Cafe | “I drew this corner while waiting for the rain to stop.” | Someone shares their own sketch; a conversation becomes an explicitly organized future sketch session. |
| Park | “Which public entrance has a step-free path to the picnic area?” | People reply with dated observations and photos; the original asker can mark a reply useful. |
| Church | “Our public coat drive is Saturday; here is the organizer's information.” | Questions, organizer replies, and reviewed private event saves, without inferring anyone's religion or attendance. |
| School | An adult asks about access to a publicly advertised evening performance. | Discussion about the public event and facilities, with safeguards for minors and no student-presence features. |
| Street segment | “The sidewalk between these two intersections is blocked.” | Dated observations, a relevant municipal source, follow-up when conditions change. A report remains a report until verified. |
| Former theater | “My grandfather kept this opening-night program.” | A living archive of attributed memories, distinct from the present occupant of the building. |

Do not require someone to be physically present to discuss a place. Existing Pulse posting eligibility and Beacon audience rules still apply. Selecting a venue does not bypass either rule. If broader remote place discussion is desirable, it requires an explicit product/authorization change rather than a hidden exception in the new endpoint.

## 3. Four concepts users must understand

1. **Author:** who is speaking, under which existing personal, business, or Beacon identity.
2. **Place:** what public location the post concerns.
3. **Audience:** who may read and participate, under the original post's rules.
4. **Time:** when an observation happened or an event is planned, distinct from upload time.

“About Cedar House Cafe” is the default place language. A place tag does not establish that the author is there, lives nearby, owns the business, or witnessed an event. Public venue geometry and private device location are different data. Do not turn a named place into a live-person pin or attendance badge.

Use one canonical post ID and one reply tree when the post appears in Pulse, Following, a Beacon, and a place page. Place browsing opens that original discussion, retaining identity, reply rules, blocks, edits, removals, and access checks. Sharing a link to a restricted post does not create a public excerpt.

## 4. Posting: a small addition to the existing composer

The common flow remains write or attach media → optionally choose a place → publish. Do not make location mandatory or ask everyone to complete a category form.

**Choose a place.** Search a name, address, street, intersection, park, or landmark. Each result shows name, locality, distinguishing address/branch, and a small map preview. Nearby suggestions may use a one-time permission but never silently attach GPS or a home address. Disambiguate two businesses in one building and two branches with the same name. Let the user clear the selection without losing the draft.

**Confirm what will be disclosed inline.** A public composer can show:

> Posting as Maya · Public  
> About Cedar House Cafe · 18 Market Street  
> Show this post in this place's conversations [explicit choice]

The exact place name, public-map visibility, and acting identity must be visible before Publish. Choosing “show at this place” is an intentional attachment action. A plain location mention need not automatically enroll the post into place discovery. Keep the common case on one composer screen; add a separate review only for meaningful uncertainty, an identity/audience change, or a sensitive location.

The initial public map includes only newly published public posts whose authors explicitly accepted place discovery, or older posts whose authors explicitly add it. No automatic retroactive indexing of old geotags, inferred coordinates, EXIF, home records, private saves, or restricted Beacon messages. Existing posts continue to work in their current surfaces.

Offer lightweight optional prompts such as **Share a moment**, **Ask something**, and **Make a plan**. The proposed experience supports casual expression alongside utility. AI may suggest a type or a similar discussion, but the user can ignore it. Never silently relocate the post, rewrite the audience, or merge it with someone else's thread.

This requires an explicit content-policy addition: the current backend rejects `general` posts to local public audiences. Propose a permitted **Moment** category for ordinary social expression in the place composer, with the same identity, audience, and applicable posting-eligibility checks. It can be a simple default selected by the author, without a category questionnaire. Implementation must add and test the contract across clients and APIs; the place endpoint must not silently bypass today's General restriction. Beacon posts retain their own existing publication policy.

For a temporary observation, offer “When was this?” and a suggested period of relevance. For plans, use the existing reviewed date/time/timezone contract. Temporary prominence may expire without deleting the original post or its replies. Avoid a single 24-hour expiry for every type of content.

**Missing place:** offer a provisional submission with public-location validation, duplicate candidates, and a clear pending state. Do not allow arbitrary coordinates and names to instantly create a discoverable public page for a residence or person. The user can retain a draft or post without public place indexing while review is pending. Posting success and place-discovery status are separate states.

## 5. Finding conversations: map plus an equally capable list

Keep Places within Nearby, reachable by tapping a post's place chip, searching, opening a shared place link, or following a place. Preserve Feed/Pulse as a reading surface and Beacon as a publishing/following system. A new global navigation destination is not a prerequisite.

On mobile, the map and a bottom sheet are two views of the same selection. Start with a compact preview; tapping opens a place page. Scrolling a discussion must not accidentally pan the map. Returning restores the prior bounds, selection, filters, and position. A full-screen list offers equivalent content without requiring map gestures or location permission.

On desktop, use a map with a single adjacent list/detail pane. Avoid three permanent columns of map, feed, and profile. Search and area controls belong to the map context; conversation filters belong inside the selected place. A pan changes the browsing area, not residency or the posting audience. Make area changes deliberate, and cancel stale requests so older results cannot overwrite newer bounds.

**Map composition rules:**

- Show places or spatial clusters, never one pin per post or one avatar per person.
- At broad zoom, aggregate public eligible places; at closer zoom, reveal individual venues or street segments. Cluster labels describe displayed public places, not people present or a count containing restricted activity.
- Use collision-aware marker placement and a bounded visible marker budget, initially testing roughly 8–12 labeled selections on a phone. This is a design hypothesis, not a cap on searchability. Exact search and the list remain paths to omitted places.
- Marker size does not grow linearly with likes or lifetime post counts. A viral restaurant must not visually cover its neighborhood.
- A restrained symbol can indicate a relevant conversation, question, or upcoming plan. Avoid flashing hotspots, live-presence dots, and heatmaps implying crime, popularity, or safety from unverified posts.
- Preserve the selected marker during updates. Offer “New conversations” instead of moving the map, reordering what someone is reading, or inserting material above their scroll position.
- Display source attribution and uncertainty for the base map/place record as required. A dot is not evidence of a surveyed entrance or a precise incident location.

Accessible labels describe place name, location context, and the same public content shown visually. Keyboard and screen-reader users can search, select, open, reply, and return through the list. Large text and narrow screens reflow; meaningful content is never hover-only.

## 6. The place page

### 6.1 A simple shell with useful depth

**Header:** place name, branch/address, category, and small public-map context. Two distinct actions: **Follow place** for public conversation updates and **Save privately** for personal organization. Following is private by default, does not indicate attendance, and does not automatically subscribe the person to every associated Beacon or phone notification.

**Three stable tabs:** **Conversations, Upcoming, Visit info**. Visit info replaces the original About label. Conversations is the initial view. Add useful depth inside these destinations instead of adding a permanent tab for every capability. Memories remain a time/content filter within conversations. On a phone, all three labels must fit without horizontal tab scrolling; use a labeled disclosure for secondary actions instead of shrinking text or hiding meaning behind icons.

**Recent conditions** is a compact, expandable panel between the header and tabs. It exposes a helpful observation, its source type, and its age without requiring a tab visit. An **Offers** shortcut appears near it only when real current offer/benefit content is available; opening it leads to a focused offers view with a clear return to the place. Visit info also provides the durable entry to available offers. A dedicated permanent Offers tab is a future option for sustained content volume, not the initial layout. Missing offers do not leave an empty promotional module.

The reading order is **where this is → what may affect my visit → people and plans → details when needed**. Keep the top panel compact enough that a conversation begins within the first ordinary screen. At large text sizes or narrow widths, the facts and actions stack rather than truncate. Preserve scroll position when opening/closing details. Fresh data shows a small “Updated” affordance; it does not reorder content under the reader.

**Conversations** starts with useful entry points retaining each author, time, first-post excerpt, and reply context. A topic or date filter appears when it helps. A current event may supply one compact group of related discussions. Source notices and organization updates have explicit attribution and do not dominate independent contributions. A Recent view remains available so selection is not the only way to discover eligible posts.

**Upcoming** presents supported plans/events with date, timezone, organizer, and source. “Save to my plans” opens the established private event review. A saved plan is not an RSVP, ticket, reservation, or public attendance signal. Multi-location events display their explicit place relationships without duplicating the underlying event identity.

**Conversation detail** emphasizes the person and replies. Reply, react, save, share, report, and mute use consistent existing patterns. Users can subscribe to a thread without following its venue. Reaction totals express response to a post, never a venue rating. On long threads, offer reply-to navigation, author/organizer updates, and chronological access. Existing Beacon reply restrictions remain effective; a place page cannot open a backdoor comment channel.

### 6.2 Recent conditions: observations with a visible time window

The feature answers “What has someone recently observed that could affect my visit?” It does not establish ground truth, predict occupancy, or certify that the next visitor will have the same experience. **Recent conditions** is the section label; **Add an observation** is the contribution action. Avoid a green “Live” badge, a truth score, or an unqualified “20-minute wait.”

A fictional restaurant example:

> **A visitor reported a 15–25 minute quoted table wait**  
> For 2 people · observed 8 minutes ago  
> **Details · Add an observation**

The collapsed card can shorten the first line while retaining “reported,” the wait kind, and observation age. Details disclose exact observation time in the place's local timezone, service/party scope, source type, applicable expiry, and any disagreement. Busy and wait are separate dimensions: a crowded dining room can still have a short pickup wait. Do not imply one from the other.

**The small reporting flow:** select the condition → select a short structured answer → review observation time and applicable scope → submit deliberately. Default to “Just now” only as an editable suggestion. Do not publish a report merely because someone opens the form or taps a choice. Keep optional explanatory text secondary; do not require a photo, exact device location, receipt, or a long questionnaire. The production flow shows the acting account and exact visibility before submission. Structured public observations are attributed as a visitor by default; account ownership stays internal for moderation, with no public profile trail. A new observation is not proof of attendance.

For waits, distinguish:

- **Quoted wait:** what staff or a provider told the person, with service and relevant party size.
- **Waiting so far:** elapsed waiting at the time of the observation; this is not a completed wait or an estimate of the remaining time.
- **Completed wait:** what the person reports actually waiting for that service. An optional future timer provides timestamps, not proof of truth.

Use understandable ranges where precision is unjustified. Party size is only asked for services where it matters. Observed time and submission time are different; delayed uploads and offline drafts retain their original observation time. Reject future or implausible timestamps with an understandable correction step instead of silently making the report fresh.

| State | UI behavior |
| --- | --- |
| One recent visitor observation | Show that it is one report, its kind/scope and age. Do not label it confirmed. |
| Several comparable observations | Show individual evidence first. A combined range is a later capability gated on validated comparable scope, independence controls and adequate fresh data; no naive average or majority vote. |
| Reports differ | Show “Recent reports differ” and their scope/time differences. Do not hide disagreement or pick the most favorable account. |
| Venue update | Label “Venue reports…” with its observation/update time, separately from visitor reports. Affiliation is not a truth certificate. |
| No recent observations | “No recent observations.” Offer contribution where the category permits it; never infer “Not busy.” |
| Expired observations | Remove them from current prominence. If retained in details, visibly label them earlier/expired, with their original times. Never reset freshness on a retry or edit. |
| Could not refresh | Show refresh failure and the age of any retained evidence. An outage is not an empty state. |
| Reporting limited or unavailable | Briefly explain the applicable restriction without exposing abuse scoring or a concealed place. Preserve ordinary eligible conversation. |

**Abuse resistance:** maintain at most one active observation per account, place, and dimension; an update replaces that account's active contribution. Do not add a blind “Confirm” or “Still true” vote. Someone who wants to corroborate supplies their own dated observation. Rate limits, duplicate/coordinated-submission detection, account misuse review and report/appeal tools reduce manipulation but cannot guarantee accuracy. New accounts are not automatically false; account age, GPS proximity, receipts and popularity cannot prove a claim. Venue owners can respond or report abuse but cannot erase independent criticism or privately change visitor observations.

Freshness is configured per condition and service context, not a universal lifetime. The prototype's times are fictional illustrative values, not an operational threshold. Expiry derives from observed time and the condition policy; reindexing, upvotes, retries and edits do not extend it. Separate removal for abuse from natural expiry. Clearly labeled personal accounts or discussions may remain after their temporary prominence expires, subject to the author's deletion and normal retention policy.

**Sensitive places:** disable occupancy, wait, attendance and visitor-presence reporting for protected/sensitive categories until a separate category-specific review approves a narrowly scoped use. Public institutional information or an official service notice may still be appropriate. Do not make contributor trails, visitor lists, public receipt evidence, precise device coordinates or “people here now” available. No sensitive-place inference is generated from follows, browsing, saved items or reports.

### 6.3 Offers: clear terms and a real next step

Offers includes commercial deals and useful noncommercial benefits, such as a free workshop or borrowing program. Keep the distinct terms **Deal**, **Free program**, or **Borrowing benefit** visible where useful; an eligibility-based benefit must not look universally available. The place shortcut can say **Offers · 2**, with the count restricted to currently displayable items. Do not create urgency, scarcity or estimated savings unsupported by the source.

Each compact card answers **what it is, who supplies it, when it applies, and what to do next**. The focused detail shows:

- Exact branch/place and source; **From the venue**, **Official program**, or **Spotted by a community member** are distinct provenance.
- What the person receives, what they must purchase/pay, quantity/limits, exclusions, eligibility and stacking rules where published.
- Start/end dates, applicable weekdays/hours and IANA timezone. Date-only offers remain local dates, not misleading midnight UTC deadlines; missing expiry is “No end date published,” not “Never expires.”
- Redemption method and official next step, including whether booking, a code, membership or staff confirmation is required.
- Source last checked time, changed/withdrawn/expired status and an accessible source link. A “checked” timestamp means the terms were inspected, not that checkout or inventory was verified.

Use **Save privately** for remembering an offer and **View redemption details** or a precise provider action for taking the next step. A save never claims a reservation, guaranteed discount or successful redemption. Provider handoff means the link opened; **Redeemed** requires an explicitly recorded user report or authorized provider confirmation with that provenance retained. Do not infer it from clicks, time spent or a receipt filename.

Expired and withdrawn items leave active discovery automatically. A user's saved copy remains clearly labeled with the accepted terms/version and changed status; consequential changes are reviewed rather than silently rewriting a commitment. A missing end date needs a bounded recheck policy and visible uncertainty. Visitor-spotted offers retain their attribution and can be corrected or reported; they do not become venue-authored material. Paid placement, if introduced, is visibly sponsored and cannot buy placement as an independent conversation or moderation result.

### 6.4 Visit info: practical answers with source distinctions

Visit info replaces an undifferentiated About page with scannable groups: **Getting there**, **Before you visit**, **Access and facilities**, **Programs and offers**, and **Sources and corrections**. Show only useful groups with real content. A short summary appears first; disclosures expose the source, dates and exceptions. Existing public-source place details and nationwide capabilities remain available here; this reorganizes them rather than removing them.

Examples include entrance/parking instructions, published hours, reservation requirements, accepted payment methods, equipment/pet restrictions, step-free routes, and event-specific conditions. A place fact is not automatically applicable to every entrance, service or event. Avoid claiming accessibility from a generic symbol alone; display specific sourced features and known limits.

Every consequential rule distinguishes **Venue policy**, **Published public requirement**, and **Visitor tip**. A visitor tip can say that an entrance was difficult to find; it cannot create an official restriction. Link a purported public requirement to the issuing authority, applicable scope and date; community agreement or AI extraction is not legal authority. Mark uncertainty and use the source's wording/context for consequential rules rather than broadening them. Venue policies, public requirements and temporary event conditions may coexist or conflict; show the conflict and source instead of fabricating precedence.

A concise card might say **Reservation required for groups of 8+ · Venue policy**, with **See details and source**. Event-specific exceptions sit with the event and link from Visit info when relevant. Offer **Suggest a correction**, preserving the old evidence/version while the change is reviewed. Do not silently publish user-submitted policies or let venue owners rewrite independent tips.

### 6.5 Visual behavior and interaction standards

Use a calm hierarchy: place identity; one compact conditions panel and optional Offers shortcut; the three tabs; substantial content. Conditions use neutral language and symbols, not red/green certainty or a gamified confidence meter. Offers display the benefit and material terms before decorative imagery. Visit info uses familiar labels and short sentences with progressive detail; missing data is plain text, not a wall of empty cards.

All controls have clear text, visible focus and generous targets; relevant state is conveyed in words and not color alone. Disclosure buttons expose expanded/collapsed state, tabs expose their selected panel, dialogs have a title and return focus to the launching control, and escape/back behavior preserves the reading position. A restrained expand/collapse or save acknowledgment is enough animation; reduced-motion mode removes nonessential movement. Neither new observations nor expired content should abruptly move the item under a person's finger. Small layouts stack instead of concealing terms or shrinking controls. The fictional companion demonstrates selected paths; implementation must validate web, iOS and Android behavior separately.

## 7. Quiet places, popular places, and viral surges

The shell should remain recognizable as traffic changes. Change the amount of organization, not the meaning of the controls.

| Condition | What the person sees | What the system does |
| --- | --- | --- |
| No eligible posts | Useful sourced place information, any real upcoming items, and a modest invitation to start a conversation. | Never invent activity. Distinguish “no public conversations yet,” “could not load,” and filtered emptiness. Nearby or regional alternatives are explicitly labeled and opt-in. |
| A few posts | The posts themselves, with dates and replies. | Avoid unnecessary AI summaries, empty topic categories, or a large empty feed. |
| Steady activity | A bounded selection of distinct conversations plus Recent, topic, and time filters. | Diversify authors and subjects, decay temporary relevance, retain legitimate criticism, and give relevant new questions an opportunity to be seen. |
| A sudden surge | An optional event/topic group with separate original threads, source-attributed updates, and a stable “New posts” affordance. | Apply admission controls, rate limits, duplicate detection, selective slow mode, and operator review. Never funnel all discussion into one unmanageable thread. |
| A large historical archive | Current conversations first; search and time filters find older memories and discussions. | Serve bounded indexed pages and grouped projections. Lifetime volume does not determine present prominence. |

**Conversation grouping is reversible navigation.** It does not combine authors, delete minority viewpoints, merge reply trees, or change audience. Suggested related threads must already be visible to the viewer. Users can create an independent post when their experience is different. Start with manual/event-ID groupings and simple duplicate links; introduce semantic grouping after evaluating mistaken merges, languages, and contested events.

**Ranking goals:** place relevance, freshness appropriate to content, substantive replies, variety of authors, and user-selected interests. Cap concentration by one account, organization, or repeated subject in the selected view. Raw volume, follower counts, sensational wording, and controversy must not dominate by default. Physical presence, verification status, or a paid account is not proof of truth. Exact weights and surge thresholds are experiment and abuse-operations decisions, not invented constants in this document.

**A venue dispute must remain discussable.** Anti-spam measures apply to conduct and coordinated abuse rather than negative sentiment. Do not label independent accounts of the same experience as spam simply because they agree. A broad-impact event may merit context and moderation capacity; it does not automatically deserve national promotion.

**Push restraint:** a place follow initially adds public updates to Following. Phone alerts require an explicit preference and a bounded digest or narrow subscription. Replies and selected event changes retain their separate settings. Never fan out one push per post to every follower of a viral place. Avoid making useful notices compete with an unbounded alert stream.

## 8. Trust and safety are product requirements

| Scenario | Required design behavior |
| --- | --- |
| Private home, apartment unit, or resident | No automatically created public social page or person-level pin. Household discussion stays under existing permissions. A genuinely public business at a residence needs a deliberate, verified public-business treatment; residential identity and household records remain separate. |
| School or place frequented by minors | No live attendance, student roster, classroom tracking, or public invitations targeting children. Permit appropriately moderated public institutional/event discussion without naming minors or exposing their schedules. Initial precise public location posting by minors needs a separate age-appropriate design before enabling it. |
| Church, clinic, shelter, recovery meeting, or other sensitive location | A public directory entry does not authorize publishing visitors or inferring beliefs/health. Sensitive sites receive reduced discoverability where needed, protected-location review, no live-person layer, and private follows. Some exact locations must be suppressed. |
| Person tracked across places | No automatic check-ins, follower lists revealing sensitive place interests, profile visit trails, or nearby-person search. Strip location metadata from published media; provide visible precision/date review and deletion controls. User-written content can still disclose location and must be covered by reporting and removal tools. |
| False incident or rumor | Keep author, observation time, evidence, source, corrections, and uncertainty visible. Do not promote an unverified report into an authoritative safety banner. Provide emergency-service direction where appropriate without representing Pantopus as emergency dispatch. |
| Harassment, coordinated raids, or slurs | Account/action rate limits, block/report controls, content review, targeted slow mode, and escalation. Show affected authors an understandable status and appeal path. Do not reveal internal anti-abuse scoring. |
| Owner wants negative posts removed | Venue affiliation permits labeled organization replies and factual correction requests. It does not grant control over independent posts, ranking, identities, or moderation decisions. |
| Fake owner, impersonated staff, compromised organization account | Independently verify the scoped organization relationship, show who the account represents, and support revocation/audit. A verification badge attests the relationship, not the accuracy of every statement. |
| Commercial spam or location bait | One primary discovery place in the first release, relevance checks, limits on repeated cross-posting, sponsorship disclosure, and explicit paid placements. Do not let payment buy moderation outcomes or an organic conversation slot. |
| Dangerous overcrowding or environmentally sensitive site | Do not equate social interest with safe capacity. Respect protected-site policy, show sourced closures where available, and avoid automated promotion that exposes sensitive exact locations. No invented crowd estimate. |
| Public post becomes restricted or is deleted | Remove its map eligibility, previews, search derivatives, caches, summaries, and pending alerts. Deny access immediately at the read boundary even while background cleanup completes. |
| Restricted post merely affects a count | Treat counts, clusters, snippets, suggested topics, embeddings, and digests as potential disclosures. Public projections are built only from explicitly eligible public content. Authorization also applies to derived surfaces. |
| Place renamed, closed, moved, or replaced | Preserve the historical entity and dates. A new business at the same address does not inherit the old business's conversation history. A rename, relocation, and successor are different relationships. |
| Duplicate or wrong place match | Provide correction and appeal, retain provenance, and support reversible merges/splits. Recheck consent if a correction would materially broaden exposure; avoid arbitrary retagging by venue owners. |
| Source outage or moderation backlog | Show stale/loading/pending states; preserve drafts and existing safe reads. Pause automatic promotion or queue new place indexing when necessary, rather than pretending everything is current or published. |

Apply sensitive-place policy consistently nationwide and evaluate false positives. Do not blacklist communities or cultural institutions merely because they are less familiar to the dataset. Users need a correction path when public-location classification is wrong.

## 9. Place identity and nationwide data

Build a shared public **PlaceEntity** contract with Pantopus-owned stable IDs. Provider identifiers are aliases, not the primary keys for social history. A place can be an establishment, public facility, landmark, park, street segment, or public site, with suitable geometry and parent/child relationships. A street is not an arbitrary address point; a cafe inside a library is not automatically identical to the library; a chain brand is not one local branch.

Use source/identity candidates appropriate to each type. [Overture's place documentation](https://docs.overturemaps.org/guides/places/) describes names, geometry, source information, identifiers, and confidence, while acknowledging duplicates and incomplete properties. It is a candidate national foundation, not verified exhaustive coverage. Its place theme is primarily stationary destinations; street/route and temporary-event geometry need other appropriate sources.

[Foursquare's open place schema](https://docs.foursquare.com/data-products/docs/places-os-data-schema) provides identifiers, coordinates, categories, refresh/closure metadata, and change records including merge redirects. Evaluate it against coverage and maintenance needs; provider timestamps must not be presented as exact real-world opening or closing times.

Keep a licensed map renderer/base map decision distinct from persistent place data. [Google's Places policies](https://developers.google.com/maps/documentation/places/web-service/policies) limit storage and map display, with a specific place-ID storage exception. [Mapbox Search Box documentation](https://docs.mapbox.com/api/search/search-box/) describes temporary-use results; [its Geocoding documentation](https://docs.mapbox.com/api/search/geocoding/) separately describes permanent geocoding and notes that v6 does not supply POI data. Do not assume today's autocomplete response can become a permanently stored, provider-independent social directory. Review actual account rights and field provenance before choosing ingestion/backfill paths.

Additional official municipal GIS and institution sources can add public streets, facilities, entrances, and corrections where available. User/organization submissions require duplicate and public-location checks. A missing source results in an honest provisional workflow, not exclusion of the user's town. Query by the entered area nationwide; source depth varies without local signup gates.

Keep public source facts, human conversation, and private personal records distinct. A library's sourced borrowing program belongs in its useful information; it is not a fake human post. AI never manufactures comments, visitors, community consensus, or demand to fill an empty place. Private documents and saved opportunities remain in the existing private experience and are not inputs to public place summaries.

## 10. Engineering design

### 10.1 Reuse and current gaps

The inspected checkout already contains location picking/tagging, post/reply infrastructure, Beacon identity and audience rules, nearby feed/map queries, privacy serializers, public point previews, and address intelligence. These are valuable foundations. However, an address label or coordinate is not a shared canonical social place, and platform parity is incomplete.

In the checked schema, `Post.target_place_id` refers to a private user's `SavedPlace`. It must not be repurposed as a global venue foreign key. Public point previews and place-intelligence caches are not a canonical venue catalog. Introduce the public identity contract while reusing existing facts/adapters and maintaining the separate `HomeAddress`, business-location, and personal-place roles.

Current Beacon tests explicitly preserve selected venue coordinates while labeling the result `approx_area`. New implementation must distinguish **public place geometry**, **author location**, **display precision**, and **provider provenance** across every serializer and client. Rounding a coordinate cannot make an explicitly named cafe anonymous. This is a design/audit finding, not a claim that live location tracking exists.

Inspected entry points and reusable foundations:

| Evidence | Implication for this work |
| --- | --- |
| [Android Pulse mapping](../frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/compose/pulse/PulseComposeViewModel.kt), [iOS Pulse mapping](../frontend/apps/ios/Pantopus/Features/Compose/PulseCompose/PulseComposeViewModel.swift), [Beacon backend](../backend/routes/broadcastChannels.js) | Explicit native place tags already exist. Add durable public identity and reconcile source/precision behavior rather than building a second composer. |
| [Web location picker](../frontend/apps/web/src/components/feed/PostLocationPicker.tsx), [web Beacon composer](../frontend/apps/web/src/components/audience/AudienceComposer.tsx) | Web needs parity: a resolved address label is insufficient, and the current Beacon composer does not submit the native tag fields. |
| [Canonical application baseline](../supabase/migrations/20260908234526_application_baseline.sql) | `SavedPlace` is private and `Post.target_place_id` references it. `HomeAddress`, `BusinessLocation`, and `PlaceSectionCache` have different responsibilities from public social place identity. |
| [Public point preview](../backend/services/placePreviewService.js), [place intelligence](../backend/services/placeIntelligenceService.js) | Reuse public source adapters and caching; do not copy Home authorization into a public venue page or duplicate the facts service. |
| [Feed map](../frontend/apps/web/src/app/(app)/app/feed/FeedMap.tsx), [feed service](../backend/services/feedService.js) | Existing bounded post queries/client clustering are a starting point. A million-post place needs bounded server-side place/conversation projections. |
| [Post and comment routes](../backend/routes/posts.js) | Reuse original-post authorization, reply tree, save/share/report operations, and exact destinations. |
| [Identity serializer](../backend/serializers/identitySerializers.js), [location privacy](../backend/utils/locationPrivacy.js) | Verify every displayed coordinate and identity field across all surfaces before expansion. |

Two focused audit items precede broader map exposure. Generic persona serialization currently strips location tags that Beacon history can expose, so tag display is not consistent end to end. Non-persona feed normalization also includes alternate `effective_latitude/longitude` fields while the precision helper operates on ordinary coordinate fields; this warrants a targeted privacy regression check. Static inspection alone does not establish a live exploit, and no exploit or live test was performed in this design task.

Existing native recommendation posts can include star characters. Preserve that functionality; do not aggregate those characters into a place score or make recommendation content the organizing model for the new page.

### 10.2 Proposed records

These are logical contracts; naming and physical tables should be reconciled with the current release before migrations.

| Record | Responsibility |
| --- | --- |
| PlaceEntity | Stable internal identity, kind, canonical public geometry, timezone where applicable, sensitivity/publication status, and current version. |
| PlaceSourceAlias | Provider/ID, licensed field provenance, source version, match confidence, access/storage constraints, and refresh state. |
| PlaceRelation / geometry history | Containment, branch/site relationship, relocation, predecessor/successor, reversible alias merge, and time-bounded geometry. |
| PostPlaceAttachment | Original post ID, selected place/version, explicit discovery consent/version/time, display label snapshot, and mapping/indexing status. One primary discovery place initially. |
| PlaceFollow | Private user-to-place relationship with separate feed/digest preferences; no public attendance or member roster. |
| ConversationGroup | Optional reversible references to distinct original posts around a known event/topic; no copied reply trees or mixed audience summaries. |
| PublicPlaceProjection | Bounded, versioned eligible post/group references and safe aggregates for public map/list reads. It never includes private post metadata. |
| PlaceCorrection / moderation action | Report reason, evidence, actor, status, reversible decision history, notice, and appeal. Access restricted to appropriate roles. |

Private SavedItem links may reference a public PlaceEntity without making the saved relationship public. Following a place, saving a place, owning a business, joining a household, and following a Beacon remain distinct actions.

### 10.3 Write and read paths

1. Resolve a selected source result to a permitted public place candidate. Return a stable identity/version with a clear provisional or verified state.
2. Publish through the existing Pulse or Beacon authorization path. Validate author identity, original audience, explicit place-discovery consent, place status, attachment version, and rate limits on the server. A client flag cannot override audience policy.
3. Commit the original post, valid attachment, and transactional outbox intent atomically, with an idempotency key. If place indexing is pending, show that state independently from post publication. No success toast for a failed write.
4. Workers update public discovery projections, topic references, and bounded counters only for eligible content. Reprocessing has no duplicate effects. Edits and deletions generate versioned invalidation.
5. Map/list requests return bounded candidates using spatial and time indexes. Before returning aggregates, clusters, snippets, or summaries, apply current deletion, discovery-consent, and sensitive-place suppression; when a cached aggregate cannot be safely corrected, withhold or rebuild it. Detail hydration additionally rechecks access, blocks, identity, and source status. Shared public caches contain no personalized hidden counts or previews; user-specific filtering happens under a separate scope. Fast revocation wins over stale cached content.
6. Reply, share, save, and notification links resolve the original post and permissions. The place context is an optional return path, not a permission grant. Repeated appearances of one post are deduplicated in the person's feed.

Candidate endpoints: place search/resolve, place detail, map projection by bounds/zoom/filter, place conversations with cursor, private follow/unfollow, and place correction/report. Existing post creation/reply endpoints remain authoritative. Do not expose an alternate “place post” API that omits existing eligibility or persona enforcement.

### 10.4 Scale without a wholesale infrastructure rewrite

Start with the existing Postgres/PostGIS, worker, cache, and search capabilities where available. Validate indexes and production query plans against the current system before selecting additional infrastructure.

- Spatially indexed public place lookup and attachment indexes by place, eligible state, time, and stable post ID.
- Cursor pagination with a stable tie-breaker and snapshot/version semantics, not deep offset scans through millions of rows.
- Read-optimized public projections, request collapsing for cold places, and bounded enrichment. No AI generation or provider fanout on every map pan.
- Cache keys include viewport/zoom/query, source/index revision, locale, and appropriate public policy scope. Sensitive-user state cannot enter a shared tile cache.
- During a surge, shard/partition hot update work where measured contention requires it. Avoid a single counter row lock on every reaction and a single worker partition for all popular-place writes.
- Separate the immediate post write from ranking, topic grouping, media transformations, and digest generation. Backpressure and retries must preserve core reading and author feedback.
- Use notification fanout-on-read or bounded digests for large place audiences where appropriate; explicit thread subscriptions retain precise semantics. Recheck authorization and preferences at delivery.
- Remove unsafe content at the serving boundary before asynchronous search/tile/summary cleanup completes. Keep a kill switch for the new discovery projection that preserves original post destinations and records.

Load tests should include both a large historical place and a hot incoming burst: diverse reads, post/reply writes, edits/deletions, reports, slow providers, worker retries, and blocked users. Test realistic skew and cache misses, not only uniform traffic. Establish latency, error-rate, backlog and cost budgets before release; no million-post capacity is certified by this document.

### 10.5 AI boundaries

Useful roles include suggesting duplicate places, proposing topics, translating a post on request, and producing a clearly attributed digest of eligible public discussions. Identity matching and uncertain grouping need reversible review. Do not treat model confidence as proof that a place exists or two establishments are identical.

At low volume, show the original posts. At higher volume, a summary names its covered time window, links to the original discussions, labels disagreement, and is invalidated by relevant edits/removals. Summaries do not infer majority opinion from a selected sample, assign a venue safety/reputation score, or identify people who may be present. The first release can operate without generative summaries.

### 10.6 Conditions, offers and visiting-information contracts

Extend the shared place layer rather than introducing separate location identities for these modules. Keep the following logical records independent from posts, household records and private saved items:

| Record | Responsibility |
| --- | --- |
| PlaceObservation | Place/version, internal account, public attribution class (visitor or venue; no visitor profile by default), dimension, observed time, submitted time, service/party scope where applicable, quoted/waiting-so-far/completed kind, value/range, source role, version and active/expired/removed state. Source-role verification and content accuracy are separate. |
| ObservationPolicy / projection | Permitted category/dimension, freshness policy version, safe bounded comparable evidence, policy/suppression version and generation time. Never turn account volume into an authoritative truth score. |
| PlaceOffer / terms version | Stable offer and place identity, source/publisher role, material terms, eligibility, date/timezone semantics, source observed/checked timestamps, validity state, licensed source evidence and correction history. |
| VisitInfoAssertion | Specific field or rule, affected entrance/service/event, source class/authority, source evidence, effective dates, checked time, uncertainty/conflict and accepted revision. |
| PrivateOfferSave / action evidence | Account-owned saved source/version and any reviewed terms; provider-handoff, user-reported redemption and provider-confirmed redemption remain distinct. Reuse the nationwide saved-item contract where available. |

Writes use server-side account authorization, permitted place/category checks and idempotency keys. Observation upserts enforce the one-active-account/place/dimension constraint transactionally. Use expected revisions for updates, withdrawals and correction decisions; two devices must not silently overwrite each other's newer report. Validate timestamps and scope before indexing. An expired delayed submission may be kept as an explicitly earlier account where policy permits, but cannot appear as a new current observation.

Candidate read/write capabilities are bounded conditions read, observation create/update/withdraw/report, current offers/detail, visiting-info fields, source correction and the existing private-save/action operations. Do not add an endpoint that bypasses the original identity or sensitive-place policy. Ordinary post opinions still use original posts/replies. A venue-affiliated report has no administrative right over visitor reports.

Use versioned outbox jobs for expiry, permitted source refresh, offer start/end/withdrawal, correction review and projection invalidation. Read boundaries check effective dates, current suppression/removal and policy versions even if a worker is delayed. Retries do not reset observed time or duplicate a save/redemption event. Rebuild incomparable or stale aggregates rather than serving a falsely current result. During outages show the retained age and refresh limit. Rate-limit hot-place reporting and bound detail evidence reads without fanout per observation.

Author withdrawal or deletion removes public observation/attachment derivatives immediately at serving boundaries and queues cache/index cleanup. Recompute affected summaries and current evidence; never preserve a removed claim merely to keep a count stable. Define minimal restricted abuse/audit retention separately from the public record. User-requested deletion of a private save or user-supplied evidence propagates to derived private extraction/storage under the shared retention policy.

Receipts and device location are not required or uploaded in the first observation flow. If a later private-evidence feature is introduced, it needs explicit selection, secure storage, retention/deletion, metadata stripping and access checks; never expose purchase details or a visitor trail. A submitted receipt is a claim-supporting artifact, not verified attendance, truthful wait, entitlement or redemption. Any authorized provider confirmation must validate its issuer, offer/user scope and replay protection, retaining the exact confirmation provenance.

## 11. First implementation sequence

Continue the current reliability/account/release work in [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md). This design adds a scoped product track; it does not supersede operational authorization or restart completed Beacon acceptance.

1. **Resolve contracts and preservation.** Confirm public place identity versus private places; reconcile source rights; map every existing location field, audience, and platform composer; inventory all existing features and entry points. No automatic migration of old public or private geotags into place discovery.
2. **Build one real conversation journey.** A supported public place can be selected; a newly consented public Pulse post or permitted public Beacon post appears at that place; another eligible person opens and replies through the original conversation where replies are allowed; the author receives the correct existing notification. Edit, block, revoke, and delete work everywhere.
3. **Add useful quiet-place pages and private follows.** Reuse sourced opportunities/events, public place facts, private saves, and explicit Following preferences. Deliver Visit info and source-backed offers first because they can work without local contributors. Add explicitly attributed Recent conditions only for approved ordinary categories, with expiry and abuse controls in the first slice; defer aggregated wait estimates until evidence quality supports them. Evaluate metros, towns, rural/unincorporated places, and ambiguous branches from the beginning.
4. **Add the bounded map/list.** Demonstrate marker clustering, exact search, accessible list parity, source status, restored navigation, and consistent filters. Verify that hidden posts cannot affect public tiles, counts, or summaries.
5. **Prove busy-place behavior before exposure grows.** Test spikes, ranking concentration, report handling, notification caps, and meaningful criticism. Introduce topic/event grouping only when it helps comprehension and moderation remains supportable.
6. **Expand carefully.** Street geometry, school/institution workflows, memories, advanced grouping, and additional venue types can follow their specific identity and safety acceptance. Category readiness applies nationwide; local signup count never controls access.

The first public slice should focus on ordinary public venues such as libraries, cafes, parks, and community centers while retaining all existing features. This is category/safety scoping, not a single-city launch. Sensitive locations and arbitrary exact residential pins are not enabled merely to claim universal category coverage.

## 12. How to know whether it works

Evaluate real tasks, not just attractive maps or place-follow counts:

- Can someone find a relevant conversation and explain who wrote it and who can see it?
- Can someone distinguish a public place tag from proof of attendance?
- Does a question receive a useful human reply, including at lower-activity places?
- Does a person voluntarily return to a place or conversation that matters to them?
- Does quiet-place utility succeed without social contributions?
- Can new relevant voices be discovered at a popular place without removing chronological access or legitimate criticism?
- Can a place owner answer transparently without controlling independent expression?
- Do source changes, closures, duplicate merges, and deleted posts preserve truthful history and access?

Measure qualified discovery, first replies, meaningful exchanges, voluntary returns, mute/report/block rates, mistaken place matches, stale facts, moderation effort, author exposure concentration, and processing cost. Segment by place type, geography, density, language, and new versus established contributors. Report reply success separately from views and reactions. Recruited or simulated activity tests the workflow, not organic adoption.

Unacceptable failures include cross-audience disclosure, exposing a protected location, silently moving history to a new occupant, and representing an unverified report as official. Aesthetic polish cannot compensate for these failures. Record acceptance results and remaining limits against the actual release builds.

### 12.1 Acceptance for the additional place-page capabilities

- A first-time reader can distinguish visitor observation, venue report and sourced fact without opening a policy page; they can find a material offer restriction before leaving to redeem.
- A single quoted table wait never appears as a confirmed or predicted wait. Busy, pickup, party-size and waiting-so-far evidence remain distinct; disagreement is visible.
- No reports, expired reports, refresh failure, suppressed reporting and venue-only reports produce distinct understandable states. Offline/delayed uploads and worker retries cannot make old conditions current.
- Repeated submission with one idempotency key has one effect. Concurrent edits require reconciliation, and one account cannot multiply its active influence across service labels within a dimension.
- Protected places do not expose occupancy or visitor presence through direct reads, search, cached cards, notifications, aggregate counts or AI output. No receipt or device-location upload occurs in the initial flow.
- Withdrawal/deletion revokes current evidence and derivatives. A venue cannot erase visitor observations; a visitor cannot relabel a report as venue-authorized or replace an official rule.
- Offer boundaries work across local midnight, timezone changes and daylight-saving transitions; unpublished expiry is not represented as perpetual validity. Withdrawn/expired content is removed from current discovery even when the expiry worker is late.
- Saving an offer never claims redemption. A changed saved offer retains the accepted version and displays the change; a provider-link click records only a handoff.
- Visit info preserves policy/source/tip distinctions, dated scope, conflicts and correction history. Missing information does not become AI-generated guidance.
- On narrow screens and with large text, all primary tabs, terms and actions remain readable. Keyboard focus, screen-reader labels, disclosure state, dialog return and reduced-motion behavior are checked against actual implementations.

The companion is a comprehension/interaction example, not evidence that these backend, policy, provider, accessibility or scale acceptance cases pass. Production evidence belongs with the release build and source contracts.

## 13. Review status and provenance

This proposal was informed by a read-only code review of local master at `939878b4f` and official source documentation on September 9, 2026. PR #14 was freshly verified merged with a successful CI OK result. Local master was behind its recorded origin ref; this audit does not claim to cover every newer remote change or current staging/production behavior. The active release work and other worktrees were not modified.

Provider documentation identifies candidate capabilities and constraints, not purchased access, completed integrations, or nationwide quality certification. Product choices, ranking behavior, density thresholds, and UI treatments here are proposals to validate. Application code and operational configuration remain unchanged by this design work.

The [place-page concept](designs/pantopus-place-page-concept-2026-09-09.html) is also available in conversation. It uses fictional people, posts, venue information, calendar items, conditions, offers and visiting rules. Controls preview local session behavior only; they do not publish observations, follow, save on a server, verify eligibility, reserve, redeem, upload evidence or contact providers. Its visible example interactions illustrate the specified organization; the production data contracts, ingestion, moderation, abuse resistance, aggregation, sensitive-place enforcement and cross-client behavior remain proposed rather than implemented. It is not a functioning geographic map, load-tested service, live condition display or validated production interface. Code findings and document links received a read-only review; no application tests, native-device tests, or live privacy exploit were run for this proposal.
