//
//  GigsFeedViewModelTests.swift
//  PantopusTests
//
//  Covers the Gigs feed VM (T2.3): load → loaded/empty/error, category
//  chip + sort dropdown each drive a refetch, projection produces the
//  expected category enum and bid count. Phase 1 additions: the
//  radius-suggestion banner (B), dismiss / hide-category with undo (D),
//  and the realtime "new tasks" pill (E). Browse-mode coverage (F)
//  lives in `GigsBrowseTests`.
//

import XCTest
@testable import Pantopus

// swiftlint:disable force_unwrapping multiline_arguments

/// Location stub that never has a coordinate — keeps the feed VM on the
/// flat-list path regardless of the simulator's location state.
private final class NoLocationProvider: LocationProviding, @unchecked Sendable {
    func cachedCoordinate() -> UserCoordinate? {
        nil
    }

    func requestCurrent(timeoutSeconds _: TimeInterval) async -> UserCoordinate? {
        nil
    }
}

/// P6c — records Tasks-near-me widget snapshot writes instead of
/// touching the App Group suite / WidgetCenter.
@MainActor
private final class RecordingWidgetStore: WidgetSnapshotStoring {
    private(set) var snapshots: [GigWidgetSnapshot] = []

    func write(_ snapshot: GigWidgetSnapshot) {
        snapshots.append(snapshot)
    }
}

// swiftlint:disable type_body_length file_length

@MainActor
final class GigsFeedViewModelTests: XCTestCase {
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

    /// P6c — fresh draft queue over an ephemeral suite.
    private func makeQueue() -> GigDraftQueue {
        GigDraftQueue(defaults: UserDefaults(suiteName: "gigs-feed-draft-tests-\(UUID().uuidString)")!)
    }

    /// Centralised constructor — no device location (flat-list path) and
    /// an injected current-user id for the realtime tests. P6c adds the
    /// draft queue + widget snapshot recorder seams.
    private func makeVM(
        radiusMiles: Double = 1,
        currentUserId: String? = nil,
        queue: GigDraftQueue? = nil,
        widgetStore: RecordingWidgetStore? = nil,
        isOnline: @escaping @MainActor () -> Bool = { true }
    ) -> GigsFeedViewModel {
        GigsFeedViewModel(
            api: makeAPI(),
            radiusMiles: radiusMiles,
            location: NoLocationProvider(),
            currentUserId: { currentUserId },
            gigEventsProvider: { AsyncStream { $0.finish() } },
            draftQueue: queue ?? makeQueue(),
            widgetStore: widgetStore ?? RecordingWidgetStore(),
            isOnlineProvider: isOnline
        )
    }

    private static let handymanGigJSON = """
    {
      "id": "g1",
      "title": "Hang 3 floating shelves in living room",
      "description": "Need 3 IKEA Lack shelves mounted on drywall.",
      "price": 60,
      "category": "handyman",
      "status": "open",
      "created_at": "2026-05-14T08:00:00Z",
      "user_id": "u1",
      "bid_count": 4,
      "distance_miles": 0.2
    }
    """

    private static let cleaningGigJSON = """
    {
      "id": "g2",
      "title": "Deep clean 2BR apartment",
      "description": "Kitchen, bath, baseboards, inside oven.",
      "price": 180,
      "category": "cleaning",
      "status": "open",
      "created_at": "2026-05-14T05:00:00Z",
      "user_id": "u2",
      "bid_count": 0,
      "distance_miles": 0.5
    }
    """

    private static func gigsJSON(_ rows: String...) -> String {
        "{\"gigs\":[\(rows.joined(separator: ","))],\"total\":\(rows.count)}"
    }

