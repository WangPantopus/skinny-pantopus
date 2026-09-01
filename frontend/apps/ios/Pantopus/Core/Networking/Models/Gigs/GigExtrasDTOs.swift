//
//  GigExtrasDTOs.swift
//  Pantopus
//
//  Response shapes for `GigExtrasEndpoints` — Q&A engagement actions,
//  the poster's worker reminder, and the rebookable-helpers rail.
//

import Foundation

// MARK: - Structured Q&A actions

/// `POST /api/gigs/:gigId/questions/:questionId/upvote` →
/// `{ "upvoted": true }` (gigs.js:7535). The route toggles, so the flag
/// reports the post-toggle state.
public struct GigQuestionUpvoteResponse: Decodable, Sendable, Hashable {
    public let upvoted: Bool

    public init(upvoted: Bool) {
        self.upvoted = upvoted
    }
}

/// `DELETE /api/gigs/:gigId/questions/:questionId` → `{ "deleted": true }`
/// (gigs.js:7600).
public struct GigQuestionDeleteResponse: Decodable, Sendable, Hashable {
    public let deleted: Bool

    public init(deleted: Bool) {
        self.deleted = deleted
    }
}

// MARK: - Worker reminder

/// `POST /api/gigs/:gigId/remind-worker` success body (gigs.js:5828).
/// The 429 rate-limited body carries only `error` / `code` /
/// `next_allowed_at`, which the view-model parses out of the raw
/// `APIError.clientError` payload.
public struct GigStartReminderResponse: Decodable, Sendable, Hashable {
    public let success: Bool?
    public let sentAt: String?
    public let message: String?
    public let nextAllowedAt: String?

    enum CodingKeys: String, CodingKey {
        case success, message
        case sentAt = "sent_at"
        case nextAllowedAt = "next_allowed_at"
    }

    public init(
        success: Bool? = nil,
        sentAt: String? = nil,
        message: String? = nil,
        nextAllowedAt: String? = nil
    ) {
        self.success = success
        self.sentAt = sentAt
        self.message = message
        self.nextAllowedAt = nextAllowedAt
    }
}

// MARK: - Rebook

/// The worker inlined on a rebookable gig (gigs.js:2960).
public struct RebookableWorkerDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let firstName: String?
    public let lastName: String?
    public let username: String?
    public let avatarUrl: String?
    public let rating: Double?

    enum CodingKeys: String, CodingKey {
        case id, username, rating
        case firstName
        case lastName
        case avatarUrl
    }

    public init(
        id: String,
        firstName: String? = nil,
        lastName: String? = nil,
        username: String? = nil,
        avatarUrl: String? = nil,
        rating: Double? = nil
    ) {
        self.id = id
        self.firstName = firstName
        self.lastName = lastName
        self.username = username
        self.avatarUrl = avatarUrl
        self.rating = rating
    }

    /// "Ana" — first name, else username, else a neutral fallback.
    public var displayName: String {
        if let firstName, !firstName.isEmpty { return firstName }
        if let username, !username.isEmpty { return username }
        return "Helper"
    }

    /// "AL" — first+last initials, else the username initial.
    public var initials: String {
        let first = firstName?.first.map(String.init) ?? ""
        let last = lastName?.first.map(String.init) ?? ""
        let pair = (first + last).uppercased()
        if !pair.isEmpty { return pair }
        if let char = username?.first { return String(char).uppercased() }
        return "?"
    }
}

/// The poster's own review of a rebookable gig, when they left one.
public struct RebookableReviewDTO: Decodable, Sendable, Hashable {
    public let rating: Double?
    public let comment: String?

    public init(rating: Double? = nil, comment: String? = nil) {
        self.rating = rating
        self.comment = comment
    }
}

/// One card in the "Rebook a favorite helper" rail —
/// `GET /api/gigs/rebookable` (gigs.js:2885). Note the handler emits
/// **camelCase** keys (`completedAt`, `avatarUrl`), unlike most gig
/// routes, so only `myReview` needs an explicit mapping.
public struct RebookableGigDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let title: String?
    public let category: String?
    public let price: Double?
    public let completedAt: String?
    public let worker: RebookableWorkerDTO?
    public let myReview: RebookableReviewDTO?
    public let city: String?
    public let state: String?

    enum CodingKeys: String, CodingKey {
        case id, title, category, price, completedAt, worker, city, state
        case myReview
    }

    public init(
        id: String,
        title: String? = nil,
        category: String? = nil,
        price: Double? = nil,
        completedAt: String? = nil,
        worker: RebookableWorkerDTO? = nil,
        myReview: RebookableReviewDTO? = nil,
        city: String? = nil,
        state: String? = nil
    ) {
        self.id = id
        self.title = title
        self.category = category
        self.price = price
        self.completedAt = completedAt
        self.worker = worker
        self.myReview = myReview
        self.city = city
        self.state = state
    }
}

/// `GET /api/gigs/rebookable` envelope.
public struct RebookableGigsResponse: Decodable, Sendable {
    public let rebookable: [RebookableGigDTO]

    public init(rebookable: [RebookableGigDTO] = []) {
        self.rebookable = rebookable
    }
}
