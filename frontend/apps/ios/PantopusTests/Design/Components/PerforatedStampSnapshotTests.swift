//
//  PerforatedStampSnapshotTests.swift
//  PantopusTests
//
//  Build-validity smoke for `PerforatedStamp` (+ `Postmark`, `ForeverArt`)
//  — the postage primitives A17.11 Stamps depends on. Hosts each designed
//  state in a UIHostingController and asserts it builds: the perforated
//  even-odd mask, the engraved frame, the default Forever artwork (full +
//  compact), the `used` postmark overlay, and the standalone Postmark.
//
//  Pixel baselines for the Stamps screen that consumes these live with the
//  B2.1 screen snapshots; this file owns the primitive-level contract.
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class PerforatedStampSnapshotTests: XCTestCase {
    private func assertRenders(
        _ label: String,
        size: CGSize = CGSize(width: 375, height: 220),
        @ViewBuilder _ view: () -> some View,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(rootView: view())
        host.overrideUserInterfaceStyle = .light
        host.view.frame = CGRect(origin: .zero, size: size)
        host.loadViewIfNeeded()
        XCTAssertNotNil(host.view, "\(label) failed to build", file: file, line: line)
    }

    func testInkVariantsRender() {
        let inks: [(String, Color)] = [
            ("stamps", Theme.Color.categoryStamps),
            ("rose", Theme.Color.rose),
            ("magic", Theme.Color.magic),
            ("home", Theme.Color.home),
            ("warmAmber", Theme.Color.warmAmber)
        ]
        for (name, ink) in inks {
            assertRenders("PerforatedStamp ink \(name)") {
                PerforatedStamp(ink: ink, width: 64, height: 84)
            }
        }
    }

    func testFeaturedUnusedAndUsedRender() {
        assertRenders("PerforatedStamp featured unused") {
            PerforatedStamp(ink: Theme.Color.categoryStamps, width: 104, height: 132)
        }
        assertRenders("PerforatedStamp featured used") {
            PerforatedStamp(ink: Theme.Color.categoryStamps, width: 104, height: 132, used: true)
        }
    }

    func testCompactArtworkRenders() {
        assertRenders("PerforatedStamp compact (sheet cell)") {
            PerforatedStamp(ink: Theme.Color.categoryStamps, width: 68, height: 68, toothRadius: 3, toothGap: 9)
        }
    }

    func testForeverArtScalesRender() {
        assertRenders("ForeverArt full") {
            ForeverArt().frame(width: 104, height: 132).background(Theme.Color.categoryStamps)
        }
        assertRenders("ForeverArt small") {
            ForeverArt(small: true).frame(width: 58, height: 74).background(Theme.Color.categoryStamps)
        }
    }

    func testPostmarkRenders() {
        assertRenders("Postmark standalone") {
            Postmark().frame(width: 80, height: 60).background(Theme.Color.categoryStamps)
        }
    }
}
