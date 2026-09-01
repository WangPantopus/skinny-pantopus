# Pantopus Identity Firewall UI/UX Redesign Spec

Last updated: 2026-05-06
Status: Implementation-ready UX redesign direction
Audience: Product, design, frontend, mobile, backend, QA
Related docs:

- `docs/pantopus-identity-firewall-engineering-design-2026-05-04.md`
- `docs/identity-firewall-migration-smoke-runbook-2026-05-05.md`

## 1. Executive Summary

The Identity Firewall feature gives Pantopus a strong product foundation:

```text
One private verified account
  -> Local profile for neighborhood life
  -> Public audience profile for followers, clients, students, customers, or members
  -> Home identity for household authority
  -> Business identity for work
```

The current branch implements much of the capability, but the user experience exposes too much implementation language and too many separate destinations. Users currently encounter "Identity Center", "Audience Profile", "Broadcast", "Bridges", "View As Preview", "Audience Members", "persona", profile switchers, feed surfaces, and composer identity chips as separate concepts.

The redesign goal is not cosmetic polish. The goal is to make the entire identity system feel simple, trustworthy, and obvious:

> Pantopus knows who I am. Other people only see the version of me I choose for this context.

This document defines a complete UI/UX redesign for the feature across web and mobile. It covers naming, navigation, screen structure, user flows, component behavior, copy, accessibility, analytics, QA, rollout sequencing, and implementation targets.

## 2. Product Experience Goals

### 2.1 Primary Goals

1. Make identity privacy understandable in under 10 seconds.
2. Help users create and manage public-facing profiles without learning internal system terms.
3. Make it clear what each audience can see before the user shares, posts, follows, or links profiles.
4. Keep power features available without making first-time users feel they are configuring an admin console.
5. Unify web and mobile around the same mental model, labels, and interaction order.
6. Reduce navigation duplication and make every feature reachable from one coherent place.
7. Make posting identity and post visibility explicit at the moment of creation.
8. Make public profile pages beautiful, focused, and visitor-first.

### 2.2 What Success Looks Like

A new user should be able to answer:

- "What is private?"
- "What do neighbors see?"
- "What do followers see?"
- "Can followers find my local profile?"
- "Who will see this post?"
- "Am I posting as myself, my home, my business, or my public profile?"
- "How do I send an update to my followers?"

without reading help docs or understanding backend terms.

## 3. Current UX Problems

### 3.1 Concept Overload

The branch exposes many concepts at the same priority level:

- Identity Center
- Private Account
- Local Profile
- Audience Profile
- Homes
- Business Profiles
- Bridges
- View As Preview
- Broadcast
- Audience Members
- Persona
- Followers, connections, neighbors, household members, gig participants

Many of these are valid system concepts, but not all should be visible as primary user-facing labels.

### 3.2 Duplicated Navigation

The same feature appears as multiple separate entries:

- Web settings exposes Identity Center, Audience Profile, and Broadcast.
- Web sidebar exposes Identity.
- Mobile hamburger menu exposes Identity Center, Audience Profile, and Broadcast.
- Mobile profile switcher exposes Audience Profile separately from other profile settings.

This makes the feature feel bolted on and creates uncertainty about where to manage something.

### 3.3 Internal Language

The strongest examples:

- "Bridges" should be "Profile links".
- "Broadcast" should be "Updates" or "Announcements".
- "Audience Profile" should become "Public Profile" or "Follower Profile" in most user-facing UI.
- "View As Preview" should become "Privacy Preview".
- "Audience Members" should become "Followers" unless the selected audience label is intentionally different.

### 3.4 Too Much Configuration At Once

The current Audience Profile editor combines:

- Identity naming
- Category policy
- Sensitive category gates
- Audience label
- Audience approval mode
- Media
- Bio
- Public links
- Copy link
- View profile
- Broadcast
- Follower management

This should be split into a guided setup and task-based tabs.

### 3.5 Privacy Preview Is Treated As Advanced

Privacy preview is central to the product promise, but on web most non-public viewer presets are hidden behind "Advanced Privacy Preview". The feature should feel like a core safety tool, not an advanced diagnostic.

### 3.6 Public Pages Still Feel Like App Management Screens

Public local and public persona pages should prioritize the visitor experience. Owner-only app-management actions should appear only for owners and should not dominate the public page.

### 3.7 Composer Identity Selection Is Noisy

The composer currently exposes identity chips and audience chips directly. The user needs a simpler summary:

```text
Posting as Maya Builds
Visible to Followers
Change
```

The detailed selection can live in a focused picker.

## 4. User-Facing Terminology

### 4.1 Naming Decisions

Use these terms in UI:

| Current term | New user-facing term | Notes |
| --- | --- | --- |
| Identity Center | Profiles & Privacy | One destination for all profile/privacy management. |
| Audience Profile | Public Profile | Use "Follower Profile" only if product wants a narrower social meaning. |
| Persona | Public profile | Avoid "persona" in UI except internal code/docs. |
| Broadcast | Updates | "Announcement" is acceptable for one-off send action. |
| Broadcast message | Update | Example: "Post update". |
| Bridges | Profile links | Use plain copy: "Link these profiles". |
| View As Preview | Privacy Preview | Core feature, not advanced. |
| Audience Members | Followers / Members / Clients | Use the user's selected audience label when possible. |
| Private Account | Private account | Keep this. It is understandable. |
| Local Profile | Local Profile | Keep this. It maps to nearby/community context. |
| Business Profiles | Business Profiles | Keep this. |
| Home identities | Homes | Keep this simple. |

