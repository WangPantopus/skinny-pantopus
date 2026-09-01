//
//  MembersListViewModel.swift
//  Pantopus
//
//  T6.3a / P9 — Per-home members roster. Drives the Members screen
//  against the shared `ListOfRows` archetype with three equal-width
//  tabs:
//
//      Members (N)  ·  Guests (N)  ·  Pending (N)
//
//  Tab → data-source mapping (verified against `backend/routes/home.js:3705`
//  + `backend/routes/homeIam.js`):
//
//    - Members tab: occupants where `isActive == true` AND role ∉ guestRoles
//    - Guests  tab: occupants where `isActive == true` AND role  ∈ guestRoles
//    - Pending tab: rows from the same payload's `pendingInvites` array
//
//  Backend lacks per-tab filters, so a single GET fetches both halves
//  and the VM buckets client-side (as the design contract permits).
//
//  Row anatomy (shape F-derivative — same vocabulary as Connections):
//    - Leading: `RowLeading.avatarWithBadge` (medium = 40pt) with the
//      verified-check overlay on active members and disabled on pending.
//    - Title: display name (or email fallback for pending invites).
//    - Subtitle (with role-icon prefix): role label.
//    - Body (with icon prefix): joined-at meta (Members / Guests) or
//      "Invited <relative-time>" (Pending).
//    - Trailing:
//        - Members / Guests: kebab (`RowTrailing.kebab`) → Remove
//          confirm.
//        - Pending: vertical stacked Resend / Cancel pair
//          (`RowTrailing.verticalActions`).
//
//  Empty states per tab, FAB opens the Invite member wizard.
//

import Foundation
import Observation
import SwiftUI

// swiftlint:disable type_body_length file_length

/// Stable tab identifiers — exposed for tests + the view layer.
public enum MembersTab {
    public static let members = "members"
    public static let guests = "guests"
    public static let pending = "pending"
    /// Household-access requests raised via the claim flow's "ask a
    /// verified owner" path. Only rendered for viewers who can review
    /// them (`GET /api/homes/:id/me` → `is_owner` or `members.manage`).
    public static let requests = "requests"
    /// Who did what to the household — `GET /api/homes/:id/audit-log`
    /// (`backend/routes/homeIam.js:602`). Same `members.manage` gate as
    /// the Requests queue.
    public static let audit = "audit"
}

/// A member row the viewer may act on, plus the roles the backend will
/// actually let them assign to that member.
public struct MemberActionTarget: Sendable, Equatable, Identifiable {
    public let userId: String
    public let name: String
    public let currentRole: String?
    public let assignableRoles: [HomeAssignableRole]
    public let canRemove: Bool

    public var id: String {
        userId
    }

    public init(
        userId: String,
        name: String,
        currentRole: String?,
        assignableRoles: [HomeAssignableRole],
        canRemove: Bool
    ) {
        self.userId = userId
        self.name = name
        self.currentRole = currentRole
        self.assignableRoles = assignableRoles
        self.canRemove = canRemove
    }
}

/// Outbound event the host view reacts to (sheet presentation, alerts).
public enum MembersListEvent: Sendable, Equatable {
    case openInvite
    /// A13.1 — open the Add Guest form (issue a short-term guest pass).
    /// Fired from the Guests tab's FAB + empty-state CTA.
    case openAddGuest
    /// Row kebab — the view presents an action sheet with "Change role"
    /// and "Remove from home" depending on what the target allows.
    case openMemberActions(MemberActionTarget)
    case confirmRemove(userId: String, name: String)
    /// Requests tab — "Invite" mints a personal invitation server-side.
    case confirmApproveRequest(requestId: String, name: String)
    /// Requests tab — "Decline" rejects the access request.
    case confirmDeclineRequest(requestId: String, name: String, identity: String)
}

/// `@Observable` data source for the Members per-home screen.
@Observable
@MainActor
public final class MembersListViewModel: ListOfRowsDataSource {
    // MARK: - Public state

    public let title = "Members"

