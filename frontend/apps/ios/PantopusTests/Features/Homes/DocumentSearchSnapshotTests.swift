//
//  DocumentSearchSnapshotTests.swift
//  PantopusTests
//
//  P4.5 — Design-reference baseline tripwire for the Document Search
//  surface. Same shape as `UploadDocumentSnapshotTests`: asserts the
//  baseline PNGs exist at
//
//    `PantopusTests/__Snapshots__/p4-5-document-search/<slug>-ios.png`
//
//  and are valid PNGs, `XCTSkip`-ing when a baseline is missing so the
//  gate exists from day one and the follow-up commits the renders.
//
//  States covered (the SearchListShell phases):
//    • search-recent   → blank recent canvas (empty query, no history)
//    • search-typing   → typing shimmer while the corpus loads
//    • search-results  → matches rendered as reused Documents rows + tags
//    • search-empty    → no-match empty state
//

import XCTest

final class DocumentSearchSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Homes
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("p4-5-document-search")
    }

    func test_document_search_recent_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("search-recent")
    }

    func test_document_search_typing_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("search-typing")
    }

    func test_document_search_results_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("search-results")
    }

    func test_document_search_empty_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("search-empty")
    }

    private func assertBaselineOrSkip(_ slug: String) throws {
        let url = baselineURL.appendingPathComponent("\(slug)-ios.png")
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw XCTSkip("Baseline pending follow-up commit: \(url.path)")
        }
        let data = try Data(contentsOf: url)
        XCTAssertGreaterThan(data.count, 8 * 1024, "Baseline too small (\(data.count) bytes): \(url.path)")
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
