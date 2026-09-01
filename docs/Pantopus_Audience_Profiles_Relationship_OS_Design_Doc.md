
# Pantopus Audience Profiles: Identity-Safe Relationship OS

**Design Doc + R&D Brief**  
**Date:** May 8, 2026  
**Status:** Product strategy, UX architecture, monetization model, and implementation blueprint  
**Author:** ChatGPT, synthesized from Pantopus product context, uploaded brainstorm notes, current repo inspection, and competitive/UX research

---

## 0. One-line promise

For creators, experts, local personalities, founders, service providers, and public builders:

> **Build a public circle without exposing your private life.**

For followers, fans, customers, students, and supporters:

> **Choose how close you want to be.**

For Pantopus:

> **Audience Profiles are an identity-safe relationship OS for public people, fans, local services, commerce, bookings, and real-world communities.**

---

## 1. Executive summary

Pantopus should not build a generic creator page, Patreon clone, Instagram broadcast channel, or Discord-lite room system. Those patterns are already established.

The Pantopus wedge is stronger:

> **Public reach, private boundaries, structured closeness.**

An Audience Profile should let a user create a public-facing identity that can attract followers, broadcast updates, monetize access, sell services, host drops, answer questions, and interact with fans without automatically exposing that user’s private, home, neighborhood, friend, household, or local-resident identity.

The central product idea is **controlled access to a public person**, not just paid content. That means the feature must be designed around five primitives:

```txt
Persona      = who is speaking
Audience     = who is listening
Access       = what they can do
Interaction  = how they engage
Boundary     = what must not leak
```

This design creates a product that competitors cannot easily copy because Pantopus combines:

```txt
creator-style broadcasting
+ paid membership
+ structured fan interaction
+ local verification
+ booking and gig commerce
+ digital mailbox/inbox routing
+ real-world trust
+ identity firewalls
```

The recommended MVP is:

```txt
Audience Profile
Relationship Rings
Follow privately/publicly
Broadcasts
Ask Box
Member-only posts/broadcasts
View-As Firewall Preview
Identity Bridge Settings
Basic paid membership
Creator dashboard
Fan dashboard
Simple drops/bookings
Moderation controls
```

The long-term version becomes a new Pantopus pillar: **a public-identity economy** where people can safely turn reputation, skill, fame, knowledge, neighborhood trust, or fan demand into relationships, payments, services, events, bookings, and commerce.

---

## 2. Strategic thesis

### 2.1 The market already understands follows, memberships, and broadcasts

Existing platforms already offer many baseline pieces:

- Patreon supports creator pages, monthly and annual memberships, digital product sales, video hosting, chats, polls, comments, audience insights, and a standard platform fee structure for new creators. [^patreon-fee]
- Patreon supports paid tiers, benefits, member limits, selected-tier access, Discord roles, and paid/exclusive post access. [^patreon-tiers] [^patreon-post-access]
- YouTube channel memberships support multiple membership levels where higher-priced levels inherit lower-tier perks. [^youtube-memberships]
- Instagram broadcast channels support creator announcements, replies, prompts, polls, and insights. Meta reported more than 1.5 billion monthly messages exchanged in broadcast channels. [^instagram-broadcast]
- Substack Chat is positioned as a subscriber-only community space where writers set the guest list, topics, tone, and rules. [^substack-chat]
- Circle positions itself as an all-in-one community platform with community, chat, CRM, events, courses, AI agents, email marketing, payments, and automation. [^circle]
- Passes positions itself around creator monetization through subscriptions, exclusive content, messaging, livestreams, merch, one-on-one calls, and automation. [^passes]

So Pantopus should assume the market already expects:

```txt
follow
subscribe
paid tier
member-only content
broadcast
chat
exclusive post
DM
livestream
events
analytics
```

Those are table stakes, not the moat.

### 2.2 The human problem is context collapse

Social platforms collapse different audiences into one shared performance space. Academic work on context collapse describes how social media often blurs public/private, professional/personal, and multiple selves into one context, causing intentional context collusion or accidental context collision. [^context-collapse]

Pantopus is uniquely positioned to solve this because its broader product already understands real-world contexts:

```txt
person
home
household
address
neighborhood
business
gig/service identity
mailbox
friends/connections
local trust
```

A user may be all of these at once:

```txt
public creator
neighbor
parent
tenant
landlord
business owner
service provider
customer
friend
household member
local resident
```

Most platforms ask:

```txt
Who are you?
```

Pantopus should ask:

```txt
Which version of you is speaking?
Who is allowed to see it?
How close can they get?
What must remain separate?
```

That is the signature insight.

### 2.3 The product category Pantopus should create

Do not position this as “creator memberships.” Position it as:

> **Identity-safe public relationships.**

Or more productively:

> **An Audience Profile is a public persona with controlled access, fan interaction, memberships, bookings, drops, and identity firewalls.**

This is broader than creators. It works for:

```txt
influencers
founders
local chefs
tutors
coaches
musicians
artists
fitness trainers
photographers
community leaders
local journalists
realtors
contractors
religious leaders
public builders
small business personalities
marketplace sellers
neighborhood experts
```

Pantopus should let anyone with skill, trust, attention, service demand, or local reputation build a public circle.

---

## 3. Differentiation map

| Platform | Core strength | Limitation Pantopus can exploit |
|---|---|---|
| Instagram | Public attention, social graph, broadcast channels | Weak identity separation across real-world contexts; limited structured paid access and local trust |
| Patreon | Paid memberships, content, community, creator economics | Mostly content/community subscriptions; not deeply local, not address/home-aware |
| YouTube Memberships | Video-native memberships and perks | Tied to channel/content consumption; limited real-world identity firewall |
| Substack | Writer-led subscriber relationship | Strong for publishing, weaker for services, gigs, local identity, drops |
| Discord | Always-on community chat | Overwhelming for creators, weak monetization UX, weak identity boundaries |
| Circle | All-in-one branded communities | Powerful but generic community/business tooling, not home/neighborhood identity-aware |
| Passes | Creator monetization, paid DMs/calls | Monetization-heavy, less about real-world local trust and identity-safe context separation |
| **Pantopus** | **Identity-safe public relationships connected to homes, local verification, bookings, gigs, drops, digital mailbox, and controlled access** | Must execute privacy and UX carefully |

The wedge:

> **Pantopus lets public people safely turn attention into trusted relationships and real-world action.**

---

## 4. Current codebase alignment

This section was re-checked against the current repo branch. The earlier ZIP-era inventory is stale: this branch already includes an MVP Identity Firewall / Audience Profile implementation.

### 4.1 Existing implementation in current branch

The current branch already includes the main free Audience Profile, follow, broadcast, bridge, preview, and audit primitives:

