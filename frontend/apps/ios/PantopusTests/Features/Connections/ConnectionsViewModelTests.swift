//
//  ConnectionsViewModelTests.swift
//  PantopusTests
//
//  T5.2.3 — Connections. Covers:
//    - load → loaded / empty / error transitions
//    - tabs expose All / Neighbors / Pending counts
//    - Neighbors filters out users without a city
//    - search filters across name / username / city
//    - accept optimistically removes pending and bumps All count;
//      rolls back on failure
//    - reject optimistically removes pending; rolls back on failure
//    - row mapping (avatar verified flag, message-CTA target,
//      Pending vertical-action handlers)
//

import XCTest
@testable import Pantopus

// swiftlint:disable file_length type_body_length

@MainActor
final class ConnectionsViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
        _ = DeepLinkRouter.shared.consume()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    private static let utc = TimeZone(secondsFromGMT: 0) ?? .current

    /// Fixed clock so date-formatted bodies are deterministic.
    /// 2026-05-15 12:00:00 UTC — Friday.
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
        api: APIClient? = nil,
        onMessage: @escaping @MainActor (ConnectionsChatTarget) -> Void = { _ in },
        onFindPeople: @escaping @MainActor () -> Void = {}
    ) -> ConnectionsViewModel {
        ConnectionsViewModel(
            api: api ?? makeAPI(),
            onMessage: onMessage,
            onFindPeople: onFindPeople,
            now: { Self.fixedNow },
            calendar: Self.utcCalendar,
            timeZone: Self.utc
        )
    }

    private typealias StubResponse = SequencedURLProtocol.Response

    private func stubConnections(
        accepted: StubResponse,
        pending: StubResponse,
        sent: StubResponse = .status(200, body: "{\"requests\":[]}"),
        blocked: StubResponse = .status(200, body: "{\"blocked\":[]}"),
        actions: [StubResponse] = []
    ) {
        SequencedURLProtocol.routeResponses = [
            "/api/relationships": [accepted],
            "/api/relationships/requests/pending": [pending],
            // S5 — the Sent + Blocked tabs fetch in the same fan-out, so
            // they need stubs or they'd eat the `actions` sequence.
            "/api/relationships/requests/sent": [sent],
            "/api/relationships/blocked": [blocked]
        ]
        SequencedURLProtocol.sequence = actions
    }

    private static let acceptedJSON = """
    {"relationships":[
      {"id":"r1","status":"accepted",
       "created_at":"2026-05-12T10:00:00Z",
       "accepted_at":"2026-05-12T11:00:00Z",
       "direction":"received",
       "other_user":{"id":"u_a","username":"maria","name":"Maria Kovacs",
                      "first_name":"Maria","last_name":"Kovacs",
                      "profile_picture_url":null,"city":"Elm Park","state":"OR"}},
      {"id":"r2","status":"accepted",
       "created_at":"2026-05-13T10:00:00Z",
       "accepted_at":"2026-05-13T10:05:00Z",
       "direction":"sent",
       "other_user":{"id":"u_b","username":"davidc","name":"David Chen",
                      "first_name":"David","last_name":"Chen",
                      "profile_picture_url":null,"city":null,"state":null}}
    ]}
    """

    private static let pendingJSON = """
    {"requests":[
      {"id":"req1","status":"pending","created_at":"2026-05-15T11:30:00Z",
       "requester":{"id":"u_c","username":"priya","name":"Priya Shah",
                     "first_name":"Priya","last_name":"Shah",
                     "profile_picture_url":null,"city":"Burnside","state":"OR"}}
    ]}
    """

    private static let emptyAcceptedJSON = """
    {"relationships":[]}
    """

    private static let emptyPendingJSON = """
    {"requests":[]}
    """

    // MARK: - Lifecycle

    func testLoadEmptyTransitionsToEmptyAllTab() async {
        stubConnections(
            accepted: .status(200, body: Self.emptyAcceptedJSON),
            pending: .status(200, body: Self.emptyPendingJSON)
        )
        let vm = makeVM()
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected .empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "No connections yet")
        XCTAssertEqual(content.ctaTitle, "Find people")
    }

    func testLoadPopulatedTransitionsToLoaded() async {
        stubConnections(
            accepted: .status(200, body: Self.acceptedJSON),
            pending: .status(200, body: Self.pendingJSON)
        )
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections.first?.rows.count, 2)
    }

    func testAllFetchesFailingTransitionsToError() async {
        // Error is reserved for "nothing loaded at all". Since the Sent and
        // Blocked tabs landed that means all four fetches, not two — any one
        // succeeding still leaves the user a usable screen.
        stubConnections(
            accepted: .status(500, body: "{}"),
            pending: .status(500, body: "{}"),
            sent: .status(500, body: "{}"),
            blocked: .status(500, body: "{}")
        )
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
    }

    func testOneFetchFailingStillTransitionsToLoadedFromTheOther() async {
        stubConnections(
            accepted: .status(500, body: "{}"),
            pending: .status(200, body: Self.pendingJSON)
        )
        let vm = makeVM()
        await vm.load()
        // Default tab is All → Accepted is empty → empty state with the
        // "no connections yet" copy.
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected .empty for All tab when accepted fetch fails")
            return
        }
        XCTAssertEqual(content.headline, "No connections yet")
        // Pending tab still has its row.
        vm.selectedTab = ConnectionsTab.pending
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected pending tab to be .loaded")
            return
        }
        XCTAssertEqual(sections.first?.rows.first?.id, "req1")
    }

    // MARK: - Tabs

    func testTabsExposeAllNeighborsPendingWithCounts() async {
        stubConnections(
            accepted: .status(200, body: Self.acceptedJSON),
            pending: .status(200, body: Self.pendingJSON)
        )
        let vm = makeVM()
        await vm.load()
        XCTAssertEqual(vm.tabs.count, 5)
        XCTAssertEqual(vm.tabs[0].id, ConnectionsTab.all)
        XCTAssertEqual(vm.tabs[0].count, 2)
        XCTAssertEqual(vm.tabs[1].id, ConnectionsTab.neighbors)
        // u_b has no city → not a neighbor; u_a is in Elm Park → 1 neighbor.
        XCTAssertEqual(vm.tabs[1].count, 1)
        XCTAssertEqual(vm.tabs[2].id, ConnectionsTab.pending)
        XCTAssertEqual(vm.tabs[2].count, 1)
        XCTAssertEqual(vm.tabs[3].id, ConnectionsTab.sent)
        XCTAssertEqual(vm.tabs[4].id, ConnectionsTab.blocked)
    }

    func testNeighborsTabFiltersOutConnectionsWithoutCity() async {
        stubConnections(
            accepted: .status(200, body: Self.acceptedJSON),
            pending: .status(200, body: Self.pendingJSON)
        )
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = ConnectionsTab.neighbors
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded for Neighbors tab")
            return
        }
        XCTAssertEqual(sections.first?.rows.count, 1)
        XCTAssertEqual(sections.first?.rows.first?.id, "r1")
    }

    func testPendingTabRendersPendingRequests() async {
        stubConnections(
            accepted: .status(200, body: Self.acceptedJSON),
            pending: .status(200, body: Self.pendingJSON)
        )
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = ConnectionsTab.pending
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded for Pending tab")
            return
        }
        XCTAssertEqual(sections.first?.rows.first?.id, "req1")
    }

    func testEmptyPendingShowsMailboxEmptyCopy() async {
        stubConnections(
            accepted: .status(200, body: Self.acceptedJSON),
            pending: .status(200, body: Self.emptyPendingJSON)
        )
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = ConnectionsTab.pending
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected .empty for Pending tab")
            return
        }
        XCTAssertEqual(content.headline, "No pending requests")
    }

    // MARK: - Search

    func testSearchFiltersAcceptedByName() async {
        stubConnections(
            accepted: .status(200, body: Self.acceptedJSON),
            pending: .status(200, body: Self.pendingJSON)
        )
        let vm = makeVM()
        await vm.load()
        vm.updateSearch("david")
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded after search")
            return
        }
        XCTAssertEqual(sections.first?.rows.count, 1)
        XCTAssertEqual(sections.first?.rows.first?.title, "David Chen")
    }

    func testSearchFiltersByCity() async {
        stubConnections(
            accepted: .status(200, body: Self.acceptedJSON),
            pending: .status(200, body: Self.pendingJSON)
        )
        let vm = makeVM()
        await vm.load()
        vm.updateSearch("burnside")
        vm.selectedTab = ConnectionsTab.pending
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded after search on pending")
            return
        }
        XCTAssertEqual(sections.first?.rows.count, 1)
        XCTAssertEqual(sections.first?.rows.first?.id, "req1")
    }

    // MARK: - Accept (optimistic)

    func testAcceptOptimisticallyRemovesPendingAndBumpsAll() async {
        stubConnections(
            accepted: .status(200, body: Self.acceptedJSON),
            pending: .status(200, body: Self.pendingJSON),
            actions: [
                .status(200, body: "{\"message\":\"Connection accepted\"}")
            ]
        )
        let vm = makeVM()
        await vm.load()
        XCTAssertEqual(vm.tabs[0].count, 2) // All
        XCTAssertEqual(vm.tabs[2].count, 1) // Pending
        await vm.accept(requestId: "req1")
        XCTAssertEqual(vm.tabs[0].count, 3, "All should bump to 3 after accepting a request")
        XCTAssertEqual(vm.tabs[2].count, 0, "Pending should empty out after acceptance")
    }

    func testAcceptRollsBackOnFailure() async {
        stubConnections(
            accepted: .status(200, body: Self.acceptedJSON),
            pending: .status(200, body: Self.pendingJSON),
            actions: [.status(500, body: "{}")]
        )
        let vm = makeVM()
        await vm.load()
        await vm.accept(requestId: "req1")
        XCTAssertEqual(vm.tabs[0].count, 2, "All count rolls back to original")
        XCTAssertEqual(vm.tabs[2].count, 1, "Pending count rolls back")
    }

    // MARK: - Reject (optimistic)

    func testRejectOptimisticallyRemovesPending() async {
        stubConnections(
            accepted: .status(200, body: Self.acceptedJSON),
            pending: .status(200, body: Self.pendingJSON),
            actions: [
                .status(200, body: "{\"message\":\"Connection request rejected\"}")
            ]
        )
        let vm = makeVM()
        await vm.load()
        await vm.reject(requestId: "req1")
        XCTAssertEqual(vm.tabs[2].count, 0)
        XCTAssertEqual(vm.tabs[0].count, 2, "All count unchanged on reject")
    }

    func testRejectRollsBackOnFailure() async {
        stubConnections(
            accepted: .status(200, body: Self.acceptedJSON),
            pending: .status(200, body: Self.pendingJSON),
            actions: [.status(500, body: "{}")]
        )
        let vm = makeVM()
        await vm.load()
        await vm.reject(requestId: "req1")
        XCTAssertEqual(vm.tabs[2].count, 1, "Pending count rolls back")
    }

    // MARK: - Row mapping

    func testAcceptedRowUsesAvatarWithVerifiedAndCircularMessageAction() {
        let vm = makeVM()
        let user = RelationshipUserDTO(
            id: "u",
            username: "maria",
            name: "Maria Kovacs",
            firstName: "Maria",
            lastName: "Kovacs",
            profilePictureURL: nil,
            city: "Elm Park",
            state: "OR"
        )
        let rel = RelationshipDTO(
            id: "r",
            status: "accepted",
            createdAt: "2026-05-12T10:00:00Z",
            respondedAt: "2026-05-12T11:00:00Z",
            acceptedAt: "2026-05-12T11:00:00Z",
            blockedBy: nil,
            direction: "received",
            otherUser: user
        )
        let row = vm.rowForAccepted(rel)
        XCTAssertEqual(row.title, "Maria Kovacs")
        XCTAssertEqual(row.subtitle, "Elm Park, OR")
        XCTAssertEqual(row.subtitleIcon, .mapPin)
        XCTAssertEqual(row.bodyIcon, .userPlus)
        guard case let .avatarWithBadge(_, _, _, size, verified) = row.leading else {
            XCTFail("Expected avatarWithBadge leading")
            return
        }
        XCTAssertEqual(size, .large)
        XCTAssertTrue(verified, "Accepted rows must show verified-check overlay")
        guard case .circularAction = row.trailing else {
            XCTFail("Expected circularAction trailing for accepted row")
            return
        }
    }

    func testPendingRowUsesUnverifiedAvatarAndVerticalActions() {
        let vm = makeVM()
        let user = RelationshipUserDTO(
            id: "u",
            username: "priya",
            name: "Priya Shah",
            firstName: "Priya",
            lastName: "Shah",
            profilePictureURL: nil,
            city: "Burnside",
            state: "OR"
        )
        let req = PendingRequestDTO(
            id: "req",
            status: "pending",
            createdAt: "2026-05-15T11:30:00Z",
            requester: user
        )
        let row = vm.rowForPending(req)
        XCTAssertEqual(row.title, "Priya Shah")
        guard case let .avatarWithBadge(_, _, _, _, verified) = row.leading else {
            XCTFail("Expected avatarWithBadge leading")
            return
        }
        XCTAssertFalse(verified, "Pending rows render an unverified avatar")
        guard case let .verticalActions(primary, secondary) = row.trailing else {
            XCTFail("Expected verticalActions trailing for pending row")
            return
        }
        XCTAssertEqual(primary.label, "Accept")
        XCTAssertEqual(primary.variant, .primary)
        XCTAssertEqual(secondary.label, "Ignore")
        XCTAssertEqual(secondary.variant, .ghost)
    }

    func testMessageCTAFiresOnMessageCallback() async {
        stubConnections(
            accepted: .status(200, body: Self.acceptedJSON),
            pending: .status(200, body: Self.pendingJSON)
        )
        let captured = MessageCapture()
        let vm = makeVM { target in captured.target = target }
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let row = sections.first?.rows.first { $0.id == "r1" }
        guard case let .circularAction(_, _, _, _, handler) = row?.trailing else {
            XCTFail("Expected circularAction trailing")
            return
        }
        handler()
        XCTAssertEqual(captured.target?.userId, "u_a")
        XCTAssertEqual(captured.target?.displayName, "Maria Kovacs")
        XCTAssertTrue(captured.target?.verified ?? false)
    }

    // MARK: - Pure helpers

    func testToneIsStableForSameId() {
        XCTAssertEqual(ConnectionAvatarTone.tone(for: "u_42"), ConnectionAvatarTone.tone(for: "u_42"))
    }

    func testRelativeTimeFormatting() {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = Self.utc
        XCTAssertEqual(
            ConnectionsViewModel.formatRelativeTime(
                "2026-05-15T11:55:00Z",
                now: Self.fixedNow,
                calendar: cal,
                timeZone: Self.utc
            ),
            "5m ago"
        )
        XCTAssertEqual(
            ConnectionsViewModel.formatRelativeTime(
                "2026-05-15T09:00:00Z",
                now: Self.fixedNow,
                calendar: cal,
                timeZone: Self.utc
            ),
            "3h ago"
        )
        XCTAssertEqual(
            ConnectionsViewModel.formatRelativeTime(
                "2026-05-14T08:00:00Z",
                now: Self.fixedNow,
                calendar: cal,
                timeZone: Self.utc
            ),
            "yesterday"
        )
        XCTAssertEqual(
            ConnectionsViewModel.formatRelativeTime(
                "2026-05-12T08:00:00Z",
                now: Self.fixedNow,
                calendar: cal,
                timeZone: Self.utc
            ),
            "3d ago"
        )
        XCTAssertEqual(
            ConnectionsViewModel.formatRelativeTime(
                "2026-05-01T08:00:00Z",
                now: Self.fixedNow,
                calendar: cal,
                timeZone: Self.utc
            ),
            "2w ago"
        )
        XCTAssertEqual(
            ConnectionsViewModel.formatRelativeTime(
                "2026-04-01T08:00:00Z",
                now: Self.fixedNow,
                calendar: cal,
                timeZone: Self.utc
            ),
            "Apr 1"
        )
    }
}

@MainActor
private final class MessageCapture {
    var target: ConnectionsChatTarget?
}
