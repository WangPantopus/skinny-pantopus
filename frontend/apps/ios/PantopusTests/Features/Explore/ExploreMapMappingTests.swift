//
//  ExploreMapMappingTests.swift
//  PantopusTests
//
//  P1-F — covers the live wiring of the Explore discovery map:
//    - gigs + listings in-bounds → unified ExploreEntity projection,
//    - the live load() path (incl. total-failure → error),
//    - the distance + clustering helpers.
//

import XCTest
@testable import Pantopus

private final class StubLocationProvider: LocationProviding, @unchecked Sendable {
    let coord: UserCoordinate?
    init(_ coord: UserCoordinate?) {
        self.coord = coord
    }

    func cachedCoordinate() -> UserCoordinate? {
        coord
    }

    func requestCurrent(timeoutSeconds _: TimeInterval) async -> UserCoordinate? {
        coord
    }
}

@MainActor
final class ExploreMapMappingTests: XCTestCase {
    private let anchor = UserCoordinate(latitude: 40.7484, longitude: -73.9857, accuracyMeters: 50)

    private func entity(_ id: String, lat: Double, lon: Double) -> ExploreEntity {
        ExploreEntity(
            id: id,
            kind: .task,
            state: .confirmed,
            latitude: lat,
            longitude: lon,
            title: id,
            metaLead: "Open",
            distanceLabel: "0.1 mi",
            distanceMiles: 0.1,
            badge: nil,
            verified: false,
            openNow: true
        )
    }

    // MARK: - Live load() path

    func testLiveLoadProjectsGigsAndListings() async {
        SequencedURLProtocol.reset()
        defer { SequencedURLProtocol.reset() }
        let session = SequencedURLProtocol.makeSession(routeResponses: [
            "/api/gigs/in-bounds": [
                .status(200, body: """
                {"gigs":[{"id":"g1","title":"Mow lawn","price":40,"status":"open",\
                "latitude":40.75,"longitude":-73.98,"bid_count":3}],"nearest_activity_center":null}
                """)
            ],
            "/api/listings/in-bounds": [
                .status(200, body: """
                {"listings":[{"id":"l1","title":"Road bike","price":120,\
                "latitude":40.751,"longitude":-73.981}],"nearest_activity_center":null}
                """)
            ]
        ])
        let vm = ExploreMapViewModel(
            api: APIClient(session: session, retryPolicy: .none),
            location: StubLocationProvider(anchor)
        )
        await vm.load()
        guard case let .loaded(loaded) = vm.state else {
            return XCTFail("Expected loaded, got \(vm.state)")
        }
        XCTAssertEqual(loaded.entities.count, 2)
        let task = loaded.entities.first { $0.kind == .task }
        let item = loaded.entities.first { $0.kind == .item }
        XCTAssertEqual(task?.title, "Mow lawn")
        XCTAssertEqual(task?.metaLead, "$40")
        XCTAssertEqual(task?.badge?.text, "3 bids")
        XCTAssertEqual(item?.title, "Road bike")
        XCTAssertEqual(item?.metaLead, "$120")
    }

    func testLiveLoadTotalFailureSurfacesError() async {
        SequencedURLProtocol.reset()
        defer { SequencedURLProtocol.reset() }
        let session = SequencedURLProtocol.makeSession(routeResponses: [
            "/api/gigs/in-bounds": [
                .status(500, body: "{\"error\":\"boom\"}")
            ],
            "/api/listings/in-bounds": [
                .status(500, body: "{\"error\":\"boom\"}")
            ]
        ])
        let vm = ExploreMapViewModel(
            api: APIClient(session: session, retryPolicy: .none),
            location: StubLocationProvider(anchor)
        )
        await vm.load()
        guard case .error = vm.state else {
            return XCTFail("Expected error, got \(vm.state)")
        }
    }

    func testPartialFailureRendersWhatLoaded() async {
        SequencedURLProtocol.reset()
        defer { SequencedURLProtocol.reset() }
        let session = SequencedURLProtocol.makeSession(routeResponses: [
            "/api/gigs/in-bounds": [
                .status(200, body: """
                {"gigs":[{"id":"g1","title":"Mow lawn","price":40,"status":"open",\
                "latitude":40.75,"longitude":-73.98}],"nearest_activity_center":null}
                """)
            ],
            "/api/listings/in-bounds": [
                .status(500, body: "{\"error\":\"down\"}")
            ]
        ])
        let vm = ExploreMapViewModel(
            api: APIClient(session: session, retryPolicy: .none),
            location: StubLocationProvider(anchor)
        )
        await vm.load()
        guard case let .loaded(loaded) = vm.state else {
            return XCTFail("Expected loaded (gigs only), got \(vm.state)")
        }
        XCTAssertEqual(loaded.entities.count, 1)
        XCTAssertEqual(loaded.entities.first?.kind, .task)
    }

    // MARK: - Helpers

    func testDistanceMiles() {
        // ~0.01° of latitude ≈ 0.69 miles.
        let miles = ExploreMapViewModel.distanceMiles(
            from: anchor,
            to: (latitude: 40.7584, longitude: -73.9857)
        )
        XCTAssertEqual(miles, 0.69, accuracy: 0.1)
    }

    func testClusterCollapsesSameBucket() {
        let entities = [
            entity("a", lat: 40.7500, lon: -73.9800),
            entity("b", lat: 40.7501, lon: -73.9799),
            entity("c", lat: 40.9000, lon: -73.5000)
        ]
        let markers = ExploreMapViewModel.cluster(entities: entities, radiusDegrees: 0.005)
        XCTAssertEqual(markers.count, 2, "Two near entities collapse; the far one stays solo")
        let clusters = markers.compactMap { marker -> ExploreCluster? in
            if case let .cluster(cluster) = marker { return cluster }
            return nil
        }
        XCTAssertEqual(clusters.count, 1)
        XCTAssertEqual(clusters.first?.count, 2)
    }
}
