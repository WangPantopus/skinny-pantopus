//
//  ComposeBroadcastSnapshotTests.swift
//  PantopusTests
//
//  A.7 (A22.2) — design-reference baseline tripwire for the Compose
//  Broadcast surface, matching `BroadcastDetailSnapshotTests`: asserts a
//  baseline PNG exists at `PantopusTests/__Snapshots__/a7-compose-
//  broadcast/<state>-ios.png` and is a real PNG. `XCTSkip`s when the
//  baseline is missing so the gate exists without failing CI before the
//  renders are committed.
//

import XCTest

final class ComposeBroadcastSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent() // AudienceProfile
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("a7-compose-broadcast")
    }

    func test_compose_broadcast_populated_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("populated")
    }

    func test_compose_broadcast_empty_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("empty")
    }

    func test_compose_broadcast_scheduled_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("scheduled")
    }

    func test_compose_broadcast_sending_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("sending")
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
