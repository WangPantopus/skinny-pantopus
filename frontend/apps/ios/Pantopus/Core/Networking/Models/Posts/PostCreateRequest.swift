//
//  PostCreateRequest.swift
//  Pantopus
//
//  Request + response payloads for `POST /api/posts`. Route:
//  `backend/routes/posts.js:862`. The schema is defined by
//  `createPostSchema` at `backend/routes/posts.js:196-300` — every
//  optional field below maps to one of its keys.
//

import Foundation

/// `POST /api/posts` body. Fields are intentionally optional so the
/// Pulse compose flow can submit just the keys relevant to the chosen
/// intent without sending nulls the backend may reject.
public struct PostCreateRequest: Encodable, Sendable, Hashable {
    public let content: String
    public let title: String?
    public let postType: String
    public let visibility: String
    public let postAs: String
    public let mediaUrls: [String]?
    /// Location block — `var` (like `refTaskId`) so the compose pipeline
    /// can apply an explicit place tag AFTER `mergeTargetContext` has
    /// full-copied the request.
    public var latitude: Double?
    public var longitude: Double?
    public var locationName: String?
    /// Short address line of an explicitly tagged place.
    public var locationAddress: String?
    /// Geocode provenance for an explicit place tag — always `"mapbox"`.
    public var geocodeProvider: String?
    /// Provider feature kind (`poi` / `place` / …) of the tagged place.
    public var geocodeAccuracy: String?
    /// Mapbox feature id (e.g. `poi.123`) of the tagged place.
    public var geocodePlaceId: String?
    public let homeId: String?
    public let businessId: String?
    public let tags: [String]?
    public let gpsTimestamp: String?
    public let gpsLatitude: Double?
    public let gpsLongitude: Double?
    public let crossPostToConnections: Bool?
    public let showOnProfile: Bool?
    public let profileVisibilityScope: String?
    // Event-specific
    public let eventDate: String?
    public let eventEndDate: String?
    public let eventVenue: String?
    // Safety alert
    public let safetyAlertKind: String?
    public let behaviorDescription: String?
    /// Deal
    public let dealExpiresAt: String?
    // Lost & Found
    public let lostFoundType: String?
    public let contactPref: String?
    public let contactPhone: String?
    /// Recommend / deal business name alias
    public let businessName: String?
    /// Ask category
    public let serviceCategory: String?
    /// Announce / persona audience
    public let audience: String?
    /// v1.2 purpose tag (mirrors postType for sortability)
    public let purpose: String?
    /// "Share this task to the feed" — the gig this post references.
    /// Backend `createPostSchema` key `refTaskId`
    /// (`backend/routes/posts.js:252`), persisted as `ref_task_id`
    /// (`posts.js:1237`) and rendered as a "View task" ref card
    /// (`posts.js:654`).
    public var refTaskId: String?

    public init(
        content: String,
        title: String? = nil,
        postType: String,
        visibility: String,
        postAs: String,
        mediaUrls: [String]? = nil,
        latitude: Double? = nil,
        longitude: Double? = nil,
        locationName: String? = nil,
        locationAddress: String? = nil,
        geocodeProvider: String? = nil,
        geocodeAccuracy: String? = nil,
        geocodePlaceId: String? = nil,
        homeId: String? = nil,
        businessId: String? = nil,
        tags: [String]? = nil,
        gpsTimestamp: String? = nil,
        gpsLatitude: Double? = nil,
        gpsLongitude: Double? = nil,
        crossPostToConnections: Bool? = nil,
        showOnProfile: Bool? = nil,
        profileVisibilityScope: String? = nil,
        eventDate: String? = nil,
        eventEndDate: String? = nil,
        eventVenue: String? = nil,
        safetyAlertKind: String? = nil,
        behaviorDescription: String? = nil,
        dealExpiresAt: String? = nil,
        lostFoundType: String? = nil,
        contactPref: String? = nil,
        contactPhone: String? = nil,
        businessName: String? = nil,
        serviceCategory: String? = nil,
        audience: String? = nil,
        purpose: String? = nil,
        refTaskId: String? = nil
    ) {
        self.content = content
        self.title = title
        self.postType = postType
        self.visibility = visibility
        self.postAs = postAs
        self.mediaUrls = mediaUrls
        self.latitude = latitude
        self.longitude = longitude
        self.locationName = locationName
        self.locationAddress = locationAddress
        self.geocodeProvider = geocodeProvider
        self.geocodeAccuracy = geocodeAccuracy
        self.geocodePlaceId = geocodePlaceId
        self.homeId = homeId
        self.businessId = businessId
        self.tags = tags
        self.gpsTimestamp = gpsTimestamp
        self.gpsLatitude = gpsLatitude
        self.gpsLongitude = gpsLongitude
        self.crossPostToConnections = crossPostToConnections
        self.showOnProfile = showOnProfile
        self.profileVisibilityScope = profileVisibilityScope
        self.eventDate = eventDate
        self.eventEndDate = eventEndDate
        self.eventVenue = eventVenue
        self.safetyAlertKind = safetyAlertKind
        self.behaviorDescription = behaviorDescription
        self.dealExpiresAt = dealExpiresAt
        self.lostFoundType = lostFoundType
        self.contactPref = contactPref
        self.contactPhone = contactPhone
        self.businessName = businessName
        self.serviceCategory = serviceCategory
        self.audience = audience
        self.purpose = purpose
        self.refTaskId = refTaskId
    }

