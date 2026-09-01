//
//  PostsEndpoints.swift
//  Pantopus
//
//  Endpoint builders for `backend/routes/posts.js` — feed list, detail,
//  reactions, comments, compose.
//

import Foundation

/// Endpoints under `/api/posts/*`.
public enum PostsEndpoints {
    /// `GET /api/posts/feed` — paged feed for the Pulse tab. The backend
    /// requires `surface` and (for `place`) coordinates. Route
    /// `backend/routes/posts.js:1449`.
    public static func feed(
        surface: String = "place",
        latitude: Double? = nil,
        longitude: Double? = nil,
        radiusMiles: Double? = nil,
        postType: String? = nil,
        limit: Int = 20,
        cursorCreatedAt: String? = nil,
        cursorId: String? = nil,
        topic: String? = nil,
        sportsMode: String? = nil,
        eventKey: String? = nil
    ) -> Endpoint {
        var query: [String: String] = [
            "surface": surface,
            "limit": String(limit)
        ]
        if let latitude { query["latitude"] = String(latitude) }
        if let longitude { query["longitude"] = String(longitude) }
        if let radiusMiles { query["radiusMiles"] = String(radiusMiles) }
        if let postType { query["postType"] = postType }
        if let cursorCreatedAt { query["cursorCreatedAt"] = cursorCreatedAt }
        if let cursorId { query["cursorId"] = cursorId }
        // Topic lane params — validated at
        // `backend/routes/posts.js:1478-1489`. `topic` is Place-only and
        // `sportsMode` must be one of for_you|local|event|watch.
        if let topic { query["topic"] = topic }
        if let sportsMode { query["sportsMode"] = sportsMode }
        if let eventKey { query["eventKey"] = eventKey }
        return Endpoint(method: .get, path: "/api/posts/feed", query: query)
    }

    /// `POST /api/posts` — create a new post. Body keys are validated
    /// by `createPostSchema` at `backend/routes/posts.js:196-300`. Route
    /// `backend/routes/posts.js:862`.
    public static func createPost(body: PostCreateRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/posts", body: body)
    }

    /// `PATCH /api/posts/:id` — author-only edit. Body keys are validated
    /// by `updatePostSchema` at `backend/routes/posts.js:298-328`. Route
    /// `backend/routes/posts.js:2428`.
    public static func updatePost(id: String, body: PostUpdateRequest) -> Endpoint {
        Endpoint(method: .patch, path: "/api/posts/\(id)", body: body)
    }

    /// `GET /api/posts/:id` — route `backend/routes/posts.js:2354`.
    public static func detail(id: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/posts/\(id)")
    }

    /// `GET /api/posts/place-eligibility` — can the signed-in user post
    /// to the Place feed at these coordinates? Route
    /// `backend/routes/posts.js:1941`.
    public static func placeEligibility(
        latitude: Double,
        longitude: Double,
        gpsTimestamp: String? = nil,
        gpsLatitude: Double? = nil,
        gpsLongitude: Double? = nil
    ) -> Endpoint {
        var query: [String: String] = [
            "latitude": String(latitude),
            "longitude": String(longitude)
        ]
        if let gpsTimestamp { query["gpsTimestamp"] = gpsTimestamp }
        if let gpsLatitude { query["gpsLatitude"] = String(gpsLatitude) }
        if let gpsLongitude { query["gpsLongitude"] = String(gpsLongitude) }
        return Endpoint(method: .get, path: "/api/posts/place-eligibility", query: query)
    }

    /// `POST /api/posts/:id/like` — toggles the like; returns the new
    /// `{liked, likeCount}` state. Route `backend/routes/posts.js:2595`.
    public static func toggleLike(id: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/posts/\(id)/like")
    }

    /// `GET /api/posts/:id/comments` — paged. Route
    /// `backend/routes/posts.js:2743`.
    public static func comments(id: String, limit: Int = 50, offset: Int = 0) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/posts/\(id)/comments",
            query: ["limit": String(limit), "offset": String(offset)]
        )
    }

    /// `POST /api/posts/:id/comments` — create a new comment. Route
    /// `backend/routes/posts.js:2651`.
    public static func createComment(id: String, body: PostCommentRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/posts/\(id)/comments", body: body)
    }

    /// `GET /api/posts/user/:userId` — paged list of posts authored by a
    /// user, filtered to the active set (`archived_at IS NULL`) on the
    /// backend. Route `backend/routes/posts.js:3016`. Use the signed-in
    /// user's id to power the "My posts" screen.
    public static func userPosts(
        userId: String,
        limit: Int = 50,
        cursorCreatedAt: String? = nil,
        cursorId: String? = nil
    ) -> Endpoint {
        var query: [String: String] = ["limit": String(limit)]
        if let cursorCreatedAt { query["cursorCreatedAt"] = cursorCreatedAt }
        if let cursorId { query["cursorId"] = cursorId }
        return Endpoint(method: .get, path: "/api/posts/user/\(userId)", query: query)
    }

    /// `DELETE /api/posts/:id` — author-only delete. Route
    /// `backend/routes/posts.js:2483`.
    public static func deletePost(id: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/posts/\(id)")
    }

    /// `POST /api/posts/:postId/comments/:commentId/like` — toggles a
    /// heart on a comment; returns `{liked, likeCount}`. Route
    /// `backend/routes/posts.js:2983`.
    public static func toggleCommentLike(postId: String, commentId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/posts/\(postId)/comments/\(commentId)/like")
    }

    /// `DELETE /api/posts/:postId/comments/:commentId` — author-only
    /// comment delete (soft-deletes server-side). Route
    /// `backend/routes/posts.js:2955`.
    public static func deleteComment(postId: String, commentId: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/posts/\(postId)/comments/\(commentId)")
    }

    /// `POST /api/posts/:id/share` — records an external share
    /// (`shareType: "external"`) or toggles a repost (`"repost"`);
    /// returns `{shared|reposted, shareCount}`. Route
    /// `backend/routes/posts.js:2829`.
    public static func share(id: String, shareType: String = "external") -> Endpoint {
        Endpoint(method: .post, path: "/api/posts/\(id)/share", body: PostShareRequest(shareType: shareType))
    }

    /// `POST /api/posts/:id/report` — files a report with one of the
    /// `reportPostSchema` reasons. Route `backend/routes/posts.js:3167`.
    public static func report(id: String, reason: String, details: String? = nil) -> Endpoint {
        Endpoint(method: .post, path: "/api/posts/\(id)/report", body: PostReportRequest(reason: reason, details: details))
    }

    /// `POST /api/posts/:id/save` — toggles the viewer's bookmark;
    /// returns `{saved}`. Route `backend/routes/posts.js:3276`.
    public static func toggleSave(id: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/posts/\(id)/save")
    }

    /// `POST /api/posts/:id/archive` — author-only archive.
    public static func archive(id: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/posts/\(id)/archive")
    }

    /// `POST /api/posts/:id/unarchive` — author-only restore.
    public static func unarchive(id: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/posts/\(id)/unarchive")
    }
}

/// Endpoint builders for public profile fetch. Lives alongside posts
/// because both screens land together in P17 and share a navigation
/// surface.
public enum PublicProfileEndpoints {
    /// `GET /api/users/id/:id` — route `backend/routes/users.js:2041`.
    public static func profile(id: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/users/id/\(id)")
    }
}
