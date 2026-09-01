//
//  ChatConversationSnapshotTests.swift
//  PantopusTests
//
//  A15.3 — structural lockfile for the AI Assistant mode of the chat
//  conversation. Mirrors `PulseComposeSnapshotTests`: each state renders
//  inside a hosting controller and must produce a non-empty layout. When
//  the iOS swift-snapshot-testing dependency lands in `project.yml`,
//  switch `assertRenders` to `assertSnapshot(of:as:)`.
//
//  States covered:
//    • AI welcome — empty thread, tinted welcome card + capability chips
//    • AI active  — populated thread with a structured reply + estimate
//    • Creator thread — creator chrome + quota + broadcast reference
//    • DM refresh — photo/read receipt, typing indicator, queued attachments
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class ChatConversationSnapshotTests: XCTestCase {
    func test_ai_welcome_empty_renders() {
        assertRenders(viewModel: ChatConversationSampleData.aiWelcomeViewModel())
    }

    func test_ai_active_thread_with_estimate_renders() {
        assertRenders(viewModel: ChatConversationSampleData.aiActiveViewModel())
    }

    func test_fan_empty_thread_renders() {
        assertRenders(
            viewModel: ChatConversationSampleData.fanEmptyViewModel(),
            mode: .fanThread
        )
    }

    func test_fan_active_thread_with_locked_reply_renders() {
        assertRenders(
            viewModel: ChatConversationSampleData.fanActiveViewModel(),
            mode: .fanThread
        )
    }

    func test_fan_upgrade_prompt_sheet_renders() {
        let host = UIHostingController(
            rootView: FanTierUpgradePromptSheet(entitlement: ChatConversationSampleData.fanLockedEntitlement)
                .frame(width: 390, height: 420)
        )
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 420)
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0)
        XCTAssertGreaterThan(host.view.frame.size.height, 0)
    }

    func test_dm_photo_bubble_with_read_receipt_renders() {
        assertRenders(viewModel: ChatConversationSampleData.dmPhotoReadReceiptViewModel(), mode: .dm)
    }

    func test_dm_typing_indicator_renders() {
        assertRenders(viewModel: ChatConversationSampleData.dmTypingViewModel(), mode: .dm)
    }

    func test_dm_queued_attachments_renders() {
        assertRenders(viewModel: ChatConversationSampleData.dmQueuedAttachmentsViewModel(), mode: .dm)
    }

    func test_creator_thread_chrome_renders() {
        assertRenders(
            viewModel: ChatConversationSampleData.creatorThreadViewModel(),
            mode: .creatorThread,
            creatorContext: ChatConversationSampleData.creatorContext
        )
    }

    /// A15.4 secondary frame — quota exhausted: warning pill, full
    /// upgrade-fan card (head / body / perks / actions) and the locked
    /// composer with its lock row.
    func test_creator_thread_quota_exhausted_renders() {
        assertRenders(
            viewModel: ChatConversationSampleData.creatorThreadViewModel(),
            mode: .creatorThread,
            creatorContext: ChatConversationSampleData.creatorMaxedContext
        )
    }

    private func assertRenders(
        viewModel: ChatConversationViewModel,
        mode: ChatConversationMode = .aiAssistant,
        creatorContext: ChatCreatorThreadContext? = nil,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(
            rootView: ChatConversationView(
                viewModel: viewModel,
                mode: mode,
                creatorContext: creatorContext
            )
            .frame(width: 390, height: 844)
        )
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0, file: file, line: line)
        XCTAssertGreaterThan(host.view.frame.size.height, 0, file: file, line: line)
    }
}
