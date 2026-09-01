//
//  BookingPageDTOs.swift
//  Pantopus
//
//  DTOs for the host booking-page surface — route `/api/scheduling/booking-page*`
//  (and the `/api/homes/:homeId/scheduling/booking-page*` alias). See
//  `reference/calendarly-backend-api.md` → Host Scheduling Configuration.
//

import Foundation

/// A host's public booking page. `GET /booking-page` auto-creates if missing.
public struct BookingPageDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let ownerType: String
    public let ownerId: String?
    public let slug: String
    public let isLive: Bool
    public let isPaused: Bool
    public let title: String?
    public let tagline: String?
    public let avatarURL: String?
    public let intro: String?
    public let confirmationMessage: String?
    public let timezone: String?
    /// Minutes-before-start reminder offsets.
    public let reminderMinutes: [Int]?
    /// Free-form cancellation policy (string or structured object).
    public let cancellationPolicy: JSONValue?
    /// `listed` | `unlisted`.
    public let visibility: String?
    /// Free-form branding bag (colors / logo, etc.).
    public let branding: JSONValue?
    public let createdAt: String?
    public let updatedAt: String?
    public let createdBy: String?

    enum CodingKeys: String, CodingKey {
        case id
        case ownerType = "owner_type"
        case ownerId = "owner_id"
        case slug
        case isLive = "is_live"
        case isPaused = "is_paused"
        case title
        case tagline
        case avatarURL = "avatar_url"
        case intro
        case confirmationMessage = "confirmation_message"
        case timezone
        case reminderMinutes = "reminder_minutes"
        case cancellationPolicy = "cancellation_policy"
        case visibility
        case branding
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case createdBy = "created_by"
    }
}

/// Envelope for `GET /booking-page`, `PUT /booking-page`, `PUT
/// /booking-page/slug`, `POST /booking-page/reset-slug`, `POST
/// /booking-page/disable` — all return `{ page }`.
public struct BookingPageResponse: Decodable, Sendable, Hashable {
    public let page: BookingPageDTO
}

/// Body for `PUT /booking-page` — partial update; omitted keys untouched.
/// Owner fields are stripped server-side, so they're not modelled here.
public struct BookingPageUpdateRequest: Encodable, Sendable {
    public var title: String?
    public var tagline: String?
    public var avatarURL: String?
    public var intro: String?
    public var confirmationMessage: String?
    public var timezone: String?
    public var isLive: Bool?
    public var isPaused: Bool?
    public var reminderMinutes: [Int]?
    public var cancellationPolicy: JSONValue?
    public var visibility: String?
    public var branding: JSONValue?

    enum CodingKeys: String, CodingKey {
        case title
        case tagline
        case avatarURL = "avatar_url"
        case intro
        case confirmationMessage = "confirmation_message"
        case timezone
        case isLive = "is_live"
        case isPaused = "is_paused"
        case reminderMinutes = "reminder_minutes"
        case cancellationPolicy = "cancellation_policy"
        case visibility
        case branding
    }

    public init(
        title: String? = nil,
        tagline: String? = nil,
        avatarURL: String? = nil,
        intro: String? = nil,
        confirmationMessage: String? = nil,
        timezone: String? = nil,
        isLive: Bool? = nil,
        isPaused: Bool? = nil,
        reminderMinutes: [Int]? = nil,
        cancellationPolicy: JSONValue? = nil,
        visibility: String? = nil,
        branding: JSONValue? = nil
    ) {
        self.title = title
        self.tagline = tagline
        self.avatarURL = avatarURL
        self.intro = intro
        self.confirmationMessage = confirmationMessage
        self.timezone = timezone
        self.isLive = isLive
        self.isPaused = isPaused
        self.reminderMinutes = reminderMinutes
        self.cancellationPolicy = cancellationPolicy
        self.visibility = visibility
        self.branding = branding
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(title, forKey: .title)
        try c.encodeIfPresent(tagline, forKey: .tagline)
        try c.encodeIfPresent(avatarURL, forKey: .avatarURL)
        try c.encodeIfPresent(intro, forKey: .intro)
        try c.encodeIfPresent(confirmationMessage, forKey: .confirmationMessage)
        try c.encodeIfPresent(timezone, forKey: .timezone)
        try c.encodeIfPresent(isLive, forKey: .isLive)
        try c.encodeIfPresent(isPaused, forKey: .isPaused)
        try c.encodeIfPresent(reminderMinutes, forKey: .reminderMinutes)
        try c.encodeIfPresent(cancellationPolicy, forKey: .cancellationPolicy)
        try c.encodeIfPresent(visibility, forKey: .visibility)
        try c.encodeIfPresent(branding, forKey: .branding)
    }
}