    public var topBarAction: TopBarAction? {
        // The design ships a top-bar plus AND a FAB; per the iOS
        // convention (Pets, Connections) we keep the FAB and drop the
        // duplicate top-bar plus on phone widths.
        nil
    }

    public var tabs: [ListOfRowsTab] {
        var out = [
            ListOfRowsTab(id: MembersTab.members, label: "Members", count: members.count),
            ListOfRowsTab(id: MembersTab.guests, label: "Guests", count: guests.count),
            ListOfRowsTab(id: MembersTab.pending, label: "Pending", count: pending.count)
        ]
        if canManageMembers {
            out.append(
                ListOfRowsTab(
                    id: MembersTab.requests,
                    label: "Requests",
                    count: accessRequests.count
                )
            )
            out.append(
                ListOfRowsTab(
                    id: MembersTab.audit,
                    label: "Audit Log",
                    count: auditEntries.count
                )
            )
        }
        return out
    }

    public var selectedTab: String = MembersTab.members {
        didSet {
            guard oldValue != selectedTab else { return }
            applyState()
        }
    }

    public var fab: FABAction? {
        // 52pt secondary-create — this is a sub-screen of the Home
        // dashboard, so the canonical create lives on the parent and
        // this FAB carries the secondary tint. Home-green per the
        // home-pillar identity (Bills / Maintenance use the same).
        //
        // A13.1 — the FAB is contextual: on the Guests tab it issues a
        // guest pass; on Members / Pending it invites a member. The
        // Requests and Audit Log tabs are read/review queues — no create
        // affordance.
        if selectedTab == MembersTab.requests || selectedTab == MembersTab.audit { return nil }
        if selectedTab == MembersTab.guests {
            return FABAction(
                icon: .userPlus,
                accessibilityLabel: "Add guest",
                variant: .secondaryCreate,
                tint: .home
            ) { @Sendable [weak self] in
                Task { @MainActor in self?.pendingEvent = .openAddGuest }
            }
        }
        return FABAction(
            icon: .userPlus,
            accessibilityLabel: "Invite member",
            variant: .secondaryCreate,
            tint: .home
        ) { @Sendable [weak self] in
            Task { @MainActor in self?.pendingEvent = .openInvite }
        }
    }

    public private(set) var state: ListOfRowsState = .loading

    /// Event the host view reacts to. Set by FAB / row handlers; cleared
    /// by the view after dispatching.
    public var pendingEvent: MembersListEvent?

    /// Surfaced by the view as an alert when a mutation fails (403 rank
    /// enforcement, network, …).
    public var actionError: String?

    /// Request id whose approve/decline is in flight — the view disables
    /// its buttons while set.
    public private(set) var busyRequestId: String?

    /// Whether the viewer may manage the roster (role changes, remove,
    /// and the Requests review queue). Mirrors the backend's
    /// `canReviewHouseholdAccessRequests` (`backend/routes/home.js:219`).
    public var canManageMembers: Bool {
        access?.canManageMembers ?? false
    }

    // MARK: - Dependencies

    private let homeId: String
    private let api: APIClient
    private let now: @Sendable () -> Date
    private let calendar: Calendar
    private let timeZone: TimeZone
    private let currentUserId: String?

    private var occupants: [OccupantDTO] = []
    private var pendingInvites: [PendingInviteDTO] = []
    private var accessRequests: [HouseholdAccessRequestDTO] = []
    private var auditEntries: [HomeAuditEntryDTO] = []
    private var access: HomeAccessDTO?
    private var loadedOnce = false

    init(
        homeId: String,
        api: APIClient = .shared,
        now: @escaping @Sendable () -> Date = { Date() },
        calendar: Calendar = .current,
        timeZone: TimeZone = .current,
        currentUserId: String? = nil
    ) {
        self.homeId = homeId
        self.api = api
        self.now = now
        self.calendar = calendar
        self.timeZone = timeZone
        // Resolved in the body, not as a default argument: a `@MainActor`
        // default expression on a `@MainActor` view-model init trips a
        // compiler crash on the Xcode 16.4 / Swift 6.1.2 toolchain CI uses.
        self.currentUserId = currentUserId ?? Self.signedInUserId()
    }

