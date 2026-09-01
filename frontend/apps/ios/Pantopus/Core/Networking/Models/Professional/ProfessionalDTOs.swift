//
//  ProfessionalDTOs.swift
//  Pantopus
//
//  DTOs for `backend/routes/professional.js`. Field names mirror the
//  `UserProfessionalProfile` row (snake_case) via explicit `CodingKeys`.
//

import Foundation

// MARK: - GET /api/professional/profile/me

/// `{ profile: … | null }`. `profile` is null when the user has not enabled
/// professional mode.
public struct ProfessionalProfileResponse: Decodable, Sendable, Hashable {
    public let profile: ProfessionalProfileDTO?
}

/// A `UserProfessionalProfile` row.
public struct ProfessionalProfileDTO: Decodable, Sendable, Hashable {
    public let headline: String?
    public let bio: String?
    public let categories: [String]?
    public let serviceArea: ServiceArea?
    public let pricingMeta: PricingMeta?
    public let isPublic: Bool?
    public let isActive: Bool?
    public let verificationTier: Int?
    public let verificationStatus: String?

    private enum CodingKeys: String, CodingKey {
        case headline, bio, categories
        case serviceArea = "service_area"
        case pricingMeta = "pricing_meta"
        case isPublic = "is_public"
        case isActive = "is_active"
        case verificationTier = "verification_tier"
        case verificationStatus = "verification_status"
    }

    public struct ServiceArea: Decodable, Sendable, Hashable {
        public let city: String?
        public let state: String?
        /// Joi types this as a plain `number`, so it can arrive as `50` or
        /// `50.0` — decoded wide to keep both shapes decodable. `var` so the
        /// memberwise initializer keeps defaulting it to nil for callers
        /// that only care about city/state.
        public var radiusKm: Double?

        private enum CodingKeys: String, CodingKey {
            case city, state
            case radiusKm = "radius_km"
        }
    }

    public struct PricingMeta: Decodable, Sendable, Hashable {
        public let hourlyRate: Double?
        public let currency: String?

        private enum CodingKeys: String, CodingKey {
            case hourlyRate = "hourly_rate"
            case currency
        }
    }
}

// MARK: - GET /api/professional/verification/status

public struct ProfessionalVerificationStatusResponse: Decodable, Sendable, Hashable {
    public let tier: Int?
    public let status: String?
    public let submittedAt: String?
    public let completedAt: String?

    private enum CodingKeys: String, CodingKey {
        case tier, status
        case submittedAt = "submitted_at"
        case completedAt = "completed_at"
    }
}

// MARK: - POST /api/professional/verification/start

/// Body for `POST /api/professional/verification/start`
/// (`professional.js:310`). `tier` must be 1 or 2 — anything else is a 400
/// (`professional.js:315`). RN sends tier 1 from the profile CTA
/// (`professional.tsx:390`).
public struct ProfessionalVerificationStartRequest: Encodable, Sendable, Hashable {
    public let tier: Int

    public init(tier: Int = 1) {
        self.tier = tier
    }
}

/// `{ message, verification_status }` — the row's new status after the
/// start call (`professional.js:358`).
public struct ProfessionalVerificationStartResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let verificationStatus: String?

    private enum CodingKeys: String, CodingKey {
        case message
        case verificationStatus = "verification_status"
    }
}

// MARK: - Shared request sub-objects

/// `service_area` object accepted by both the create and update schemas
/// (`professional.js:47` / `:69`). `radius_km` is 1…500.
public struct ProfessionalServiceAreaInput: Encodable, Sendable, Hashable {
    public let city: String?
    public let state: String?
    public let radiusKm: Int?

    public init(city: String? = nil, state: String? = nil, radiusKm: Int? = nil) {
        self.city = city
        self.state = state
        self.radiusKm = radiusKm
    }

    /// True when there is nothing worth sending — the server rejects an
    /// empty object less gracefully than an omitted key.
    public var isEmpty: Bool {
        (city?.isEmpty ?? true) && (state?.isEmpty ?? true)
    }

    private enum CodingKeys: String, CodingKey {
        case city, state
        case radiusKm = "radius_km"
    }
}

/// `pricing_meta` object accepted by both schemas (`professional.js:54` /
/// `:76`). Currency is a 3-letter code.
public struct ProfessionalPricingInput: Encodable, Sendable, Hashable {
    public let hourlyRate: Double?
    public let currency: String?

    public init(hourlyRate: Double? = nil, currency: String? = "USD") {
        self.hourlyRate = hourlyRate
        self.currency = currency
    }

    private enum CodingKeys: String, CodingKey {
        case hourlyRate = "hourly_rate"
        case currency
    }
}

// MARK: - POST /api/professional/profile (request)

/// Enable-professional-mode body — `createProfileSchema`
/// (`professional.js:42`). Every field is optional; `is_public` defaults to
/// true server-side. `categories` must be drawn from the server's enum
/// (`professional.js:32`), mirrored by `ProfessionalCategory`.
public struct ProfessionalEnableRequest: Encodable, Sendable, Hashable {
    public let headline: String?
    public let bio: String?
    public let categories: [String]?
    public let serviceArea: ProfessionalServiceAreaInput?
    public let pricingMeta: ProfessionalPricingInput?
    public let isPublic: Bool?

    public init(
        headline: String? = nil,
        bio: String? = nil,
        categories: [String]? = nil,
        serviceArea: ProfessionalServiceAreaInput? = nil,
        pricingMeta: ProfessionalPricingInput? = nil,
        isPublic: Bool? = nil
    ) {
        self.headline = headline
        self.bio = bio
        self.categories = categories
        self.serviceArea = serviceArea
        self.pricingMeta = pricingMeta
        self.isPublic = isPublic
    }

    private enum CodingKeys: String, CodingKey {
        case headline, bio, categories
        case serviceArea = "service_area"
        case pricingMeta = "pricing_meta"
        case isPublic = "is_public"
    }
}

// MARK: - PATCH /api/professional/profile/me (request)

/// Partial update body. All fields optional; nil keys are omitted by the
/// encoder so only edited fields are sent. `is_active: true` is how a
/// soft-disabled profile is switched back on (mirrors RN
/// `professional.tsx:141`).
public struct ProfessionalProfileUpdateRequest: Encodable, Sendable, Hashable {
    public let headline: String?
    public let bio: String?
    public let isPublic: Bool?
    public let isActive: Bool?
    public let categories: [String]?
    public let serviceArea: ProfessionalServiceAreaInput?
    public let pricingMeta: ProfessionalPricingInput?

    public init(
        headline: String? = nil,
        bio: String? = nil,
        isPublic: Bool? = nil,
        isActive: Bool? = nil,
        categories: [String]? = nil,
        serviceArea: ProfessionalServiceAreaInput? = nil,
        pricingMeta: ProfessionalPricingInput? = nil
    ) {
        self.headline = headline
        self.bio = bio
        self.isPublic = isPublic
        self.isActive = isActive
        self.categories = categories
        self.serviceArea = serviceArea
        self.pricingMeta = pricingMeta
    }

    private enum CodingKeys: String, CodingKey {
        case headline, bio, categories
        case isPublic = "is_public"
        case isActive = "is_active"
        case serviceArea = "service_area"
        case pricingMeta = "pricing_meta"
    }
}
