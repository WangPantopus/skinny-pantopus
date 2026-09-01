//
//  CapturePrimitivesSnapshotTests.swift
//  PantopusTests
//
//  Build-validity smoke for the B1.2 capture primitives — `OcrFactsList`
//  (editable + locked), `CapturedFilmstrip`, and `CameraScanner` (the static
//  fallback state, which is what the simulator renders since the live
//  `AVCaptureSession` is compiled out). Hosts each frame in a
//  UIHostingController and asserts it builds. The reduce-motion override
//  exercises the scan-line-static path.
//
//  Pixel-baseline tripwires for the full A17.14 Unboxing screen that consumes
//  these primitives land with B2.4; this file owns the primitive-level
//  contract.
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class CapturePrimitivesSnapshotTests: XCTestCase {
    private func assertRenders(
        _ label: String,
        @ViewBuilder _ view: () -> some View,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(rootView: view())
        host.overrideUserInterfaceStyle = .light
        host.view.frame = CGRect(x: 0, y: 0, width: 375, height: 320)
        host.loadViewIfNeeded()
        XCTAssertNotNil(host.view, "\(label) failed to build", file: file, line: line)
    }

    private var sampleFacts: [OcrFact] {
        [
            OcrFact(icon: .package, label: "Product", value: "Breville Barista Express", note: "BES870XL · Stainless"),
            OcrFact(icon: .hash, label: "Serial", value: "BES870-22F-091473", isCode: true),
            OcrFact(
                icon: .receipt,
                label: "Purchased",
                value: "May 28, 2026 · $699.95",
                note: "Williams Sonoma · card ••4417"
            ),
            OcrFact(
                icon: .shieldCheck,
                label: "Warranty until",
                value: "May 28, 2028",
                tag: OcrFactTag(text: "2-yr", tone: .success)
            )
        ]
    }

    // MARK: - OcrFactsList

    func testOcrFactsListEditableRenders() {
        assertRenders("OcrFactsList editable") {
            OcrFactsList(
                title: "Read from your scans",
                status: OcrFactsStatus(icon: .scanLine, text: "Tap to edit", tone: .neutral),
                facts: sampleFacts
            )
            .padding()
        }
    }

    func testOcrFactsListLockedRenders() {
        assertRenders("OcrFactsList locked") {
            OcrFactsList(
                title: "Read from your scans",
                status: OcrFactsStatus(icon: .lock, text: "Saved", tone: .success),
                facts: sampleFacts
            )
            .padding()
        }
    }

    func testOcrFactsListWithoutStatusRenders() {
        assertRenders("OcrFactsList no status") {
            OcrFactsList(title: "Read from your scans", facts: sampleFacts)
                .padding()
        }
    }

    // MARK: - CapturedFilmstrip

    func testCapturedFilmstripRenders() {
        assertRenders("CapturedFilmstrip") {
            CapturedFilmstrip(
                accent: Theme.Color.success,
                shots: [
                    CameraScannerShot(tag: "UNIT", label: "The machine", isMain: true),
                    CameraScannerShot(tag: "BOX", label: "Box + barcode"),
                    CameraScannerShot(tag: "RECEIPT", label: "Store receipt"),
                    CameraScannerShot(tag: "LABEL", label: "Serial label")
                ]
            ) {}
                .padding()
        }
    }

    // MARK: - CameraScanner (fallback state)

    func testCameraScannerFallbackRenders() {
        assertRenders("CameraScanner fallback") {
            CameraScanner(accent: Theme.Color.success) { _ in }
                .padding()
        }
    }

    /// Reduce-motion contract — the scan-line must not start its repeating
    /// animation. We assert the view still builds with the override applied;
    /// visual verification lives in #Preview.
    func testCameraScannerRespectsReduceMotion() {
        assertRenders("CameraScanner reduce-motion") {
            CameraScanner(accent: Theme.Color.success, reduceMotionOverride: true) { _ in }
                .padding()
        }
    }
}
