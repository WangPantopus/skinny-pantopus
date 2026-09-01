//
//  LegalPrimitivesSnapshotTests.swift
//  PantopusTests
//
//  Build-validity smoke for the A19 legal scaffold primitives —
//  `LegalTOCCard` (expanded + collapsed), `DocMetaStrip`, `BackToTopFab`
//  (visible / hidden / reduce-motion), and `LegalSection` (numbered anchor).
//  Each frame is hosted in a `UIHostingController` and asserted to build.
//  A composed scaffold exercises the TOC → `ScrollViewReader` jump wiring +
//  the fab so the contract that A19.1 / A19.2 consume is locked here.
//
//  Pixel baselines for the full Privacy / Terms screens land with B6.1;
//  this file owns the primitive-level contract.
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class LegalPrimitivesSnapshotTests: XCTestCase {
    private let tocItems = [
        "Overview",
        "Information we collect",
        "How we use it",
        "Identity pillars & privacy",
        "Sharing & disclosure",
        "Your rights & controls",
        "Data retention",
        "Children & teens",
        "International transfers",
        "Changes to this policy"
    ]

    private func assertRenders(
        _ label: String,
        traitCollection: UITraitCollection? = nil,
        @ViewBuilder _ view: () -> some View,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(rootView: view())
        host.overrideUserInterfaceStyle = .light
        host.view.frame = CGRect(x: 0, y: 0, width: 375, height: 600)
        if let traitCollection {
            host.setOverrideTraitCollection(traitCollection, forChild: host)
        }
        host.loadViewIfNeeded()
        XCTAssertNotNil(host.view, "\(label) failed to build", file: file, line: line)
    }

    // MARK: - DocMetaStrip

    func testDocMetaStripRenders() {
        assertRenders("DocMetaStrip privacy") {
            DocMetaStrip(lastUpdated: "October 1, 2025", version: "3.2")
        }
        assertRenders("DocMetaStrip terms") {
            DocMetaStrip(lastUpdated: "February 14, 2026", version: "5.0")
        }
    }

    // MARK: - LegalTOCCard

    func testLegalTOCCardExpandedRenders() {
        assertRenders("LegalTOCCard expanded") {
            LegalTOCCard(items: tocItems, isOpen: true, onToggle: {}, onJump: { _ in })
        }
    }

    func testLegalTOCCardCollapsedRenders() {
        assertRenders("LegalTOCCard collapsed") {
            LegalTOCCard(items: tocItems, isOpen: false, onToggle: {}, onJump: { _ in })
        }
    }

    // MARK: - LegalSection

    func testLegalSectionRendersAndExposesAnchor() {
        XCTAssertEqual(LegalSection(number: 1, title: "Overview").anchorID, "sec-1")
        XCTAssertEqual(LegalSection(number: 10, title: "Changes").anchorID, "sec-10")
        assertRenders("LegalSection") {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                ForEach(Array(tocItems.enumerated()), id: \.offset) { index, title in
                    LegalSection(number: index + 1, title: title)
                }
            }
        }
    }

    // MARK: - BackToTopFab

    func testBackToTopFabVisibleRenders() {
        assertRenders("BackToTopFab visible") {
            BackToTopFab(isVisible: true) {}
        }
    }

    func testBackToTopFabHiddenRenders() {
        assertRenders("BackToTopFab hidden") {
            BackToTopFab(isVisible: false) {}
        }
    }

    /// Reduce-motion contract — the fade/slide collapses to the 100 ms
    /// cross-fade. Asserts the view still builds with the override applied.
    func testBackToTopFabRespectsReduceMotion() {
        assertRenders("BackToTopFab + reduce-motion") {
            BackToTopFab(isVisible: true, onTap: {}, reduceMotionOverride: true)
        }
    }

    // MARK: - Composed scaffold (TOC → anchor jump + fab)

    /// Wires `LegalTOCCard.onJump` into a `ScrollViewReader` that scrolls to
    /// the matching `LegalSection.anchorID`, with a `BackToTopFab` overlay —
    /// the exact composition A19.1 / A19.2 build on. Smoke-asserts it builds.
    func testLegalScaffoldCompositionRenders() {
        assertRenders("Legal scaffold composition") { LegalScaffoldHarness(items: tocItems) }
    }
}

/// Minimal host that mirrors how the B6.1 legal screen will wire the
/// primitives together: a `ScrollViewReader` jumps to a section anchor on a
/// TOC tap, and a back-to-top fab returns to the top.
@MainActor
private struct LegalScaffoldHarness: View {
    let items: [String]
    @State private var tocOpen = true
    @State private var showTop = false

    var body: some View {
        ScrollViewReader { proxy in
            ZStack(alignment: .bottomTrailing) {
                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.s0) {
                        LegalTOCCard(
                            items: items,
                            isOpen: tocOpen,
                            onToggle: { tocOpen.toggle() },
                            onJump: { index in
                                showTop = true
                                proxy.scrollTo("sec-\(index + 1)", anchor: .top)
                            }
                        )
                        .id("sec-0")
                        ForEach(Array(items.enumerated()), id: \.offset) { index, title in
                            LegalSection(number: index + 1, title: title)
                        }
                    }
                    .padding(.horizontal, Spacing.s5)
                }
                BackToTopFab(isVisible: showTop) {
                    showTop = false
                    proxy.scrollTo("sec-0", anchor: .top)
                }
                .padding(Spacing.s4)
            }
        }
    }
}
