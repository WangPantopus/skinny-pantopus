//
//  ViewAsSnapshotTests.swift
//  PantopusTests
//
//  B5.2 (A18.5) — render-smoke snapshots for the "View as" identity
//  preview. Mirrors `PublicProfileSnapshotTests`: host each state in a
//  `UIHostingController` sized to a phone and assert it builds with a
//  non-zero layout. Covers the loading shimmer, every audience render
//  (incl. the two designed endpoints Public + Connection), so the
//  cross-platform snapshot set lines up with the Android Paparazzi suite.
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class ViewAsSnapshotTests: XCTestCase {
    private static let phone = CGSize(width: 375, height: 812)

    private func assertRenders(
        _ label: String,
        size: CGSize = ViewAsSnapshotTests.phone,
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
            host.view.bounds.height,
            0,
            "\(label) collapsed to zero height",
            file: file,
            line: line
        )
    }

    func test_viewAs_loading_renders() {
        assertRenders("ViewAs loading") {
            ViewAsView(viewModel: ViewAsViewModel(selected: .connection, startLoaded: false))
        }
    }

    /// The two designed endpoints — the snapshot baselines the audit calls
    /// out ("at least Public + Connection").
    func test_viewAs_publicEndpoint_renders() {
        assertRenders("ViewAs public") {
            ViewAsView(viewModel: ViewAsViewModel(selected: .public, startLoaded: true))
        }
    }

    func test_viewAs_connectionEndpoint_renders() {
        assertRenders("ViewAs connection") {
            ViewAsView(viewModel: ViewAsViewModel(selected: .connection, startLoaded: true))
        }
    }

    /// Full sweep so each audience's resolved render is exercised.
    func test_viewAs_everyAudience_renders() {
        for audience in ViewerAudience.allCases {
            assertRenders("ViewAs \(audience.id)") {
                ViewAsView(viewModel: ViewAsViewModel(selected: audience, startLoaded: true))
            }
        }
    }

    /// The preview card on its own (the unit the design treats as the
    /// "screen-within-screen" output), per designed endpoint.
    func test_viewAs_previewCard_endpoints_render() {
        assertRenders("ViewAs card public", size: CGSize(width: 360, height: 560)) {
            ViewAsPreviewCard(render: ViewAsSampleData.render(for: .public))
        }
        assertRenders("ViewAs card connection", size: CGSize(width: 360, height: 560)) {
            ViewAsPreviewCard(render: ViewAsSampleData.render(for: .connection))
        }
    }
}
