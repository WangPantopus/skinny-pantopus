//
//  ExploreMapSnapshotTests.swift
//  PantopusTests
//
//  A11.2 Explore — design-reference baseline tripwire. Mirrors the other
//  snapshot tripwires: asserts each baseline PNG exists at
//  `PantopusTests/__Snapshots__/a11-explore/<state>-ios.png` and is a
//  non-trivial PNG; `XCTSkip`s while a baseline is pending.
//
//  States: loading / empty / populated / error.
//

import XCTest

final class ExploreMapSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent() // Explore
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("a11-explore")
    }

    func test_explore_loading_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("loading")
    }

    func test_explore_empty_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("empty")
    }

    func test_explore_populated_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("populated")
    }

    func test_explore_error_ios_baseline_is_present() throws {
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
            data.count > 4 && data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47,
            "Not a PNG: \(url.path)"
        )
    }
}
