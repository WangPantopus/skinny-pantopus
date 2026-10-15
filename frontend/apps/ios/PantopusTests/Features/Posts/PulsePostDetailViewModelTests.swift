//
//  PulsePostDetailViewModelTests.swift
//  PantopusTests
//
//  Existing post-detail checks updated for the Pulse conversation contract:
//  load, Helpful success/failure, reply send and read refusal.
//

import XCTest
@testable import Pantopus

@MainActor
final class PulsePostDetailViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
        // The Pulse conversation is the redesign's (launch cut #11): every cut switched on.
        LaunchFeatures.overrideForTesting = Set(LaunchFeature.allCases)
    }

    override func tearDown() {
        LaunchFeatures.overrideForTesting = nil
        super.tearDown()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    private static let postJSON = """
    {
      "post": {
        "id": "p1", "type": "ask_local", "text": "Anyone know a good handyman?",
        "created_at": "2026-04-30T12:00:00.000Z", "media": [],
        "author": { "id": "u1", "display_name": "Alex", "label": "resident" },
        "about": { "label": "Cambridge" },
        "status": { "state": "open", "resolution": null },
        "action": { "kind": "answer", "label": "Answer", "done": false },
        "counts": { "replies": 2 },
        "viewer": { "is_author": true, "can_mark_helpful": true }
      },
      "replies": [
        { "id": "c1", "post_id": "p1", "branch_id": "c1", "parent_comment_id": null,
          "text": "Try Westside Plumbing", "author": { "id": "u2", "display_name": "Maria", "label": "resident" } },
        { "id": "c2", "post_id": "p1", "branch_id": "c1", "parent_comment_id": "c1",
          "text": "+1 Mike's great", "author": { "id": "u3", "display_name": "Sam", "label": "resident" } }
      ]
    }
    """

    // MARK: - Happy-path load

    func testLoadDecodesDetail() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.postJSON)]
        let vm = PulsePostDetailViewModel(postId: "p1", client: makeAPI())
        await vm.load()
        guard case let .conversation(content) = vm.state else {
            XCTFail("Expected .conversation")
            return
        }
        XCTAssertEqual(content.post.author?.displayName, "Alex")
        XCTAssertEqual(content.post.type, "ask_local")
        XCTAssertEqual(content.replies.count, 2)
        XCTAssertEqual(content.branches.count, 1)
        XCTAssertEqual(content.branches.first?.root?.id, "c1")
        XCTAssertEqual(content.branches.first?.descendants.first?.id, "c2")
        XCTAssertEqual(content.post.about?.label, "Cambridge")
    }

    func testLostFoundPurposeMapsToLostFoundIntent() {
        XCTAssertEqual(PostIntent.from(purpose: "lost_found", postType: nil), .lostFound)
    }

    // MARK: - Reactions

    func testHelpfulMarkReconcilesReplyAndPost() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.postJSON),
            .status(200, body: """
            {"reply":{"id":"c1","branch_id":"c1","helpful":true,"helpful_to":"Alex"},
             "post_status":{"state":"resolved","resolution":"answered"}}
            """)
        ]
        let vm = PulsePostDetailViewModel(postId: "p1", client: makeAPI())
        await vm.load()
        guard let reply = vm.conversation?.replies.first else { return XCTFail("Missing reply") }
        await vm.markConversationReplyHelpful(reply)
        guard case let .conversation(content) = vm.state else {
            XCTFail("Expected .conversation")
            return
        }
        XCTAssertTrue(content.replies[0].helpful)
        XCTAssertEqual(content.replies[0].helpfulTo, "Alex")
        XCTAssertEqual(content.post.status?.resolution, "answered")
    }

    func testHelpfulFailureKeepsReplyUnchanged() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.postJSON),
            .status(500, body: "{\"error\":\"boom\"}")
        ]
        let vm = PulsePostDetailViewModel(postId: "p1", client: makeAPI())
        await vm.load()
        guard let reply = vm.conversation?.replies.first else { return XCTFail("Missing reply") }
        await vm.markConversationReplyHelpful(reply)
        guard case let .conversation(content) = vm.state else {
            XCTFail("Expected .conversation")
            return
        }
        XCTAssertFalse(content.replies[0].helpful)
        XCTAssertNil(content.post.status?.resolution)
        XCTAssertNotNil(vm.toastMessage)
    }

    func testHeartReactionIsDisplayOnly() async {
        // The conversation has no public heart score; an old caller cannot add one.
        SequencedURLProtocol.sequence = [.status(200, body: Self.postJSON)]
        let vm = PulsePostDetailViewModel(postId: "p1", client: makeAPI())
        await vm.load()
        await vm.tapReaction(.heart)
        XCTAssertNil(vm.toastMessage)
    }

    // MARK: - Comments

    func testSendCommentRefetchesAndClearsComposer() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.postJSON),
            .status(
                201,
                body: """
                {"comment":{"id":"c3","post_id":"p1","user_id":"u1","parent_comment_id":null,
                "comment":"hi","created_at":"2026-04-30T12:07:00.000Z","is_deleted":false}}
                """
            ),
            .status(200, body: Self.postJSON)
        ]
        let vm = PulsePostDetailViewModel(postId: "p1", client: makeAPI())
        await vm.load()
        vm.composerText = "hi"
        await vm.sendComment()
        XCTAssertEqual(vm.composerText, "")
        XCTAssertFalse(vm.isSendingComment)
    }

    /// C-18: the feed and My posts refetch on this notification; without it
    /// a deleted post stayed listed and comment counts went stale.
    func testSendCommentTellsTheFeedToRefetch() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.postJSON),
            .status(
                201,
                body: """
                {"comment":{"id":"c3","post_id":"p1","user_id":"u1","parent_comment_id":null,
                "comment":"hi","created_at":"2026-04-30T12:07:00.000Z","is_deleted":false}}
                """
            ),
            .status(200, body: Self.postJSON)
        ]
        let vm = PulsePostDetailViewModel(postId: "p1", client: makeAPI())
        await vm.load()
        let changed = expectation(forNotification: .pulsePostsDidChange, object: nil)
        vm.composerText = "hi"
        await vm.sendComment()
        await fulfillment(of: [changed], timeout: 2)
    }

    func testDeletePostTellsTheFeedToRefetch() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.postJSON),
            .status(200, body: "{\"message\":\"Post deleted\"}")
        ]
        let vm = PulsePostDetailViewModel(postId: "p1", client: makeAPI())
        await vm.load()
        let changed = expectation(forNotification: .pulsePostsDidChange, object: nil)
        await vm.deletePost()
        XCTAssertTrue(vm.didDeletePost)
        await fulfillment(of: [changed], timeout: 2)
    }

    // MARK: - Errors

    func testNotFoundProducesFriendlyError() async {
        // The Pulse conversation route, then the post page it falls back to.
        SequencedURLProtocol.sequence = [
            .status(404, body: "{\"error\":\"missing\"}"),
            .status(404, body: "{\"error\":\"missing\"}")
        ]
        let vm = PulsePostDetailViewModel(postId: "missing", client: makeAPI())
        await vm.load()
        guard case let .error(message, retryable) = vm.state else {
            XCTFail("Expected .error")
            return
        }
        XCTAssertTrue(message.contains("couldn't find") || message.contains("Couldn't find") || message.contains("post"))
        XCTAssertFalse(retryable, "A missing post can't come back on a retry, so there's no Try again")
    }
}
