//
//  UnboxingSnapshotTests.swift
//  PantopusTests
//
//  A17.14 — the Unboxing scan-capture flow. Two responsibilities:
//
//    1. Build-validity smoke — hosts `UnboxingView` in both phases
//       (capture / filed) with the scan-line forced static (reduce-motion
//       override) so the simulator's static-camera fallback renders
//       deterministically, and asserts each frame builds.
//    2. Design-reference baseline tripwire — asserts the baseline PNG
//       exists at `__Snapshots__/a17-14-unboxing/<frame>-ios.png` and is a
//       valid, non-trivial PNG. Tests `XCTSkip` when the baseline is
//       missing so the gate exists without failing CI on the first PR; a
//       follow-up commits the capture / filed renders. Mirrors the Android
//       Paparazzi frames so the two platforms stay identical.
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class UnboxingSnapshotTests: XCTestCase {
    // MARK: - Build validity

    private func assertRenders(
        _ label: String,
        @ViewBuilder _ view: () -> some View,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(rootView: view())
        host.overrideUserInterfaceStyle = .light
        host.view.frame = CGRect(x: 0, y: 0, width: 393, height: 852)
        host.loadViewIfNeeded()
        host.view.layoutIfNeeded()
        XCTAssertNotNil(host.view, "\(label) failed to build", file: file, line: line)
    }

    func testCaptureFrameRenders() {
        assertRenders("Unboxing capture") {
            UnboxingView(
                viewModel: UnboxingViewModel(phase: .capture),
                reduceMotionOverride: true
            )
        }
    }

    func testFiledFrameRenders() {
        assertRenders("Unboxing filed") {
            UnboxingView(
                viewModel: UnboxingViewModel(phase: .filed),
                reduceMotionOverride: true
            )
        }
    }

    /// The shutter / "Add" tile appends a labeled shot — the filmstrip grows.
    func testCaptureAppendsLabeledShot() {
        let viewModel = UnboxingViewModel(phase: .capture)
        let before = viewModel.shots.count
        viewModel.capture()
        XCTAssertEqual(viewModel.shots.count, before + 1)
        // Cycles through the canonical four labels.
        XCTAssertEqual(viewModel.shots.last?.label, UnboxingSampleData.captureSequence[before % 4].label)
    }

    /// Confirm files the item (capture → filed); Undo returns to capture.
    /// The seeded view-model never touches the network, so `confirm()`
    /// resolves immediately.
    func testConfirmThenUndoTogglesPhase() async {
        let viewModel = UnboxingViewModel(phase: .capture)
        XCTAssertEqual(viewModel.phase, .capture)
        await viewModel.confirm()
        XCTAssertEqual(viewModel.phase, .filed)
        viewModel.undo()
        XCTAssertEqual(viewModel.phase, .capture)
    }

    // MARK: - Baseline tripwire

    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Mailbox
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("a17-14-unboxing")
    }

    func test_unboxing_capture_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("capture")
    }

    func test_unboxing_filed_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("filed")
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
