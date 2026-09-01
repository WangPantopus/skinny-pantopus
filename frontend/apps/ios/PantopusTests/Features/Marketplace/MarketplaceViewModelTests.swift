//
//  MarketplaceViewModelTests.swift
//  PantopusTests
//
//  Covers the Marketplace VM (T2.5): load → loaded/empty/error,
//  category chip drives a refetch with layer/isFree params, projection
//  produces a Free price when is_free=true, condition badge suppressed
//  for rentals + free, search submit triggers a refetch.
//

import XCTest
@testable import Pantopus

@MainActor
final class MarketplaceViewModelTests: XCTestCase {
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

    private let location = FixedLocationProvider(
        UserCoordinate(latitude: 40.7484, longitude: -73.9857, accuracyMeters: 50)
    )

    private static let goodsListingJSON = """
    {
      "id": "l1",
      "title": "Mid-century sofa, walnut frame",
      "price": 320,
      "is_free": false,
      "category": "furniture",
      "condition": "like_new",
      "status": "active",
      "media_urls": [],
      "first_image": null,
      "layer": "goods",
      "listing_type": "sell_item",
      "distance_meters": 644,
      "created_at": "2026-05-14T08:00:00Z"
    }
    """

    private static let freeListingJSON = """
    {
      "id": "l2",
      "title": "Moving boxes — bundle of 18",
      "price": 0,
      "is_free": true,
      "category": "free_stuff",
      "condition": null,
      "status": "active",
      "media_urls": [],
      "first_image": null,
      "layer": "goods",
      "listing_type": "free_item",
      "distance_meters": 160,
      "created_at": "2026-05-14T09:00:00Z"
    }
    """

    private static let rentalListingJSON = """
    {
      "id": "l3",
      "title": "Peloton Bike+ (rental, week)",
      "price": 45,
      "is_free": false,
      "category": "sports_outdoors",
      "condition": "good",
      "status": "active",
      "media_urls": [],
      "first_image": null,
      "layer": "rentals",
      "listing_type": "rent_sublet",
      "distance_meters": 1280,
      "created_at": "2026-05-13T08:00:00Z"
    }
    """

    private static func listingsJSON(_ rows: String..., hasMore: Bool? = nil) -> String {
        var body = "{\"listings\":[\(rows.joined(separator: ","))]"
        if let hasMore {
            body += ",\"pagination\":{\"limit\":30,\"offset\":0,\"hasMore\":\(hasMore)}"
        }
        return body + "}"
    }

