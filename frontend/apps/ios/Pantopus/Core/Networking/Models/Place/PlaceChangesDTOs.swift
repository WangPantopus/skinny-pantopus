//
//  PlaceChangesDTOs.swift
//  Pantopus
//
//  `GET /api/homes/:id/changes?since=` — what really changed at a Home since
//  this account's last visit to its Place: an alert issued, the household's
//  pickup schedule, a document, the systems record, household activity the
//  viewer may see. Only dated records; nothing on a first visit.
//

import Foundation

public struct PlaceChangesResponse: Decodable, Sendable {
    /// The `since` the server used (clamped to 30 days).
    public let since: String?
    /// The server's time of the answer: the next visit's `since`.
    public let until: String?
    /// Every match, though at most 20 items come back.
    public let total: Int?
    public let items: [PlaceChange]

    private enum CodingKeys: String, CodingKey {
        case since, until, total, items
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        since = try c.decodeIfPresent(String.self, forKey: .since)
        until = try c.decodeIfPresent(String.self, forKey: .until)
        total = try c.decodeIfPresent(Int.self, forKey: .total)
        // An item this build can't read is left out; the rest still show.
        items = (try? c.decode([FailableChange].self, forKey: .items))?.compactMap(\.change) ?? []
    }

    private struct FailableChange: Decodable {
        let change: PlaceChange?

        init(from decoder: Decoder) throws {
            change = try? PlaceChange(from: decoder)
        }
    }
}

public struct PlaceChange: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    /// weather_alert | pickup_schedule | document_added | systems_updated | household_activity.
    public let kind: String
    public let title: String
    public let detail: String?
    /// ISO 8601.
    public let occurredAt: String?
    /// Where it came from, in words ("NWS Portland OR", "Your household").
    public let origin: String?
    public let route: PlaceChangeRoute?

    private enum CodingKeys: String, CodingKey {
        case id, kind, title, detail, origin, route
        case occurredAt = "occurred_at"
    }
}

/// Where a change opens: `{ screen: "today", section: "alerts" }`,
/// `{ screen: "documents", id }`, `{ screen: "place_detail", group: "your_home" }`,
/// `{ screen: "home_activity" }`.
public struct PlaceChangeRoute: Decodable, Sendable, Hashable {
    public let screen: String
    public let section: String?
    public let group: String?
    public let id: String?
}
