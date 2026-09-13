// Per-Home member roster and invitation management. Members/Guests use current
// occupants; managers use the current-session sender invitation list so expired
// pending invitations remain withdrawable. Pending identities wrap fully above
// explicit Resend/Withdraw review actions. Access requests and audit are separate
// best-effort reads. Only the newest fetch in the opening session may publish.
// Opening removal recovery or starting a fresh read retires cached membership
// and authority; tab changes cannot restore an unconfirmed roster.

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
enum MembersListEvent: Equatable {
    case openResidencyReview
    case openInvite
    case openInvitationSender(HomeInvitationSenderTarget)
    case openMemberRemoval(HomeMemberRemovalTarget)
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
        guard canManageMembers else { return nil }
        return TopBarAction(icon: .gavel, accessibilityLabel: "Review residency claims") { @Sendable [weak self] in
            Task { @MainActor in self?.pendingEvent = .openResidencyReview }
        }
    }

    public var tabs: [ListOfRowsTab] {
        var out = [
            ListOfRowsTab(
                id: MembersTab.members,
                label: "Members",
                count: isCurrent && loadedOnce && fetchError == nil ? members.count : nil
            ),
            ListOfRowsTab(id: MembersTab.guests, label: "Guests", count: isCurrent && loadedOnce && fetchError == nil ? guests.count : nil),
            ListOfRowsTab(
                id: MembersTab.pending,
                label: "Pending",
                count: isCurrent && invitationsConfirmed && fetchError == nil ? pending.count : nil
            )
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
        guard canManageMembers else { return nil }
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
    var pendingEvent: MembersListEvent?

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
        isCurrent && (access?.canManageMembers ?? false)
    }

    // MARK: - Dependencies

    private let homeId: String
    private let api: APIClient
    private let now: @Sendable () -> Date
    private let calendar: Calendar
    private let timeZone: TimeZone
    private let currentUserId: String?
    private let session: HomeClaimSessionScope
    private let senderInvitations: (String, APIClient) async throws -> [PendingInviteDTO]

    private var occupants: [OccupantDTO] = []
    private var pendingInvites: [PendingInviteDTO] = []
    private var accessRequests: [HouseholdAccessRequestDTO] = []
    private var auditEntries: [HomeAuditEntryDTO] = []
    private var access: HomeAccessDTO?
    private var loadedOnce = false
    private var fetchGeneration = 0
    private var isFetching = false
    private var fetchError: String?
    private var invitationsConfirmed = false

    init(
        homeId: String,
        api: APIClient = .shared,
        now: @escaping @Sendable () -> Date = { Date() },
        calendar: Calendar = .current,
        timeZone: TimeZone = .current,
        currentUserId: String? = nil,
        senderInvitations: ((String, APIClient) async throws -> [PendingInviteDTO])? = nil,
        sessionIdentity: (() -> String?)? = nil
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
        self.senderInvitations = senderInvitations ?? HomeInvitationSenderListLoader.load
        session = HomeClaimSessionScope(api: api, identity: sessionIdentity)
    }

    /// Session user id, used to keep the always-allowed self-leave path
    /// available even to members who can't manage anyone else.
    static func signedInUserId() -> String? {
        if case let .signedIn(user) = AuthManager.shared.state { return user.id }
        return nil
    }

    // MARK: - ListOfRowsDataSource

    public func load() async {
        if isFetching || (loadedOnce && fetchError == nil && (selectedTab != MembersTab.pending || invitationsConfirmed)) { return }
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

    /// Opens a fresh reviewed command for another member or self leave.
    /// No membership write occurs until that protected review is confirmed.
    public func remove(userId: String) async {
        guard isCurrent, loadedOnce, fetchError == nil, let occupant = occupants.first(where: { $0.userId == userId }),
              actionTarget(for: occupant, name: Self.displayName(for: occupant)).canRemove else { return }
        pendingEvent = .openMemberRemoval(.init(homeId: homeId, userId: userId))
    }

    /// Withdrawal is an explicit invitation command. It never removes membership.
    public func cancelInvite(inviteId: String) async {
        guard canManageMembers, pendingInvites.contains(where: { $0.id == inviteId }) else { return }
        pendingEvent = .openInvitationSender(.init(action: .withdraw, invitationId: inviteId))
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

    /// Opens a fresh authority/terms review; only confirmation submits a resend.
    public func resendInvite(inviteId: String) async {
        guard canManageMembers, pendingInvites.contains(where: { $0.id == inviteId }) else { return }
        pendingEvent = .openInvitationSender(.init(action: .resend, invitationId: inviteId))
    }

    // MARK: - Fetch

    var isCurrent: Bool {
        session.isCurrent
    }

    /// A removal sheet may commit even when its reply is lost or the user
    /// closes without acknowledging. Keep its protected original separate from
    /// this reader, and require a new read before exposing membership again.
    func suspend() {
        fetchGeneration += 1
        isFetching = false
        clearCurrentRead()
    }

    func retire() {
        suspend()
        fetchError = HomeInvitationSenderError.sessionChanged.localizedDescription
        applyState()
    }

    private func clearCurrentRead() {
        loadedOnce = false
        access = nil
        occupants = []
        pendingInvites = []
        invitationsConfirmed = false
        accessRequests = []
        auditEntries = []
        fetchError = nil
        pendingEvent = nil
        state = .loading
    }

    private func requireCurrentFetch(_ generation: Int) throws {
        guard generation == fetchGeneration, !Task.isCancelled else { throw CancellationError() }
        guard isCurrent else { throw HomeInvitationSenderError.sessionChanged }
    }

    private func fetch() async {
        fetchGeneration += 1
        let generation = fetchGeneration
        isFetching = true
        clearCurrentRead()
        defer { if generation == fetchGeneration { isFetching = false } }
        do {
            try requireCurrentFetch(generation)
            // Keep every response local until all reads belong to the same
            // current fetch. Older access/queue replies cannot mutate the model.
            let accessResult = try? await api.request(HomeAdminEndpoints.myAccess(homeId: homeId), as: HomeAccessDTO.self)
            try requireCurrentFetch(generation)
            let response: OccupantsResponse = try await api.request(HomesEndpoints.listOccupants(homeId: homeId))
            try requireCurrentFetch(generation)
            let canManage = accessResult?.canManageMembers ?? false
            let currentInvitations = canManage ? try await senderInvitations(homeId, api) : []
            try requireCurrentFetch(generation)
            let requests = await fetchAccessRequests(canManage: canManage)
            try requireCurrentFetch(generation)
            let audit = await fetchAuditLog(canManage: canManage)
            try requireCurrentFetch(generation)
            access = accessResult
            occupants = response.occupants.filter(\.isActive)
            pendingInvites = currentInvitations
            invitationsConfirmed = canManage
            accessRequests = requests
            auditEntries = audit
            loadedOnce = true
            fetchError = nil
            if [MembersTab.requests, MembersTab.audit].contains(selectedTab), !canManageMembers {
                selectedTab = MembersTab.members
            }
            applyState()
        } catch {
            guard generation == fetchGeneration, !Task.isCancelled else { return }
            guard isCurrent else { retire()
                return
            }
            access = nil
            occupants = []
            pendingInvites = []
            invitationsConfirmed = false
            accessRequests = []
            auditEntries = []
            fetchError = (error as? APIError)?.errorDescription ?? (error as? HomeInvitationSenderError)?.localizedDescription
                ?? "Couldn't load members and invitations. Try again."
            applyState()
        }
    }

    /// Best-effort queues return values without publishing into another fetch.
    private func fetchAccessRequests(canManage: Bool) async -> [HouseholdAccessRequestDTO] {
        guard canManage else { return [] }
        let response = try? await api.request(
            HomeAdminEndpoints.householdAccessRequests(homeId: homeId),
            as: HouseholdAccessRequestsResponse.self
        )
        return response?.requests ?? []
    }

    private func fetchAuditLog(canManage: Bool) async -> [HomeAuditEntryDTO] {
        guard canManage else { return [] }
        let response = try? await api.request(HomeAdminEndpoints.auditLog(homeId: homeId), as: HomeAuditLogResponse.self)
        return response?.entries ?? []
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
        if let fetchError { state = .error(message: fetchError)
            return
        }
        guard loadedOnce else { state = .loading
            return
        }
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
            guard invitationsConfirmed else {
                state = .error(message: "Current invitation access is unavailable. Refresh to check your permission again.")
                return
            }
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
                ctaTitle: canManageMembers ? "Add a guest" : nil
            ) { @Sendable [weak self] in
                Task { @MainActor in self?.pendingEvent = .openAddGuest }
            }
        case MembersTab.pending:
            ListOfRowsState.EmptyContent(
                icon: .mailbox,
                headline: "No pending invites",
                subcopy: "Invitations you send to housemates appear here until they accept.",
                ctaTitle: canManageMembers ? "Invite member" : nil
            ) { @Sendable [weak self] in
                Task { @MainActor in self?.pendingEvent = .openInvite }
            }
        default:
            ListOfRowsState.EmptyContent(
                icon: .users,
                headline: "No members yet",
                subcopy: "Invite a housemate to share tasks, bills, calendar, and access codes for this home.",
                ctaTitle: canManageMembers ? "Invite someone" : nil
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
    ///  - removal: self may open a review; others require cached manage/rank.
    ///    The prepared server review and command enforce current permission,
    ///    target membership and ownership/transfer restrictions.
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
        let name = invite.name
        let inviteId = invite.id
        let relative = Self.formatRelativeTime(
            invite.createdAt,
            now: now(),
            calendar: calendar,
            timeZone: timeZone
        ) ?? "recently"
        let expired = invite.expiresAt.flatMap(HomeInvitationValidation.date).map { $0 <= now() } ?? false
        let invitedText = expired ? "Expired invitation · Invited \(relative)" : "Invited \(relative)"
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
            body: invitedText,
            subtitleIcon: role.icon,
            bodyIcon: .mailbox,
            footer: canManageMembers ? RowFooter(actions: [
                RowFooterAction(
                    title: "Resend",
                    variant: .primary,
                    identifier: "membersInvitationResend_" + inviteId
                ) { @Sendable [weak self] in
                    Task { @MainActor in await self?.resendInvite(inviteId: inviteId) }
                },
                RowFooterAction(
                    title: "Withdraw",
                    variant: .ghost,
                    identifier: "membersInvitationWithdraw_" + inviteId
                ) { @Sendable [weak self] in
                    Task { @MainActor in await self?.cancelInvite(inviteId: inviteId) }
                }
            ]) : nil,
            titleLineLimit: nil
        )
    }

    /// Requests tab row — Invite / Decline stacked at the trailing edge,
    /// separate from the Pending tab's reviewed Resend / Withdraw footer.
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
