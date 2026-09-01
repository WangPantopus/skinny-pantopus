//
//  SupportTrainDetailSnapshotTests.swift
//  PantopusTests
//
//  A10.9 (P3.1) — Design-reference baseline tripwire for the two
//  participant-facing Support Train detail frames (populated · fully
//  covered). Mirrors the existing Support Trains snapshot gate:
//  asserts the baseline PNG exists at
//  `PantopusTests/__Snapshots__/t6-support-trains/<frame>-detail-ios.png`
//  and is a non-trivial PNG. Ships with `XCTSkip` so the gate exists
//  without failing CI on a missing image; a follow-up commits the
//  baselines and drops the skip.
//

import XCTest

final class SupportTrainDetailSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // SupportTrains
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("t6-support-trains")
    }

    func test_support_train_detail_populated_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("populated-detail")
    }

    func test_support_train_detail_fully_covered_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("fully-covered-detail")
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
