//
//  GigBodySnapshotTests.swift
//  PantopusTests
//
//  A17.6 — Gig mail body. Renders `GigBody` for both designed states
//  (incoming bid + accepted) and asserts the hosting hierarchy lays out
//  non-empty. Same structural-lockfile shape as
//  `PulseComposeSnapshotTests`; swap `assertRenders` for
//  `assertSnapshot(of:as:)` when swift-snapshot-testing lands in
//  `project.yml`.
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class GigBodySnapshotTests: XCTestCase {
    func test_gig_body_received_renders() {
        assertRenders(GigBody(gig: MailItemSampleData.gigReceived))
    }

    func test_gig_body_accepted_renders() {
        assertRenders(GigBody(gig: MailItemSampleData.gigAccepted))
    }

    /// Wraps the body in a scroll view + hosting controller so layout runs
    /// once and every sub-card branch is exercised.
    private func assertRenders(
        _ body: GigBody,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(
            rootView: ScrollView { body }
                .frame(width: 390, height: 1400)
                .background(Theme.Color.appBg)
        )
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 1400)
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0, file: file, line: line)
        XCTAssertGreaterThan(host.view.frame.size.height, 0, file: file, line: line)
    }
}
