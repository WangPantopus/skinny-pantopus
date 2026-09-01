//
//  TranslationSnapshotTests.swift
//  PantopusTests
//
//  B2.3 (A17.13) — Design-reference baseline tripwire for the two
//  Translation frames (machine · confirmed). Mirrors the other Mailbox
//  snapshot gates: asserts the baseline PNG exists at
//  `PantopusTests/__Snapshots__/new-designs/mailbox-translation-<frame>-ios.png`
//  and is a non-trivial PNG. Ships with `XCTSkip` so the gate exists without
//  failing CI on a missing image; the batch-2 lockfile prompt (B7) commits
//  the baselines recorded on the macOS runner and drops the skip.
//

import XCTest

final class TranslationSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Mailbox
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("new-designs")
    }

    func test_translation_machine_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("mailbox-translation-machine")
    }

    func test_translation_confirmed_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("mailbox-translation-confirmed")
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