    /// Session user id, used to keep the always-allowed self-leave path
    /// available even to members who can't manage anyone else.
    static func signedInUserId() -> String? {
        if case let .signedIn(user) = AuthManager.shared.state { return user.id }
        return nil
    }

    // MARK: - ListOfRowsDataSource

    public func load() async {
        if loadedOnce { return }
        state = .loading
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    public func loadMoreIfNeeded() async {
        // Backend doesn't paginate /occupants.
    }

    // MARK: - Mutations

    /// Fold a freshly-created invite into the Pending bucket so the
    /// user sees the new row without waiting for a refetch.
    public func handleInvited(_ invitation: InvitationDTO) {
        let invite = PendingInviteDTO(
            id: invitation.id,
            userId: invitation.inviteeUserId,
            role: invitation.proposedRole,
            email: invitation.inviteeEmail,
            name: invitation.inviteeEmail ?? "Invited user",
            invitedBy: nil,
            createdAt: invitation.createdAt
        )
        pendingInvites.insert(invite, at: 0)
        applyState()
    }

    /// Optimistic remove with rollback on failure. The confirm dialog
    /// has already fired by the time this is invoked.
    public func remove(userId: String) async {
        let previousOccupants = occupants
        occupants.removeAll { $0.userId == userId }
        applyState()
        do {
            let _: EmptyResponse = try await api.request(
                HomesEndpoints.removeMember(homeId: homeId, userId: userId)
            )
        } catch {
            occupants = previousOccupants
            applyState()
        }
    }

    /// Optimistic cancel-invite. Backend lacks a dedicated cancel
    /// endpoint today, so we delete the invitee's row via the same
    /// `DELETE /:id/members/:userId` route when the invitee has a
    /// resolved user id; for not-yet-registered invites (no user id)
    /// we just drop the row optimistically and refetch — the backend
    /// will reconcile when the invite expires.
    public func cancelInvite(inviteId: String) async {
        guard let idx = pendingInvites.firstIndex(where: { $0.id == inviteId }) else { return }
        let invite = pendingInvites[idx]
        let previous = pendingInvites
        pendingInvites.remove(at: idx)
        applyState()
        guard let userId = invite.userId else {
            // Open invite with no resolved user — leave the optimistic
            // removal in place. A subsequent refresh will reconcile.
            return
        }
        do {
            let _: EmptyResponse = try await api.request(
                HomesEndpoints.removeMember(homeId: homeId, userId: userId)
            )
        } catch {
            pendingInvites = previous
            applyState()
        }
    }

    /// `POST /api/homes/:id/members/:userId/role` — route
    /// `backend/routes/homeIam.js:212`. Awaited (not optimistic): the
    /// backend enforces rank + owner-promotion rules, so we refetch the
    /// roster on success and surface the server's message on failure.
    public func changeRole(userId: String, to role: HomeAssignableRole) async {
        actionError = nil
        do {
            let _: ChangeMemberRoleResponse = try await api.request(
                HomeAdminEndpoints.changeMemberRole(
                    homeId: homeId,
                    userId: userId,
                    request: ChangeMemberRoleRequest(roleBase: role.rawValue)
                )
            )
            await fetch()
        } catch {
            actionError = (error as? APIError)?.errorDescription
                ?? "Failed to update role"
        }
    }

    /// `POST …/household-access-requests/:requestId/approve` — route
    /// `backend/routes/home.js:2714`. Mints a personal invitation for
    /// the requester; the roster refetches so the row leaves the queue
    /// and shows up under Pending.
    public func approveAccessRequest(requestId: String) async {
        guard busyRequestId == nil else { return }
        busyRequestId = requestId
        actionError = nil
        defer { busyRequestId = nil }
        do {
            let _: HouseholdAccessRequestActionResponse = try await api.request(
                HomeAdminEndpoints.approveHouseholdAccessRequest(
                    homeId: homeId,
                    requestId: requestId
                )
            )
            await fetch()
        } catch {
            actionError = (error as? APIError)?.errorDescription
                ?? "Could not approve request"
        }
    }

    /// `POST …/household-access-requests/:requestId/reject` — route
    /// `backend/routes/home.js:2831`.
    public func rejectAccessRequest(requestId: String) async {
        guard busyRequestId == nil else { return }
        busyRequestId = requestId
        actionError = nil
        defer { busyRequestId = nil }
        do {
            let _: HouseholdAccessRequestActionResponse = try await api.request(
                HomeAdminEndpoints.rejectHouseholdAccessRequest(
                    homeId: homeId,
                    requestId: requestId
                )
            )
            await fetch()
        } catch {
            actionError = (error as? APIError)?.errorDescription
                ?? "Could not decline request"
        }
    }

    /// "Resend" — re-issues the invite via POST /:id/invite with the
    /// same email + role. Optimistic: no state change locally; surface
    /// success/failure via the standard error path.
    public func resendInvite(inviteId: String) async {
        guard let invite = pendingInvites.first(where: { $0.id == inviteId }) else { return }
        let request = InviteMemberRequest(
            email: invite.email,
            userId: invite.userId,
            relationship: invite.role ?? "member",
            message: nil
        )
        do {
            let _: InviteMemberResponse = try await api.request(
                HomesEndpoints.inviteMember(homeId: homeId, request: request)
            )
        } catch {
            // Resend failures don't roll back state (nothing changed
            // locally). Future: surface a toast.
        }
    }

    // MARK: - Fetch

    private func fetch() async {
        // The viewer's own access record decides whether the manage
        // affordances render at all. Best-effort: a 403 here just means
        // "no manage rights", it must not fail the roster.
        let accessResult = try? await api.request(
            HomeAdminEndpoints.myAccess(homeId: homeId),
            as: HomeAccessDTO.self
        )
        access = accessResult
        do {
            let response: OccupantsResponse = try await api.request(
                HomesEndpoints.listOccupants(homeId: homeId)
            )
            occupants = response.occupants.filter(\.isActive)
            pendingInvites = response.pendingInvites
            await fetchAccessRequests()
            await fetchAuditLog()
            loadedOnce = true
            if [MembersTab.requests, MembersTab.audit].contains(selectedTab), !canManageMembers {
                selectedTab = MembersTab.members
            }
            applyState()
        } catch {
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load members. Try again."
            )
        }
    }

