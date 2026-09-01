//
//  T8ScreensSnapshotTests.swift
//  PantopusTests
//
//  B7.1 — new-design pack snapshot lockfile, batch 2 (iOS half).
//
//  Locks the batch-2 design hand-off (the screens that post-date the original
//  44-screen audit in `NewDesignScreensSnapshotTests` — A17.11–A17.14, A10.6,
//  A10.7, A10.11, A18.4, A18.5, A19.1, A19.2) as the durable visual reference
//  for every screen built out across Phases B2–B6. One test per screen ×
//  designed variant — 22 rows total — each asserting that its committed
//  reference PNG stays checked in at:
//
//    PantopusTests/Features/__snapshots__/new-designs-batch2/<slug>.png
//
//  This is a *presence tripwire*, mirroring the convention documented in the
//  sibling `NewDesignScreensSnapshotTests.swift` (batch 1) and
//  `T6ScreensSnapshotTests.swift`: it fails when a baseline is deleted,
//  truncated, or replaced by a non-PNG — catching design-reference drift (a
//  dropped screen, a lost variant) in CI. It is deliberately NOT a pixel diff
//  against the live SwiftUI render: the per-screen render suites
//  (`StampsSnapshotTests`, `MailTaskSnapshotTests`, `TranslationSnapshotTests`,
//  `UnboxingSnapshotTests`, `BusinessProfileSnapshotTests`, `EarnSnapshotTests`,
//  `WaitingRoomSnapshotTests`, `ViewAsSnapshotTests`,
//  `LegalDocumentSnapshotTests`, …) lock the implementation; this file locks
//  the *design pack* those screens target. See `NEW_DESIGNS_BATCH2.md` (same
//  folder) for the regeneration policy — when, by whom, and with what approval
//  the baselines may be re-cut.
//
//  The reference PNGs are platform-neutral (the designer ships one frame per
//  screen × variant; iOS and Android target the same contract), so the same
//  bytes are committed under the Android Paparazzi snapshot dir and locked by
//  `NewDesignBatch2ScreensSnapshotTest.kt`.
//

import XCTest

final class T8ScreensSnapshotTests: XCTestCase {
    /// PantopusTests/Features/__snapshots__/new-designs-batch2/ — resolved
    /// relative to this source file (Features/Shared/…) so the rig is
    /// location-independent.
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Shared
            .deletingLastPathComponent() // Features
            .appendingPathComponent("__snapshots__")
            .appendingPathComponent("new-designs-batch2")
    }

    // MARK: - A17 — Mailbox standalone screens (B2)

    func test_a17_11_stamps_populated() throws {
        try assertBaseline("a17-11-stamps-populated")
    }

    func test_a17_11_stamps_empty() throws {
        try assertBaseline("a17-11-stamps-empty")
    }

    func test_a17_12_mail_task_open() throws {
        try assertBaseline("a17-12-mail-task-open")
    }

    func test_a17_12_mail_task_done() throws {
        try assertBaseline("a17-12-mail-task-done")
    }

    func test_a17_13_translation_machine() throws {
        try assertBaseline("a17-13-translation-machine")
    }

    func test_a17_13_translation_confirmed() throws {
        try assertBaseline("a17-13-translation-confirmed")
    }

    func test_a17_14_unboxing_classified() throws {
        try assertBaseline("a17-14-unboxing-classified")
    }

    func test_a17_14_unboxing_filed() throws {
        try assertBaseline("a17-14-unboxing-filed")
    }

    // MARK: - A10 — Business surfaces + Earn (B3 / B4)

    func test_a10_6_business_profile_populated() throws {
        try assertBaseline("a10-6-business-profile-populated")
    }

    func test_a10_6_business_profile_new() throws {
        try assertBaseline("a10-6-business-profile-new")
    }

    func test_a10_7_business_owner_edit() throws {
        try assertBaseline("a10-7-business-owner-edit")
    }

    func test_a10_7_business_owner_preview() throws {
        try assertBaseline("a10-7-business-owner-preview")
    }

    func test_a10_11_earn_populated() throws {
        try assertBaseline("a10-11-earn-populated")
    }

    func test_a10_11_earn_empty() throws {
        try assertBaseline("a10-11-earn-empty")
    }

    // MARK: - A18 — Status / waiting / preview (B5)

    func test_a18_4_waiting_room_active() throws {
        try assertBaseline("a18-4-waiting-room-active")
    }

    func test_a18_4_waiting_room_more_info() throws {
        try assertBaseline("a18-4-waiting-room-more-info")
    }

    func test_a18_5_view_as_connection() throws {
        try assertBaseline("a18-5-view-as-connection")
    }

    func test_a18_5_view_as_public() throws {
        try assertBaseline("a18-5-view-as-public")
    }

    // MARK: - A19 — Legal long-form archetype (B6)

    func test_a19_1_privacy_top() throws {
        try assertBaseline("a19-1-privacy-top")
    }

    func test_a19_1_privacy_reading() throws {
        try assertBaseline("a19-1-privacy-reading")
    }

    func test_a19_2_terms_top() throws {
        try assertBaseline("a19-2-terms-top")
    }

    func test_a19_2_terms_reading() throws {
        try assertBaseline("a19-2-terms-reading")
    }

    // MARK: - Helper

    private func assertBaseline(_ slug: String) throws {
        let url = baselineURL.appendingPathComponent("\(slug).png")
        XCTAssertTrue(
            FileManager.default.fileExists(atPath: url.path),
            "Missing batch-2 new-design baseline: \(url.path)"
        )
        let data = try Data(contentsOf: url)
        XCTAssertGreaterThan(
            data.count,
            4 * 1024,
            "Batch-2 new-design baseline too small (\(data.count) bytes): \(url.path)"
        )
        // PNG magic bytes.
        XCTAssertTrue(
            data.starts(with: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
            "Batch-2 new-design baseline isn't a PNG: \(url.path)"
        )
    }
}
