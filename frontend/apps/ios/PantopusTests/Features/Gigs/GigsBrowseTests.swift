//
//  GigsBrowseTests.swift
//  PantopusTests
//
//  Work item F — the sectioned browse surface. Covers the
//  `GET /api/gigs/browse` DTO decode (fixture mirrors the backend route's
//  field shapes), the section projection (vertical caps, rail cards,
//  cluster chips), and the VM's browse-mode entry / exit transitions.
//

import XCTest
@testable import Pantopus

// swiftlint:disable type_body_length

@MainActor
final class GigsBrowseTests: XCTestCase {
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

    /// Browse VM — the injected coordinate puts it on the browse path.
    private func makeVM(radiusMiles: Double = 1) -> GigsFeedViewModel {
        GigsFeedViewModel(
            api: makeAPI(),
            latitude: 40.7484,
            longitude: -73.9857,
            radiusMiles: radiusMiles,
            currentUserId: { nil },
            gigEventsProvider: { AsyncStream { $0.finish() } }
        )
    }

    // MARK: - Fixtures (shapes from backend/routes/gigs.js:3190)

    private static func browseGig(
        id: String,
        title: String,
        price: Double,
        category: String,
        distanceMeters: Double = 321.9,
        isUrgent: Bool = false,
        firstImage: String? = nil
    ) -> String {
        let image = firstImage.map { "\"\($0)\"" } ?? "null"
        return """
        {
          "id": "\(id)", "title": "\(title)",
          "description": "Fixture row", "price": \(price),
          "category": "\(category)", "status": "open",
          "created_at": "2026-06-09T08:00:00Z", "user_id": "u-\(id)",
          "distance_meters": \(distanceMeters), "is_urgent": \(isUrgent),
          "first_image": \(image), "exact_city": "Brooklyn", "exact_state": "NY"
        }
        """
    }

    private static let clusterJSON = """
    {
      "category": "handyman", "count": 4,
      "price_min": 20, "price_max": 100, "price_avg": 48.5,
      "nearest_distance": 250.0, "newest_at": "2026-06-09T00:00:00Z",
      "representative_title": "Fix kitchen sink"
    }
    """

    private static let browseJSON = """
    {
      "sections": {
        "best_matches": [
          \(browseGig(id: "b1", title: "Hang shelves", price: 60, category: "handyman")),
          \(browseGig(id: "b2", title: "Deep clean", price: 180, category: "cleaning")),
          \(browseGig(id: "b3", title: "Dog walk", price: 20, category: "petcare")),
          \(browseGig(id: "b4", title: "Move boxes", price: 90, category: "moving"))
        ],
        "urgent": [
          \(browseGig(id: "u1", title: "Leak ASAP", price: 75, category: "handyman", isUrgent: true))
        ],
        "clusters": [\(clusterJSON)],
        "high_paying": [
          \(browseGig(id: "h1", title: "Full move", price: 400, category: "moving", firstImage: "https://cdn.example/h1.jpg"))
        ],
        "new_today": [],
        "quick_jobs": [
          \(browseGig(id: "q1", title: "Pick up package", price: 15, category: "delivery"))
        ]
      },
      "total_active": 9,
      "radius_used": 1609
    }
    """

    private static let emptyBrowseJSON = """
    {
      "sections": {
        "best_matches": [], "urgent": [], "clusters": [],
        "high_paying": [], "new_today": [], "quick_jobs": []
      },
      "total_active": 0,
      "radius_used": 1609
    }
    """

    private static let flatGigJSON = """
    {
      "id": "g1", "title": "Deep clean 2BR", "description": "Kitchen + bath.",
      "price": 180, "category": "cleaning", "status": "open",
      "created_at": "2026-06-09T08:00:00Z", "user_id": "u1",
      "bid_count": 2, "distance_miles": 0.4
    }
    """

    private static func flatJSON(_ rows: String...) -> String {
        "{\"gigs\":[\(rows.joined(separator: ","))],\"total\":\(rows.count)}"
    }

    // MARK: - DTO decode

