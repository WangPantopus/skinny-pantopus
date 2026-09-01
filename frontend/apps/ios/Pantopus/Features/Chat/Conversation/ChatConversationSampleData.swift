//
//  ChatConversationSampleData.swift
//  Pantopus
//
//  Deterministic AI-thread fixtures for SwiftUI previews and the
//  snapshot lockfile tests. The AI thread has no backend wiring yet, so
//  these stand in for what the SSE stream will eventually produce.
//

import Foundation

enum ChatConversationSampleData {
    static let aiName = "Pantopus AI"
    static let fanPersonaName = "Wynn B."
    static let creatorFanName = "Priya R."
    /// Design fixture — carries an explicit quota so previews / snapshots
    /// still exercise the meter. The live path leaves `quota` nil (no
    /// creator-side reply allowance exists on the wire yet).
    static let creatorContext = ChatCreatorThreadContext(
        personaName: "The Sourdough Diary",
        audienceSummary: "Reach: 2,340 · Engagement up 12% this week",
        fanTierName: "Bronze",
        fanTierRank: 2,
        fanSubtitle: "Member since Aug · 0.4 mi",
        quota: ChatCreatorQuota(used: 12, total: 30, resetCopy: "Resets Monday")
    )

    /// Quota-exhausted creator thread (A15.4 secondary frame) — the state
    /// that renders the exhausted pill, the upgrade card and the locked
    /// composer.
    static let creatorMaxedContext = ChatCreatorThreadContext(
        personaName: "The Sourdough Diary",
        audienceSummary: "Reach: 2,340 · Engagement up 12% this week",
        fanTierName: "Bronze",
        fanTierRank: 2,
        fanSubtitle: "Member since Aug · 0.4 mi",
        quota: ChatCreatorQuota(used: 5, total: 5, resetCopy: "Resets Monday 12:00 AM"),
        upgradeOffer: creatorUpgradeOffer
    )

    /// Shape of a real tier read: name / price / description come straight
    /// from `GET /api/personas/:handle/tiers`, perks from that tier's
    /// published policy fields.
    static let creatorUpgradeOffer = ChatCreatorUpgradeOffer(
        tierName: "Gold",
        priceLabel: "$15/mo",
        summary: "Unlimited threads with a same-week reply promise.",
        perks: ["Unlimited message threads", "Replies within 3 days", "Creator can start threads"],
        canSendOffer: false
    )
    static let dmCounterparty = ChatCounterparty.person(
        name: "Jamal T.",
        initials: "JT",
        locality: "Elm Park",
        verified: true,
        online: false
    )

    static let queuedAttachments: [ChatQueuedAttachment] = [
        ChatQueuedAttachment(id: "queued_photo", kind: .image, filename: "shelves.jpg"),
        ChatQueuedAttachment(id: "queued_pdf", kind: .document, filename: "shelf.pdf")
    ]

    static let fanEntitlement = ChatFanEntitlement(
        currentTier: "Bronze",
        renewsOn: "Apr 12",
        messagesLeft: 3,
        messageLimit: 5,
        resetCopy: "Resets May 1"
    )

    static let fanLockedEntitlement = ChatFanEntitlement(
        currentTier: "Bronze",
        renewsOn: "Apr 12",
        messagesLeft: 3,
        messageLimit: 5,
        resetCopy: "Resets May 1",
        requiredReplyTier: "Silver"
    )

    /// An active AI thread: a user question followed by a structured AI
    /// reply carrying an inline estimate card.
    static let aiActiveRows: [ChatTimelineRow] = [
        .dayDivider(ChatDayDivider(id: "today", label: "Today")),
        .bubble(ChatBubbleContent(
            id: "u1",
            side: .outgoing,
            body: .text("What's a fair price to hang 3 shelves in my living room?"),
            hasTail: true,
            stamp: "9:07 AM",
            deliveryState: .read
        )),
        .bubble(ChatBubbleContent(
            id: "ai1",
            side: .incoming,
            body: .aiReply(
                text: "For drywall, 3 shelves, ~1.5 hours of work, neighbors in Elm Park are paying:",
                estimate: ChatEstimate(
                    amount: "$55–70",
                    basis: "based on 8 nearby jobs",
                    confidence: "Medium–High"
                )
            ),
            hasTail: true,
            stamp: "9:08 AM",
            deliveryState: nil
        ))
    ]

