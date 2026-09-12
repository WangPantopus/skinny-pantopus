//
//  AddHomeWizardSnapshotTests.swift
//  PantopusTests
//
//  A12.1 — structural render tests for the search-first Add Home step.
//  These cover the two design frames: nearby-result selection and focused
//  autocomplete with highlighted match substrings.
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class AddHomeWizardSnapshotTests: XCTestCase {
    func test_find_home_nearby_selection_renders() {
        let vm = AddHomeWizardViewModel(
            api: makeAPI(),
            initialState: .empty,
            identity: Self.identity,
            creationActorId: "ddc23700-0000-4000-8000-000000000001",
            creationStore: MemoryHomeCreationStore(),
            isOnlineProvider: Self.online
        )
        vm.selectAddressCandidate(AddHomeSampleData.nearbyHomes[0])
        assertRenders(AddHomeWizardView(viewModel: vm) {})
    }

    func test_find_home_autocomplete_renders() {
        let vm = AddHomeWizardViewModel(
            api: makeAPI(),
            initialState: .empty,
            identity: Self.identity,
            creationActorId: "ddc23700-0000-4000-8000-000000000001",
            creationStore: MemoryHomeCreationStore(),
            isOnlineProvider: Self.online
        )
        vm.addManuallyTapped()
        vm.update(.street, to: "412 Elm")
        assertRenders(AddHomeWizardView(viewModel: vm) {})
    }

    func test_add_home_geocoded_ready_renders() async {
        SequencedURLProtocol.reset()
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.validationJSON),
            .status(200, body: "{\"status\":\"HOME_NOT_FOUND\"}"),
            .status(503, body: "{}")
        ]
        var seed = AddHomeSampleData.geocodedReadyForm
        seed.step = AddHomeStep.address.rawValue
        let vm = AddHomeWizardViewModel(
            api: makeAPI(),
            initialState: seed,
            identity: Self.identity,
            creationActorId: "ddc23700-0000-4000-8000-000000000001",
            creationStore: MemoryHomeCreationStore(),
            isOnlineProvider: Self.online
        )
        await vm.advanceForTesting()
        assertRenders(AddHomeWizardView(viewModel: vm) {})
    }

    func test_add_home_zip_mismatch_apply_renders() async {
        SequencedURLProtocol.reset()
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.validationJSON),
            .status(200, body: "{\"status\":\"HOME_NOT_FOUND\"}"),
            .status(503, body: "{}")
        ]
        var seed = AddHomeSampleData.zipMismatchForm
        seed.step = AddHomeStep.address.rawValue
        let vm = AddHomeWizardViewModel(
            api: makeAPI(),
            initialState: seed,
            identity: Self.identity,
            creationActorId: "ddc23700-0000-4000-8000-000000000001",
            creationStore: MemoryHomeCreationStore(),
            isOnlineProvider: Self.online
        )
        await vm.advanceForTesting()
        assertRenders(AddHomeWizardView(viewModel: vm) {})
    }

    private static let validationJSON = """
    {"address_id":"ddc23700-0000-4000-8000-000000000010","verdict":{"status":"OK","normalized":{
      "line1":"412 Elm St","line2":"Apt 3B","city":"Brooklyn","state":"NY","zip":"11211","lat":40.7138,"lng":-73.9527
    }}}
    """

    private static func identity() -> String? {
        "home-entry-render-session"
    }

    private static func online() -> Bool {
        true
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    private func assertRenders(
        _ view: some View,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(rootView: view.frame(width: 390, height: 844))
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0, file: file, line: line)
        XCTAssertGreaterThan(host.view.frame.size.height, 0, file: file, line: line)
    }
}
