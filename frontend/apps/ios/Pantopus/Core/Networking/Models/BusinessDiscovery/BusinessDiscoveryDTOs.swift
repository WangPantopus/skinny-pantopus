//
//  BusinessDiscoveryDTOs.swift
//  Pantopus
//
//  DTOs for `backend/routes/businessDiscovery.js`. Field names mirror
//  the `formatSearchResult` shape on the server (`businessDiscovery.js:231`).
//

import Foundation

/// `GET /api/businesses/search` response.
public struct BusinessDiscoverySearchResponse: Decodable, Sendable, Hashable {
    public let results: [Item]
    public let pagination: Pagination
    public let sort: String?
    public let sortLabel: String?
    public let banner: String?

    enum CodingKeys: String, CodingKey {
        case results
        case pagination
        case sort
        case sortLabel = "sort_label"
        case banner
    }

    public struct Pagination: Decodable, Sendable, Hashable {
        public let page: Int
        public let pageSize: Int
        public let totalCount: Int
        public let totalPages: Int
        public let hasMore: Bool

        enum CodingKeys: String, CodingKey {
            case page
            case pageSize = "page_size"
            case totalCount = "total_count"
            case totalPages = "total_pages"
            case hasMore = "has_more"
        }
    }

    /// One business row in the search response. Fields are a subset of
    /// the server's `formatSearchResult` projection — only what the row
    /// renderer needs is decoded.
    public struct Item: Decodable, Sendable, Hashable, Identifiable {
        public let businessUserId: String
        public let username: String?
        public let name: String
        public let profilePictureUrl: String?
        public let categories: [String]
        public let description: String?
        public let businessType: String?
        public let averageRating: Double?
        public let reviewCount: Int
        public let distanceMiles: Double
        public let isOpenNow: Bool?
        public let isNewBusiness: Bool
        public let city: String?
        public let state: String?
        public let verificationStatus: String?
        public let verificationBadge: String?
        public let foundingBadge: Bool?

        public var id: String {
            businessUserId
        }

        enum CodingKeys: String, CodingKey {
            case businessUserId = "business_user_id"
            case username
            case name
            case profilePictureUrl = "profile_picture_url"
            case categories
            case description
            case businessType = "business_type"
            case averageRating = "average_rating"
            case reviewCount = "review_count"
            case distanceMiles = "distance_miles"
            case isOpenNow = "is_open_now"
            case isNewBusiness = "is_new_business"
            case city
            case state
            case verificationStatus = "verification_status"
            case verificationBadge = "verification_badge"
            case foundingBadge = "founding_badge"
        }
    }
}
