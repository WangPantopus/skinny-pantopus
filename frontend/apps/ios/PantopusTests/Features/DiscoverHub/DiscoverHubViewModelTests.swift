//
//  DiscoverHubViewModelTests.swift
//  PantopusTests
//
//  T5.4.1 — Discover hub. Covers:
//    - load → loaded (sections in design-spec order: People · Businesses ·
//      Gigs · Listings) / empty / error transitions
//    - Empty section is hidden; whole-screen empty when all four are empty
//    - Each section uses `SectionStyle.card`, carries the count, and has
//      a `See all` handler
//    - Chip selection triggers a refetch
//    - Row mapping per type (avatar small + verified for People; gradient
//      icon for Businesses + Gigs; thumbnail for Listings; price stack
//      on Gigs / Listings)
//    - See-all targets emit the right `DiscoverHubTarget`
//

import XCTest
@testable import Pantopus

// swiftlint:disable file_length type_body_length

private enum Fixture {
    static let peopleJSON = """
    {"filter":"people","items":[
      {"id":"u1","type":"person","title":"Maria Kovacs",
       "meta":"4.7 stars · Elm Park","subtitle":"Elm Park, OR",
       "rating":4.7,"verified":true,
       "avatarUrl":null,"category":"People",
       "createdAt":"2026-05-12T10:00:00Z","route":"/user/u1"},
      {"id":"u2","type":"person","title":"David Chen",
       "meta":"5.0 stars · Elm Park","subtitle":"Elm Park, OR",
       "rating":5.0,"verified":true,
       "avatarUrl":null,"category":"People",
       "createdAt":"2026-05-13T10:00:00Z","route":"/user/u2"}
    ]}
    """

    static let businessesJSON = """
    {"filter":"businesses","items":[
      {"id":"b1","type":"business","title":"Big Tree Handyman",
       "meta":"4.9 stars · Portland","subtitle":"Handyman · Portland",
       "rating":4.9,"category":"Handyman","verified":true,
       "avatarUrl":null,"createdAt":"2026-05-10T10:00:00Z",
       "route":"/businesses/b1"}
    ]}
    """

    static let gigsJSON = """
    {"filter":"gigs","items":[
      {"id":"g1","type":"gig","title":"Assemble bed frame (Friday)",
       "meta":"$80 · Handyman","subtitle":"Posted by Sara T.",
       "price":"$80","category":"Handyman",
       "createdAt":"2026-05-14T08:00:00Z","isFree":false,
       "route":"/gigs/g1"},
      {"id":"g2","type":"gig","title":"Help lift couch",
       "meta":"$25 · Handyman","subtitle":"Posted by Michael D.",
       "price":"$25","category":"Handyman",
       "createdAt":"2026-05-14T09:00:00Z","isFree":false,
       "route":"/gigs/g2"}
    ]}
    """

    static let listingsJSON = """
    {"filter":"listings","items":[
      {"id":"l1","type":"listing","title":"Mid-century walnut credenza",
       "meta":"$240 · Furniture","subtitle":"Anika R. · Portland",
       "price":"$240","category":"Furniture",
       "avatarUrl":"https://example.com/c.jpg",
       "createdAt":"2026-05-12T10:00:00Z","isFree":false,"isWanted":false,
       "route":"/listings/l1"}
    ]}
    """

    static let emptyJSON = """
    {"filter":"x","items":[]}
    """

    static let personItem = HubDiscoveryResponse.Item(
        id: "u1",
        type: "person",
        title: "Maria",
        meta: "4.7 · Elm Park",
        category: "People",
        avatarUrl: nil,
        route: "/user/u1",
        subtitle: "Elm Park, OR",
        price: nil,
        rating: 4.7,
        verified: true,
        isFree: nil,
        isWanted: nil,
        createdAt: nil
    )

    static let gigItem = HubDiscoveryResponse.Item(
        id: "g1",
        type: "gig",
        title: "Assemble bed frame",
        meta: "$80 · Handyman",
        category: "Handyman",
        avatarUrl: nil,
        route: "/gigs/g1",
        subtitle: "Posted by Sara T.",
        price: "$80",
        rating: nil,
        verified: nil,
        isFree: false,
        isWanted: nil,
        createdAt: nil
    )

