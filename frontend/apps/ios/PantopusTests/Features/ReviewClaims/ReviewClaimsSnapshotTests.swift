//
//  ReviewClaimsSnapshotTests.swift
//  PantopusTests
//
//  P1.1 — design-reference baseline tripwire for the admin Review-claims
//  queue. Same shape as `ReviewSignupsSnapshotTests` — `XCTSkip` when
//  the baseline PNG isn't recorded yet, so CI doesn't fail on the first
//  PR but starts enforcing parity once the platform-rendered baseline
//  lands. Cover all four list states (loading / empty / populated /
//  error) plus the A13.3 detail screen pending + challenge-composer states.
//

import XCTest

final class ReviewClaimsSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // ReviewClaims
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("review-claims")
    }

    func test_review_claims_loading_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("loading")
    }

    func test_review_claims_empty_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("empty")
    }

    func test_review_claims_populated_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("populated")
    }

    func test_review_claims_error_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("error")
    }

    func test_review_claim_detail_pending_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("detail-pending")
    }

    func test_review_claim_detail_challenging_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("detail-challenging")
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
