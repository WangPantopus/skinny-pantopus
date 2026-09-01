//
//  ChatConversationContent.swift
//  Pantopus
//
//  Render models for the chat conversation screen. The view is pure
//  display — projections from `ChatMessageDTO` → `ChatBubbleContent`
//  / `ChatSystemPillContent` live in the view-model.
//

// swiftlint:disable enum_case_associated_values_count file_length

import Foundation

/// Presentation mode for the conversation surface. Orthogonal to
/// `ChatCounterparty` (who you're talking to) — `mode` drives the chrome
/// (avatar treatment, empty/welcome state, bubble shapes). `.dm` is the
/// default human DM/group thread; `.aiAssistant` is the Pantopus AI
/// thread; `.creatorThread` / `.fanThread` add creator/fan-specific chrome.
public enum ChatConversationMode: String, Sendable, Hashable {
    case dm
    case aiAssistant
    case creatorThread
    case fanThread
}

/// Creator-side context rendered above a creator/fan DM thread.
public struct ChatCreatorThreadContext: Sendable, Hashable {
    /// The persona whose creator inbox this thread belongs to. `nil` when
    /// the caller hasn't resolved it — the audience strip then shows the
    /// generic "Creator inbox" label rather than a placeholder name.
    public let personaName: String?
    /// Reach / engagement line under the strip title. `nil` unless the
    /// caller has real audience analytics for this persona; there is no
    /// per-thread analytics payload on the wire, so it normally stays nil.
    public let audienceSummary: String?
    public let fanTierName: String
    /// Tier rank (1=Free, 2=Bronze, 3=Silver, 4=Gold). The visual
    /// palette intentionally mirrors Creator Inbox's semantic-token
    /// mapping; tier-specific color tokens do not exist in the app
    /// theme today.
    public let fanTierRank: Int
    /// Header sub-line ("Member since …"). `nil` when the membership
    /// join date / distance isn't known — the header then drops the line
    /// instead of inventing one.
    public let fanSubtitle: String?
    /// `nil` when the backend hasn't reported a reply allowance for this
    /// thread. There is no creator-side weekly reply quota on the wire yet
    /// (`backend/routes/personaDms.js` only meters the fan), so the meter
    /// and its lock stay hidden instead of showing invented counts.
    public let quota: ChatCreatorQuota?
    /// The real, creator-authored tier this fan can be invited up to.
    /// `nil` when the caller hasn't loaded the persona's tier ladder — the
    /// A15.4 upgrade card is then omitted rather than pitching an invented
    /// tier name or invented perks.
    public let upgradeOffer: ChatCreatorUpgradeOffer?

    public init(
        personaName: String? = nil,
        audienceSummary: String? = nil,
        fanTierName: String,
        fanTierRank: Int,
        fanSubtitle: String? = nil,
        quota: ChatCreatorQuota? = nil,
        upgradeOffer: ChatCreatorUpgradeOffer? = nil
    ) {
        self.personaName = personaName
        self.audienceSummary = audienceSummary
        self.fanTierName = fanTierName
        self.fanTierRank = fanTierRank
        self.fanSubtitle = fanSubtitle
        self.quota = quota
        self.upgradeOffer = upgradeOffer
    }

    /// Context for a creator thread where only the fan's tier is known.
    /// Everything else stays nil — the persona name, the audience summary,
    /// the membership sub-line and the upgrade ladder all need data the
    /// creator-inbox row does not carry, and inventing them would ship
    /// another creator's copy to every creator.
    public static func defaults(fanTierName: String = "Free", fanTierRank: Int = 1) -> ChatCreatorThreadContext {
        ChatCreatorThreadContext(
            fanTierName: fanTierName,
            fanTierRank: fanTierRank
        )
    }
}

/// A15.4 upgrade-fan card payload. Every string here is creator-authored
/// tier data (`GET /api/personas/:handle/tiers` — name / description /
/// price) or derived from the tier's published policy fields. Nothing in
/// this struct may be synthesised by the UI.
public struct ChatCreatorUpgradeOffer: Sendable, Hashable {
    /// The tier's own name, exactly as the creator published it.
    public let tierName: String
    /// Formatted price, e.g. "$15/mo". `nil` when the tier has no price
    /// on the wire.
    public let priceLabel: String?
    /// The tier's creator-authored description. `nil` hides the body
    /// paragraph.
    public let summary: String?
    /// Perk lines built from the tier's published policy fields
    /// (`msgThreadsPerPeriod`, `replyPolicy`, `creatorCanInitiateDm`).
    /// Empty hides the perk block.
    public let perks: [String]
    /// False until a creator→fan upgrade-offer endpoint exists. The send
    /// action renders disabled with an honest note while this is false.
    public let canSendOffer: Bool