```txt
backend/database/migrations/033_feed_posting_redesign.sql
- post_as enum: personal | business | home
- audience enum and Post audience columns

backend/database/migrations/038_feed_v11_surfaces.sql
- distribution_targets text[] for routing: place | followers | connections

backend/database/migrations/128_identity_firewall_personas.sql
supabase/migrations/20260505000001_identity_firewall_personas.sql
- add post_as_type = persona and post_audience = public
- create LocalProfile
- create PublicPersona
- create PersonaFollow
- create IdentityBridgeSetting
- create BroadcastChannel
- create BroadcastMessage
- create IdentityAuditLog
- add Post.author_user_id, identity_context_type, identity_context_id
- keep identity bridges off by default
- enforce one active PublicPersona per user

backend/database/migrations/129_identity_firewall_hardening.sql
supabase/migrations/20260505000002_identity_firewall_hardening.sql
- harden PersonaFollow.source values
- ensure IdentityAuditLog exists in older environments

backend/database/migrations/130_identity_firewall_followers_broadcast_analytics.sql
supabase/migrations/20260506000001_identity_firewall_followers_broadcast_analytics.sql
- add BroadcastMessage.delivered_count and read_count
- add PersonaFollow persona/status/created index

backend/routes/personas.js
- create, update, and load Audience Profiles backed by PublicPersona
- create default bridge settings and broadcast channel
- follow, unfollow, follow status, notification preferences
- owner follower review/moderation
- persona creation, update, follow, and unfollow audit logs

backend/routes/broadcastChannels.js
- publish and read broadcast messages
- support visibility = public | followers | subscribers
- notify eligible PersonaFollow recipients
- maintain aggregate delivered/read counters

backend/routes/identityCenter.js
- Identity Center payload
- View-As preview for local and persona surfaces
- bridge updates with audit receipts

backend/routes/identitySearch.js
- profile discovery across LocalProfile and PublicPersona
- bridge-aware linked local/public profile results

backend/routes/posts.js
- identity_context_type / identity_context_id support
- persona audience routing through persona_followers distribution target
- posting guard via backend/utils/identityPolicy.js

backend/serializers/identitySerializers.js
- serializeLocalProfileForViewer
- serializeAudienceProfileForViewer
- serializePostAuthorForViewer
- sanitizePersonaPostForViewer

frontend/packages/api/src/endpoints/personas.ts
frontend/packages/api/src/endpoints/broadcast.ts
frontend/packages/api/src/endpoints/identityCenter.ts
frontend/packages/types/src/identity.ts
- API clients and shared identity/persona/broadcast types

frontend/apps/web/src/app/(app)/app/persona/page.tsx
frontend/apps/web/src/app/(app)/app/persona/broadcast/page.tsx
frontend/apps/web/src/app/persona/[personaHandle]/AudienceProfileClient.tsx
frontend/apps/mobile/src/app/identity/persona.tsx
frontend/apps/mobile/src/app/identity/broadcast.tsx
frontend/apps/mobile/src/app/persona/[personaHandle].tsx
- web and mobile owner/public Audience Profile surfaces

backend/tests/unit/identityFirewallPrivacy.test.js
backend/tests/unit/identityFirewallRegression.test.js
backend/tests/unit/identityFirewallMigrationSmoke.test.js
backend/tests/unit/identityPolicy.test.js
backend/tests/unit/identitySerializers.test.js
frontend/apps/web/tests/identityFirewallWeb.test.tsx
frontend/apps/web/tests/e2e/identity-firewall.spec.ts
- regression, privacy, migration, policy, serializer, and web flow coverage
```

This confirms that the first engineering pass should not recreate base persona, follow, broadcast, bridge, audit, or View-As primitives. The next work should harden, reconcile, and extend the implementation that already exists.

### 4.2 What remains not first-class yet

The full Relationship OS design still has important gaps relative to the current branch:

```txt
PersonaMembership
PersonaTier
PersonaEntitlement
AskBox / PersonaInteractionRequest
ConversationAccess
BroadcastReadReceipt
```

Specific current-state notes:

```txt
PublicPersona is the database table; AudienceProfile is the user-facing/API type.
PersonaFollow exists and is the correct free audience graph.
BroadcastMessage currently uses visibility = public | followers | subscribers, not target_mode = public | followers | tier | entitlement | custom_segment.
The current subscribers visibility maps to PersonaFollow.relationship_type = subscriber; it is not a paid membership primitive yet.
Broadcast analytics are aggregate delivered_count/read_count counters; there is no per-user BroadcastReadReceipt table yet.
backend/utils/identityPolicy.js exists, but it primarily guards posting identity-to-audience combinations.
Read/access decisions for persona posts, broadcasts, View-As, and discovery are still split across routes and preview helpers.
IdentitySearch uses PublicPersona.is_searchable today; richer persona search visibility needs schema/API reconciliation before local trust discovery expands.
Ask Box, paid memberships, entitlements, access tokens, bookings, drops, and paid 1:1 access are still future layers.
```

So the next implementation phase should be framed as **hardening and extension**, not greenfield creation.

### 4.3 Core implementation warning

Do **not** use `UserFollow` as the audience or paid audience relationship source of truth.

`UserFollow` is a personal/user-level social graph. Audience Profiles need a separate graph because following a public persona should not automatically expose or connect:

```txt
personal identity
home identity
neighborhood identity
friend graph
household membership
private contact fields
local address context
```

Recommended rule:

```txt
UserFollow does not grant AudienceProfile access.
Neighborhood relationship does not grant AudienceProfile access.
HomeOccupancy does not grant AudienceProfile access.
PersonaFollow grants only explicit free AudienceProfile access.
Future PersonaMembership grants only the explicit AudienceProfile access purchased or joined.
Paid membership grants access to entitlements, not to the owner’s whole life.
```

---

## 5. Product principles

### Principle 1: Structured closeness beats generic subscription

Fans should not feel like they are buying “tier 2.” They should feel like they are choosing a relationship.

Use language like:

```txt
Follow quietly
Get all updates
Join the circle
Ask a question
Book this person
Support monthly
Get 1:1 access
Shop drops
Attend events
```

### Principle 2: Privacy should be visible, not hidden

UX research stresses clear system status and user control. NN/g’s usability heuristics emphasize visibility of system status and user control/freedom; these are crucial when a privacy mistake can expose a user to the wrong audience. [^nng-status] [^nng-control]

Every composer, profile, membership, and cross-post should show:

```txt
Posting as: Founder Profile
Visible to: Members
Hidden from: Neighbors, Friends, Household, Local Profile
Identity bridge: Off
Location exposure: None
```

### Principle 3: Fans need privacy too

A fan may want to follow, support, or pay privately. Privacy should work in both directions.

### Principle 4: Creator bandwidth is scarce

Popularity creates attention pressure. The product should protect the profile owner from unlimited obligations.

Use:

```txt
Ask quotas
Access tokens
Quiet hours
Paid priority lanes
AI summaries
Mod queues
Auto-replies
Structured 1:1 requests
```

### Principle 5: Monetize access, services, and real-world action, not only content

Subscriptions are useful, but Pantopus can differentiate through:

```txt
paid questions
booking slots
local drops
service requests
events
consults
marketplace items
local verified access
```

### Principle 6: Safe defaults, powerful customization

NN/g’s recent form guidance emphasizes reducing cognitive load through structure, transparency, clarity, and support. [^nng-cognitive-load]

Pantopus should suggest safe defaults based on creator type, then let advanced users customize.

---

## 6. Core terminology

Recommended user-facing names:

```txt
Audience Profile
Public Profile
Pantopus Channel
Member Circle
Inner Circle
Broadcasts
Ask Box
Drops
Book Me
Private Follow
Firewall Preview
```

Avoid making “fans” the only label. Let owners rename their audience:

```txt
Followers
Fans
Members
Supporters
Students
Clients
Customers
Crew
Circle
Community
Subscribers
Builders
Explorers
Neighbors
```

Internal data model can use neutral terms:

```txt
Persona
Audience
Membership
Tier
Entitlement
InteractionRequest
Broadcast
Boundary
Bridge
```

---

## 7. Relationship Rings

Do not model this only as Bronze/Silver/Gold. Model closeness.

