//
//  ExploreMapViewModelTests.swift
//  PantopusTests
//
//  A11.2 Explore — view-model projection + filter logic. Drives the
//  sample-backed view-model through each scenario and asserts the
//  filtering / clustering / empty-recovery behaviour the screen relies on.
//

import XCTest
@testable import Pantopus

@MainActor
final class ExploreMapViewModelTests: XCTestCase {
    private func loaded(_ vm: ExploreMapViewModel) -> ExploreMapLoaded? {
        if case let .loaded(loaded) = vm.state { return loaded }
        return nil
    }

    func test_populated_load_projects47Entities_withThreeActiveFilters() async {
        let vm = ExploreMapViewModel(scenario: .populated)
        await vm.load()
        let loaded = loaded(vm)
        XCTAssertNotNil(loaded)
        XCTAssertEqual(loaded?.entities.count, 47, "Populated sample should read '47 nearby'")
        XCTAssertFalse(loaded?.isEmpty ?? true)
        XCTAssertEqual(vm.filters.activeCount, 3, "Design frame shows '3 filters on'")
    }

    func test_populated_markers_containAtLeastOneCluster() async {
        let vm = ExploreMapViewModel(scenario: .populated)
        await vm.load()
        let markers = loaded(vm)?.markers ?? []
        let hasCluster = markers.contains { if case .cluster = $0 { true } else { false } }
        XCTAssertTrue(hasCluster, "Dense sample should collapse into at least one cluster pin")
    }

    func test_empty_load_isEmpty() async {
        let vm = ExploreMapViewModel(scenario: .empty)
        await vm.load()
        XCTAssertEqual(loaded(vm)?.isEmpty, true)
        XCTAssertEqual(vm.filters.activeCount, 3)
    }

    func test_clearFilters_fromEmpty_revealsAllEntities() async {
        let vm = ExploreMapViewModel(scenario: .empty)
        await vm.load()
        XCTAssertEqual(loaded(vm)?.isEmpty, true)
        vm.clearFilters()
        XCTAssertEqual(loaded(vm)?.entities.count, 6)
        XCTAssertEqual(vm.filters.activeCount, 0)
        XCTAssertNil(vm.activeKind)
    }

    func test_widenArea_fromEmpty_surfacesFartherNeighbors() async {
        let vm = ExploreMapViewModel(scenario: .empty)
        await vm.load()
        vm.widenArea()
        let entities = loaded(vm)?.entities ?? []
        XCTAssertEqual(entities.count, 3, "Only the verified+open neighbors beyond 0.5mi should surface")
        XCTAssertTrue(entities.allSatisfy { $0.verified && $0.openNow })
    }

    func test_selectKind_filtersToSingleKind() async {
        let vm = ExploreMapViewModel(scenario: .populated)
        await vm.load()
        vm.selectKind(.spot)
        let entities = loaded(vm)?.entities ?? []
        XCTAssertFalse(entities.isEmpty)
        XCTAssertTrue(entities.allSatisfy { $0.kind == .spot })
    }

    func test_applyFilters_narrowsAndUpdatesActiveCount() async {
        let vm = ExploreMapViewModel(scenario: .populated)
        await vm.load()
        vm.applyFilters(ExploreFilterCriteria(kinds: [.task], distanceUpper: 1, verifiedOnly: true, openNow: true))
        let entities = loaded(vm)?.entities ?? []
        XCTAssertTrue(entities.allSatisfy { $0.kind == .task })
        XCTAssertEqual(vm.filters.activeCount, 4, "kinds subset + distance + verified + open")
    }

    func test_selectEntity_setsSelectedId() async {
        let vm = ExploreMapViewModel(scenario: .populated)
        await vm.load()
        guard let first = loaded(vm)?.entities.first else { return XCTFail("no entities") }
        vm.selectEntity(first.id)
        XCTAssertEqual(loaded(vm)?.selectedId, first.id)
    }

    func test_errorScenario_rendersError() async {
        let vm = ExploreMapViewModel(scenario: .error)
        await vm.load()
        if case .error = vm.state {} else { XCTFail("Expected error state") }
    }

    func test_loadingScenario_staysLoading() async {
        let vm = ExploreMapViewModel(scenario: .loading)
        await vm.load()
        if case .loading = vm.state {} else { XCTFail("Expected loading state") }
    }

    // MARK: - Criteria

    func test_filterCriteria_sectionsRoundTrip() {
        let original = ExploreFilterCriteria(
            kinds: [.task, .spot],
            distanceUpper: 1,
            verifiedOnly: true,
            openNow: false
        )
        let roundTripped = ExploreFilterCriteria(sections: original.sections())
        XCTAssertEqual(original, roundTripped)
    }

    func test_filterCriteria_activeCount_emptyAndAllAreInactive() {
        XCTAssertEqual(ExploreFilterCriteria().activeCount, 0)
        // Selecting every kind == "all" == no filter.
        let allKinds = ExploreFilterCriteria(kinds: Set(ExploreKind.allCases))
        XCTAssertFalse(allKinds.isKindActive)
        XCTAssertEqual(allKinds.activeCount, 0)
    }

    func test_filterCriteria_matches_honoursEveryDimension() {
        let entity = ExploreEntity(
            id: "x",
            kind: .task,
            state: .confirmed,
            latitude: 0,
            longitude: 0,
            title: "t",
            metaLead: "$1",
            distanceLabel: "0.2 mi",
            distanceMiles: 0.2,
            badge: nil,
            verified: false,
            openNow: true
        )
        XCTAssertTrue(ExploreFilterCriteria().matches(entity))
        XCTAssertFalse(ExploreFilterCriteria(kinds: [.spot]).matches(entity))
        XCTAssertFalse(ExploreFilterCriteria(distanceUpper: 0.1).matches(entity))
        XCTAssertFalse(ExploreFilterCriteria(verifiedOnly: true).matches(entity))
    }
}
