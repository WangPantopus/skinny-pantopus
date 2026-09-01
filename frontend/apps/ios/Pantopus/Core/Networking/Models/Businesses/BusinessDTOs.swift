// swiftlint:disable file_length
//
//  BusinessDTOs.swift
//  Pantopus
//
//  Decoder shapes for `/api/businesses/my-businesses`. The response is a
//  list of `BusinessMembership` rows — each is a (seat + business user +
//  optional business profile) join. Route:
//  `backend/routes/businesses.js:682`.
//

import Foundation

/// Lightweight business "user" projection emitted alongside every
/// membership row. The backend joins `User` (account_type='business')
/// plus `city, state` for the locality body.
public struct BusinessUserDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let username: String?
    public let name: String?
    public let email: String?
    public let profilePictureURL: String?
    public let accountType: String?
    public let city: String?
    public let state: String?
    /// Trigger-maintained average star rating (`User.average_rating`).
    public let averageRating: Double?
    /// Trigger-maintained review tally (`User.review_count`).
    public let reviewCount: Int?

    private enum CodingKeys: String, CodingKey {
        case id, username, name, email
        case profilePictureURL = "profile_picture_url"
        case accountType = "account_type"
        case city, state
        case averageRating = "average_rating"
        case reviewCount = "review_count"
    }
}

/// Optional `BusinessProfile` join — present when the business has
/// onboarded a profile (categories, logo, description). Always nil for
/// freshly-created businesses with no profile yet.
public struct BusinessProfileDTO: Decodable, Sendable, Hashable {
    public let businessUserId: String?
    public let businessType: String?
    public let categories: [String]?
    public let isPublished: Bool?
    public let logoFileId: String?
    public let bannerFileId: String?
    public let description: String?
    /// `bi0_unverified` … `bi4_authority`. Anything above `bi0_unverified`
    /// earns the violet verified mark; `bi0_unverified` reads as pending.
    public let identityVerificationTier: String?

    private enum CodingKeys: String, CodingKey {
        case businessUserId = "business_user_id"
        case businessType = "business_type"
        case categories
        case isPublished = "is_published"
        case logoFileId = "logo_file_id"
        case bannerFileId = "banner_file_id"
        case description
        case identityVerificationTier = "identity_verification_tier"
    }
}

/// Per-business stats band signals — `stats` block on each membership row.
public struct BusinessStatsDTO: Decodable, Sendable, Hashable {
    /// The business's own unread, active conversations.
    public let openChats: Int
    /// Incoming `BusinessBooking` rows created in the trailing 7 days.
    public let bookingsThisWeek: Int

    private enum CodingKeys: String, CodingKey {
        case openChats = "open_chats"
        case bookingsThisWeek = "bookings_this_week"
    }

    public init(openChats: Int, bookingsThisWeek: Int) {
        self.openChats = openChats
        self.bookingsThisWeek = bookingsThisWeek
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        openChats = try c.decodeIfPresent(Int.self, forKey: .openChats) ?? 0
        bookingsThisWeek = try c.decodeIfPresent(Int.self, forKey: .bookingsThisWeek) ?? 0
    }
}

/// One member chip in the team stack. `initials` is always present; `name`
/// and `avatarFileId` are best-effort.
public struct BusinessTeamChipDTO: Decodable, Sendable, Hashable, Identifiable {
    public let name: String?
    public let initials: String?
    public let avatarFileId: String?

    /// Stable-enough id for ForEach (initials + name).
    public var id: String {
        "\(initials ?? "?")-\(name ?? "")"
    }

    private enum CodingKeys: String, CodingKey {
        case name, initials
        case avatarFileId = "avatar_file_id"
    }
}

/// Team summary — `team` block on each membership row.
public struct BusinessTeamSummaryDTO: Decodable, Sendable, Hashable {
    /// Total active seats at the business.
    public let count: Int
    /// Up to 3 member chips for the stacked-avatar strip.
    public let members: [BusinessTeamChipDTO]

    public init(count: Int, members: [BusinessTeamChipDTO]) {
        self.count = count
        self.members = members
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        count = try c.decodeIfPresent(Int.self, forKey: .count) ?? 0
        members = try c.decodeIfPresent([BusinessTeamChipDTO].self, forKey: .members) ?? []
    }

    private enum CodingKeys: String, CodingKey {
        case count, members
    }
}

