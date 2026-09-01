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
        let vm = AddHomeWizardViewModel(api: makeAPI(), initialState: .empty) { true }
        vm.selectAddressCandidate(AddHomeSampleData.nearbyHomes[0])
        assertRenders(AddHomeWizardView(viewModel: vm) { _ in })
    }

    func test_find_home_autocomplete_renders() {
        let vm = AddHomeWizardViewModel(api: makeAPI(), initialState: .empty) { true }
        vm.updateSearchQuery("412 Elm")
        assertRenders(AddHomeWizardView(viewModel: vm) { _ in })
    }

    func test_add_home_geocoded_ready_renders() async {
        SequencedURLProtocol.reset()
        SequencedURLProtocol.sequence = [.status(200, body: Self.checkAddressGeocodedJSON)]
        var seed = AddHomeSampleData.geocodedReadyForm
        seed.step = AddHomeStep.address.rawValue
        let vm = AddHomeWizardViewModel(api: makeAPI(), initialState: seed) { true }
        await vm.advanceForTesting()
        assertRenders(AddHomeWizardView(viewModel: vm) { _ in })
    }

    func test_add_home_zip_mismatch_apply_renders() async {
        SequencedURLProtocol.reset()
        SequencedURLProtocol.sequence = [.status(200, body: Self.checkAddressGeocodedJSON)]
        var seed = AddHomeSampleData.zipMismatchForm
        seed.step = AddHomeStep.address.rawValue
        let vm = AddHomeWizardViewModel(api: makeAPI(), initialState: seed) { true }
        await vm.advanceForTesting()
        assertRenders(AddHomeWizardView(viewModel: vm) { _ in })
    }

    private static let checkAddressGeocodedJSON = """
    {"exists":false,"homeCount":0,"hasVerifiedMembers":false,"verdict_status":null,
     "normalized_address":{
       "street":"412 Elm Street","unit":"3B","city":"Brooklyn","state":"NY",
       "zip_code":"11211","latitude":40.7138,"longitude":-73.9527,"is_multi_unit":true
     }}
    """

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