### 4.2 Terms To Avoid In Product UI

Avoid:

- Persona
- Identity Firewall
- Bridge
- Surface
- Context type
- Identity context
- Broadcast channel
- Public persona
- Backend preview
- Raw user

These terms can remain in code, API names, engineering docs, and admin-only tooling.

### 4.3 Core Copy

Product promise:

```text
Choose what people see about you in each part of Pantopus.
```

Private account explanation:

```text
Your private account is used for sign-in, verification, payments, and safety. Other people do not see these details unless you choose to share them.
```

Local profile explanation:

```text
Your Local Profile is how neighbors, gigs, marketplace, and nearby posts recognize you.
```

Public profile explanation:

```text
Your Public Profile is for followers, clients, students, customers, members, or anyone you address one-to-many.
```

Profile links explanation:

```text
Profile links are off by default. Turn them on only if you want people from one profile to discover the other.
```

Privacy preview explanation:

```text
Preview exactly what different people can see before you share or link a profile.
```

Updates explanation:

```text
Post one-way updates from your Public Profile. Followers cannot reply by default.
```

## 5. Target Information Architecture

### 5.1 One Primary Destination

Create one primary destination:

```text
Profiles & Privacy
```

Recommended route:

```text
/app/profiles
```

If route churn is too expensive, keep the current route:

```text
/app/identity
```

but change the visible title and all nav labels to "Profiles & Privacy". Add redirects later if desired.

### 5.2 Web Navigation

Desktop sidebar:

```text
Bottom utility area:
  Profiles & Privacy
  Settings
```

Settings:

```text
Settings
  Account
  Notifications
  Privacy
  Payments
```

Settings should not expose separate "Audience Profile" and "Broadcast" rows. Instead, the Settings privacy section can link to `Profiles & Privacy` once.

### 5.3 Mobile Navigation

Hamburger menu:

```text
Manage
  Profiles & Privacy
  My Homes
  My Businesses
  Connections
  Mailbox
```

Do not list "Audience Profile" and "Broadcast" as separate primary menu items.

Profile switcher:

```text
Switch profile
  Personal
  Public Profile
  Professional
  Homes
  Businesses
```

The switcher can keep a shortcut to the public profile because it is about acting/viewing as a profile. But management should route into the relevant tab inside Profiles & Privacy when the user taps an edit/settings affordance.

### 5.4 Profiles & Privacy Tabs

Use the same conceptual tabs on web and mobile:

```text
Overview
Public Profile
Profile Links
Privacy Preview
Followers
Updates
```

Rules:

- If the user has no Public Profile, show only Overview and Public Profile setup.
- Followers and Updates are disabled or hidden until the Public Profile exists.
- Profile Links can exist before setup, but link controls are disabled until both related profiles exist.
- Privacy Preview should always be visible if at least one public-facing profile exists.

### 5.5 Public Routes

Keep public routes:

```text
/local/:localHandle
/@:personaHandle
/persona/:personaHandle on mobile
```

But in UI copy, refer to:

- Local Profile
- Public Profile

not persona.

## 6. Core User Jobs

### 6.1 Job 1: Understand My Profiles

User question:

```text
What parts of me does Pantopus show to other people?
```

The Overview screen must answer this with:

- Private account: private, verified, hidden from others.
- Local Profile: used nearby.
- Public Profile: used for followers.
- Home/business identities: used when acting for those contexts.
- One privacy preview CTA.

### 6.2 Job 2: Create A Public Profile

User question:

```text
How do I make a profile for followers or clients without exposing my local identity?
```

The Public Profile setup must:

- Explain separation.
- Ask only essential first-run fields.
- Preview the profile before publishing.
- Confirm profile links are off by default.

### 6.3 Job 3: Check What Someone Can See

User question:

```text
What will a follower, neighbor, or public visitor see?
```

Privacy Preview must be prominent and fast:

- Choose profile.
- Choose viewer type.
- See visible and hidden sections.
- See sample posts/updates if available.
- Receive warnings if a profile link is enabled.

### 6.4 Job 4: Link Or Separate Profiles

User question:

```text
Can my followers discover my local profile? Can neighbors discover my public profile?
```

Profile Links must:

- Show both directions separately.
- Explain the consequence of each direction.
- Require confirmation before enabling.
- Offer "Preview after linking".

### 6.5 Job 5: Post As The Right Identity

User question:

```text
Who am I posting as, and who can see it?
```

Composer must:

- Always show `Posting as`.
- Always show `Visible to`.
- Hide invalid post types for that identity.
- Ask for location only when required.
- Use one focused picker for changes.

### 6.6 Job 6: Send Updates To Followers

User question:

```text
How do I send a one-way update to followers?
```

Updates must:

- Live inside Public Profile management.
- Show recipient scope before publishing.
- Show public vs followers-only clearly.
- Show delivery/read metrics after publishing.
- Avoid implying two-way chat.

### 6.7 Job 7: Manage Followers

User question:

```text
Who can see follower-only content and updates?
```

Followers management must:

- Prioritize pending approvals.
- Keep active follower management simple.
- Confirm destructive actions.
- Use labels matching the selected audience label.

## 7. Screen Specifications

## 7.1 Profiles & Privacy - Overview