    func testBrowseResponseDecodes() throws {
        let response = try JSONDecoder().decode(
            GigsBrowseResponse.self,
            from: Data(Self.browseJSON.utf8)
        )
        XCTAssertEqual(response.totalActive, 9)
        XCTAssertEqual(response.radiusUsed, 1609)
        XCTAssertEqual(response.sections.bestMatches.count, 4)
        XCTAssertEqual(response.sections.urgent.first?.isUrgent, true)
        XCTAssertEqual(response.sections.newToday.count, 0)
        XCTAssertEqual(response.sections.quickJobs.first?.id, "q1")
        let best = try XCTUnwrap(response.sections.bestMatches.first)
        XCTAssertEqual(best.distanceMeters, 321.9)
        XCTAssertNil(best.firstImage, "first_image: null decodes to nil")
        XCTAssertEqual(
            response.sections.highPaying.first?.firstImage,
            "https://cdn.example/h1.jpg"
        )
        let cluster = try XCTUnwrap(response.sections.clusters.first)
        XCTAssertEqual(cluster.category, "handyman")
        XCTAssertEqual(cluster.count, 4)
        XCTAssertEqual(cluster.priceMin, 20)
        XCTAssertEqual(cluster.representativeTitle, "Fix kitchen sink")
    }

    func testBrowseSectionsTolerateMissingKeys() throws {
        let sparse = #"{"sections":{"best_matches":[]},"total_active":0}"#
        let response = try JSONDecoder().decode(GigsBrowseResponse.self, from: Data(sparse.utf8))
        XCTAssertTrue(response.sections.urgent.isEmpty)
        XCTAssertTrue(response.sections.clusters.isEmpty)
        XCTAssertNil(response.radiusUsed)
    }

    // MARK: - Projection

    func testProjectBrowseCapsVerticalSectionsAtThree() throws {
        let response = try JSONDecoder().decode(
            GigsBrowseResponse.self,
            from: Data(Self.browseJSON.utf8)
        )
        let content = GigsFeedViewModel.projectBrowse(response)
        XCTAssertEqual(content.bestMatches.count, 3, "Vertical sections cap at 3 rows.")
        XCTAssertEqual(content.bestMatches.map(\.id), ["b1", "b2", "b3"])
        XCTAssertEqual(content.urgentRail.count, 1)
        XCTAssertEqual(content.highPayingRail.count, 1)
        XCTAssertEqual(content.quickJobs.count, 1)
        XCTAssertTrue(content.newToday.isEmpty)
        XCTAssertEqual(content.totalActive, 9)
        XCTAssertFalse(content.isEmpty)
    }

    func testBrowseRowProjection() {
        let gig = BrowseGigDTO(
            id: "b1",
            title: "Hang shelves",
            description: "Three shelves",
            price: 60,
            category: "handyman",
            createdAt: nil,
            distanceMeters: 321.9,
            isUrgent: true
        )
        let row = GigsFeedViewModel.projectBrowseRow(gig)
        XCTAssertEqual(row.category, .handyman)
        XCTAssertEqual(row.price, "$60")
        XCTAssertEqual(row.distanceLabel, "0.2mi", "distance_meters converts to miles.")
        XCTAssertNil(row.bidCount, "Browse rows carry no bid count → both bid pills hidden.")
        XCTAssertTrue(row.isUrgent)
    }

    func testRailCardProjection() {
        let gig = BrowseGigDTO(
            id: "h1",
            title: "Full move",
            price: 400,
            category: "moving",
            distanceMeters: 1609.34
        )
        let card = GigsFeedViewModel.projectRail(gig)
        XCTAssertEqual(card.category, .moving)
        XCTAssertEqual(card.price, "$400")
        XCTAssertEqual(card.distanceLabel, "1.0mi")
    }

    func testClusterChipProjection() throws {
        let cluster = try JSONDecoder().decode(GigClusterDTO.self, from: Data(Self.clusterJSON.utf8))
        let chip = GigsFeedViewModel.projectCluster(cluster)
        XCTAssertEqual(chip.category, .handyman)
        XCTAssertEqual(chip.count, 4)
        XCTAssertEqual(chip.priceHint, "From $20")
        XCTAssertEqual(chip.id, "handyman", "Chip id keeps the raw backend key.")
    }

    // MARK: - Browse-mode entry / exit

    /// Decompose the last captured request's query string.
    private func lastQuery() -> (path: String, items: [String: String]) {
        guard let url = SequencedURLProtocol.capturedRequests.last?.url,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        else { return ("", [:]) }
        var items: [String: String] = [:]
        for item in components.queryItems ?? [] {
            items[item.name] = item.value
        }
        return (url.path, items)
    }