/// Body for `PUT /booking-page/slug`. Owner fields are spliced in by the
/// endpoint builder via `OwnerScopedBody`.
public struct BookingPageSlugRequest: Encodable, Sendable {
    public let slug: String

    public init(slug: String) {
        self.slug = slug
    }
}

/// `GET /booking-page/check-slug` → availability + suggestions.
public struct CheckSlugResponse: Decodable, Sendable, Hashable {
    public let available: Bool
    /// Up to 3 alternatives when the slug is taken.
    public let suggestions: [String]?
    /// `INVALID_SLUG` when the format is bad.
    public let error: String?
    public let message: String?
}

/// Body for `POST /booking-page/one-off-links`. Owner fields are spliced in by
/// the endpoint builder via `OwnerScopedBody`.
public struct OneOffLinkRequest: Encodable, Sendable {
    public let eventTypeId: String
    /// Double-optional on purpose — the backend distinguishes the two nils
    /// (`oneOffSchema.expires_in_min` is `.allow(null).default(10080)`):
    ///   · `nil` (outer) → key OMITTED → server applies the 7-day default
    ///   · `.some(nil)` → EXPLICIT JSON `null` → the link never expires
    /// Passing an `Int?` argument (e.g. `expiry.minutes`) wraps to
    /// `.some(value)`, so a "Never" chip's nil minutes encodes the explicit
    /// null instead of silently becoming a 7-day link.
    public var expiresInMin: Int??
    public var singleUse: Bool?
    public var offeredSlots: [OfferedSlot]?

    public struct OfferedSlot: Encodable, Sendable, Hashable {
        public let start: String
        public let end: String

        public init(start: String, end: String) {
            self.start = start
            self.end = end
        }
    }

    enum CodingKeys: String, CodingKey {
        case eventTypeId = "event_type_id"
        case expiresInMin = "expires_in_min"
        case singleUse = "single_use"
        case offeredSlots = "offered_slots"
    }

    public init(
        eventTypeId: String,
        expiresInMin: Int?? = nil,
        singleUse: Bool? = nil,
        offeredSlots: [OfferedSlot]? = nil
    ) {
        self.eventTypeId = eventTypeId
        self.expiresInMin = expiresInMin
        self.singleUse = singleUse
        self.offeredSlots = offeredSlots
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(eventTypeId, forKey: .eventTypeId)
        switch expiresInMin {
        case .none:
            break // omit → server's 7-day default
        case .some(.none):
            try container.encodeNil(forKey: .expiresInMin) // explicit null → never expires
        case let .some(.some(minutes)):
            try container.encode(minutes, forKey: .expiresInMin)
        }
        try container.encodeIfPresent(singleUse, forKey: .singleUse)
        try container.encodeIfPresent(offeredSlots, forKey: .offeredSlots)
    }
}

/// `POST /booking-page/one-off-links` → the raw token (returned once), its
/// public path, expiry, and single-use flag.
public struct OneOffLinkResponse: Decodable, Sendable, Hashable {
    public let token: String
    public let path: String
    public let expiresAt: String?
    public let singleUse: Bool?

    enum CodingKeys: String, CodingKey {
        case token
        case path
        case expiresAt = "expires_at"
        case singleUse = "single_use"
    }
}
