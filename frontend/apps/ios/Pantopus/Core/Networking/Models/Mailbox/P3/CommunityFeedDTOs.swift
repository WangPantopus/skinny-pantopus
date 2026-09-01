//
//  CommunityFeedDTOs.swift
//  Pantopus
//
//  DTOs for the Phase-3 community mail feed in
//  `backend/routes/mailboxV2Phase3.js` (mounted at
//  `/api/mailbox/v2/p3` — `backend/app.js:317`).
//
//  The feed rows are raw `CommunityMailItem` table rows (`select('*')`,
//  route line 575) enriched server-side with a `reactions` roll-up and
//  the caller's own `user_reactions`. Only the columns the native screen
//  renders are modelled.
//

import Foundation

/// One aggregated reaction bucket on a community item —
/// `backend/routes/mailboxV2Phase3.js:609`.
public struct CommunityReactionCountDTO: Decodable, Sendable, Hashable {
    /// `acknowledged / will_attend / concerned / thumbs_up`
    /// (validator at `backend/routes/mailboxV2Phase3.js:51`).
    public let reactionType: String
    public let count: Int

    private enum CodingKeys: String, CodingKey {
        case count
        case reactionType = "reaction_type"
    }

    public init(reactionType: String, count: Int) {
        self.reactionType = reactionType
        self.count = count
    }
}

/// A published neighborhood / civic item.
/// Route: `backend/routes/mailboxV2Phase3.js:565`.
public struct CommunityFeedItemDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let mailId: String?
    public let homeId: String?
    /// `civic_notice / neighborhood_event / local_business /
    /// building_announcement` (`categoryCommunityType`, route line 812).
    public let communityType: String?
    /// `building / neighborhood / city`.
    public let publishedTo: String?
    public let title: String?
    public let body: String?
    public let senderDisplay: String?
    public let senderTrust: String?
    public let category: String?
    public let verifiedSender: Bool?
    public let eventDate: String?
    public let rsvpDeadline: String?
    public let views: Int?
    public let neighborsReceived: Int?
    public let rsvpCount: Int?
    public let createdAt: String?
    public let reactions: [CommunityReactionCountDTO]?
    public let userReactions: [String]?

    private enum CodingKeys: String, CodingKey {
        case id, title, body, category, views, reactions
        case mailId = "mail_id"
        case homeId = "home_id"
        case communityType = "community_type"
        case publishedTo = "published_to"
        case senderDisplay = "sender_display"
        case senderTrust = "sender_trust"
        case verifiedSender = "verified_sender"
        case eventDate = "event_date"
        case rsvpDeadline = "rsvp_deadline"
        case neighborsReceived = "neighbors_received"
        case rsvpCount = "rsvp_count"
        case createdAt = "created_at"
        case userReactions = "user_reactions"
    }

    public init(
        id: String,
        mailId: String? = nil,
        homeId: String? = nil,
        communityType: String? = nil,
        publishedTo: String? = nil,
        title: String? = nil,
        body: String? = nil,
        senderDisplay: String? = nil,
        senderTrust: String? = nil,
        category: String? = nil,
        verifiedSender: Bool? = nil,
        eventDate: String? = nil,
        rsvpDeadline: String? = nil,
        views: Int? = nil,
        neighborsReceived: Int? = nil,
        rsvpCount: Int? = nil,
        createdAt: String? = nil,
        reactions: [CommunityReactionCountDTO]? = nil,
        userReactions: [String]? = nil
    ) {
        self.id = id
        self.mailId = mailId
        self.homeId = homeId
        self.communityType = communityType
        self.publishedTo = publishedTo
        self.title = title
        self.body = body
        self.senderDisplay = senderDisplay
        self.senderTrust = senderTrust
        self.category = category
        self.verifiedSender = verifiedSender
        self.eventDate = eventDate
        self.rsvpDeadline = rsvpDeadline
        self.views = views
        self.neighborsReceived = neighborsReceived
        self.rsvpCount = rsvpCount
        self.createdAt = createdAt
        self.reactions = reactions
        self.userReactions = userReactions
    }
}

/// Envelope for `GET /api/mailbox/v2/p3/community/feed` —
/// `{ items, total }` (route line 617).
public struct CommunityFeedResponse: Decodable, Sendable, Hashable {
    public let items: [CommunityFeedItemDTO]
    public let total: Int?
}

/// Wire body for `POST /api/mailbox/v2/p3/community/react` — validator at
/// `backend/routes/mailboxV2Phase3.js:51`.
public struct CommunityReactRequest: Encodable, Sendable {
    public let communityItemId: String
    public let reactionType: String

    public init(communityItemId: String, reactionType: String) {
        self.communityItemId = communityItemId
        self.reactionType = reactionType
    }
}

/// Envelope for `POST /api/mailbox/v2/p3/community/react` —
/// `{ message, reactions }` (route line 738). The reaction rows are the
/// authoritative post-toggle counts.
public struct CommunityReactResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let reactions: [CommunityReactionCountDTO]?
}

/// Wire body for `POST /api/mailbox/v2/p3/community/flag` — validator at
/// `backend/routes/mailboxV2Phase3.js:60`.
public struct CommunityFlagRequest: Encodable, Sendable {
    public let communityItemId: String

    public init(communityItemId: String) {
        self.communityItemId = communityItemId
    }
}

/// Envelope for `POST /api/mailbox/v2/p3/community/flag` —
/// `{ message: 'Item flagged for review' }` (route line 805).
public struct CommunityFlagResponse: Decodable, Sendable, Hashable {
    public let message: String?
}