/// One row from `/api/businesses/my-businesses` — the membership +
/// business projection used by My businesses.
public struct BusinessMembership: Decodable, Sendable, Hashable, Identifiable {
    /// Seat id (or BusinessTeam id for legacy rows).
    public let id: String
    /// Role base: `owner / admin / manager / staff / viewer`.
    public let roleBase: String?
    /// Free-form display title (e.g. "Founder", "Manager"). Optional.
    public let title: String?
    /// When the seat was joined (legacy only — seats return `nil`).
    public let joinedAt: String?
    /// User id of the business — same as `business.id`.
    public let businessUserId: String
    /// The business profile shell — name, locality, avatar.
    public let business: BusinessUserDTO
    /// Optional rich profile (categories, description, is_published).
    public let profile: BusinessProfileDTO?
    /// Stats band: open chats · bookings this week. Defaults to zeros.
    public let stats: BusinessStatsDTO?
    /// Team summary: count + up to 3 member chips. Defaults to empty.
    public let team: BusinessTeamSummaryDTO?

    private enum CodingKeys: String, CodingKey {
        case id
        case roleBase = "role_base"
        case title
        case joinedAt = "joined_at"
        case businessUserId = "business_user_id"
        case business
        case profile
        case stats
        case team
    }
}

/// `GET /api/businesses/my-businesses` envelope — route
/// `backend/routes/businesses.js:682`.
public struct MyBusinessesResponse: Decodable, Sendable {
    public let businesses: [BusinessMembership]
}

// MARK: - /:businessId detail (P1.6 — Business Profile screen)

/// Full Business "User" row returned by `GET /api/businesses/:businessId`.
/// The backend `select('*')` projects every column; we decode only the
/// fields the Business Profile screen renders.
public struct BusinessUserDetailDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let username: String?
    public let name: String?
    public let email: String?
    public let bio: String?
    public let tagline: String?
    public let profilePictureURL: String?
    public let coverPhotoURL: String?
    public let accountType: String?
    public let city: String?
    public let state: String?
    public let verified: Bool?
    public let averageRating: Double?
    public let reviewCount: Int?
    public let followersCount: Int?
    public let gigsCompleted: Int?
    public let createdAt: String?

    private enum CodingKeys: String, CodingKey {
        case id, username, name, email, bio, tagline
        case profilePictureURL = "profile_picture_url"
        case coverPhotoURL = "cover_photo_url"
        case accountType = "account_type"
        case city, state, verified
        case averageRating = "average_rating"
        case reviewCount = "review_count"
        case followersCount = "followers_count"
        case gigsCompleted = "gigs_completed"
        case createdAt = "created_at"
    }
}

/// Geo point projection — `[longitude, latitude]` or `{lat, lng}` shape
/// (the backend normalises PostGIS into `{lat, lng}` via
/// `parsePostGISPoint`).
public struct BusinessGeoPoint: Decodable, Sendable, Hashable {
    public let lat: Double
    public let lng: Double

    private enum CodingKeys: String, CodingKey {
        case lat, lng
    }
}

/// `BusinessLocation` row.
public struct BusinessLocationDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String?
    public let isPrimary: Bool?
    public let address: String?
    public let address2: String?
    public let city: String?
    public let state: String?
    public let zipcode: String?
    public let country: String?
    public let location: BusinessGeoPoint?
    public let phone: String?
    public let email: String?
    public let timezone: String?

    private enum CodingKeys: String, CodingKey {
        case id, label
        case isPrimary = "is_primary"
        case address, address2, city, state, zipcode, country
        case location, phone, email, timezone
    }
}

/// `BusinessProfile.service_area` — backend stores jsonb that may be a legacy
/// display string or a structured object (city/state, radius, center coords).
public struct BusinessServiceAreaDTO: Decodable, Sendable, Hashable {
    public let city: String?
    public let state: String?
    public let radiusMiles: Double?
    public let radiusKm: Double?
    public let centerLat: Double?
    public let centerLng: Double?
    private let legacyDisplayText: String?