    public init(
        tierName: String,
        priceLabel: String? = nil,
        summary: String? = nil,
        perks: [String] = [],
        canSendOffer: Bool = false
    ) {
        self.tierName = tierName
        self.priceLabel = priceLabel
        self.summary = summary
        self.perks = perks
        self.canSendOffer = canSendOffer
    }
}

public struct ChatCreatorQuota: Sendable, Hashable {
    public let used: Int
    public let total: Int
    public let resetCopy: String

    public init(used: Int, total: Int, resetCopy: String) {
        self.used = used
        self.total = total
        self.resetCopy = resetCopy
    }

    /// True when the creator has used all weekly replies for this fan tier.
    /// A `total` of zero means "no replies allowed", which is maxed — the
    /// unknown case is modelled by a nil quota, not by a zero total.
    public var isMaxed: Bool {
        used >= total
    }
}

/// Counterparty type. Drives the header swap, empty-state copy, and
/// composer placeholder.
public enum ChatCounterparty: Sendable, Hashable {
    case person(name: String, initials: String, locality: String?, verified: Bool, online: Bool)
    case group(name: String, memberCount: Int?)
    case ai(name: String)

    public var displayName: String {
        switch self {
        case let .person(name, _, _, _, _): name
        case let .group(name, _): name
        case let .ai(name): name
        }
    }
}

/// A15 `.ctx-strip` — pinned gig context rendered under the header of
/// a gig-room thread. Built by the VM from `GET /api/gigs/:id`.
public struct ChatGigContextStrip: Sendable, Hashable {
    public let gigId: String
    /// "<gig title> · $<price>" (price omitted when the gig has none).
    public let title: String
    /// Secondary meta line, e.g. "Yard · Open".
    public let meta: String?

    public init(gigId: String, title: String, meta: String?) {
        self.gigId = gigId
        self.title = title
        self.meta = meta
    }
}

/// Sender side of a single message — speaker on the left ("in") or the
/// signed-in user on the right ("out").
public enum ChatMessageSide: String, Sendable, Hashable {
    case incoming, outgoing
}

/// Delivery state shown next to outgoing messages.
public enum ChatDeliveryState: Sendable, Hashable {
    case sending
    case failed
    case delivered
    case read
}

/// Fan-side membership state for persona DMs.
public struct ChatFanEntitlement: Sendable, Hashable {
    public let currentTier: String
    public let renewsOn: String
    public let messagesLeft: Int
    public let messageLimit: Int
    public let resetCopy: String
    public let requiredReplyTier: String?

    public var canReply: Bool {
        requiredReplyTier == nil && messagesLeft > 0
    }

    public init(
        currentTier: String,
        renewsOn: String,
        messagesLeft: Int,
        messageLimit: Int,
        resetCopy: String,
        requiredReplyTier: String? = nil
    ) {
        self.currentTier = currentTier
        self.renewsOn = renewsOn
        self.messagesLeft = messagesLeft
        self.messageLimit = messageLimit
        self.resetCopy = resetCopy
        self.requiredReplyTier = requiredReplyTier
    }
}

public enum ChatQueuedAttachmentKind: Sendable, Hashable {
    case image
    case document
}

public struct ChatQueuedAttachment: Identifiable, Sendable, Hashable {
    public let id: String
    public let kind: ChatQueuedAttachmentKind
    public let filename: String
    public let mimeType: String
    public let data: Data?

    public init(
        id: String,
        kind: ChatQueuedAttachmentKind,
        filename: String,
        mimeType: String = "application/octet-stream",
        data: Data? = nil
    ) {
        self.id = id
        self.kind = kind
        self.filename = filename
        self.mimeType = mimeType
        self.data = data
    }
}

