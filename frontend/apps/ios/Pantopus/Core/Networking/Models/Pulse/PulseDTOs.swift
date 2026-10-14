//
//  PulseDTOs.swift
//  Pantopus
//
//  Shapes of the Pulse build's own routes under `/api/pulse`
//  (docs/product/pulse-build/02-contract.md). Every field is read leniently:
//  older servers leave fields out (Pulse S2).
//

import Foundation

/// `post_status` in the keep-open and close replies (contract §2.12).
public struct PulsePostStatusDTO: Decodable, Sendable, Hashable {
    public let state: String?
    public let resolution: String?
    public let endsAt: String?

    private enum CodingKeys: String, CodingKey {
        case state, resolution
        case endsAt = "ends_at"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        state = c.lenient(String.self, forKey: .state)
        resolution = c.lenient(String.self, forKey: .resolution)
        endsAt = c.lenient(String.self, forKey: .endsAt)
    }
}

/// Reply to keep-open and close.
public struct PulseAskActionResponse: Decodable, Sendable, Hashable {
    public let postStatus: PulsePostStatusDTO?

    private enum CodingKeys: String, CodingKey {
        case postStatus = "post_status"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        postStatus = c.lenient(PulsePostStatusDTO.self, forKey: .postStatus)
    }
}

// MARK: - PulsePost (contract §2.1)

/// A post as the Pulse page and the conversation header carry it (contract
/// §2.1). Only `id` is required: an item without one is dropped from its
/// list; every other field that is missing, null or of an unknown shape
/// reads as absent, and an unknown `type`, label or action reads as a plain
/// post (Pulse S2).
public struct PulsePostDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    /// `ask_local`, `share`, `offer`, `alert`, `event`, `lost_found`, or
    /// `legacy` (the stored type is then in `legacyType`).
    public let type: String?
    public let legacyType: String?
    /// One of the twelve topics, or nil.
    public let topic: String?
    public let title: String?
    public let text: String?
    public let media: [PulseMediaDTO]
    public let createdAt: String?
    public let author: PulseAuthorDTO?
    /// The place or area the post is about.
    public let about: PulseAboutDTO?
    /// `public`, `verified_town` or `verified_area`.
    public let readScope: String?
    public let status: PulsePostStatusDTO?
    /// The type's one action and the viewer's state of it.
    public let action: PulseActionDTO?
    public let counts: PulseCountsDTO?
    public let event: PulseEventDTO?
    public let lostFound: PulseLostFoundDTO?
    public let offer: PulseOfferDTO?
    public let viewer: PulseViewerDTO?
    public let moderation: PulseModerationDTO?

    private enum CodingKeys: String, CodingKey {
        case id, type, topic, title, text, media, author, about, status, action, counts, event, offer, viewer, moderation
        case legacyType = "legacy_type"
        case createdAt = "created_at"
        case readScope = "read_scope"
        case lostFound = "lost_found"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        type = c.lenient(String.self, forKey: .type)
        legacyType = c.lenient(String.self, forKey: .legacyType)
        topic = c.lenient(String.self, forKey: .topic)
        title = c.lenient(String.self, forKey: .title)
        text = c.lenient(String.self, forKey: .text)
        media = c.lossyList(PulseMediaDTO.self, forKey: .media)
        createdAt = c.lenient(String.self, forKey: .createdAt)
        author = c.lenient(PulseAuthorDTO.self, forKey: .author)
        about = c.lenient(PulseAboutDTO.self, forKey: .about)
        readScope = c.lenient(String.self, forKey: .readScope)
        status = c.lenient(PulsePostStatusDTO.self, forKey: .status)
        action = c.lenient(PulseActionDTO.self, forKey: .action)
        counts = c.lenient(PulseCountsDTO.self, forKey: .counts)
        event = c.lenient(PulseEventDTO.self, forKey: .event)
        lostFound = c.lenient(PulseLostFoundDTO.self, forKey: .lostFound)
        offer = c.lenient(PulseOfferDTO.self, forKey: .offer)
        viewer = c.lenient(PulseViewerDTO.self, forKey: .viewer)
        moderation = c.lenient(PulseModerationDTO.self, forKey: .moderation)
    }
}

/// A photo on a post.
public struct PulseMediaDTO: Decodable, Sendable, Hashable {
    public let url: String?
    /// `image` today.
    public let type: String?
    public let thumbnailUrl: String?

    private enum CodingKeys: String, CodingKey {
        case url, type
        case thumbnailUrl = "thumbnail_url"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        url = c.lenient(String.self, forKey: .url)
        type = c.lenient(String.self, forKey: .type)
        thumbnailUrl = c.lenient(String.self, forKey: .thumbnailUrl)
    }
}

