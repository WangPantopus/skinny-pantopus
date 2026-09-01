//
//  ProfileTabsDTOs.swift
//  Pantopus
//
//  Decoders for the public-profile tab set and the skills editor.
//  `APIClient` does not apply `convertFromSnakeCase`, so every key that
//  differs is spelled out in `CodingKeys`.
//
//    Route backend/routes/files.js:489 / :526  — portfolio list
//    Route backend/routes/files.js:853         — file delete
//    Route backend/routes/reviews.js:149       — gig reviews received
//    Route backend/routes/users.js:2244        — skills replace
//

import Foundation

// MARK: - Portfolio

/// Free-form `File.metadata` jsonb written by the portfolio upload route
/// (`backend/routes/files.js:437-445`).
public struct PortfolioFileMetadataDTO: Decodable, Sendable, Hashable {
    public let title: String?
    public let description: String?
    public let tags: [String]?
    /// `{ small: url, medium: url, large: url }` — only present for
    /// images the server was able to resize.
    public let thumbnails: [String: String]?

    enum CodingKeys: String, CodingKey {
        case title, description, tags, thumbnails
    }
}

/// One `File` row from `GET /api/files/portfolio[/:userId]`.
public struct PortfolioFileDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let fileURL: String?
    public let filename: String?
    public let originalFilename: String?
    /// `portfolio_image` / `portfolio_video` / `portfolio_document` /
    /// `resume` / `certification` — the `.in(...)` filter on both list
    /// routes.
    public let fileType: String?
    /// User-chosen bucket (`file_context`) — the upload route's
    /// `category` form field.
    public let fileContext: String?
    public let visibility: String?
    public let displayOrder: Int?
    public let createdAt: String?
    public let metadata: PortfolioFileMetadataDTO?

    enum CodingKeys: String, CodingKey {
        case id
        case fileURL = "file_url"
        case filename
        case originalFilename = "original_filename"
        case fileType = "file_type"
        case fileContext = "file_context"
        case visibility
        case displayOrder = "display_order"
        case createdAt = "created_at"
        case metadata
    }
}

/// Envelope from both portfolio list routes: `{ files: [...] }`.
public struct PortfolioListResponse: Decodable, Sendable {
    public let files: [PortfolioFileDTO]

    enum CodingKeys: String, CodingKey {
        case files
    }
}

/// `{ message }` from `DELETE /api/files/:id`.
public struct FileDeleteResponse: Decodable, Sendable, Hashable {
    public let message: String?

    enum CodingKeys: String, CodingKey {
        case message
    }
}

/// `{ message, file: { id, url, type, thumbnails, metadata } }` from
/// `POST /api/files/portfolio` (`backend/routes/files.js:467`).
public struct PortfolioUploadResponse: Decodable, Sendable {
    public struct Uploaded: Decodable, Sendable, Hashable {
        public let id: String
        public let url: String?
        public let type: String?

        enum CodingKeys: String, CodingKey {
            case id, url, type
        }
    }

    public let message: String?
    public let file: Uploaded?

    enum CodingKeys: String, CodingKey {
        case message, file
    }
}

// MARK: - Gig reviews received

/// Nested reviewer join on a gig review.
public struct GigReviewReviewerDTO: Decodable, Sendable, Hashable {
    public let id: String?
    public let username: String?
    public let name: String?
    public let firstName: String?
    public let lastName: String?
    public let profilePictureURL: String?

    enum CodingKeys: String, CodingKey {
        case id, username, name
        case firstName = "first_name"
        case lastName = "last_name"
        case profilePictureURL = "profile_picture_url"
    }
}

/// Nested gig join — carries the role context the backend uses to derive
/// `received_as`.
public struct GigReviewGigDTO: Decodable, Sendable, Hashable {
    public let id: String?
    public let title: String?

    enum CodingKeys: String, CodingKey {
        case id, title
    }
}

/// One row from `GET /api/reviews/user/:userId`.
public struct GigReviewDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let gigID: String?
    public let reviewerID: String?
    public let rating: Int
    public let comment: String?
    public let mediaURLs: [String]?
    public let createdAt: String?
    /// Server-flattened convenience fields (`reviews.js:250-256`).
    public let reviewerName: String?
    public let reviewerAvatar: String?
    public let reviewerUsername: String?
    /// `worker` | `poster` | `unknown` — resolved server-side from the
    /// gig's `accepted_by` / `user_id` (`reviews.js:156-163`).
    public let receivedAs: String?
    public let reviewer: GigReviewReviewerDTO?
    public let gig: GigReviewGigDTO?

    enum CodingKeys: String, CodingKey {
        case id
        case gigID = "gig_id"
        case reviewerID = "reviewer_id"
        case rating
        case comment
        case mediaURLs = "media_urls"
        case createdAt = "created_at"
        case reviewerName = "reviewer_name"
        case reviewerAvatar = "reviewer_avatar"
        case reviewerUsername = "reviewer_username"
        case receivedAs = "received_as"
        case reviewer
        case gig
    }
}

/// Per-role tallies emitted alongside the review page.
public struct GigReviewCountsDTO: Decodable, Sendable, Hashable {
    public let worker: Int
    public let poster: Int
    public let unknown: Int

    enum CodingKeys: String, CodingKey {
        case worker, poster, unknown
    }

    public init(worker: Int = 0, poster: Int = 0, unknown: Int = 0) {
        self.worker = worker
        self.poster = poster
        self.unknown = unknown
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        worker = try container.decodeIfPresent(Int.self, forKey: .worker) ?? 0
        poster = try container.decodeIfPresent(Int.self, forKey: .poster) ?? 0
        unknown = try container.decodeIfPresent(Int.self, forKey: .unknown) ?? 0
    }
}

/// Envelope from `GET /api/reviews/user/:userId`.
public struct GigReviewsResponse: Decodable, Sendable {
    public let reviews: [GigReviewDTO]
    public let total: Int?
    public let averageRating: Double?
    public let counts: GigReviewCountsDTO?

    enum CodingKeys: String, CodingKey {
        case reviews
        case total
        case averageRating = "average_rating"
        case counts
    }
}

// MARK: - Skills

/// Body for `PUT /api/users/skills`.
public struct UpdateSkillsRequest: Encodable, Sendable, Hashable {
    public let skills: [String]

    public init(skills: [String]) {
        self.skills = skills
    }

    enum CodingKeys: String, CodingKey {
        case skills
    }
}

/// `{ skills: [...] }` echo from `PUT /api/users/skills`.
public struct UpdateSkillsResponse: Decodable, Sendable, Hashable {
    public let skills: [String]

    enum CodingKeys: String, CodingKey {
        case skills
    }
}
