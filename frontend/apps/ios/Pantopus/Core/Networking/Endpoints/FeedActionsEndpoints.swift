//
//  FeedActionsEndpoints.swift
//  Pantopus
//
//  Feed-row moderation + feed-preference routes from
//  `backend/routes/posts.js`. Kept apart from `PostsEndpoints` because the
//  Pulse card overflow menu and the Pulse preferences sheet own this whole
//  cluster (hide / mute / not-helpful / solve / seeded-dismiss / prefs).
//

import Foundation

/// Endpoints backing the Pulse post-card overflow menu and the Pulse
/// preferences sheet.
public enum FeedActionsEndpoints {
    /// `POST /api/posts/hide/:id` — hides a single post from the signed-in
    /// viewer's feed. Route `backend/routes/posts.js:2094`.
    public static func hidePost(id: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/posts/hide/\(id)")
    }

    /// `POST /api/posts/mute` — mutes a user or a business across every
    /// feed surface. Route `backend/routes/posts.js:2117`.
    public static func mute(entityType: FeedMuteEntityType, entityId: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/posts/mute",
            body: FeedMuteRequest(entityType: entityType.rawValue, entityId: entityId)
        )
    }

    // `DELETE /api/posts/mute` (backend/routes/posts.js:2147) is deliberately
    // not declared here. RN's feed exposes mute but no unmute — its only
    // unmute is the audience-member one (a separate surface), so a helper here
    // would be an endpoint with zero call sites, which is the exact defect
    // shape the parity audit flagged. Add it with the screen that needs it.

    /// `POST /api/posts/mute/topic` — mutes a post type, optionally scoped
    /// to one surface (`place` / `connections` / `personas`). Route
    /// `backend/routes/posts.js:2328`.
    public static func muteTopic(postType: String, surface: String?) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/posts/mute/topic",
            body: FeedMuteTopicRequest(postType: postType, surface: surface)
        )
    }

    /// `POST /api/posts/:id/not-helpful` — community "this isn't useful
    /// here" signal. `surface` is normalised server-side to
    /// `nearby` / `connections`. Route `backend/routes/posts.js:3191`.
    public static func notHelpful(id: String, surface: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/posts/\(id)/not-helpful",
            body: FeedNotHelpfulRequest(surface: surface)
        )
    }

    /// `PATCH /api/posts/:id/solve` — author-only; marks an Ask post
    /// solved. Route `backend/routes/posts.js:3245`.
    public static func solve(id: String) -> Endpoint {
        Endpoint(method: .patch, path: "/api/posts/\(id)/solve")
    }

    /// `POST /api/posts/seeded/:factId/dismiss` — drops a cold-start
    /// neighborhood fact from this viewer's feed forever. Route
    /// `backend/routes/posts.js:3309`.
    public static func dismissSeededFact(factId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/posts/seeded/\(factId)/dismiss")
    }

    /// `GET /api/posts/feed-preferences` — hide-deals / hide-alerts /
    /// politics toggles. Route `backend/routes/posts.js:2257`.
    public static func feedPreferences() -> Endpoint {
        Endpoint(method: .get, path: "/api/posts/feed-preferences")
    }

    /// `PUT /api/posts/feed-preferences` — partial update; only the keys
    /// present in the body are written. Route
    /// `backend/routes/posts.js:2286`.
    public static func updateFeedPreferences(_ body: FeedPreferencesUpdateRequest) -> Endpoint {
        Endpoint(method: .put, path: "/api/posts/feed-preferences", body: body)
    }
}