    public var displayText: String? {
        if let legacyDisplayText, !legacyDisplayText.isEmpty { return legacyDisplayText }
        var segments: [String] = []
        let locality = [city, state]
            .compactMap { value -> String? in
                guard let value, !value.isEmpty else { return nil }
                return value
            }
            .joined(separator: ", ")
        if !locality.isEmpty { segments.append(locality) }
        if let radiusMiles {
            let formatted = radiusMiles.truncatingRemainder(dividingBy: 1) == 0
                ? String(format: "%.0f mi", radiusMiles)
                : String(format: "%.1f mi", radiusMiles)
            segments.append("within \(formatted)")
        } else if let radiusKm {
            let formatted = radiusKm.truncatingRemainder(dividingBy: 1) == 0
                ? String(format: "%.0f km", radiusKm)
                : String(format: "%.1f km", radiusKm)
            segments.append("within \(formatted)")
        }
        guard !segments.isEmpty else { return nil }
        return segments.joined(separator: " — ")
    }

    private enum CodingKeys: String, CodingKey {
        case city, state
        case radiusMiles = "radius_miles"
        case radiusKm = "radius_km"
        case centerLat = "center_lat"
        case centerLng = "center_lng"
    }

    public init(from decoder: Decoder) throws {
        if let single = try? decoder.singleValueContainer(),
           let text = try? single.decode(String.self) {
            legacyDisplayText = text.isEmpty ? nil : text
            city = nil
            state = nil
            radiusMiles = nil
            radiusKm = nil
            centerLat = nil
            centerLng = nil
            return
        }
        let container = try decoder.container(keyedBy: CodingKeys.self)
        city = try container.decodeIfPresent(String.self, forKey: .city)
        state = try container.decodeIfPresent(String.self, forKey: .state)
        radiusMiles = Self.decodeFlexibleDouble(from: container, forKey: .radiusMiles)
        radiusKm = Self.decodeFlexibleDouble(from: container, forKey: .radiusKm)
        centerLat = Self.decodeFlexibleDouble(from: container, forKey: .centerLat)
        centerLng = Self.decodeFlexibleDouble(from: container, forKey: .centerLng)
        legacyDisplayText = nil
    }

    private static func decodeFlexibleDouble(
        from container: KeyedDecodingContainer<CodingKeys>,
        forKey key: CodingKeys
    ) -> Double? {
        if let value = try? container.decode(Double.self, forKey: key) { return value }
        if let value = try? container.decode(Int.self, forKey: key) { return Double(value) }
        return nil
    }
}

/// Full `BusinessProfile` row returned by `GET /api/businesses/:businessId`.
/// `select('*')` on the backend, but the iOS screen only decodes the
/// fields it renders.
public struct BusinessProfileDetailDTO: Decodable, Sendable, Hashable {
    public let businessUserId: String?
    public let businessType: String?
    public let categories: [String]?
    public let description: String?
    public let logoFileId: String?
    public let bannerFileId: String?
    public let publicEmail: String?
    public let publicPhone: String?
    public let website: String?
    public let foundedYear: Int?
    public let employeeCount: String?
    public let serviceArea: BusinessServiceAreaDTO?
    public let foundingBadge: Bool?
    public let isPublished: Bool?
    public let publishedAt: String?
    public let verificationStatus: String?
    public let primaryLocation: BusinessLocationDTO?
    /// Free-form profile attributes (e.g. `price_level`).
    public let attributes: [String: JSONValue]?
    /// Social / booking links keyed by network name. Untyped for the same
    /// reason as `attributes` — `social_links` is user-writable jsonb, so a
    /// null or non-string member must not fail the whole decode. Callers
    /// coerce with `EditBusinessPageMapper.stringMap`.
    public let socialLinks: [String: JSONValue]?

    private enum CodingKeys: String, CodingKey {
        case businessUserId = "business_user_id"
        case businessType = "business_type"
        case categories, description
        case logoFileId = "logo_file_id"
        case bannerFileId = "banner_file_id"
        case publicEmail = "public_email"
        case publicPhone = "public_phone"
        case website
        case foundedYear = "founded_year"
        case employeeCount = "employee_count"
        case serviceArea = "service_area"
        case foundingBadge = "founding_badge"
        case isPublished = "is_published"
        case publishedAt = "published_at"
        case verificationStatus = "verification_status"
        case primaryLocation = "primary_location"
        case attributes
        case socialLinks = "social_links"
    }
}

/// `access` sub-object on the detail response — only owner/staff see
/// `isOwner: true`. Surfaced through to the VM so the profile screen
/// could later swap the action footer for an "Edit" CTA, but P1.6 only
/// uses it to suppress the "Save" affordance for self-views.
public struct BusinessAccessDTO: Decodable, Sendable, Hashable {
    public let hasAccess: Bool
    public let isOwner: Bool
    public let roleBase: String?