    /// `GET /api/homes/:id/household-access-requests?status=pending` —
    /// route `backend/routes/home.js:2671`. 403s for viewers who can't
    /// review, so it is best-effort and never fails the whole screen.
    private func fetchAccessRequests() async {
        guard canManageMembers else {
            accessRequests = []
            return
        }
        do {
            let response: HouseholdAccessRequestsResponse = try await api.request(
                HomeAdminEndpoints.householdAccessRequests(homeId: homeId)
            )
            accessRequests = response.requests
        } catch {
            accessRequests = []
        }
    }

    /// `GET /api/homes/:id/audit-log` — route
    /// `backend/routes/homeIam.js:602`. 403s for viewers without
    /// `members.manage`, so it is best-effort and never fails the screen.
    private func fetchAuditLog() async {
        guard canManageMembers else {
            auditEntries = []
            return
        }
        do {
            let response: HomeAuditLogResponse = try await api.request(
                HomeAdminEndpoints.auditLog(homeId: homeId)
            )
            auditEntries = response.entries
        } catch {
            auditEntries = []
        }
    }

    // MARK: - Buckets

    private var members: [OccupantDTO] {
        occupants.filter { !MemberRole.guestRoles.contains(MemberRole.parse($0.role)) }
    }

    private var guests: [OccupantDTO] {
        occupants.filter { MemberRole.guestRoles.contains(MemberRole.parse($0.role)) }
    }

    private var pending: [PendingInviteDTO] {
        pendingInvites
    }

    // MARK: - State projection

