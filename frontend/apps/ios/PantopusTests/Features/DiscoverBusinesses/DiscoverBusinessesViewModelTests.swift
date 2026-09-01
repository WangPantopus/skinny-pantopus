//
//  DiscoverBusinessesViewModelTests.swift
//  PantopusTests
//
//  T5.4.2 — Discover businesses. Covers:
//    - load → loaded (sections grouped by category in chip order) /
//      empty / error transitions
//    - 400 from backend → no-location empty state with Widen-radius CTA
//    - Chip selection filters to a single section + passes the chip id
//      as `categories=` on the next request
//    - Search text triggers a refetch with `q=` after debounce
//    - Row mapping uses the category-tinted gradient icon, chevron
//      trailing, and the design's subtitle composition
//

import XCTest
@testable import Pantopus

// swiftlint:disable file_length

private enum Fixture {
    /// Two handyman businesses + one cleaning business + one with
    /// an unrecognised category — exercises grouping + the "other"
    /// bucket.
    static let mixedJSON = """
    {
      "results": [
        {
          "business_user_id": "b1",
          "username": "bigtree",
          "name": "Big Tree Handyman",
          "profile_picture_url": null,
          "categories": ["handyman", "repair"],
          "description": "Old-house specialist",
          "business_type": "company",
          "average_rating": 4.9,
          "review_count": 32,
          "distance_miles": 0.4,
          "distance_meters": 644,
          "neighbor_count": 0,
          "endorsement_count": 0,
          "is_open_now": true,
          "is_new_business": false,
          "city": "Portland",
          "state": "OR",
          "verification_status": "document_verified",
          "verification_badge": "verified",
          "founding_badge": false
        },
        {
          "business_user_id": "b2",
          "username": "nwfixers",
          "name": "Northwest Fixers",
          "profile_picture_url": null,
          "categories": ["handyman"],
          "description": "Small jobs, same-day quotes",
          "business_type": "sole",
          "average_rating": 4.7,
          "review_count": 12,
          "distance_miles": 1.1,
          "distance_meters": 1770,
          "neighbor_count": 0,
          "endorsement_count": 0,
          "is_open_now": false,
          "is_new_business": false,
          "city": "Portland",
          "state": "OR",
          "verification_status": "unverified",
          "verification_badge": null,
          "founding_badge": false
        },
        {
          "business_user_id": "b3",
          "username": "cleanbee",
          "name": "Clean Bee PDX",
          "profile_picture_url": null,
          "categories": ["cleaning"],
          "description": "Eco-friendly · Deep cleans",
          "business_type": "company",
          "average_rating": 4.8,
          "review_count": 18,
          "distance_miles": 0.6,
          "distance_meters": 966,
          "neighbor_count": 0,
          "endorsement_count": 0,
          "is_open_now": true,
          "is_new_business": false,
          "city": "Portland",
          "state": "OR",
          "verification_status": "document_verified",
          "verification_badge": "verified",
          "founding_badge": false
        },
        {
          "business_user_id": "b4",
          "username": "weirdco",
          "name": "Weird Co.",
          "profile_picture_url": null,
          "categories": ["nightclub"],
          "description": null,
          "business_type": "company",
          "average_rating": 4.0,
          "review_count": 3,
          "distance_miles": 2.0,
          "distance_meters": 3219,
          "neighbor_count": 0,
          "endorsement_count": 0,
          "is_open_now": null,
          "is_new_business": false,
          "city": "Portland",
          "state": "OR",
          "verification_status": "unverified",
          "verification_badge": null,
          "founding_badge": false
        }
      ],
      "pagination": {"page": 1, "page_size": 50, "total_count": 4, "total_pages": 1, "has_more": false},
      "sort": "relevance",
      "sort_label": "Most hired nearby",
      "banner": null,
      "filters_active": {}
    }
    """

    static let emptyJSON = """
    {
      "results": [],
      "pagination": {"page": 1, "page_size": 50, "total_count": 0, "total_pages": 0, "has_more": false},
      "sort": "relevance",
      "sort_label": "Most hired nearby",
      "banner": null,
      "filters_active": {}
    }
    """