    private enum CodingKeys: String, CodingKey {
        case hasAccess
        case isOwner
        case roleBase = "role_base"
    }
}

/// `GET /api/businesses/:businessId` response envelope — route
/// `backend/routes/businesses.js:912`.
public struct BusinessDetailResponse: Decodable, Sendable, Hashable {
    public let business: BusinessUserDetailDTO
    public let profile: BusinessProfileDetailDTO?
    public let locations: [BusinessLocationDTO]
    public let access: BusinessAccessDTO?

    private enum CodingKeys: String, CodingKey {
        case business, profile, locations, access
    }
}

// MARK: - /public/:username (used for hours + catalog)

/// One `BusinessHours` row returned in the `/public` payload. `day_of_week`
/// is `0..6` (Sunday=0). Closed days have `is_closed = true` and `nil`
/// open/close strings.
public struct BusinessHoursDTO: Decodable, Sendable, Hashable, Identifiable {
    public let rowId: String?
    public let locationId: String?
    public let dayOfWeek: Int
    public let openTime: String?
    public let closeTime: String?
    public let isClosed: Bool?

    /// Identifiable conformance with a stable id even when the backend
    /// row id is missing.
    public var id: String {
        rowId ?? "\(locationId ?? "")-\(dayOfWeek)"
    }

    private enum CodingKeys: String, CodingKey {
        case rowId = "id"
        case locationId = "location_id"
        case dayOfWeek = "day_of_week"
        case openTime = "open_time"
        case closeTime = "close_time"
        case isClosed = "is_closed"
    }
}

/// `BusinessCatalogItem` row. Used by the Services tab. Donation /
/// product items pass through too — the renderer just shows the kind
/// label and the price (or "Variable" when prices aren't set).
public struct BusinessCatalogItemDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String
    public let description: String?
    public let kind: String?
    public let priceCents: Int?
    public let priceMaxCents: Int?
    public let priceUnit: String?
    public let currency: String?
    public let imageURL: String?
    public let isFeatured: Bool?

    private enum CodingKeys: String, CodingKey {
        case id, name, description, kind
        case priceCents = "price_cents"
        case priceMaxCents = "price_max_cents"
        case priceUnit = "price_unit"
        case currency
        case imageURL = "image_url"
        case isFeatured = "is_featured"
    }
}

/// `GET /api/businesses/:businessId/catalog/items` envelope — the
/// owner/staff catalog read. Route `backend/routes/businesses.js:2386`.
public struct BusinessCatalogItemsResponse: Decodable, Sendable, Hashable {
    public let items: [BusinessCatalogItemDTO]

    private enum CodingKeys: String, CodingKey {
        case items
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        items = try c.decodeIfPresent([BusinessCatalogItemDTO].self, forKey: .items) ?? []
    }
}

/// `GET /api/businesses/public/:username` response (subset). Only the
/// fields the Business Profile screen reads are decoded; the response
/// is far larger (pages, blocks, founding slot, …).
/// Route `backend/routes/businesses.js:3277`.
public struct BusinessPublicResponse: Decodable, Sendable, Hashable {
    public let hours: [BusinessHoursDTO]
    public let catalog: [BusinessCatalogItemDTO]

    private enum CodingKeys: String, CodingKey {
        case hours, catalog
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        hours = try c.decodeIfPresent([BusinessHoursDTO].self, forKey: .hours) ?? []
        catalog = try c.decodeIfPresent([BusinessCatalogItemDTO].self, forKey: .catalog) ?? []
    }
}

// MARK: - /:businessId/dashboard (P1-C — owner dashboard)

/// One onboarding-checklist row from the owner dashboard. Drives the
/// profile-strength card's completion list (`label` + `done`).
public struct BusinessOnboardingItemDTO: Decodable, Sendable, Hashable, Identifiable {
    public let key: String
    public let done: Bool
    public let label: String

    public var id: String {
        key
    }
}

/// The `onboarding` block: the checklist plus its completed / total tallies.
public struct BusinessOnboardingDTO: Decodable, Sendable, Hashable {
    public let checklist: [BusinessOnboardingItemDTO]
    public let completedCount: Int
    public let totalCount: Int

    private enum CodingKeys: String, CodingKey {
        case checklist
        case completedCount = "completed_count"
        case totalCount = "total_count"
    }
}

