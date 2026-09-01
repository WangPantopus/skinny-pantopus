//
//  ResourceDTOs.swift
//  Pantopus
//
//  DTOs for bookable home resources — routes `/api/homes/:homeId/scheduling/
//  resources*` (home-only). Resource bookings are render-only via the calendar
//  union (never create HomeCalendarEvent rows). See
//  `reference/calendarly-backend-api.md`.
//

import Foundation

/// A bookable home resource (room / vehicle / tool / charger / other).
public struct ResourceDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String?
    public let name: String
    /// `room` | `vehicle` | `tool` | `charger` | `other`.
    public let resourceType: String?
    public let photoURL: String?
    /// `members` | `specific` | `guests`.
    public let whoCanBook: String?
    public let maxDurationMin: Int?
    public let bufferMin: Int?
    public let requiresApproval: Bool?
    public let availableHours: JSONValue?
    public let isActive: Bool?
    public let createdAt: String?
    public let createdBy: String?

    enum CodingKeys: String, CodingKey {
        case id
        case homeId = "home_id"
        case name
        case resourceType = "resource_type"
        case photoURL = "photo_url"
        case whoCanBook = "who_can_book"
        case maxDurationMin = "max_duration_min"
        case bufferMin = "buffer_min"
        case requiresApproval = "requires_approval"
        case availableHours = "available_hours"
        case isActive = "is_active"
        case createdAt = "created_at"
        case createdBy = "created_by"
    }
}

/// A resource booking row (`POST /resources/:rid/book`).
public struct ResourceBookingDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let resourceId: String?
    public let startAt: String?
    public let endAt: String?
    public let name: String?
    public let bookedBy: String?
    public let status: String?
    public let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case resourceId = "resource_id"
        case startAt = "start_at"
        case endAt = "end_at"
        case name
        case bookedBy = "booked_by"
        case status
        case createdAt = "created_at"
    }
}

/// `GET /resources` → `{ resources }`.
public struct ResourcesResponse: Decodable, Sendable, Hashable {
    public let resources: [ResourceDTO]
}

/// `POST /resources`, `PUT /resources/:rid` → `{ resource }`.
public struct ResourceResponse: Decodable, Sendable, Hashable {
    public let resource: ResourceDTO
}

/// `POST /resources/:rid/book` → 201 `{ booking }`.
public struct ResourceBookingResponse: Decodable, Sendable, Hashable {
    public let booking: ResourceBookingDTO
}

/// Body for `POST /resources`. Owner fields spliced in by the builder.
public struct CreateResourceRequest: Encodable, Sendable {
    public let name: String
    public var resourceType: String?
    public var photoURL: String?
    public var whoCanBook: String?
    public var maxDurationMin: Int?
    public var bufferMin: Int?
    public var requiresApproval: Bool?
    public var availableHours: JSONValue?

    enum CodingKeys: String, CodingKey {
        case name
        case resourceType = "resource_type"
        case photoURL = "photo_url"
        case whoCanBook = "who_can_book"
        case maxDurationMin = "max_duration_min"
        case bufferMin = "buffer_min"
        case requiresApproval = "requires_approval"
        case availableHours = "available_hours"
    }

    public init(
        name: String,
        resourceType: String? = nil,
        photoURL: String? = nil,
        whoCanBook: String? = nil,
        maxDurationMin: Int? = nil,
        bufferMin: Int? = nil,
        requiresApproval: Bool? = nil,
        availableHours: JSONValue? = nil
    ) {
        self.name = name
        self.resourceType = resourceType
        self.photoURL = photoURL
        self.whoCanBook = whoCanBook
        self.maxDurationMin = maxDurationMin
        self.bufferMin = bufferMin
        self.requiresApproval = requiresApproval
        self.availableHours = availableHours
    }
}

/// Body for `PUT /resources/:rid` — partial; at least one field required.
public struct UpdateResourceRequest: Encodable, Sendable {
    public var name: String?
    public var resourceType: String?
    public var photoURL: String?
    public var whoCanBook: String?
    public var maxDurationMin: Int?
    public var bufferMin: Int?
    public var requiresApproval: Bool?
    public var availableHours: JSONValue?

    enum CodingKeys: String, CodingKey {
        case name
        case resourceType = "resource_type"
        case photoURL = "photo_url"
        case whoCanBook = "who_can_book"
        case maxDurationMin = "max_duration_min"
        case bufferMin = "buffer_min"
        case requiresApproval = "requires_approval"
        case availableHours = "available_hours"
    }

    public init(
        name: String? = nil,
        resourceType: String? = nil,
        photoURL: String? = nil,
        whoCanBook: String? = nil,
        maxDurationMin: Int? = nil,
        bufferMin: Int? = nil,
        requiresApproval: Bool? = nil,
        availableHours: JSONValue? = nil
    ) {
        self.name = name
        self.resourceType = resourceType
        self.photoURL = photoURL
        self.whoCanBook = whoCanBook
        self.maxDurationMin = maxDurationMin
        self.bufferMin = bufferMin
        self.requiresApproval = requiresApproval
        self.availableHours = availableHours
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(name, forKey: .name)
        try c.encodeIfPresent(resourceType, forKey: .resourceType)
        try c.encodeIfPresent(photoURL, forKey: .photoURL)
        try c.encodeIfPresent(whoCanBook, forKey: .whoCanBook)
        try c.encodeIfPresent(maxDurationMin, forKey: .maxDurationMin)
        try c.encodeIfPresent(bufferMin, forKey: .bufferMin)
        try c.encodeIfPresent(requiresApproval, forKey: .requiresApproval)
        try c.encodeIfPresent(availableHours, forKey: .availableHours)
    }
}

/// Body for `POST /resources/:rid/book`. Owner fields spliced in by the builder.
public struct BookResourceRequest: Encodable, Sendable {
    public let startAt: String
    public var durationMin: Int?
    public var name: String?

    enum CodingKeys: String, CodingKey {
        case startAt = "start_at"
        case durationMin = "duration_min"
        case name
    }

    public init(startAt: String, durationMin: Int? = nil, name: String? = nil) {
        self.startAt = startAt
        self.durationMin = durationMin
        self.name = name
    }
}
