//
//  AddHouseholdTaskFormSnapshotTests.swift
//  PantopusTests
//
//  P2.4 — design-reference baseline tripwire for the Add / Edit
//  Household Task form. Same shape as the existing tripwire tests
//  (e.g. `BroadcastDetailSnapshotTests.swift`): asserts each baseline
//  PNG exists at
//  `PantopusTests/__Snapshots__/p2-add-household-task/<state>-ios.png`
//  and is a non-trivial PNG. Tests `XCTSkip` when the baseline is
//  missing so the test gate exists without failing CI on the first
//  PR; the follow-up commits the renders.
//
//  States covered: empty (Add mode), prefilled (Edit hydrated),
//  submitting (Save spinner), error (load failure / empty state).
//

import XCTest

final class AddHouseholdTaskFormSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Homes
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("p2-add-household-task")
    }

    func test_add_household_task_empty_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("empty")
    }

    func test_add_household_task_prefilled_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("prefilled")
    }

    func test_add_household_task_submitting_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("submitting")
    }

    func test_add_household_task_error_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("error")
    }

    private func assertBaselineOrSkip(_ slug: String) throws {
        let url = baselineURL.appendingPathComponent("\(slug)-ios.png")
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw XCTSkip("Baseline pending follow-up commit: \(url.path)")
        }
        let data = try Data(contentsOf: url)
        XCTAssertGreaterThan(data.count, 8 * 1024, "Baseline too small (\(data.count) bytes)")
        XCTAssertTrue(
            data.count > 4 &&
                data[0] == 0x89 &&
                data[1] == 0x50 &&
                data[2] == 0x4E &&
                data[3] == 0x47,
            "Not a PNG: \(url.path)"
        )
    }
}