/// Subset of the `profile` block the owner dashboard reads (publish state +
/// edit recency). The full row is far larger; we only decode what the
/// owner chrome needs (the public render comes from the detail fetch).
public struct BusinessDashboardProfileDTO: Decodable, Sendable, Hashable {
    public let isPublished: Bool?
    public let updatedAt: String?

    private enum CodingKeys: String, CodingKey {
        case isPublished = "is_published"
        case updatedAt = "updated_at"
    }
}

/// `GET /api/businesses/:businessId/dashboard` response (subset). The
/// owner-scoped fetch: publish state, edit recency, and the onboarding
/// checklist that drives the profile-strength card. Route
/// `backend/routes/businesses.js:979`.
public struct BusinessDashboardResponse: Decodable, Sendable, Hashable {
    public let profile: BusinessDashboardProfileDTO?
    public let onboarding: BusinessOnboardingDTO?
    public let access: BusinessAccessDTO?

    private enum CodingKeys: String, CodingKey {
        case profile, onboarding, access
    }
}

// MARK: - /:businessId/insights (P1-C — owner dashboard tiles)

/// `views` block — total + week-over-week trend percentage.
public struct BusinessInsightsViewsDTO: Decodable, Sendable, Hashable {
    public let total: Int
    public let trend: Int
}

/// `followers` block — running total, new in-period, and trend.
public struct BusinessInsightsFollowersDTO: Decodable, Sendable, Hashable {
    public let total: Int
    public let new: Int
    public let trend: Int
}

/// `reviews` block — in-period count, trend, and the period average.
public struct BusinessInsightsReviewsDTO: Decodable, Sendable, Hashable {
    public let count: Int
    public let trend: Int
    public let averageRating: Double?

    private enum CodingKeys: String, CodingKey {
        case count, trend
        case averageRating = "average_rating"
    }
}

/// `GET /api/businesses/:businessId/insights` response (subset). Drives the
/// owner dashboard's "This week" insight tiles. Route
/// `backend/routes/businesses.js:3915`.
public struct BusinessInsightsResponse: Decodable, Sendable, Hashable {
    public let views: BusinessInsightsViewsDTO
    public let followers: BusinessInsightsFollowersDTO
    public let reviews: BusinessInsightsReviewsDTO
}

// MARK: - /:businessId/reviews (P1-C — owner reviews + reply)

/// One enriched `Review` row from the owner reviews endpoint. `comment` is
/// the review body; `ownerResponse` is the business's published reply (nil
/// → the owner can still reply). Route `backend/routes/businesses.js:3441`.
public struct BusinessOwnerReviewDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let rating: Int
    public let comment: String?
    public let createdAt: String?
    public let ownerResponse: String?
    public let reviewerName: String?
    public let reviewerAvatar: String?
    public let gigTitle: String?

    private enum CodingKeys: String, CodingKey {
        case id, rating, comment
        case createdAt = "created_at"
        case ownerResponse = "owner_response"
        case reviewerName = "reviewer_name"
        case reviewerAvatar = "reviewer_avatar"
        case gigTitle = "gig_title"
    }
}

/// `GET /api/businesses/:businessId/reviews` response (subset).
public struct BusinessOwnerReviewsResponse: Decodable, Sendable, Hashable {
    public let reviews: [BusinessOwnerReviewDTO]
    public let total: Int?
}

/// `POST /api/businesses/:businessId/follow` response.
public struct BusinessFollowResponse: Decodable, Sendable, Hashable {
    public let following: Bool
}

/// Body for `POST /api/businesses/:businessId/inbox/start`.
/// Route `backend/routes/businesses.js:3939`.
public struct StartBusinessInquiryBody: Encodable, Sendable {
    public let subject: String?

    public init(subject: String? = nil) {
        self.subject = subject
    }
}

/// Response from `POST /api/businesses/:businessId/inbox/start`.
/// Backend returns camelCase (`roomId`, `existing`).
public struct StartBusinessInquiryResponse: Decodable, Sendable, Hashable {
    public let roomId: String
    public let existing: Bool?
}

/// `GET /api/businesses/:businessId/locations` response.
/// Route `backend/routes/businesses.js:1742`.
public struct BusinessLocationsResponse: Decodable, Sendable, Hashable {
    public let locations: [BusinessLocationDTO]
}

// MARK: - Create business wizard (check-username + create-full)

/// `GET /api/businesses/check-username` response.
/// Route `backend/routes/businesses.js:358`.
public struct UsernameAvailabilityDTO: Decodable, Sendable, Hashable {
    public let available: Bool
    /// `reserved` | `taken` | `invalid` | `error` when unavailable.
    public let reason: String?
}

