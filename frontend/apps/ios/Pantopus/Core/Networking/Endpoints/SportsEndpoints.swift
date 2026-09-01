//
//  SportsEndpoints.swift
//  Pantopus
//
//  Sports topic lane — read-only event registry backing the Pulse
//  Sports lane's mode chips and its active-event module.
//

import Foundation

/// Routes under `/api/sports` (`backend/app.js:328`).
public enum SportsEndpoints {
    /// `GET /api/sports/active-events` — currently-active major events,
    /// highest priority first. Route `backend/routes/sports.js:27`.
    public static func activeEvents() -> Endpoint {
        Endpoint(method: .get, path: "/api/sports/active-events")
    }
}

/// One row of the active-event registry
/// (`backend/routes/sports.js:23-24`). Keys are snake_case on the wire.
public struct ActiveSportsEventDTO: Decodable, Sendable, Hashable, Identifiable {
    public let eventKey: String
    public let displayName: String?
    public let shortLabel: String?
    public let league: String?
    public let country: String?
    public let startsAt: String?
    public let endsAt: String?
    public let priority: Int?

    public var id: String {
        eventKey
    }

    /// Chip label — short label first, then the full display name.
    public var chipLabel: String? {
        if let shortLabel, !shortLabel.isEmpty { return shortLabel }
        if let displayName, !displayName.isEmpty { return displayName }
        return nil
    }

    enum CodingKeys: String, CodingKey {
        case eventKey = "event_key"
        case displayName = "display_name"
        case shortLabel = "short_label"
        case league, country, priority
        case startsAt = "starts_at"
        case endsAt = "ends_at"
    }
}

/// `GET /api/sports/active-events` envelope
/// (`backend/routes/sports.js:31`).
public struct ActiveSportsEventsResponse: Decodable, Sendable, Hashable {
    public let primaryEvent: ActiveSportsEventDTO?
    public let events: [ActiveSportsEventDTO]

    public init(primaryEvent: ActiveSportsEventDTO? = nil, events: [ActiveSportsEventDTO] = []) {
        self.primaryEvent = primaryEvent
        self.events = events
    }
}