    private func applyState() {
        switch selectedTab {
        case MembersTab.requests:
            let rows = accessRequests.map { row(forRequest: $0) }
            state = rows.isEmpty
                ? .empty(emptyContent(for: MembersTab.requests))
                : .loaded(sections: [RowSection(id: "requests", rows: rows)], hasMore: false)
        case MembersTab.audit:
            let rows = auditEntries.map { row(forAudit: $0) }
            state = rows.isEmpty
                ? .empty(emptyContent(for: MembersTab.audit))
                : .loaded(sections: [RowSection(id: "audit", rows: rows)], hasMore: false)
        case MembersTab.guests:
            let rows = guests.map { row(forOccupant: $0) }
            state = rows.isEmpty
                ? .empty(emptyContent(for: MembersTab.guests))
                : .loaded(sections: [RowSection(id: "guests", rows: rows)], hasMore: false)
        case MembersTab.pending:
            let rows = pending.map { row(forPending: $0) }
            state = rows.isEmpty
                ? .empty(emptyContent(for: MembersTab.pending))
                : .loaded(sections: [RowSection(id: "pending", rows: rows)], hasMore: false)
        default:
            let rows = members.map { row(forOccupant: $0) }
            state = rows.isEmpty
                ? .empty(emptyContent(for: MembersTab.members))
                : .loaded(sections: [RowSection(id: "members", rows: rows)], hasMore: false)
        }
    }

    private func emptyContent(for tab: String) -> ListOfRowsState.EmptyContent {
        switch tab {
        case MembersTab.requests:
            // Review queue — no CTA, there is nothing for the owner to
            // create here. Copy mirrors RN's empty state.
            ListOfRowsState.EmptyContent(
                icon: .mailbox,
                headline: "No pending requests",
                subcopy: "When someone asks to join from the claim flow, their request appears here."
            )
        case MembersTab.audit:
            // Read-only history — no CTA. Copy mirrors RN's empty state
            // (`src/app/homes/[id]/members/index.tsx:385`).
            ListOfRowsState.EmptyContent(
                icon: .fileText,
                headline: "No audit log entries",
                subcopy: "Role changes, removals, guest passes, and ownership actions on this home show up here."
            )
        case MembersTab.guests:
            ListOfRowsState.EmptyContent(
                icon: .users,
                headline: "No active guests",
                subcopy: "Add someone short-term — a sitter, visitor, or contractor — to share access while they're around.",
                ctaTitle: "Add a guest"
            ) { @Sendable [weak self] in
                Task { @MainActor in self?.pendingEvent = .openAddGuest }
            }
        case MembersTab.pending:
            ListOfRowsState.EmptyContent(
                icon: .mailbox,
                headline: "No pending invites",
                subcopy: "Invitations you send to housemates appear here until they accept.",
                ctaTitle: "Send an invite"
            ) { @Sendable [weak self] in
                Task { @MainActor in self?.pendingEvent = .openInvite }
            }
        default:
            ListOfRowsState.EmptyContent(
                icon: .users,
                headline: "No members yet",
                subcopy: "Invite a housemate to share tasks, bills, calendar, and access codes for this home.",
                ctaTitle: "Invite someone"
            ) { @Sendable [weak self] in
                Task { @MainActor in self?.pendingEvent = .openInvite }
            }
        }
    }

    // MARK: - Permission projection

    /// What the viewer may do to this member, derived from the same rank
    /// rules the backend enforces so we never offer a doomed action.
    ///
    ///  - role change: `members.manage` + `assertCanMutateTarget`
    ///    (`backend/routes/homeIam.js:218`, `:224`)
    ///  - remove: self-leave is always allowed
    ///    (`backend/routes/homeIam.js:517`); otherwise `members.manage`
    ///    + rank, and the owner can never be removed (`:559`).
    public func actionTarget(for occ: OccupantDTO, name: String) -> MemberActionTarget {
        let isSelf = currentUserId != nil && occ.userId == currentUserId
        let assignable = canManageMembers
            ? HomeRoleAssignment.assignableRoles(
                actorRole: access?.roleBase,
                actorIsOwner: access?.isOwner ?? false,
                targetRole: occ.role,
                isSelf: isSelf
            )
            : []
        let targetIsOwner = occ.role?.lowercased() == "owner"
        let canRemove: Bool = if isSelf {
            true
        } else {
            canManageMembers
                && !targetIsOwner
                && HomeRoleAssignment.canMutate(
                    actorRole: (access?.isOwner ?? false) ? "owner" : access?.roleBase,
                    targetRole: occ.role
                )
        }
        return MemberActionTarget(
            userId: occ.userId,
            name: name,
            currentRole: occ.role,
            assignableRoles: assignable,
            canRemove: canRemove
        )
    }

