//
//  TasksMapViewModelTests.swift
//  PantopusTests
//
//  A11.1 Tasks map view-model — the live `GET /api/gigs/in-bounds` fetch
//  + projection, plus the client-side category filter, pin↔card
//  selection sync, sort, the "Search this area" visibility state
//  machine, the widen → jump-to-activity empty ladder, and the
//  clustering / camera-request surface. The filter/sort/selection tests
//  drive an explicit `seed` (offline mode); the fetch + state-machine
//  tests drive a stubbed `APIClient` via `SequencedURLProtocol`.
//

import XCTest
@testable import Pantopus

// swiftlint:disable type_body_length

@MainActor
final class TasksMapViewModelTests: XCTestCase {
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

    private func seeded(_ initialCategory: GigsCategory = .all) -> TasksMapViewModel {
        TasksMapViewModel(initialCategory: initialCategory, seed: TasksMapSampleData.items)
    }

    private func items(_ state: TasksMapState) -> [TaskMapItem]? {
        if case let .populated(items) = state { return items }
        return nil
    }

    private func isEmpty(_ state: TasksMapState) -> Bool {
        if case .empty = state { return true }
        return false
    }

    private func errorMessage(_ state: TasksMapState) -> String? {
        if case let .error(message) = state { return message }
        return nil
    }

    // MARK: - Live in-bounds fetch

    private func manhattanLocation() -> FixedLocationProvider {
        FixedLocationProvider(UserCoordinate(latitude: 40.7484, longitude: -73.9857, accuracyMeters: 100))
    }

    private func makeLiveVM() -> TasksMapViewModel {
        TasksMapViewModel(api: makeAPI(), location: manhattanLocation())
    }

