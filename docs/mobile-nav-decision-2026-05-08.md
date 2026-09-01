# Mobile bottom-nav decision — Audience tab placement

Date: 2026-05-08
Status: Superseded by the five-tab simplification.
Resolves: unified-IA §13.1 open question (mobile bottom-tab placement).

---

## 0. The problem

Web has 5 primary destinations and 1 audience destination — Audience
slots in cleanly as a 6th sidebar item. Mobile started with a different
shape:

- Tab bar today: **Hub, Pulse, Tasks, Messages, Profile** (5 visible).
- `Marketplace` is also declared but `href: null` keeps it off the
  tab bar; users reach it via Hub cards.

Adding Audience to the bottom forces a choice: drop something, hide
something behind the top-bar, or accept 6 visible tabs.

## 1. Options considered

### A. Replace Profile in the tab bar; Profile lives at the top-bar avatar.

Profile is already reachable from the top-bar avatar on every screen
that has a top-bar (Hub, Profile itself, persona views, …). Dropping
it from the tab bar still leaves Profile one tap away from anywhere.

- ✅ Stays at 5 visible tabs (iOS HIG-friendly).
- ✅ No regression for Chat unread badge (Messages stays in the bar).
- ⚠ Some surfaces (Pulse, Tasks) currently lack a top-bar avatar; we'd
  need to add it.

### B. Move Chat to the top-bar icon.

The web split (P2.3) already puts Personal+Audience notification icons
in the top-bar; adding Chat alongside is a natural mirror.

- ✅ Stays at 5 visible tabs.
- ⚠ Significant UX shift for the existing user base — Chat being in
  the bottom tab is the most-used path on mobile today.
- ⚠ The unread badge is more visible in the bottom tab than in a
  small header icon.

### C. Append Audience as a 6th tab (gated by `audience_profile`).

iOS HIG suggests ≤ 5 tabs but doesn't enforce it. Since Audience is
gated behind a beta flag, only beta users see the 6-tab bar; the
default user keeps the existing 5.

- ✅ Zero regression for non-flagged users.
- ✅ Smallest blast radius; defers the longer nav redesign to
  post-Phase-2 when we have actual data on Audience usage.
- ⚠ For flagged users, the 6th tab visually crowds the bar on
  smaller iPhones.

### D. Show Marketplace + Audience, drop Chat AND Profile.

The unified-IA's recommended order
(Hub / Pulse / Tasks / Marketplace / Audience). Loses both Chat and
Profile from the bottom — an aggressive change with two simultaneous
regressions.

- ❌ Two big UX regressions on day one of beta.

## 2. Original Decision — Option C (append, flag-gated)

**Add Audience as a 6th tab between `gigs` (Tasks) and `chat`
(Messages), conditionally rendered when
`useFeatureFlag('audience_profile')` returns true.** Marketplace
remains hidden from the tab bar (existing behavior). Profile stays.

Order for flagged users:

```
[Hub] [Pulse] [Tasks] [Audience] [Messages] [Profile]
```

Order for non-flagged users (unchanged):

```
[Hub] [Pulse] [Tasks] [Messages] [Profile]
```

### Why C now and not A/B

- **Smallest blast radius.** P2.11 is one of the last Phase 2 PRs;
  doing a top-bar reshuffle in the same PR would compound risk.
- **Beta scope.** The audience_profile flag stays off in production
  through Phase 2; we don't need to optimize the 6-tab UX for the
  general user base.
- **Re-evaluate post-launch.** Once we have real usage data on the
  Audience tab (open-rate, time-on-tab, bounce), we can decide
  between:
    - Keep at 6 (it's working).
    - Promote to permanent 5 by collapsing Hub into the Pulse top
      bar.
    - Promote by moving Chat to the top-bar (Option B).
  This decision has a date stamp and can change.

## 3. Iconography

`Ionicons` `megaphone-outline` for the Audience tab — distinct from
every existing tab icon, semantically aligned with the audience
megaphone we're using on web (P2.3) for the audience-zone notification
stream.

## 4. Acceptance + revisit

- After 30 days of beta with the audience_profile flag enabled for ≥
  100 users, pull tab-engagement metrics (taps per tab per session).
- If the 6-tab density is causing measurable bottom-tab confusion
  (e.g. fewer Pulse opens, more mis-taps), revisit by promoting one
  of Options A/B/D in a follow-up PR.
- Until then: 6 tabs gated, no other nav reshuffle.

## 5. Superseding Decision — five primary mobile tabs

The mobile tab bar now uses a stable five-tab set:

```
[Home] [Pulse] [Tasks] [Marketplace] [Messages]
```

Profile remains reachable from avatar/profile routes. Audience/Public
remains routable, but it no longer adds a bottom-tab item, even when the
`audience_profile` feature flag is enabled.

This matches the simplification goal: users get the daily work surfaces
in the bottom bar, while account/profile and public-profile management
stay present without competing as primary navigation.
