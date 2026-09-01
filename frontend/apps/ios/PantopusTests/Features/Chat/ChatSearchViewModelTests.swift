//
//  ChatSearchViewModelTests.swift
//  PantopusTests
//
//  P4.3 — Covers the Chat Search view-model + text helpers: index build
//  (conversation list + per-conversation message pages), name vs. body
//  matching, snippet windowing, the scroll-to-match message id, and the
//  highlight attribution.
//

import XCTest
@testable import Pantopus

@MainActor
final class ChatSearchViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        URLProtocolStub.reset()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: TestSession.make(),
            retryPolicy: .none
        )
    }

    /// u1 = DM "Marcus R." (verified). g1 = group room "Rose Court Block".
    private static let listJSON = """
    {
      "conversations": [
        {
          "_type": "conversation",
          "other_participant_id": "u1",
          "other_participant_name": "Marcus R.",
          "other_participant_avatar": null,
          "other_participant_identity": { "identity_kind": "personal", "verified": true },
          "total_unread": 1,
          "last_message_at": "2026-04-20T10:00:00Z",
          "last_message_preview": "Can you start at 9?",
          "topics": []
        },
        {
          "_type": "room",
          "id": "g1",
          "room_type": "group",
          "room_name": "Rose Court Block",
          "total_unread": 0,
          "last_message_at": "2026-04-19T12:00:00Z",
          "last_message_preview": "See you Sunday",
          "topics": []
        }
      ],
      "total": 2,
      "totalUnread": 1
    }
    """

    private static let u1MessagesJSON = """
    {
      "messages": [
        {
          "id": "m_u1",
          "room_id": "r1",
          "user_id": "u1",
          "message_text": "Sounds good, see you then.",
          "message_type": "text",
          "created_at": "2026-04-20T10:00:00Z"
        }
      ],
      "hasMore": false
    }
    """

    private static let g1MessagesJSON = """
    {
      "messages": [
        {
          "id": "m_g1",
          "room_id": "g1",
          "user_id": "u9",
          "message_text": "I'll grab the folding chairs. Anyone bringing ice?",
          "message_type": "text",
          "created_at": "2026-04-19T12:00:00Z"
        }
      ],
      "hasMore": false
    }
    """

    private func stubIndex() {
        URLProtocolStub.stub(path: "unified-conversations", response: .json(Self.listJSON))
        URLProtocolStub.stub(path: "conversations/u1/messages", response: .json(Self.u1MessagesJSON))
        URLProtocolStub.stub(path: "rooms/g1/messages", response: .json(Self.g1MessagesJSON))
    }

    // MARK: - Lifecycle

    func testLoadStartsLoadingThenClears() async {
        stubIndex()
        let vm = ChatSearchViewModel(api: makeAPI())
        XCTAssertTrue(vm.isLoading, "Index build is in flight before load()")
        await vm.load()
        XCTAssertFalse(vm.isLoading, "Index build finished")
        XCTAssertTrue(vm.results.isEmpty, "No query yet → no results")
    }

    func testBlankQueryYieldsNoResults() async {
        stubIndex()
        let vm = ChatSearchViewModel(api: makeAPI())
        await vm.load()
        vm.setQuery("   ")
        XCTAssertTrue(vm.results.isEmpty)
    }

    // MARK: - Matching

    func testNameMatchHasNoScrollTargetAndPreviewSnippet() async {
        stubIndex()
        let vm = ChatSearchViewModel(api: makeAPI())
        await vm.load()
        vm.setQuery("marcus")
        XCTAssertEqual(vm.results.count, 1)
        let result = try? XCTUnwrap(vm.results.first)
        XCTAssertEqual(result?.conversationId, "u1")
        XCTAssertEqual(result?.kind, .dm)
        XCTAssertNil(result?.matchedMessageId, "Name-only match opens at the latest message")
        XCTAssertEqual(result?.snippet, "Can you start at 9?", "Snippet falls back to the last preview")
    }

    func testBodyMatchCarriesMatchedMessageIdAndSnippet() async {
        stubIndex()
        let vm = ChatSearchViewModel(api: makeAPI())
        await vm.load()
        vm.setQuery("chairs")
        XCTAssertEqual(vm.results.count, 1)
        let result = try? XCTUnwrap(vm.results.first)
        XCTAssertEqual(result?.conversationId, "g1")
        XCTAssertEqual(result?.kind, .group)
        XCTAssertEqual(result?.matchedMessageId, "m_g1", "Body match scrolls to the message")
        XCTAssertTrue(result?.snippet.localizedCaseInsensitiveContains("chairs") ?? false)
    }

    func testCaseInsensitiveMatch() async {
        stubIndex()
        let vm = ChatSearchViewModel(api: makeAPI())
        await vm.load()
        vm.setQuery("MARCUS")
        XCTAssertEqual(vm.results.first?.conversationId, "u1")
    }

    func testNoMatchYieldsEmptyResults() async {
        stubIndex()
        let vm = ChatSearchViewModel(api: makeAPI())
        await vm.load()
        vm.setQuery("zzzzz")
        XCTAssertTrue(vm.results.isEmpty)
    }

    func testClearingQueryResetsResults() async {
        stubIndex()
        let vm = ChatSearchViewModel(api: makeAPI())
        await vm.load()
        vm.setQuery("marcus")
        XCTAssertFalse(vm.results.isEmpty)
        vm.setQuery("")
        XCTAssertTrue(vm.results.isEmpty)
    }

    func testConversationListFailureDegradesToNoResults() async {
        URLProtocolStub.stub(path: "unified-conversations", response: .json("{}", status: 500))
        let vm = ChatSearchViewModel(api: makeAPI())
        await vm.load()
        vm.setQuery("marcus")
        XCTAssertFalse(vm.isLoading)
        XCTAssertTrue(vm.results.isEmpty)
    }

    // MARK: - Text helpers

    func testSnippetWindowsLongBodyAroundMatch() {
        let body = String(repeating: "lorem ipsum dolor ", count: 10) + "the chairs are here " + String(repeating: "tail ", count: 10)
        let snippet = ChatSearchText.snippet(from: body, matching: "chairs", maxLength: 60)
        XCTAssertTrue(snippet.contains("chairs"))
        XCTAssertTrue(snippet.hasPrefix("…"), "A mid-body match leads with an ellipsis")
        XCTAssertLessThanOrEqual(snippet.count, 62)
    }

    func testSnippetReturnsShortBodyWhole() {
        XCTAssertEqual(ChatSearchText.snippet(from: "short message", matching: "short"), "short message")
    }

    func testHighlightedEmphasizesMatchedRun() {
        let attributed = ChatSearchText.highlighted("Meet Maria today", query: "maria")
        XCTAssertEqual(String(attributed.characters), "Meet Maria today", "No characters lost")
        let hasEmphasis = attributed.runs.contains { $0.inlinePresentationIntent == .stronglyEmphasized }
        XCTAssertTrue(hasEmphasis, "The matched term is emphasized")
    }

    func testHighlightedWithBlankQueryIsPlain() {
        let attributed = ChatSearchText.highlighted("Plain text", query: "")
        let hasEmphasis = attributed.runs.contains { $0.inlinePresentationIntent == .stronglyEmphasized }
        XCTAssertFalse(hasEmphasis)
    }
}
