//
//  TasksMapSnapshotTests.swift
//  PantopusTests
//
//  A11.1 — design-reference baseline tripwire for the Tasks map. Same
//  shape as the other screen snapshot gates: asserts the baseline PNG
//  exists at `PantopusTests/__Snapshots__/a11-tasks-map/<state>-ios.png`
//  and is a non-trivial PNG. `XCTSkip`s when the baseline is missing so
//  the gate exists without failing CI before the renders are committed.
//
//  Two frames mirror the design: POPULATED (40% sheet, nine category
//  pins, rail of task cards) and EMPTY (anchor-only map, in-sheet empty
//  hero with Post-a-task / Widen-search CTAs).
//

import XCTest

final class TasksMapSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Gigs
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("a11-tasks-map")
    }

    func test_tasks_map_populated_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("populated")
    }

    func test_tasks_map_empty_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("empty")
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