| Ring | Name | Main purpose | Typical access | Payment |
|---:|---|---|---|---|
| 0 | Public Visitor | Browse safely | Public bio, public posts, public offers, public events | Free |
| 1 | Follower | Receive updates | Broadcasts, public prompts, reactions, public drops | Free |
| 2 | Member | Participate | Member-only posts, Ask Box, member room, early access | Free-approved or paid |
| 3 | Inner Circle | Scarce closeness | Priority questions, small group rooms, office hours, VIP drops | Paid or limited |
| 4 | 1:1 Access | Direct help | Paid questions, consults, bookings, mentorship, private reply | Paid per use or included by quota |
| 5 | Trusted Collaborator | Operational access | Moderator, assistant, manager, co-host, business admin | Not a fan tier |

### Ring 0: Public Visitor

Can see:

```txt
public bio
public posts
public offers
public events
public products/services
safe public identity only
```

Cannot see:

```txt
home identity
neighborhood identity
friend graph
private profile
member broadcasts
Ask Box internals
1:1 access
private contact fields
```

### Ring 1: Follower

Receives:

```txt
basic broadcasts
new post alerts
public polls
event announcements
drop notifications
creator updates
```

UX language:

```txt
Follow for updates
Get notified
Stay in the loop
```

### Ring 2: Member

Receives:

```txt
member-only broadcasts
member-only posts
Ask Box access
member room
behind-the-scenes updates
early event/drop access
discounts
badge
```

UX language:

```txt
Join the circle
Become a member
Get closer access
```

### Ring 3: Inner Circle

Receives:

```txt
priority questions
small-group conversations
private livestreams or office hours
limited early RSVP
founder notes
private drops
higher creator visibility
```

Default safety rule:

```txt
Inner Circle is limited-seat or quota-bound.
```

Do not default to unlimited DM access.

### Ring 4: 1:1 Access

Direct access should be structured and scarce:

```txt
paid question
private consult
paid DM request
mentorship slot
service appointment
custom task
personalized answer
```

Recommended contract:

```txt
You get 2 priority questions/month.
The creator may reply by text, audio, or video.
Usual response window: 3 days.
No off-platform contact.
No emergency requests.
Abusive messages lose access.
```

### Ring 5: Trusted Collaborator

This is for operations:

```txt
assistant
moderator
manager
co-host
brand partner
team member
business admin
```

Collaborators should gain only explicit profile-management permissions, not the owner’s private home/local identity.

---

## 8. Creator UX

### 8.1 Relationship Builder onboarding

Do not start with a generic form. Start with a guided setup:

```txt
Build Your Public Circle
```

#### Step 1: What kind of public identity is this?

Options:

```txt
Creator / influencer
Founder / public builder
Local expert
Teacher / coach
Artist / musician
Food maker
Service provider
Community leader
Shop / seller
Personal brand
Other
```

#### Step 2: What do people come to you for?

Options:

```txt
Updates
Advice
Entertainment
Local services
Classes
Products
Events
Behind-the-scenes content
Community
1:1 help
```

#### Step 3: How close can followers get?

Use a visual closeness ladder:

```txt
Updates only
Comments and reactions
Ask me questions
Join member room
Book services
1:1 access
```

#### Step 4: Do you want paid access?

Options:

```txt
No, free only
Yes, simple paid member tier
Yes, multiple tiers
Yes, paid questions or bookings
Not yet, remind me later
```

#### Step 5: Protect your identity

Default all bridges off except safe interaction:

```txt
Show this profile to my neighbors: Off
Show this profile to my friends: Off
Show my local profile to followers: Off
Show my home/neighborhood context: Off
Allow fans to request my real identity: Off
Allow fans to book me without seeing my address: On
```

#### Step 6: Preview as different people

Before publishing:

```txt
Public visitor sees this
Follower sees this
Member sees this
Neighbor sees this
Friend sees this
Household member sees this
```

This is the first trust-builder.

### 8.2 Creator dashboard

The creator dashboard should be a command center, not just a post list.

Sections:

```txt
Today
Audience
Broadcasts
Ask Box
Members
Revenue
Drops
Bookings
Rooms
Firewall
Insights
Settings
```

#### Today cockpit

Example:

```txt
18 new followers
4 paid questions
2 booking requests
1 identity warning
37 unread member replies
Top fan topic: pricing
Suggested action: run a poll
```

#### Audience

Segments:

```txt
new followers
active followers
members
inner circle
local verified
past customers
event attendees
at-risk members
top supporters
potential collaborators
blocked/muted
```

#### Ask Box

Filters:

```txt
new
paid
member
urgent
popular
from verified local user
from past customer
safe to answer publicly
needs private reply
```

#### Revenue

Show:

```txt
monthly recurring revenue
paid questions
bookings
drops
events
tips
refunds
churn
conversion rate
upgrade candidates
```

#### Firewall

Show:

```txt
identity bridges active
recent exposure events
posts that reveal location
who can see what
pending risky cross-posts
view-as preview
```

### 8.3 Bandwidth Meter

Popular users drown in attention. Build a meter:

```txt
Your current settings may create about 120 fan messages/week.
Recommended: restrict Ask Box to Members or add a 3-question/month limit.
```

Controls:

```txt
quiet hours
weekly reply budget
max Ask Box submissions per fan
member-only replies
paid priority lane
auto-close stale threads
auto-reply expectations
delegate to moderator
AI summarize before showing
```

### 8.4 Ritual templates

Communities stick through rituals, not just features.

Templates:

```txt
Monday Briefing
Friday Ask Me Anything
Monthly Office Hours
Weekly Drop
Behind-the-Scenes Sunday
Member Poll Day
Local Meetup Window
Top Questions Recap
New Supporter Welcome
```

Type-specific examples:

| Profile type | Rituals |
|---|---|
| Tutor | Sunday study plan, Wednesday quiz, Friday Q&A |
| Chef | Tuesday menu vote, Thursday preorder, Saturday pickup drop |
| Founder | Monday roadmap note, Wednesday beta question, Friday build log |
| Musician | Monday setlist poll, Friday demo drop, monthly listening room |
| Fitness coach | Weekly plan, member check-in, monthly challenge |

---

## 9. Fan UX

### 9.1 Choose Your Closeness

The Audience Profile page should show relationship actions, not only content tabs.

Recommended action bar:

```txt
Follow
Ask
Book
Join Circle
Support
Drops
Events
```

Alternative expanded menu:

```txt
Follow quietly
Get all updates
Join the member circle
Ask a question
Book this person
Support monthly
Get 1:1 access
Shop drops
Attend events
```

This is emotionally better than “Subscribe.”

### 9.2 Private Follow

Fans should control their own visibility.

Options:

```txt
Follow publicly
Follow privately
Show my member badge
Hide my member badge
Let creator see my basic profile
Let creator see only my display name
Let creator know I am verified local, without exact address
Allow this creator to message me
Mute broadcasts but stay subscribed
```

Private Follow could become a quietly beloved feature because Pantopus mixes local, friend, home, and public identity contexts.

### 9.3 Fan dashboard

Fans need a home for their public relationships.

Sections:

```txt
Profiles I follow
Memberships
Unread broadcasts
Questions I asked
Upcoming events
Drops I joined
Bookings
Receipts
Badges
Notification settings
Privacy settings
```

A fan’s relationship inbox should be organized by purpose:

```txt
Updates
Member posts
Replies to me
Ask Box answers
Booking updates
Drops
Events
```

### 9.4 Audience Passport

Each fan can have a safe membership card for each persona:

```txt
member since
ring level
badges
questions used this month
booking eligibility
local verification status
drops joined
events attended
privacy settings
```

For the fan, it feels like a membership card.  
For the creator, it is safe relationship metadata.