    private enum CodingKeys: String, CodingKey {
        case content, title, postType, visibility, postAs, mediaUrls
        case latitude, longitude
        case locationName, locationAddress
        case geocodeProvider, geocodeAccuracy, geocodePlaceId
        case homeId, businessId
        case tags
        case gpsTimestamp, gpsLatitude, gpsLongitude
        case crossPostToConnections, showOnProfile, profileVisibilityScope
        case eventDate, eventEndDate, eventVenue
        case safetyAlertKind, behaviorDescription
        case dealExpiresAt
        case lostFoundType, contactPref, contactPhone
        case businessName, serviceCategory, audience, purpose
        case refTaskId
    }

    /// Encode dropping `nil` keys so optional fields aren't sent as
    /// `"foo": null` (which `createPostSchema` rejects for some keys).
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(content, forKey: .content)
        try container.encodeIfPresent(title, forKey: .title)
        try container.encode(postType, forKey: .postType)
        try container.encode(visibility, forKey: .visibility)
        try container.encode(postAs, forKey: .postAs)
        try container.encodeIfPresent(mediaUrls, forKey: .mediaUrls)
        try container.encodeIfPresent(latitude, forKey: .latitude)
        try container.encodeIfPresent(longitude, forKey: .longitude)
        try container.encodeIfPresent(locationName, forKey: .locationName)
        try container.encodeIfPresent(locationAddress, forKey: .locationAddress)
        try container.encodeIfPresent(geocodeProvider, forKey: .geocodeProvider)
        try container.encodeIfPresent(geocodeAccuracy, forKey: .geocodeAccuracy)
        try container.encodeIfPresent(geocodePlaceId, forKey: .geocodePlaceId)
        try container.encodeIfPresent(homeId, forKey: .homeId)
        try container.encodeIfPresent(businessId, forKey: .businessId)
        try container.encodeIfPresent(tags, forKey: .tags)
        try container.encodeIfPresent(gpsTimestamp, forKey: .gpsTimestamp)
        try container.encodeIfPresent(gpsLatitude, forKey: .gpsLatitude)
        try container.encodeIfPresent(gpsLongitude, forKey: .gpsLongitude)
        try container.encodeIfPresent(crossPostToConnections, forKey: .crossPostToConnections)
        try container.encodeIfPresent(showOnProfile, forKey: .showOnProfile)
        try container.encodeIfPresent(profileVisibilityScope, forKey: .profileVisibilityScope)
        try container.encodeIfPresent(eventDate, forKey: .eventDate)
        try container.encodeIfPresent(eventEndDate, forKey: .eventEndDate)
        try container.encodeIfPresent(eventVenue, forKey: .eventVenue)
        try container.encodeIfPresent(safetyAlertKind, forKey: .safetyAlertKind)
        try container.encodeIfPresent(behaviorDescription, forKey: .behaviorDescription)
        try container.encodeIfPresent(dealExpiresAt, forKey: .dealExpiresAt)
        try container.encodeIfPresent(lostFoundType, forKey: .lostFoundType)
        try container.encodeIfPresent(contactPref, forKey: .contactPref)
        try container.encodeIfPresent(contactPhone, forKey: .contactPhone)
        try container.encodeIfPresent(businessName, forKey: .businessName)
        try container.encodeIfPresent(serviceCategory, forKey: .serviceCategory)
        try container.encodeIfPresent(audience, forKey: .audience)
        try container.encodeIfPresent(purpose, forKey: .purpose)
        try container.encodeIfPresent(refTaskId, forKey: .refTaskId)
    }
}

/// `POST /api/posts` response envelope — the backend echoes a
/// thin acknowledgement plus the created row. The id may appear as
/// `post_id` (legacy stubs) or nested under `post.id` (live API).
public struct PostCreateResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let postId: String?

    private enum CodingKeys: String, CodingKey {
        case message
        case postId = "post_id"
        case post
    }

    private struct NestedPostId: Decodable {
        let id: String
    }

    public init(message: String? = nil, postId: String? = nil) {
        self.message = message
        self.postId = postId
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        message = try container.decodeIfPresent(String.self, forKey: .message)
        if let topLevel = try container.decodeIfPresent(String.self, forKey: .postId) {
            postId = topLevel
        } else if let nested = try? container.decode(NestedPostId.self, forKey: .post) {
            postId = nested.id
        } else {
            postId = nil
        }
    }
}
