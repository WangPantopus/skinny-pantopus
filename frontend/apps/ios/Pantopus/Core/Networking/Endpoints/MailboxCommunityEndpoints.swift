//
//  MailboxCommunityEndpoints.swift
//  Pantopus
//
//  Endpoint builders for the A17.4 Community-mail feed. The Phase-3
//  router is mounted at `/api/mailbox/v2/p3` (`backend/app.js:317`) from
//  `backend/routes/mailboxV2Phase3.js`, so every path below is that
//  prefix + the route-relative declaration.
//
//  Mirrors `data/api/services/MailboxCommunityApi.kt` on Android.
//

import Foundation

/// Community-feed routes from `backend/routes/mailboxV2Phase3.js`.
public enum MailboxCommunityEndpoints {
    /// `GET /api/mailbox/v2/p3/community/feed` — route
    /// `backend/routes/mailboxV2Phase3.js:565`. Neighborhood / civic feed
    /// across every home the caller occupies, newest first. `type` filters
    /// on `community_type`; omit it for "All". Returns `{ items, total }`.
    public static func feed(
        type: String? = nil,
        limit: Int = 30,
        offset: Int = 0
    ) -> Endpoint {
        var query: [String: String] = ["limit": String(limit), "offset": String(offset)]
        if let type { query["type"] = type }
        return Endpoint(method: .get, path: "/api/mailbox/v2/p3/community/feed", query: query)
    }

    /// `POST /api/mailbox/v2/p3/community/react` — route
    /// `backend/routes/mailboxV2Phase3.js:694`. Toggles one of the four
    /// reaction types and returns the recomputed `{ reactions }` roll-up.
    public static func react(communityItemId: String, reactionType: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/mailbox/v2/p3/community/react",
            body: CommunityReactRequest(
                communityItemId: communityItemId,
                reactionType: reactionType
            )
        )
    }

    /// `POST /api/mailbox/v2/p3/community/rsvp` — route
    /// `backend/routes/mailboxV2Phase3.js:746`. Idempotent: adds a
    /// `will_attend` reaction when absent, then returns
    /// `{ message, rsvpCount }`.
    public static func rsvp(communityItemId: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/mailbox/v2/p3/community/rsvp",
            body: CommunityRsvpRequest(communityItemId: communityItemId)
        )
    }

    /// `POST /api/mailbox/v2/p3/community/flag` — route
    /// `backend/routes/mailboxV2Phase3.js:790`. Reports an item for
    /// review; server-side this records a `concerned` reaction and logs a
    /// `community_flagged` mail event.
    public static func flag(communityItemId: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/mailbox/v2/p3/community/flag",
            body: CommunityFlagRequest(communityItemId: communityItemId)
        )
    }
}
