//
//  PulsePostDetailViewModelTests.swift
//  PantopusTests
//
//  Covers happy-path load, optimistic reaction toggle (success + rollback),
//  comment send, and the safety-guard on non-wired reaction kinds.
//

import XCTest
@testable import Pantopus

@MainActor
final class PulsePostDetailViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
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
        "id": "p1",
        "user_id": "u1",
        "title": null,
        "content": "Anyone know a good handyman?",
        "post_type": "ask",
        "post_format": "standard",
        "purpose": "ask",
        "media_urls": [],
        "media_live_urls": [],
        "media_types": [],
        "created_at": "2026-04-30T12:00:00.000Z",
        "updated_at": null,
        "is_edited": false,
        "like_count": 3,
        "comment_count": 2,
        "share_count": 0,
        "view_count": 12,
        "userHasLiked": false,
        "userHasSaved": false,
        "userHasReposted": false,
        "creator": {
          "id": "u1",
          "username": "alex",
          "name": "Alex Rivera",
          "first_name": "Alex",
          "last_name": "Rivera",
          "profile_picture_url": null,
          "city": "Cambridge",
          "state": "MA",
          "account_type": "personal"
        },
        "home": null,
        "comments": [
          {
            "id": "c1",
            "post_id": "p1",
            "user_id": "u2",
            "parent_comment_id": null,
            "comment": "Try Westside Plumbing",
            "created_at": "2026-04-30T12:05:00.000Z",
            "is_deleted": false,
            "author": {
              "id": "u2",
              "username": "maria",
              "name": "Maria Chen",
              "first_name": "Maria",
              "last_name": "Chen",
              "profile_picture_url": null,
              "city": null,
              "state": null,
              "account_type": "personal"
            }
          },
          {
            "id": "c2",
            "post_id": "p1",
            "user_id": "u3",
            "parent_comment_id": "c1",
            "comment": "+1 Mike's great",
            "created_at": "2026-04-30T12:06:00.000Z",
            "is_deleted": false,
            "author": {
              "id": "u3",
              "username": "sam",
              "name": "Sam Lee",
              "first_name": null,
              "last_name": null,
              "profile_picture_url": null,
              "city": null,
              "state": null,
              "account_type": "personal"
            }
          }
        ]
      }
    }
    """

    // MARK: - Happy-path load

    func testLoadDecodesDetail() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.postJSON)]
        let vm = PulsePostDetailViewModel(postId: "p1", client: makeAPI())
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        XCTAssertEqual(content.authorDisplayName, "Alex Rivera")
        XCTAssertEqual(content.reactions.helpful, 3)
        XCTAssertNil(content.reactions.userReaction)
        XCTAssertEqual(content.intent, .ask)
        XCTAssertEqual(content.comments.count, 2)
        XCTAssertEqual(content.comments[0].indentLevel, 0)
        XCTAssertEqual(content.comments[1].indentLevel, 1)
        XCTAssertTrue(content.timeAndLocality.contains("Cambridge, MA"))
    }

    func testLostFoundPurposeMapsToLostFoundIntent() {
        XCTAssertEqual(PostIntent.from(purpose: "lost_found", postType: nil), .lostFound)
    }

    // MARK: - Reactions

    func testHelpfulOptimisticToggleAndReconcile() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.postJSON),
            .status(200, body: "{\"liked\":true,\"likeCount\":4}")
        ]
        let vm = PulsePostDetailViewModel(postId: "p1", client: makeAPI())
        await vm.load()
        await vm.tapReaction(.helpful)
        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        XCTAssertEqual(content.reactions.helpful, 4)
        XCTAssertEqual(content.reactions.userReaction, .helpful)
    }

    func testHelpfulRollbackOnFailure() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.postJSON),
            .status(500, body: "{\"error\":\"boom\"}")
        ]
        let vm = PulsePostDetailViewModel(postId: "p1", client: makeAPI())
        await vm.load()
        await vm.tapReaction(.helpful)
        guard case let .loaded(content) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        XCTAssertEqual(content.reactions.helpful, 3, "Optimistic increment should roll back")
        XCTAssertNil(content.reactions.userReaction)
        XCTAssertNotNil(vm.toastMessage)
    }

    func testHeartReactionIsDisplayOnly() async {
        // The view renders Heart and Going as non-tappable display chips,
        // so tapReaction should only ever be invoked for `.helpful`. The
        // safety guard in the VM returns silently for the others — no
        // toast, no state change.
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

    // MARK: - Errors

    func testNotFoundProducesFriendlyError() async {
        SequencedURLProtocol.sequence = [.status(404, body: "{\"error\":\"missing\"}")]
        let vm = PulsePostDetailViewModel(postId: "missing", client: makeAPI())
        await vm.load()
        guard case let .error(message) = vm.state else {
            XCTFail("Expected .error")
            return
        }
        XCTAssertTrue(message.contains("couldn't find") || message.contains("Couldn't find") || message.contains("post"))
    }
}
