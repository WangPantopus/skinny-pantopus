//
//  WalletSnapshotTests.swift
//  PantopusTests
//
//  A10.10 — design-reference baseline tripwire for the two Wallet
//  frames (Populated / Hold). Matches the established `today-*-ios`
//  pattern: asserts the baseline PNG exists at
//  `PantopusTests/__Snapshots__/t6/wallet-<frame>-ios.png` and is a
//  valid PNG of non-trivial size. Catches accidental deletion of the
//  visual contract until full SwiftUI snapshot tests land.
//

import XCTest

final class WalletSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Wallet
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("t6")
    }

    func test_wallet_populated_ios_baseline_is_present() throws {
        try assertBaseline("wallet-populated")
    }

    func test_wallet_hold_ios_baseline_is_present() throws {
        try assertBaseline("wallet-hold")
    }

    private func assertBaseline(_ screen: String) throws {
        let url = baselineURL.appendingPathComponent("\(screen)-ios.png")
        XCTAssertTrue(
            FileManager.default.fileExists(atPath: url.path),
            "Missing baseline: \(url.path)"
        )
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
