//
//  NotificationPrefsDTOs.swift
//  Pantopus
//
//  DTOs for scheduling notification preferences — routes
//  `/api/scheduling/notification-preferences` (personal). The prefs object is
//  service-defined and flexible (`object.unknown(true)`), so it round-trips as
//  `JSONValue` — unknown keys are preserved on write. See
//  `reference/calendarly-backend-api.md`.
//

import Foundation

/// `GET /notification-preferences` / `PUT …` → `{ prefs }`. The shape is
/// flexible; preserve unknown keys by round-tripping `JSONValue`.
public struct NotificationPreferencesResponse: Decodable, Sendable, Hashable {
    public let prefs: JSONValue
}

/// Body for `PUT /notification-preferences`.
public struct UpdateNotificationPreferencesRequest: Encodable, Sendable {
    public let prefs: JSONValue

    public init(prefs: JSONValue) {
        self.prefs = prefs
    }
}