/// Optional location block for `POST /api/businesses/create-full`.
/// Route `backend/routes/businesses.js:554`.
public struct CreateBusinessLocationPayload: Encodable, Sendable, Hashable {
    public let address: String
    public let city: String
    public let state: String?
    public let zipcode: String?
    public let country: String

    public init(
        address: String,
        city: String,
        state: String? = nil,
        zipcode: String? = nil,
        country: String = "US"
    ) {
        self.address = address
        self.city = city
        self.state = state
        self.zipcode = zipcode
        self.country = country
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(address, forKey: .address)
        try c.encode(city, forKey: .city)
        try c.encodeIfPresent(state, forKey: .state)
        try c.encodeIfPresent(zipcode, forKey: .zipcode)
        try c.encode(country, forKey: .country)
    }

    private enum CodingKeys: String, CodingKey {
        case address, city, state, zipcode, country
    }
}

/// One hours row for `POST /api/businesses/create-full`.
/// Route `backend/routes/businesses.js:554`.
public struct CreateBusinessHoursPayload: Encodable, Sendable, Hashable {
    public let dayOfWeek: Int
    public let openTime: String?
    public let closeTime: String?
    public let isClosed: Bool

    public init(dayOfWeek: Int, openTime: String?, closeTime: String?, isClosed: Bool) {
        self.dayOfWeek = dayOfWeek
        self.openTime = openTime
        self.closeTime = closeTime
        self.isClosed = isClosed
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(dayOfWeek, forKey: .dayOfWeek)
        try c.encodeIfPresent(openTime, forKey: .openTime)
        try c.encodeIfPresent(closeTime, forKey: .closeTime)
        try c.encode(isClosed, forKey: .isClosed)
    }

    private enum CodingKeys: String, CodingKey {
        case dayOfWeek = "day_of_week"
        case openTime = "open_time"
        case closeTime = "close_time"
        case isClosed = "is_closed"
    }
}

/// Body for `POST /api/businesses/create-full`.
/// Route `backend/routes/businesses.js:554`.
public struct CreateBusinessFullRequest: Encodable, Sendable, Hashable {
    public let name: String
    public let username: String
    public let email: String
    public let businessType: String?
    public let categories: [String]?
    public let description: String?
    public let location: CreateBusinessLocationPayload?
    public let hours: [CreateBusinessHoursPayload]?

    public init(
        name: String,
        username: String,
        email: String,
        businessType: String? = nil,
        categories: [String]? = nil,
        description: String? = nil,
        location: CreateBusinessLocationPayload? = nil,
        hours: [CreateBusinessHoursPayload]? = nil
    ) {
        self.name = name
        self.username = username
        self.email = email
        self.businessType = businessType
        self.categories = categories
        self.description = description
        self.location = location
        self.hours = hours
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(name, forKey: .name)
        try c.encode(username, forKey: .username)
        try c.encode(email, forKey: .email)
        try c.encodeIfPresent(businessType, forKey: .businessType)
        try c.encodeIfPresent(categories, forKey: .categories)
        try c.encodeIfPresent(description, forKey: .description)
        try c.encodeIfPresent(location, forKey: .location)
        try c.encodeIfPresent(hours, forKey: .hours)
    }

    private enum CodingKeys: String, CodingKey {
        case name, username, email, categories, description, location, hours
        case businessType = "business_type"
    }
}

/// `POST /api/businesses/create-full` response.
/// Route `backend/routes/businesses.js:554`.
public struct CreateBusinessFullResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let business: BusinessUserDTO
    public let locationId: String?

    private enum CodingKeys: String, CodingKey {
        case message, business
        case locationId = "location_id"
    }
}

// MARK: - Edit business page mutations (A13.10)

/// `PATCH /api/businesses/:businessId` body — `updateBusinessSchema`
/// (`backend/routes/businesses.js:124`). Only non-nil keys are encoded.
public struct UpdateBusinessRequest: Encodable, Sendable {
    public var name: String?
    public var tagline: String?
    public var description: String?
    public var categories: [String]?
    public var publicEmail: String?
    public var publicPhone: String?
    public var website: String?
    public var socialLinks: [String: String]?
    public var attributes: [String: JSONValue]?
    public var isPublished: Bool?