### Purpose

Give users a calm, high-level map of their profiles and the main privacy controls.

### Web Layout

```text
Page title: Profiles & Privacy
Subtitle: Choose what people see about you in each part of Pantopus.

Top status band:
  Private account verified
  Public Profile setup status
  Profile links status

Main content:
  Left column:
    What people see
      Local Profile card
      Public Profile card
      Home identities card
      Business identities card

  Right column:
    Privacy Preview card
    Profile Links summary
    Recommended next step
```

### Mobile Layout

```text
Header: Profiles & Privacy
Status summary
What people see
Privacy Preview CTA
Profile Links summary
Manage sections
```

### Required Components

Profile cards should show:

- Profile type.
- Display name or setup status.
- Handle if available.
- Primary action.
- Secondary action.
- Privacy summary line.

Example Local Profile card:

```text
Local Profile
Maya Local
@riverhome
Used for nearby posts, gigs, marketplace, and neighbors.

[View] [Edit]
```

Example Public Profile card:

```text
Public Profile
Maya Builds
@mayabuilds
1 follower
Used for followers, clients, students, customers, or members.

[Manage] [View]
```

### Empty States

No Public Profile:

```text
Create a Public Profile
Use it for followers, clients, students, customers, or members without exposing your local profile.

[Set up Public Profile]
```

No Local Profile:

```text
Your Local Profile is not ready yet.
Finish your local profile so neighbors and local activity can recognize you.

[Finish Local Profile]
```

### Behavior

- The page should not show every possible action at once.
- Overview should show one recommended next step.
- If a privacy risk exists, surface it in plain language:

```text
Your Public Profile links to your Local Profile.
Followers can discover your local profile.
```

## 7.2 Public Profile Setup And Editor

### Purpose

Let users create and maintain the profile used for followers, clients, students, customers, or members.

### First-Time Setup Flow

Use a stepper:

```text
Step 1: Basics
Step 2: Audience
Step 3: Preview
```

### Step 1: Basics

Fields:

- Display name
- Handle
- Avatar
- Banner
- Bio
- Public links

Do not show sensitive-category policy in the first visible screen unless the user chooses a professional/sensitive category path.

Recommended copy:

```text
This profile is separate from your Local Profile unless you link them.
```

Validation:

- Handle required.
- Display name required.
- Handle availability check if backend supports it.
- Public links require label and URL.
- URL normalizes to `https://`.

### Step 2: Audience

Fields:

- Audience label:
  - Followers
  - Members
  - Students
  - Clients
  - Customers
  - Subscribers
- Follow mode:
  - Anyone can follow
  - I approve new followers
- Optional category:
  - Creator
  - Writer
  - Coach
  - Consultant
  - Community leader
  - Public figure
  - Other

Sensitive category behavior:

- Do not show a large list of gated sensitive categories by default.
- Show a link:

```text
Need a healthcare, legal, classroom, or minor-facing profile?
```

- Tapping opens an informational panel:

```text
These categories require extra verification before they can be used.
```

### Step 3: Preview

Show a realistic public profile preview:

- Banner
- Avatar
- Name
- Handle
- Bio
- Links
- Follow button preview
- Profile link status

Confirmation text:

```text
Your Public Profile will not link to your Local Profile unless you turn that on later.
```

Primary CTA:

```text
Publish Public Profile
```

Secondary CTA:

```text
Back
```

### Existing Profile Editor

After setup, use tabs or sections:

```text
Public Profile
  Profile details
  Audience settings
  Preview
```

Do not show follower management in the same long form. Move it to the Followers tab.

### Save Behavior

After save:

- Show inline success.
- Keep the user on the same screen.
- Offer `View Public Profile`.
- Do not show repeated duplicate "View Public Profile" actions in header, body, status banner, and bottom area.

## 7.3 Profile Links

### Purpose

Let users decide whether their Local Profile and Public Profile should discover each other.

### Screen Structure

```text
Profile Links
Profile links are off by default. Turn them on only if you want people from one profile to discover the other.

Card 1:
  Let neighbors find my Public Profile
  If on, your Local Profile will show a link to your Public Profile.
  [Toggle]

Card 2:
  Let followers find my Local Profile
  If on, your Public Profile will show a link to your Local Profile.
  [Toggle]

Privacy Preview
  [Preview local profile]
  [Preview public profile]
```

### Confirmation Modal

When enabling either link:

Title:

```text
Link these profiles?
```

Body:

```text
People who can see [source profile] will be able to open [target profile]. You can turn this off later.
```

Actions:

```text
[Cancel] [Link profiles]
```

When disabling:

Title:

```text
Remove this profile link?
```

Body:

```text
New visitors will no longer see this link. People who already saved the other profile may still have access to that public link.
```

Actions:

```text
[Cancel] [Remove link]
```

### States

- If Public Profile does not exist, disable controls and show setup CTA.
- If Local Profile does not exist, disable controls and show setup CTA.
- If update fails, revert the toggle and show error.
- If update succeeds, show a short success message and offer preview.

## 7.4 Privacy Preview

### Purpose

Make the Identity Firewall tangible. This is the proof point of the feature.

### Screen Structure

```text
Privacy Preview
Preview what different people can see before you post, share, or link profiles.

Profile:
  Local Profile | Public Profile

Viewing as:
  Public
  Follower
  Neighbor
  Connection
  Household member
  Gig participant

Preview result:
  Profile card
  Visible to this viewer
  Hidden from this viewer
  Sample visible posts
  Sample visible updates
  Counts
```