---

## 10. Interaction model

Do not make open chat the center of the product. Open chat is high-noise and high-moderation. Start with structured interaction.

### 10.1 Broadcasts

Creator speaks to many.

Targeting:

```txt
public
followers
members
inner circle
local verified
past customers
event attendees
custom segment
```

Use for:

```txt
announcements
updates
behind-the-scenes
event notices
new service availability
marketplace drops
local alerts
```

Replies can be:

```txt
off
reactions only
nested replies
member-only replies
creator-curated replies
```

### 10.2 Prompts

Creator asks a question. Fans respond.

Examples:

```txt
What should I teach next?
Which city should I visit?
Who wants a local meetup?
Which product should I drop?
What questions should I answer Friday?
```

Filters:

```txt
all replies
most liked
paid members
verified locals
top supporters
unanswered
AI summarized
```

### 10.3 Ask Box

Fans submit questions privately or semi-privately. Creator can:

```txt
ignore
like
answer privately
answer publicly
turn into FAQ
convert to paid answer
pin as topic
send to moderator
anonymize and publish
```

This is likely the highest-leverage fan interaction feature.

### 10.4 Rooms

Do not build a full Discord clone first. Start with lightweight tier rooms:

```txt
Follower room
Member room
Inner Circle room
Event room
Course room
Local chapter room
```

Room features:

```txt
posts
threads
polls
pinned resources
rules
moderators
member-only visibility
AI summaries
```

### 10.5 1:1 Requests

Do not default to open DMs. Use structured request flows:

```txt
paid question
consult booking
private reply request
mentorship request
service request
custom project
```

Creator can:

```txt
accept
decline
refund
delegate
answer publicly after anonymizing
close conversation after expiration
```

### 10.6 Drops

Drops are a major Pantopus-native wedge.

A persona can drop:

```txt
limited service slots
digital content
local meetup tickets
homemade food pickup windows where legal
workshop seats
consultation openings
merch
marketplace items
discount codes
gig availability
early booking windows
```

### 10.7 Book Me / Hire Me

Every Audience Profile should be able to decide whether it is also bookable.

Examples:

```txt
Book a photographer
Hire a tutor
Request a meal drop
Schedule a coaching session
Invite musician to event
Ask founder for advisory call
Hire local expert
```

This connects the audience layer to Pantopus’s marketplace/gig vision.

### 10.8 Office Hours

Scheduled interaction windows:

```txt
live Q&A
member office hours
local meetup planning
inner circle review
beta feedback session
paid consult window
```

Fans can reserve slots or submit questions beforehand. This prevents random 24/7 pressure.

---

## 11. Monetization design

### 11.1 Product position

Users with a fanbase should absolutely have paid features. But the model should be:

> **Pay for structured access, benefits, services, and closeness.**

Not merely:

> Pay to see locked posts.

### 11.2 Fan-to-creator payments

Support these monetization types over time:

```txt
free follow
monthly membership
annual membership
one-time support
paid question
paid DM request
paid booking
paid event
paid drop
paid course/resource
tips
gifted memberships
limited-seat tier
local-only offer
```

### 11.3 Recommended MVP paid bundle

Start with:

```txt
Free follow
Paid member tier
Member-only broadcasts
Ask Box
Paid question
Creator payout dashboard
```

Then add:

```txt
Limited 1:1 requests
Drops
Book Me
Inner Circle
Access tokens
Member rooms
```

### 11.4 Creator payment onboarding

Not every user should be able to receive money immediately.

Recommended gates:

```txt
Create Audience Profile: available to all users
Enable paid memberships: requires payment onboarding
Enable paid 1:1: requires payment onboarding and policy agreement
Enable local services/bookings: may require stronger verification
Enable regulated services: restricted or reviewed
```

### 11.5 Platform fees

A simple first model:

```txt
Creator earns: 85% to 90%
Pantopus takes: 10% to 15%
Payment processor takes normal fees
```

For MVP:

```txt
Pantopus takes 10% of paid memberships, paid questions, bookings, and drops.
```

Later:

```txt
Free creator tools: 10% transaction fee
Pro creator plan: lower transaction fee + advanced AI/analytics
Business plan: teams, CRM, exports, collectives, premium support
```

### 11.6 Relationship Contracts

Every paid ring or access product should show a clear expectation card.

Example:

```txt
Member Circle

You get:
- member-only broadcasts
- access to the Ask Box
- early access to drops
- member badge

You do not get:
- private phone number
- home address
- guaranteed replies
- unlimited DMs
```

For 1:1:

```txt
Priority Questions

You get:
- 2 questions/month
- creator may reply by text/audio/video
- usual response window: 3 days

Boundaries:
- no emergencies
- no off-platform contact
- abusive messages lose access
```

This protects both sides and reduces confusion, chargebacks, harassment, and entitlement.

### 11.7 Access Tokens

Instead of vague benefits, tiers can include tokens:

```txt
3 Ask Tokens/month
1 Priority Reply Token/month
2 Booking Priority Tokens/quarter
1 Event Guest Pass
5 Drop Early-Access Tokens
```

Tokens make access concrete and protect creators from unlimited obligations.

---

## 12. Identity firewall UX

### 12.1 Firewall Preview

Every owner should have a `View As` tool:

```txt
View as Public Visitor
View as Follower
View as Member
View as Inner Circle
View as Neighbor
View as Friend
View as Household Member
View as Customer
```

This turns privacy from hidden policy into visible confidence.

### 12.2 Context Bridge controls

Pantopus should support explicit bridges between identities.

Default: off.

Examples:

```txt
Show my Audience Profile on my Local Profile: Off
Show my Local Profile on my Audience Profile: Off
Allow followers to know my city: Off
Allow verified locals to find this profile: Off
Allow this post to appear in neighborhood feed: Off
Allow this post to appear in marketplace: Off
Allow fans to book me: On
Allow booking without revealing address: On
```

When a bridge turns on:

```txt
Turning this on means neighbors may discover your Audience Profile.
```

When cross-posting:

```txt
This post will connect your public persona with your local profile.
Continue?
```

### 12.3 Composer visibility capsule

Every composer should show:

```txt
Posting as: Founder Profile
Visible to: Members
Hidden from: Neighbors, Friends, Household
Identity bridge: Off
Location exposure: None
```

Tiny UI capsule:

```txt
Members only · Not linked to local profile
```

### 12.4 Boundary Score

Before posting, show a calm risk signal:

```txt
Boundary score: Safe
```

or:

```txt
Boundary score: Medium risk
This post mentions your neighborhood and a family member.
```

Risk dimensions:

```txt
location
home identity
family
legal name
phone/email
friend graph
workplace
school
financial info
cross-profile link
```

### 12.5 Context-safe cross-posting

Options:

```txt
Audience Profile only
Followers
Members
Inner Circle
Also share to local neighborhood
Also share to business profile
Also share to event attendees
Also share to marketplace/gigs
Also share to home/community board
```

If cross-posting connects identities, require confirmation and generate a receipt.

Receipt example:

```txt
Post shared to:
- Audience Profile
- Local Neighborhood Feed

Identity bridge created:
- Audience Profile ↔ Local context

Visible to:
- Followers
- Verified nearby residents

Not visible to:
- Household
- Friends-only feed
```

### 12.6 No accidental virality

Post-level controls:

```txt
allow reshare
disable reshare
members-only no-reshare
expire after 24 hours
remove from discovery
hide from search
```

### 12.7 Identity Audit Log

Track sensitive boundary events:

