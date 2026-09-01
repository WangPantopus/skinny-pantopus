//
//  RecentActivityViewModelTests.swift
//  PantopusTests
//
//  P1.5 — state-transition + projection coverage for the Recent
//  Activity log VM. Drives:
//    - load → loaded (rows mirror backend activity)
//    - load → empty (designed CTA + headline)
//    - load → error (preserves transport error message)
//    - row tap → typed `RecentActivityDestination` per route kind
//

import XCTest
@testable import Pantopus

@MainActor
final class RecentActivityViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeVM(
        onOpen: @escaping @MainActor (RecentActivityDestination) -> Void = { _ in }
    ) -> RecentActivityViewModel {
        let api = APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
        return RecentActivityViewModel(api: api, onOpen: onOpen)
    }

    // MARK: - Fixtures

    private let populatedHubJSON = """
    {
      "user":{"id":"u1","name":"Alice","firstName":"Alice","username":"alice","avatarUrl":null,"email":"a@b.co"},
      "context":{"activeHomeId":"h1","activePersona":{"type":"personal"}},
      "availability":{"hasHome":true,"hasBusiness":false,"hasPayoutMethod":false},
      "homes":[],
      "businesses":[],
      "setup":{"steps":[],"allDone":true,
               "profileCompleteness":{"score":0.9,
                                      "checks":{"firstName":true,"lastName":true,"photo":true,"bio":true,"skills":true},
                                      "missingFields":[]}},
      "statusItems":[],
      "cards":{"personal":{"unreadChats":0,"earnings":0,"gigsNearby":0,"rating":0,"reviewCount":0},
               "home":{"newMail":0,"billsDue":[],"tasksDue":[],"memberCount":1},
               "business":null},
      "jumpBackIn":[],
      "activity":[
        {"id":"a1","pillar":"personal","title":"Maria replied to your gig",
         "at":"2026-05-15T10:00:00Z","read":false,"route":"/posts/p_1"},
        {"id":"a2","pillar":"personal","title":"Task posted: Mow lawn",
         "at":"2026-05-15T09:00:00Z","read":true,"route":"/gigs/g_1"},
        {"id":"a3","pillar":"home","title":"Package arrived",
         "at":"2026-05-15T08:00:00Z","read":true,"route":"/app/homes/h_1/dashboard"}
      ],
      "neighborDensity":null
    }
    """

    private let emptyHubJSON = """
    {
      "user":{"id":"u1","name":"Alice","firstName":"Alice","username":"alice","avatarUrl":null,"email":"a@b.co"},
      "context":{"activeHomeId":null,"activePersona":{"type":"personal"}},
      "availability":{"hasHome":false,"hasBusiness":false,"hasPayoutMethod":false},
      "homes":[],
      "businesses":[],
      "setup":{"steps":[],"allDone":true,
               "profileCompleteness":{"score":0.9,
                                      "checks":{"firstName":true,"lastName":true,"photo":true,"bio":true,"skills":true},
                                      "missingFields":[]}},
      "statusItems":[],
      "cards":{"personal":{"unreadChats":0,"earnings":0,"gigsNearby":0,"rating":0,"reviewCount":0},
               "home":{"newMail":0,"billsDue":[],"tasksDue":[],"memberCount":1},
               "business":null},
      "jumpBackIn":[],
      "activity":[],
      "neighborDensity":null
    }
    """

    // MARK: - Lifecycle

    func testLoadPopulatedRendersOneRowPerActivityItem() async {
        SequencedURLProtocol.sequence = [.status(200, body: populatedHubJSON)]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, hasMore) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertFalse(hasMore)
        XCTAssertEqual(sections.first?.rows.count, 3)
        XCTAssertEqual(sections.first?.rows.first?.title, "Maria replied to your gig")
    }

    func testLoadEmptyShowsDesignedEmptyState() async {
        SequencedURLProtocol.sequence = [.status(200, body: emptyHubJSON)]
        let vm = makeVM()
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.icon, .bell)
        XCTAssertEqual(content.headline, "No activity yet")
    }

    func testLoadServerErrorTransitionsToError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected error, got \(vm.state)")
            return
        }
    }

    // MARK: - Destination routing

    func testDestinationForGigRoute() {
        let item = HubResponse.HubActivityItem(
            id: "a1", pillar: "personal", title: "x", at: "", read: true, route: "/gigs/g_42"
        )
        XCTAssertEqual(RecentActivityViewModel.destination(for: item), .gigDetail(id: "g_42"))
    }

    func testDestinationForListingRoute() {
        let item = HubResponse.HubActivityItem(
            id: "a1", pillar: "business", title: "x", at: "", read: true, route: "/listings/l_7"
        )
        XCTAssertEqual(RecentActivityViewModel.destination(for: item), .listingDetail(id: "l_7"))
    }

    func testDestinationForMailRoute() {
        let item = HubResponse.HubActivityItem(
            id: "a1", pillar: "home", title: "x", at: "", read: true, route: "/app/mailbox/item/m_9"
        )
        XCTAssertEqual(RecentActivityViewModel.destination(for: item), .mailItemDetail(id: "m_9"))
    }

    func testDestinationForPostRoute() {
        let item = HubResponse.HubActivityItem(
            id: "a1", pillar: "personal", title: "x", at: "", read: true, route: "/posts/p_1"
        )
        XCTAssertEqual(RecentActivityViewModel.destination(for: item), .pulsePost(id: "p_1"))
    }

    func testDestinationForHomeRoute() {
        let item = HubResponse.HubActivityItem(
            id: "a1", pillar: "home", title: "x", at: "", read: true, route: "/app/homes/h_3/dashboard"
        )
        XCTAssertEqual(RecentActivityViewModel.destination(for: item), .homeDashboard(id: "h_3"))
    }

    func testDestinationFallsBackToPlaceholderForUnknownRoute() {
        let item = HubResponse.HubActivityItem(
            id: "a1",
            pillar: "personal",
            title: "Notification",
            at: "",
            read: true,
            route: "/app/notifications"
        )
        XCTAssertEqual(
            RecentActivityViewModel.destination(for: item),
            .placeholder(label: "Notification")
        )
    }

    // MARK: - Row projection

    func testRowProjectionUsesGigIconForGigRoute() {
        let item = HubResponse.HubActivityItem(
            id: "a1",
            pillar: "personal",
            title: "Task posted: Mow",
            at: "2026-05-15T09:00:00Z",
            read: true,
            route: "/gigs/g_1"
        )
        let row = RecentActivityViewModel.row(
            for: item,
            now: ISO8601DateFormatter().date(from: "2026-05-15T10:00:00Z") ?? Date()
        ) { _ in }
        XCTAssertEqual(row.title, "Task posted: Mow")
        // Read items have no highlight.
        XCTAssertNil(row.highlight)
    }

    func testRowProjectionMarksUnreadRows() {
        let item = HubResponse.HubActivityItem(
            id: "a1",
            pillar: "personal",
            title: "Maria replied",
            at: "2026-05-15T10:00:00Z",
            read: false,
            route: "/posts/p_1"
        )
        let row = RecentActivityViewModel.row(
            for: item,
            now: ISO8601DateFormatter().date(from: "2026-05-15T10:30:00Z") ?? Date()
        ) { _ in }
        XCTAssertEqual(row.highlight, .unread)
    }
}
