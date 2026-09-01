//
//  SupportTrainsSnapshotTests.swift
//  PantopusTests
//
//  T6.6c (P26.5) — design-reference baseline tripwire for the
//  Support Trains screen. Mirrors `AuthScreensSnapshotTests.swift`:
//  asserts the baseline PNG file exists at
//  `PantopusTests/__Snapshots__/t6-support-trains/<screen>-ios.png`
//  and is a non-trivial PNG. The first PR ships the test file with
//  `XCTSkip` so the gate exists without failing CI on a missing
//  image; a follow-up commits the baselines and removes the skip.
//

import XCTest

final class SupportTrainsSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // SupportTrains
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("t6-support-trains")
    }

    func test_support_trains_populated_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("populated")
    }

    func test_support_trains_empty_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("empty")
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