    public init(
        name: String? = nil,
        tagline: String? = nil,
        description: String? = nil,
        categories: [String]? = nil,
        publicEmail: String? = nil,
        publicPhone: String? = nil,
        website: String? = nil,
        socialLinks: [String: String]? = nil,
        attributes: [String: JSONValue]? = nil,
        isPublished: Bool? = nil
    ) {
        self.name = name
        self.tagline = tagline
        self.description = description
        self.categories = categories
        self.publicEmail = publicEmail
        self.publicPhone = publicPhone
        self.website = website
        self.socialLinks = socialLinks
        self.attributes = attributes
        self.isPublished = isPublished
    }

    private enum CodingKeys: String, CodingKey {
        case name, tagline, description, categories, website, attributes
        case publicEmail = "public_email"
        case publicPhone = "public_phone"
        case socialLinks = "social_links"
        case isPublished = "is_published"
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(name, forKey: .name)
        try container.encodeIfPresent(tagline, forKey: .tagline)
        try container.encodeIfPresent(description, forKey: .description)
        try container.encodeIfPresent(categories, forKey: .categories)
        try container.encodeIfPresent(publicEmail, forKey: .publicEmail)
        try container.encodeIfPresent(publicPhone, forKey: .publicPhone)
        try container.encodeIfPresent(website, forKey: .website)
        try container.encodeIfPresent(socialLinks, forKey: .socialLinks)
        try container.encodeIfPresent(attributes, forKey: .attributes)
        try container.encodeIfPresent(isPublished, forKey: .isPublished)
    }
}

/// Generic `{ message }` envelope from publish / update success paths.
public struct BusinessMutationMessageResponse: Decodable, Sendable, Hashable {
    public let message: String?
}

/// One day row for `PUT …/hours` — `weeklyHoursSchema`
/// (`backend/routes/businesses.js:207`).
public struct SetBusinessHoursDayRequest: Encodable, Sendable, Hashable {
    public let dayOfWeek: Int
    public let openTime: String?
    public let closeTime: String?
    public let isClosed: Bool

    public init(dayOfWeek: Int, openTime: String?, closeTime: String?, isClosed: Bool) {
        self.dayOfWeek = dayOfWeek
        self.openTime = openTime
        self.closeTime = closeTime
        self.isClosed = isClosed
    }

    private enum CodingKeys: String, CodingKey {
        case dayOfWeek = "day_of_week"
        case openTime = "open_time"
        case closeTime = "close_time"
        case isClosed = "is_closed"
    }
}

/// Body for `PUT /api/businesses/:businessId/locations/:locationId/hours`.
public struct SetBusinessHoursRequest: Encodable, Sendable {
    public let hours: [SetBusinessHoursDayRequest]

    public init(hours: [SetBusinessHoursDayRequest]) {
        self.hours = hours
    }
}

/// `GET/PUT …/hours` response envelope.
public struct BusinessLocationHoursResponse: Decodable, Sendable, Hashable {
    public let hours: [BusinessHoursDTO]
}

/// `PATCH /api/businesses/:businessId/locations/:locationId` body —
/// `updateLocationSchema` (`backend/routes/businesses.js:190`).
public struct UpdateBusinessLocationRequest: Encodable, Sendable {
    public var address: String?
    public var city: String?
    public var state: String?
    public var zipcode: String?

    public init(
        address: String? = nil,
        city: String? = nil,
        state: String? = nil,
        zipcode: String? = nil
    ) {
        self.address = address
        self.city = city
        self.state = state
        self.zipcode = zipcode
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(address, forKey: .address)
        try container.encodeIfPresent(city, forKey: .city)
        try container.encodeIfPresent(state, forKey: .state)
        try container.encodeIfPresent(zipcode, forKey: .zipcode)
    }

    private enum CodingKeys: String, CodingKey {
        case address, city, state, zipcode
    }
}

// MARK: - Business media upload (A12.10 Create Business — logo)

/// Which slot a business-media upload fills. Matches the route's
/// `type` query param (`backend/routes/upload.js:1683`).
public enum BusinessMediaKind: String, Sendable, Hashable {
    case logo
    case banner
}

/// `POST /api/upload/business-media/:businessId?type=logo|banner` response
/// (`backend/routes/upload.js:1797`). The server has already written the
/// URL onto the business profile, so callers only need the echoed `url`
/// to render the freshly-uploaded image.
public struct BusinessMediaUploadResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let url: String
    public let key: String?
}
