//
//  FeedDTOsTests.swift
//  PantopusTests
//
//  Decodes cold-start seeded feed rows where `user_id` and creator `id`
//  are null (see `backend/routes/posts.js:_buildSeededItem`).
//

import XCTest
@testable import Pantopus

final class FeedDTOsTests: XCTestCase {
    func testDecodesSeededFeedRowWithNullUserId() throws {
        let json = Data("""
        {
          "posts": [
            {
              "id": "p_real",
              "user_id": "u1",
              "content": "Hello neighbors",
              "created_at": "2026-06-07T00:00:00Z",
              "post_type": "ask_local",
              "like_count": 1,
              "comment_count": 0,
              "userHasLiked": false,
              "creator": {
                "id": "u1",
                "username": "maria",
                "name": "Maria L."
              }
            },
            {
              "id": "fact_1",
              "user_id": null,
              "title": "Did you know?",
              "content": "Your neighborhood has a farmers market on Saturdays.",
              "created_at": "2026-06-01T00:00:00Z",
              "post_type": "general",
              "like_count": 0,
              "comment_count": 0,
              "userHasLiked": false,
              "creator": {
                "id": null,
                "name": "Pantopus",
                "username": "pantopus",
                "first_name": "Pantopus",
                "last_name": null,
                "profile_picture_url": null
              }
            }
          ],
          "pagination": { "hasMore": false }
        }
        """.utf8)

        let response = try JSONDecoder().decode(FeedResponse.self, from: json)
        XCTAssertEqual(response.posts.count, 2)
        XCTAssertEqual(response.posts[0].userId, "u1")
        XCTAssertNil(response.posts[1].userId)
        XCTAssertEqual(response.posts[1].creator?.displayName, "Pantopus")
        XCTAssertEqual(response.posts[1].creator?.id, "pantopus")
    }

    func testDecodesFeedWithObjectPaginationAndIdentityCreator() throws {
        let json = Data("""
        {
          "posts": [
            {
              "id": "p1",
              "user_id": "u1",
              "content": "Anyone know a plumber?",
              "created_at": "2026-06-07T00:00:00Z",
              "post_type": "ask_local",
              "like_count": 0,
              "comment_count": 0,
              "userHasLiked": false,
              "creator": {
                "type": "local",
                "id": "lp_1",
                "handle": "maria",
                "displayName": "Maria L.",
                "avatarUrl": null
              }
            }
          ],
          "pagination": {
            "nextCursor": { "createdAt": "2026-06-07T00:00:00Z", "id": "p1" },
            "hasMore": false
          }
        }
        """.utf8)

        let response = try JSONDecoder().decode(FeedResponse.self, from: json)
        XCTAssertEqual(response.posts.count, 1)
        XCTAssertEqual(response.posts[0].creator?.displayName, "Maria L.")
        XCTAssertEqual(response.pagination?.nextCursor, "p1")
        XCTAssertEqual(response.pagination?.hasMore, false)
    }

    func testDecodesFeedPostMediaFields() throws {
        let json = Data("""
        {
          "posts": [
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
          ]
        }
        """.utf8)

        let post = try JSONDecoder().decode(FeedResponse.self, from: json).posts[0]
        XCTAssertEqual(post.mediaURLs, ["https://cdn.example.com/full.jpg"])
        XCTAssertEqual(post.mediaThumbnails, ["https://cdn.example.com/thumb.jpg"])
        XCTAssertEqual(post.mediaTypes, ["image"])
    }
}
