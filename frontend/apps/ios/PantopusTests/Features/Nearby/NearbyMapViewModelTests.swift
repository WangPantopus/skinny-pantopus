//
//  NearbyMapViewModelTests.swift
//  PantopusTests
//
//  Covers the Nearby map VM (T2.4): combined gigs + listings load,
//  category filter triggers a refetch, sheet-stop transitions,
//  selection mirror, and error fallback when both endpoints fail.
//

import CoreLocation
import XCTest
@testable import Pantopus

@MainActor
final class NearbyMapViewModelTests: XCTestCase {
    private let center = UserCoordinate(latitude: 40.7484, longitude: -73.9857, accuracyMeters: 50)

    override func setUp() {
        super.setUp()
        URLProtocolStub.reset()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: TestSession.make(),
            retryPolicy: .none
        )
    }

    private static let gigJSON = """
    {
      "id": "g1",
      "title": "Hang 3 floating shelves",
      "description": "Need 3 IKEA Lack shelves mounted.",
      "price": 60,
      "category": "handyman",
      "status": "open",
      "user_id": "u1",
      "bid_count": 4,
      "latitude": 40.749,
      "longitude": -73.984
    }
    """

    private static let pendingGigJSON = """
    {
      "id": "g2",
      "title": "Pending cleanup",
      "price": 40,
      "category": "cleaning",
      "status": "pending",
      "user_id": "u1",
      "latitude": 40.747,
      "longitude": -73.986
    }
    """

    private static let listingJSON = """
    {
      "id": "l1",
      "title": "Lightly-used couch",
      "category": "moving",
      "layer": "marketplace",
      "price": 250,
      "latitude": 40.750,
      "longitude": -73.985
    }
    """

    private static func gigsBoundsJSON(_ rows: String...) -> String {
        "{\"gigs\":[\(rows.joined(separator: ","))]}"
    }

    private static func listingsBoundsJSON(_ rows: String...) -> String {
        "{\"listings\":[\(rows.joined(separator: ","))]}"
    }

    func testLoadCombinesGigsAndListings() async {
        URLProtocolStub.stub(
            path: "/api/gigs/in-bounds",
            response: .json(Self.gigsBoundsJSON(Self.gigJSON, Self.pendingGigJSON))
        )
        URLProtocolStub.stub(
            path: "/api/listings/in-bounds",
            response: .json(Self.listingsBoundsJSON(Self.listingJSON))
        )
        let vm = NearbyMapViewModel(
            api: makeAPI(),
            location: FixedLocationProvider(center)
        )
        await vm.load()
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(loaded.entities.count, 3)
        let gigs = loaded.entities.filter { $0.kind == .gig }
        let listings = loaded.entities.filter { $0.kind == .listing }
        XCTAssertEqual(gigs.count, 2)
        XCTAssertEqual(listings.count, 1)
        let pending = gigs.first { $0.id == "g2" }
        XCTAssertEqual(pending?.state, .pending)
    }

    func testLoadFallsBackToErrorWhenBothEndpointsFail() async {
        URLProtocolStub.stub(path: "/api/gigs/in-bounds", response: .json("{}", status: 500))
        URLProtocolStub.stub(path: "/api/listings/in-bounds", response: .json("{}", status: 500))
        let vm = NearbyMapViewModel(
            api: makeAPI(),
            location: FixedLocationProvider(center)
        )
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error when both endpoints fail")
            return
        }
    }

    func testSelectCategoryRefetches() async {
        URLProtocolStub.stub(
            path: "/api/gigs/in-bounds",
            responses: [
                .json(Self.gigsBoundsJSON(Self.gigJSON, Self.pendingGigJSON)),
                .json(Self.gigsBoundsJSON(Self.gigJSON))
            ]
        )
        URLProtocolStub.stub(
            path: "/api/listings/in-bounds",
            responses: [
                .json(Self.listingsBoundsJSON(Self.listingJSON)),
                .json(Self.listingsBoundsJSON())
            ]
        )
        let vm = NearbyMapViewModel(
            api: makeAPI(),
            location: FixedLocationProvider(center)
        )
        await vm.load()
        await vm.selectCategory(.handyman)
        XCTAssertEqual(vm.activeCategory, .handyman)
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded after category switch")
            return
        }
        XCTAssertEqual(loaded.entities.count, 1)
        XCTAssertEqual(loaded.entities.first?.id, "g1")
    }

    func testSelectEntityMirrorsSelectedId() async {
        URLProtocolStub.stub(path: "/api/gigs/in-bounds", response: .json(Self.gigsBoundsJSON(Self.gigJSON)))
        URLProtocolStub.stub(path: "/api/listings/in-bounds", response: .json(Self.listingsBoundsJSON()))
        let vm = NearbyMapViewModel(
            api: makeAPI(),
            location: FixedLocationProvider(center)
        )
        await vm.load()
        vm.selectEntity("g1")
        if case let .loaded(loaded) = vm.state {
            XCTAssertEqual(loaded.selectedId, "g1")
        } else {
            XCTFail("Expected .loaded with selectedId")
        }
        vm.selectEntity(nil)
        if case let .loaded(loaded) = vm.state {
            XCTAssertNil(loaded.selectedId)
        }
    }

    func testSheetStopTransitions() {
        let vm = NearbyMapViewModel(
            api: makeAPI(),
            location: FixedLocationProvider(center)
        )
        XCTAssertEqual(vm.sheetStop, .standard)
        vm.setSheetStop(.expanded)
        XCTAssertEqual(vm.sheetStop, .expanded)
        vm.setSheetStop(.collapsed)
        XCTAssertEqual(vm.sheetStop, .collapsed)
    }

    func testClusterMergesNearbyPinsAndKeepsLoneOnesAsEntities() {
        // Three entities: two are inside the same 0.005° bucket
        // (Manhattan-ish) and one ~2 km away. Expect 1 cluster + 1
        // entity marker.
        let nearbyA = MapEntity(
            id: "a",
            kind: .gig,
            category: .handyman,
            state: .confirmed,
            latitude: 40.7484,
            longitude: -73.9857,
            title: "A",
            summary: nil,
            price: nil,
            distanceLabel: nil,
            bidCount: 0
        )
        let nearbyB = MapEntity(
            id: "b",
            kind: .gig,
            category: .handyman,
            state: .confirmed,
            latitude: 40.7486,
            longitude: -73.9855,
            title: "B",
            summary: nil,
            price: nil,
            distanceLabel: nil,
            bidCount: 0
        )
        let lone = MapEntity(
            id: "c",
            kind: .listing,
            category: .moving,
            state: .confirmed,
            latitude: 40.7600,
            longitude: -73.9700,
            title: "C",
            summary: nil,
            price: nil,
            distanceLabel: nil,
            bidCount: 0
        )
        let markers = NearbyMapViewModel.cluster(
            entities: [nearbyA, nearbyB, lone],
            radiusDegrees: 0.005
        )
        XCTAssertEqual(markers.count, 2)
        let clusters = markers.compactMap { marker -> MapCluster? in
            if case let .cluster(c) = marker { return c } else { return nil }
        }
        XCTAssertEqual(clusters.count, 1)
        XCTAssertEqual(clusters.first?.count, 2)
        XCTAssertEqual(Set(clusters.first?.entityIds ?? []), Set(["a", "b"]))
        let entities = markers.compactMap { marker -> MapEntity? in
            if case let .entity(e) = marker { return e } else { return nil }
        }
        XCTAssertEqual(entities.first?.id, "c")
    }
}
