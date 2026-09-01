//
//  UsersEndpoints.swift
//  Pantopus
//

import Foundation

/// Endpoint builders for `backend/routes/users.js` profile routes.
public enum UsersEndpoints {
    /// `GET /api/users/profile` — route `backend/routes/users.js:1962`.
    public static func profile() -> Endpoint {
        Endpoint(method: .get, path: "/api/users/profile")
    }

    /// `PATCH /api/users/profile` — route `backend/routes/users.js:2052`.
    public static func updateProfile(_ update: ProfileUpdateRequest) -> Endpoint {
        Endpoint(method: .patch, path: "/api/users/profile", body: update)
    }

    /// `GET /api/users/:id/stats` — route `backend/routes/users.js:2787`.
    /// Returns `{total_gigs_posted, total_gigs_completed, total_earnings,
    /// average_rating, total_ratings}`.
    public static func stats(userId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/users/\(userId)/stats")
    }

    /// `POST /api/users/:userId/report` — report another user for a
    /// trust & safety review. Route `backend/routes/users.js:4153`;
    /// validator `backend/routes/users.js:4137` requires `reason` to be
    /// one of `spam | harassment | inappropriate | misinformation |
    /// safety | other` and caps optional `details` at 1000 characters.
    public static func report(userId: String, reason: String, details: String? = nil) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/users/\(userId)/report",
            body: ReportUserBody(reason: reason, details: details)
        )
    }

    /// `GET /api/users/search?q=…&type=…` — verified-user directory
    /// search. Route `backend/routes/users.js:2367`. Backend rejects
    /// `q` under 2 characters with a 400; the caller is expected to
    /// gate the call on `trimmed.count >= 2`.
    public static func search(query: String, limit: Int = 20, type: String = "all") -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/users/search",
            query: [
                "q": query,
                "limit": String(limit),
                "type": type
            ]
        )
    }
}

/// `POST /api/users/:userId/report` body — validator at
/// `backend/routes/users.js:4137`. `details` is omitted when nil.
private struct ReportUserBody: Encodable {
    let reason: String
    let details: String?
}

/// `GET /api/users/search` response envelope. Backend route at
/// `backend/routes/users.js:2481` returns `{users: [...]}` via the
/// `serializeCompatibilitySearchUser` helper at line 293.
public struct UserSearchResponse: Decodable, Sendable {
    public let users: [UserSearchResultDTO]
}

/// One row in the verified-user directory search. Trimmed projection of
/// `LocalProfile` + `User`. Fields are conservatively typed `String?` —
/// locality is suppressed when the local-profile's `show_neighborhood`
/// flag is false, even for a successful match.
public struct UserSearchResultDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let username: String?
    public let name: String?
    public let profilePicture: String?
    public let city: String?
    public let state: String?
    public let accountType: String?

    public init(
        id: String,
        username: String? = nil,
        name: String? = nil,
        profilePicture: String? = nil,
        city: String? = nil,
        state: String? = nil,
        accountType: String? = nil
    ) {
        self.id = id
        self.username = username
        self.name = name
        self.profilePicture = profilePicture
        self.city = city
        self.state = state
        self.accountType = accountType
    }
}

/// `GET /api/users/:id/stats` response envelope.
public struct UserStatsDTO: Decodable, Sendable, Hashable {
    public let totalGigsPosted: Int
    public let totalGigsCompleted: Int
    public let totalEarnings: Double
    public let averageRating: Double
    public let totalRatings: Int

    private enum CodingKeys: String, CodingKey {
        case totalGigsPosted = "total_gigs_posted"
        case totalGigsCompleted = "total_gigs_completed"
        case totalEarnings = "total_earnings"
        case averageRating = "average_rating"
        case totalRatings = "total_ratings"
    }
}
