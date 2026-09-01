# Notification template inventory

Phase 0 / P0.6. Source of truth: `backend/services/notificationService.js`
plus the registry in `backend/services/notificationTemplateRegistry.js`.

The notification firewall (Audience Profile design v2 §6.2 + §13.7) tags
every notification with one of three contexts:

| Context | Identity surfaces it may interpolate |
|---|---|
| `personal` | LocalProfile, Home, Business, Gig, Listing, Mailbox, generic platform fields |
| `audience` | PublicPersona, PersonaMembership.fan_handle / fan_display_name, generic platform fields |
| `platform` | Generic platform fields only (subscription status, billing dates, amount, currency) |

Every template below is currently **personal**. Per the P0.6 prompt, no
existing notifications are migrated to `audience` even when they pertain to
a Public Profile (they are notifications **to the persona owner**, who is a
personal-side user). Phase 1 introduces audience-context templates for
fan-side surfaces (membership, broadcasts, etc.).

## Field allowlist (registry)

`personal`: `actor.displayName`, `actor.handle`, `actor.id`,
`actor.localProfile.{displayName,handle,avatarUrl}`, `home.{id,name,address}`,
`business.{id,displayName,handle}`, `gig.{id,title}`, `listing.{id,title}`,
`mailbox.id`, `task.{id,title}`, `amount`, `currency`, `periodEnd`,
`billingDate`, `status`, `type`, `role`, `message`, `reason`.

`audience`: `persona.{id,handle,displayName,avatarUrl}`,
`fan.{handle,displayName,avatarUrl}`,
`membership.{id,tierName,tierRank}`, `broadcast.{id,bodyPreview}`,
`amount`, `currency`, `periodEnd`, `billingDate`, `status`, `type`,
`message`, `reason`. **NEVER** `actor.localProfile.*`, `home.*`, `gig.*`,
`listing.*`, `mailbox.*`.

`platform`: `amount`, `currency`, `periodEnd`, `billingDate`, `status`,
`type`, `message`, `reason`. **NEVER** any actor / persona / fan / home /
gig / listing identifier.

The CI guard for this allowlist runs at registration time inside
`registerTemplate(...)` and again at render time inside `renderTemplate(...)`.
A unit test (`tests/unit/notificationContextFirewall.test.js`) loads the
real `notificationService` module and asserts every registered template
validates clean against its declared context.

## Personal-context templates (Phase 0 inventory)

Every entry below corresponds to one imperative `notifyX` helper in
`backend/services/notificationService.js`. The push title / body strings
are the registered template (with `{placeholders}`). The actual notify
helper still builds the body with template literals; the registry exists
so that when Phase 1 adds audience-side templates, the firewall is
enforced by construction, and the existing personal-side templates are
already documented and validated.

### Home / household

| Template | Type | Title | Body |
|---|---|---|---|
| `home_invite` | `home_invite` | `{actor.displayName} invited you to join a home` | `You've been invited to {home.name} as a household member.` |
| `home_invite_accepted` | `home_invite_accepted` | `{actor.displayName} joined your home` | `{actor.displayName} accepted your invitation to {home.name}.` |
| `task_assigned` | `task_assigned` | `{actor.displayName} assigned you a task` | `{task.title}` |
| `task_completed` | `task_completed` | `Task completed: {task.title}` | `{actor.displayName} marked this task as done.` |
| `residency_claim` | `residency_claim` | `New residency claim` | `{actor.displayName} claims to live at {home.name}.` |
| `residency_approved` | `residency_approved` | `Residency approved at {home.name}` | `Your residency claim was approved.` |
| `residency_rejected` | `residency_rejected` | `Residency claim not approved` | `{reason}` |
| `ownership_verification_needed` | `ownership_verification_needed` | `Verify ownership of {home.name}` | `Provide a proof document to continue.` |
| `ownership_claim_approved` | `ownership_claim_approved` | `Ownership approved at {home.name}` | `Your ownership claim was approved.` |
| `ownership_claim_rejected` | `ownership_claim_rejected` | `Ownership claim not approved` | `{reason}` |
| `ownership_claim_needs_more_info` | `ownership_claim_needs_more_info` | `More info needed` | `We need additional details for {home.name}.` |
| `new_ownership_claim` | `new_ownership_claim` | `New ownership claim` | `{actor.displayName} claims ownership of {home.name}.` |
| `ownership_dispute` | `ownership_dispute` | `Ownership dispute at {home.name}` | `A counter-claim was filed.` |
| `household_access_request` | `household_access_request` | `Household access request` | `{actor.displayName} requested access to your home.` |
| `household_access_request_rejected` | `household_access_request_rejected` | `Household request not approved` | `Your request for {home.name} was not approved.` |

