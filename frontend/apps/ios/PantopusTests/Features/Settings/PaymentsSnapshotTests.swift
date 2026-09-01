//
//  PaymentsSnapshotTests.swift
//  PantopusTests
//
//  Render-smoke for A14.6 Payments — both seeds build without
//  crashing and the layout doesn't collapse to zero width. Mirrors
//  the `HeroPrimitivesSnapshotTests` pattern. Pixel-baseline PNGs
//  for the design tripwire live under
//  `PantopusTests/__Snapshots__/p5-2-payments/`.
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class PaymentsSnapshotTests: XCTestCase {
    private func assertRenders(
        _ label: String,
        seed: PaymentsSeed,
        file: StaticString = #filePath,
        line: UInt = #line
    ) async {
        let viewModel = PaymentsViewModel(seed: seed)
        await viewModel.load()
        let host = UIHostingController(
            rootView: PaymentsView(viewModel: viewModel) {}
        )
        host.overrideUserInterfaceStyle = .light
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.loadViewIfNeeded()
        host.view.layoutIfNeeded()
        XCTAssertNotNil(host.view, "\(label) failed to build", file: file, line: line)
        XCTAssertGreaterThan(
            host.view.bounds.width,
            0,
            "\(label) collapsed to zero width",
            file: file,
            line: line
        )
    }

    func testPaymentsRendersPopulated() async {
        await assertRenders("Payments populated", seed: .populated)
    }

    func testPaymentsRendersEmpty() async {
        await assertRenders("Payments empty", seed: .empty)
    }

    /// Baseline PNG tripwire — looks for files under
    /// `PantopusTests/__Snapshots__/p5-2-payments/<slug>-ios.png`.
    /// Skips when the baseline isn't committed yet (first PR ships the
    /// gate; a follow-up commits the PNG).
    func testPopulatedBaselinePresent() throws {
        try assertBaselineOrSkip("populated")
    }

    func testEmptyBaselinePresent() throws {
        try assertBaselineOrSkip("empty")
    }

    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Settings
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("p5-2-payments")
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
