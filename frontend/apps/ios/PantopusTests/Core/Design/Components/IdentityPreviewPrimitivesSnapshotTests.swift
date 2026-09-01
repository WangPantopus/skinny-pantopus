//
//  IdentityPreviewPrimitivesSnapshotTests.swift
//  PantopusTests
//
//  B1.3 — identity-preview primitives `ViewerPicker` (+ `LiveBadge`) and
//  `RedactionScrim`, the "View as" chrome A18.5 depends on. Mirrors the
//  `HeroPrimitivesSnapshotTests` pattern: host each designed state in a
//  `UIHostingController` and assert it builds with a non-zero layout.
//  Pixel baselines for the consuming screen land with the B7 lockfile;
//  this file owns the primitive-level render contract.
//
//  Coverage: ViewerPicker once per selectable `ViewerAudience` (the
//  selected chip recolours to its pillar) + RedactionScrim once per
//  `RedactionLevel`.
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class IdentityPreviewPrimitivesSnapshotTests: XCTestCase {
    private func assertRenders(
        _ label: String,
        size: CGSize,
        @ViewBuilder _ view: () -> some View,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(rootView: view())
        host.overrideUserInterfaceStyle = .light
        host.view.frame = CGRect(origin: .zero, size: size)
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

    // MARK: - ViewerPicker (one snapshot per selection)

    func testViewerPicker_eachSelection() {
        for audience in ViewerAudience.allCases {
            assertRenders("ViewerPicker selection=\(audience.id)", size: CGSize(width: 375, height: 120)) {
                ViewerPicker(selection: audience, title: "Preview your profile as") { _ in }
            }
        }
    }

    func testViewerPicker_withoutTitle() {
        assertRenders("ViewerPicker no title", size: CGSize(width: 375, height: 90)) {
            ViewerPicker(selection: .public) { _ in }
        }
    }

    // MARK: - LiveBadge

    func testLiveBadge_variants() {
        assertRenders("LiveBadge default", size: CGSize(width: 160, height: 60)) {
            HStack(spacing: Spacing.s2) {
                LiveBadge()
                LiveBadge(label: "Preview", tone: Theme.Color.warning)
            }
        }
    }

    // MARK: - RedactionScrim (one snapshot per level)

    func testRedactionScrim_eachLevel() {
        for level in RedactionLevel.allCases {
            assertRenders("RedactionScrim level=\(level.rawValue)", size: CGSize(width: 320, height: 120)) {
                RedactionScrim(level: level, label: "Hidden from public") {
                    sampleField
                }
            }
        }
    }

    func testRedactionScrim_chipHidden() {
        assertRenders("RedactionScrim chip hidden", size: CGSize(width: 320, height: 120)) {
            RedactionScrim(level: .fuzzed, showsChip: false) {
                sampleField
            }
        }
    }

    private var sampleField: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("Contact")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextMuted)
            Text("(555) 010-2837")
                .font(.system(size: 13.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
    }
}