    func testLoadTransitionsLoadedWhenListingsReturned() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingsJSON(Self.goodsListingJSON, Self.freeListingJSON, Self.rentalListingJSON))
        ]
        let vm = MarketplaceViewModel(api: makeAPI(), location: location)
        await vm.load()
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(rows.count, 3)
        let sofa = rows.first { $0.id == "l1" }
        XCTAssertEqual(sofa?.price, "$320")
        XCTAssertFalse(sofa?.isFree ?? true)
        XCTAssertEqual(sofa?.conditionBadge, "Like new")
        let freebie = rows.first { $0.id == "l2" }
        XCTAssertEqual(freebie?.price, "Free")
        XCTAssertTrue(freebie?.isFree ?? false)
        XCTAssertNil(freebie?.conditionBadge, "free listings suppress the condition chip")
        let rental = rows.first { $0.id == "l3" }
        XCTAssertEqual(rental?.price, "$45 / wk")
        XCTAssertNil(rental?.conditionBadge, "rental listings suppress the condition chip")
    }

    func testLoadEmptyTransitionsEmptyWithRadiusHint() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.listingsJSON())]
        let vm = MarketplaceViewModel(api: makeAPI(), location: location, radiusMiles: 5)
        await vm.load()
        guard case let .empty(empty) = vm.state else {
            XCTFail("Expected .empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(empty.radiusMiles, 5)
    }

    func testLoadFailureTransitionsError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = MarketplaceViewModel(api: makeAPI(), location: location)
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
    }

    func testSelectCategoryRefetches() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingsJSON(Self.goodsListingJSON, Self.freeListingJSON, Self.rentalListingJSON)),
            .status(200, body: Self.listingsJSON(Self.freeListingJSON))
        ]
        let vm = MarketplaceViewModel(api: makeAPI(), location: location)
        await vm.load()
        await vm.selectCategory(.free)
        XCTAssertEqual(vm.activeCategory, .free)
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded after free filter")
            return
        }
        XCTAssertEqual(rows.count, 1)
        XCTAssertTrue(rows.first?.isFree ?? false)
    }

    func testSubmitSearchRefetches() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingsJSON(Self.goodsListingJSON)),
            .status(200, body: Self.listingsJSON(Self.rentalListingJSON))
        ]
        let vm = MarketplaceViewModel(api: makeAPI(), location: location)
        await vm.load()
        vm.searchText = "bike"
        await vm.submitSearch()
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded after search")
            return
        }
        XCTAssertEqual(rows.first?.id, "l3")
    }

    // MARK: - Fetch generations

    func testCategorySelectedMidFlightIsNotClobberedByStaleResponse() async {
        // First (slow) response belongs to the initial load; the chip
        // tap fires a second (fast) fetch. The stale slow response must
        // be discarded, not applied over the chip's results.
        SequencedURLProtocol.sequence = [
            .status(
                200,
                body: Self.listingsJSON(Self.goodsListingJSON, Self.freeListingJSON, Self.rentalListingJSON),
                delay: 0.4
            ),
            .status(200, body: Self.listingsJSON(Self.freeListingJSON))
        ]
        let vm = MarketplaceViewModel(api: makeAPI(), location: location)
        let initialLoad = Task { await vm.load() }
        try? await Task.sleep(nanoseconds: 100_000_000)
        await vm.selectCategory(.free)
        await initialLoad.value
        XCTAssertEqual(vm.activeCategory, .free)
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(rows.count, 1, "Stale 3-row initial response must not win.")
        XCTAssertTrue(rows.first?.isFree ?? false)
    }

    // MARK: - Pagination

    func testLoadMoreAppendsNextPageAndDropsDuplicates() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingsJSON(Self.goodsListingJSON, Self.freeListingJSON, hasMore: true)),
            // Page 2 overlaps (l2 again) + brings one new row.
            .status(200, body: Self.listingsJSON(Self.freeListingJSON, Self.rentalListingJSON, hasMore: false))
        ]
        let vm = MarketplaceViewModel(api: makeAPI(), location: location)
        await vm.load()
        XCTAssertTrue(vm.hasMore)
        await vm.loadMoreIfNeeded(currentId: "l2")
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded after page 2")
            return
        }
        XCTAssertEqual(rows.map(\.id), ["l1", "l2", "l3"], "Page 2 appends, duplicate l2 dropped.")
        XCTAssertFalse(vm.hasMore)
    }

    func testLoadMoreNoOpsAwayFromListTail() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingsJSON(Self.goodsListingJSON, Self.freeListingJSON, Self.rentalListingJSON, hasMore: true))
        ]
        let vm = MarketplaceViewModel(api: makeAPI(), location: location)
        await vm.load()
        // No second stub queued — fetching here would surface a decode
        // error; a no-op proves the tail guard works for non-tail ids.
        await vm.loadMoreIfNeeded(currentId: "nonexistent")
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        XCTAssertEqual(rows.count, 3)
    }

    // MARK: - Widen radius

    func testWidenRadiusStepsUpAndRefetches() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingsJSON()),
            .status(200, body: Self.listingsJSON(Self.goodsListingJSON))
        ]
        let vm = MarketplaceViewModel(api: makeAPI(), location: location)
        await vm.load()
        guard case .empty = vm.state else {
            XCTFail("Expected .empty before widening")
            return
        }
        XCTAssertTrue(vm.canWidenRadius)
        await vm.widenRadius()
        XCTAssertEqual(vm.radiusMiles, 5)
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded after widening")
            return
        }
        XCTAssertEqual(rows.count, 1)
    }

    func testWidenRadiusStopsAtMaxStep() async {
        let vm = MarketplaceViewModel(api: makeAPI(), location: location, radiusMiles: 25)
        XCTAssertFalse(vm.canWidenRadius)
        // No stub queued — widening at the cap must not fetch.
        await vm.widenRadius()
        XCTAssertEqual(vm.radiusMiles, 25)
    }

    // MARK: - Refresh on return

    func testRefreshOnReturnNoOpsBeforeFirstLoad() async {
        // No stub queued — a fetch here would error the state.
        let vm = MarketplaceViewModel(api: makeAPI(), location: location)
        await vm.refreshOnReturn()
        guard case .loading = vm.state else {
            XCTFail("Expected pristine .loading state")
            return
        }
        XCTAssertFalse(vm.hasLoadedOnce)
    }

    func testRefreshOnReturnPicksUpNewListings() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingsJSON(Self.goodsListingJSON)),
            .status(200, body: Self.listingsJSON(Self.goodsListingJSON, Self.freeListingJSON))
        ]
        let vm = MarketplaceViewModel(api: makeAPI(), location: location)
        await vm.load()
        await vm.refreshOnReturn()
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded after return refresh")
            return
        }
        XCTAssertEqual(rows.count, 2, "The listing posted while away appears on return.")
    }

    func testRefreshOnReturnRecoversFromEmpty() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingsJSON()),
            .status(200, body: Self.listingsJSON(Self.goodsListingJSON))
        ]
        let vm = MarketplaceViewModel(api: makeAPI(), location: location)
        await vm.load()
        guard case .empty = vm.state else {
            XCTFail("Expected .empty first")
            return
        }
        await vm.refreshOnReturn()
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded after posting the first listing")
            return
        }
        XCTAssertEqual(rows.count, 1)
    }
}