    static let listingItem = HubDiscoveryResponse.Item(
        id: "l1",
        type: "listing",
        title: "Walnut credenza",
        meta: "$240 · Furniture",
        category: "Furniture",
        avatarUrl: "https://example.com/c.jpg",
        route: "/listings/l1",
        subtitle: "Anika R. · Portland",
        price: "$240",
        rating: nil,
        verified: nil,
        isFree: false,
        isWanted: false,
        createdAt: nil
    )
}

private typealias StubResponse = SequencedURLProtocol.Response

private func discoveryResponses(
    people: StubResponse,
    businesses: StubResponse,
    gigs: StubResponse,
    listings: StubResponse,
    chip: String = DiscoverHubChip.nearby
) -> [String: [StubResponse]] {
    [
        discoveryRoute(filter: "people", chip: chip): [people],
        discoveryRoute(filter: "businesses", chip: chip): [businesses],
        discoveryRoute(filter: "gigs", chip: chip): [gigs],
        discoveryRoute(filter: "listings", chip: chip): [listings]
    ]
}

private func discoveryRoute(filter: String, chip: String) -> String {
    var query = ["filter": filter, "limit": "5"]
    if chip == DiscoverHubChip.newToday {
        query["since"] = "today"
    }
    if chip == DiscoverHubChip.verified {
        query["verified"] = "true"
    }
    if chip == DiscoverHubChip.freeOrWanted {
        query["freeOrWanted"] = "true"
    }
    let encoded = query
        .sorted { $0.key < $1.key }
        .map { "\($0.key)=\($0.value)" }
        .joined(separator: "&")
    return "/api/hub/discovery?\(encoded)"
}

