//
//  ReportUserSheetSnapshotTests.swift
//  PantopusTests
//
//  P6.2 — design-reference baseline tripwires for the Report-User sheet
//  states. Mirrors `RecentActivitySnapshotTests`: asserts the baseline
//  PNG exists at `PantopusTests/__Snapshots__/report-user-sheet/<state>-ios.png`
//  and is a valid PNG. The first PR ships the file with `XCTSkip` so
//  the gate exists without failing CI on missing images; the baselines
//  land in the follow-up render harness commit.
//

import XCTest

final class ReportUserSheetSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Profile
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("report-user-sheet")
    }

    func test_report_user_sheet_idle_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("idle")
    }

    func test_report_user_sheet_reason_selected_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("reason-selected")
    }

    func test_report_user_sheet_other_requires_details_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("other-requires-details")
    }

    func test_report_user_sheet_submitting_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("submitting")
    }

    func test_report_user_sheet_failed_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("failed")
    }

    private func assertBaselineOrSkip(_ screen: String) throws {
        let url = baselineURL.appendingPathComponent("\(screen)-ios.png")
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
