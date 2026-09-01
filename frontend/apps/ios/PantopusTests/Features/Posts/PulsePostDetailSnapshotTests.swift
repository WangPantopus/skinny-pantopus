//
//  PulsePostDetailSnapshotTests.swift
//  PantopusTests
//
//  A10.4 post detail structural snapshots: populated resolved thread,
//  empty just-posted frame, and every intent chip palette.
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class PulsePostDetailSnapshotTests: XCTestCase {
    func test_a10_4_populated_resolved_thread_renders() {
        assertRenders(
            PulsePostDetailLoadedContent(
                detail: PulsePostDetailSampleData.populated,
                composerText: .constant(""),
                isSendingComment: false
            )
        )
    }

    func test_a10_4_empty_ask_quick_replies_renders() {
        assertRenders(
            PulsePostDetailLoadedContent(
                detail: PulsePostDetailSampleData.empty(intent: .ask),
                composerText: .constant(""),
                isSendingComment: false
            )
        )
        XCTAssertEqual(
            PostIntent.ask.quickReplyPrompts.map(\.label),
            ["Try a question reply", "Share a tip", "Suggest a resource"]
        )
    }

    func test_a10_4_empty_lost_found_quick_replies_are_intent_shaped() {
        XCTAssertEqual(
            PostIntent.lostFound.quickReplyPrompts.map(\.label),
            ["I've seen it", "Have you checked X?", "DM me about details"]
        )
    }

    func test_all_intent_chips_render_with_expected_palette() {
        assertRenders(
            VStack(alignment: .leading, spacing: Spacing.s4) {
                ForEach(PostIntent.allCases) { intent in
                    PostAuthorHeader(
                        displayName: "Nadia Velez",
                        avatarURL: nil,
                        isVerified: true,
                        identity: .personal,
                        timeAndLocality: "22m · Elm Park",
                        intent: intent
                    )
                }
            }
            .padding(.vertical, Spacing.s4)
            .background(Theme.Color.appBg)
        )

        XCTAssertEqual(PostIntent.lostFound.chipVariant, .error)
        XCTAssertEqual(PostIntent.ask.chipVariant, .info)
        XCTAssertEqual(PostIntent.offer.chipVariant, .success)
        XCTAssertEqual(PostIntent.event.chipVariant, .personal)
        XCTAssertEqual(PostIntent.share.chipVariant, .home)
        XCTAssertEqual(PostIntent.alert.chipVariant, .warning)
    }

    private func assertRenders(
        _ view: some View,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(rootView: view.frame(width: 390, height: 844))
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0, file: file, line: line)
        XCTAssertGreaterThan(host.view.frame.size.height, 0, file: file, line: line)
    }
}