```txt
profile bridge toggled
post cross-posted
membership tier changed
private follow setting changed
local verification used in targeting
paid access granted/revoked
moderator/admin action
public/private answer conversion
```

Show friendly receipts to users. Store durable audit records for safety and debugging.

---

## 13. Masked verification and trust circles

Pantopus has a unique asset: verified homes, addresses, neighborhoods, businesses, gigs, and local trust. Use that without exposing raw address data.

Never show:

```txt
This fan lives at 123 Main Street.
```

Show privacy-preserving labels:

```txt
Verified nearby
Verified in city
Verified local follower
Verified past customer
Verified event attendee
Verified household account
Verified student
Verified service buyer
Verified booked client
```

### 13.1 Trust Circles

Creators can target access based on relationship proof:

```txt
Verified locals
Past customers
Paid members
Event attendees
Friends of members
Beta testers
Students
Clients
```

Examples:

```txt
Only verified local followers can join this food drop.
Only past customers can see this discount.
Only event attendees can access this room.
Only beta testers can see roadmap notes.
Only verified parents can join this school-related group.
```

This is much stronger than generic paid tiers because access can be based on trust, locality, attendance, or past transactions, not only money.

---

## 14. Discovery model

Avoid a generic endless “For You” feed.

Pantopus discovery should be:

```txt
connection-based
local-trust-based
interest-based
service-based
event-based
verified-context-based
```

Examples:

```txt
Creators your verified local network follows
Experts near this neighborhood
Food drops from verified nearby makers
Public builders your friends support
Tutors booked by parents near you
Artists performing within 20 miles
Service providers with fan communities
```

Creator discovery settings:

```txt
Discoverable globally
Discoverable locally
Discoverable only by link
Discoverable to verified locals
Discoverable to past customers
Not discoverable
```

Paid/exclusive material should never leak into public discovery. Patreon’s current network/discovery documentation also distinguishes public discovery from paid and exclusive posts. [^patreon-network]

Pantopus should go further by making discoverability a boundary setting, not just a feed behavior.

---

## 15. AI features

The AI layer should be identity-aware and boundary-aware, not just a generic writing assistant.

### 15.1 AI Audience Chief of Staff

Help creators:

```txt
write broadcasts
split one post into multiple versions
summarize fan replies
detect top fan interests
suggest paid tier ideas
suggest event/drop opportunities
flag privacy risks
recommend who deserves a reply
draft FAQs from repeated questions
```

### 15.2 AI Broadcast Splitter

Creator writes:

```txt
Thinking about launching a workshop next month.
```

Pantopus generates:

```txt
Public post: I’m considering a workshop. Want updates?
Follower broadcast: Vote on the topic.
Member note: Members get early access to seats.
Inner Circle invite: Help me shape the agenda.
Local verified poll: Would Vancouver/Camas people prefer Saturday or Sunday?
Push notification: Workshop idea live. Vote now.
```

### 15.3 AI Fan Inbox

```txt
Summarize 412 replies.
Find top repeated questions.
Show high-value opportunities.
Flag harassment.
Suggest which questions to answer publicly.
Detect potential paid booking requests.
```

### 15.4 AI Tier Designer

Creator says:

```txt
I am a local fitness coach.
```

Pantopus suggests:

```txt
Free: weekly tips
$9/mo: member workouts
$29/mo: group Q&A
$99/mo: priority booking
```

### 15.5 AI Boundary Checker

Before posting:

```txt
This post mentions your child’s school and your neighborhood.
Keep it off your Audience Profile?
```

### 15.6 AI Community Host

For member rooms:

```txt
welcome new members
answer basic FAQs
summarize long threads
surface unanswered posts
recommend introductions
```

---

## 16. Safety, moderation, and abuse prevention

Popular people attract admiration, but also entitlement, spam, harassment, impersonation, privacy pressure, and parasocial overreach.

Build safety early.

### 16.1 Creator safety controls

```txt
blocked fans
muted fans
approval-required followers
keyword filters
DM/request limits
reporting
owner moderation queue
fan cooldowns
anti-spam rate limits
quiet hours
max messages per fan per day
paid question limits
auto-close stale threads
creator can refund/decline
```

### 16.2 Room moderation

```txt
community rules
moderator roles
escalation path
transparent enforcement log
member self-moderation tools
private moderator notes
appeal flow
```

Community moderation should be designed into the feature rather than bolted on later. Recent research and policy work repeatedly emphasizes the importance of clear guidelines, moderation tooling, and transparency for safer community systems. [^moderation-research]

### 16.3 1:1 safety

```txt
request reason required
creator acceptance required
response window shown
no off-platform contact policy
conversation expires
abuse report always available
refund/decline option
private identity shield
```

### 16.4 Impersonation and verification

Verification levels:

```txt
platform verified
business verified
local verified
professional credential verified
background checked, for certain services
licensed provider, where applicable
```

Creators choose what appears publicly:

```txt
Verified tutor
Verified local business
Verified licensed contractor
```

Do not expose:

```txt
legal name
exact address
phone number
private email
home membership
```

---

## 17. Data model recommendation

Use separate objects for social following, paid membership, and entitlements.

Current-branch note:

```txt
The current repo uses PublicPersona as the database table and AudienceProfile as the shared frontend/API type.
Do not create a second AudienceProfile table in this branch unless Pantopus deliberately migrates/renames PublicPersona.
Treat the SQL below as a target shape and migration direction for extending the existing PublicPersona-centered model.
```

### 17.1 PublicPersona / AudienceProfile