    /// A15.5 fan-side persona DM with quota chrome, tier-gated creator
    /// reply, and an outgoing paid-support footer.
    static let fanActiveRows: [ChatTimelineRow] = [
        .dayDivider(ChatDayDivider(id: "today", label: "Today")),
        .bubble(ChatBubbleContent(
            id: "fan1",
            side: .outgoing,
            body: .text("Loved this week's loaf — quick question: can I sub bread flour for AP?"),
            hasTail: true,
            stamp: "8:51 AM",
            deliveryState: .read,
            sentSupportTier: "Bronze"
        )),
        .bubble(ChatBubbleContent(
            id: "creator1",
            side: .incoming,
            body: .text("Short answer — yes, bread flour gives more chew. Drop hydration by about 5g per 100g."),
            hasTail: true,
            stamp: "Wynn · 9:03 AM",
            deliveryState: nil
        )),
        .bubble(ChatBubbleContent(
            id: "creator2",
            side: .incoming,
            body: .text("Silver members also get my starter troubleshooting checklist and bake timing notes."),
            hasTail: true,
            stamp: "Wynn · 9:04 AM",
            deliveryState: nil,
            lockedTier: "Silver"
        ))
    ]

    /// Creator-side thread from A15.4: audience chrome, Bronze tier fan,
    /// quota meter, and an inline broadcast reference before the fan's
    /// workshop follow-up.
    static let creatorThreadRows: [ChatTimelineRow] = [
        .dayDivider(ChatDayDivider(id: "today", label: "Today")),
        .broadcastReference(ChatBroadcastReference(
            id: "workshop-broadcast",
            title: "Workshop interest list",
            subtitle: "Sunday bake workshop poll sent to Bronze+ members.",
            metric: "2,340 reached · engagement up 12%"
        )),
        .bubble(ChatBubbleContent(
            id: "creator_m1",
            side: .incoming,
            body: .text("Hi! Loved this week's loaf — quick question: can I sub bread flour for AP?"),
            hasTail: true,
            stamp: "Priya · 8:51 AM",
            deliveryState: nil
        )),
        .bubble(ChatBubbleContent(
            id: "creator_m2",
            side: .outgoing,
            body: .text("Yes — bread flour gives more chew. Use 5g less water per 100g."),
            hasTail: true,
            stamp: "9:02 AM",
            deliveryState: .read
        )),
        .bubble(ChatBubbleContent(
            id: "creator_m3",
            side: .incoming,
            body: .text("Also — would you ever do a hands-on workshop? I'd pay."),
            hasTail: true,
            stamp: "Priya · 9:14 AM",
            deliveryState: nil
        ))
    ]

    static let dmPhotoReadRows: [ChatTimelineRow] = [
        .dayDivider(ChatDayDivider(id: "today", label: "Today")),
        .bubble(ChatBubbleContent(
            id: "m1",
            side: .incoming,
            body: .text("8:30 sharp. I'll grab two."),
            hasTail: true,
            stamp: "9:10 AM",
            deliveryState: nil
        )),
        .bubble(ChatBubbleContent(
            id: "m2",
            side: .outgoing,
            body: .text("Deal — see you at the bench."),
            hasTail: false,
            stamp: nil,
            deliveryState: nil
        )),
        .bubble(ChatBubbleContent(
            id: "m3",
            side: .outgoing,
            body: .text("Snapped a photo of the spot:"),
            hasTail: false,
            isContinuation: true,
            stamp: nil,
            deliveryState: nil
        )),
        .bubble(ChatBubbleContent(
            id: "m4",
            side: .outgoing,
            body: .image(url: nil),
            hasTail: true,
            isContinuation: true,
            stamp: "9:14",
            deliveryState: .read
        ))
    ]

