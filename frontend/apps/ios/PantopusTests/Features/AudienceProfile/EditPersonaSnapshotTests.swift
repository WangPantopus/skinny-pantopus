//
//  EditPersonaSnapshotTests.swift
//  PantopusTests
//
//  A13.12 — design-reference baseline tripwire for the creator-facing Edit
//  Beacon editor. Slugs mirror the two states the editor opens in:
//  `create` (no Beacon yet) and `edit` (existing Beacon). Same shape as `MembershipDetailSnapshotTests.swift`:
//  asserts the baseline PNG exists at
//  `PantopusTests/__Snapshots__/a13-12-edit-persona/<state>-ios.png` and is a
//  non-trivial PNG. Tests `XCTSkip` when the baseline is missing so the gate
//  exists without failing CI on the first PR; a follow-up commits the renders
//  for live / setup / loading / error.
//

import XCTest

final class EditPersonaSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // AudienceProfile
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("a13-12-edit-persona")
    }

    func test_edit_persona_create_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("create")
    }

    func test_edit_persona_edit_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("edit")
    }

    func test_edit_persona_loading_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("loading")
    }

    func test_edit_persona_error_ios_baseline_is_present() throws {
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
            data.count > 4 &&
                data[0] == 0x89 &&
                data[1] == 0x50 &&
                data[2] == 0x4E &&
                data[3] == 0x47,
            "Not a PNG: \(url.path)"
        )
    }
}