    func testLoadFetchesInBoundsAndProjectsPins() async {
        // Two gigs near the default anchor (40.7484, -73.9857); g1 sits
        // closer so closest-sort (the default) leads with it.
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"gigs":[
              {"id":"g1","title":"Fix a leaky sink","category":"handyman","price":60,
               "pay_type":"fixed","bid_count":4,"status":"open",
               "latitude":40.749,"longitude":-73.988,
               "creator":{"id":"u1","verified":true}},
              {"id":"g2","title":"Walk my dog","category":"pet","price":22,
               "pay_type":"per_walk","bid_count":1,"status":"open",
               "latitude":40.740,"longitude":-73.978}
            ]}
            """)
        ]
        let vm = makeLiveVM()
        await vm.load()
        let visible = items(vm.state)
        XCTAssertEqual(visible?.count, 2)
        XCTAssertEqual(visible?.first?.id, "g1", "Closest task leads + pulses")
        XCTAssertEqual(vm.selectedId, "g1")
        XCTAssertEqual(visible?.first?.category, .handyman)
        XCTAssertEqual(visible?.first?.price, "$60")
        XCTAssertEqual(visible?.first { $0.id == "g2" }?.price, "$22/walk")
        XCTAssertEqual(visible?.first { $0.id == "g2" }?.category, .petcare)
        // Verified-poster semantic — g1's creator is verified (white
        // ring), g2 has no creator payload (dashed pending outline).
        XCTAssertEqual(visible?.first { $0.id == "g1" }?.state, .confirmed)
        XCTAssertEqual(visible?.first { $0.id == "g2" }?.state, .pending)
        // Distance was computed client-side, not "—".
        XCTAssertNotEqual(visible?.first?.distanceLabel, "—")
    }

    func testFetchProjectsVerifiedPosterPinStyles() async {
        // The "confirmed" pin treatment marks a verified poster:
        // `creator.verified` or the `verified_resident` badge.
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"gigs":[
              {"id":"flag","title":"Verified flag","category":"handyman","price":10,
               "latitude":40.749,"longitude":-73.988,
               "creator":{"id":"u1","verified":true}},
              {"id":"badge","title":"Resident badge","category":"handyman","price":10,
               "latitude":40.748,"longitude":-73.987,
               "creator":{"id":"u2","badges":["verified_resident"]}},
              {"id":"plain","title":"Plain creator","category":"handyman","price":10,
               "latitude":40.747,"longitude":-73.986,
               "creator":{"id":"u3","verified":false,"badges":["helper"]}}
            ]}
            """)
        ]
        let vm = makeLiveVM()
        await vm.load()
        let visible = items(vm.state)
        XCTAssertEqual(visible?.first { $0.id == "flag" }?.state, .confirmed)
        XCTAssertEqual(visible?.first { $0.id == "badge" }?.state, .confirmed)
        XCTAssertEqual(visible?.first { $0.id == "plain" }?.state, .pending)
    }

    func testLoadDropsGigsWithoutCoordinates() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"gigs":[
              {"id":"g1","title":"Has coords","category":"handyman","price":50,"status":"open",
               "latitude":40.749,"longitude":-73.988},
              {"id":"g2","title":"No coords","category":"cleaning","price":50,"status":"open"}
            ]}
            """)
        ]
        let vm = makeLiveVM()
        await vm.load()
        XCTAssertEqual(items(vm.state)?.map(\.id), ["g1"])
    }

    func testLoadEmptyResultProducesEmpty() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"gigs\":[]}")]
        let vm = makeLiveVM()
        await vm.load()
        XCTAssertTrue(isEmpty(vm.state))
        XCTAssertNil(vm.selectedId)
    }

    func testLoadServerErrorProducesError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"boom\"}")]
        let vm = makeLiveVM()
        await vm.load()
        XCTAssertNotNil(errorMessage(vm.state))
    }

    // MARK: - Offline seed: states + selection

    func testLoadProducesPopulatedWithDefaultSelection() async {
        let vm = seeded()
        await vm.load()
        XCTAssertEqual(items(vm.state)?.count, TasksMapSampleData.items.count)
        // Closest-first by default → the 0.2 mi handyman task leads + pulses.
        XCTAssertEqual(vm.selectedId, items(vm.state)?.first?.id)
        XCTAssertEqual(vm.selectedId, "handyman-1")
    }

    func testLoadEmptySeedProducesEmpty() async {
        let vm = TasksMapViewModel(seed: [])
        await vm.load()
        XCTAssertTrue(isEmpty(vm.state))
        XCTAssertNil(vm.selectedId)
    }

    func testLoadFailureProducesError() async {
        let vm = TasksMapViewModel(seed: TasksMapSampleData.items, failWith: "Couldn't load tasks")
        await vm.load()
        XCTAssertEqual(errorMessage(vm.state), "Couldn't load tasks")
    }

    func testCategoryFilterNarrowsVisibleItems() async {
        let vm = seeded()
        await vm.load()
        vm.selectCategory(.cleaning)
        let visible = items(vm.state)
        XCTAssertEqual(visible?.count, 2)
        XCTAssertEqual(visible?.allSatisfy { $0.category == .cleaning }, true)
        // Selection follows the filter to a visible task.
        XCTAssertEqual(vm.selectedId, visible?.first?.id)
    }

    func testCategoryWithNoMatchesProducesEmpty() async {
        let vm = seeded()
        await vm.load()
        vm.selectCategory(.tech) // no tech task in the seed
        XCTAssertTrue(isEmpty(vm.state))
        XCTAssertNil(vm.selectedId)
    }

    func testWidenFromEmptyRestoresPopulated() async {
        let vm = seeded()
        await vm.load()
        vm.selectCategory(.tech)
        XCTAssertTrue(isEmpty(vm.state))
        vm.selectCategory(.all) // "Widen search"
        XCTAssertEqual(items(vm.state)?.count, TasksMapSampleData.items.count)
    }

    func testSelectUpdatesSelectedId() async {
        let vm = seeded()
        await vm.load()
        vm.select("cleaning-1")
        XCTAssertEqual(vm.selectedId, "cleaning-1")
    }

    func testSortFewestBidsOrdersAscending() async {
        let vm = seeded()
        await vm.load()
        vm.selectSort(.fewestBids)
        let bids = items(vm.state)?.map(\.bidCount) ?? []
        XCTAssertEqual(bids, bids.sorted())
    }

    func testSortHighestPayLeadsWithPriciestTask() async {
        let vm = seeded()
        await vm.load()
        vm.selectSort(.highestPay)
        XCTAssertEqual(items(vm.state)?.first?.id, "cleaning-1") // $180
    }

    func testInitialCategoryAppliedOnLoad() async {
        let vm = seeded(.petcare)
        await vm.load()
        let visible = items(vm.state)
        XCTAssertEqual(visible?.count, 2)
        XCTAssertEqual(visible?.allSatisfy { $0.category == .petcare }, true)
        XCTAssertEqual(vm.activeCategory, .petcare)
    }

    func testPinProjectionCarriesCategoryColorAndState() async {
        let vm = seeded()
        await vm.load()
        let pins = items(vm.state)?.map(\.pin) ?? []
        XCTAssertEqual(pins.count, TasksMapSampleData.items.count)
        // The moving + tutoring seeds are pending (unverified posters);
        // the rest confirmed.
        let pending = pins.filter { $0.state == .pending }.count
        XCTAssertEqual(pending, 2)
    }

    // MARK: - Search this area (visibility state machine)

    private func region(
        lat: Double,
        lon: Double,
        latSpan: Double = 0.024,
        lonSpan: Double = 0.032
    ) -> MapListHybridRegion {
        MapListHybridRegion(
            centerLatitude: lat,
            centerLongitude: lon,
            latitudeSpan: latSpan,
            longitudeSpan: lonSpan
        )
    }

    func testSearchThisAreaStateMachine() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"gigs":[{"id":"g1","title":"First","category":"handyman","price":60,
              "latitude":40.749,"longitude":-73.988,"creator":{"id":"u1","verified":true}}]}
            """),
            .status(200, body: """
            {"gigs":[{"id":"g9","title":"Refetched","category":"cleaning","price":80,
              "latitude":40.760,"longitude":-73.985,"creator":{"id":"u2","verified":true}}]}
            """)
        ]
        let vm = makeLiveVM()
        await vm.load()
        XCTAssertFalse(vm.showsSearchThisArea)

        // First settle after the fetch adopts the camera region as the
        // comparison baseline — never shows the pill.
        let base = region(lat: 40.7484, lon: -73.9857)
        vm.cameraSettled(on: base)
        XCTAssertFalse(vm.showsSearchThisArea)

        // Small pan (< 25% of the span) — still hidden.
        vm.cameraSettled(on: region(lat: 40.7484 + 0.002, lon: -73.9857))
        XCTAssertFalse(vm.showsSearchThisArea)

        // Center moved by half the span — pill shows.
        let far = region(lat: 40.7484 + 0.012, lon: -73.9857)
        vm.cameraSettled(on: far)
        XCTAssertTrue(vm.showsSearchThisArea)

        // Tap → refetch the settled viewport, pill hides, data swaps.
        await vm.searchThisArea()
        XCTAssertFalse(vm.showsSearchThisArea)
        XCTAssertEqual(items(vm.state)?.map(\.id), ["g9"])

        // Camera settling on the refetched area re-baselines — hidden.
        vm.cameraSettled(on: far)
        XCTAssertFalse(vm.showsSearchThisArea)
    }

    func testSearchThisAreaShowsOnSignificantZoomChange() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"gigs":[{"id":"g1","title":"First","category":"handyman","price":60,
              "latitude":40.749,"longitude":-73.988,"creator":{"id":"u1","verified":true}}]}
            """)
        ]
        let vm = makeLiveVM()
        await vm.load()
        let base = region(lat: 40.7484, lon: -73.9857)
        vm.cameraSettled(on: base)

        // Mild zoom (×1.2) — hidden.
        vm.cameraSettled(on: region(lat: 40.7484, lon: -73.9857, latSpan: 0.024 * 1.2, lonSpan: 0.032 * 1.2))
        XCTAssertFalse(vm.showsSearchThisArea)

        // Zoom out beyond +50% — shown.
        vm.cameraSettled(on: region(lat: 40.7484, lon: -73.9857, latSpan: 0.024 * 2, lonSpan: 0.032 * 2))
        XCTAssertTrue(vm.showsSearchThisArea)
    }

    // MARK: - Widen-search ladder + jump to activity

    func testWidenSearchLadderEscalatesToJumpToActivity() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"gigs\":[]}"),
            .status(200, body: """
            {"gigs":[],"nearest_activity_center":{"latitude":40.6,"longitude":-73.9}}
            """),
            .status(200, body: """
            {"gigs":[{"id":"a1","title":"Found one","category":"handyman","price":40,
              "latitude":40.601,"longitude":-73.901,"creator":{"id":"u1","verified":true}}]}
            """)
        ]
        let vm = makeLiveVM()
        await vm.load()
        XCTAssertTrue(isEmpty(vm.state))
        XCTAssertEqual(vm.widenAttempts, 0)
        XCTAssertEqual(vm.emptyAction, .widen)

        // Widen: camera zooms out ×2.5 and the widened box refetches.
        await vm.widenSearch()
        XCTAssertEqual(vm.widenAttempts, 1)
        let widened = vm.cameraTarget?.region
        XCTAssertEqual(widened?.latitudeSpan ?? 0, 0.024 * 2.5, accuracy: 1e-9)
        XCTAssertEqual(widened?.longitudeSpan ?? 0, 0.032 * 2.5, accuracy: 1e-9)
        // Still empty, but the backend offered an activity center →
        // the secondary CTA escalates.
        XCTAssertTrue(isEmpty(vm.state))
        XCTAssertEqual(vm.emptyAction, .jumpToActivity(latitude: 40.6, longitude: -73.9))

        // Jump: camera recenters on the activity hint, refetch populates,
        // ladder resets.
        await vm.jumpToActivity()
        XCTAssertEqual(items(vm.state)?.map(\.id), ["a1"])
        XCTAssertEqual(vm.cameraTarget?.region.centerLatitude ?? 0, 40.6, accuracy: 1e-9)
        XCTAssertEqual(vm.cameraTarget?.region.centerLongitude ?? 0, -73.9, accuracy: 1e-9)
        XCTAssertEqual(vm.widenAttempts, 0)
        XCTAssertEqual(vm.emptyAction, .widen)
    }

    func testEmptyLoadWithCenterStillOffersWidenFirst() async {
        // The escalation requires at least one widen attempt — a first
        // load that comes back empty with a hint still offers "Widen".
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"gigs":[],"nearest_activity_center":{"latitude":40.6,"longitude":-73.9}}
            """)
        ]
        let vm = makeLiveVM()
        await vm.load()
        XCTAssertTrue(isEmpty(vm.state))
        XCTAssertEqual(vm.emptyAction, .widen)
    }

    // MARK: - Pin↔card selection sync

    func testSelectIndexSelectsItemAndPansCamera() async {
        let vm = seeded()
        await vm.load()
        XCTAssertEqual(vm.selectedIndex, 0, "Default selection leads the rail")

        vm.selectIndex(2)
        let expected = vm.visibleItems[2]
        XCTAssertEqual(vm.selectedId, expected.id)
        XCTAssertEqual(vm.selectedIndex, 2)
        // Camera pans to the selected pin, span preserved.
        XCTAssertEqual(vm.cameraTarget?.region.centerLatitude ?? 0, expected.latitude, accuracy: 1e-9)
        XCTAssertEqual(vm.cameraTarget?.region.centerLongitude ?? 0, expected.longitude, accuracy: 1e-9)
        XCTAssertEqual(vm.cameraTarget?.region.latitudeSpan ?? 0, 0.024, accuracy: 1e-9)
    }

    func testPinSelectionUpdatesRailIndexWithoutCameraMove() async {
        let vm = seeded()
        await vm.load()
        let target = vm.visibleItems[3]
        vm.select(target.id)
        XCTAssertEqual(vm.selectedIndex, 3)
        XCTAssertNil(vm.cameraTarget, "Pin taps don't pan — the pin is already on screen")
    }

    func testSelectIndexOutOfRangeIsIgnored() async {
        let vm = seeded()
        await vm.load()
        let before = vm.selectedId
        vm.selectIndex(99)
        XCTAssertEqual(vm.selectedId, before)
        XCTAssertNil(vm.cameraTarget)
    }

    // MARK: - Clustering + cluster tap

    func testWideSpanClustersPinsAndClusterTapZoomsOneStep() async {
        let vm = TasksMapViewModel(anchor: TasksMapSampleData.anchor, seed: TasksMapSampleData.items)
        await vm.load()

        // City-wide span — every seed pin lands in one ~44pt bucket.
        vm.cameraSettled(on: region(lat: 40.7484, lon: -73.9857, latSpan: 1.0, lonSpan: 1.0))
        XCTAssertTrue(vm.mapPins.isEmpty)
        XCTAssertEqual(vm.mapClusters.count, 1)
        XCTAssertEqual(vm.mapClusters.first?.count, TasksMapSampleData.items.count)

        // Tap → zoom one step (halve the span) centered on the cluster.
        let cluster = vm.mapClusters[0]
        vm.tapCluster(id: cluster.id)
        XCTAssertEqual(vm.cameraTarget?.region.latitudeSpan ?? 0, 0.5, accuracy: 1e-9)
        XCTAssertEqual(vm.cameraTarget?.region.longitudeSpan ?? 0, 0.5, accuracy: 1e-9)
        XCTAssertEqual(vm.cameraTarget?.region.centerLatitude ?? 0, cluster.latitude, accuracy: 1e-9)
        XCTAssertEqual(vm.cameraTarget?.region.centerLongitude ?? 0, cluster.longitude, accuracy: 1e-9)
    }

    func testTightZoomKeepsPinsIndividual() async {
        let vm = TasksMapViewModel(anchor: TasksMapSampleData.anchor, seed: TasksMapSampleData.items)
        await vm.load()
        // Tight zoom — every pin pair sits further than the ~44pt
        // bucket, so the nine seed pins render individually.
        vm.cameraSettled(on: region(lat: 40.7484, lon: -73.9857, latSpan: 0.008, lonSpan: 0.008))
        XCTAssertEqual(vm.mapPins.count, TasksMapSampleData.items.count)
        XCTAssertTrue(vm.mapClusters.isEmpty)
    }

    // MARK: - Focus on pins

    func testFocusOnPinsFitsCameraToAllPins() async {
        let vm = seeded()
        await vm.load()
        vm.focusOnPins()
        let regionTarget = vm.cameraTarget?.region
        XCTAssertNotNil(regionTarget)
        for item in vm.visibleItems {
            XCTAssertGreaterThanOrEqual(item.latitude, regionTarget?.minLatitude ?? .infinity)
            XCTAssertLessThanOrEqual(item.latitude, regionTarget?.maxLatitude ?? -.infinity)
            XCTAssertGreaterThanOrEqual(item.longitude, regionTarget?.minLongitude ?? .infinity)
            XCTAssertLessThanOrEqual(item.longitude, regionTarget?.maxLongitude ?? -.infinity)
        }
    }

    func testFocusOnPinsIgnoredWhenEmpty() async {
        let vm = TasksMapViewModel(seed: [])
        await vm.load()
        vm.focusOnPins()
        XCTAssertNil(vm.cameraTarget)
    }
}
