# Pantopus: make the useful parts work together

Date: September 8, 2026. Status: **reviewable product and interaction proposal**.

This document proposes a next stage for web, iOS, and Android. It does not describe a deployed release. No application changes, deployment, live user test, or notification delivery verification were performed for this proposal. All people, conversations, events, and other example content in the accompanying concept are fictional.

## 1. Product decision

Pantopus should help someone handle everyday life at home, get useful responses nearby, and keep up with people or organizations they choose. Its strongest opportunity is the connection between those jobs, with understandable privacy boundaries.

Keep Home, Pulse, and Beacon as product pillars. Test consumer navigation labeled **Home · Nearby · Following · Inbox**. Nearby contains Pulse conversation; Following contains Beacon updates and discovery. Compare this with **Home · Pulse · Beacons · Inbox** in usability sessions before settling the labels. Clear labels are a hypothesis, not evidence that branding is the problem.

Use settling-in households as the first pilot cohort because a move creates concrete questions and organizational work. This is a working assumption. Renters, established residents, creators, and followers without an address remain supported. Everyone can skip household setup and irrelevant suggestions. Calendar setup is one possible action, not the definition of first value.

## 2. Current implementation and proposed changes

| Area | Current evidence | Proposed change |
| --- | --- | --- |
| Navigation | Place / Today / Nearby / Mail; additional flagged Audience and My Beacon entries. [Navigation source](../frontend/apps/web/src/components/AppShell.tsx) | Four stable consumer destinations; move Today into Home; keep creator management under Following. |
| Home | Address intelligence and household tasks, issues, bills, and documents live in different surfaces. [Place](../frontend/apps/web/src/components/place/PlaceDashboardView.tsx), [household dashboard](<../frontend/apps/web/src/app/(app)/app/homes/[id]/dashboard/page.tsx>) | One destination combining relevant actions, household tools, and sourced address information, while retaining permission distinctions. |
| Entry | Authentication now preserves destinations; private address saving is explicit and separate from household setup. [Implemented continuity](entry-continuity-implementation-2026-09-06.md) | Preserve these repairs. Ask only for information needed for the chosen action. |
| Social access | Pulse and Beacon discovery work without neighborhood density; Beacon following does not require an address. [Implemented discovery](social-discovery-2026-09-06.md) | Retain access and eligibility rules; explain sparse activity within the chosen area. |
| Following | Public search, explicit follow, publishing, and return to an exact permitted update exist locally. [Implemented return](beacon-return-journey-2026-09-07.md) | Bring updates, discovery, and following management together; add useful actions on source content. |
| Completion | Mover checklist copy still promises night-before reminders and one-tap mail return; most checkmarks are device-local manual state. [Checklist](../frontend/apps/web/src/components/place/JustMovedCard.tsx) | Describe actual saved, pending, delivered, and completed outcomes separately. |
| Cross-feature work | Posts support saving; Home supports tasks and calendars. [Post detail](../frontend/apps/web/src/components/feed/PostDetailPanel.tsx) | Add reviewed private source bookmarks and personal calendar saves. Their account-scoped persistence is new work unless a suitable existing contract is verified. |

## 3. Screen hierarchy and recovery

### Entry

Honor a shared post, Beacon, or saved preview before showing general onboarding. For an undecided arrival, offer “Organize something at home,” “See what’s nearby,” and “Follow someone,” with a visible skip. Preview permissible content before requesting an account. Retain the pending destination on authentication failure and offer retry.

