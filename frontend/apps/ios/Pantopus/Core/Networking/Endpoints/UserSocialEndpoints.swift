//
//  UserSocialEndpoints.swift
//  Pantopus
//
//  T3 — the three `backend/routes/users.js` routes the native apps never
//  called: username-based profile resolution, plus plain follow /
//  unfollow of an ordinary neighbor (distinct from the persona privacy
//  handshake under `/api/personas/*`).
//
//  Lives in its own file rather than piling onto `PostsEndpoints.swift`
//  (which hosts `PublicProfileEndpoints`) so sibling work in the same
//  tree doesn't collide.
//

import Foundation

/// `/api/users/*` social routes — profile lookup by handle and the
/// follow graph.
public enum UserSocialEndpoints {
    /// `GET /api/users/username/:username` — resolve a profile from a
    /// handle (`pantopus://u/mariak`). Same response body as
    /// `GET /api/users/id/:id`, so both decode into `PublicProfile`.
    /// Route `backend/routes/users.js:3367`.
    public static func profileByUsername(_ username: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/users/username/\(escape(username))")
    }

    /// `POST /api/users/:id/follow` — follow an ordinary user. Returns
    /// `{message, following}`. 400 when already following or self,
    /// 403 when blocked / curator. Route `backend/routes/users.js:3520`.
    public static func follow(userId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/users/\(escape(userId))/follow")
    }

    /// `DELETE /api/users/:id/follow` — unfollow. Returns
    /// `{message, following:false}`. Route `backend/routes/users.js:3593`.
    public static func unfollow(userId: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/users/\(escape(userId))/follow")
    }

    /// `GET /api/users/:id/relationship` — combined connection +
    /// follow status for the profile header. Returns
    /// `{relationship, following, followed_by}`.
    /// Route `backend/routes/users.js:3685`.
    public static func relationship(userId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/users/\(escape(userId))/relationship")
    }

    /// `true` when the string looks like a canonical v1–v5 UUID. Mirrors
    /// the RN `UUID_REGEX` guard at
    /// `pantopus/frontend/apps/mobile/src/app/user/[id].tsx:27`, which is
    /// what decides between `/api/users/id/:id` and
    /// `/api/users/username/:username`.
    public static func isUUID(_ value: String) -> Bool {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count == 36 else { return false }
        let pattern = "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        return trimmed.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil
    }

    /// Strip a leading `@` (and whitespace) from a handle before it becomes
    /// a path segment — RN's `normalizeUsername`.
    public static func normalizeHandle(_ value: String) -> String {
        var trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        while trimmed.hasPrefix("@") {
            trimmed.removeFirst()
        }
        return trimmed
    }

    /// Handles arrive from deep links, so they may still carry percent
    /// escapes or stray characters. Encode defensively.
    private static func escape(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? value
    }
}