### Behavior

- Do not hide viewer presets behind "Advanced".
- Only show relevant viewer presets for the selected profile.
- Disabled presets should explain why they are unavailable.
- Always show both "Visible" and "Hidden" information.
- Use green/neutral for visible, lock icon or neutral protection tone for hidden.
- If a profile link is enabled, show it clearly in preview.

### Recommended Viewer Labels

| System viewer | UI label |
| --- | --- |
| public | Public |
| persona_audience_member | Follower |
| neighbor | Neighbor |
| connection | Connection |
| household_member | Household |
| gig_participant | Gig participant |

If the user's selected audience label is "Clients", use "Client" instead of "Follower".

### Preview Result Copy

Visible section title:

```text
Visible to this viewer
```

Hidden section title:

```text
Kept private from this viewer
```

Empty sample posts:

```text
No visible posts for this viewer.
```

Hidden sample posts:

```text
3 posts are hidden from this viewer.
```

## 7.5 Followers

### Purpose

Manage who can see follower-only content and updates.

### Screen Structure

```text
Followers
Approve requests, manage access, and choose who receives follower-only updates.

Top:
  Pending requests card if pending > 0
  Search followers

Segments:
  Active
  Pending
  Muted
  Blocked

Follower list:
  Name
  Handle
  Relationship type
  Notification preference
  Actions
```

### Interaction Rules

- Pending requests should appear first and be visually prominent.
- Use a segmented control, not six metric cards.
- Show counts as badges on segments.
- Actions:
  - Approve
  - Mute updates
  - Restore
  - Remove
  - Block
- Require confirmation for Remove and Block.
- Show a loading state on the row being updated.

### Empty States

No followers:

```text
No followers yet.
Share your Public Profile to start building your audience.

[Copy link] [Preview profile]
```

No pending:

```text
No pending requests.
```

## 7.6 Updates

### Purpose

Let profile owners post one-way updates from their Public Profile.

### Naming

Use "Updates" as the tab/page name.
Use "Post update" as the action.
Avoid "Broadcast" in user-facing UI.

### Screen Structure

```text
Updates
Post one-way updates from your Public Profile.

Profile summary card:
  Maya Builds
  @mayabuilds
  Followers
  [View Public Profile] [Copy link]

Composer:
  Visible to: Followers | Public
  Message
  Character count
  [Post update]

Metrics:
  Updates
  Delivered
  Reads

Recent updates:
  Visibility
  Date
  Body
  Delivered / Reads
```

### Publishing Behavior

Before publishing, show:

```text
Visible to Followers
```

or

```text
Visible to Public
```

For public update, optionally show a warning:

```text
Anyone with the link can see this update.
```

After publishing:

- Clear composer.
- Insert new update at top.
- Show success:

```text
Update posted.
```

### Future-Friendly Slots

Design should leave room for later:

- Media attachments
- Scheduled updates
- Drafts
- Polls
- Paid/member-only updates
- Q&A submissions

Do not build these unless scoped, but avoid layouts that would need to be replaced.

## 7.7 Public Profile Page

### Purpose

A visitor-first profile page for followers, clients, students, customers, members, or the public.

### Visitor View

Primary content:

- Banner
- Avatar
- Name
- Handle
- Verification badge if relevant
- Audience count
- Bio
- Links
- Follow/request button
- Notification preference after following
- Updates
- Posts

Do not show app-management navigation to non-owners.

### Owner View

Owner actions:

- Edit profile
- Post update
- Copy link
- Privacy preview

Owner actions should be grouped in an owner toolbar or action menu. They should not overpower the public page.

### Follow Button States

| State | Button label | Behavior |
| --- | --- | --- |
| Not following, open audience | Follow | Calls follow API and becomes Following. |
| Not following, approval required | Request to follow | Calls follow API and becomes Requested. |
| Pending | Requested | Disabled or opens request status info. |
| Following | Following | Opens manage notification/unfollow menu. |
| Owner | Edit profile | Goes to Public Profile editor. |

### Posts And Updates

Use tabs or section switcher:

```text
Updates
Posts
```

If both are sparse, show sections. If both grow, use tabs.

## 7.8 Local Profile Page

### Purpose

Show nearby/community trust without leaking the private account or public profile unless linked.

### Required Content

- Avatar
- Display name
- Local handle
- Verified resident badge if available
- Locality, rounded to privacy-safe precision
- Bio
- Local activity
- Gigs
- Marketplace
- Reviews
- Connect/message actions if allowed

### Profile Link Behavior

If the user enabled "Let neighbors find my Public Profile":

```text
Also on Pantopus
Maya Builds
Public Profile
[Open]
```

Do not use "Audience Profile" on the public local page.

### Visitor Actions

Connect and Message buttons must be real or hidden. Do not show inert buttons.

## 7.9 Feed And Composer

### Purpose

Make identity and visibility clear at the moment of posting.

### Composer Summary

At the top of the composer:

```text
Posting as: Maya Builds
Visible to: Followers
[Change]
```

On mobile:

```text
Maya Builds -> Followers
Change
```

### Change Picker

The picker should be two-step but compact:

```text
Post as
  Personal
  Local Profile
  Public Profile
  Home
  Business

Visible to
  Nearby
  Followers
  Connections
  Household
  Public
```

