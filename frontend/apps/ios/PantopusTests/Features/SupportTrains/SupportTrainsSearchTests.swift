//
//  SupportTrainsSearchTests.swift
//  PantopusTests
//
//  P4.6 — Support Trains search. Two layers:
//    - `SupportTrainsSearchViewModelTests` drives the `/me/support-trains`
//      corpus through `SequencedURLProtocol` and asserts the client-side
//      filter + row mapping + routing callbacks (loaded / populated /
//      empty / error data states).
//    - `SupportTrainsSearchViewTests` materialises the surface in each of
//      the shell's four render phases (recent / typing / results / empty)
//      via `UIHostingController`, mirroring `SearchListShellTests`.
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class SupportTrainsSearchViewModelTests: XCTestCase {
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

    private static let corpusJSON = """
    {"support_trains":[
      {"id":"st1","title":"For the Chen family","status":"filling","my_role":"organizer",
       "support_train_type":"meal_support","slots_filled":12,"slots_total":18,
       "recipient_name":"For the Chen family"},
      {"id":"st2","title":"For Daniel R.","status":"active","my_role":"organizer",
       "support_train_type":"ride_support","slots_filled":6,"slots_total":14,
       "recipient_name":"For Daniel R."},
      {"id":"st3","title":"For Mrs. Alvarez","status":"wrapping","my_role":"helper",
       "support_train_type":"pet_care","slots_filled":22,"slots_total":24,
       "recipient_name":"For Mrs. Alvarez"}
    ]}
    """

    private static let emptyJSON = """
    {"support_trains":[]}
    """

    func testEmptyQueryYieldsNoResults() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.corpusJSON)]
        let vm = SupportTrainsSearchViewModel(api: makeAPI())
        await vm.load()
        XCTAssertTrue(vm.query.isEmpty)
        XCTAssertTrue(vm.results.isEmpty)
        XCTAssertFalse(vm.isLoading)
    }

    func testQueryFiltersByRecipientAndTitle() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.corpusJSON)]
        let vm = SupportTrainsSearchViewModel(api: makeAPI())
        await vm.load()

        vm.query = "chen"
        XCTAssertEqual(vm.results.map(\.id), ["st1"])

        vm.query = "alvarez"
        XCTAssertEqual(vm.results.map(\.id), ["st3"])
    }

    func testQueryFiltersByTrainTypeLabel() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.corpusJSON)]
        let vm = SupportTrainsSearchViewModel(api: makeAPI())
        await vm.load()

        // "Ride train" is the projected type label for `ride_support`.
        vm.query = "ride"
        XCTAssertEqual(vm.results.map(\.id), ["st2"])
    }

    func testQueryIsCaseInsensitiveAndTrimmed() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.corpusJSON)]
        let vm = SupportTrainsSearchViewModel(api: makeAPI())
        await vm.load()

        vm.query = "  CHEN  "
        XCTAssertEqual(vm.results.map(\.id), ["st1"])
    }

    func testQueryWithNoMatchesYieldsEmpty() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.corpusJSON)]
        let vm = SupportTrainsSearchViewModel(api: makeAPI())
        await vm.load()

        vm.query = "zzzzzz"
        XCTAssertTrue(vm.results.isEmpty)
    }

    func testLoadFailureDegradesToEmptyCorpus() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = SupportTrainsSearchViewModel(api: makeAPI())
        await vm.load()

        vm.query = "chen"
        XCTAssertTrue(vm.results.isEmpty)
        XCTAssertFalse(vm.isLoading)
    }

    func testRowModelMirrorsListTemplate() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.corpusJSON)]
        let vm = SupportTrainsSearchViewModel(api: makeAPI())
        await vm.load()
        vm.query = "chen"

        let row = vm.rowModel(for: vm.results[0])
        XCTAssertEqual(row.title, "For the Chen family")
        XCTAssertEqual(row.subtitle, "Meal train · You organize")
        XCTAssertEqual(row.metaTail, "12 / 18 slots · 6 open")
        guard case .categoryGradientIcon = row.leading else {
            return XCTFail("Expected category gradient leading tile")
        }
        guard case let .statusChip(text, _) = row.trailing else {
            return XCTFail("Expected status chip trailing")
        }
        XCTAssertEqual(text, "Filling up")
    }

    func testOpenResultFiresCallbackWithTrainId() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.corpusJSON)]
        var opened: String?
        let vm = SupportTrainsSearchViewModel(
            api: makeAPI()
        ) { opened = $0 }
        await vm.load()
        vm.query = "daniel"
        vm.openResult(vm.results[0])
        XCTAssertEqual(opened, "st2")
    }

    func testCancelFiresCallback() {
        var cancelled = false
        let onCancel: @MainActor () -> Void = { cancelled = true }
        let vm = SupportTrainsSearchViewModel(onCancel: onCancel)
        vm.cancel()
        XCTAssertTrue(cancelled)
    }
}

@MainActor
final class SupportTrainsSearchViewTests: XCTestCase {
    private func sampleTrain(id: String) -> SupportTrainListItemDTO {
        SupportTrainListItemDTO(
            id: id,
            title: "For the Chen family",
            status: "filling",
            publishedAt: nil,
            createdAt: nil,
            myRole: "organizer",
            supportTrainType: "meal_support",
            startsOn: nil,
            endsOn: nil,
            slotsFilled: 12,
            slotsTotal: 18,
            distanceMeters: nil,
            recipientName: "For the Chen family"
        )
    }

    func testRecentPhaseViewConstructs() {
        let view = NavigationStack {
            SupportTrainsSearchView(viewModel: SupportTrainsSearchViewModel())
        }
        _ = UIHostingController(rootView: view)
    }

    func testTypingPhaseConstructs() {
        let vm = SupportTrainsSearchViewModel()
        let shell = SearchListShell<SupportTrainListItemDTO, AnyView>(
            placeholder: "Search support trains",
            query: .constant("che"),
            results: [],
            isLoading: true,
            emptyState: emptyState,
            row: { AnyView(ListRowCard(row: vm.rowModel(for: $0))) },
            onCancel: {}
        )
        _ = UIHostingController(rootView: shell)
    }

    func testResultsPhaseConstructs() {
        let vm = SupportTrainsSearchViewModel()
        let shell = SearchListShell<SupportTrainListItemDTO, AnyView>(
            placeholder: "Search support trains",
            query: .constant("chen"),
            results: [sampleTrain(id: "st1"), sampleTrain(id: "st2")],
            isLoading: false,
            emptyState: emptyState,
            row: { AnyView(ListRowCard(row: vm.rowModel(for: $0))) },
            onCancel: {}
        )
        _ = UIHostingController(rootView: shell)
    }

    func testEmptyPhaseConstructs() {
        let vm = SupportTrainsSearchViewModel()
        let shell = SearchListShell<SupportTrainListItemDTO, AnyView>(
            placeholder: "Search support trains",
            query: .constant("zzzzzz"),
            results: [],
            isLoading: false,
            emptyState: emptyState,
            row: { AnyView(ListRowCard(row: vm.rowModel(for: $0))) },
            onCancel: {}
        )
        _ = UIHostingController(rootView: shell)
    }

    private var emptyState: EmptyStateContent {
        EmptyStateContent(
            icon: .search,
            headline: "No matching trains",
            subcopy: "Try a different name or train type."
        )
    }
}
