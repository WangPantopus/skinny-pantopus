//
//  MailDaySnapshotTests.swift
//  PantopusTests
//
//  A13.16 — design-reference baseline tripwire for the My Mail Day
//  editor. Asserts the baseline PNG exists at
//  `PantopusTests/__Snapshots__/a13-16-mail-day/<frame>-ios.png` and is
//  a valid, non-trivial PNG. Tests `XCTSkip` when the baseline is
//  missing so the gate exists without failing CI on the first PR; a
//  follow-up commits the populated / empty renders.
//

import XCTest

final class MailDaySnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Mailbox
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("a13-16-mail-day")
    }

    func test_mail_day_populated_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("populated")
    }

    func test_mail_day_empty_ios_baseline_is_present() throws {
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