/// Who wrote a post or reply, as the reader may see them.
public struct PulseAuthorDTO: Decodable, Sendable, Hashable {
    /// Null on public and signed-out responses.
    public let id: String?
    public let displayName: String?
    /// `resident`, `new_here`, `nearby`, `visitor`, `official`, `business`, `pantopus`.
    public let label: String?
    /// "0.6 mi": only when the reader has a verified home.
    public let distanceText: String?
    public let avatarUrl: String?
    public let isCurator: Bool

    private enum CodingKeys: String, CodingKey {
        case id, label
        case displayName = "display_name"
        case distanceText = "distance_text"
        case avatarUrl = "avatar_url"
        case isCurator = "is_curator"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.lenient(String.self, forKey: .id)
        displayName = c.lenient(String.self, forKey: .displayName)
        label = c.lenient(String.self, forKey: .label)
        distanceText = c.lenient(String.self, forKey: .distanceText)
        avatarUrl = c.lenient(String.self, forKey: .avatarUrl)
        isCurator = c.lenient(Bool.self, forKey: .isCurator) ?? false
    }
}

/// The place or area a post is about ("NW 23rd Ave", "Camas").
public struct PulseAboutDTO: Decodable, Sendable, Hashable {
    public let label: String?
    public let areaId: String?

    private enum CodingKeys: String, CodingKey {
        case label
        case areaId = "area_id"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        label = c.lenient(String.self, forKey: .label)
        areaId = c.lenient(String.self, forKey: .areaId)
    }
}

/// The type's one action: `answer`, `reply`, `claim`, `seen_it`, `going`,
/// `its_mine`; `done` is the viewer's state of it.
public struct PulseActionDTO: Decodable, Sendable, Hashable {
    public let kind: String?
    public let label: String?
    public let done: Bool

    private enum CodingKeys: String, CodingKey {
        case kind, label, done
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        kind = c.lenient(String.self, forKey: .kind)
        label = c.lenient(String.self, forKey: .label)
        done = c.lenient(Bool.self, forKey: .done) ?? false
    }
}

/// Reply count, and the going count on events.
public struct PulseCountsDTO: Decodable, Sendable, Hashable {
    public let replies: Int?
    public let going: Int?

    private enum CodingKeys: String, CodingKey {
        case replies, going
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        replies = c.lenient(Int.self, forKey: .replies)
        going = c.lenient(Int.self, forKey: .going)
    }
}

/// An event's time and place.
public struct PulseEventDTO: Decodable, Sendable, Hashable {
    public let startsAt: String?
    public let endsAt: String?
    public let venue: String?

    private enum CodingKeys: String, CodingKey {
        case venue
        case startsAt = "starts_at"
        case endsAt = "ends_at"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        startsAt = c.lenient(String.self, forKey: .startsAt)
        endsAt = c.lenient(String.self, forKey: .endsAt)
        venue = c.lenient(String.self, forKey: .venue)
    }
}

/// Lost or found.
public struct PulseLostFoundDTO: Decodable, Sendable, Hashable {
    /// `lost` or `found`.
    public let kind: String?

    private enum CodingKeys: String, CodingKey {
        case kind
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        kind = c.lenient(String.self, forKey: .kind)
    }
}

/// An offer's state.
public struct PulseOfferDTO: Decodable, Sendable, Hashable {
    /// `choose` or `first`.
    public let claimMode: String?
    public let requestsOpen: Bool?
    public let gone: Bool

    private enum CodingKeys: String, CodingKey {
        case gone
        case claimMode = "claim_mode"
        case requestsOpen = "requests_open"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        claimMode = c.lenient(String.self, forKey: .claimMode)
        requestsOpen = c.lenient(Bool.self, forKey: .requestsOpen)
        gone = c.lenient(Bool.self, forKey: .gone) ?? false
    }
}

/// What the reader may do with the post.
public struct PulseViewerDTO: Decodable, Sendable, Hashable {
    public let isAuthor: Bool
    public let following: Bool
    public let canMarkHelpful: Bool
    /// The reader saved it (contract PR 2298); nil from a server without it.
    public let saved: Bool?
    /// True exactly when keep-open would succeed: the reader's own open,
    /// unanswered Ask, inside its window, not kept open yet (PR 2298).
    public let canKeepOpen: Bool

    private enum CodingKeys: String, CodingKey {
        case following, saved
        case isAuthor = "is_author"
        case canMarkHelpful = "can_mark_helpful"
        case canKeepOpen = "can_keep_open"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        isAuthor = c.lenient(Bool.self, forKey: .isAuthor) ?? false
        following = c.lenient(Bool.self, forKey: .following) ?? false
        canMarkHelpful = c.lenient(Bool.self, forKey: .canMarkHelpful) ?? false
        saved = c.lenient(Bool.self, forKey: .saved)
        canKeepOpen = c.lenient(Bool.self, forKey: .canKeepOpen) ?? false
    }
}