### Gigs

| Template | Title | Body |
|---|---|---|
| `bid_received` | `New bid on "{gig.title}"` | `{actor.displayName} placed a bid on your gig.` |
| `first_bid_received` | `Your first response! 🎉` | `{actor.displayName} wants to help with '{gig.title}'` |
| `bid_accepted` | `Your bid was accepted!` | `Your bid on "{gig.title}" was accepted. You can start a chat to coordinate.` |
| `bid_rejected` | `Your bid was not selected` | `Your bid on "{gig.title}" was declined.` |
| `bid_withdrawn` | `{actor.displayName} withdrew their bid` | `A bid on "{gig.title}" was withdrawn.` |
| `gig_started` | `Gig started: {gig.title}` | `{actor.displayName} has started your gig.` |
| `gig_completed` | `Gig completed: {gig.title}` | `{actor.displayName} marked the gig as completed.` |
| `gig_confirmed` | `Gig completion confirmed` | `Your gig "{gig.title}" was confirmed complete.` |
| `gig_auto_cancelled` | `Gig auto-cancelled: "{gig.title}"` | `{reason}` |

### Marketplace + payments

| Template | Title | Body |
|---|---|---|
| `address_revealed` | `Address shared with you` | `The seller shared their pickup address for "{listing.title}".` |
| `payment_auth_failed` | `Payment failed for "{gig.title}"` | `Please update your payment method to continue.` |
| `payment_captured` | `Payment captured` | `{amount} captured for "{gig.title}".` |
| `transfer_completed` | `Transfer completed` | `{amount} for "{gig.title}" has been transferred.` |
| `dispute_created` | `Dispute opened on "{gig.title}"` | `A dispute was opened on your gig.` |
| `dispute_resolved` | `Dispute resolved on "{gig.title}"` | `The dispute on your gig has been resolved.` |
| `setup_failed` | `Setup failed for "{gig.title}"` | `We could not finish setting up your gig.` |

### Connections + persona (still personal-side: notifies the owner)

| Template | Title | Body |
|---|---|---|
| `connection_request` | `New connection request` | `{actor.displayName} wants to connect with you.` |
| `connection_accepted` | `Connection accepted` | `{actor.displayName} accepted your connection request.` |
| `new_follower` | `New follower` | `{actor.displayName} started following you.` |
| `persona_follow` | `New follower` | `{actor.displayName} joined your Public Profile.` |
| `persona_follow_request` | `Review a new audience request` | `{actor.displayName} wants to join your Public Profile.` |
| `persona_broadcast` | `Public Profile update` | `A Public Profile shared an update.` |

> **Note**: `persona_follow*` and `persona_broadcast` remain `personal`-context
> because the recipient is the persona owner — a personal-side user. Phase 1
> introduces parallel audience-context templates that target *fans* (e.g.
> `audience_subscription_renewed`, `audience_dm_received`). Those will use
> the registry's `audience` field allowlist (`persona.handle`, `fan.handle`,
> etc.) and are forbidden from referencing any personal-side identifier.

### Mail + neighborhood

| Template | Title | Body |
|---|---|---|
| `mail_delivered` | `Mail delivered` | `New mail at {mailbox.id}.` |
| `density_milestone` | `Neighborhood milestone reached` | `{message}` |

## In-app feed grouping

`backend/services/notificationGrouping.js#groupNotifications` collapses
notifications by `(user_id, context, related_entity_type, related_entity_id)`.
Two notifications about the same entity collapse into one feed row only when
they share the same context. A personal-context and an audience-context
notification with the same user_id NEVER share a row, even if their related
entity ids happen to match. This is enforced by the test suite.

## Backfill

Migration `134_notification_context.sql` adds `Notification.context` with
`DEFAULT 'personal'` and a CHECK constraint, plus `idx_notification_user_context`.
Every existing row inherits `context = 'personal'`. The
`notification_context_type` enum (`personal | business`) on the legacy
`context_type` column is independent and unchanged.

## Adding a new template

1. Decide the context (`personal | audience | platform`).
2. Add the template object to the appropriate registration list in
   `notificationService.js` (or, for audience templates added in Phase 1,
   the new audience-side notify module).
3. Add the title / body / push surfaces using `{placeholder}` syntax with
   placeholders drawn from that context's allowlist.
4. The registry's `validateTemplate` step throws at registration time if a
   placeholder isn't in the allowlist — `npm test` catches this.
