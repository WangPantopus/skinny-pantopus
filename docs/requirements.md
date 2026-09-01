# 🧠 Pantopus Relationship & Identity System – Final Strategic Summary

Pantopus is not a feed app.

It is a **multi-graph coordination OS** anchored to real-world addresses.

You are building **three overlapping graphs**:

1. 🏠 Residency Graph (authority)
2. 🤝 Trust Graph (connections)
3. 📡 Distribution Graph (follows)

Everything we implement must reinforce these.

---

# 1️⃣ Core Entities (No New Phantom Types)

You have exactly 3 first-class entities:

### 👤 User

Base identity.
Verified human.
Can:

* Attach to homes
* Enable professional mode
* Own businesses
* Follow/connect

---

### 🏠 Home

Persistent digital address.
Can:

* Have members
* Have roles (owner, resident, guest)
* Have private & public layers
* Route mailbox

---

### 🏢 Business

Registered organization.
Can:

* Be followed
* Post publicly
* Receive orders
* Run ads
* Appear on map

---

### 🔧 Professional (NOT a new entity)

Professional = User mode.

Implemented as:
`UserProfessionalProfile`

If exists → user is a professional.
If visibility = public → followable.
If verified → boosted.

No separate account.

One identity.
Multiple roles.

---

# 2️⃣ Relationship System (Final Model)

## Graph 1: Residency Graph (Authority Layer)

Table: `HomeMembership`

Purpose:

* Who lives where
* Who sees private home data
* Mail routing
* Role-based permissions

Rules:

* Required for mailbox access
* Required for private home posts
* Auto-follow HOA optional

This graph is Pantopus’ moat.

---

## Graph 2: Trust Graph (Connect – Mutual)

Table: `UserConnection`

Used for:

* Private messaging
* High-trust gigs
* Sharing private posts
* Subscription groups
* Personal relationship layer

Properties:

* Request → Accept
* Can block
* Slower growth
* Higher signal

Connection = identity-level trust.

---

## Graph 3: Distribution Graph (Follow – Asymmetric)

Table: `UserFollow`

Used for:

* Following professionals
* Following businesses
* Public post visibility
* Gig discovery
* Feed ranking

Fast growth.
Low friction.
Scoped visibility.

Follow ≠ access to private content.

---

# 3️⃣ Visibility Rules (Critical)

Follow grants:

* Public professional posts
* Public business posts
* Public gig listings

Connect grants:

* Personal posts (based on privacy settings)
* Direct messaging
* High-trust gig access
* Deeper profile access

Home membership grants:

* Private home content
* Mailbox access
* Household coordination

Never mix these scopes.

---

# 4️⃣ Professional Mode Strategy

## Creation

Free.
Low friction.

## Verification Tiers

### Tier 0 – Unverified

* Appears on map
* Followable
* Basic ranking

### Tier 1 – Verified Identity

* Badge
* Ranking boost
* Eligible for premium gigs

### Tier 2 – Licensed/Insured (Future)

* Higher trust gigs
* Higher ranking multiplier
* Can access special categories

Verification becomes monetization lever.

---

# 5️⃣ Ranking & Map Strategy

Ranking formula:

Score =

* Distance
* Rating
* Completion rate
* Verification level
* Recency
* Paid boost multiplier

Paid boost cannot override trust completely.

Trust always dominates long-term.

---

# 6️⃣ Monetization Structure

### A. Mailbox Ads

Address-targeted.
Stable revenue.

### B. Gig Commission

10–20%.

### C. Professional Boosts

* Top of search
* Map highlight
* Feed boost

High-margin revenue.

### D. Verification Fees

Background checks.
Pro tier subscriptions.

### E. Business Ads

Sponsored placements.

---

# 7️⃣ Onboarding Strategy

This is extremely important.

Pantopus onboarding must not feel like Instagram.
It must feel like activating infrastructure.

---

## 👤 User Onboarding

1. Create account
2. Verify phone/email
3. Add address
4. Attach to home (if exists)
5. Choose intent:

* I want to hire
* I want to offer services
* I run a business
* I just want to connect

Based on choice → UI prioritization changes.

Optional:

* Enable professional mode
* Suggested local follows
* Suggested connects

No forced follows.

---

## 🏠 Home Onboarding

If home exists:

* Request to join
* Landlord/owner approves

If new home:

* Create digital home
* Set privacy
* Invite members

Roles defined early.

---

## 🏢 Business Onboarding

1. Create business
2. Verify ownership
3. Add location
4. Set business type
5. Choose:

* Services
* Products
* Both

Optional:

* Ad tools
* Delivery integration
* Map boost

---

# 8️⃣ UX Philosophy

Pantopus should feel:

Calm.
Structured.
Utility-first.
Not addictive chaos.

Primary tabs:

* Map
* Mailbox
* Gigs
* Home
* Profile

Feed is secondary.

---

# 9️⃣ Anti-Drift Rules

To prevent becoming “Instagram with a map”:

* De-emphasize follower count visually
* No endless algorithmic scroll
* No engagement farming incentives
* Professional posts clearly marked

Pantopus is coordination, not entertainment.

---

# 1️⃣0️⃣ What We Now Need to Design Next

Based on this summary, next design phase should include:

1. Professional onboarding UX
2. Verification workflow
3. Connection request flow
4. Follow flow behavior
5. Visibility matrix (who sees what)
6. Map ranking logic implementation
7. Database schema updates
8. Monetization triggers
9. Notification strategy
10. First 90-day growth loop

---

# Final Strategic Snapshot

Pantopus =

One Identity

* Residency Graph
* Trust Graph
* Distribution Graph
* Professional Mode
* Map-first Discovery
* Mailbox Authority

That is coherent.
That is scalable.
That is differentiated.

Small "Pressure Tests" to Consider
While the blueprint is 9/10, here are three spots where the "real world" might get messy:

1. The "Join Home" Friction

The Risk: If a user has to wait for a "Landlord/Owner" to approve them to see their Mailbox, they might bounce before seeing the app's value.

Refinement: Consider a "Provisional Residency" status. Let them see the public neighborhood feed and local gigs immediately upon entering an address, but lock the "Digital Mailbox" and "House Maintenance Log" until verification is complete.

2. The "Professional" Privacy Leak

The Risk: If I turn on "Professional Mode" to walk dogs, does my "Residency Graph" (where I live) become visible to my "Followers"?

Refinement: Ensure your Visibility Matrix explicitly separates the User's home address from their Professional service area. A "Follower" should see that you serve Camas, WA, but only a "Connection" (or someone who hired you) should see your specific unit number.

3. The Verification Tiers vs. Onboarding

The Risk: If Tier 1 (Verified Identity) is too hard, your "Task Marketplace" will be empty.

Refinement: Use "Incentivized Verification." Don't make them do it at onboarding. Let them post a gig for free, but show them a "Trust Score" tooltip that says: "Verified pros get 4x more clicks. Verify now?"


Schema Sync: Cross-map to schema.sql – e.g., repurpose UserPlace for Home (kinds: 'rv' for nomads), Relationship for Trust Graph. If adding HomeMembership, define it as a view/join on UserPlace. Quick win: Use your can_proxy_post function for delegation checks. However, if Home already exists as a first-class entity, and UserPlace is a user-saved location record:
* Home = canonical address object (shared, attach/detach, mailbox)
* UserPlace = personal places (favorite spots, work locations, travel stays, temporary)
Do not replace Home with UserPlace.
Global Scaling: Emphasize Pillar 6 cross-border (e.g., currency conversion in gigs, multi-lang verification).
AI Tie-Ins: Weave Pillar 9 throughout – e.g., AI-ranked follows, auto-verification suggestions, gig matching agents.
Edge Cases: Add sections for nomads/unhoused users (Pillar 1 flexibility) and fraud prevention (e.g., via StripeAccount in schema).
Metrics Alignment: Define success KPIs per graph (e.g., Residency: attachment rate; Trust: connection density; Distribution: follow-to-gig conversion).