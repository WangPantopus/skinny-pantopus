//
//  AccessCodesSearchTests.swift
//  PantopusTests
//
//  P4.6 — Access codes search. Two layers:
//    - `AccessCodesSearchViewModelTests` drives the per-home access-secret
//      roster through `SequencedURLProtocol` and asserts the client-side
//      filter (label / notes / category — never the secret value), the
//      masked row template, and routing callbacks.
//    - `AccessCodesSearchViewTests` materialises the surface in each of
//      the shell's four render phases via `UIHostingController`.
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class AccessCodesSearchViewModelTests: XCTestCase {
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

    private func makeVM() -> AccessCodesSearchViewModel {
        AccessCodesSearchViewModel(homeId: "home_1", api: makeAPI())
    }

    private static let corpusJSON = """
    {"secrets":[
      {"id":"s1","home_id":"home_1","access_type":"wifi","label":"Main network",
       "secret_value":"MaplePan@2025!","notes":"Household · 4 members","visibility":"members"},
      {"id":"s2","home_id":"home_1","access_type":"alarm","label":"Disarm — front panel",
       "secret_value":"184729","notes":null,"visibility":"managers"},
      {"id":"s3","home_id":"home_1","access_type":"lockbox","label":"Front porch lockbox",
       "secret_value":"4218","notes":null,"visibility":"members"},
      {"id":"s4","home_id":"home_1","access_type":"smart_lock","label":"Front door",
       "secret_value":"SmartCode-9","notes":null,"visibility":"managers"}
    ]}
    """

    func testEmptyQueryYieldsNoResults() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.corpusJSON)]
        let vm = makeVM()
        await vm.load()
        XCTAssertTrue(vm.results.isEmpty)
        XCTAssertFalse(vm.isLoading)
    }

    func testQueryFiltersByLabel() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.corpusJSON)]
        let vm = makeVM()
        await vm.load()

        vm.query = "network"
        XCTAssertEqual(vm.results.map(\.id), ["s1"])
    }

    func testQueryFiltersByNotes() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.corpusJSON)]
        let vm = makeVM()
        await vm.load()

        vm.query = "household"
        XCTAssertEqual(vm.results.map(\.id), ["s1"])
    }

    func testQueryFiltersByCategoryLabel() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.corpusJSON)]
        let vm = makeVM()
        await vm.load()

        vm.query = "smart lock"
        XCTAssertEqual(vm.results.map(\.id), ["s4"])
    }

    func testSecretValueIsNotSearchable() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.corpusJSON)]
        let vm = makeVM()
        await vm.load()

        // Typing the literal code must not surface its row — the value is
        // excluded from the searchable text so a shoulder-surfer can't
        // confirm a guessed code by watching the results.
        vm.query = "184729"
        XCTAssertTrue(vm.results.isEmpty)
    }

    func testQueryWithNoMatchesYieldsEmpty() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.corpusJSON)]
        let vm = makeVM()
        await vm.load()

        vm.query = "zzzzzz"
        XCTAssertTrue(vm.results.isEmpty)
    }

    func testLoadFailureDegradesToEmptyCorpus() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = makeVM()
        await vm.load()

        vm.query = "network"
        XCTAssertTrue(vm.results.isEmpty)
    }

    func testRowModelMasksValueAndUsesChevron() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.corpusJSON)]
        let vm = makeVM()
        await vm.load()
        vm.query = "network"

        let secret = vm.results[0]
        let row = vm.rowModel(for: secret)
        XCTAssertEqual(row.title, "Main network")
        XCTAssertEqual(row.subtitle, AccessCodesViewModel.mask(for: secret.secretValue))
        XCTAssertNotEqual(row.subtitle, secret.secretValue)
        guard case .typeIcon = row.leading else {
            return XCTFail("Expected category type-icon leading tile")
        }
        guard case .chevron = row.trailing else {
            return XCTFail("Expected drill-in chevron trailing")
        }
    }

    func testOpenResultFiresCallbackWithSecretId() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.corpusJSON)]
        var opened: String?
        let vm = AccessCodesSearchViewModel(
            homeId: "home_1",
            api: makeAPI()
        ) { opened = $0 }
        await vm.load()
        vm.query = "front door"
        vm.openResult(vm.results[0])
        XCTAssertEqual(opened, "s4")
    }

    func testCancelFiresCallback() {
        var cancelled = false
        let onCancel: @MainActor () -> Void = { cancelled = true }
        let vm = AccessCodesSearchViewModel(homeId: "home_1", onCancel: onCancel)
        vm.cancel()
        XCTAssertTrue(cancelled)
    }
}

@MainActor
final class AccessCodesSearchViewTests: XCTestCase {
    private func sampleSecret(id: String) -> HomeAccessSecretDTO {
        HomeAccessSecretDTO(
            id: id,
            homeId: "home_1",
            accessType: "wifi",
            label: "Main network",
            secretValue: "MaplePan@2025!",
            notes: "Household · 4 members"
        )
    }

    func testRecentPhaseViewConstructs() {
        let view = NavigationStack {
            AccessCodesSearchView(viewModel: AccessCodesSearchViewModel(homeId: "home_1"))
        }
        _ = UIHostingController(rootView: view)
    }

    func testTypingPhaseConstructs() {
        let vm = AccessCodesSearchViewModel(homeId: "home_1")
        let shell = SearchListShell<HomeAccessSecretDTO, AnyView>(
            placeholder: "Search access codes",
            query: .constant("net"),
            results: [],
            isLoading: true,
            emptyState: emptyState,
            row: { AnyView(ListRowCard(row: vm.rowModel(for: $0))) },
            onCancel: {}
        )
        _ = UIHostingController(rootView: shell)
    }

    func testResultsPhaseConstructs() {
        let vm = AccessCodesSearchViewModel(homeId: "home_1")
        let shell = SearchListShell<HomeAccessSecretDTO, AnyView>(
            placeholder: "Search access codes",
            query: .constant("network"),
            results: [sampleSecret(id: "s1"), sampleSecret(id: "s2")],
            isLoading: false,
            emptyState: emptyState,
            row: { AnyView(ListRowCard(row: vm.rowModel(for: $0))) },
            onCancel: {}
        )
        _ = UIHostingController(rootView: shell)
    }

    func testEmptyPhaseConstructs() {
        let vm = AccessCodesSearchViewModel(homeId: "home_1")
        let shell = SearchListShell<HomeAccessSecretDTO, AnyView>(
            placeholder: "Search access codes",
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
            headline: "No matching codes",
            subcopy: "Try a different label or category."
        )
    }
}