    func testLoadTransitionsLoadedWhenGigsReturned() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON, Self.cleaningGigJSON))
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(rows.count, 2)
        XCTAssertEqual(rows[0].category, .handyman)
        XCTAssertEqual(rows[0].bidCount, 4)
        XCTAssertEqual(rows[0].price, "$60")
        XCTAssertEqual(rows[1].category, .cleaning)
        XCTAssertEqual(rows[1].bidCount, 0, "zero-bid row keeps a 0 count so the view can swap to the 'Be the first' affordance")
    }

    func testLoadEmptyTransitionsEmptyWithRadiusHint() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.gigsJSON())]
        let vm = makeVM(radiusMiles: 2)
        await vm.load()
        guard case let .empty(empty) = vm.state else {
            XCTFail("Expected .empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(empty.radiusMiles, 2)
    }

    func testLoadFailureTransitionsError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
    }

    func testSelectCategoryRefetches() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON, Self.cleaningGigJSON)),
            .status(200, body: Self.gigsJSON(Self.cleaningGigJSON))
        ]
        let vm = makeVM()
        await vm.load()
        await vm.selectCategory(.cleaning)
        XCTAssertEqual(vm.activeCategory, .cleaning)
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded after category switch, got \(vm.state)")
            return
        }
        XCTAssertEqual(rows.count, 1)
        XCTAssertEqual(rows.first?.category, .cleaning)
    }

    func testSelectSortRefetches() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON)),
            .status(200, body: Self.gigsJSON(Self.cleaningGigJSON))
        ]
        let vm = makeVM()
        await vm.load()
        await vm.selectSort(.highestPay)
        XCTAssertEqual(vm.activeSort, .highestPay)
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded after sort switch, got \(vm.state)")
            return
        }
        XCTAssertEqual(rows.first?.category, .cleaning)
    }

    // MARK: - P0 server-side filters

    /// Decompose the last captured request's query string.
    private func lastQueryItems() -> [String: String] {
        guard let url = SequencedURLProtocol.capturedRequests.last?.url,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        else { return [:] }
        var items: [String: String] = [:]
        for item in components.queryItems ?? [] {
            items[item.name] = item.value
        }
        return items
    }

    func testApplyFiltersForwardsServerParamsAndRefetches() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON, Self.cleaningGigJSON)),
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON))
        ]
        let vm = makeVM()
        await vm.load()
        await vm.applyFilters(GigFilterCriteria(
            budgetLower: 50,
            budgetUpper: 300,
            schedules: [.oneTime],
            openToBids: true
        ))
        let query = lastQueryItems()
        XCTAssertEqual(query["minPrice"], "50.0")
        XCTAssertEqual(query["maxPrice"], "300.0")
        XCTAssertEqual(query["pay_type"], "offers")
        XCTAssertEqual(query["schedule_type"], "scheduled", "Single one-time selection maps to the backend value.")
        XCTAssertEqual(vm.activeFilterCount, 3, "budget + schedule + open-to-bids each count once")
        guard case let .loaded(rows) = vm.state else {
            return XCTFail("Expected .loaded from the filtered refetch, got \(vm.state)")
        }
        XCTAssertEqual(rows.map(\.id), ["g1"], "Rows come straight from the server's filtered page.")
    }

    func testApplyFiltersOmitsServerParamsAtDefaults() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON)),
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON))
        ]
        let vm = makeVM()
        await vm.load()
        await vm.applyFilters(GigFilterCriteria())
        let query = lastQueryItems()
        XCTAssertNil(query["minPrice"], "Untouched lower handle sends no minPrice.")
        XCTAssertNil(query["maxPrice"], "The $500+ ceiling is open-ended — no maxPrice.")
        XCTAssertNil(query["pay_type"])
        XCTAssertNil(query["schedule_type"])
    }

    func testMultiScheduleSelectionStaysClientSide() async {
        // Two schedule chips → no single schedule_type value exists, so
        // the param is omitted and the rows narrow client-side.
        let scheduledGig = """
        {
          "id": "g3", "title": "One-time pickup", "description": "Single run.",
          "price": 30, "category": "delivery", "status": "open",
          "created_at": "2026-06-09T08:00:00Z", "user_id": "u3",
          "schedule_type": "scheduled"
        }
        """
        let asapGig = """
        {
          "id": "g4", "title": "ASAP errand", "description": "Right now.",
          "price": 25, "category": "delivery", "status": "open",
          "created_at": "2026-06-09T08:00:00Z", "user_id": "u4",
          "schedule_type": "asap"
        }
        """
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(scheduledGig, asapGig)),
            .status(200, body: Self.gigsJSON(scheduledGig, asapGig))
        ]
        let vm = makeVM()
        await vm.load()
        await vm.applyFilters(GigFilterCriteria(schedules: [.oneTime, .flexible]))
        XCTAssertNil(lastQueryItems()["schedule_type"], "Multi-select can't ride the single-value param.")
        guard case let .loaded(rows) = vm.state else {
            return XCTFail("Expected .loaded, got \(vm.state)")
        }
        XCTAssertEqual(rows.map(\.id), ["g3"], "asap row falls out client-side; scheduled row maps to one-time.")
    }

    func testSingleRecurringScheduleStaysClientSide() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON)),
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON))
        ]
        let vm = makeVM()
        await vm.load()
        await vm.applyFilters(GigFilterCriteria(schedules: [.recurring]))
        XCTAssertNil(
            lastQueryItems()["schedule_type"],
            "recurring has no backend schedule_type value — it filters client-side."
        )
    }

    func testPostedWithinFiltersClientSide() async {
        // No backend posted-within param exists — the cutoff narrows the
        // fetched rows locally.
        let freshGig = """
        {
          "id": "g5", "title": "Fresh gig", "description": "Posted just now.",
          "price": 40, "category": "handyman", "status": "open",
          "created_at": "\(ISO8601DateFormatter().string(from: Date().addingTimeInterval(-600)))",
          "user_id": "u5"
        }
        """
        let staleGig = """
        {
          "id": "g6", "title": "Old gig", "description": "Posted weeks ago.",
          "price": 40, "category": "handyman", "status": "open",
          "created_at": "2026-04-01T00:00:00Z", "user_id": "u6"
        }
        """
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(freshGig, staleGig)),
            .status(200, body: Self.gigsJSON(freshGig, staleGig))
        ]
        let vm = makeVM()
        await vm.load()
        await vm.applyFilters(GigFilterCriteria(postedWithin: .today))
        XCTAssertNil(lastQueryItems()["deadline"], "posted-within is not the deadline param.")
        guard case let .loaded(rows) = vm.state else {
            return XCTFail("Expected .loaded, got \(vm.state)")
        }
        XCTAssertEqual(rows.map(\.id), ["g5"])
    }

    // MARK: - B. Radius suggestion

    func testRadiusLadder() {
        XCTAssertEqual(GigsFeedViewModel.nextRadius(after: 1), 3)
        XCTAssertEqual(GigsFeedViewModel.nextRadius(after: 2), 3)
        XCTAssertEqual(GigsFeedViewModel.nextRadius(after: 3), 5)
        XCTAssertEqual(GigsFeedViewModel.nextRadius(after: 5), 10)
        XCTAssertEqual(GigsFeedViewModel.nextRadius(after: 7), 10)
        XCTAssertNil(GigsFeedViewModel.nextRadius(after: 10), "10 mi is the cap.")
    }

    func testThinLoadSurfacesRadiusSuggestion() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON, Self.cleaningGigJSON))
        ]
        let vm = makeVM()
        await vm.load()
        XCTAssertEqual(
            vm.radiusSuggestion,
            GigsRadiusSuggestion(resultCount: 2, currentMiles: 1, suggestedMiles: 3)
        )
    }

    func testNoSuggestionWithThreeOrMoreResults() async {
        let third = """
        {
          "id": "g7", "title": "Dog walk", "description": "30 min loop.",
          "price": 20, "category": "petcare", "status": "open",
          "created_at": "2026-06-09T08:00:00Z", "user_id": "u7"
        }
        """
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON, Self.cleaningGigJSON, third))
        ]
        let vm = makeVM()
        await vm.load()
        XCTAssertNil(vm.radiusSuggestion)
    }

    func testNoSuggestionWithActiveFilters() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON)),
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON))
        ]
        let vm = makeVM()
        await vm.load()
        await vm.applyFilters(GigFilterCriteria(budgetUpper: 100))
        XCTAssertNil(vm.radiusSuggestion, "Filtered loads never suggest widening the radius.")
    }

    func testNoSuggestionAtRadiusCap() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON))
        ]
        let vm = makeVM(radiusMiles: 10)
        await vm.load()
        XCTAssertNil(vm.radiusSuggestion, "No wider step exists past 10 mi.")
    }

    func testExpandRadiusRefetchesWiderAndResuggests() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON)),
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON))
        ]
        let vm = makeVM()
        await vm.load()
        await vm.expandRadius()
        XCTAssertEqual(vm.radiusMiles, 3)
        XCTAssertEqual(lastQueryItems()["radiusMiles"], "3.0", "Refetch rides the widened radius.")
        XCTAssertEqual(
            vm.radiusSuggestion,
            GigsRadiusSuggestion(resultCount: 1, currentMiles: 3, suggestedMiles: 5),
            "A still-thin wider load suggests the next step."
        )
    }

    func testDismissRadiusSuggestionSilencesForSession() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON)),
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON))
        ]
        let vm = makeVM()
        await vm.load()
        vm.dismissRadiusSuggestion()
        XCTAssertNil(vm.radiusSuggestion)
        await vm.refresh()
        XCTAssertNil(vm.radiusSuggestion, "X-dismissal holds for the rest of the session.")
    }

    // MARK: - D. Not interested / hide category

    func testDismissGigRemovesRowAndPostsDismiss() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON, Self.cleaningGigJSON)),
            .status(200, body: "{}")
        ]
        let vm = makeVM()
        await vm.load()
        await vm.dismissGig(id: "g1")
        guard case let .loaded(rows) = vm.state else {
            return XCTFail("Expected .loaded, got \(vm.state)")
        }
        XCTAssertEqual(rows.map(\.id), ["g2"])
        XCTAssertEqual(vm.pendingUndo?.kind, .dismissedGig(gigId: "g1"))
        let last = SequencedURLProtocol.capturedRequests.last
        XCTAssertEqual(last?.httpMethod, "POST")
        XCTAssertEqual(last?.url?.path, "/api/gigs/g1/dismiss")
    }

    func testDismissLastRowFallsToEmptyState() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON)),
            .status(200, body: "{}")
        ]
        let vm = makeVM()
        await vm.load()
        await vm.dismissGig(id: "g1")
        guard case .empty = vm.state else {
            return XCTFail("Expected .empty after the only row was dismissed, got \(vm.state)")
        }
    }

    func testDismissGigFailureRestoresRow() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON, Self.cleaningGigJSON)),
            .status(500, body: "{}")
        ]
        let vm = makeVM()
        await vm.load()
        await vm.dismissGig(id: "g1")
        guard case let .loaded(rows) = vm.state else {
            return XCTFail("Expected restored .loaded, got \(vm.state)")
        }
        XCTAssertEqual(rows.map(\.id), ["g1", "g2"], "Failed dismiss restores the optimistic removal.")
        XCTAssertNil(vm.pendingUndo)
        XCTAssertNotNil(vm.toast, "Failure surfaces an error toast.")
    }

    func testUndoDismissReinsertsAndDeletes() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON, Self.cleaningGigJSON)),
            .status(200, body: "{}"),
            .status(200, body: "{}")
        ]
        let vm = makeVM()
        await vm.load()
        await vm.dismissGig(id: "g1")
        await vm.undoPendingRemoval()
        guard case let .loaded(rows) = vm.state else {
            return XCTFail("Expected .loaded, got \(vm.state)")
        }
        XCTAssertEqual(rows.map(\.id), ["g1", "g2"])
        XCTAssertNil(vm.pendingUndo)
        let last = SequencedURLProtocol.capturedRequests.last
        XCTAssertEqual(last?.httpMethod, "DELETE")
        XCTAssertEqual(last?.url?.path, "/api/gigs/g1/dismiss")
    }

    func testHideCategoryRemovesAllMatchingRows() async {
        let secondHandyman = """
        {
          "id": "g8", "title": "Patch drywall", "description": "Two holes.",
          "price": 45, "category": "handyman", "status": "open",
          "created_at": "2026-06-09T08:00:00Z", "user_id": "u8"
        }
        """
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON, secondHandyman, Self.cleaningGigJSON)),
            .status(200, body: "{}")
        ]
        let vm = makeVM()
        await vm.load()
        await vm.hideCategory(ofGigId: "g1")
        guard case let .loaded(rows) = vm.state else {
            return XCTFail("Expected .loaded, got \(vm.state)")
        }
        XCTAssertEqual(rows.map(\.id), ["g2"], "Every handyman row leaves the list.")
        XCTAssertEqual(vm.pendingUndo?.kind, .hiddenCategory(backendKey: "handyman"))
        let last = SequencedURLProtocol.capturedRequests.last
        XCTAssertEqual(last?.httpMethod, "POST")
        XCTAssertEqual(last?.url?.path, "/api/gigs/hidden-categories")
    }

    func testUndoHideCategoryReinsertsAndDeletes() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON, Self.cleaningGigJSON)),
            .status(200, body: "{}"),
            .status(200, body: "{}")
        ]
        let vm = makeVM()
        await vm.load()
        await vm.hideCategory(ofGigId: "g1")
        await vm.undoPendingRemoval()
        guard case let .loaded(rows) = vm.state else {
            return XCTFail("Expected .loaded, got \(vm.state)")
        }
        XCTAssertEqual(rows.map(\.id), ["g1", "g2"])
        let last = SequencedURLProtocol.capturedRequests.last
        XCTAssertEqual(last?.httpMethod, "DELETE")
        XCTAssertEqual(last?.url?.path, "/api/gigs/hidden-categories/handyman")
    }

    func testExpireUndoDropsAffordanceWithoutReverting() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON, Self.cleaningGigJSON)),
            .status(200, body: "{}")
        ]
        let vm = makeVM()
        await vm.load()
        await vm.dismissGig(id: "g1")
        guard let undo = vm.pendingUndo else { return XCTFail("Expected a pending undo") }
        vm.expireUndo(undo.id)
        XCTAssertNil(vm.pendingUndo)
        guard case let .loaded(rows) = vm.state else {
            return XCTFail("Expected .loaded, got \(vm.state)")
        }
        XCTAssertEqual(rows.map(\.id), ["g2"], "Expiry keeps the removal in place.")
    }

    // MARK: - E. Realtime "new tasks" banner

    func testGigEventsAccumulateAndIgnoreOwnPosts() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON, Self.cleaningGigJSON, Self.handymanGigJSON))
        ]
        let vm = makeVM(currentUserId: "me")
        await vm.load()
        vm.handleGigEvent(GigNewEvent(id: "n1", userId: "neighbor-1"))
        vm.handleGigEvent(GigNewEvent(id: "n2", userId: "neighbor-2"))
        XCTAssertEqual(vm.newTaskCount, 2)
        vm.handleGigEvent(GigNewEvent(id: "n3", userId: "me"))
        XCTAssertEqual(vm.newTaskCount, 2, "Own posts never tick the banner.")
        vm.handleGigEvent(GigNewEvent(id: "n4", userId: nil))
        XCTAssertEqual(vm.newTaskCount, 3, "Events without a poster id still count.")
    }

    func testRefreshFromBannerClearsCountAndRefetches() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON)),
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON, Self.cleaningGigJSON))
        ]
        let vm = makeVM(currentUserId: "me")
        await vm.load()
        vm.handleGigEvent(GigNewEvent(id: "n1", userId: "neighbor-1"))
        XCTAssertEqual(vm.newTaskCount, 1)
        await vm.refreshFromBanner()
        XCTAssertEqual(vm.newTaskCount, 0)
        guard case let .loaded(rows) = vm.state else {
            return XCTFail("Expected .loaded, got \(vm.state)")
        }
        XCTAssertEqual(rows.count, 2, "Banner tap refetched the feed.")
    }

    // MARK: - P6a. Save this search

    /// Feed VM with an injected viewing location, mirroring how the
    /// host passes a fixed coordinate.
    private func makeLocatedVM(radiusMiles: Double = 5) -> GigsFeedViewModel {
        GigsFeedViewModel(
            api: makeAPI(),
            latitude: 40.7,
            longitude: -73.9,
            radiusMiles: radiusMiles,
            location: NoLocationProvider(),
            currentUserId: { nil },
            gigEventsProvider: { AsyncStream { $0.finish() } }
        )
    }

    private static let savedSearchResponseJSON = """
    {
      "search": {
        "id": "ss1", "user_id": "me", "name": "Cleaning · under $100 · 5 mi",
        "category": "cleaning", "search": null, "min_price": null, "max_price": 100,
        "schedule_type": null, "pay_type": null, "latitude": 40.7, "longitude": -73.9,
        "radius_miles": 5, "notify": true,
        "created_at": "2026-06-10T08:00:00Z", "last_notified_at": null
      }
    }
    """

    func testSaveSearchPostsAndToastsSuccess() async {
        SequencedURLProtocol.sequence = [.status(201, body: Self.savedSearchResponseJSON)]
        let vm = makeLocatedVM()
        await vm.saveSearch(criteria: GigFilterCriteria(budgetUpper: 100))
        let last = SequencedURLProtocol.capturedRequests.last
        XCTAssertEqual(last?.httpMethod, "POST")
        XCTAssertEqual(last?.url?.path, "/api/gigs/saved-searches")
        XCTAssertEqual(vm.toast?.text, "Search saved — we'll alert you")
        XCTAssertEqual(vm.toast?.kind, .success)
    }

    func testSaveSearchDedupedToastsReenabled() async {
        let deduped = Self.savedSearchResponseJSON.replacingOccurrences(
            of: "\"search\": {",
            with: "\"deduped\": true, \"search\": {"
        )
        SequencedURLProtocol.sequence = [.status(200, body: deduped)]
        let vm = makeLocatedVM()
        await vm.saveSearch(criteria: GigFilterCriteria(budgetUpper: 100))
        XCTAssertEqual(vm.toast?.text, "Already saved — alerts re-enabled")
        XCTAssertEqual(vm.toast?.kind, .success)
    }

    func testSaveSearchFailureToastsError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = makeLocatedVM()
        await vm.saveSearch(criteria: GigFilterCriteria(budgetUpper: 100))
        XCTAssertEqual(vm.toast?.text, "Couldn't save this search.")
        XCTAssertEqual(vm.toast?.kind, .error)
    }

    func testSaveSearchWithoutLocationSkipsRequest() async {
        let vm = makeVM() // no injected coordinate + NoLocationProvider
        await vm.saveSearch(criteria: GigFilterCriteria(budgetUpper: 100))
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.isEmpty, "No coordinate — nothing to POST.")
        XCTAssertEqual(vm.toast?.kind, .error)
    }

    // MARK: - P6c. Tasks-near-me widget snapshot

    func testLoadWritesWidgetSnapshot() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON, Self.cleaningGigJSON))
        ]
        let store = RecordingWidgetStore()
        let vm = makeVM(widgetStore: store)
        await vm.load()
        XCTAssertEqual(store.snapshots.count, 1, "Every successful feed fetch writes one snapshot.")
        let snapshot = store.snapshots[0]
        XCTAssertEqual(snapshot.totalNearby, 2)
        XCTAssertEqual(snapshot.tasks.map(\.id), ["g1", "g2"])
        XCTAssertEqual(snapshot.tasks[0].categoryKey, "handyman")
        XCTAssertEqual(snapshot.tasks[0].price, "$60")
        XCTAssertEqual(snapshot.tasks[0].distance, "0.2mi")
        XCTAssertTrue(GigWidgetSnapshotContract.isFresh(snapshot))
    }

    func testFailedLoadWritesNoWidgetSnapshot() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let store = RecordingWidgetStore()
        let vm = makeVM(widgetStore: store)
        await vm.load()
        XCTAssertTrue(store.snapshots.isEmpty, "Error loads must not stomp the last good snapshot.")
    }

    // MARK: - P6c. Offline draft banner

    /// A complete composer form, mirroring what the wizard stashes when
    /// a review-step submit hits a connectivity failure.
    private func completeDraftForm() -> GigComposeFormState {
        GigComposeFormState(
            step: GigComposeStep.review.rawValue,
            category: .handyman,
            title: "Hang 3 shelves in the living room",
            description: "Need three IKEA Lack shelves mounted on drywall.",
            budgetType: .fixed,
            budgetMin: "60"
        )
    }

    private static let magicPostJSON = """
    {"message":"Task posted","gig":{"id":"gig_77","title":"Hang 3 shelves","undo_window_ms":10000,"can_undo":true}}
    """

    func testDraftBannerGateNeedsDraftsAndConnectivity() {
        let queue = makeQueue()
        var online = false
        let vm = makeVM(queue: queue) { online }
        XCTAssertFalse(vm.showsDraftBanner, "No drafts → no banner.")
        queue.enqueue(completeDraftForm(), replacing: nil)
        XCTAssertFalse(vm.showsDraftBanner, "Offline → banner waits for connectivity.")
        online = true
        XCTAssertTrue(vm.showsDraftBanner)
        XCTAssertEqual(vm.pendingDraftCount, 1)
    }

    func testPostPendingDraftSuccessRemovesDraftAndRefreshes() async {
        SequencedURLProtocol.sequence = [
            .status(201, body: Self.magicPostJSON),
            .status(200, body: Self.gigsJSON(Self.handymanGigJSON))
        ]
        let queue = makeQueue()
        queue.enqueue(completeDraftForm(), replacing: nil)
        let vm = makeVM(queue: queue)
        await vm.postPendingDraft()
        XCTAssertTrue(queue.drafts.isEmpty, "A posted draft leaves the queue.")
        XCTAssertEqual(vm.toast?.text, "Draft posted")
        XCTAssertEqual(vm.toast?.kind, .success)
        let first = SequencedURLProtocol.capturedRequests.first
        XCTAssertEqual(first?.httpMethod, "POST")
        XCTAssertEqual(first?.url?.path, "/api/gigs/magic-post")
        XCTAssertEqual(
            SequencedURLProtocol.capturedRequests.count, 2,
            "Success refreshes the feed so the new task shows."
        )
    }

    func testPostPendingDraftFailureKeepsDraft() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let queue = makeQueue()
        queue.enqueue(completeDraftForm(), replacing: nil)
        let vm = makeVM(queue: queue)
        await vm.postPendingDraft()
        XCTAssertEqual(queue.drafts.count, 1, "Failed retry keeps the draft queued.")
        XCTAssertEqual(vm.toast?.kind, .error)
    }

    func testPostPendingDraftWithIncompleteFormKeepsDraftWithoutRequest() async {
        let queue = makeQueue()
        queue.enqueue(GigComposeFormState(title: "Too short"), replacing: nil)
        let vm = makeVM(queue: queue)
        await vm.postPendingDraft()
        XCTAssertEqual(queue.drafts.count, 1, "An unfinishable draft stays queued for the composer.")
        XCTAssertEqual(vm.toast?.kind, .error)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.isEmpty, "No body → no magic-post roundtrip.")
    }

    func testDiscardPendingDraftRemovesOldest() {
        let queue = makeQueue()
        queue.enqueue(completeDraftForm(), replacing: nil)
        queue.enqueue(GigComposeFormState(title: "Second draft"), replacing: nil)
        let vm = makeVM(queue: queue)
        vm.discardPendingDraft()
        XCTAssertEqual(queue.drafts.count, 1)
        XCTAssertEqual(queue.drafts.first?.form.title, "Second draft", "Discard drops the oldest draft.")
    }

    func testDraftQueuePersistsAcrossInstances() throws {
        let suite = "gigs-feed-draft-tests-persist-\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        GigDraftQueue(defaults: defaults).enqueue(completeDraftForm(), replacing: nil)
        let reloaded = GigDraftQueue(defaults: defaults)
        XCTAssertEqual(reloaded.drafts.count, 1, "Drafts survive process death via UserDefaults.")
        XCTAssertEqual(reloaded.drafts.first?.form.title, "Hang 3 shelves in the living room")
    }
}
