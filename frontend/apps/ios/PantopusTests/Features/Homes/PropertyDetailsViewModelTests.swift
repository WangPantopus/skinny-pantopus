//
//  PropertyDetailsViewModelTests.swift
//  PantopusTests
//
//  A.4 / A13.5 — Covers `PropertyDetailsViewModel`'s projection of the
//  injected loader into the four states the screen renders, plus the
//  mono / mismatch invariants the sample data must hold.
//

import XCTest
@testable import Pantopus

@MainActor
final class PropertyDetailsViewModelTests: XCTestCase {
    /// Mutable, serially-accessed test double for the loader. Calls only
    /// ever happen on the main actor inside the VM, so unchecked is safe.
    private final class CallBox: @unchecked Sendable {
        var fail: Bool
        var calls = 0
        init(fail: Bool) {
            self.fail = fail
        }
    }

    private struct LoaderError: Error {}

    func test_load_cleanHome_projectsCleanState() async {
        let vm = PropertyDetailsViewModel(homeId: "home-1") { _ in PropertyDetailsSampleData.clean }
        await vm.load()
        guard case let .clean(content) = vm.state else {
            XCTFail("Expected .clean, got \(vm.state)")
            return
        }
        XCTAssertNil(content.banner)
        XCTAssertFalse(content.propertyFacts.contains { $0.mismatch })
    }

    func test_load_mismatchHome_projectsMismatchState() async {
        let vm = PropertyDetailsViewModel(homeId: "home-1") { _ in PropertyDetailsSampleData.mismatch }
        await vm.load()
        guard case let .mismatch(content) = vm.state else {
            XCTFail("Expected .mismatch, got \(vm.state)")
            return
        }
        XCTAssertNotNil(content.banner)
        XCTAssertTrue(
            content.propertyFacts.contains { $0.id == "beds" && $0.mismatch },
            "Bedrooms row should carry the mismatch flag"
        )
        // Exactly one row is flagged.
        XCTAssertEqual(content.propertyFacts.filter(\.mismatch).count, 1)
    }

    func test_load_failure_projectsErrorState() async {
        let vm = PropertyDetailsViewModel(homeId: "home-1") { _ in throw LoaderError() }
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
    }

    func test_load_isNoOpOnceResolved() async {
        let box = CallBox(fail: false)
        let vm = PropertyDetailsViewModel(homeId: "home-1") { _ in
            box.calls += 1
            return PropertyDetailsSampleData.mismatch
        }
        await vm.load()
        await vm.load()
        XCTAssertEqual(box.calls, 1, "Second load should short-circuit once resolved")
    }

    func test_refresh_reappliesLoaderAndRecoversFromError() async {
        let box = CallBox(fail: true)
        let vm = PropertyDetailsViewModel(homeId: "home-1") { _ in
            box.calls += 1
            if box.fail { throw LoaderError() }
            return PropertyDetailsSampleData.clean
        }
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error after failing load")
            return
        }
        box.fail = false
        await vm.refresh()
        guard case .clean = vm.state else {
            XCTFail("Expected .clean after recovering refresh")
            return
        }
        XCTAssertEqual(box.calls, 2)
    }

    func test_sampleData_monoFlagsOnExpectedRows() {
        let monoIds: Set<String> = ["year", "beds", "baths", "interior", "lot", "parcel", "zoning", "assessed"]
        let rows = PropertyDetailsSampleData.clean.propertyFacts + PropertyDetailsSampleData.clean.records
        for row in rows where monoIds.contains(row.id) {
            XCTAssertTrue(row.mono, "Row \(row.id) should render monospaced")
        }
        XCTAssertFalse(rows.first { $0.id == "type" }?.mono ?? true, "Type is prose, not mono")
        XCTAssertFalse(rows.first { $0.id == "class" }?.mono ?? true, "Property class is prose, not mono")
    }

    func test_sampleData_cleanAndMismatchShareRecords() {
        XCTAssertEqual(PropertyDetailsSampleData.clean.records, PropertyDetailsSampleData.mismatch.records)
        XCTAssertNil(PropertyDetailsSampleData.clean.banner)
        XCTAssertNotNil(PropertyDetailsSampleData.mismatch.banner)
    }
}