    // MARK: - Row mapping (pure projections, public for tests)

    public func row(forOccupant occ: OccupantDTO) -> RowModel {
        let role = MemberRole.parse(occ.role)
        let palette = role.palette
        let name = Self.displayName(for: occ)
        let chipTint: RowChip.Tint = .custom(
            background: palette.background,
            foreground: palette.foreground
        )
        let bodyText = joinedText(for: occ)
        let target = actionTarget(for: occ, name: name)
        let hasActions = !target.assignableRoles.isEmpty || target.canRemove
        return RowModel(
            id: occ.userId,
            title: name,
            subtitle: role.label,
            template: .avatarKebab,
            leading: .avatarWithBadge(
                name: name,
                imageURL: Self.avatarURL(occ.avatarUrl),
                background: .gradient(MemberAvatarTone.tone(for: occ.userId).gradient),
                size: .medium,
                verified: true
            ),
            trailing: hasActions ? .kebab : .none,
            onTap: { /* Future: open member detail. */ },
            onSecondary: hasActions
                ? { @Sendable [weak self] in
                    Task { @MainActor in
                        self?.pendingEvent = .openMemberActions(target)
                    }
                }
                : nil,
            body: bodyText,
            subtitleIcon: role.icon,
            bodyIcon: bodyText == nil ? nil : .clock,
            inlineChip: RowChip(text: role.label, icon: role.icon, tint: chipTint)
        )
    }

    public func row(forPending invite: PendingInviteDTO) -> RowModel {
        let role = MemberRole.parse(invite.role)
        let palette = role.palette
        let name = invite.name
        let inviteId = invite.id
        let relative = Self.formatRelativeTime(
            invite.createdAt,
            now: now(),
            calendar: calendar,
            timeZone: timeZone
        ) ?? "recently"
        let invitedText = "Invited \(relative)"
        return RowModel(
            id: invite.id,
            title: name,
            subtitle: role.label,
            template: .statusChip,
            leading: .avatarWithBadge(
                name: name,
                imageURL: nil,
                background: .gradient(MemberAvatarTone.tone(for: invite.id).gradient),
                size: .medium,
                verified: false
            ),
            trailing: .verticalActions(
                primary: VerticalAction(label: "Resend", variant: .primary) { @Sendable [weak self] in
                    Task { @MainActor in await self?.resendInvite(inviteId: inviteId) }
                },
                secondary: VerticalAction(label: "Cancel", variant: .ghost) { @Sendable [weak self] in
                    Task { @MainActor in await self?.cancelInvite(inviteId: inviteId) }
                }
            ),
            body: invitedText,
            subtitleIcon: role.icon,
            bodyIcon: .mailbox,
            inlineChip: RowChip(
                text: role.label,
                icon: role.icon,
                tint: .custom(background: palette.background, foreground: palette.foreground)
            )
        )
    }