```sql
CREATE TABLE public."PublicPersona" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  handle text UNIQUE,
  handle_normalized text UNIQUE,
  display_name text NOT NULL,
  bio text,
  avatar_url text,
  banner_url text,
  public_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  category text DEFAULT 'creator', -- creator, founder, tutor, chef, local_expert, etc.
  audience_label text DEFAULT 'followers',
  audience_mode text NOT NULL DEFAULT 'open', -- open, approval_required, invite_only, organization_managed
  visibility text NOT NULL DEFAULT 'public', -- public, link_only, private, local_verified
  discoverability text NOT NULL DEFAULT 'global', -- global, local, link_only, verified_only, none
  allow_private_follow boolean NOT NULL DEFAULT true,
  allow_ask_box boolean NOT NULL DEFAULT true,
  allow_booking boolean NOT NULL DEFAULT false,
  allow_paid_features boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 17.2 PersonaFollow

Use this for free/social following, not paid membership truth.

```sql
CREATE TABLE public."PersonaFollow" (
  persona_id uuid NOT NULL REFERENCES public."PublicPersona"(id) ON DELETE CASCADE,
  follower_user_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active', -- pending, active, muted, blocked, removed
  follow_visibility text NOT NULL DEFAULT 'private', -- private, visible_to_creator, public
  notifications text NOT NULL DEFAULT 'all', -- all, important, muted
  relationship_label text, -- fan, student, client, supporter, etc.
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (persona_id, follower_user_id)
);
```

### 17.3 PersonaTier

```sql
CREATE TABLE public."PersonaTier" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES public."PublicPersona"(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  rank integer NOT NULL,
  price_amount integer,
  price_currency text DEFAULT 'USD',
  billing_interval text, -- month, year, one_time
  is_paid boolean NOT NULL DEFAULT false,
  is_limited boolean NOT NULL DEFAULT false,
  seat_limit integer,
  benefits jsonb NOT NULL DEFAULT '{}'::jsonb,
  entitlements jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 17.4 PersonaMembership

This is the paid or approved member source of truth.

```sql
CREATE TABLE public."PersonaMembership" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES public."PublicPersona"(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES public."PersonaTier"(id),
  status text NOT NULL, -- active, trialing, past_due, canceled, expired
  source text NOT NULL, -- free, stripe, comped, gifted, manual
  stripe_customer_id text,
  stripe_subscription_id text,
  started_at timestamptz,
  expires_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(persona_id, user_id)
);
```

### 17.5 PersonaEntitlement

Entitlements make access flexible.

```sql
CREATE TABLE public."PersonaEntitlement" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES public."PublicPersona"(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  entitlement_key text NOT NULL,
  source text NOT NULL, -- tier, token, comp, purchase, event, booking, admin
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(persona_id, user_id, entitlement_key, source)
);
```

Examples:

```txt
broadcast.member.read
broadcast.inner_circle.read
comment.member.write
ask.standard
ask.priority
dm.creator.request
event.vip_access
booking.discount_10
drop.early_access
local.verified_only
```

### 17.6 BroadcastChannel

```sql
CREATE TABLE public."BroadcastChannel" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES public."PublicPersona"(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  channel_type text NOT NULL DEFAULT 'broadcast', -- broadcast, room, event, course, local_chapter
  default_target_mode text NOT NULL DEFAULT 'followers',
  default_entitlement_key text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 17.7 BroadcastMessage

Evolve beyond `public | followers | subscribers`.

```sql
CREATE TABLE public."BroadcastMessage" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES public."PublicPersona"(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES public."BroadcastChannel"(id) ON DELETE SET NULL,
  author_user_id uuid NOT NULL REFERENCES public."User"(id),
  body text NOT NULL,
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_mode text NOT NULL, -- public, followers, tier, entitlement, custom_segment
  target_tier_id uuid REFERENCES public."PersonaTier"(id),
  target_entitlement_key text,
  target_segment jsonb,
  allow_replies boolean NOT NULL DEFAULT false,
  allow_reactions boolean NOT NULL DEFAULT true,
  allow_reshare boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  published_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 17.8 BroadcastReadReceipt

```sql
CREATE TABLE public."BroadcastReadReceipt" (
  message_id uuid NOT NULL REFERENCES public."BroadcastMessage"(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  first_read_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  read_count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (message_id, user_id)
);
```

### 17.9 Ask Box / Interaction Request

```sql
CREATE TABLE public."PersonaInteractionRequest" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES public."PublicPersona"(id) ON DELETE CASCADE,
  requester_user_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  request_type text NOT NULL, -- ask, paid_question, booking_request, dm_request, consult, custom
  subject text,
  body text NOT NULL,
  visibility_preference text NOT NULL DEFAULT 'private', -- private, anonymizable, public_ok
  status text NOT NULL DEFAULT 'new', -- new, accepted, answered, declined, refunded, closed
  required_entitlement_key text,
  payment_intent_id text,
  price_amount integer,
  price_currency text DEFAULT 'USD',
  response_due_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 17.10 IdentityBridgeSetting

```sql
CREATE TABLE public."IdentityBridgeSetting" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  persona_id uuid NOT NULL REFERENCES public."PublicPersona"(id) ON DELETE CASCADE,
  bridge_type text NOT NULL, -- persona_to_local, local_to_persona, persona_to_business, persona_to_marketplace
  enabled boolean NOT NULL DEFAULT false,
  visibility_scope text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id, persona_id, bridge_type)
);
```

### 17.11 IdentityAuditLog

```sql
CREATE TABLE public."IdentityAuditLog" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES public."User"(id),
  persona_id uuid REFERENCES public."PublicPersona"(id),
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  risk_level text DEFAULT 'low',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

---

## 18. Access policy model

Centralize all visibility logic. No route should invent its own audience rules.

Current-branch note: `backend/utils/identityPolicy.js` already guards posting identity-to-audience combinations, while persona read checks still appear in routes and View-As helpers. The policy below is the target direction; current `BroadcastMessage.visibility` should either be mapped into this policy or migrated deliberately to `target_mode`.

### 18.1 Policy pseudocode

```ts
type ViewerContext = {
  viewerUserId?: string;
  isOwner: boolean;
  isBlocked: boolean;
  followStatus?: 'none' | 'pending' | 'active' | 'muted' | 'blocked';
  membership?: {
    status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired';
    tierRank: number;
    tierId: string;
  };
  entitlements: Set<string>;
  safeVerificationLabels: Set<string>; // verified_local, past_customer, event_attendee
  relationshipContexts: Set<string>; // neighbor, friend, household, customer
};

function canReadPersonaMessage(message, viewer): boolean {
  if (viewer.isOwner) return true;
  if (viewer.isBlocked) return false;

  switch (message.target_mode) {
    case 'public':
      return true;

    case 'followers':
      return viewer.followStatus === 'active';

    case 'tier':
      return viewer.membership?.status === 'active'
        && viewer.membership.tierRank >= message.requiredTierRank;

    case 'entitlement':
      return viewer.entitlements.has(message.target_entitlement_key);

    case 'custom_segment':
      return evaluateSegment(message.target_segment, viewer);

    default:
      return false;
  }
}
```

### 18.2 Hard firewall invariants

These should be tested as explicit unit/integration tests:

```txt
A neighbor cannot see an Audience Profile by default.
A friend cannot see an Audience Profile by default.
A household member cannot see an Audience Profile by default.
A follower cannot see home/neighborhood identity by default.
A paid member cannot see home/neighborhood identity by default.
A booking customer cannot see exact address unless explicitly required and disclosed.
Cross-posting must create an audit receipt.
Turning on identity bridge must require explicit confirmation.
Private Follow must hide fan identity from other fans by default.
Masked verification must never expose exact address.
```

---

## 19. API surface recommendation

### 19.1 Persona profile

```txt
POST   /api/personas
GET    /api/personas/:handle
PATCH  /api/personas/:id
DELETE /api/personas/:id
GET    /api/personas/:id/view-as?viewerType=member
```

### 19.2 Follow and fan privacy

```txt
POST   /api/personas/:id/follow
DELETE /api/personas/:id/follow
PATCH  /api/personas/:id/follow-settings
GET    /api/personas/:id/follow-status
GET    /api/personas/:id/followers
PATCH  /api/personas/:id/followers/:userId/status
```

### 19.3 Tiers and memberships

```txt
POST   /api/personas/:id/tiers
PATCH  /api/personas/:id/tiers/:tierId
DELETE /api/personas/:id/tiers/:tierId
POST   /api/personas/:id/memberships/checkout
GET    /api/personas/:id/memberships/me
PATCH  /api/personas/:id/memberships/me
GET    /api/personas/:id/memberships
```

### 19.4 Broadcasts

```txt
POST   /api/personas/:id/broadcasts
GET    /api/personas/:id/broadcasts
GET    /api/personas/:id/broadcasts/:messageId
POST   /api/personas/:id/broadcasts/:messageId/read
POST   /api/personas/:id/broadcasts/:messageId/react
POST   /api/personas/:id/broadcasts/:messageId/reply
```

### 19.5 Ask Box and 1:1

```txt
POST   /api/personas/:id/requests
GET    /api/personas/:id/requests
PATCH  /api/personas/:id/requests/:requestId
POST   /api/personas/:id/requests/:requestId/answer
POST   /api/personas/:id/requests/:requestId/convert-to-public
POST   /api/personas/:id/requests/:requestId/refund
```

### 19.6 Drops and bookings

