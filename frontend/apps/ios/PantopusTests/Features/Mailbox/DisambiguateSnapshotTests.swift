//
//  DisambiguateSnapshotTests.swift
//  PantopusTests
//
//  A13.15 reshape render-smoke coverage: the full Disambiguate screen in its
//  strong-match and unclear-scan frames, plus each new component
//  (OcrStrip / CandidateRow / MatchBadge / QuickActionChip / FallbackRow).
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class DisambiguateSnapshotTests: XCTestCase {
    private func assertRenders(
        _ label: String,
        @ViewBuilder _ view: () -> some View,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(rootView: view())
        host.overrideUserInterfaceStyle = .light
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.loadViewIfNeeded()
        host.view.layoutIfNeeded()
        XCTAssertNotNil(host.view, "\(label) failed to build", file: file, line: line)
    }

    // MARK: - Full screen, both frames

    func testStrongMatchFrameRenders() {
        assertRenders("Disambiguate strong") {
            DisambiguateMailFormView(
                mailId: "m-strong",
                ocrRecipient: "Maria K. · 412 Elm St",
                confidence: 0.97
            ) {}
        }
    }

    func testUnclearScanFrameRenders() {
        assertRenders("Disambiguate unclear") {
            DisambiguateMailFormView(
                mailId: "m-unclear",
                ocrRecipient: "M___ K___ · 4__ Elm St",
                confidence: 0.31
            ) {}
        }
    }

    // MARK: - Components

    func testOcrStripRendersBothTones() {
        assertRenders("OcrStrip good") {
            OcrStrip(
                tone: .clean,
                detected: "Maria K. · 412 Elm St",
                confidence: 97,
                sub: "Address matches this household."
            )
        }
        assertRenders("OcrStrip warn") {
            OcrStrip(
                tone: .unclear,
                detected: "M___ K___ · 4__ Elm St",
                confidence: 31,
                sub: "Smudge on the name line. Try a brighter re-scan for a sharper read."
            )
        }
    }

    func testCandidateRowRendersAcrossStates() {
        let clear = DisambiguateMailFormViewModel.sampleCandidates(clear: true)
        let unclear = DisambiguateMailFormViewModel.sampleCandidates(clear: false)
        assertRenders("CandidateRow selected") {
            CandidateRow(candidate: clear[0], isSelected: true, isSelectable: true) {}
        }
        assertRenders("CandidateRow unselected") {
            CandidateRow(candidate: clear[1], isSelected: false, isSelectable: true) {}
        }
        assertRenders("CandidateRow inert guest") {
            CandidateRow(candidate: unclear[2], isSelected: false, isSelectable: false) {}
        }
    }

    func testMatchBadgeRendersAllTiers() {
        for (tier, percent) in [(MailMatchTier.strong, 97), (.partial, 41), (.weak, 22)] {
            assertRenders("MatchBadge \(tier)") { MatchBadge(tier: tier, percent: percent) }
        }
    }

    func testQuickActionChipRendersBothStyles() {
        assertRenders("QuickActionChip primary") {
            QuickActionChip(icon: .userCheck, label: "This is me", isPrimary: true) {}
        }
        assertRenders("QuickActionChip neutral") {
            QuickActionChip(icon: .forward, label: "Route to…", isPrimary: false) {}
        }
    }

    func testFallbackRowRendersNormalAndDestructive() {
        assertRenders("FallbackRow normal") {
            FallbackRow(
                icon: .scanLine,
                title: "Re-scan envelope",
                subtitle: "Hold under brighter light. Most-used fix."
            ) {}
        }
        assertRenders("FallbackRow destructive") {
            FallbackRow(
                icon: .trash2,
                title: "Mark as junk",
                subtitle: "Skip routing. Sender added to junk filter.",
                isDestructive: true,
                showsDivider: false
            ) {}
        }
    }
}
