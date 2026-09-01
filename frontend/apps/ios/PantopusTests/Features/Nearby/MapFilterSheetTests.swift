//
//  MapFilterSheetTests.swift
//  PantopusTests
//
//  P5.3 — Contract tests for the Nearby map filter sheet. Covers the
//  criteria ↔ sections projection, the entity-type / distance
//  predicates, and the map view-model re-projecting its fetched
//  entities when a filter is applied.
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class MapFilterSheetTests: XCTestCase {
    private let center = UserCoordinate(latitude: 40.7484, longitude: -73.9857, accuracyMeters: 50)

    override func setUp() {
        super.setUp()
        URLProtocolStub.reset()
    }

    // MARK: - Criteria ↔ sections

    func testDefaultCriteriaHasNoActiveFilters() {
        XCTAssertEqual(MapFilterCriteria().activeCount, 0)
    }

    func testSectionsLeadWithEntityTypeThenDistanceThenGigDimensions() {
        let ids = MapFilterCriteria().sections().map(\.id)
        // The map keeps its own radius range AND the gig radius presets, so
        // "distance" appears twice by design — retitled "Gig radius" the second
        // time. Both parse sides discriminate on control type.
        XCTAssertEqual(ids, [
            "entityType", "distance", "category", "budget", "schedule", "openToBids", "postedWithin",
            "distance", "deadline", "archetype"
        ])
    }

    func testParseRoundTripPreservesEverySelection() {
        let criteria = MapFilterCriteria(
            entityType: .gigs,
            distanceLower: 0,
            distanceUpper: 2,
            gig: GigFilterCriteria(categories: [.handyman], openToBids: true, postedWithin: .today)
        )
        XCTAssertEqual(MapFilterCriteria(sections: criteria.sections()), criteria)
    }

    func testActiveCountIncludesEntityTypeAndDistance() {
        let criteria = MapFilterCriteria(
            entityType: .listings,
            distanceLower: 0,
            distanceUpper: 3,
            gig: GigFilterCriteria(categories: [.moving])
        )
        XCTAssertEqual(criteria.activeCount, 3, "entity-type + distance + one gig dimension")
    }

    func testEntityTypeGating() {
        XCTAssertTrue(MapEntityType.both.allowsGigs)
        XCTAssertTrue(MapEntityType.both.allowsListings)
        XCTAssertTrue(MapEntityType.gigs.allowsGigs)
        XCTAssertFalse(MapEntityType.gigs.allowsListings)
        XCTAssertFalse(MapEntityType.listings.allowsGigs)
        XCTAssertTrue(MapEntityType.listings.allowsListings)
    }

    func testDistancePredicate() {
        let criteria = MapFilterCriteria(distanceLower: 0, distanceUpper: 2)
        XCTAssertTrue(criteria.matchesDistance(1))
        XCTAssertFalse(criteria.matchesDistance(3))
        XCTAssertFalse(criteria.matchesDistance(nil), "unknown distance fails when the radius is active")
        XCTAssertTrue(MapFilterCriteria().matchesDistance(nil), "inactive distance passes everything")
    }

    func testSheetConstructs() {
        let sheet = MapFilterSheet(criteria: MapFilterCriteria(), onApply: { _ in }, onClose: {})
        _ = UIHostingController(rootView: sheet)
    }

    // MARK: - View-model integration

    private func makeAPI() -> APIClient {
        APIClient(environment: .current, session: TestSession.make(), retryPolicy: .none)
    }

    private static let handymanGigJSON = """
    { "id": "g1", "title": "Hang shelves", "price": 60, "category": "handyman",
      "status": "open", "user_id": "u1", "bid_count": 4,
      "latitude": 40.749, "longitude": -73.984 }
    """

    private static let cleaningGigJSON = """
    { "id": "g2", "title": "Deep clean", "price": 40, "category": "cleaning",
      "status": "open", "user_id": "u2", "bid_count": 0,
      "latitude": 40.747, "longitude": -73.986 }
    """

    private static let listingJSON = """
    { "id": "l1", "title": "Lightly-used couch", "category": "moving",
      "price": 250, "latitude": 40.750, "longitude": -73.985 }
    """

    private func stubCombined() {
        URLProtocolStub.stub(
            path: "/api/gigs/in-bounds",
            response: .json("{\"gigs\":[\(Self.handymanGigJSON),\(Self.cleaningGigJSON)]}")
        )
        URLProtocolStub.stub(
            path: "/api/listings/in-bounds",
            response: .json("{\"listings\":[\(Self.listingJSON)]}")
        )
    }

    private func makeLoadedVM() async -> NearbyMapViewModel {
        stubCombined()
        let vm = NearbyMapViewModel(api: makeAPI(), location: FixedLocationProvider(center))
        await vm.load()
        return vm
    }

    private func entities(of vm: NearbyMapViewModel) -> [MapEntity] {
        guard case let .loaded(loaded) = vm.state else { return [] }
        return loaded.entities
    }

    func testEntityTypeGigsHidesListings() async {
        let vm = await makeLoadedVM()
        XCTAssertEqual(entities(of: vm).count, 3)
        vm.applyFilters(MapFilterCriteria(entityType: .gigs))
        let kept = entities(of: vm)
        XCTAssertEqual(kept.count, 2)
        XCTAssertTrue(kept.allSatisfy { $0.kind == .gig })
    }

    func testEntityTypeListingsHidesGigs() async {
        let vm = await makeLoadedVM()
        vm.applyFilters(MapFilterCriteria(entityType: .listings))
        let kept = entities(of: vm)
        XCTAssertEqual(kept.map(\.id), ["l1"])
    }

    func testCategoryFilterAppliesToGigsAndListings() async {
        let vm = await makeLoadedVM()
        vm.applyFilters(MapFilterCriteria(gig: GigFilterCriteria(categories: [.handyman])))
        XCTAssertEqual(entities(of: vm).map(\.id), ["g1"])
    }

    func testBudgetFilterAppliesAcrossKinds() async {
        let vm = await makeLoadedVM()
        vm.applyFilters(MapFilterCriteria(gig: GigFilterCriteria(budgetLower: 0, budgetUpper: 100)))
        // $60 gig + $40 gig survive; the $250 listing is filtered out.
        XCTAssertEqual(Set(entities(of: vm).map(\.id)), ["g1", "g2"])
    }

    func testTightRadiusExcludesEverything() async {
        let vm = await makeLoadedVM()
        vm.applyFilters(MapFilterCriteria(distanceLower: 0, distanceUpper: 0.01))
        XCTAssertTrue(entities(of: vm).isEmpty)
    }
}