    static let dmTypingRows: [ChatTimelineRow] = [
        .dayDivider(ChatDayDivider(id: "today", label: "Today")),
        .bubble(ChatBubbleContent(
            id: "m1",
            side: .incoming,
            body: .text("Btw — here's the bakery I keep raving about."),
            hasTail: true,
            stamp: "6:42 PM",
            deliveryState: nil
        )),
        .bubble(ChatBubbleContent(
            id: "m2",
            side: .outgoing,
            body: .text("Bookmarked. Sunday morning mission."),
            hasTail: true,
            stamp: "6:44 PM",
            deliveryState: .read
        ))
    ]

    static let dmQueuedAttachmentRows: [ChatTimelineRow] = [
        .dayDivider(ChatDayDivider(id: "today", label: "Today")),
        .bubble(ChatBubbleContent(
            id: "m1",
            side: .incoming,
            body: .text("Can you send the shelf photo and measurements?"),
            hasTail: true,
            stamp: "9:12 AM",
            deliveryState: nil
        )),
        .bubble(ChatBubbleContent(
            id: "m2",
            side: .outgoing,
            body: .text("Uploading both now."),
            hasTail: true,
            stamp: "9:13 AM",
            deliveryState: .delivered
        ))
    ]

    /// Empty AI thread — renders the welcome card with capability chips.
    @MainActor
    static func aiWelcomeViewModel() -> ChatConversationViewModel {
        ChatConversationViewModel(previewState: .empty, counterparty: .ai(name: aiName))
    }

    /// Active AI thread with one estimate-card reply.
    @MainActor
    static func aiActiveViewModel() -> ChatConversationViewModel {
        ChatConversationViewModel(previewState: .loaded(rows: aiActiveRows), counterparty: .ai(name: aiName))
    }

    @MainActor
    static func fanEmptyViewModel(locked: Bool = false) -> ChatConversationViewModel {
        ChatConversationViewModel(
            previewState: .empty,
            counterparty: fanCounterparty,
            fanEntitlement: locked ? fanLockedEntitlement : fanEntitlement
        )
    }

    @MainActor
    static func fanActiveViewModel(locked: Bool = false) -> ChatConversationViewModel {
        ChatConversationViewModel(
            previewState: .loaded(rows: fanActiveRows),
            counterparty: fanCounterparty,
            fanEntitlement: locked ? fanLockedEntitlement : fanEntitlement
        )
    }

    static let fanCounterparty = ChatCounterparty.person(
        name: fanPersonaName,
        initials: "WB",
        locality: "The Sourdough Diary",
        verified: true,
        online: true
    )

    @MainActor
    static func creatorThreadViewModel() -> ChatConversationViewModel {
        ChatConversationViewModel(
            previewState: .loaded(rows: creatorThreadRows),
            counterparty: .person(
                name: creatorFanName,
                initials: "PR",
                locality: "0.4 mi",
                verified: true,
                online: true
            )
        )
    }

    @MainActor
    static func dmPhotoReadReceiptViewModel() -> ChatConversationViewModel {
        ChatConversationViewModel(
            previewState: .loaded(rows: dmPhotoReadRows),
            counterparty: dmCounterparty,
            composerText: "Deal — see you"
        )
    }

    @MainActor
    static func dmTypingViewModel() -> ChatConversationViewModel {
        ChatConversationViewModel(
            previewState: .loaded(rows: dmTypingRows),
            counterparty: dmCounterparty,
            composerText: "Deal — see you",
            isCounterpartyTyping: true
        )
    }

    @MainActor
    static func dmQueuedAttachmentsViewModel() -> ChatConversationViewModel {
        ChatConversationViewModel(
            previewState: .loaded(rows: dmQueuedAttachmentRows),
            counterparty: dmCounterparty,
            composerText: "Sounds good — see you Sat",
            queuedAttachments: queuedAttachments
        )
    }
}
