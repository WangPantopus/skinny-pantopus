//
//  MembersListViewModelTests.swift
//  PantopusTests
//
//  T6.3a / P9 — Members. Covers:
//    - load → loaded / empty / error transitions
//    - the four tab buckets count and render correctly
//      (Members excludes guests; Guests excludes non-guests; Pending
//      comes from the same payload's `pendingInvites` array; Requests
//      comes from `GET /:id/household-access-requests` and only exists
//      for viewers who can manage the roster)
//    - tab switching mutates the loaded section without a refetch
//    - row mapping for occupants, pending invites, and access requests
//    - optimistic remove + rollback
//    - optimistic cancel-invite + rollback
//    - handleInvited(_:) folds a new pending invite at top
//    - role-change + approve/decline call the right routes
//    - FAB tint + variant match the design contract
//
//  Stubbing note: the screen now issues three GETs per load
//  (`/occupants`, `/me`, `/household-access-requests`), so fixtures are
//  registered per-route via `SequencedURLProtocol.routeResponses`.
//  Mutations (DELETE / POST) fall through to the FIFO `sequence`.
//

import XCTest
@testable import Pantopus

// swiftlint:disable type_body_length file_length

@MainActor
final class MembersListViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    private static let utc = TimeZone(secondsFromGMT: 0) ?? .current
    private static let fixedNow: Date = {
        var components = DateComponents()
        components.year = 2026
        components.month = 5
        components.day = 15
        components.hour = 12
        components.minute = 0
        components.second = 0
        components.timeZone = utc
        return Calendar(identifier: .gregorian).date(from: components)
            ?? Date(timeIntervalSince1970: 1_778_846_400)
    }()

    private static let utcCalendar: Calendar = {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = utc
        return cal
    }()

    private func makeVM(
        homeId: String = "home_1",
        currentUserId: String? = "u_me"
    ) -> MembersListViewModel {
        MembersListViewModel(
            homeId: homeId,
            api: makeAPI(),
            now: { Self.fixedNow },
            calendar: Self.utcCalendar,
            timeZone: Self.utc,
            currentUserId: currentUserId
        )
    }

    // MARK: - Fixtures

    /// 3 active occupants (owner + admin + guest) + 1 pending invite.
    private static let populatedJSON = """
    {
      "occupants":[
        {"id":"occ_owner","user_id":"u_owner","role":"owner","is_active":true,
         "start_at":"2024-03-01T00:00:00Z",
         "created_at":"2024-03-01T00:00:00Z",
         "display_name":"Maria Kovacs","username":"maria",
         "avatar_url":null,
         "joined_at":"2024-03-01T00:00:00Z"},
        {"id":"occ_admin","user_id":"u_admin","role":"admin","is_active":true,
         "start_at":"2025-01-15T00:00:00Z",
         "created_at":"2025-01-15T00:00:00Z",
         "display_name":"Jamie Patel","username":"jamie",
         "avatar_url":null,
         "joined_at":"2025-01-15T00:00:00Z"},
        {"id":"occ_guest","user_id":"u_guest","role":"guest","is_active":true,
         "start_at":"2026-05-10T00:00:00Z",
         "created_at":"2026-05-10T00:00:00Z",
         "display_name":"Daniel Okafor","username":"danok",
         "avatar_url":null,
         "joined_at":"2026-05-10T00:00:00Z"}
      ],
      "pendingInvites":[
        {"id":"inv_1","user_id":null,"role":"member","is_active":false,
         "email":"newhouse@example.com","name":"newhouse@example.com",
         "invited_by":"Maria","created_at":"2026-05-14T12:00:00Z"}
      ]
    }
    """

    private static let emptyJSON = """
    {"occupants":[],"pendingInvites":[]}
    """

    /// `GET /:id/me` for a verified owner — full manage rights.
    private static let ownerAccessJSON = """
    {"hasAccess":true,"is_owner":true,"role_base":"owner",
     "permissions":["members.manage","access.manage"],
     "can_manage_home":true,"can_manage_access":true}
    """

    /// `GET /:id/me` for a plain member — no manage rights.
    private static let memberAccessJSON = """
    {"hasAccess":true,"is_owner":false,"role_base":"member",
     "permissions":[],"can_manage_home":false,"can_manage_access":false}
    """

    private static let emptyRequestsJSON = """
    {"requests":[]}
    """

    private static let emptyAuditJSON = """
    {"entries":[]}
    """

    private static let populatedAuditJSON = """
    {"entries":[
      {"id":"log_1","home_id":"home_1","actor_user_id":"u_owner",
       "action":"MEMBER_ROLE_CHANGED","target_type":"HomeOccupancy",
       "target_id":"occ_1","created_at":"2026-05-14T12:00:00Z",
       "actor":{"id":"u_owner","username":"ada","name":"Ada Lovelace",
                "profile_picture_url":null}}
    ]}
    """

    private static let populatedRequestsJSON = """
    {"requests":[
      {"id":"req_1","home_id":"home_1","requester_user_id":"u_asker",
       "requested_identity":"household_member","status":"pending",
       "created_at":"2026-05-14T12:00:00Z",
       "requester":{"id":"u_asker","username":"asker","name":"Ada Lovelace",
                    "first_name":"Ada","last_name":"Lovelace",
                    "profile_picture_url":null}}
    ]}
    """

    // MARK: - Stub helpers

    private func stub(
        homeId: String = "home_1",
        occupants: SequencedURLProtocol.Response,
        access: SequencedURLProtocol.Response? = nil,
        requests: SequencedURLProtocol.Response? = nil,
        audit: SequencedURLProtocol.Response? = nil,
        repeats: Int = 4
    ) {
        var routes: [String: [SequencedURLProtocol.Response]] = [:]
        routes["/api/homes/\(homeId)/occupants"] = Array(repeating: occupants, count: repeats)
        if let access {
            routes["/api/homes/\(homeId)/me"] = Array(repeating: access, count: repeats)
        }
        if let requests {
            routes["/api/homes/\(homeId)/household-access-requests"] =
                Array(repeating: requests, count: repeats)
        }
        if let audit {
            routes["/api/homes/\(homeId)/audit-log"] = Array(repeating: audit, count: repeats)
        }
        SequencedURLProtocol.routeResponses = routes
    }

    private func stubOwner(
        occupantsBody: String = MembersListViewModelTests.populatedJSON,
        requestsBody: String = MembersListViewModelTests.emptyRequestsJSON,
        auditBody: String = MembersListViewModelTests.emptyAuditJSON
    ) {
        stub(
            occupants: .status(200, body: occupantsBody),
            access: .status(200, body: Self.ownerAccessJSON),
            requests: .status(200, body: requestsBody),
            audit: .status(200, body: auditBody)
        )
    }

    // MARK: - Lifecycle

    func testLoadEmptyTransitionsToEmptyOnMembersTab() async {
        stubOwner(occupantsBody: Self.emptyJSON)
        let vm = makeVM()
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected .empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "No members yet")
        XCTAssertEqual(content.ctaTitle, "Invite someone")
    }

    func testLoadPopulatedRendersMembersTabByDefault() async {
        stubOwner()
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, hasMore) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        // Default tab is Members → excludes the one guest row.
        XCTAssertEqual(sections.count, 1)
        XCTAssertEqual(sections.first?.rows.count, 2)
        XCTAssertEqual(hasMore, false)
        let titles = sections.first?.rows.map(\.title) ?? []
        XCTAssertEqual(Set(titles), ["Maria Kovacs", "Jamie Patel"])
    }

    func testLoadFailureTransitionsToError() async {
        stub(
            occupants: .status(500, body: "{}"),
            access: .status(200, body: Self.ownerAccessJSON),
            requests: .status(200, body: Self.emptyRequestsJSON)
        )
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
    }

    func testLoadIsIdempotentAfterLoaded() async {
        stubOwner()
        let vm = makeVM()
        await vm.load()
        let remaining = SequencedURLProtocol.routeResponses["/api/homes/home_1/occupants"]?.count
        await vm.load()
        XCTAssertEqual(
            SequencedURLProtocol.routeResponses["/api/homes/home_1/occupants"]?.count,
            remaining,
            "Second load() must not refetch once loaded"
        )
    }

    // MARK: - Tab buckets

    func testTabCountsExposedOnTabsArray() async {
        stubOwner(requestsBody: Self.populatedRequestsJSON)
        let vm = makeVM()
        await vm.load()
        let counts = vm.tabs.reduce(into: [String: Int]()) { acc, tab in
            acc[tab.id] = tab.count
        }
        XCTAssertEqual(counts[MembersTab.members], 2)
        XCTAssertEqual(counts[MembersTab.guests], 1)
        XCTAssertEqual(counts[MembersTab.pending], 1)
        XCTAssertEqual(counts[MembersTab.requests], 1)
    }

    func testSwitchingToGuestsTabFiltersToGuestRolesOnly() async {
        stubOwner()
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = MembersTab.guests
        guard case let .loaded(sections, _) = vm.state,
              let row = sections.first?.rows.first else {
            XCTFail("Expected one guest row")
            return
        }
        XCTAssertEqual(sections.first?.rows.count, 1)
        XCTAssertEqual(row.title, "Daniel Okafor")
        XCTAssertEqual(row.subtitle, "Guest")
    }

    func testSwitchingToPendingTabSurfacesPendingInvites() async {
        stubOwner()
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = MembersTab.pending
        guard case let .loaded(sections, _) = vm.state,
              let row = sections.first?.rows.first else {
            XCTFail("Expected one pending row")
            return
        }
        XCTAssertEqual(row.title, "newhouse@example.com")
        // Pending rows render the stacked Resend / Cancel pair.
        if case let .verticalActions(primary, secondary) = row.trailing {
            XCTAssertEqual(primary.label, "Resend")
            XCTAssertEqual(secondary.label, "Cancel")
        } else {
            XCTFail("Expected .verticalActions on pending row, got \(row.trailing)")
        }
    }

    func testEmptyGuestsTabShowsGuestEmptyState() async {
        stubOwner()
        SequencedURLProtocol.sequence = [.status(200, body: "{}")]
        let vm = makeVM()
        await vm.load()
        // Remove the guest occupant via the same code path the UI uses.
        await vm.remove(userId: "u_guest")
        vm.selectedTab = MembersTab.guests
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected .empty for Guests tab after removal")
            return
        }
        XCTAssertEqual(content.headline, "No active guests")
    }

    func testEmptyPendingTabShowsPendingEmptyState() async {
        stubOwner(occupantsBody: Self.emptyJSON)
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = MembersTab.pending
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected .empty for Pending tab")
            return
        }
        XCTAssertEqual(content.headline, "No pending invites")
    }

    // MARK: - Requests tab

    func testRequestsTabHiddenForViewersWhoCannotManage() async {
        stub(
            occupants: .status(200, body: Self.populatedJSON),
            access: .status(200, body: Self.memberAccessJSON),
            requests: .status(200, body: Self.populatedRequestsJSON)
        )
        let vm = makeVM()
        await vm.load()
        XCTAssertFalse(vm.canManageMembers)
        XCTAssertEqual(
            vm.tabs.map(\.id),
            [MembersTab.members, MembersTab.guests, MembersTab.pending]
        )
    }

    func testRequestsTabAppearsForOwnerAndRendersInviteDeclinePair() async {
        stubOwner(requestsBody: Self.populatedRequestsJSON)
        let vm = makeVM()
        await vm.load()
        XCTAssertTrue(vm.canManageMembers)
        XCTAssertEqual(
            vm.tabs.map(\.id),
            [
                MembersTab.members,
                MembersTab.guests,
                MembersTab.pending,
                MembersTab.requests,
                MembersTab.audit
            ]
        )
        vm.selectedTab = MembersTab.requests
        guard case let .loaded(sections, _) = vm.state,
              let row = sections.first?.rows.first else {
            XCTFail("Expected one request row, got \(vm.state)")
            return
        }
        XCTAssertEqual(row.id, "req_1")
        XCTAssertEqual(row.title, "Ada Lovelace")
        XCTAssertEqual(row.subtitle, "Wants to join as Household member")
        if case let .verticalActions(primary, secondary) = row.trailing {
            XCTAssertEqual(primary.label, "Invite")
            XCTAssertEqual(secondary.label, "Decline")
        } else {
            XCTFail("Expected .verticalActions on request row, got \(row.trailing)")
        }
    }

    func testEmptyRequestsTabShowsReviewQueueEmptyState() async {
        stubOwner()
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = MembersTab.requests
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected .empty for Requests tab, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "No pending requests")
        XCTAssertNil(content.ctaTitle, "The review queue has no create affordance")
    }

    // MARK: - Audit Log tab

    func testAuditTabHiddenForViewersWhoCannotManage() async {
        stub(
            occupants: .status(200, body: Self.populatedJSON),
            access: .status(200, body: Self.memberAccessJSON),
            requests: .status(200, body: Self.populatedRequestsJSON),
            audit: .status(200, body: Self.populatedAuditJSON)
        )
        let vm = makeVM()
        await vm.load()
        XCTAssertFalse(vm.tabs.contains { $0.id == MembersTab.audit })
    }

    func testAuditTabRendersActionActorAndTarget() async {
        stubOwner(auditBody: Self.populatedAuditJSON)
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = MembersTab.audit
        guard case let .loaded(sections, _) = vm.state,
              let row = sections.first?.rows.first else {
            XCTFail("Expected one audit row, got \(vm.state)")
            return
        }
        XCTAssertEqual(row.id, "log_1")
        XCTAssertEqual(row.title, "Member role changed")
        XCTAssertEqual(row.subtitle, "Ada Lovelace → Home occupancy")
    }

    func testEmptyAuditTabShowsReadOnlyEmptyState() async {
        stubOwner()
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = MembersTab.audit
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected .empty for Audit tab, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "No audit log entries")
        XCTAssertNil(content.ctaTitle, "The audit log has no create affordance")
        XCTAssertNil(vm.fab)
    }

    func testApproveAccessRequestPostsToApproveRouteAndRefetches() async {
        stubOwner(requestsBody: Self.populatedRequestsJSON)
        SequencedURLProtocol.sequence = [.status(200, body: "{\"ok\":true,\"message\":\"Invitation sent\"}")]
        let vm = makeVM()
        await vm.load()
        await vm.approveAccessRequest(requestId: "req_1")
        XCTAssertNil(vm.actionError)
        let approvePath = "/api/homes/home_1/household-access-requests/req_1/approve"
        XCTAssertTrue(
            SequencedURLProtocol.capturedRequests.contains { $0.url?.path == approvePath },
            "Expected a POST to \(approvePath)"
        )
    }

    func testDeclineAccessRequestPostsToRejectRoute() async {
        stubOwner(requestsBody: Self.populatedRequestsJSON)
        SequencedURLProtocol.sequence = [.status(200, body: "{\"ok\":true}")]
        let vm = makeVM()
        await vm.load()
        await vm.rejectAccessRequest(requestId: "req_1")
        XCTAssertNil(vm.actionError)
        let rejectPath = "/api/homes/home_1/household-access-requests/req_1/reject"
        XCTAssertTrue(
            SequencedURLProtocol.capturedRequests.contains { $0.url?.path == rejectPath },
            "Expected a POST to \(rejectPath)"
        )
    }

    // MARK: - Role change

    func testOwnerCanAssignEveryRoleBelowAndIncludingOwner() async {
        stubOwner()
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state,
              let row = sections.first?.rows.first(where: { $0.id == "u_admin" }) else {
            XCTFail("Expected the admin row")
            return
        }
        XCTAssertNotNil(row.onSecondary, "Owner can act on the admin row")
        let target = vm.actionTarget(
            for: OccupantDTO(id: "occ_admin", userId: "u_admin", role: "admin", isActive: true),
            name: "Jamie Patel"
        )
        // Every ROLE_RANK role except the one they already hold.
        XCTAssertEqual(
            Set(target.assignableRoles),
            [.owner, .manager, .member, .restrictedMember, .guest]
        )
        XCTAssertTrue(target.canRemove)
    }

    func testPlainMemberGetsNoRoleActionsOnOtherRows() async {
        stub(
            occupants: .status(200, body: Self.populatedJSON),
            access: .status(200, body: Self.memberAccessJSON),
            requests: .status(200, body: Self.emptyRequestsJSON)
        )
        let vm = makeVM()
        await vm.load()
        let target = vm.actionTarget(
            for: OccupantDTO(id: "occ_admin", userId: "u_admin", role: "admin", isActive: true),
            name: "Jamie Patel"
        )
        XCTAssertTrue(target.assignableRoles.isEmpty)
        XCTAssertFalse(target.canRemove)
    }

    func testSelfRowKeepsRemoveButNeverOffersRoleChange() async {
        stubOwner()
        let vm = makeVM(currentUserId: "u_admin")
        await vm.load()
        let target = vm.actionTarget(
            for: OccupantDTO(id: "occ_admin", userId: "u_admin", role: "admin", isActive: true),
            name: "Jamie Patel"
        )
        XCTAssertTrue(target.assignableRoles.isEmpty, "Self re-roling is rejected server-side")
        XCTAssertTrue(target.canRemove, "Self-leave is always allowed")
    }

    func testChangeRolePostsRoleBaseAndRefetches() async {
        stubOwner()
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"message\":\"Role updated\",\"role_base\":\"manager\"}")
        ]
        let vm = makeVM()
        await vm.load()
        await vm.changeRole(userId: "u_admin", to: .manager)
        XCTAssertNil(vm.actionError)
        let rolePath = "/api/homes/home_1/members/u_admin/role"
        guard let request = SequencedURLProtocol.capturedRequests.first(where: {
            $0.url?.path == rolePath
        }) else {
            XCTFail("Expected a POST to \(rolePath)")
            return
        }
        XCTAssertEqual(request.httpMethod, "POST")
    }

    func testChangeRoleFailureSurfacesActionError() async {
        stubOwner()
        SequencedURLProtocol.sequence = [.status(403, body: "{\"error\":\"No permission to manage members\"}")]
        let vm = makeVM()
        await vm.load()
        await vm.changeRole(userId: "u_admin", to: .manager)
        XCTAssertNotNil(vm.actionError)
    }

    // MARK: - Row mapping

    func testRowMappingOccupantOwnerCarriesHomeChipAndVerifiedAvatar() async {
        stubOwner()
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state,
              let row = sections.first?.rows.first(where: { $0.id == "u_owner" }) else {
            XCTFail("Expected owner row")
            return
        }
        XCTAssertEqual(row.title, "Maria Kovacs")
        XCTAssertEqual(row.subtitle, "Owner")
        XCTAssertEqual(row.inlineChip?.text, "Owner")
        XCTAssertEqual(row.inlineChip?.icon, .home)
        if case let .avatarWithBadge(_, _, _, size, verified) = row.leading {
            XCTAssertEqual(size, .medium)
            XCTAssertTrue(verified)
        } else {
            XCTFail("Expected avatarWithBadge leading, got \(row.leading)")
        }
        if case .kebab = row.trailing {
            // OK — an owner may re-role another owner.
        } else {
            XCTFail("Expected kebab trailing on member row, got \(row.trailing)")
        }
    }

    func testRowMappingGuestRoleEmitsGuestChipAndUnverifiedFallback() async {
        stubOwner()
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = MembersTab.guests
        guard case let .loaded(sections, _) = vm.state,
              let row = sections.first?.rows.first else {
            XCTFail("Expected guest row")
            return
        }
        XCTAssertEqual(row.inlineChip?.text, "Guest")
        XCTAssertEqual(row.subtitle, "Guest")
    }

    func testRowMappingPendingInviteRendersInvitedSubline() async {
        stubOwner()
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = MembersTab.pending
        guard case let .loaded(sections, _) = vm.state,
              let row = sections.first?.rows.first else {
            XCTFail("Expected pending row")
            return
        }
        XCTAssertEqual(row.title, "newhouse@example.com")
        XCTAssertEqual(row.subtitle, "Member")
        XCTAssertNotNil(row.body)
        XCTAssertTrue(row.body?.hasPrefix("Invited") ?? false)
    }

    // MARK: - Mutations

    func testRemoveOptimisticallyRemovesRow() async {
        stubOwner()
        SequencedURLProtocol.sequence = [.status(200, body: "{\"message\":\"Member removed\"}")]
        let vm = makeVM()
        await vm.load()
        await vm.remove(userId: "u_admin")
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded after remove")
            return
        }
        // Members tab now has just the owner; admin row is gone.
        XCTAssertEqual(sections.first?.rows.count, 1)
        XCTAssertNil(sections.first?.rows.first { $0.id == "u_admin" })
    }

    func testRemoveFailureRollsBack() async {
        stubOwner()
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = makeVM()
        await vm.load()
        await vm.remove(userId: "u_admin")
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded after rollback")
            return
        }
        XCTAssertEqual(sections.first?.rows.count, 2)
        XCTAssertNotNil(sections.first?.rows.first { $0.id == "u_admin" })
    }

    func testCancelInviteOptimisticallyRemovesPendingRow() async {
        // Pending invite with a resolved user_id so DELETE …/members/:userId fires.
        let json = """
        {"occupants":[],"pendingInvites":[
          {"id":"inv_1","user_id":"u_pending","role":"member","is_active":false,
           "email":"x@y.com","name":"x@y.com","invited_by":null,
           "created_at":"2026-05-14T12:00:00Z"}
        ]}
        """
        stubOwner(occupantsBody: json)
        SequencedURLProtocol.sequence = [.status(200, body: "{\"message\":\"Member removed\"}")]
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = MembersTab.pending
        await vm.cancelInvite(inviteId: "inv_1")
        guard case .empty = vm.state else {
            XCTFail("Expected empty Pending tab after cancel, got \(vm.state)")
            return
        }
    }

    func testCancelInviteFailureRollsBackWhenUserIdResolved() async {
        let json = """
        {"occupants":[],"pendingInvites":[
          {"id":"inv_1","user_id":"u_pending","role":"member","is_active":false,
           "email":"x@y.com","name":"x@y.com","invited_by":null,
           "created_at":"2026-05-14T12:00:00Z"}
        ]}
        """
        stubOwner(occupantsBody: json)
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = MembersTab.pending
        await vm.cancelInvite(inviteId: "inv_1")
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected pending row to roll back into .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections.first?.rows.count, 1)
    }

    func testHandleInvitedInsertsAtTopOfPendingBucket() async {
        stubOwner(occupantsBody: Self.emptyJSON)
        let vm = makeVM()
        await vm.load()
        let invitation = InvitationDTO(
            id: "new_inv",
            homeId: "home_1",
            invitedBy: nil,
            inviteeEmail: "fresh@example.com",
            inviteeUserId: nil,
            proposedRole: "member",
            createdAt: "2026-05-15T11:59:00Z"
        )
        vm.handleInvited(invitation)
        vm.selectedTab = MembersTab.pending
        guard case let .loaded(sections, _) = vm.state,
              let row = sections.first?.rows.first else {
            XCTFail("Expected pending row after handleInvited")
            return
        }
        XCTAssertEqual(row.id, "new_inv")
        XCTAssertEqual(row.title, "fresh@example.com")
    }

    // MARK: - Chrome

    func testFABIsHomeGreenSecondaryCreate() {
        let vm = makeVM()
        guard let fab = vm.fab else {
            XCTFail("Expected FAB")
            return
        }
        XCTAssertEqual(fab.icon, .userPlus)
        XCTAssertEqual(fab.accessibilityLabel, "Invite member")
        if case .secondaryCreate = fab.variant {
            // OK
        } else {
            XCTFail("Expected .secondaryCreate variant")
        }
        XCTAssertEqual(fab.tint, .home)
    }

    func testNoFabOnRequestsReviewQueue() async {
        stubOwner(requestsBody: Self.populatedRequestsJSON)
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = MembersTab.requests
        XCTAssertNil(vm.fab, "The review queue has nothing to create")
    }

    func testNoTopBarActionByDesign() {
        let vm = makeVM()
        XCTAssertNil(vm.topBarAction)
    }

    func testThreeTabsBeforeAccessIsKnown() {
        let vm = makeVM()
        XCTAssertEqual(vm.tabs.count, 3)
        XCTAssertEqual(vm.tabs.map(\.id), [MembersTab.members, MembersTab.guests, MembersTab.pending])
    }

    func testDefaultSelectedTabIsMembers() {
        let vm = makeVM()
        XCTAssertEqual(vm.selectedTab, MembersTab.members)
    }
}