```txt
POST   /api/personas/:id/drops
GET    /api/personas/:id/drops
POST   /api/personas/:id/drops/:dropId/claim
POST   /api/personas/:id/bookings/request
GET    /api/personas/:id/bookings
PATCH  /api/personas/:id/bookings/:bookingId
```

### 19.7 Identity bridge and audit

```txt
GET    /api/personas/:id/identity-bridges
PATCH  /api/personas/:id/identity-bridges/:bridgeType
GET    /api/personas/:id/audit-log
POST   /api/personas/:id/cross-post-preview
POST   /api/personas/:id/cross-post
```

---

## 20. Product templates by profile type

### Founder / public builder

Default modules:

```txt
roadmap notes
beta group
feedback prompts
product drops
office hours
investor/partner inquiry
```

Suggested rings:

```txt
Free: product updates
Member: behind-the-scenes roadmap
Inner Circle: private founder notes and feedback council
1:1: advisory call or beta interview
```

### Tutor / coach

Default modules:

```txt
classes
student resources
Q&A
booking
homework drops
parent-safe communication
```

Suggested rings:

```txt
Free: study tips
Member: weekly worksheets and group Q&A
Premium: priority booking
1:1: private tutoring slot
```

### Food maker

Default modules:

```txt
weekly menu
pickup drops
local verified customers
preorder
allergy notes
legal/compliance notices
```

Suggested rings:

```txt
Free: weekly menu announcements
Member: early access to food drops
VIP: reserved pickup windows and custom requests
```

### Musician / artist

Default modules:

```txt
show dates
early tickets
demos
fan room
merch
local chapters
```

Suggested rings:

```txt
Free: show announcements
Member: demos and behind-the-scenes
VIP: early tickets and listening room
```

### Local expert / service provider

Default modules:

```txt
ask box
consult booking
neighborhood-safe posts
verified local audience
service packages
```

Suggested rings:

```txt
Free: local tips
Member: Q&A and private posts
Inner Circle: office hours
1:1: paid consult or service request
```

---

## 21. MVP roadmap

### Phase 0: Privacy and codebase cleanup

Before shipping Audience Profiles:

```txt
Audit public profile routes for private field leakage.
Centralize visibility checks in one policy utility.
Add tests for identity firewall rules.
Confirm current branch inventory for persona/broadcast primitives.
Create design-system components for visibility capsules and view-as preview.
```

### Phase 1: Free Audience Profile with strong firewall

Build:

```txt
Create/edit Audience Profile
Follow/unfollow
Private Follow
Approval-required mode
Basic broadcasts
Follower-only broadcasts
Follower manager
Notification preferences
View-As Firewall Preview
Identity Bridge Settings
Identity audit receipts
```

Goal:

```txt
Prove users understand profile separation and feel safe posting.
```

### Phase 2: Structured interaction

Build:

```txt
Prompts
Ask Box
Creator reply privately/publicly
Fan reactions
Simple member room without payment
Moderation tools
Bandwidth Meter v1
AI fan reply summary v1
```

Goal:

```txt
Prove creators can interact with fans without drowning.
```

### Phase 3: Paid membership

Build:

```txt
PersonaTier
PersonaMembership
PersonaEntitlement
Payment onboarding
Paid member tier
Member-only broadcasts/posts
Paid Ask Box priority
Creator revenue dashboard
Refund/decline flows
```

Goal:

```txt
Prove fans will pay for structured access and creators can earn safely.
```

### Phase 4: Pantopus-native wedge

Build:

```txt
Drops
Book Me / Hire Me
Local verified follower groups
Event rooms
Limited 1:1 access
Office Hours
Creator services connected to Exchange/Gigs
Masked verification segments
```

Goal:

```txt
Turn audience into real-world commerce and trusted local/global action.
```

### Phase 5: Scale and network effects

Build:

```txt
AI Audience Chief of Staff
Local chapters
Creator collectives
Fan passports
Access tokens
Advanced discovery
Custom domains/QR cards
Email export with consent
CRM-style audience insights
```

Goal:

```txt
Become the public relationship layer of Pantopus.
```

---

## 22. R&D experiments

### Experiment 1: View-As Prototype

Prototype screens where a creator views their profile as:

```txt
public
follower
member
neighbor
friend
household
```

Success metrics:

```txt
Users correctly explain who sees what.
Users feel safer posting.
Users identify fewer privacy surprises.
```

### Experiment 2: Choose Your Closeness

Compare standard actions:

```txt
Follow / Subscribe
```

against:

```txt
Follow quietly / Ask / Book / Join Circle / Support
```

Success metrics:

```txt
Higher intent
Better comprehension
More users find the action they want
Lower hesitation around payment
```

### Experiment 3: Ask Box vs Open DM

Compare structured Ask Box with normal chat.

Success metrics:

```txt
Creators feel less overwhelmed.
Fans understand response expectations.
More questions become useful public answers.
Lower harassment/report rate.
```

### Experiment 4: Masked Local Verification

Test labels like:

```txt
Verified nearby
Verified local
Past customer
Event attendee
```

without exposing addresses.

Success metrics:

```txt
Fans trust the profile more.
Creators are comfortable using local-only access.
Users do not think exact address is exposed.
```

### Experiment 5: Drops + Booking

Prototype:

```txt
local food maker
photographer
tutor
fitness coach
founder beta group
```

Success metrics:

```txt
Fans understand how to buy/book.
Creators see monetization beyond subscription.
Repeat use feels natural.
```

---

## 23. Metrics

### Activation

```txt
Audience Profiles created
Profiles published
% completing Relationship Builder
% configuring at least one ring
% using View-As before first post
```

### Engagement

```txt
Followers per profile
Broadcast open/read rate
Ask Box submissions
Prompt responses
Private follow rate
Member-room participation
```

### Monetization

```txt
Paid member conversion
MRR per profile
Paid question volume
Booking/drop revenue
Refund rate
Churn rate
Upgrade rate
Creator payout volume
Pantopus take-rate revenue
```

### Safety and trust

```txt
Identity bridge warnings accepted/declined
Cross-post undo rate
Boundary Score warnings
Reports per 1,000 interactions
Blocked/muted users
Creator overwhelm score
Fan privacy setting usage
```

### Creator sustainability

```txt
Unanswered questions
Average reply time
AI summaries used
Quiet hours enabled
Access token depletion
Bandwidth Meter warnings
```

### Network effects

```txt
Profiles discovered through local verification
Followers from QR/profile cards
Drops claimed by verified locals
Bookings from audience profiles
Creator collectives created
Cross-profile recommendations
```

---

## 24. Acceptance criteria

### Privacy/firewall acceptance

```txt
A neighbor cannot discover a private Audience Profile without explicit bridge/discovery settings.
A follower cannot see home identity by default.
A paid member cannot see private contact info by default.
A fan can follow privately.
A creator can preview their profile as follower/member/neighbor/friend/household.
Cross-posting to local feed requires explicit confirmation.
All bridge/cross-post actions create audit receipts.
```

### Monetization acceptance

```txt
Creator can create a paid tier after payment onboarding.
Fan can join a paid tier and immediately receive entitlements.
Member-only broadcast is visible only to entitled users.
Payment failure revokes paid entitlements or marks them past_due.
Creator can see MRR and paid member count.
Creator can refund or decline paid 1:1 requests.
```

### Interaction acceptance

```txt
Creator can publish broadcast to public/followers/members.
Fans can submit Ask Box questions according to access rules.
Creator can answer privately or anonymize/publish publicly.
Creator can limit replies and Ask Box volume.
Moderation actions are available for follower, member, room, and request contexts.
```

### Developer acceptance