/// Inline "this would cost about $X" estimate rendered inside an AI
/// reply bubble (`AIEstimateCard`).
public struct ChatEstimate: Sendable, Hashable {
    /// Headline figure, e.g. "$55–70".
    public let amount: String
    /// Supporting basis, e.g. "based on 8 nearby jobs".
    public let basis: String
    /// Confidence label, e.g. "Medium–High".
    public let confidence: String

    public init(amount: String, basis: String, confidence: String) {
        self.amount = amount
        self.basis = basis
        self.confidence = confidence
    }
}

public struct ChatAIDraftCard: Identifiable, Sendable, Hashable {
    public let id: String
    public let type: String
    public let title: String
    public let summary: String?
    public let priceLabel: String?
    public let valid: Bool
}

public struct ChatReplyPreview: Sendable, Hashable {
    public let messageId: String
    public let senderName: String
    public let text: String
}

public struct ChatBubbleReaction: Identifiable, Sendable, Hashable {
    public let id: String
    public let reaction: String
    public let count: Int
    public let reactedByMe: Bool
}

public struct ChatConversationTopic: Identifiable, Sendable, Hashable {
    public let id: String
    public let topicType: String
    public let title: String
    /// Backend topic status (`active`, …). Rendered in the
    /// conversation-details drawer when present.
    public let status: String?

    public init(id: String, topicType: String, title: String, status: String? = nil) {
        self.id = id
        self.topicType = topicType
        self.title = title
        self.status = status
    }
}

public struct ChatLocationCard: Sendable, Hashable {
    public let latitude: Double
    public let longitude: Double
    public let address: String

    public init(latitude: Double, longitude: Double, address: String) {
        self.latitude = latitude
        self.longitude = longitude
        self.address = address
    }
}

public struct ChatGigOfferCard: Sendable, Hashable {
    public let gigId: String
    public let title: String
    public let category: String?
    public let priceLabel: String?
    public let status: String?

    public init(
        gigId: String,
        title: String,
        category: String? = nil,
        priceLabel: String? = nil,
        status: String? = nil
    ) {
        self.gigId = gigId
        self.title = title
        self.category = category
        self.priceLabel = priceLabel
        self.status = status
    }
}

public struct ChatListingOfferCard: Sendable, Hashable {
    public let listingId: String
    public let title: String
    public let category: String?
    public let priceLabel: String
    public let condition: String?
    public let imageURL: URL?

    public init(
        listingId: String,
        title: String,
        category: String? = nil,
        priceLabel: String,
        condition: String? = nil,
        imageURL: URL? = nil
    ) {
        self.listingId = listingId
        self.title = title
        self.category = category
        self.priceLabel = priceLabel
        self.condition = condition
        self.imageURL = imageURL
    }
}

/// Share-sheet row for attaching a gig to chat.
public struct ChatShareGigOption: Identifiable, Sendable, Hashable {
    public let id: String
    public let title: String
    public let category: String?
    public let price: Double?
    public let status: String?

    public init(id: String, title: String, category: String?, price: Double?, status: String?) {
        self.id = id
        self.title = title
        self.category = category
        self.price = price
        self.status = status
    }
}

/// Share-sheet row for attaching a listing to chat.
public struct ChatShareListingOption: Identifiable, Sendable, Hashable {
    public let id: String
    public let title: String
    public let category: String?
    public let price: Double?
    public let isFree: Bool
    public let condition: String?
    public let imageURL: String?

    public init(
        id: String,
        title: String,
        category: String?,
        price: Double?,
        isFree: Bool,
        condition: String?,
        imageURL: String?
    ) {
        self.id = id
        self.title = title
        self.category = category
        self.price = price
        self.isFree = isFree
        self.condition = condition
        self.imageURL = imageURL
    }
}

/// Per-bubble render model.
public struct ChatBubbleContent: Identifiable, Sendable, Hashable {
    public enum Body: Sendable, Hashable {
        case text(String)
        case textWithImages(text: String, imageURLs: [URL])
        case image(url: URL?)
        case attachment(filename: String, sizeLabel: String?)
        case locationCard(ChatLocationCard)
        case gigOfferCard(ChatGigOfferCard)
        case listingOfferCard(ChatListingOfferCard)
        case systemLink(label: String, sub: String, accent: SystemLinkAccent)
        /// Structured AI reply: prose plus an optional inline estimate
        /// card. Renders wider than a plain bubble with a "Pantopus AI"
        /// tag (`.aiAssistant` mode only).
        case aiReply(text: String, estimate: ChatEstimate?, drafts: [ChatAIDraftCard] = [])
    }