Ask for location or notification permission when the relevant action needs it. A manually chosen area remains available for browsing, subject to posting eligibility. This follows Android guidance on [contextual onboarding](https://developer.android.com/design/ui/mobile/guides/patterns/onboarding) and [permission requests and denial](https://developer.android.com/training/permissions/requesting).

### Home

Order the screen as: selected personal/household context; **Needs attention**; upcoming personal or household items; quick access to tasks, documents, and other tools; **About this address** with source and coverage labels. “Your day” replaces the address-summary use of “Today’s Pulse.” Show only a few useful items initially, with access to the rest.

Every item says “Only you” or names its authorized household. A personal workspace does not require a Home membership. Where account-owned notes, tasks, or calendar records do not exist, implement that capability explicitly; do not create household access to make the screen look populated.

Empty: explain what can be saved and offer one small action. Address-free users can continue elsewhere. Error: retain confirmed records, mark stale information, and retry the failed section. Missing public coverage is different from a service failure.

### Nearby

Show the chosen area, Pulse conversations, and primary actions **Ask · Share · Event**. Reveal specialized post fields after selection. Keep Marketplace and paid help available as contextual destinations without requiring them for social participation.

Each post shows its acting identity and audience. Empty: state that there is little recent activity, offer a legitimate question or an explicitly chosen different area. Never fabricate neighbors, replies, or automatically broaden the scope. Error: retain the selected area and draft; offer retry without presenting an empty-success feed.

### Following

Lead with recent permitted updates from followed Beacons. Put Explore and Manage following next; creator publishing stays under My Beacon. Public profiles explain who publishes, what to expect, and when a real update last appeared. Any curated examples in the live product require real, consenting publishers.

Empty: show a short explanation and public search, with no address request. Error: distinguish unavailable search from unavailable updates. A restricted or removed post has an access state; it must not appear as an unexplained blank card.

### Inbox

Use **Updates · Messages · Mail**. Updates holds relevant replies and followed-content changes; Messages preserves personal and audience conversation identity; Mail retains digital-mail scopes and permissions. Items open the exact source, with consistent unread state. Never combine content merely because it belongs to one account.

Empty states explain their category. Failed delivery is distinct from a failed fetch. A revoked source explains its unavailability without showing cached restricted text. Keep tabs and labels predictable, consistent with [Apple tab-bar guidance](https://developer.apple.com/design/human-interface-guidelines/tab-bars).

## 4. Two connected journeys

### A. A private repair concern becomes a useful local answer

The concept starts with an existing private tap-repair note. Its title, text, media, and address stay private. “Ask nearby” opens a **separate blank public composer**. The person writes the question they want others to see; Pantopus does not copy or summarize the note into it.

Before posting, show the exact public text, selected attachments, acting display identity, and audience/area. Explain whether the post is public or restricted using the actual visibility contract. Only **Post question** submits. A failed request keeps the draft; a successful response opens the stored post.

A real reply appears in Updates and opens that conversation. “Save privately” creates an account-owned source bookmark, optionally linked to the private note. The reply author receives no access to that note. Source content is fetched only after current permission checks; revoked access never becomes a permanent readable snapshot. A separate user-authored note can remain private without copying restricted text.

Existing foundations: notes/issues or household records where authorized, Pulse questions/comments, post saving, and notifications. **New work:** the blank-composer entry, reviewed boundary, durable private association, and any missing account-owned record contract. Fictional prototype replies must never be confused with live community responses.

### B. A followed event becomes a personal plan

A visitor opens a public organizer Beacon, reads an event update, and explicitly follows without entering an address. “Save to my calendar” opens a review of title, date, time zone, location, source, and destination **Only you**. The user corrects missing details and confirms the save.

Existing Home calendars are household-scoped. If no account calendar is available, build one for this journey; do not demand household membership or silently create a Home. Sharing to an authorized household is a later, separate action with another audience preview.

If the organizer changes the source, Updates offers **Review change**, showing old and new values. Keep the saved calendar entry unchanged until the person accepts. Cancellation is also a reviewable change. Notification opt-out does not remove the saved event or readable updates.

Existing foundations: Beacon publishing/following, post details, and Home calendar editing. **New work:** structured or reviewed event extraction, personal-calendar persistence, source association, change comparison, and explicit acceptance. In-app saving does not claim to write to Apple or Google Calendar.

## 5. Identity, audience, and honest states

“Only you,” “Members of [household],” and an actual public/restricted audience are distinct labels. Show the acting identity immediately above a composer and repeat it in the final preview. Changing identity or audience invalidates the previous preview. Do not imply that a verified address makes a person trustworthy or qualified.

Private bookmarks, household membership, residency, and ownership remain separate facts. No address entry grants membership. No private note, exact home address, identity link, or attachment travels into public content by default. Apply these boundaries to responses, search, previews, analytics, source bookmarks, and notifications, using the existing [identity serializers](../backend/serializers/identitySerializers.js) and authorization services.

Use “Saved to your calendar” only after confirmed persistence. Use “Posted” only for a stored post, not a queued click. “No replies yet” describes a successful empty result. Reminder delivery and physical mail handling require separate verified capabilities. Manual checkmarks describe the person’s own completion claim, not work performed by Pantopus.

Request notifications for a concrete benefit such as replies to a posted question; retain in-app alternatives. Notification titles and destinations should identify relevant content, following [Apple notification guidance](https://developer.apple.com/design/human-interface-guidelines/notifications). Current [staging notes](beacon-staging-verification-2026-09-07.md) explicitly leave live delivery unverified.

## 6. Dependency-ordered implementation

### Package 1 — coherent destinations and ownership

Inventory existing personal and household data contracts; specify missing account-owned notes/tasks/bookmarks/calendar records before promising them. Map old routes into the four destinations, simplify household setup, and correct misleading copy. Retain all existing records, access rules, entitlements, and balances.

Acceptance: address-free users reach Nearby and Following; old links open intended content; auth/retry preserves intent; another account cannot read private records; entering an existing address grants no household rights; every screen handles loading, empty, error, and keyboard/screen-reader use. Test both label sets with people before selecting one.

### Package 2 — complete the question-to-private-save journey

Implement the blank public composer from a private note, exact review, explicit submission, reply return, and account-owned source bookmark with permission checks. Reuse existing posting and conversation services.

Acceptance: private note text/media/address never appears in the public request or notification; changing identity requires review; retries cannot duplicate posts or saves; a real second test account replies and the first opens that exact conversation; a third account cannot see the private association; source revocation removes readable previews across list/detail/notification entry paths.

### Package 3 — personal planning, device validation, and pilot

Implement the reviewed event save and source-change comparison on the established personal ownership contract. Then run the connected journeys against the designated staging database and released-platform builds, including physical notification delivery. Pilot only behavior the tested build actually supports.

Acceptance: an address-free follower saves one private event; duplicate taps create one record; date/time-zone edits persist; source changes never silently overwrite it; household sharing requires explicit authorization; mute/denial still permits in-app return; foreground, background, and terminated-app notifications open the exact allowed source. Record unavailable platforms as unverified.

## 7. Eight usability tasks

Use fictional content in prototype sessions and consenting participants’ chosen tasks in a live pilot. Observe without coaching first.

The accompanying concept demonstrates one private task, one neighborhood question with an explicitly fictional reply, private bookmarking, public following, and a reviewed personal event save. It offers label and empty-neighborhood alternatives. State lasts for the current concept session; it does not persist to a service. Audience editing, posting failures, organizer changes, notification delivery, and mute behavior below are specified for subsequent interactive/staging tests and are not implemented in this concept.

Local browser review on September 8 exercised blank-question validation, preview and simulated posting, Inbox reply navigation and read state, private bookmarking, explicit following, event review/save, address-free event saving, and a quiet area with no fabricated reply or unread badge. Light and dark rendering were inspected at narrow/mobile and conversation widths; the narrow layout had no horizontal overflow. This checks the concept's behavior, not production persistence, access enforcement, user demand, or the proposed usability tasks that require additional implementation.

1. Explain what each tab contains, then find a household task and a followed update.
2. Follow an organizer without entering an address or creating a Beacon.
3. Save private information and explain who can read it.
4. Start a nearby question from the repair note; identify what remains private.
5. Review the acting identity, area, and exact text; change the audience before posting.
6. Recover from a failed post, open a reply, and privately bookmark its source.
7. Save an event personally, review a changed time, and decline the change.
8. Find Updates, Messages, and Mail; mute one Beacon and still retrieve its content.

Record independent completion, errors, wrong destinations, backtracking, assistance, time, and participants’ explanations of visibility. Compare label alternatives with counterbalanced order or separate groups. A prototype tests comprehension and interaction; simulated replies cannot establish demand.

## 8. Pilot evidence and later work

Start with roughly 30 participants in one community, including settling-in renters/owners, address-free followers, and real creator/follower pairs. Observe four weeks, then extend promising cohorts to learn whether returns persist. Do not require everyone to activate every pillar.

Measure each actual first outcome separately: private record saved; eligible question answered; explicit follow followed by reading a later update; personal event saved and revisited. Count useful returns by week, distinguish founder-prompted sessions, record unanswered questions and response times, voluntary referrals, creator continuation, and support minutes. Report acquisition cost per activated and retained participant/household separately, with denominators and channel.

Agree experiment targets before recruitment; there are no established conversion or retention benchmarks in this proposal. Repeated privacy misunderstanding blocks wider exposure. Strong activation with weak voluntary return calls for revisiting usefulness; sustained use by a small subgroup supports a narrower next pilot. These are decision rules, not claims of product-market fit.

Deprioritize broad paid acquisition, nationwide marketplace liquidity, new paid Beacon tiers, autonomous household actions, comprehensive inventory, and cosmetic redesign of every screen. Preserve reachable commitments. Prefer completing the two connected journeys and learning from use, consistent with the [v1 release brief](v1-release-brief-2026-09-06.md). Engineering test success in the [master integration](master-integration-2026-09-07.md) is progress toward reliability, not evidence of adoption.