    /// Requests tab row — Invite / Decline stacked at the trailing edge,
    /// same vocabulary as the Pending tab's Resend / Cancel pair.
    public func row(forRequest request: HouseholdAccessRequestDTO) -> RowModel {
        let name = request.requesterDisplayName
        let requestId = request.id
        let identity = request.requestedIdentityLabel
        let relative = Self.formatRelativeTime(
            request.createdAt,
            now: now(),
            calendar: calendar,
            timeZone: timeZone
        ) ?? "recently"
        return RowModel(
            id: request.id,
            title: name,
            subtitle: "Wants to join as \(identity)",
            template: .statusChip,
            leading: .avatarWithBadge(
                name: name,
                imageURL: Self.avatarURL(request.requester?.profilePictureUrl),
                background: .gradient(MemberAvatarTone.tone(for: request.requesterUserId).gradient),
                size: .medium,
                verified: false
            ),
            trailing: .verticalActions(
                primary: VerticalAction(label: "Invite", variant: .primary) { @Sendable [weak self] in
                    Task { @MainActor in
                        self?.pendingEvent = .confirmApproveRequest(
                            requestId: requestId,
                            name: name
                        )
                    }
                },
                secondary: VerticalAction(label: "Decline", variant: .destructive) { @Sendable [weak self] in
                    Task { @MainActor in
                        self?.pendingEvent = .confirmDeclineRequest(
                            requestId: requestId,
                            name: name,
                            identity: identity
                        )
                    }
                }
            ),
            body: "Requested \(relative)",
            subtitleIcon: .userPlus,
            bodyIcon: .clock,
            inlineChip: RowChip(
                text: identity,
                icon: .home,
                tint: .custom(
                    background: Theme.Color.homeBg,
                    foreground: Theme.Color.home
                )
            )
        )
    }

    /// Audit-log row — action verb as the title, `actor → target` as the
    /// subtitle, and the timestamp as the trailing meta. Read-only: no
    /// tap target, no trailing control. Mirrors RN's audit card
    /// (`src/app/homes/[id]/members/index.tsx:387-399`).
    public func row(forAudit entry: HomeAuditEntryDTO) -> RowModel {
        let actor = entry.actorDisplayName
        let subtitle = entry.targetLabel.map { "\(actor) → \($0)" } ?? actor
        let stamp = Self.formatRelativeTime(
            entry.createdAt,
            now: now(),
            calendar: calendar,
            timeZone: timeZone
        )
        return RowModel(
            id: entry.id,
            title: entry.actionLabel,
            subtitle: subtitle,
            template: .statusChip,
            leading: .typeIcon(
                .fileText,
                background: Theme.Color.homeBg,
                foreground: Theme.Color.home
            ),
            trailing: .none,
            onTap: { /* Audit rows are read-only. */ },
            body: nil,
            subtitleIcon: .user,
            timeMeta: stamp
        )
    }

    // MARK: - Helpers (pure)

    static func displayName(for occ: OccupantDTO) -> String {
        if let name = occ.displayName?.nilIfEmpty { return name }
        if let username = occ.username?.nilIfEmpty { return "@\(username)" }
        return "Member"
    }

    static func avatarURL(_ raw: String?) -> URL? {
        guard let raw, !raw.isEmpty else { return nil }
        return URL(string: raw)
    }

    private func joinedText(for occ: OccupantDTO) -> String? {
        // Prefer joined_at, fall back to start_at or created_at.
        let raw = occ.joinedAt ?? occ.startAt ?? occ.createdAt
        guard let relative = Self.formatRelativeTime(
            raw,
            now: now(),
            calendar: calendar,
            timeZone: timeZone
        ) else {
            return nil
        }
        return "Joined \(relative)"
    }

    // MARK: - Date helpers (mirror Connections)

    private static let iso8601: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let iso8601NoFraction: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    private static func parseDate(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        return iso8601.date(from: raw) ?? iso8601NoFraction.date(from: raw)
    }

    public static func formatRelativeTime(
        _ raw: String?,
        now: Date,
        calendar: Calendar,
        timeZone: TimeZone
    ) -> String? {
        guard let date = parseDate(raw) else { return nil }
        let interval = now.timeIntervalSince(date)
        if interval < 60 { return "just now" }
        if interval < 3600 { return "\(Int(interval / 60))m ago" }
        if interval < 86400 { return "\(Int(interval / 3600))h ago" }
        var cal = calendar
        cal.timeZone = timeZone
        let startOfNow = cal.startOfDay(for: now)
        let startOfDate = cal.startOfDay(for: date)
        let dayDelta = cal.dateComponents([.day], from: startOfDate, to: startOfNow).day ?? 0
        if dayDelta == 1 { return "yesterday" }
        if dayDelta < 7 { return "\(dayDelta)d ago" }
        if dayDelta < 30 { return "\(dayDelta / 7)w ago" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