Only show valid choices for the selected identity.

### Target Rules

Personal/Local:

- Nearby
- Followers if supported
- Connections

Public Profile:

- Followers
- Public

Home:

- Household
- Neighborhood if owner/admin

Business:

- Target area
- Followers

### Labels

Use:

- "Visible to"
- "Posting as"
- "Nearby"
- "Followers"
- "Connections"
- "Public"
- "Household"

Avoid:

- Audience
- Surface
- Post as type
- Persona
- Identity context

### Feed Tabs

Current feed tabs include:

```text
Place
Audience
Following
Connections
```

Recommended:

```text
Nearby
Following
Connections
Public Profiles
```

If "Public Profiles" feels too long on mobile, use "Profiles".

## 8. Visual Design Direction

### 8.1 Experience Tone

The Identity Firewall feature is about trust and control. The UI should feel:

- Calm
- Clear
- Protective
- Modern
- Practical
- Lightweight

It should not feel like:

- A compliance dashboard
- A developer console
- A social media clone
- A settings maze

### 8.2 Layout Principles

- Show one primary action per section.
- Use cards for distinct repeated/profile items, not for every nested section.
- Avoid cards inside cards.
- Use full-width sections with constrained content.
- Keep mobile screens short by splitting tasks into tabs or focused screens.
- Make privacy consequences visible near the control that changes them.

### 8.3 Color And Icons

Use consistent identity colors:

| Identity | Icon | Accent |
| --- | --- | --- |
| Private account | Shield/lock | Neutral or blue |
| Local Profile | Location/user | Blue |
| Public Profile | Radio/megaphone/user-circle | Teal |
| Home | Home | Green |
| Business | Store/briefcase | Purple |

Do not overuse accent backgrounds. Use color as orientation, not decoration.

### 8.4 Typography

- Page titles: clear and direct.
- Section titles: task-based, not system-based.
- Body copy: short and plain.
- Legal/privacy warnings: concise but explicit.
- Avoid long paragraphs in cards.

### 8.5 Empty States

Every empty state should answer:

1. What is missing?
2. Why does it matter?
3. What should I do next?

Example:

```text
No followers yet
Share your Public Profile so people can follow your updates.
[Copy link]
```

## 9. Accessibility Requirements

### 9.1 Keyboard And Focus

Web:

- All toggles, segmented controls, tabs, and menus must be keyboard reachable.
- Focus ring must be visible.
- Modals must trap focus.
- Escape closes modal.
- Toggle confirmation modals must return focus to the triggering control.

### 9.2 Screen Readers

- Toggle labels must be complete without surrounding text.
- Destructive buttons must include action and target:

```text
Block RiverHome from this Public Profile
```

- Privacy preview result should use semantic headings.
- Status messages should use `aria-live`.

### 9.3 Color Contrast

- Text contrast must meet WCAG AA.
- Do not convey profile link enabled/disabled by color alone.
- Use icons plus text for visible/hidden states.

### 9.4 Mobile Touch Targets

- Minimum touch target: 44 x 44 points.
- Avoid dense chip rows that wrap unpredictably.
- Use bottom sheets for pickers and confirmations.

## 10. Data And Permission Expectations

### 10.1 Backend Safety

The UI depends on the backend contract from the engineering design:

- Raw `User` fields must never leak to public profile, feed, listing, gig, chat, or follower surfaces.
- Public pages must use context-specific serializers.
- View-as preview must reflect real backend visibility decisions, not frontend approximations.

### 10.2 Needed API Support

Existing branch already includes most APIs. Useful additions or refinements:

1. Handle availability endpoint:

```text
GET /api/personas/handle-availability?handle=...
```

2. Unified profile summary endpoint for management screen:

```text
GET /api/identity-center
```

already exists. Ensure it returns enough data for status cards without additional calls.

3. Preview labels should be backend-provided where possible:

```text
viewerLabel
visibleSections
protectedSections
counts
sample
```

4. Follower action responses should return updated counts.

5. Public profile owner status must be reliable:

```text
viewer.isOwner
```

### 10.3 Feature Flags

Current web and mobile feature flags default to enabled when env vars are missing. For rollout, this should change.

Recommendation:

```text
Identity Firewall: default off in production unless explicitly enabled
Public Profile: default off unless Identity Firewall is enabled
Updates: default off unless Public Profile is enabled
```

Development and staging can default on if that matches team workflow, but production should be explicit.

## 11. Analytics And Product Metrics

### 11.1 Events

Track:

```text
profiles_privacy_opened
public_profile_setup_started
public_profile_step_completed
public_profile_published
public_profile_saved
profile_link_enable_started
profile_link_enabled
profile_link_disabled
privacy_preview_opened
privacy_preview_viewer_selected
post_identity_picker_opened
post_identity_selected
post_visibility_selected
public_update_posted
follower_request_approved
follower_removed
follower_blocked
public_profile_follow_clicked
public_profile_follow_completed
```

### 11.2 Funnel Metrics

- % of users who open Profiles & Privacy.
- % who create a Public Profile.
- Setup completion rate by step.
- % who run Privacy Preview before enabling profile links.
- % who enable either profile link.
- % who post first update.
- % who post as Public Profile from composer.
- Follow conversion on public profile page.

### 11.3 Quality Metrics