    func testLoadEntersBrowseModeWithMeterRadius() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.browseJSON)]
        let vm = makeVM()
        XCTAssertTrue(vm.isBrowseMode)
        await vm.load()
        guard case let .browse(content) = vm.state else {
            return XCTFail("Expected .browse, got \(vm.state)")
        }
        XCTAssertEqual(content.bestMatches.count, 3)
        let (path, query) = lastQuery()
        XCTAssertEqual(path, "/api/gigs/browse")
        XCTAssertEqual(query["lat"], "40.7484")
        XCTAssertEqual(query["lng"], "-73.9857")
        XCTAssertEqual(query["radius"], "1609", "1 mi rides the request in meters.")
    }

    func testEmptyBrowseFallsToEmptyState() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.emptyBrowseJSON)]
        let vm = makeVM()
        await vm.load()
        guard case .empty = vm.state else {
            return XCTFail("Expected .empty, got \(vm.state)")
        }
        XCTAssertNotNil(vm.radiusSuggestion, "0 active tasks still gets the widen-radius nudge.")
    }

    func testBrowseFailureTransitionsError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            return XCTFail("Expected .error, got \(vm.state)")
        }
    }

    func testSelectCategoryExitsBrowseToFlatList() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.browseJSON),
            .status(200, body: Self.flatJSON(Self.flatGigJSON))
        ]
        let vm = makeVM()
        await vm.load()
        await vm.selectCategory(.cleaning)
        XCTAssertFalse(vm.isBrowseMode)
        guard case let .loaded(rows) = vm.state else {
            return XCTFail("Expected flat .loaded, got \(vm.state)")
        }
        XCTAssertEqual(rows.first?.category, .cleaning)
        let (path, query) = lastQuery()
        XCTAssertEqual(path, "/api/gigs")
        XCTAssertEqual(query["category"], "cleaning")
    }

    func testSelectAllReturnsToBrowse() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.browseJSON),
            .status(200, body: Self.flatJSON(Self.flatGigJSON)),
            .status(200, body: Self.browseJSON)
        ]
        let vm = makeVM()
        await vm.load()
        await vm.selectCategory(.cleaning)
        await vm.selectCategory(.all)
        XCTAssertTrue(vm.isBrowseMode)
        guard case .browse = vm.state else {
            return XCTFail("Expected .browse after re-selecting All, got \(vm.state)")
        }
    }

    func testApplyFiltersExitsBrowseMode() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.browseJSON),
            .status(200, body: Self.flatJSON(Self.flatGigJSON))
        ]
        let vm = makeVM()
        await vm.load()
        await vm.applyFilters(GigFilterCriteria(budgetUpper: 100))
        XCTAssertFalse(vm.isBrowseMode, "Structured filters narrow the feed → flat list.")
        XCTAssertEqual(lastQuery().path, "/api/gigs")
    }

    func testSeeAllSwitchesToFlatListWithSectionSort() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.browseJSON),
            .status(200, body: Self.flatJSON(Self.flatGigJSON))
        ]
        let vm = makeVM()
        await vm.load()
        await vm.showAllFromBrowse(sort: .highestPay)
        XCTAssertFalse(vm.isBrowseMode)
        XCTAssertEqual(vm.activeSort, .highestPay)
        let (path, query) = lastQuery()
        XCTAssertEqual(path, "/api/gigs")
        XCTAssertEqual(query["sort"], "highest_pay")
        guard case .loaded = vm.state else {
            return XCTFail("Expected flat .loaded, got \(vm.state)")
        }
    }

    func testSeeAllThenAllChipRestoresBrowse() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.browseJSON),
            .status(200, body: Self.flatJSON(Self.flatGigJSON)),
            .status(200, body: Self.browseJSON)
        ]
        let vm = makeVM()
        await vm.load()
        await vm.showAllFromBrowse(sort: .urgency)
        XCTAssertFalse(vm.isBrowseMode)
        await vm.selectCategory(.all)
        XCTAssertTrue(vm.isBrowseMode, "Re-tapping All clears the See-all override.")
        guard case .browse = vm.state else {
            return XCTFail("Expected .browse, got \(vm.state)")
        }
    }

    func testSeeAllQuickJobsAppliesBudgetCeiling() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.browseJSON),
            .status(200, body: Self.flatJSON(Self.flatGigJSON))
        ]
        let vm = makeVM()
        await vm.load()
        await vm.showAllQuickJobs()
        XCTAssertFalse(vm.isBrowseMode)
        let (path, query) = lastQuery()
        XCTAssertEqual(path, "/api/gigs")
        XCTAssertEqual(query["maxPrice"], "100.0", "Quick jobs see-all narrows to the under-$100 band.")
    }
}
