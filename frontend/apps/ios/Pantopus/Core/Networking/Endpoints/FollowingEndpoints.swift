//
//  FollowingEndpoints.swift
//  Pantopus
//
//  §1A① — "Following" (Beacons you follow). Read + row-action endpoints.
//  All four routes already exist on the backend; this screen does not add
//  or change any server behaviour.
//

import Foundation

public enum FollowingEndpoints {
    /// `GET /api/personas/me/following` — the signed-in user's followed
    /// Beacons, grouped client-side by activity. `sort` is one of
    /// `activity | recent | alpha | unread`. Route
    /// `backend/routes/personas.js:425`.
    public static func list(
        sort: String = "activity",
        limit: Int = 100,
        offset: Int = 0
    ) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/personas/me/following",
            query: [
                "sort": sort,
                "limit": String(limit),
                "offset": String(offset)
            ]
        )
    }

    /// `POST /api/personas/me/following/:personaId/seen` — zero out the
    /// unread count for one Beacon. Idempotent. Route
    /// `backend/routes/personas.js:547`.
    public static func markSeen(personaId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/personas/me/following/\(personaId)/seen")
    }

    /// `PATCH /api/personas/me/following/:personaId/mute` — temporary mute.
    /// `days = N` sets `muted_until = now + N days` (1…365); `days = null`
    /// clears the mute. Route `backend/routes/personas.js:582`.
    public static func mute(personaId: String, days: Int?) -> Endpoint {
        Endpoint(
            method: .patch,
            path: "/api/personas/me/following/\(personaId)/mute",
            body: MuteFollowingBody(days: days)
        )
    }

    /// `DELETE /api/personas/:id/follow` — unfollow a Beacon (same call the
    /// A21 public profile "Unfollow" uses). Paid memberships (rank > 1)
    /// are rejected with 409 and must be managed in settings. Route
    /// `backend/routes/personas.js:1692`.
    public static func unfollow(personaId: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/personas/\(personaId)/follow")
    }

    /// `PATCH /api/personas/:id/follow/preferences` — per-Beacon notification
    /// level. `notification_level` is validated against
    /// `all | highlights | none` (`notificationPreferenceSchema`,
    /// `backend/routes/personas.js:88`). Route
    /// `backend/routes/personas.js:1743`.
    public static func notificationLevel(personaId: String, level: String) -> Endpoint {
        Endpoint(
            method: .patch,
            path: "/api/personas/\(personaId)/follow/preferences",
            body: FollowNotificationLevelBody(notificationLevel: level)
        )
    }
}