    public enum SystemLinkAccent: String, Sendable, Hashable {
        case primary, success, warning, error
    }

    public let id: String
    public let side: ChatMessageSide
    public let body: Body
    public let replyPreview: ChatReplyPreview?
    public let reactions: [ChatBubbleReaction]
    /// Whether this bubble carries the 4pt tail (last in a same-sender
    /// run). The VM groups consecutive same-sender bubbles and sets
    /// `tail = true` only on the last.
    public let hasTail: Bool
    /// True when the previous timeline row is a bubble from the same
    /// sender on the same day. Continuation rows use tighter top spacing
    /// and hide repeated avatar chrome.
    public let isContinuation: Bool
    /// Stamp shown under the LAST bubble of a same-sender group. `nil`
    /// for bubbles in the middle of a group.
    public let stamp: String?
    public let deliveryState: ChatDeliveryState?
    /// Required tier for messages the fan cannot read yet.
    public let lockedTier: String?
    /// Paid support tier attached to outgoing fan replies.
    public let sentSupportTier: String?

    public init(
        id: String,
        side: ChatMessageSide,
        body: Body,
        replyPreview: ChatReplyPreview? = nil,
        reactions: [ChatBubbleReaction] = [],
        hasTail: Bool,
        isContinuation: Bool = false,
        stamp: String?,
        deliveryState: ChatDeliveryState? = nil,
        lockedTier: String? = nil,
        sentSupportTier: String? = nil
    ) {
        self.id = id
        self.side = side
        self.body = body
        self.replyPreview = replyPreview
        self.reactions = reactions
        self.hasTail = hasTail
        self.isContinuation = isContinuation
        self.stamp = stamp
        self.deliveryState = deliveryState
        self.lockedTier = lockedTier
        self.sentSupportTier = sentSupportTier
    }
}

/// Day-divider element ("TODAY", "YESTERDAY", "APR 12").
public struct ChatDayDivider: Identifiable, Sendable, Hashable {
    public let id: String
    public let label: String
}

/// Topic-divider element inserted in the "All" person-thread view
/// between consecutive messages filed under different topics. `id` is
/// the message id that starts the new topic segment (stable across
/// rebuilds); `label` is the topic title, or "General" for untopiced
/// runs.
public struct ChatTopicDivider: Identifiable, Sendable, Hashable {
    public let id: String
    public let label: String

    public init(id: String, label: String) {
        self.id = id
        self.label = label
    }
}

/// Inline creator-side reference to a broadcast that prompted the DM.
public struct ChatBroadcastReference: Identifiable, Sendable, Hashable {
    public let id: String
    public let title: String
    public let subtitle: String
    public let metric: String

    public init(id: String, title: String, subtitle: String, metric: String) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.metric = metric
    }
}

/// Heterogeneous timeline row.
public enum ChatTimelineRow: Identifiable, Sendable, Hashable {
    case dayDivider(ChatDayDivider)
    case topicDivider(ChatTopicDivider)
    case broadcastReference(ChatBroadcastReference)
    case bubble(ChatBubbleContent)

    public var id: String {
        switch self {
        case let .dayDivider(divider): "divider_\(divider.id)"
        case let .topicDivider(divider): "topic_\(divider.id)"
        case let .broadcastReference(reference): "broadcast_\(reference.id)"
        case let .bubble(bubble): "bubble_\(bubble.id)"
        }
    }
}

/// Suggested-prompt chip for the AI welcome card.
public struct ChatPromptChip: Identifiable, Sendable, Hashable {
    public let id: String
    public let label: String
    public let icon: PantopusIcon

    public init(id: String, label: String, icon: PantopusIcon) {
        self.id = id
        self.label = label
        self.icon = icon
    }
}

/// Top-level render state for the conversation screen.
public enum ChatConversationState: Sendable {
    /// Initial fetch in flight.
    case loading
    /// No messages yet — shows the empty state (quick-start chips +
    /// encryption pill).
    case empty
    /// Populated thread.
    case loaded(rows: [ChatTimelineRow])
    case error(message: String)
}