```txt
All access checks flow through a central policy utility.
Routes do not hand-roll visibility rules.
Unit tests cover all target modes.
Integration tests cover owner/follower/member/neighbor/friend/household permutations.
Payment webhooks update PersonaMembership and PersonaEntitlement.
Read receipts prevent inflated broadcast read counts.
```

---

## 25. Risk register

| Risk | Severity | Mitigation |
|---|---:|---|
| Identity leakage across local/home/audience contexts | Critical | Central policy, View-As, bridge receipts, audit log, tests |
| Creator overwhelm | High | Bandwidth Meter, Ask quotas, paid priority, AI summary, quiet hours |
| Fans expect unlimited access after paying | High | Relationship Contracts, tokens, explicit response windows |
| Monetization fraud/scams | High | Payment onboarding, verification tiers, risk scoring, dispute tooling |
| Harassment/parasocial abuse | High | Blocks, limits, moderation queue, safety mode, reporting |
| Complex setup reduces adoption | Medium | Relationship Builder with safe defaults and templates |
| Generic creator-platform positioning | Medium | Lead with identity-safe access, local trust, bookings, drops |
| Overbuilding chat | Medium | Start with broadcasts, Ask Box, prompts, rooms later |
| Regulatory/compliance issues for services | Medium/High | Category restrictions, reviews, legal/compliance workflows |
| Exact address exposure via local verification | Critical | Masked labels only; never expose raw address to creator/fans by default |

---

## 26. Open product decisions

```txt
Should the user-facing name be Audience Profile, Public Profile, Pantopus Channel, or Creator Circle?
Should private follow be default for all fans?
Should paid members be visible to creators by default, or can fans fully anonymize support?
Should top-tier access be subscription-based, token-based, or request-based by default?
Should discovery use global popularity, local trust, or opt-in creator categories first?
Should drops live inside Audience Profiles or reuse marketplace primitives?
Should 1:1 access use chat, booking, paid answer, or all three as separate products?
What profile types need regulatory/compliance review before monetization?
```

My recommendation:

```txt
Use Audience Profile publicly at first.
Use Relationship Rings internally and in setup.
Use Private Follow as an explicit option, default private for sensitive contexts.
Use Ask Tokens and request-based 1:1 by default.
Use local trust discovery only when creator opts in.
Reuse marketplace/gig primitives for drops/bookings when possible.
```

---

## 27. Next implementation slice

The best next engineering slice should harden the identity-safe relationship loop that already exists:

```txt
1. Preserve the current naming contract: PublicPersona in the database, Audience Profile in product copy, AudienceProfile in shared API/types.
2. Add a central canViewPersonaContent / canViewPersonaMessage policy and route persona posts, broadcasts, View-As, and discovery through it.
3. Keep canPostWithIdentityToAudience for composer/posting guards, but connect it to the same policy vocabulary.
4. Add durable per-user BroadcastReadReceipt or equivalent idempotent read accounting before treating read_count as reliable analytics.
5. Decide whether to keep BroadcastMessage.visibility for MVP or migrate toward target_mode before adding tiers and entitlements.
6. Reconcile persona discovery fields: is_searchable, future search_visibility, link-only, verified-only, and local opt-in discovery.
7. Expand integration tests across owner/follower/subscriber/pending/blocked/neighbor/friend/household viewers for posts, broadcasts, View-As, and search.
8. Keep Ask, Book, Join, paid tier, and 1:1 controls as explicit unavailable placeholders until their backend objects exist.
9. Add Ask Box only after access policy, moderation state, quotas, and audit receipts are centralized.
10. Add PersonaTier, PersonaMembership, and PersonaEntitlement only after the free persona/follow/broadcast privacy contract is stable.
```

Do not start with the huge paid/tier universe. Start with identity-safe follow and broadcast, then layer monetization.

---

## 28. Final recommendation

Build Audience Profiles as:

```txt
Audience Profiles
+ Relationship Rings
+ Choose Your Closeness
+ View-As Firewall Preview
+ Private Follow
+ Masked Local Verification
+ Ask Box
+ Paid Memberships
+ Access Tokens
+ Drops + Booking
+ AI Boundary Checker
+ Creator Bandwidth Meter
```

This is not just a content feature. It is a Pantopus-native system for turning public identity into safe relationships, real-world services, and monetized access.

The center of gravity should be:

> **controlled access to a public person.**

That makes the product useful for famous creators, but also for the more interesting Pantopus middle class:

```txt
a tutor with 40 students
a chef with 80 local customers
a founder with 200 beta users
a musician with 500 local fans
a coach with 25 serious clients
a neighborhood expert with 60 subscribers
a photographer with seasonal demand
a public builder who wants feedback without exposing private life
```

That is the moat. Popularity does not have to mean exposure. Closeness does not have to mean chaos. Paid access does not have to mean vague promises. Pantopus can make public relationships safer, more useful, and more human.

---

## 29. Research and source notes

This document synthesizes the uploaded brainstorm/pasted notes, Pantopus product context, current repo inspection, and the sources below.

[^goldman]: Goldman Sachs, “The creator economy could approach half-a-trillion dollars by 2027.” https://www.goldmansachs.com/insights/articles/the-creator-economy-could-approach-half-a-trillion-dollars-by-2027
[^patreon-fee]: Patreon Help Center, “A standard platform fee for new creators.” https://support.patreon.com/hc/en-us/articles/36426991446797-A-standard-platform-fee-for-new-creators-effective-after-August-4-2025
[^patreon-tiers]: Patreon Help Center, “How to set up paid tiers and benefits.” https://support.patreon.com/hc/en-us/articles/203913559-How-to-set-up-paid-tiers-and-benefits
[^patreon-post-access]: Patreon Help Center, “Setting post access for your Patreon audience.” https://support.patreon.com/hc/en-us/articles/37807653033997-Setting-post-access-for-your-Patreon-audience
[^patreon-network]: Patreon Help Center, “How Patreon’s network works for members.” https://support.patreon.com/hc/en-us/articles/45256719857293-How-Patreon-s-network-works-for-members
[^youtube-memberships]: YouTube Help, “Create or manage your YouTube channel’s memberships.” https://support.google.com/youtube/answer/7544492?hl=en
[^instagram-broadcast]: Instagram Creators, “Get closer to your fans with replies, prompts, and insights.” https://creators.instagram.com/blog/instagram-broadcast-channels-replies-prompts-insights
[^substack-chat]: Substack, “A guide to Substack Chat.” https://on.substack.com/p/chat-guide
[^circle]: Circle, “The complete community platform.” https://circle.so/
[^passes]: PR Newswire, “Passes Rebrands as the Creator Accelerator Platform.” https://www.prnewswire.com/news-releases/passes-rebrands-as-the-creator-accelerator-platform-302749690.html
[^context-collapse]: Jenny L. Davis and Nathan Jurgenson, “Context collapse: theorizing context collusions and collisions.” https://fws.commacafe.org/resources/Context-collapse-theorizing-context-collusions-and-collisions.pdf
[^nng-status]: Nielsen Norman Group, “Visibility of System Status.” https://www.nngroup.com/articles/visibility-system-status/
[^nng-control]: Nielsen Norman Group, “User Control and Freedom.” https://www.nngroup.com/articles/user-control-and-freedom/
[^nng-cognitive-load]: Nielsen Norman Group, “4 Principles to Reduce Cognitive Load in Forms.” https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/
[^moderation-research]: Gomes, A. B. et al., “Problematizing content moderation by social media platforms.” https://pmc.ncbi.nlm.nih.gov/articles/PMC11549828/
