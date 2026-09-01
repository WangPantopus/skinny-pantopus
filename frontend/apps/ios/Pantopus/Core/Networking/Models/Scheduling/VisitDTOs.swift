//
//  VisitDTOs.swift
//  Pantopus
//
//  DTOs for household visits — route `/api/homes/:homeId/scheduling/visits`
//  (home-only). A visit is stored as a HomeCalendarEvent. See
//  `reference/calendarly-backend-api.md`.
//

import Foundation

/// A scheduled vendor/guest visit (stored as a HomeCalendarEvent).
public struct VisitDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String?
    /// Mirrors the visit type (`vendor` | `guest`) in `event_type`.
    public let eventType: String?
    public let title: String?
    public let description: String?
    public let startAt: String?
    public let endAt: String?
    /// `who_is_home` members (mapped to `assigned_to`).
    public let assignedTo: [String]?
    public let locationNotes: String?
    public let createdBy: String?
    public let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case homeId = "home_id"
        case eventType = "event_type"
        case title
        case description
        case startAt = "start_at"
        case endAt = "end_at"
        case assignedTo = "assigned_to"
        case locationNotes = "location_notes"
        case createdBy = "created_by"
        case createdAt = "created_at"
    }
}

/// `POST /visits` → 201 `{ visit }`.
public struct VisitResponse: Decodable, Sendable, Hashable {
    public let visit: VisitDTO
}

/// Body for `POST /visits`. Owner fields spliced in by the builder.
public struct CreateVisitRequest: Encodable, Sendable {
    /// `vendor` | `guest`.
    public var visitType: String?
    public let title: String
    public var description: String?
    public let startAt: String
    public let endAt: String
    public var whoIsHome: [String]?
    public var locationNotes: String?

    enum CodingKeys: String, CodingKey {
        case visitType = "visit_type"
        case title
        case description
        case startAt = "start_at"
        case endAt = "end_at"
        case whoIsHome = "who_is_home"
        case locationNotes = "location_notes"
    }

    public init(
        title: String,
        startAt: String,
        endAt: String,
        visitType: String? = nil,
        description: String? = nil,
        whoIsHome: [String]? = nil,
        locationNotes: String? = nil
    ) {
        self.title = title
        self.startAt = startAt
        self.endAt = endAt
        self.visitType = visitType
        self.description = description
        self.whoIsHome = whoIsHome
        self.locationNotes = locationNotes
    }
}
