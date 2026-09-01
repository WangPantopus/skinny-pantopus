//
//  LegalDocumentSnapshotTests.swift
//  PantopusTests
//
//  B6.1 — full-screen snapshot gate for the A19 long-form legal viewer.
//  Four frames, one per design entry: Privacy + Terms, each in its
//  TOC-expanded entry state and its collapsed mid-scroll reading state
//  (TOC closed, back-to-top fab visible). Mirrors the established
//  `DiscoverHubSnapshotTests` shape — render the stateless `LegalScaffold`
//  through `ImageRenderer` and assert a non-trivial PNG.
//
//  The Android mirror is `LegalDocumentSnapshotTest` (Paparazzi); the two
//  render the same four frames from the same verbatim copy.
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class LegalDocumentSnapshotTests: XCTestCase {
    func test_privacy_toc_expanded_entry_frame() {
        assertSnapshot(.privacy, tocOpen: true, showBackToTop: false)
    }

    func test_privacy_collapsed_reading_frame() {
        assertSnapshot(.privacy, tocOpen: false, showBackToTop: true)
    }

    func test_terms_toc_expanded_entry_frame() {
        assertSnapshot(.terms, tocOpen: true, showBackToTop: false)
    }

    func test_terms_collapsed_reading_frame() {
        assertSnapshot(.terms, tocOpen: false, showBackToTop: true)
    }

    private func assertSnapshot(
        _ document: LegalDocument,
        tocOpen: Bool,
        showBackToTop: Bool,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let renderer = ImageRenderer(
            content: LegalScaffold(
                model: LegalDocs.model(for: document),
                title: document.title,
                accessibilityID: "legalContent.\(document.rawValue)",
                tocOpen: tocOpen,
                showBackToTop: showBackToTop,
                onBack: {},
                onToggleTOC: {}
            )
            .frame(width: 390, height: 844)
        )
        renderer.scale = 2
        let pngData = renderer.uiImage?.pngData()
        XCTAssertNotNil(pngData, file: file, line: line)
        XCTAssertGreaterThan(pngData?.count ?? 0, 8 * 1024, file: file, line: line)
    }
}
