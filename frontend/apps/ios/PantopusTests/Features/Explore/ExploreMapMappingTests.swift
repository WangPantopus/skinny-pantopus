//
//  ExploreMapMappingTests.swift
//  PantopusTests
//
//  P1-F — covers the live wiring of the Explore discovery map:
//    - independent post + Home reads → unified ExploreEntity projection,
//    - the live load() path (including honest partial and total failures),
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
    override func setUp() {
        super.setUp()
        // Task, item and spot pins: every first-launch cut switched on.
        LaunchFeatures.overrideForTesting = Set(LaunchFeature.allCases)
    }

    override func tearDown() {
        LaunchFeatures.overrideForTesting = nil
        super.tearDown()
    }

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

    private func route(_ layer: PostsMapLayer) -> String {
        let endpoint = PostsMapEndpoints.markers(
            south: anchor.latitude - 0.012,
            west: anchor.longitude - 0.016,
            north: anchor.latitude + 0.012,
            east: anchor.longitude + 0.016,
            layers: [layer]
        )
        let query = endpoint.query.keys.sorted().map { "\($0)=\(endpoint.query[$0] ?? "")" }.joined(separator: "&")
        return endpoint.path + "?" + query
    }

    private func makeVM(posts: SequencedURLProtocol.Response, homes: SequencedURLProtocol.Response) -> ExploreMapViewModel {
        let locationBody = #"{"viewingLocation":null,"recentLocations":[],"homes":[],"businessLocations":[]}"#
        let session = SequencedURLProtocol.makeSession(routeResponses: [
            "/api/location": [.status(200, body: locationBody)],
            route(.posts): [posts],
            route(.homes): [homes]
        ])
        return ExploreMapViewModel(
            api: APIClient(session: session, retryPolicy: .none),
            location: StubLocationProvider(anchor)
        ) { "explore-test-session" }
    }

    func testLiveLoadProjectsPostsAndHomes() async {
        SequencedURLProtocol.reset()
        defer { SequencedURLProtocol.reset() }
        let vm = makeVM(
            posts: .status(200, body: """
            {"markers":[{"id":"p1","layer_type":"post","title":"Neighborhood update",
            "latitude":40.75,"longitude":-73.98,"comment_count":3}]}
            """),
            homes: .status(200, body: """
            {"markers":[{"id":"h1","layer_type":"home","address":"Fixture Home",
            "latitude":40.751,"longitude":-73.981,"home_type":"house"}]}
            """)
        )
        await vm.load()
        guard case let .loaded(loaded) = vm.state else {
            return XCTFail("Expected loaded, got \(vm.state)")
        }
        XCTAssertEqual(loaded.entities.count, 2)
        let post = loaded.entities.first { $0.kind == .post }
        let home = loaded.entities.first { $0.kind == .home }
        XCTAssertEqual(post?.title, "Neighborhood update")
        XCTAssertEqual(post?.badge?.text, "3 replies")
        XCTAssertEqual(home?.title, "Fixture Home")
        XCTAssertNil(vm.homeCheckMessage)
    }

    func testLiveLoadTotalFailureSurfacesError() async {
        SequencedURLProtocol.reset()
        defer { SequencedURLProtocol.reset() }
        let vm = makeVM(
            posts: .status(500, body: "{\"error\":\"down\"}"),
            homes: .status(500, body: "{\"error\":\"down\"}")
        )
        await vm.load()
        XCTAssertNotNil(vm.homeCheckMessage)
        XCTAssertNotNil(vm.postsFailureMessage)
        XCTAssertTrue(vm.hasUnresolvedRead, "Failures must not render a confirmed empty map")
        XCTAssertFalse(vm.isCheckingHomes)
        XCTAssertFalse(vm.isCheckingPosts)
    }

    func testPartialFailureRendersWhatLoaded() async {
        SequencedURLProtocol.reset()
        defer { SequencedURLProtocol.reset() }
        let vm = makeVM(
            posts: .status(200, body: """
            {"markers":[{"id":"p1","layer_type":"post","title":"Neighborhood update",
            "latitude":40.75,"longitude":-73.98}]}
            """),
            homes: .status(403, body: "{\"error\":\"denied\"}")
        )
        await vm.load()
        guard case let .loaded(loaded) = vm.state else {
            return XCTFail("Expected loaded public posts, got \(vm.state)")
        }
        XCTAssertEqual(loaded.entities.count, 1)
        XCTAssertEqual(loaded.entities.first?.kind, .post)
        XCTAssertNotNil(vm.homeCheckMessage)
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