    static let handymanItem = BusinessDiscoverySearchResponse.Item(
        businessUserId: "b1",
        username: "bigtree",
        name: "Big Tree Handyman",
        profilePictureUrl: nil,
        categories: ["handyman"],
        description: "Old-house specialist",
        businessType: "company",
        averageRating: 4.9,
        reviewCount: 32,
        distanceMiles: 0.4,
        isOpenNow: true,
        isNewBusiness: false,
        city: "Portland",
        state: "OR",
        verificationStatus: "document_verified",
        verificationBadge: "verified",
        foundingBadge: false
    )
}

private typealias StubResponse = SequencedURLProtocol.Response

@MainActor
final class DiscoverBusinessesViewModelTests: XCTestCase {
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

    private func makeVM(
        onSelect: @escaping @MainActor (DiscoverBusinessesTarget) -> Void = { _ in },
        api: APIClient? = nil
    ) -> DiscoverBusinessesViewModel {
        DiscoverBusinessesViewModel(api: api ?? makeAPI(), onSelect: onSelect)
    }

    private func stub(_ responses: [StubResponse]) {
        SequencedURLProtocol.sequence = responses
    }

    // MARK: - Lifecycle

    func testLoadEmptyTransitionsToEmptyState() async {
        stub([.status(200, body: Fixture.emptyJSON)])
        let vm = makeVM()
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected .empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "No verified businesses nearby yet")
        XCTAssertEqual(content.ctaTitle, "Invite a business")
    }

    func testLoad400TransitionsToNoLocationEmptyState() async {
        stub([.status(400, body: "{\"error\":\"Location required\"}")])
        let vm = makeVM()
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected .empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "Set a home address")
        XCTAssertEqual(content.ctaTitle, "Set a home address")
    }

    func testLoadServerErrorTransitionsToError() async {
        stub([.status(500, body: "")])
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
    }

    func testLoadPopulatedGroupsByCategoryInChipOrder() async {
        stub([.status(200, body: Fixture.mixedJSON)])
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        // Handyman (chip order #1), Cleaning (#2), Other (unrecognised
        // `nightclub` category) — in that order.
        XCTAssertEqual(sections.map(\.id), [
            DiscoverBusinessesChip.handyman,
            DiscoverBusinessesChip.cleaning,
            DiscoverBusinessesSection.other
        ])
        XCTAssertEqual(sections.map(\.header), ["Handyman", "Cleaning", "Other"])
        for section in sections {
            if case .card = section.style {
                // ok
            } else {
                XCTFail("Expected card style, got \(section.style)")
            }
            XCTAssertEqual(section.count, section.rows.count)
        }
        // Handyman section has both b1 and b2.
        XCTAssertEqual(sections[0].rows.count, 2)
        XCTAssertEqual(sections[0].rows.map(\.id), ["business-b1", "business-b2"])
    }

    // MARK: - Chip filtering

    func testChipSelectionCollapsesToSingleSection() async {
        stub([
            .status(200, body: Fixture.mixedJSON),
            .status(200, body: Fixture.mixedJSON)
        ])
        let vm = makeVM()
        await vm.load()

        vm.selectChip(DiscoverBusinessesChip.handyman)
        // Allow the refetch task to settle.
        try? await Task.sleep(nanoseconds: 100_000_000)

        XCTAssertEqual(vm.selectedChip, DiscoverBusinessesChip.handyman)
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections.count, 1)
        XCTAssertEqual(sections[0].id, DiscoverBusinessesChip.handyman)
        XCTAssertEqual(sections[0].header, "Handyman")
    }

    func testChipSelectionPassesCategoriesQuery() async {
        stub([
            .status(200, body: Fixture.mixedJSON),
            .status(200, body: Fixture.mixedJSON)
        ])
        let vm = makeVM()
        await vm.load()
        let beforeCount = SequencedURLProtocol.capturedRequests.count

        vm.selectChip(DiscoverBusinessesChip.cleaning)
        try? await Task.sleep(nanoseconds: 100_000_000)

        XCTAssertGreaterThan(
            SequencedURLProtocol.capturedRequests.count,
            beforeCount,
            "expected an additional captured request after selectChip"
        )
        let last = SequencedURLProtocol.capturedRequests.last
        XCTAssertEqual(
            last?.url?.query?.contains("categories=cleaning"),
            true,
            "expected last request to carry categories=cleaning; got \(last?.url?.query ?? "nil")"
        )
    }

    func testAllChipOmitsCategoriesQuery() async {
        stub([
            .status(200, body: Fixture.mixedJSON),
            .status(200, body: Fixture.mixedJSON)
        ])
        let vm = makeVM()
        await vm.load()

        // First request (load) — All is the default; categories must be
        // absent from the query string.
        let first = SequencedURLProtocol.capturedRequests.first
        XCTAssertEqual(
            first?.url?.query?.contains("categories="),
            false,
            "expected first request not to carry categories=; got \(first?.url?.query ?? "nil")"
        )
    }

    // MARK: - Search

    func testSubmitSearchPassesQueryParam() async {
        stub([
            .status(200, body: Fixture.mixedJSON),
            .status(200, body: Fixture.mixedJSON)
        ])
        let vm = makeVM()
        await vm.load()
        let beforeCount = SequencedURLProtocol.capturedRequests.count

        vm.setSearchText("tree")
        vm.submitSearch()
        try? await Task.sleep(nanoseconds: 100_000_000)

        XCTAssertGreaterThan(
            SequencedURLProtocol.capturedRequests.count,
            beforeCount,
            "expected an additional captured request after submitSearch"
        )
        let last = SequencedURLProtocol.capturedRequests.last
        XCTAssertEqual(
            last?.url?.query?.contains("q=tree"),
            true,
            "expected last request to carry q=tree; got \(last?.url?.query ?? "nil")"
        )
    }

    // MARK: - Row mapping

    func testRowForBusinessUsesCategoryGradientIconAndChevron() {
        let vm = makeVM()
        let row = vm.rowForBusiness(Fixture.handymanItem)
        XCTAssertEqual(row.id, "business-b1")
        XCTAssertEqual(row.title, "Big Tree Handyman")
        XCTAssertNotNil(row.subtitle)
        XCTAssertTrue(row.subtitle?.contains("Old-house specialist") ?? false)
        XCTAssertTrue(row.subtitle?.contains("Open now") ?? false)
        XCTAssertTrue(row.subtitle?.contains("0.4 mi") ?? false)

        if case .categoryGradientIcon = row.leading {
            // ok
        } else {
            XCTFail("Expected .categoryGradientIcon, got \(row.leading)")
        }
        if case .chevron = row.trailing {
            // ok
        } else {
            XCTFail("Expected .chevron, got \(row.trailing)")
        }
    }

    func testRowTapEmitsBusinessTarget() {
        var captured: DiscoverBusinessesTarget?
        let vm = makeVM { captured = $0 }
        let row = vm.rowForBusiness(Fixture.handymanItem)
        row.onTap()
        XCTAssertEqual(captured, .business(businessId: "b1", name: "Big Tree Handyman"))
    }

    // MARK: - Primary-category projection

    func testPrimaryCategoryKeyMatchesFirstKnownCategory() {
        XCTAssertEqual(
            DiscoverBusinessesViewModel.primaryCategoryKey(["unknown", "Pet Care"]),
            DiscoverBusinessesChip.petCare
        )
        XCTAssertEqual(
            DiscoverBusinessesViewModel.primaryCategoryKey(["lawn_care"]),
            DiscoverBusinessesChip.lawnCare
        )
        XCTAssertEqual(
            DiscoverBusinessesViewModel.primaryCategoryKey(["totally_made_up"]),
            DiscoverBusinessesSection.other
        )
    }

    // MARK: - Chrome

    func testTopBarActionIsSlidersHorizontal() {
        let vm = makeVM()
        guard let action = vm.topBarAction else {
            XCTFail("Expected a top-bar action")
            return
        }
        XCTAssertEqual(action.icon, .slidersHorizontal)
    }

    func testChipStripExposesAllCategoryChipsWithAllDefault() {
        let vm = makeVM()
        guard let chip = vm.chipStrip else {
            XCTFail("Expected a chip strip")
            return
        }
        XCTAssertEqual(chip.chips.map(\.id), DiscoverBusinessesChip.order)
        XCTAssertEqual(chip.selectedId, DiscoverBusinessesChip.all)
    }

    func testNoFAB() {
        let vm = makeVM()
        XCTAssertNil(vm.fab)
    }

    func testNoTabs() {
        let vm = makeVM()
        XCTAssertTrue(vm.tabs.isEmpty)
    }

    func testSearchBarSlotIsPresent() {
        let vm = makeVM()
        XCTAssertNotNil(vm.searchBar)
        XCTAssertEqual(vm.searchBar?.placeholder, "Search businesses or services")
    }

    // MARK: - Filters (P5.2)

    func testDefaultTopBarActionHasNoBadge() {
        let vm = makeVM()
        XCTAssertNil(vm.topBarAction?.badgeCount)
        XCTAssertEqual(vm.filters.activeCount, 0)
    }

    func testApplyFiltersPassesServerParams() async {
        stub([
            .status(200, body: Fixture.mixedJSON),
            .status(200, body: Fixture.mixedJSON)
        ])
        let vm = makeVM()
        await vm.load()
        let before = SequencedURLProtocol.capturedRequests.count

        vm.applyFilters(DiscoverBusinessFilters(
            categories: ["home-services"],
            radiusMiles: 1,
            openNow: true,
            ratingFloor: 4
        ))
        try? await Task.sleep(nanoseconds: 150_000_000)

        XCTAssertGreaterThan(SequencedURLProtocol.capturedRequests.count, before)
        let query = SequencedURLProtocol.capturedRequests.last?.url?.query ?? ""
        XCTAssertTrue(query.contains("radius_miles=1.0"), query)
        XCTAssertTrue(query.contains("open_now=true"), query)
        XCTAssertTrue(query.contains("rating_min=4.0"), query)
        XCTAssertTrue(query.contains("categories=home-services"), query)
        XCTAssertEqual(vm.filters.activeCount, 4)
        XCTAssertEqual(vm.topBarAction?.badgeCount, 4)
    }

    func testApplyDefaultFiltersOmitsServerParams() async {
        stub([
            .status(200, body: Fixture.mixedJSON),
            .status(200, body: Fixture.mixedJSON)
        ])
        let vm = makeVM()
        await vm.load()

        vm.applyFilters(.default)
        try? await Task.sleep(nanoseconds: 150_000_000)

        let query = SequencedURLProtocol.capturedRequests.last?.url?.query ?? ""
        XCTAssertFalse(query.contains("radius_miles="), query)
        XCTAssertFalse(query.contains("open_now="), query)
        XCTAssertFalse(query.contains("rating_min="), query)
        XCTAssertNil(vm.topBarAction?.badgeCount)
    }

    func testCategoryFilterUnionsWithChipSelection() async {
        stub([
            .status(200, body: Fixture.mixedJSON),
            .status(200, body: Fixture.mixedJSON),
            .status(200, body: Fixture.mixedJSON)
        ])
        let vm = makeVM()
        await vm.load()
        vm.selectChip(DiscoverBusinessesChip.handyman)
        try? await Task.sleep(nanoseconds: 120_000_000)

        vm.applyFilters(DiscoverBusinessFilters(categories: ["home-services"]))
        try? await Task.sleep(nanoseconds: 150_000_000)

        let query = SequencedURLProtocol.capturedRequests.last?.url?.query ?? ""
        // The fine chip (handyman) and the coarse sheet category
        // (home-services) both flow into `categories=`.
        XCTAssertTrue(query.contains("handyman"), query)
        XCTAssertTrue(query.contains("home-services"), query)
    }
}