- Support tickets about "who can see this".
- Users abandoning Public Profile setup.
- Users disabling profile links after enabling.
- Failed composer submissions due to invalid identity/audience combinations.
- Public page bounce rate.

## 12. QA Acceptance Criteria

### 12.1 Navigation

- Web sidebar has one entry for `Profiles & Privacy`.
- Web settings does not list separate Identity Center, Audience Profile, and Broadcast rows.
- Mobile hamburger menu has one `Profiles & Privacy` row.
- Mobile profile switcher may show `Public Profile`, but editing routes into the management flow.

### 12.2 Naming

No user-facing UI should show:

- Persona
- Bridge
- Broadcast channel
- Identity Firewall
- Surface
- Backend preview

Exceptions:

- Engineering docs.
- Admin-only tooling.
- URLs where backwards compatibility requires route names.

### 12.3 Public Profile Setup

- A new user can create a Public Profile in 3 steps or fewer.
- Profile links are clearly off by default.
- User can preview before publishing.
- Public links validate label and URL.
- Sensitive categories do not dominate the default setup flow.

### 12.4 Profile Links

- Enabling either link requires confirmation.
- Disabling either link requires confirmation or clear success state.
- Failed updates revert UI state.
- Privacy Preview reflects link changes.

### 12.5 Privacy Preview

- Viewer presets are visible without opening an "advanced" section.
- Public Profile supports Public and Follower preview.
- Local Profile supports Public, Neighbor, Connection, Household, and Gig participant preview if backend supports those viewers.
- Preview shows visible and hidden sections.
- Preview shows sample visible posts/updates where available.

### 12.6 Followers

- Pending followers are prominent.
- Active/pending/muted/blocked are available as segments.
- Remove and block require confirmation.
- Row-level loading is visible.
- Counts update after action.

### 12.7 Updates

- Updates live inside Public Profile management.
- User sees visibility before posting.
- Public update warns that anyone with the link can see it.
- New update appears at top after posting.
- Metrics update after posting.

### 12.8 Composer

- Composer always shows `Posting as` and `Visible to`.
- Invalid identity/audience combinations are not selectable.
- Persona/Public Profile posts never request location.
- Home neighborhood posts are limited by owner/admin role.
- The final create-post payload matches the visible UI state.

### 12.9 Public Pages

- Non-owners do not see management links.
- Owners see edit/update actions grouped separately.
- Local Profile only links to Public Profile if enabled.
- Public Profile only links to Local Profile if enabled.
- Connect and Message actions are hidden or functional, never inert.

## 13. Implementation Plan

### Phase 0: Safety And Terminology

Scope:

- Change user-facing labels.
- Add copy constants if useful.
- Set production-safe feature flag defaults.
- Update tests that assert old labels.

Files likely involved:

- `frontend/apps/web/src/lib/featureFlags.ts`
- `frontend/apps/mobile/src/lib/featureFlags.ts`
- `frontend/apps/web/src/app/(app)/app/profile/settings/page.tsx`
- `frontend/apps/mobile/src/components/HamburgerMenu.tsx`
- `frontend/apps/web/src/components/AppShell.tsx`
- `frontend/apps/web/src/lib/icons.ts`

Acceptance:

- No visible "Bridge", "Broadcast", "Persona", or "Identity Firewall" in normal user UI.
- Navigation has one Profiles & Privacy entry.

### Phase 1: Profiles & Privacy Shell

Scope:

- Rename Identity Center page to Profiles & Privacy.
- Add tabs or internal section navigation.
- Keep existing route if desired.
- Build overview status model.

Files likely involved:

- `frontend/apps/web/src/app/(app)/app/identity/page.tsx`
- `frontend/apps/mobile/src/app/identity/index.tsx`

Acceptance:

- Overview screen is understandable without scrolling through all advanced controls.
- Public Profile, Profile Links, Privacy Preview, Followers, and Updates are reachable from one place.

### Phase 2: Privacy Preview Redesign

Scope:

- Promote viewer presets out of advanced section.
- Rename to Privacy Preview.
- Improve visible/hidden presentation.
- Add profile-link warnings.

Files likely involved:

- `frontend/apps/web/src/app/(app)/app/identity/page.tsx`
- `frontend/apps/mobile/src/app/identity/index.tsx`
- `frontend/apps/web/tests/e2e/identity-firewall.spec.ts`

Acceptance:

- Existing e2e can select follower/audience viewer without hidden advanced toggle.
- Preview language is user-facing and not backend-facing.

### Phase 3: Public Profile Setup And Editor

Scope:

- Convert long form into stepper for first-time setup.
- Convert existing profile management into tabs/sections.
- Move Followers out of the edit form.
- De-emphasize sensitive category policy until relevant.

Files likely involved:

- `frontend/apps/web/src/app/(app)/app/persona/page.tsx`
- `frontend/apps/mobile/src/app/identity/persona.tsx`
- `frontend/apps/mobile/src/app/identity/__tests__/personaNavigation.test.tsx`
- `frontend/apps/web/tests/identityFirewallWeb.test.tsx`

Acceptance:

- First-time setup is 3 steps or fewer.
- Existing profile users can edit details without scrolling through follower management.
- Save action is always clear and not duplicated excessively.

### Phase 4: Profile Links

Scope:

- Replace Bridges card with Profile Links.
- Add confirmation modals.
- Add explanatory copy.
- Add preview-after-change flow.

Files likely involved:

- `frontend/apps/web/src/app/(app)/app/identity/page.tsx`
- `frontend/apps/mobile/src/app/identity/index.tsx`

Acceptance:

- Enabling a link requires explicit confirmation.
- User understands which profile becomes discoverable from which other profile.

### Phase 5: Updates

Scope:

- Rename Broadcast to Updates.
- Nest under Public Profile management.
- Keep route alias for existing `/app/persona/broadcast` if needed.
- Improve composer and recipient visibility.

Files likely involved:

- `frontend/apps/web/src/app/(app)/app/persona/broadcast/page.tsx`
- `frontend/apps/mobile/src/app/identity/broadcast.tsx`
- `frontend/packages/api/src/endpoints/broadcast.ts`

Acceptance:

- No primary nav item says Broadcast.
- Page title is Updates.
- Publish button says Post update.
- Metrics remain visible.

### Phase 6: Composer Redesign

Scope:

- Replace chip rows with a summary and Change picker.
- Use Post as and Visible to labels.
- Align web and mobile mental model.

Files likely involved:

- `frontend/apps/web/src/components/feed/PostComposer.tsx`
- `frontend/apps/mobile/src/components/feed/PostTargetPicker.tsx`
- `frontend/apps/mobile/src/components/feed/PostComposerModal.tsx`
- `frontend/apps/mobile/src/hooks/feed/usePostComposer.ts`
- `frontend/apps/mobile/src/hooks/useFeedData.ts`

Acceptance:

- User can always identify the posting identity and visibility before submitting.
- Invalid combinations are not selectable.

### Phase 7: Public Pages

Scope:

- Clean visitor public pages.
- Owner toolbar only for owners.
- Rename Audience Profile to Public Profile.
- Ensure local/public links obey settings.

Files likely involved:

- `frontend/apps/web/src/app/persona/[personaHandle]/AudienceProfileClient.tsx`
- `frontend/apps/web/src/app/local/[localHandle]/LocalProfileClient.tsx`
- `frontend/apps/mobile/src/app/persona/[personaHandle].tsx`
- `frontend/apps/mobile/src/app/local/[localHandle].tsx`

Acceptance:

- Visitor pages look like polished public profiles.
- Management links are owner-only.
- Links between profiles appear only when explicitly enabled.

### Phase 8: Visual Polish And QA

Scope:

- Responsive layout checks.
- Accessibility checks.
- Empty states.
- Loading/error states.
- Unit/e2e updates.

Acceptance:

- Web and mobile have consistent vocabulary.
- E2E covers setup, preview, profile links, follower management, updates, composer identity selection, and public page owner/visitor states.

## 14. File-Level Redesign Map

### Web

| Area | Current file | Redesign action |
| --- | --- | --- |
| Sidebar nav | `frontend/apps/web/src/components/AppShell.tsx` | Rename Identity to Profiles & Privacy. Route to unified destination. |
| Settings | `frontend/apps/web/src/app/(app)/app/profile/settings/page.tsx` | Replace three identity rows with one Profiles & Privacy row. |
| Identity Center | `frontend/apps/web/src/app/(app)/app/identity/page.tsx` | Rename and restructure into overview, profile links, privacy preview. |
| Public Profile editor | `frontend/apps/web/src/app/(app)/app/persona/page.tsx` | Stepper for setup, tabs for existing profile, move followers. |
| Updates | `frontend/apps/web/src/app/(app)/app/persona/broadcast/page.tsx` | Rename to Updates, nest under management IA. |
| Public profile page | `frontend/apps/web/src/app/persona/[personaHandle]/AudienceProfileClient.tsx` | Visitor-first page, owner toolbar, terminology update. |
| Local profile page | `frontend/apps/web/src/app/local/[localHandle]/LocalProfileClient.tsx` | Visitor-first page, real/hide connect/message actions, terminology update. |
| Feed composer | `frontend/apps/web/src/components/feed/PostComposer.tsx` | Replace identity chips with summary and picker. |
| Feed tabs | `frontend/apps/web/src/app/(app)/app/feed/page.tsx` | Rename Audience tab to Public Profiles or Profiles. |

### Mobile

| Area | Current file | Redesign action |
| --- | --- | --- |
| Hamburger menu | `frontend/apps/mobile/src/components/HamburgerMenu.tsx` | Replace Identity Center, Audience Profile, Broadcast rows with one Profiles & Privacy row. |
| Profile switcher | `frontend/apps/mobile/src/components/IdentityProfileSwitcher.tsx` | Keep Public Profile shortcut but align labels. |
| Profiles & Privacy | `frontend/apps/mobile/src/app/identity/index.tsx` | Rename and restructure overview/preview/links. |
| Public Profile editor | `frontend/apps/mobile/src/app/identity/persona.tsx` | Stepper setup, separate followers and updates. |
| Updates | `frontend/apps/mobile/src/app/identity/broadcast.tsx` | Rename to Updates and align copy. |
| Public profile page | `frontend/apps/mobile/src/app/persona/[personaHandle].tsx` | Visitor-first, owner actions grouped. |
| Composer picker | `frontend/apps/mobile/src/components/feed/PostTargetPicker.tsx` | Use Post as / Visible to language. |
| Composer modal | `frontend/apps/mobile/src/components/feed/PostComposerModal.tsx` | Show selected identity and visibility summary. |

### Shared Packages

