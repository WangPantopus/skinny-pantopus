//
//  MatchedBusinessDTOs.swift
//  Pantopus
//
//  `GET /api/posts/:id/matched-businesses` — the "Nearby Providers" card on
//  Pulse post detail. Route `backend/routes/posts.js:2550`.
//

import Foundation

/// Response envelope. `cached` is true when the payload came from the
/// pre-computed `matched_businesses_cache` snapshot; `expired` is set when
/// the post is older than the 30-day suppression window.
public struct MatchedBusinessesResponse: Decodable, Sendable, Hashable {
    public let businesses: [MatchedBusinessDTO]
    public let cached: Bool?
    public let expired: Bool?
}

/// One organically matched local business.
///
/// The live (`cached=false`) hydration path emits `completed_gigs` and omits
/// `distance_miles` / `neighbor_count` / `is_new_business`; the cached
/// snapshot (`jobs/organicMatch.js:96`) emits those three and omits
/// `completed_gigs`. Everything beyond the identity fields is therefore
/// optional.
public struct MatchedBusinessDTO: Decodable, Sendable, Hashable, Identifiable {
    public var id: String {
        businessUserId
    }

    public let businessUserId: String
    public let username: String?
    public let name: String?
    public let profilePictureUrl: String?
    public let categories: [String]?
    public let averageRating: Double?
    public let reviewCount: Int?
    public let completedGigs: Int?
    public let distanceMiles: Double?
    public let neighborCount: Int?
    public let isNewBusiness: Bool?
    public let isOpenNow: Bool?

    private enum CodingKeys: String, CodingKey {
        case businessUserId = "business_user_id"
        case username, name
        case profilePictureUrl = "profile_picture_url"
        case categories
        case averageRating = "average_rating"
        case reviewCount = "review_count"
        case completedGigs = "completed_gigs"
        case distanceMiles = "distance_miles"
        case neighborCount = "neighbor_count"
        case isNewBusiness = "is_new_business"
        case isOpenNow = "is_open_now"
    }
}
