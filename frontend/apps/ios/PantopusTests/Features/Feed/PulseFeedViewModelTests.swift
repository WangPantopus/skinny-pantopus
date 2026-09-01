//
//  PulseFeedViewModelTests.swift
//  PantopusTests
//
//  Covers the Pulse feed VM: load → loaded/empty/error, chip-row filter
//  drives a refetch, optimistic reaction toggle (success + rollback).
//

import XCTest
@testable import Pantopus

@MainActor
final class PulseFeedViewModelTests: XCTestCase {
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

    /// The view-model's default `locationProvider` is `DeviceLocationProvider.shared`,
    /// which waits on a `CLLocationManager` callback the simulator never delivers —
    /// the suite hung here rather than failing. Every case builds the view-model
    /// through `makeVM()` so the coordinate is supplied synchronously.
    private static let fixedLocation = FixedLocationProvider(
        UserCoordinate(latitude: 40.7484, longitude: -73.9857, accuracyMeters: 100)
    )

    private func makeVM() -> PulseFeedViewModel {
        PulseFeedViewModel(api: makeAPI(), locationProvider: Self.fixedLocation)
    }

    private static let askPostJSON = """
    {
      "id": "p1",
      "user_id": "u1",
      "content": "Anyone know a good dog-walker?",
      "created_at": "2026-04-20T10:00:00Z",
      "post_type": "ask_local",
      "like_count": 12,
      "comment_count": 3,
      "userHasLiked": false,
      "location_name": "Elm Park",
      "creator": {
        "id": "u1", "username": "maria", "name": "Maria L.",
        "first_name": "Maria", "last_name": "L.",
        "profile_picture_url": null, "city": "Cambridge", "state": "MA",
        "account_type": "personal"
      }
    }
    """

    private static func feedJSON(_ posts: String...) -> String {
        let body = posts.joined(separator: ",")
        return "{\"posts\":[\(body)],\"pagination\":{\"hasMore\":false}}"
    }

    func testLoadTransitionsLoadedWhenPostsReturned() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.feedJSON(Self.askPostJSON))]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(rows.count, 1)
        XCTAssertEqual(rows.first?.intent, .ask)
        XCTAssertEqual(rows.first?.authorName, "Maria L.")
    }

    func testLoadEmptyTransitionsEmpty() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.feedJSON())]
        let vm = makeVM()
        await vm.load()
        guard case .empty = vm.state else {
            XCTFail("Expected .empty, got \(vm.state)")
            return
        }
    }

    func testLoadFailureTransitionsError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
    }

    func testSelectIntentRefetchesWithPostType() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.feedJSON(Self.askPostJSON)),
            .status(200, body: Self.feedJSON())
        ]
        let vm = makeVM()
        await vm.load()
        await vm.selectIntent(.event)
        XCTAssertEqual(vm.activeIntent, .event)
        guard case .empty = vm.state else {
            XCTFail("Expected .empty after switching to .event filter, got \(vm.state)")
            return
        }
    }

    func testTapReactionOptimisticallyIncrementsAndReconciles() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.feedJSON(Self.askPostJSON)),
            .status(200, body: "{\"liked\":true,\"likeCount\":13,\"message\":\"Post liked\"}")
        ]
        let vm = makeVM()
        await vm.load()
        await vm.tapReaction(postId: "p1")
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        XCTAssertEqual(rows.first?.reactions.first?.count, 13)
        XCTAssertTrue(rows.first?.userHasReacted ?? false)
    }

    func testLoadProjectsMediaURLsUsesFullResolution() async {
        let photoPostJSON = """
        {
          "id": "p_photo",
          "user_id": "u1",
          "content": "Check out this sunset",
          "created_at": "2026-06-07T00:00:00Z",
          "post_type": "general",
          "like_count": 0,
          "comment_count": 0,
          "userHasLiked": false,
          "media_urls": ["https://cdn.example.com/full.jpg"],
          "media_thumbnails": ["https://cdn.example.com/thumb.jpg"],
          "media_types": ["image"]
        }
        """
        SequencedURLProtocol.sequence = [.status(200, body: Self.feedJSON(photoPostJSON))]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(rows.first?.mediaURLs.map(\.absoluteString), ["https://cdn.example.com/full.jpg"])
    }

    func testLoadFallsBackToFullMediaURLWhenThumbnailEmpty() async {
        let photoPostJSON = """
        {
          "id": "p_photo",
          "user_id": "u1",
          "content": "Check out this sunset",
          "created_at": "2026-06-07T00:00:00Z",
          "post_type": "general",
          "like_count": 0,
          "comment_count": 0,
          "userHasLiked": false,
          "media_urls": ["https://cdn.example.com/full.jpg"],
          "media_thumbnails": [""],
          "media_types": ["image"]
        }
        """
        SequencedURLProtocol.sequence = [.status(200, body: Self.feedJSON(photoPostJSON))]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(rows.first?.mediaURLs.map(\.absoluteString), ["https://cdn.example.com/full.jpg"])
    }

    func testTapReactionRollsBackOnFailure() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.feedJSON(Self.askPostJSON)),
            .status(500, body: "{}")
        ]
        let vm = makeVM()
        await vm.load()
        await vm.tapReaction(postId: "p1")
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        XCTAssertEqual(rows.first?.reactions.first?.count, 12, "count rolls back to the seed")
        XCTAssertFalse(rows.first?.userHasReacted ?? true, "userHasReacted rolls back to false")
    }
}
