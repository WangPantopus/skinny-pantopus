//
//  LegalIndexViewModelTests.swift
//  PantopusTests
//
//  Verifies the TOC structure and that tapping a row dispatches the
//  correct `LegalDocument` to the host.
//

import XCTest
@testable import Pantopus

@MainActor
final class LegalIndexViewModelTests: XCTestCase {
    func testLoadProducesPoliciesAndCreditsGroups() async {
        let vm = LegalIndexViewModel { _ in }
        await vm.load()
        guard case let .loaded(groups) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        XCTAssertEqual(groups.map(\.id), ["policies", "credits"])
        XCTAssertEqual(groups[0].rows.map(\.id), ["terms", "privacy", "acceptableUse", "cookies"])
        XCTAssertEqual(groups[1].rows.map(\.id), ["openSource"])
    }

    func testTapRowDispatchesMatchingDocument() async {
        var captured: LegalDocument?
        let vm = LegalIndexViewModel { doc in captured = doc }
        await vm.load()
        await vm.tapRow("privacy")
        XCTAssertEqual(captured, .privacy)
    }

    func testTapUnknownRowDoesNothing() async {
        var captured: LegalDocument?
        let vm = LegalIndexViewModel { doc in captured = doc }
        await vm.load()
        await vm.tapRow("nope")
        XCTAssertNil(captured)
    }
}