| Area | Current file | Redesign action |
| --- | --- | --- |
| Identity types | `frontend/packages/types/src/identity.ts` | Keep system names. Add user-facing labels only if helpful. |
| API exports | `frontend/packages/api/src/endpoints/identityCenter.ts` | Keep API names. UI maps to user-facing labels. |
| Broadcast endpoint | `frontend/packages/api/src/endpoints/broadcast.ts` | Keep endpoint names. UI maps broadcast to Updates. |

## 15. Test Plan

### 15.1 Web E2E

Add/update tests:

1. Profiles & Privacy overview loads.
2. Public Profile setup completes from empty state.
3. Privacy Preview supports Public and Follower without advanced toggle.
4. Enabling profile link shows confirmation and updates preview.
5. Updates page posts follower-only update.
6. Composer posts as Public Profile to Followers.
7. Public Profile visitor can follow.
8. Public Profile owner sees owner toolbar.
9. Local Profile shows Public Profile link only when enabled.

### 15.2 Mobile Component Tests

Add/update tests:

1. Hamburger menu shows one Profiles & Privacy entry.
2. Public Profile setup shows stepper.
3. Profile link confirmation appears before enabling.
4. Privacy Preview viewer chips are visible.
5. Updates page posts update.
6. Composer target picker uses Post as / Visible to labels.

### 15.3 Accessibility Tests

Web:

- Keyboard navigate through Profiles & Privacy.
- Toggle profile link with keyboard.
- Confirm modal focus trap.
- Screen reader labels for preview tabs and toggles.

Mobile:

- VoiceOver/TalkBack labels for toggles.
- Touch target checks for chips and action buttons.
- Dynamic text sizing smoke.

## 16. Rollout Strategy

### 16.1 Internal QA

Enable feature in staging only.

Test personas:

- User with no Public Profile.
- User with Public Profile and no followers.
- User with pending followers.
- User with local profile and public profile unlinked.
- User with both links enabled.
- User with home and business identities.
- Public visitor.
- Follower.
- Owner.

### 16.2 Limited Beta

Enable for selected users.

Monitor:

- Setup completion.
- Preview usage.
- Support questions.
- Failed post submissions.
- Profile-link toggles.
- Update posting.

### 16.3 General Availability

Before GA:

- All terminology changed.
- Navigation collapsed.
- Preview promoted.
- Composer simplified.
- Public pages polished.
- Production feature flags explicit.

## 17. Open Product Decisions

1. Final user-facing name:
   - Recommended: Profiles & Privacy.
   - Alternative: Profile Privacy.

2. Final "Audience Profile" replacement:
   - Recommended: Public Profile.
   - Alternative: Follower Profile.

3. Final "Broadcast" replacement:
   - Recommended: Updates.
   - Alternative: Announcements.

4. Public route branding:
   - Keep `/@handle` for public profiles.
   - Keep `/local/handle` for local profiles.

5. Should profile setup support multiple Public Profiles later?
   - Current model appears one active Public Profile per user.
   - Design should not promise multiple profiles now.

6. Should followers be called by selected audience label everywhere?
   - Recommended: yes, but use "followers" as fallback.

## 18. Non-Goals For This Redesign

This redesign does not require:

- Multiple public profiles per account.
- Paid memberships.
- Direct messaging from Public Profile.
- Replies to updates.
- Comments on updates.
- Scheduling updates.
- Media updates.
- Public profile themes.
- Full CRM/member management.

The layout should leave room for future features, but the immediate release should stay focused.

## 19. Recommended Ticket Breakdown

### Ticket 1: Terminology And Navigation Cleanup

- Rename UI labels.
- Collapse settings/mobile menu entries.
- Add one Profiles & Privacy destination.
- Update tests.

### Ticket 2: Profiles & Privacy Overview

- Rework Identity Center layout.
- Add status cards.
- Add recommended next step.
- Keep existing API.

### Ticket 3: Privacy Preview Redesign

- Promote viewer presets.
- Improve preview result UI.
- Add profile-link warnings.
- Fix/update e2e.

### Ticket 4: Public Profile Setup Stepper

- Split first-time setup into 3 steps.
- Add preview step.
- Move sensitive category policy into expandable path.

### Ticket 5: Existing Public Profile Management Tabs

- Profile details tab.
- Audience settings tab.
- Preview tab.
- Remove follower list from editor body.

### Ticket 6: Profile Links

- Replace Bridges UI.
- Add confirmations.
- Add preview-after-change CTA.

### Ticket 7: Followers Management

- Build dedicated Followers tab.
- Pending-first layout.
- Segments with counts.
- Destructive confirmations.

### Ticket 8: Updates

- Rename Broadcast to Updates.
- Improve composer and metrics.
- Nest in Profiles & Privacy.

### Ticket 9: Composer Identity UX

- Build Post as / Visible to summary.
- Build change picker.
- Apply to web and mobile.

### Ticket 10: Public Page Polish

- Visitor-first Public Profile.
- Visitor-first Local Profile.
- Owner toolbar.
- Link visibility based on settings.

### Ticket 11: QA, Analytics, Accessibility

- Events.
- E2E coverage.
- Screen reader pass.
- Mobile dynamic text pass.

## 20. Final Product Bar

The feature is ready when a user can say:

```text
I know what Pantopus keeps private.
I know what neighbors see.
I know what followers see.
I know whether those worlds are linked.
I know who will see my post before I send it.
```

That is the product promise. Every screen should serve it.
