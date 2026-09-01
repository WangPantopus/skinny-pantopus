//
//  MatchedBusinessesEndpoints.swift
//  Pantopus
//
//  "Nearby Providers" on Pulse post detail — the organically matched local
//  businesses the backend ranks for a post's `service_category`. Kept in its
//  own file rather than piled into the heavily-shared `PostsEndpoints`.
//

import Foundation

public enum MatchedBusinessesEndpoints {
    /// `GET /api/posts/:id/matched-businesses` — organically matched local
    /// businesses for a post. Never paid placement: the backend ranks by
    /// proximity, neighbor trust, and rating in `jobs/organicMatch.js`, caps
    /// the list at 5, suppresses posts older than 30 days, and returns an
    /// empty array when the post has no `service_category`.
    ///
    /// `cached=true` returns the pre-computed snapshot (top 3) written by the
    /// match job, which is the only variant carrying `distance_miles`,
    /// `neighbor_count`, and `is_new_business` — the three fields the card
    /// renders. Route `backend/routes/posts.js:2550`.
    public static func matchedBusinesses(postId: String, cached: Bool = true) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/posts/\(postId)/matched-businesses",
            query: ["cached": cached ? "true" : "false"]
        )
    }
}
