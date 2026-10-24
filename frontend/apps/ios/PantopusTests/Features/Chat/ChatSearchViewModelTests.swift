//
//  ChatSearchViewModelTests.swift
//  PantopusTests
//
//  P4.3 — Covers the Chat Search view-model + text helpers: the debounced
//  server search (inbox name search + message search, no conversation
//  history downloaded), name vs. body results, snippet windowing, the
//  scroll-to-match message id, and the highlight attribution.
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

    /// u1 = DM "Marcus R." (verified), as the inbox name search returns it.
    private static let marcusConversationJSON = """
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
    }
    """

    /// `GET /api/chat/unified-conversations?q=`: the conversations whose names match.
    private static func namesJSON(_ rows: String...) -> String {
        "{\"conversations\":[\(rows.joined(separator: ","))],\"total\":\(rows.count),\"totalUnread\":0,\"hasMore\":false}"
    }

    /// `GET /api/chat/search?q=chairs`: the matching message in g1 = group room
    /// "Rose Court Block", with that room's navigation context.
    private static let chairsSearchJSON = """
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
      "roomContexts": {
        "g1": { "conversationId": "g1", "kind": "room", "name": "Rose Court Block", "identity": null }
      },
      "hasMore": false,
      "nextCursor": null
    }
    """

    /// `GET /api/chat/search` with no matching message.
    private static let noMessagesJSON = """
    {"messages":[],"roomContexts":{},"hasMore":false,"nextCursor":null}
    """

    /// The server answers the query: names from the inbox search, bodies from the message search.
    private func stubSearch(names: String, messages: String, namesStatus: Int = 200) {
        URLProtocolStub.stub(path: "/api/chat/unified-conversations", response: .json(names, status: namesStatus))
        URLProtocolStub.stub(path: "/api/chat/search", response: .json(messages))
    }

    /// Waits out the 250 ms debounce and the stubbed answer (polls up to 3 s, no fixed sleep).
    private func waitForSearch(_ vm: ChatSearchViewModel) async {
        for _ in 0..<300 {
            if !vm.isLoading { return }
            try? await Task.sleep(nanoseconds: 10_000_000)
        }
        XCTFail("The search never finished")
    }

    private func requests(to path: String) -> [URLRequest] {
        URLProtocolStub.capturedRequests.filter { $0.url?.path == path }
    }

    /// The name searches and message searches a query made. An inbox read
    /// without `q` (another test's late refresh) is not a search.
    private func searchRequests() -> [URLRequest] {
        nameSearches() + requests(to: "/api/chat/search")
    }

    private func nameSearches() -> [URLRequest] {
        requests(to: "/api/chat/unified-conversations").filter { query("q", of: $0) != nil }
    }

    /// The histories the old index build downloaded for these conversations.
    private func historyRequests() -> [URLRequest] {
        requests(to: "/api/chat/conversations/u1/messages") + requests(to: "/api/chat/rooms/g1/messages")
    }

    private func query(_ name: String, of request: URLRequest?) -> String? {
        request?.url.flatMap { URLComponents(url: $0, resolvingAgainstBaseURL: false) }?
            .queryItems?.first { $0.name == name }?.value
    }

    /// The text went to the server once, as typed: one inbox name search and one
    /// message search, and no conversation's history was downloaded to search it.
    private func assertServerSearch(for text: String, file: StaticString = #filePath, line: UInt = #line) {
        let names = nameSearches()
        let bodies = requests(to: "/api/chat/search")
        XCTAssertEqual(names.count, 1, "One inbox name search", file: file, line: line)
        XCTAssertEqual(bodies.count, 1, "One message search", file: file, line: line)
        XCTAssertEqual(query("q", of: names.first), text, file: file, line: line)
        XCTAssertEqual(query("q", of: bodies.first), text, file: file, line: line)
        XCTAssertTrue(historyRequests().isEmpty, "No conversation history is downloaded to search it", file: file, line: line)
    }

    // MARK: - Lifecycle

    func testLoadStartsLoadingThenClears() async {
        stubSearch(names: Self.namesJSON(Self.marcusConversationJSON), messages: Self.noMessagesJSON)
        let vm = ChatSearchViewModel(api: makeAPI())
        XCTAssertFalse(vm.isLoading, "No index is built up front: nothing is in flight before a query")
        await vm.load()
        XCTAssertFalse(vm.isLoading, "load() without a query starts no search")
        XCTAssertTrue(vm.results.isEmpty, "No query yet → no results")
        XCTAssertTrue(searchRequests().isEmpty && historyRequests().isEmpty, "Nothing is downloaded before a query")
        vm.setQuery("marcus")
        XCTAssertTrue(vm.isLoading, "A query shows loading from the keystroke, through the debounce")
        await waitForSearch(vm)
        XCTAssertFalse(vm.isLoading, "The server answered")
        XCTAssertEqual(vm.results.map(\.conversationId), ["u1"])
    }

    func testBlankQueryYieldsNoResults() async {
        stubSearch(names: Self.namesJSON(), messages: Self.noMessagesJSON)
        let vm = ChatSearchViewModel(api: makeAPI())
        await vm.load()
        vm.setQuery("   ")
        XCTAssertTrue(vm.results.isEmpty)
    }

    // MARK: - Matching

    func testNameMatchHasNoScrollTargetAndPreviewSnippet() async {
        stubSearch(names: Self.namesJSON(Self.marcusConversationJSON), messages: Self.noMessagesJSON)
        let vm = ChatSearchViewModel(api: makeAPI())
        await vm.load()
        vm.setQuery("marcus")
        XCTAssertTrue(searchRequests().isEmpty, "The query is sent after the debounce, not per keystroke")
        await waitForSearch(vm)
        assertServerSearch(for: "marcus")
        XCTAssertEqual(vm.results.count, 1)
        let result = try? XCTUnwrap(vm.results.first)
        XCTAssertEqual(result?.conversationId, "u1")
        XCTAssertEqual(result?.kind, .dm)
        XCTAssertNil(result?.matchedMessageId, "Name-only match opens at the latest message")
        XCTAssertEqual(result?.snippet, "Can you start at 9?", "Snippet falls back to the last preview")
    }

    func testBodyMatchCarriesMatchedMessageIdAndSnippet() async {
        stubSearch(names: Self.namesJSON(), messages: Self.chairsSearchJSON)
        let vm = ChatSearchViewModel(api: makeAPI())
        await vm.load()
        vm.setQuery("chairs")
        await waitForSearch(vm)
        assertServerSearch(for: "chairs")
        XCTAssertEqual(vm.results.count, 1)
        let result = try? XCTUnwrap(vm.results.first)
        XCTAssertEqual(result?.conversationId, "g1")
        XCTAssertEqual(result?.kind, .group)
        XCTAssertEqual(result?.displayName, "Rose Court Block", "The row names the conversation the message is in")
        XCTAssertEqual(result?.matchedMessageId, "m_g1", "Body match scrolls to the message")
        XCTAssertTrue(result?.snippet.localizedCaseInsensitiveContains("chairs") ?? false)
    }

    func testCaseInsensitiveMatch() async {
        stubSearch(names: Self.namesJSON(Self.marcusConversationJSON), messages: Self.noMessagesJSON)
        let vm = ChatSearchViewModel(api: makeAPI())
        await vm.load()
        vm.setQuery("MARCUS")
        await waitForSearch(vm)
        assertServerSearch(for: "MARCUS")
        XCTAssertEqual(vm.results.first?.conversationId, "u1")
        XCTAssertTrue(
            ChatSearchText.matches(vm.results.first?.displayName ?? "", query: vm.results.first?.query ?? ""),
            "The row highlights \"Marcus\" for \"MARCUS\""
        )
    }

    func testNoMatchYieldsEmptyResults() async {
        stubSearch(names: Self.namesJSON(), messages: Self.noMessagesJSON)
        let vm = ChatSearchViewModel(api: makeAPI())
        await vm.load()
        vm.setQuery("zzzzz")
        XCTAssertTrue(vm.results.isEmpty)
    }

    func testClearingQueryResetsResults() async {
        stubSearch(names: Self.namesJSON(Self.marcusConversationJSON), messages: Self.noMessagesJSON)
        let vm = ChatSearchViewModel(api: makeAPI())
        await vm.load()
        vm.setQuery("marcus")
        await waitForSearch(vm)
        XCTAssertFalse(vm.results.isEmpty)
        vm.setQuery("")
        XCTAssertTrue(vm.results.isEmpty)
        XCTAssertFalse(vm.isLoading, "A cleared query has nothing in flight")
        // Cleared within the debounce, a query is never sent.
        let sent = searchRequests().count
        vm.setQuery("marc")
        vm.setQuery("")
        try? await Task.sleep(nanoseconds: 400_000_000)
        XCTAssertEqual(searchRequests().count, sent, "Clearing cancels the pending search")
        XCTAssertTrue(vm.results.isEmpty)
    }

    func testConversationListFailureDegradesToNoResults() async {
        stubSearch(names: "{}", messages: Self.noMessagesJSON, namesStatus: 500)
        let vm = ChatSearchViewModel(api: makeAPI())
        await vm.load()
        vm.setQuery("marcus")
        await waitForSearch(vm)
        XCTAssertFalse(vm.isLoading)
        XCTAssertTrue(vm.results.isEmpty)
        XCTAssertTrue(vm.searchFailed, "A failed search says so instead of claiming no matches")
        XCTAssertEqual(vm.emptyState.headline, "Search unavailable")
        XCTAssertEqual(vm.failureMessage, "Couldn't search messages. Try again.")
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