@MainActor
final class DiscoverHubViewModelTests: XCTestCase {
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
        onSelect: @escaping @MainActor (DiscoverHubTarget) -> Void = { _ in },
        api: APIClient? = nil,
        onOpenMap: @escaping @MainActor () -> Void = {}
    ) -> DiscoverHubViewModel {
        DiscoverHubViewModel(api: api ?? makeAPI(), onSelect: onSelect, onOpenMap: onOpenMap)
    }

    private func makeOpenMapVM(
        onOpenMap: @escaping @MainActor () -> Void
    ) -> DiscoverHubViewModel {
        DiscoverHubViewModel(api: makeAPI(), onOpenMap: onOpenMap)
    }

    private func stubAll(
        people: StubResponse,
        businesses: StubResponse,
        gigs: StubResponse,
        listings: StubResponse,
        chip: String = DiscoverHubChip.nearby
    ) {
        SequencedURLProtocol.routeResponses = discoveryResponses(
            people: people,
            businesses: businesses,
            gigs: gigs,
            listings: listings,
            chip: chip
        )
    }

    // MARK: - Lifecycle

    func testLoadAllEmptyTransitionsToWholeScreenEmpty() async {
        stubAll(
            people: .status(200, body: Fixture.emptyJSON),
            businesses: .status(200, body: Fixture.emptyJSON),
            gigs: .status(200, body: Fixture.emptyJSON),
            listings: .status(200, body: Fixture.emptyJSON)
        )
        let vm = makeVM()
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected .empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "Nothing to discover yet")
        XCTAssertEqual(content.icon, .compass)
        XCTAssertNil(content.ctaTitle)
    }

    func testLoadAllFailedTransitionsToError() async {
        stubAll(
            people: .status(500, body: ""),
            businesses: .status(500, body: ""),
            gigs: .status(500, body: ""),
            listings: .status(500, body: "")
        )
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
    }

    func testLoadPopulatedRendersFourSectionsInDesignOrder() async {
        stubAll(
            people: .status(200, body: Fixture.peopleJSON),
            businesses: .status(200, body: Fixture.businessesJSON),
            gigs: .status(200, body: Fixture.gigsJSON),
            listings: .status(200, body: Fixture.listingsJSON)
        )
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections.count, 4)
        XCTAssertEqual(sections.map(\.id), [
            DiscoverHubSection.people,
            DiscoverHubSection.businesses,
            DiscoverHubSection.gigs,
            DiscoverHubSection.listings
        ])
        XCTAssertEqual(sections.map(\.header), ["People", "Businesses", "Gigs", "Listings"])
        for section in sections {
            if case .card = section.style {
                // ok
            } else {
                XCTFail("Expected card style, got \(section.style)")
            }
            XCTAssertNotNil(section.onSeeAll, "every section must wire See all")
            XCTAssertEqual(section.count, section.rows.count)
        }
    }

    func testEmptySectionIsHidden() async {
        stubAll(
            people: .status(200, body: Fixture.peopleJSON),
            businesses: .status(200, body: Fixture.emptyJSON),
            gigs: .status(200, body: Fixture.gigsJSON),
            listings: .status(200, body: Fixture.emptyJSON)
        )
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections.count, 2)
        XCTAssertEqual(sections.map(\.id), [
            DiscoverHubSection.people,
            DiscoverHubSection.gigs
        ])
    }

    func testTransportFailureOnOneTypeStillRendersOthers() async {
        stubAll(
            people: .status(200, body: Fixture.peopleJSON),
            businesses: .status(500, body: ""),
            gigs: .status(200, body: Fixture.gigsJSON),
            listings: .status(200, body: Fixture.listingsJSON)
        )
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        // Businesses dropped silently when its fetch fails.
        XCTAssertEqual(sections.map(\.id), [
            DiscoverHubSection.people,
            DiscoverHubSection.gigs,
            DiscoverHubSection.listings
        ])
    }

    // MARK: - Row mapping

    func testRowForPersonSetsAvatarSmallVerified() {
        let vm = makeVM()
        let item = Fixture.personItem
        let row = vm.rowForPerson(item)
        XCTAssertEqual(row.title, "Maria")
        XCTAssertEqual(row.subtitle, "Elm Park, OR")
        if case let .avatarWithBadge(_, _, _, size, verified) = row.leading {
            XCTAssertEqual(size, .small)
            XCTAssertTrue(verified)
        } else {
            XCTFail("Expected .avatarWithBadge, got \(row.leading)")
        }
        if case .chevron = row.trailing {
        } else {
            XCTFail("Expected .chevron, got \(row.trailing)")
        }
    }

    func testRowForGigSetsCategoryIconAndPriceStack() {
        let vm = makeVM()
        let item = Fixture.gigItem
        let row = vm.rowForGig(item)
        if case .categoryGradientIcon = row.leading {
        } else {
            XCTFail("Expected .categoryGradientIcon, got \(row.leading)")
        }
        if case let .priceStack(amount, _) = row.trailing {
            XCTAssertEqual(amount, "$80")
        } else {
            XCTFail("Expected .priceStack, got \(row.trailing)")
        }
    }

    func testRowForListingSetsThumbnailMediumAndPriceStack() {
        let vm = makeVM()
        let item = Fixture.listingItem
        let row = vm.rowForListing(item)
        if case let .thumbnail(_, size) = row.leading {
            XCTAssertEqual(size, .medium)
        } else {
            XCTFail("Expected .thumbnail, got \(row.leading)")
        }
        if case let .priceStack(amount, _) = row.trailing {
            XCTAssertEqual(amount, "$240")
        } else {
            XCTFail("Expected .priceStack, got \(row.trailing)")
        }
    }

    // MARK: - See all routing

    func testSeeAllPeopleEmitsSeeAllPeopleTarget() async {
        stubAll(
            people: .status(200, body: Fixture.peopleJSON),
            businesses: .status(200, body: Fixture.emptyJSON),
            gigs: .status(200, body: Fixture.emptyJSON),
            listings: .status(200, body: Fixture.emptyJSON)
        )
        var captured: DiscoverHubTarget?
        let vm = makeVM { captured = $0 }
        await vm.load()
        guard case let .loaded(sections, _) = vm.state,
              let people = sections.first(where: { $0.id == DiscoverHubSection.people }),
              let onSeeAll = people.onSeeAll
        else {
            XCTFail("Expected People section with See all handler")
            return
        }
        onSeeAll()
        XCTAssertEqual(captured, .seeAllPeople)
    }

    func testSeeAllListingsEmitsSeeAllListingsTarget() async {
        stubAll(
            people: .status(200, body: Fixture.emptyJSON),
            businesses: .status(200, body: Fixture.emptyJSON),
            gigs: .status(200, body: Fixture.emptyJSON),
            listings: .status(200, body: Fixture.listingsJSON)
        )
        var captured: DiscoverHubTarget?
        let vm = makeVM { captured = $0 }
        await vm.load()
        guard case let .loaded(sections, _) = vm.state,
              let listings = sections.first(where: { $0.id == DiscoverHubSection.listings }),
              let onSeeAll = listings.onSeeAll
        else {
            XCTFail("Expected Listings section with See all handler")
            return
        }
        onSeeAll()
        XCTAssertEqual(captured, .seeAllListings)
    }

    // MARK: - Chip selection

    func testSelectChipUpdatesSelectionAndRefetches() async {
        var responses = discoveryResponses(
            people: .status(200, body: Fixture.peopleJSON),
            businesses: .status(200, body: Fixture.emptyJSON),
            gigs: .status(200, body: Fixture.emptyJSON),
            listings: .status(200, body: Fixture.emptyJSON)
        )
        discoveryResponses(
            people: .status(200, body: Fixture.emptyJSON),
            businesses: .status(200, body: Fixture.emptyJSON),
            gigs: .status(200, body: Fixture.emptyJSON),
            listings: .status(200, body: Fixture.emptyJSON),
            chip: DiscoverHubChip.verified
        ).forEach { key, value in
            responses[key, default: []].append(contentsOf: value)
        }
        SequencedURLProtocol.routeResponses = responses
        let vm = makeVM()
        await vm.load()
        XCTAssertEqual(vm.selectedChip, DiscoverHubChip.nearby)

        vm.selectChip(DiscoverHubChip.verified)
        // Allow the refetch task to run.
        try? await Task.sleep(nanoseconds: 200_000_000)
        XCTAssertEqual(vm.selectedChip, DiscoverHubChip.verified)
        // Eight requests captured (four per fetchAll * two fetchAll calls).
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 8)
        // Last request must carry verified=true query param.
        let last = SequencedURLProtocol.capturedRequests.last
        XCTAssertEqual(
            last?.url?.query?.contains("verified=true"),
            true,
            "expected last request to carry verified=true; got \(last?.url?.query ?? "nil")"
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

    func testChipStripExposesAllFourChipsWithNearbyDefault() {
        let vm = makeVM()
        guard let chip = vm.chipStrip else {
            XCTFail("Expected a chip strip")
            return
        }
        XCTAssertEqual(chip.chips.map(\.id), [
            DiscoverHubChip.nearby,
            DiscoverHubChip.newToday,
            DiscoverHubChip.verified,
            DiscoverHubChip.freeOrWanted
        ])
        XCTAssertEqual(chip.selectedId, DiscoverHubChip.nearby)
    }

    @MainActor
    func testOpenMapFABNavigatesToExploreMap() {
        var didOpenMap = false
        let vm = makeOpenMapVM {
            didOpenMap = true
        }

        let fab = vm.fab
        XCTAssertEqual(fab?.icon, .map)
        XCTAssertEqual(fab?.accessibilityLabel, "Open map")
        if case let .extendedNav(label) = fab?.variant {
            XCTAssertEqual(label, "Open map")
        } else {
            XCTFail("DiscoverHub FAB should use the extended navigation variant.")
        }

        fab?.handler()
        XCTAssertTrue(didOpenMap)
    }

    func testNoTabs() {
        let vm = makeVM()
        XCTAssertTrue(vm.tabs.isEmpty)
    }

    // MARK: - Filters (P5.2)

    func testDefaultTopBarActionHasNoBadge() {
        let vm = makeVM()
        XCTAssertNil(vm.topBarAction?.badgeCount)
        XCTAssertEqual(vm.filters.activeCount, 0)
    }

    func testApplyFiltersContentTypeShowsOnlySelectedSections() async {
        SequencedURLProtocol.routeResponses = [
            discoveryRoute(filter: "people", chip: DiscoverHubChip.nearby):
                [.status(200, body: Fixture.peopleJSON), .status(200, body: Fixture.peopleJSON)],
            discoveryRoute(filter: "businesses", chip: DiscoverHubChip.nearby):
                [.status(200, body: Fixture.businessesJSON), .status(200, body: Fixture.businessesJSON)],
            discoveryRoute(filter: "gigs", chip: DiscoverHubChip.nearby):
                [.status(200, body: Fixture.gigsJSON), .status(200, body: Fixture.gigsJSON)],
            discoveryRoute(filter: "listings", chip: DiscoverHubChip.nearby):
                [.status(200, body: Fixture.listingsJSON), .status(200, body: Fixture.listingsJSON)]
        ]
        let vm = makeVM()
        await vm.load()
        vm.applyFilters(DiscoverHubFilters(
            contentTypes: [DiscoverHubSection.people, DiscoverHubSection.gigs]
        ))
        try? await Task.sleep(nanoseconds: 150_000_000)

        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections.map(\.id), [DiscoverHubSection.people, DiscoverHubSection.gigs])
        XCTAssertEqual(vm.filters.activeCount, 1)
        XCTAssertEqual(vm.topBarAction?.badgeCount, 1)
    }

    func testApplyFiltersVerifiedOnlyUsesVerifiedQuery() async {
        SequencedURLProtocol.routeResponses = [
            discoveryRoute(filter: "people", chip: DiscoverHubChip.nearby): [.status(200, body: Fixture.emptyJSON)],
            discoveryRoute(filter: "businesses", chip: DiscoverHubChip.nearby): [.status(200, body: Fixture.emptyJSON)],
            discoveryRoute(filter: "gigs", chip: DiscoverHubChip.nearby): [.status(200, body: Fixture.emptyJSON)],
            discoveryRoute(filter: "listings", chip: DiscoverHubChip.nearby): [.status(200, body: Fixture.emptyJSON)],
            discoveryRoute(filter: "people", chip: DiscoverHubChip.verified): [.status(200, body: Fixture.peopleJSON)],
            discoveryRoute(filter: "businesses", chip: DiscoverHubChip.verified): [.status(200, body: Fixture.emptyJSON)],
            discoveryRoute(filter: "gigs", chip: DiscoverHubChip.verified): [.status(200, body: Fixture.emptyJSON)],
            discoveryRoute(filter: "listings", chip: DiscoverHubChip.verified): [.status(200, body: Fixture.emptyJSON)]
        ]
        let vm = makeVM()
        await vm.load()
        vm.applyFilters(DiscoverHubFilters(verifiedOnly: true))
        try? await Task.sleep(nanoseconds: 150_000_000)

        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded after verified filter, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections.map(\.id), [DiscoverHubSection.people])
        XCTAssertEqual(vm.filters.activeCount, 1)
        XCTAssertEqual(vm.topBarAction?.badgeCount, 1)
    }

    func testApplyFiltersNewestFirstReordersByCreatedAt() async {
        SequencedURLProtocol.routeResponses = [
            discoveryRoute(filter: "people", chip: DiscoverHubChip.nearby):
                [.status(200, body: Fixture.emptyJSON), .status(200, body: Fixture.emptyJSON)],
            discoveryRoute(filter: "businesses", chip: DiscoverHubChip.nearby):
                [.status(200, body: Fixture.emptyJSON), .status(200, body: Fixture.emptyJSON)],
            discoveryRoute(filter: "gigs", chip: DiscoverHubChip.nearby):
                [.status(200, body: Fixture.gigsJSON), .status(200, body: Fixture.gigsJSON)],
            discoveryRoute(filter: "listings", chip: DiscoverHubChip.nearby):
                [.status(200, body: Fixture.emptyJSON), .status(200, body: Fixture.emptyJSON)]
        ]
        let vm = makeVM()
        await vm.load()
        // g1 (08:00) then g2 (09:00) in fixture order.
        vm.applyFilters(DiscoverHubFilters(newestFirst: true))
        try? await Task.sleep(nanoseconds: 150_000_000)

        guard case let .loaded(sections, _) = vm.state,
              let gigs = sections.first(where: { $0.id == DiscoverHubSection.gigs }) else {
            XCTFail("Expected a gigs section, got \(vm.state)")
            return
        }
        // Newest-first: g2 (09:00) ahead of g1 (08:00).
        XCTAssertEqual(gigs.rows.map(\.id), ["gig-g2", "gig-g1"])
    }
}
