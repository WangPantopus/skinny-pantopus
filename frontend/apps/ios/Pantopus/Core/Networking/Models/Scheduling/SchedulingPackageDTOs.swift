//
//  SchedulingPackageDTOs.swift
//  Pantopus
//
//  DTOs for session packages — owner CRUD (`/api/scheduling/packages*`),
//  customer buy (`…/packages/:id/buy`), and `my-packages` credits. Priced
//  behaviour sits behind `SchedulingFeatureFlags.paidEnabled`. See
//  `reference/calendarly-backend-api.md`.
//

import Foundation

/// A session package offered by an owner.
public struct SchedulingPackageDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let ownerType: String?
    public let ownerId: String?
    public let name: String
    public let sessionsCount: Int?
    public let priceCents: Int?
    public let currency: String?
    public let eventTypeId: String?
    public let isActive: Bool?
    public let createdAt: String?
    /// Number of credits issued (one per purchase). Surfaced by `GET /packages`
    /// only; `nil` on create/update responses, which don't embed the count.
    public let soldCount: Int?

    enum CodingKeys: String, CodingKey {
        case id
        case ownerType = "owner_type"
        case ownerId = "owner_id"
        case name
        case sessionsCount = "sessions_count"
        case priceCents = "price_cents"
        case currency
        case eventTypeId = "event_type_id"
        case isActive = "is_active"
        case createdAt = "created_at"
        case soldCount = "sold_count"
    }
}

/// Nested package metadata returned inside a credit (`GET /my-packages`).
public struct PackageMetaDTO: Decodable, Sendable, Hashable {
    public let name: String?
    public let sessionsCount: Int?
    public let ownerType: String?
    public let ownerId: String?
    public let eventTypeId: String?

    enum CodingKeys: String, CodingKey {
        case name
        case sessionsCount = "sessions_count"
        case ownerType = "owner_type"
        case ownerId = "owner_id"
        case eventTypeId = "event_type_id"
    }
}

/// A purchased package credit owned by a customer.
public struct PackageCreditDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let buyerUserId: String?
    public let packageId: String?
    public let remainingSessions: Int?
    public let purchasedAt: String?
    /// Nested package metadata, keyed `BookingPackage` in the response.
    public let bookingPackage: PackageMetaDTO?

    enum CodingKeys: String, CodingKey {
        case id
        case buyerUserId = "buyer_user_id"
        case packageId = "package_id"
        case remainingSessions = "remaining_sessions"
        case purchasedAt = "purchased_at"
        case bookingPackage = "BookingPackage"
    }
}

/// `GET /packages` → `{ packages }`.
public struct PackagesResponse: Decodable, Sendable, Hashable {
    public let packages: [SchedulingPackageDTO]
}

/// `POST /packages`, `PUT /packages/:id` → `{ package }`.
public struct PackageResponse: Decodable, Sendable, Hashable {
    public let package: SchedulingPackageDTO
}

/// `GET /my-packages` → `{ credits }`.
public struct MyPackagesResponse: Decodable, Sendable, Hashable {
    public let credits: [PackageCreditDTO]
}

/// `POST /packages/:id/buy` → 201 `{ credit, clientSecret }`.
public struct BuyPackageResponse: Decodable, Sendable, Hashable {
    public let credit: PackageCreditDTO
    /// Stripe payment-intent secret when `price_cents > 0`.
    public let clientSecret: String?
}

/// Body for `POST /packages`. Owner fields spliced in by the builder.
public struct SchedulingCreatePackageRequest: Encodable, Sendable {
    public let name: String
    public let sessionsCount: Int
    public var priceCents: Int?
    public var currency: String?
    public var eventTypeId: String?
    public var isActive: Bool?

    enum CodingKeys: String, CodingKey {
        case name
        case sessionsCount = "sessions_count"
        case priceCents = "price_cents"
        case currency
        case eventTypeId = "event_type_id"
        case isActive = "is_active"
    }

    public init(
        name: String,
        sessionsCount: Int,
        priceCents: Int? = nil,
        currency: String? = nil,
        eventTypeId: String? = nil,
        isActive: Bool? = nil
    ) {
        self.name = name
        self.sessionsCount = sessionsCount
        self.priceCents = priceCents
        self.currency = currency
        self.eventTypeId = eventTypeId
        self.isActive = isActive
    }
}

/// Body for `PUT /packages/:id` — partial; at least one field required.
public struct SchedulingUpdatePackageRequest: Encodable, Sendable {
    public var name: String?
    public var sessionsCount: Int?
    public var priceCents: Int?
    public var currency: String?
    public var eventTypeId: String?
    public var isActive: Bool?

    enum CodingKeys: String, CodingKey {
        case name
        case sessionsCount = "sessions_count"
        case priceCents = "price_cents"
        case currency
        case eventTypeId = "event_type_id"
        case isActive = "is_active"
    }

    public init(
        name: String? = nil,
        sessionsCount: Int? = nil,
        priceCents: Int? = nil,
        currency: String? = nil,
        eventTypeId: String? = nil,
        isActive: Bool? = nil
    ) {
        self.name = name
        self.sessionsCount = sessionsCount
        self.priceCents = priceCents
        self.currency = currency
        self.eventTypeId = eventTypeId
        self.isActive = isActive
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(name, forKey: .name)
        try c.encodeIfPresent(sessionsCount, forKey: .sessionsCount)
        try c.encodeIfPresent(priceCents, forKey: .priceCents)
        try c.encodeIfPresent(currency, forKey: .currency)
        try c.encodeIfPresent(eventTypeId, forKey: .eventTypeId)
        try c.encodeIfPresent(isActive, forKey: .isActive)
    }
}
