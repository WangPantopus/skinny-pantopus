//
//  MyPostsViewModelTests.swift
//  PantopusTests
//
//  T5.3.3 — My posts. Covers:
//    - load → loaded / empty / error transitions
//    - tab assignment per archived_at value (null → Active, set → Archived)
//    - intent mapping from post_type (ask_local → ask, recommendation →
//      recommend, event → event, lost_found → lost, local_update →
//      announce, unknown → announce)
//    - engagement strip mapping per intent (event uses "going",
//      recommend uses "helpful", lost uses "seen", ask/announce use
//      "likes")
//    - row projection: intent chip in headerChips, time meta combines
//      relative time + locality, body uses primary emphasis, archived
//      highlight + ARCHIVED chip on archived rows
//    - archive(_:) flips the row to Archived and calls the backend
//    - unarchive(_:) flips the row back to Active and calls the backend
//    - confirmDelete() removes the row optimistically + rolls back on
//      API failure
//

import XCTest
@testable import Pantopus

// swiftlint:disable type_body_length

@MainActor
final class MyPostsViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    /// 2026-05-15 12:00:00 UTC — fixed for deterministic relative-time
    /// formatting.
    private static let fixedNow: Date = {
        var components = DateComponents()
        components.year = 2026
        components.month = 5
        components.day = 15
        components.hour = 12
        components.minute = 0
        components.second = 0
        components.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
        return Calendar(identifier: .gregorian).date(from: components)
            ?? Date(timeIntervalSince1970: 1_778_846_400)
    }()

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    private func makeVM(api: APIClient? = nil, userId: String? = "u_me") -> MyPostsViewModel {
        MyPostsViewModel(
            api: api ?? makeAPI(),
            currentUserId: { userId },
            now: { Self.fixedNow }
        )
    }

    // MARK: - Lifecycle

    func testLoadEmptyTransitionsToEmpty() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"posts\":[]}")]
        let vm = makeVM()
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected .empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "You haven\u{2019}t posted yet")
        XCTAssertEqual(content.ctaTitle, "Write a post")
    }

    func testLoadPopulatedTransitionsToLoadedOnActiveTab() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"posts":[
              {"id":"p1","user_id":"u_me","content":"Looking for a chimney sweep",
               "post_type":"ask_local","created_at":"2026-05-15T10:00:00Z",
               "comment_count":8,"like_count":3,"location_name":"Elm Park"}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections.first?.rows.count, 1)
        XCTAssertEqual(sections.first?.rows.first?.id, "p1")
        XCTAssertEqual(vm.tabs[0].id, MyPostsTab.active)
        XCTAssertEqual(vm.tabs[0].count, 1)
        XCTAssertEqual(vm.tabs[1].count, 0)
    }

    func testLoadFailureTransitionsToErrorWhenCold() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"Server\"}")]
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
    }

    func testNoSignedInUserSkipsFetchAndRendersEmpty() async {
        let vm = makeVM(userId: nil)
        await vm.load()
        guard case .empty = vm.state else {
            XCTFail("Expected .empty, got \(vm.state)")
            return
        }
        // No request was made — sequence is untouched.
        XCTAssertTrue(SequencedURLProtocol.sequence.isEmpty)
    }

    // MARK: - Tab assignment

    func testWirePostWithArchivedAtLandsInArchivedTab() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"posts":[
              {"id":"a1","user_id":"u_me","content":"Active","post_type":"ask_local","created_at":"2026-05-13T10:00:00Z"},
              {"id":"x1","user_id":"u_me","content":"Old","post_type":"announce","created_at":"2026-05-10T10:00:00Z",
               "archived_at":"2026-05-12T11:00:00Z"}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        XCTAssertEqual(vm.tabs[0].count, 1)
        XCTAssertEqual(vm.tabs[1].count, 1)

        vm.selectedTab = MyPostsTab.archived
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded on archived tab")
            return
        }
        XCTAssertEqual(sections.first?.rows.first?.id, "x1")
        XCTAssertEqual(sections.first?.rows.first?.highlight, .archived)
    }

    // MARK: - Intent + engagement projection

    func testIntentMapsFromPostType() {
        XCTAssertEqual(PulseIntent.from(postType: "ask_local"), .ask)
        XCTAssertEqual(PulseIntent.from(postType: "recommendation"), .recommend)
        XCTAssertEqual(PulseIntent.from(postType: "event"), .event)
        XCTAssertEqual(PulseIntent.from(postType: "lost_found"), .lost)
        XCTAssertEqual(PulseIntent.from(postType: "local_update"), .announce)
        XCTAssertEqual(PulseIntent.from(postType: "ask"), .ask)
        XCTAssertEqual(PulseIntent.from(postType: nil), .announce)
        XCTAssertEqual(PulseIntent.from(postType: "garbage"), .announce)
    }

    func testEngagementItemsAdaptToIntent() {
        let dto = MyPostDTO(
            id: "p",
            userId: "u",
            content: "x",
            postType: "event",
            createdAt: "2026-05-15T10:00:00Z",
            likeCount: 12,
            commentCount: 5
        )
        let events = MyPostsViewModel.engagementItems(for: dto, intent: .event)
        XCTAssertEqual(events.first?.label, "12 going")
        XCTAssertEqual(events.last?.label, "5 replies")

        let recommend = MyPostsViewModel.engagementItems(
            for: dto,
            intent: .recommend
        )
        XCTAssertEqual(recommend.first?.label, "12 helpful")

        let lost = MyPostsViewModel.engagementItems(for: dto, intent: .lost)
        XCTAssertEqual(lost.first?.label, "5 replies")
        XCTAssertEqual(lost.last?.label, "12 seen")

        let ask = MyPostsViewModel.engagementItems(for: dto, intent: .ask)
        XCTAssertEqual(ask.first?.label, "5 replies")
        XCTAssertEqual(ask.last?.label, "12 likes")

        let singleReply = MyPostsViewModel.engagementItems(
            for: MyPostDTO(
                id: "p",
                userId: "u",
                content: "x",
                postType: "ask_local",
                createdAt: "2026-05-15T10:00:00Z",
                likeCount: 1,
                commentCount: 1
            ),
            intent: .ask
        )
        XCTAssertEqual(singleReply.first?.label, "1 reply")
        XCTAssertEqual(singleReply.last?.label, "1 like")
    }

    func testTimeMetaCombinesRelativeTimeAndLocality() {
        let dto = MyPostDTO(
            id: "p",
            userId: "u",
            content: "x",
            postType: "ask_local",
            createdAt: "2026-05-15T10:00:00Z",
            locationName: "Elm Park"
        )
        XCTAssertEqual(MyPostsViewModel.timeMetaLabel(for: dto, now: Self.fixedNow), "2h · Elm Park")
    }

    func testRowProjectionUsesPrimaryBodyEmphasisAndHeaderChips() {
        let dto = MyPostDTO(
            id: "p",
            userId: "u",
            content: "Anyone know a good chimney sweep?",
            postType: "ask_local",
            createdAt: "2026-05-15T10:00:00Z",
            likeCount: 3,
            commentCount: 8,
            locationName: "Elm Park"
        )
        let projection = MyPostsViewModel.PostProjection(dto: dto, tab: MyPostsTab.active, isArchived: false)
        let row = MyPostsViewModel.row(
            projection: projection,
            now: Self.fixedNow,
            callbacks: MyPostsViewModel.RowCallbacks()
        )
        XCTAssertEqual(row.title, "")
        XCTAssertEqual(row.body, "Anyone know a good chimney sweep?")
        XCTAssertEqual(row.bodyEmphasis, .primary)
        XCTAssertEqual(row.headerChips?.count, 1)
        XCTAssertEqual(row.headerChips?.first?.text, "Ask")
        XCTAssertEqual(row.timeMeta, "2h · Elm Park")
        XCTAssertNotNil(row.engagement)
        XCTAssertEqual(row.engagement?.cta?.label, "Edit")
        XCTAssertNil(row.highlight)
    }

    func testArchivedRowUsesArchivedHighlightAndRestoreCTA() {
        let dto = MyPostDTO(
            id: "p",
            userId: "u",
            content: "Old post",
            postType: "ask_local",
            createdAt: "2026-05-10T10:00:00Z",
            archivedAt: "2026-05-11T10:00:00Z"
        )
        let projection = MyPostsViewModel.PostProjection(dto: dto, tab: MyPostsTab.archived, isArchived: true)
        let row = MyPostsViewModel.row(
            projection: projection,
            now: Self.fixedNow,
            callbacks: MyPostsViewModel.RowCallbacks()
        )
        XCTAssertEqual(row.highlight, .archived)
        XCTAssertEqual(row.headerChips?.count, 2)
        XCTAssertEqual(row.headerChips?.last?.text, "ARCHIVED")
        XCTAssertEqual(row.engagement?.cta?.label, "Restore")
    }

    // MARK: - Optimistic mutations

    func testArchiveOptimisticallyFlipsRowToArchivedTab() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"posts":[
              {"id":"p1","user_id":"u_me","content":"Active","post_type":"ask_local","created_at":"2026-05-15T10:00:00Z"}
            ]}
            """),
            .status(200, body: #"{"archived":true,"archived_at":"2026-05-15T12:00:00Z"}"#)
        ]
        let vm = makeVM()
        await vm.load()
        XCTAssertEqual(vm.tabs[0].count, 1)
        XCTAssertEqual(vm.tabs[1].count, 0)

        let dto = MyPostDTO(
            id: "p1",
            userId: "u_me",
            content: "Active",
            postType: "ask_local",
            createdAt: "2026-05-15T10:00:00Z"
        )
        await vm.archive(dto)
        XCTAssertEqual(vm.tabs[0].count, 0)
        XCTAssertEqual(vm.tabs[1].count, 1)
        XCTAssertTrue(vm.isArchived(dto))
    }

    func testUnarchiveFlipsRowBackToActive() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"posts":[
              {"id":"p1","user_id":"u_me","content":"Active","post_type":"ask_local","created_at":"2026-05-15T10:00:00Z"}
            ]}
            """),
            .status(200, body: #"{"archived":true,"archived_at":"2026-05-15T12:00:00Z"}"#),
            .status(200, body: #"{"archived":false,"archived_at":null}"#)
        ]
        let vm = makeVM()
        await vm.load()

        let dto = MyPostDTO(
            id: "p1",
            userId: "u_me",
            content: "Active",
            postType: "ask_local",
            createdAt: "2026-05-15T10:00:00Z"
        )
        await vm.archive(dto)
        XCTAssertEqual(vm.tabs[1].count, 1)

        await vm.unarchive(dto)
        XCTAssertEqual(vm.tabs[0].count, 1)
        XCTAssertEqual(vm.tabs[1].count, 0)
    }

    func testConfirmDeleteRemovesRowOnSuccess() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"posts":[
              {"id":"p1","user_id":"u_me","content":"X","post_type":"ask_local","created_at":"2026-05-15T10:00:00Z"}
            ]}
            """),
            .status(204, body: "")
        ]
        let vm = makeVM()
        await vm.load()
        let dto = MyPostDTO(
            id: "p1",
            userId: "u_me",
            content: "X",
            postType: "ask_local",
            createdAt: "2026-05-15T10:00:00Z"
        )
        vm.requestDelete(dto)
        await vm.confirmDelete()
        XCTAssertEqual(vm.tabs[0].count, 0)
        guard case .empty = vm.state else {
            XCTFail("Expected .empty after delete")
            return
        }
    }

    func testConfirmDeleteRollsBackOnFailure() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"posts":[
              {"id":"p1","user_id":"u_me","content":"X","post_type":"ask_local","created_at":"2026-05-15T10:00:00Z"}
            ]}
            """),
            .status(500, body: "{\"error\":\"boom\"}")
        ]
        let vm = makeVM()
        await vm.load()
        let dto = MyPostDTO(
            id: "p1",
            userId: "u_me",
            content: "X",
            postType: "ask_local",
            createdAt: "2026-05-15T10:00:00Z"
        )
        vm.requestDelete(dto)
        await vm.confirmDelete()
        // Row restored after rollback
        XCTAssertEqual(vm.tabs[0].count, 1)
    }
}
