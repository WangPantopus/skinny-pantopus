//
//  UniversalSearchViewModelTests.swift
//  PantopusTests
//
//  S2 — covers the pure projections behind the universal-search screen:
//    - the 2-character threshold hint (RN `formatThresholdHint`)
//    - locality / price formatting
//    - Beacon handle extraction from the identity-search `href`
//    - the drawer's "Search" row now lands on universal search rather
//      than the gig-only search screen.
//

import XCTest
@testable import Pantopus

@MainActor
final class UniversalSearchViewModelTests: XCTestCase {
    func testThresholdHintOnlyBelowTwoCharacters() {
        let viewModel = UniversalSearchViewModel()
        XCTAssertNil(viewModel.thresholdHint)

        viewModel.query = "a"
        XCTAssertEqual(viewModel.thresholdHint, "Type 1 more character to search.")

        viewModel.query = "ab"
        XCTAssertNil(viewModel.thresholdHint)
    }

    func testShortQueryStaysIdleAndIssuesNoRequest() {
        let viewModel = UniversalSearchViewModel()
        viewModel.query = "a"
        viewModel.onQueryChanged()
        XCTAssertEqual(viewModel.state, .idle)
    }

    func testLocalityJoinsPresentHalvesOnly() {
        XCTAssertEqual(UniversalSearchViewModel.locality(city: "Camas", state: "WA"), "Camas, WA")
        XCTAssertEqual(UniversalSearchViewModel.locality(city: "Camas", state: nil), "Camas")
        XCTAssertEqual(UniversalSearchViewModel.locality(city: nil, state: "WA"), "WA")
        XCTAssertNil(UniversalSearchViewModel.locality(city: nil, state: nil))
        XCTAssertNil(UniversalSearchViewModel.locality(city: "  ", state: nil))
    }

    func testPriceLabelRoundsToWholeDollars() {
        XCTAssertEqual(UniversalSearchViewModel.priceLabel(80), "$80")
        XCTAssertEqual(UniversalSearchViewModel.priceLabel(79.6), "$80")
        XCTAssertNil(UniversalSearchViewModel.priceLabel(nil))
    }

    func testBeaconHandlePrefersHrefThenSubtitleThenId() {
        let fromAtHref = UniversalSearchProfileDTO(id: "p1", href: "/@mariak")
        XCTAssertEqual(UniversalSearchViewModel.beaconHandle(for: fromAtHref), "mariak")

        let fromPersonaHref = UniversalSearchProfileDTO(id: "p2", href: "/persona/davidc?ref=x")
        XCTAssertEqual(UniversalSearchViewModel.beaconHandle(for: fromPersonaHref), "davidc")

        let fromSubtitle = UniversalSearchProfileDTO(id: "p3", subtitle: "@anika")
        XCTAssertEqual(UniversalSearchViewModel.beaconHandle(for: fromSubtitle), "anika")

        let fallback = UniversalSearchProfileDTO(id: "p4")
        XCTAssertEqual(UniversalSearchViewModel.beaconHandle(for: fallback), "p4")
    }

    func testDrawerSearchRowRoutesToUniversalSearch() {
        let route = HubTabRoot.route(forDrawer: .search, context: .personal(name: ""))
        XCTAssertEqual(route, .universalSearch)
    }

    func testResultDestinationsMapOntoHubRoutes() {
        XCTAssertEqual(
            HubTabRoot.route(forUniversalSearch: .task(gigId: "g1")),
            .gigDetail(gigId: "g1")
        )
        XCTAssertEqual(
            HubTabRoot.route(forUniversalSearch: .person(userId: "u1")),
            .publicProfile(userId: "u1")
        )
        XCTAssertEqual(
            HubTabRoot.route(forUniversalSearch: .beacon(handle: "mariak")),
            .beaconProfile(handle: "mariak")
        )
        XCTAssertEqual(
            HubTabRoot.route(forUniversalSearch: .business(businessId: "b1")),
            .businessProfile(businessId: "b1")
        )
        XCTAssertEqual(
            HubTabRoot.route(forUniversalSearch: .home(homeId: "h1")),
            .homeDashboard(homeId: "h1")
        )
    }
}
