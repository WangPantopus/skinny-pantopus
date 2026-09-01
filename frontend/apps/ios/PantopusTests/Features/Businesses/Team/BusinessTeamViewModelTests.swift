//
//  BusinessTeamViewModelTests.swift
//  PantopusTests
//
//  B2C — Business team & roles. Covers:
//    - load → loaded (members grouped by role, owner→viewer order) /
//      empty / error transitions
//    - pending-invites section sourced from the seats list (pending only)
//    - action gating from GET /:id/me (owner can manage/invite; a viewer
//      with only team.view cannot)
//    - optimistic change-role (re-groups) + rollback
//    - optimistic remove + rollback
//    - optimistic cancel-invite + rollback
//    - handleInvited(_:) folds a new pending seat at top
//
//  The VM fetches sequentially: /me → /members → /seats → /role-presets,
//  so the stub sequence is ordered to match.
//

import XCTest
@testable import Pantopus

@MainActor
final class BusinessTeamViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    private static let utc = TimeZone(secondsFromGMT: 0) ?? .current
    private static let fixedNow = Date(timeIntervalSince1970: 1_778_846_400) // 2026-05-15T12:00:00Z

    private static let utcCalendar: Calendar = {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = utc
        return cal
    }()

    private func makeVM(businessId: String = "biz_1") -> BusinessTeamViewModel {
        let fixedNow = Self.fixedNow
        return BusinessTeamViewModel(
            businessId: businessId,
            api: makeAPI(),
            now: { fixedNow },
            calendar: Self.utcCalendar,
            timeZone: Self.utc
        )
    }

    // MARK: - Fixtures

    private static let accessOwner = """
    {"hasAccess":true,"isOwner":true,"role_base":"owner",
     "permissions":["team.view","team.manage","team.invite"]}
    """

    private static let accessViewer = """
    {"hasAccess":true,"isOwner":false,"role_base":"viewer",
     "permissions":["team.view"]}
    """

    /// owner + admin + editor
    private static let membersJSON = """
    {"members":[
      {"id":"t_owner","role_base":"owner","title":"Founder","joined_at":"2024-03-01T00:00:00Z",
       "user":{"id":"u_owner","username":"maria","name":"Maria Kovacs","email":"maria@x.com","profile_picture_url":null}},
      {"id":"t_admin","role_base":"admin","title":null,"joined_at":"2025-01-15T00:00:00Z",
       "user":{"id":"u_admin","username":"jamie","name":"Jamie Patel","email":"jamie@x.com","profile_picture_url":null}},
      {"id":"t_editor","role_base":"editor","joined_at":"2025-06-01T00:00:00Z",
       "user":{"id":"u_editor","username":"sam","name":"Sam Lee","email":"sam@x.com","profile_picture_url":null}}
    ]}
    """

    /// one pending seat + one accepted seat (accepted must be dropped)
    private static let seatsJSON = """
    {"seats":[
      {"id":"s_pending","display_name":"Front Desk","role_base":"viewer","invite_status":"pending",
       "invite_email":"fd@x.com","created_at":"2026-05-14T12:00:00Z","is_you":false},
      {"id":"s_accepted","display_name":"Bound","role_base":"staff","invite_status":"accepted",
       "invite_email":"acc@x.com","created_at":"2025-01-01T00:00:00Z","is_you":false}
    ]}
    """

    private static let presetsJSON = """
    {"presets":[
      {"key":"business_admin","display_name":"Administrator","description":"Manages the team",
       "role_base":"admin","icon_key":"shield","sort_order":20},
      {"key":"read_only","display_name":"Viewer","description":"Read-only",
       "role_base":"viewer","icon_key":"eye","sort_order":50}
    ]}
    """

    private static let emptyMembers = "{\"members\":[]}"
    private static let emptySeats = "{\"seats\":[]}"
    private static let okMessage = "{\"message\":\"ok\"}"

    /// Happy-path load sequence: /me → /members → /seats → /role-presets.
    private func happyPath(
        access: String = BusinessTeamViewModelTests.accessOwner,
        members: String = BusinessTeamViewModelTests.membersJSON,
        seats: String = BusinessTeamViewModelTests.seatsJSON,
        presets: String = BusinessTeamViewModelTests.presetsJSON
    ) -> [SequencedURLProtocol.Response] {
        [
            .status(200, body: access),
            .status(200, body: members),
            .status(200, body: seats),
            .status(200, body: presets)
        ]
    }

    // MARK: - Lifecycle

    func testLoadGroupsMembersByRoleInOwnerToViewerOrder() async {
        SequencedURLProtocol.sequence = happyPath()
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected .loaded, got \(vm.state)")
        }
        XCTAssertEqual(content.sections.map(\.role), [.owner, .admin, .editor])
        XCTAssertEqual(content.sections.map(\.rows.count), [1, 1, 1])
        XCTAssertEqual(content.sections.first?.rows.first?.name, "Maria Kovacs")
        XCTAssertEqual(content.sections.first?.rows.first?.email, "maria@x.com")
    }

    func testPendingSectionKeepsOnlyPendingSeats() async {
        SequencedURLProtocol.sequence = happyPath()
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected .loaded")
        }
        XCTAssertEqual(content.pending.count, 1)
        XCTAssertEqual(content.pending.first?.seatId, "s_pending")
        XCTAssertEqual(content.pending.first?.name, "Front Desk")
        XCTAssertEqual(content.pending.first?.role, .viewer)
    }

    func testLoadMembersFailureTransitionsToError() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.accessOwner),
            .status(500, body: "{}")
        ]
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            return XCTFail("Expected .error, got \(vm.state)")
        }
    }

    func testLoadAccessFailureTransitionsToError() async {
        SequencedURLProtocol.sequence = [.status(403, body: "{\"hasAccess\":false}")]
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            return XCTFail("Expected .error, got \(vm.state)")
        }
    }

    func testLoadEmptyTransitionsToEmpty() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.accessOwner),
            .status(200, body: Self.emptyMembers),
            .status(200, body: Self.emptySeats),
            .status(200, body: Self.presetsJSON)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .empty(canInvite) = vm.state else {
            return XCTFail("Expected .empty, got \(vm.state)")
        }
        XCTAssertTrue(canInvite)
    }

    func testLoadIsIdempotentAfterLoaded() async {
        SequencedURLProtocol.sequence = happyPath() + [.status(200, body: Self.okMessage)]
        let vm = makeVM()
        await vm.load()
        await vm.load()
        // Only the first load's four requests fired; one sentinel remains.
        XCTAssertEqual(SequencedURLProtocol.sequence.count, 1)
    }

    // MARK: - Gating

    func testOwnerCanManageAndInvite() async {
        SequencedURLProtocol.sequence = happyPath()
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected .loaded")
        }
        XCTAssertTrue(content.canManage)
        XCTAssertTrue(content.canInvite)
        // Owner row itself is never manageable; admin row is.
        let ownerRow = content.sections.first { $0.role == .owner }?.rows.first
        let adminRow = content.sections.first { $0.role == .admin }?.rows.first
        XCTAssertEqual(ownerRow?.canManage, false)
        XCTAssertEqual(adminRow?.canManage, true)
    }

    func testViewerCannotManageOrInvite() async {
        SequencedURLProtocol.sequence = happyPath(access: Self.accessViewer)
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected .loaded")
        }
        XCTAssertFalse(content.canManage)
        XCTAssertFalse(content.canInvite)
        let adminRow = content.sections.first { $0.role == .admin }?.rows.first
        XCTAssertEqual(adminRow?.canManage, false)
        XCTAssertEqual(content.pending.first?.canManage, false)
    }

    // MARK: - Change role

    func testChangeRoleOptimisticallyReGroups() async {
        SequencedURLProtocol.sequence = happyPath() + [.status(200, body: Self.okMessage)]
        let vm = makeVM()
        await vm.load()
        let toViewer = BusinessRolePresetDTO(
            key: "read_only",
            displayName: "Viewer",
            description: "Read-only",
            roleBase: "viewer",
            iconKey: "eye",
            sortOrder: 50
        )
        await vm.changeRole(userId: "u_admin", preset: toViewer)
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected .loaded")
        }
        // Admin section is gone; the admin now sits in a viewer section.
        XCTAssertNil(content.sections.first { $0.role == .admin })
        let viewerRow = content.sections.first { $0.role == .viewer }?.rows.first { $0.userId == "u_admin" }
        XCTAssertNotNil(viewerRow)
        XCTAssertEqual(viewerRow?.role, .viewer)
    }

    func testChangeRoleFailureRollsBack() async {
        SequencedURLProtocol.sequence = happyPath() + [.status(500, body: "{}")]
        let vm = makeVM()
        await vm.load()
        let toViewer = BusinessRolePresetDTO(
            key: "read_only",
            displayName: "Viewer",
            description: "Read-only",
            roleBase: "viewer",
            iconKey: "eye",
            sortOrder: 50
        )
        await vm.changeRole(userId: "u_admin", preset: toViewer)
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected .loaded")
        }
        XCTAssertNotNil(content.sections.first { $0.role == .admin }?.rows.first { $0.userId == "u_admin" })
        XCTAssertNil(content.sections.first { $0.role == .viewer })
    }

    // MARK: - Remove

    func testRemoveOptimisticallyRemovesRow() async {
        SequencedURLProtocol.sequence = happyPath() + [.status(200, body: Self.okMessage)]
        let vm = makeVM()
        await vm.load()
        await vm.remove(userId: "u_editor")
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected .loaded")
        }
        XCTAssertNil(content.sections.first { $0.role == .editor })
        XCTAssertEqual(content.sections.map(\.role), [.owner, .admin])
    }

    func testRemoveFailureRollsBack() async {
        SequencedURLProtocol.sequence = happyPath() + [.status(500, body: "{}")]
        let vm = makeVM()
        await vm.load()
        await vm.remove(userId: "u_editor")
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected .loaded")
        }
        XCTAssertNotNil(content.sections.first { $0.role == .editor })
    }

    // MARK: - Cancel invite

    func testCancelInviteOptimisticallyRemovesPending() async {
        SequencedURLProtocol.sequence = happyPath() + [.status(200, body: Self.okMessage)]
        let vm = makeVM()
        await vm.load()
        await vm.cancelInvite(seatId: "s_pending")
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected .loaded")
        }
        XCTAssertTrue(content.pending.isEmpty)
    }

    func testCancelInviteFailureRollsBack() async {
        SequencedURLProtocol.sequence = happyPath() + [.status(500, body: "{}")]
        let vm = makeVM()
        await vm.load()
        await vm.cancelInvite(seatId: "s_pending")
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected .loaded")
        }
        XCTAssertEqual(content.pending.count, 1)
    }

    // MARK: - handleInvited

    func testHandleInvitedFoldsPendingAtTop() async {
        SequencedURLProtocol.sequence = happyPath()
        let vm = makeVM()
        await vm.load()
        let seat = BusinessSeatDTO(
            id: "s_new",
            displayName: "New Hire",
            roleBase: "staff",
            inviteStatus: "pending",
            inviteEmail: "new@x.com",
            createdAt: "2026-05-15T11:59:00Z",
            isYou: false
        )
        vm.handleInvited(seat)
        guard case let .loaded(content) = vm.state else {
            return XCTFail("Expected .loaded")
        }
        XCTAssertEqual(content.pending.first?.seatId, "s_new")
        XCTAssertEqual(content.pending.count, 2)
    }

    // MARK: - Pure helpers

    func testDisplayNameFallsBackToUsernameThenEmail() {
        let withName = BusinessTeamMemberDTO(
            id: "1",
            roleBase: "staff",
            user: BusinessTeamUserDTO(id: "u", username: "u", name: "Real Name", email: "e@x.com")
        )
        XCTAssertEqual(BusinessTeamViewModel.displayName(for: withName), "Real Name")

        let usernameOnly = BusinessTeamMemberDTO(
            id: "2",
            roleBase: "staff",
            user: BusinessTeamUserDTO(id: "u", username: "handle", name: nil, email: nil)
        )
        XCTAssertEqual(BusinessTeamViewModel.displayName(for: usernameOnly), "@handle")

        let emailOnly = BusinessTeamMemberDTO(
            id: "3",
            roleBase: "staff",
            user: BusinessTeamUserDTO(id: "u", username: nil, name: nil, email: "only@x.com")
        )
        XCTAssertEqual(BusinessTeamViewModel.displayName(for: emailOnly), "only@x.com")
    }

    func testRoleParseAndRank() {
        XCTAssertEqual(BusinessRole.parse("admin"), .admin)
        XCTAssertEqual(BusinessRole.parse("unknown"), .viewer)
        XCTAssertEqual(BusinessRole.parse(nil), .viewer)
        XCTAssertGreaterThan(BusinessRole.owner.rank, BusinessRole.admin.rank)
        XCTAssertGreaterThan(BusinessRole.admin.rank, BusinessRole.viewer.rank)
    }
}
