//
//  MailboxP3DTOs.swift
//  Pantopus
//
//  DTOs for the Phase-3 mailbox routes in
//  `backend/routes/mailboxV2Phase3.js` that back the A11.4 Mailbox map
//  and the A14.8 Vacation hold screens.
//
//  Wire rows are snake_case; request bodies are camelCase because the
//  backend Joi schemas (`createPinSchema` / `startVacationSchema` /
//  `cancelVacationSchema`) validate camelCase keys. Mirrors the Android
//  DTOs in `data/api/models/mailbox/v2/MapPinDtos.kt` +
//  `data/api/models/mailbox/v2/VacationDtos.kt`.
//

import Foundation

// MARK: - Map pins (A11.4)

/// One `HomeMapPin` row — route `backend/routes/mailboxV2Phase3.js:431`.
///
/// DOMAIN NOTE: these are household / neighborhood annotations attached to a
/// home (permits, deliveries, notices, civic alerts, utility work, community
/// events), optionally linked to a mail item. Named `HomeMapPinDTO` rather
/// than `MapPin` because `Features/Shared/MapListHybrid` already owns a
/// render-side `MapPin`.
public struct HomeMapPinDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String?
    public let mailId: String?
    public let createdBy: String?
    /// `permit` / `delivery` / `notice` / `civic` / `utility_work` / `community`.
    public let pinType: String?
    public let title: String?
    public let body: String?
    public let lat: Double?
    public let lng: Double?
    public let radiusMeters: Double?
    /// `personal` / `household` / `neighborhood` / `public`.
    public let visibleTo: String?
    public let expiresAt: String?
    public let createdAt: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case homeId = "home_id"
        case mailId = "mail_id"
        case createdBy = "created_by"
        case pinType = "pin_type"
        case title, body, lat, lng
        case radiusMeters = "radius_meters"
        case visibleTo = "visible_to"
        case expiresAt = "expires_at"
        case createdAt = "created_at"
    }
}

/// `GET /api/mailbox/v2/p3/map/pins` envelope — `{ pins }`.
public struct HomeMapPinsResponse: Decodable, Sendable, Hashable {
    public let pins: [HomeMapPinDTO]

    private enum CodingKeys: String, CodingKey {
        case pins
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        pins = try container.decodeIfPresent([HomeMapPinDTO].self, forKey: .pins) ?? []
    }
}

// MARK: - Vacation hold (A14.8)

/// One `VacationHold` row — route `backend/routes/mailboxV2Phase3.js:1523`.
public struct VacationHoldDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let userId: String?
    public let homeId: String?
    /// `yyyy-MM-dd` (Joi `isoDate` also accepts a full timestamp).
    public let startDate: String?
    public let endDate: String?
    /// `hold_in_vault` / `forward_to_household` / `notify_urgent_only`.
    public let holdAction: String?
    /// `hold_at_carrier` / `ask_neighbor` / `locker`.
    public let packageAction: String?
    public let autoNeighborRequest: Bool?
    /// `scheduled` / `active` / `cancelled`.
    public let status: String?
    public let itemsHeldCount: Int?
    public let createdAt: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case homeId = "home_id"
        case startDate = "start_date"
        case endDate = "end_date"
        case holdAction = "hold_action"
        case packageAction = "package_action"
        case autoNeighborRequest = "auto_neighbor_request"
        case status
        case itemsHeldCount = "items_held_count"
        case createdAt = "created_at"
    }
}

/// `GET /api/mailbox/v2/p3/vacation/status` envelope — `{ active, upcoming }`.
/// Both are null when the user has no scheduled or in-flight hold.
public struct VacationStatusResponse: Decodable, Sendable, Hashable {
    public let active: VacationHoldDTO?
    public let upcoming: VacationHoldDTO?
}

/// Body for `POST /api/mailbox/v2/p3/vacation/start` — route
/// `backend/routes/mailboxV2Phase3.js:1546` (`startVacationSchema`).
public struct StartVacationRequest: Encodable, Sendable, Hashable {
    public let homeId: String
    public let startDate: String
    public let endDate: String
    public let holdAction: String
    public let packageAction: String
    public let autoNeighborRequest: Bool

    public init(
        homeId: String,
        startDate: String,
        endDate: String,
        holdAction: String,
        packageAction: String,
        autoNeighborRequest: Bool = false
    ) {
        self.homeId = homeId
        self.startDate = startDate
        self.endDate = endDate
        self.holdAction = holdAction
        self.packageAction = packageAction
        self.autoNeighborRequest = autoNeighborRequest
    }
}

/// `POST /api/mailbox/v2/p3/vacation/start` envelope — `{ hold }`.
public struct StartVacationResponse: Decodable, Sendable, Hashable {
    public let hold: VacationHoldDTO
}

/// Body for `POST /api/mailbox/v2/p3/vacation/cancel` — route
/// `backend/routes/mailboxV2Phase3.js:1601` (`cancelVacationSchema`).
public struct CancelVacationRequest: Encodable, Sendable, Hashable {
    public let holdId: String

    public init(holdId: String) {
        self.holdId = holdId
    }
}

/// `POST /api/mailbox/v2/p3/vacation/cancel` envelope — `{ message }`.
public struct CancelVacationResponse: Decodable, Sendable, Hashable {
    public let message: String?
}
