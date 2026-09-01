//
//  NotificationPreferencesEndpoints.swift
//  Pantopus
//
//  T2 — hub notification / briefing preferences. Split out of
//  `HubEndpoints` because the preferences pair is owned by the A14.5
//  Notifications settings screen, not the Hub surfaces.
//

import Foundation

/// Endpoint builders for the preferences pair in `backend/routes/hub.js`.
public enum NotificationPreferencesEndpoints {
    /// `GET /api/hub/preferences` — route `backend/routes/hub.js:648`.
    ///
    /// Always 200s: the handler falls back to a hand-built default
    /// object when the user has no `UserNotificationPreferences` row
    /// (`hub.js:666-684`). No cache — the screen is the editor.
    public static func fetch() -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/hub/preferences",
            cachePolicy: .reloadIgnoringLocalCacheData
        )
    }

    /// `PUT /api/hub/preferences` — route `backend/routes/hub.js:716`.
    ///
    /// Partial update: the handler upserts `{ user_id, ...body }`, and
    /// Joi validates the body against the exact key set at
    /// `hub.js:697-714` with `.min(1)` — so send only the keys that
    /// changed, using the backend's snake_case names. `quiet_hours_*`
    /// accept explicit `null` to clear.
    public static func update(_ patch: [String: JSONValue]) -> Endpoint {
        Endpoint(
            method: .put,
            path: "/api/hub/preferences",
            body: patch
        )
    }
}