/// `live`, or `held` / `removed` (which only ever reach the author).
public struct PulseModerationDTO: Decodable, Sendable, Hashable {
    public let state: String?

    private enum CodingKeys: String, CodingKey {
        case state
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        state = c.lenient(String.self, forKey: .state)
    }
}

// MARK: - The Pulse page (contract §2.3)

/// `GET /api/pulse/feed`: the groups, the end of the page, the quiet state.
public struct PulseFeedResponse: Decodable, Sendable, Hashable {
    /// `nearby` or `following`.
    public let view: String?
    /// The area being read (the viewer's town by default).
    public let area: PulseAreaDTO?
    /// The area pill's choices (S5).
    public let areasAvailable: [PulseAreaDTO]
    public let quiet: PulseFeedQuietDTO?
    /// Groups in order (street, neighborhood, town); only open areas; newest
    /// first inside a group. "Show earlier" answers one `earlier` group.
    public let groups: [PulseFeedGroupDTO]
    public let end: PulseFeedEndDTO?

    private enum CodingKeys: String, CodingKey {
        case view, area, quiet, groups, end
        case areasAvailable = "areas_available"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        view = c.lenient(String.self, forKey: .view)
        area = c.lenient(PulseAreaDTO.self, forKey: .area)
        areasAvailable = c.lossyList(PulseAreaDTO.self, forKey: .areasAvailable)
        quiet = c.lenient(PulseFeedQuietDTO.self, forKey: .quiet)
        groups = c.lossyList(PulseFeedGroupDTO.self, forKey: .groups)
        end = c.lenient(PulseFeedEndDTO.self, forKey: .end)
    }
}

/// A town, neighborhood, street or place.
public struct PulseAreaDTO: Decodable, Sendable, Hashable {
    public let id: String?
    /// `town`, `neighborhood`, `street`, `place`.
    public let kind: String?
    public let name: String?
    public let state: String?
    /// How the area pill names it.
    public let title: String?

    private enum CodingKeys: String, CodingKey {
        case id, kind, name, state, title
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.lenient(String.self, forKey: .id)
        kind = c.lenient(String.self, forKey: .kind)
        name = c.lenient(String.self, forKey: .name)
        state = c.lenient(String.self, forKey: .state)
        title = c.lenient(String.self, forKey: .title)
    }
}

/// Why the page is quiet, and which card it shows.
public struct PulseFeedQuietDTO: Decodable, Sendable, Hashable {
    /// `sparse`, `no_home` or `empty`.
    public let reason: String?
    /// `meter`, `set_up_home`, or nil (no card).
    public let card: String?

    private enum CodingKeys: String, CodingKey {
        case reason, card
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        reason = c.lenient(String.self, forKey: .reason)
        card = c.lenient(String.self, forKey: .card)
    }
}

/// One group of posts under its header ("AROUND CAMAS").
public struct PulseFeedGroupDTO: Decodable, Sendable, Hashable {
    /// `street`, `neighborhood`, `town`, or `earlier`.
    public let key: String?
    public let title: String?
    public let areaId: String?
    public let items: [PulsePostDTO]

    private enum CodingKeys: String, CodingKey {
        case key, title, items
        case areaId = "area_id"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        key = c.lenient(String.self, forKey: .key)
        title = c.lenient(String.self, forKey: .title)
        areaId = c.lenient(String.self, forKey: .areaId)
        items = c.lossyList(PulsePostDTO.self, forKey: .items)
    }
}

/// The page's end: caught up since when, and whether there is more before it.
public struct PulseFeedEndDTO: Decodable, Sendable, Hashable {
    public let caughtUp: Bool?
    /// The viewer's last-seen marker the page reads from.
    public let since: String?
    public let canShowEarlier: Bool?
    /// `earlier_before` for "Show earlier".
    public let earlierCursor: String?

    private enum CodingKeys: String, CodingKey {
        case since
        case caughtUp = "caught_up"
        case canShowEarlier = "can_show_earlier"
        case earlierCursor = "earlier_cursor"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        caughtUp = c.lenient(Bool.self, forKey: .caughtUp)
        since = c.lenient(String.self, forKey: .since)
        canShowEarlier = c.lenient(Bool.self, forKey: .canShowEarlier)
        earlierCursor = c.lenient(String.self, forKey: .earlierCursor)
    }
}

/// `GET /api/pulse/feed/new`: how many new conversations wait behind the pill.
public struct PulseFeedNewCountResponse: Decodable, Sendable, Hashable {
    public let count: Int

    private enum CodingKeys: String, CodingKey {
        case count
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        count = max(0, c.lenient(Int.self, forKey: .count) ?? 0)
    }
}

/// `POST /api/pulse/feed/seen` body.
public struct PulseFeedSeenRequest: Encodable, Sendable {
    public let view: String
    public let through: String
}
