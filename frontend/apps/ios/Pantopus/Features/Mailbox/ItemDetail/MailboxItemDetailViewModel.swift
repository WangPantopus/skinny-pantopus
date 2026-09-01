//
//  MailboxItemDetailViewModel.swift
//  Pantopus
//
//  Fetches `GET /api/mailbox/v2/item/:id` + `GET /api/mailbox/v2/package/:mailId`
//  (when category = package) and handles optimistic updates for
//  `POST /api/mailbox/v2/item/:id/action` and
//  `PATCH /api/mailbox/v2/package/:mailId/status`.
//
// swiftlint:disable file_length type_body_length

import Foundation
import Observation

/// Projection of a single mailbox item for the detail screen.
public struct MailboxItemDetailContent: Sendable {
    public let category: MailItemCategory
    public let trust: MailTrust
    public let sender: SenderBlockContent
    public let aiElf: AIElfContent?
    public let keyFacts: [KeyFactRow]
    public let timeline: [TimelineStep]
    public let packageInfo: PackageBodyContent?
    public let ctaEnabled: Bool
    public let isUnread: Bool
    public let isArchived: Bool
    /// Category-specific sub-payload resolved from `mail.object_payload`.
    /// `.other` for categories without a dedicated body decoder.
    public let payload: MailboxCategoryPayload
    /// Readable body projection (body text / attachments / tags) for
    /// categories rendered through `GenericMailBody`. `nil` for categories
    /// with a bespoke body.
    public let genericBody: GenericMailBodyContent?

    public init(
        category: MailItemCategory,
        trust: MailTrust,
        sender: SenderBlockContent,
        aiElf: AIElfContent?,
        keyFacts: [KeyFactRow],
        timeline: [TimelineStep],
        packageInfo: PackageBodyContent?,
        ctaEnabled: Bool,
        isUnread: Bool = false,
        isArchived: Bool = false,
        payload: MailboxCategoryPayload = .other,
        genericBody: GenericMailBodyContent? = nil
    ) {
        self.category = category
        self.trust = trust
        self.sender = sender
        self.aiElf = aiElf
        self.keyFacts = keyFacts
        self.timeline = timeline
        self.packageInfo = packageInfo
        self.ctaEnabled = ctaEnabled
        self.isUnread = isUnread
        self.isArchived = isArchived
        self.payload = payload
        self.genericBody = genericBody
    }
}

/// Package delivery lifecycle used by the A17.8 body.
public enum PackageDeliveryStatus: String, Sendable {
    case shipped = "pre_receipt"
    case inTransit = "in_transit"
    case outForDelivery = "out_for_delivery"
    case delivered

    public init(rawStatus: String?) {
        switch rawStatus {
        case Self.shipped.rawValue: self = .shipped
        case Self.outForDelivery.rawValue: self = .outForDelivery
        case Self.delivered.rawValue: self = .delivered
        default: self = .inTransit
        }
    }
}

/// One carrier scan / handoff row for the package body.
public struct PackageHandoffStep: Identifiable, Sendable, Hashable {
    public let id: String
    public let title: String
    public let location: String
    public let timestamp: String
    public let icon: PantopusIcon

    public init(
        id: String,
        title: String,
        location: String,
        timestamp: String,
        icon: PantopusIcon
    ) {
        self.id = id
        self.title = title
        self.location = location
        self.timestamp = timestamp
        self.icon = icon
    }
}

/// Courier proof-photo metadata for delivered packages.
public struct PackageDeliveryPhoto: Sendable, Hashable {
    public let capturedAt: String
    public let watermark: String
    public let location: String
    public let verificationLabel: String
    public let isReceived: Bool

    public init(
        capturedAt: String,
        watermark: String,
        location: String,
        verificationLabel: String,
        isReceived: Bool = false
    ) {
        self.capturedAt = capturedAt
        self.watermark = watermark
        self.location = location
        self.verificationLabel = verificationLabel
        self.isReceived = isReceived
    }
}

/// One line item in the package contents card.
public struct PackageContentsItem: Identifiable, Sendable, Hashable {
    public let id: String
    public let quantity: Int
    public let name: String
    public let detail: String

    public init(id: String, quantity: Int, name: String, detail: String) {
        self.id = id
        self.quantity = quantity
        self.name = name
        self.detail = detail
    }
}

/// Optional order summary shown after tracking details.
public struct PackageContents: Sendable, Hashable {
    public let title: String
    public let items: [PackageContentsItem]
    public let subtotal: String?
    public let shipping: String?
    public let total: String?

    public init(
        title: String,
        items: [PackageContentsItem],
        subtotal: String? = nil,
        shipping: String? = nil,
        total: String? = nil
    ) {
        self.title = title
        self.items = items
        self.subtotal = subtotal
        self.shipping = shipping
        self.total = total
    }
}

/// Data for the Package body sub-card.
public struct PackageBodyContent: Sendable {
    public let carrier: String
    public let service: String?
    public let dimensions: String?
    public let weight: String?
    public let trackingUrl: String?
    public let etaLine: String?
    public let status: PackageDeliveryStatus
    public let trackingNumber: String?
    public let referenceLine: String?
    public let statusTitle: String
    public let statusDetail: String
    public let trackingSteps: [TimelineStep]
    public let handoffSteps: [PackageHandoffStep]
    public let deliveryPhoto: PackageDeliveryPhoto?
    public let contents: PackageContents?

    public init(
        carrier: String,
        service: String? = nil,
        dimensions: String? = nil,
        weight: String? = nil,
        trackingUrl: String? = nil,
        etaLine: String? = nil,
        status: PackageDeliveryStatus = .inTransit,
        trackingNumber: String? = nil,
        referenceLine: String? = nil,
        statusTitle: String? = nil,
        statusDetail: String? = nil,
        trackingSteps: [TimelineStep] = [],
        handoffSteps: [PackageHandoffStep] = [],
        deliveryPhoto: PackageDeliveryPhoto? = nil,
        contents: PackageContents? = nil
    ) {
        self.carrier = carrier
        self.service = service
        self.dimensions = dimensions
        self.weight = weight
        self.trackingUrl = trackingUrl
        self.etaLine = etaLine
        self.status = status
        self.trackingNumber = trackingNumber
        self.referenceLine = referenceLine
        self.statusTitle = statusTitle ?? Self.defaultStatusTitle(status: status)
        self.statusDetail = statusDetail ?? Self.defaultStatusDetail(status: status)
        self.trackingSteps = trackingSteps
        self.handoffSteps = handoffSteps
        self.deliveryPhoto = deliveryPhoto
        self.contents = contents
    }

    private static func defaultStatusTitle(status: PackageDeliveryStatus) -> String {
        switch status {
        case .shipped: "Shipped"
        case .inTransit: "In transit"
        case .outForDelivery: "Out for delivery"
        case .delivered: "Delivered to your porch"
        }
    }

    private static func defaultStatusDetail(status: PackageDeliveryStatus) -> String {
        switch status {
        case .shipped: "Label created by the sender."
        case .inTransit: "Moving through the carrier network."
        case .outForDelivery: "Expected today by 3 PM."
        case .delivered: "Front porch - left in shade."
        }
    }

    fileprivate func receivedCopy() -> PackageBodyContent {
        PackageBodyContent(
            carrier: carrier,
            service: service,
            dimensions: dimensions,
            weight: weight,
            trackingUrl: trackingUrl,
            etaLine: etaLine,
            status: .delivered,
            trackingNumber: trackingNumber,
            referenceLine: referenceLine,
            statusTitle: "Logged as received",
            statusDetail: "Today - by you",
            trackingSteps: trackingSteps.map { step in
                TimelineStep(id: step.id, title: step.title, subtitle: step.subtitle, state: .done)
            },
            handoffSteps: handoffSteps,
            deliveryPhoto: deliveryPhoto.map {
                PackageDeliveryPhoto(
                    capturedAt: $0.capturedAt,
                    watermark: $0.watermark,
                    location: $0.location,
                    verificationLabel: $0.verificationLabel,
                    isReceived: true
                )
            },
            contents: contents
        )
    }
}

/// Observed detail-screen state.
public enum MailboxItemDetailState: Sendable {
    case loading
    case loaded(MailboxItemDetailContent)
    case error(String)
}

/// Per-CTA busy / error flags surfaced to the view for optimistic UI.
public struct MailboxCTAFlags: Sendable {
    public var primaryLoading: Bool = false
    public var ghostLoading: Bool = false
    public var errorToast: String?
    public var primaryCompleted: Bool = false
}

/// ViewModel backing `MailboxItemDetailView`.
@Observable
@MainActor
final class MailboxItemDetailViewModel {
    /// Currently displayed state.
    private(set) var state: MailboxItemDetailState = .loading
    /// Ephemeral CTA busy / toast flags.
    var ctaFlags = MailboxCTAFlags()

    private let mailId: String
    private let api: APIClient

    /// Whether the user has checked the "I acknowledge receipt" gate on
    /// the certified body. The view binds to this; the primary CTA is
    /// only enabled once it flips true.
    var certifiedAckChecked: Bool = false

    init(mailId: String, api: APIClient = .shared) {
        self.mailId = mailId
        self.api = api
    }

    /// Initial load; no-op when already loaded.
    func load() async {
        if case .loaded = state { return }
        state = .loading
        await fetch()
    }

    /// Pull-to-refresh / retry.
    func refresh() async {
        await fetch()
    }

    // MARK: - Actions

    /// Primary CTA for Package: `PATCH .../status { status: "received" }`
    /// Marks the step as optimistically-done; rolls back on failure.
    func logAsReceived() async {
        guard case var .loaded(content) = state, !ctaFlags.primaryLoading else { return }
        Analytics.track(.ctaMailboxItemLogReceived)
        if !NetworkMonitor.shared.isOnline {
            ctaFlags.errorToast = "You're offline. Try again when you're back online."
            return
        }
        let originalTimeline = content.timeline
        let originalCtaEnabled = content.ctaEnabled
        let originalPackageInfo = content.packageInfo

        // Optimistic: flip the last .current step to .done (or append one).
        let updatedTimeline = flipCurrentToDone(originalTimeline)
        content = MailboxItemDetailContent(
            category: content.category,
            trust: content.trust,
            sender: content.sender,
            aiElf: content.aiElf,
            keyFacts: content.keyFacts,
            timeline: updatedTimeline,
            packageInfo: content.packageInfo?.receivedCopy(),
            ctaEnabled: false,
            isUnread: content.isUnread,
            isArchived: content.isArchived,
            payload: content.payload
        )
        state = .loaded(content)
        ctaFlags.primaryLoading = true

        do {
            _ = try await api.request(
                MailboxV2Endpoints.packageStatusUpdate(
                    mailId: mailId,
                    request: PackageStatusUpdateRequest(status: "delivered")
                )
            ) as PackageStatusUpdateResponse
            ctaFlags.primaryCompleted = true
        } catch {
            if case var .loaded(rollback) = state {
                rollback = MailboxItemDetailContent(
                    category: rollback.category,
                    trust: rollback.trust,
                    sender: rollback.sender,
                    aiElf: rollback.aiElf,
                    keyFacts: rollback.keyFacts,
                    timeline: originalTimeline,
                    packageInfo: originalPackageInfo,
                    ctaEnabled: originalCtaEnabled,
                    isUnread: rollback.isUnread,
                    isArchived: rollback.isArchived,
                    payload: rollback.payload
                )
                state = .loaded(rollback)
            }
            ctaFlags.errorToast = (error as? APIError)?.errorDescription ?? "Couldn't update status."
        }
        ctaFlags.primaryLoading = false
    }

    /// Ghost CTA: `POST .../action { action: "not_mine" }`.
    func markNotMine() async {
        guard case let .loaded(snapshot) = state, !ctaFlags.ghostLoading else { return }
        ctaFlags.ghostLoading = true
        do {
            _ = try await api.request(
                MailboxV2Endpoints.itemAction(mailId: mailId, action: "not_mine")
            ) as MailboxItemActionResponse
            // Disable the CTAs — the item is no longer actionable by this user.
            let disabled = MailboxItemDetailContent(
                category: snapshot.category,
                trust: snapshot.trust,
                sender: snapshot.sender,
                aiElf: snapshot.aiElf,
                keyFacts: snapshot.keyFacts,
                timeline: snapshot.timeline,
                packageInfo: snapshot.packageInfo,
                ctaEnabled: false,
                isUnread: snapshot.isUnread,
                isArchived: snapshot.isArchived,
                payload: snapshot.payload
            )
            state = .loaded(disabled)
        } catch {
            ctaFlags.errorToast = (error as? APIError)?.errorDescription ?? "Couldn't flag this item."
        }
        ctaFlags.ghostLoading = false
    }

    // MARK: - P18 unified CTA dispatch

    /// Primary CTA tap. Routes by category:
    ///   .package    → `logAsReceived()` (existing P9 flow)
    ///   .coupon     → optimistic "added to wallet" client-side flip
    ///   .booklet    → `file` action via the V2 item-action endpoint
    ///   .certified  → `acknowledge` action; gated on
    ///                 `certifiedAckChecked == true`
    /// Returns silently for any other category.
    func performPrimaryAction() async {
        guard case let .loaded(content) = state, !ctaFlags.primaryLoading else { return }
        switch content.category {
        case .package:
            await logAsReceived()
        case .coupon:
            await addToWallet()
        case .booklet:
            await saveBookletToLibrary()
        case .certified:
            guard certifiedAckChecked else { return }
            await acknowledgeReceipt()
        case .memory:
            saveMemoryToVault()
        default:
            break
        }
    }

    /// "Save to Vault" — client-side keepsake flip (no backend). Re-projects
    /// the loaded content with `isSaved == true` so the body swaps the facts
    /// grid for the vault-location card and the elf copy switches to the
    /// saved variant. No-ops if the memory is already kept.
    private func saveMemoryToVault() {
        guard case let .loaded(content) = state,
              case let .memory(memory) = content.payload,
              !memory.isSaved
        else { return }
        state = .loaded(
            MailboxItemDetailContent(
                category: content.category,
                trust: content.trust,
                sender: content.sender,
                aiElf: content.aiElf,
                keyFacts: content.keyFacts,
                timeline: content.timeline,
                packageInfo: content.packageInfo,
                ctaEnabled: content.ctaEnabled,
                isUnread: content.isUnread,
                isArchived: content.isArchived,
                payload: .memory(memory.withSaved(true))
            )
        )
    }

    /// Ghost CTA tap. Mirrors `performPrimaryAction`'s dispatch.
    func performGhostAction() async {
        guard case let .loaded(content) = state, !ctaFlags.ghostLoading else { return }
        switch content.category {
        case .package:
            await markNotMine()
        case .coupon:
            await saveCouponForLater()
        case .certified:
            // "View terms" is a UI-only modal handled by the screen.
            break
        default:
            break
        }
    }

    // MARK: - Coupon actions

    /// "Add to wallet" → POST .../action { action: "file" }. The backend
    /// has no first-class wallet endpoint yet, so we persist via the
    /// existing `file` action in the V2 whitelist
    /// (`backend/routes/mailboxV2.js:465`). When a real wallet endpoint
    /// lands, switch the action name without changing the UI.
    private func addToWallet() async {
        await callItemAction(action: "file", primary: true) {
            self.ctaFlags.primaryCompleted = true
        }
    }

    /// "Save for later" → POST .../action { action: "file" }. Same
    /// underlying action as `addToWallet` until the wallet endpoint
    /// ships; the design distinguishes the two slots by intent rather
    /// than backend effect.
    private func saveCouponForLater() async {
        await callItemAction(action: "file", primary: false)
    }

    // MARK: - Booklet actions

    /// "Save to library" → POST .../action { action: "file" }. Same
    /// rationale as `saveCouponForLater`.
    private func saveBookletToLibrary() async {
        await callItemAction(action: "file", primary: true)
    }

    // MARK: - Certified actions

    /// "Acknowledge receipt" → POST .../action { action: "acknowledge" }.
    /// `acknowledge` is in the V2 action whitelist
    /// (`backend/routes/mailboxV2.js:465`).
    private func acknowledgeReceipt() async {
        await callItemAction(action: "acknowledge", primary: true) {
            // On success: lock the CTA and visually mark as completed.
            self.ctaFlags.primaryCompleted = true
        }
    }

    /// Generic V2 item-action dispatcher with optimistic loading flag
    /// and a friendly error toast on failure.
    private func callItemAction(
        action: String,
        primary: Bool,
        onSuccess: (@MainActor () -> Void)? = nil
    ) async {
        if primary {
            ctaFlags.primaryLoading = true
        } else {
            ctaFlags.ghostLoading = true
        }
        do {
            _ = try await api.request(
                MailboxV2Endpoints.itemAction(mailId: mailId, action: action)
            ) as MailboxItemActionResponse
            onSuccess?()
        } catch {
            ctaFlags.errorToast =
                (error as? APIError)?.errorDescription ?? "Couldn't complete that action."
        }
        if primary {
            ctaFlags.primaryLoading = false
        } else {
            ctaFlags.ghostLoading = false
        }
    }

    // MARK: - Fetch

    private func fetch() async {
        do {
            let response: MailboxV2ItemResponse = try await api.request(
                MailboxV2Endpoints.item(mailId: mailId)
            )
            let category = MailItemCategory.fromRaw(
                response.mail.base.mailType ?? response.mail.base.type
            )
            switch category {
            case .package:
                await fetchPackageDetails(for: response.mail, category: category)
            case .coupon, .booklet, .certified, .community, .gig, .memory:
                applyCategoryBody(response.mail, category: category)
            default:
                applyItem(response.mail, category: category)
            }
        } catch {
            state = .error((error as? APIError)?.errorDescription ?? "Couldn't load this item.")
        }
    }

    /// Coupon / Booklet / Certified — decode `object_payload` into a
    /// typed payload and project facts + AI elf + (for Certified) chain
    /// timeline + stamp.
    private func applyCategoryBody(
        _ item: MailboxV2ItemResponse.Item,
        category: MailItemCategory
    ) {
        let payload = MailboxCategoryPayload.resolve(
            category: category,
            objectPayload: item.objectPayload
        )
        let baseTrust = MailTrust.fromRaw(item.senderTrust)
        Analytics.track(
            .screenMailboxItemDetailViewed(
                category: category.rawValue,
                trustLevel: baseTrust.rawValue
            )
        )

        switch payload {
        case let .coupon(coupon):
            applyCoupon(item: item, category: category, coupon: coupon, baseTrust: baseTrust)
        case let .booklet(booklet):
            applyBooklet(item: item, category: category, booklet: booklet, baseTrust: baseTrust)
        case let .certified(certified):
            applyCertified(item: item, category: category, certified: certified)
        case let .community(community):
            applyCommunity(item: item, category: category, community: community, baseTrust: baseTrust)
        case let .gig(gig):
            applyGig(item: item, category: category, gig: gig, baseTrust: baseTrust)
        case let .memory(memory):
            applyMemory(item: item, category: category, memory: memory)
        case .other:
            // Payload didn't decode — fall back to the placeholder body.
            applyItem(item, category: category)
        }
    }

    /// Memory (A17.7) — project the keepsake payload. The body owns the
    /// polaroid / note / facts / vault rendering; the shell only needs a
    /// verified sender block (the elf + facts are not the standard slots),
    /// so `aiElf` / `keyFacts` / `timeline` stay empty.
    private func applyMemory(
        item: MailboxV2ItemResponse.Item,
        category: MailItemCategory,
        memory: MemoryDetailDTO
    ) {
        state = .loaded(
            MailboxItemDetailContent(
                category: category,
                trust: .verified,
                sender: SenderBlockContent(
                    displayName: item.senderDisplay,
                    meta: item.base.createdAt,
                    initials: Self.initials(from: item.senderDisplay),
                    senderUserId: item.base.senderUserId
                ),
                aiElf: nil,
                keyFacts: [],
                timeline: [],
                packageInfo: nil,
                ctaEnabled: true,
                isUnread: !item.base.viewed,
                isArchived: item.base.archived,
                payload: .memory(memory)
            )
        )
    }

    /// Community (A17.4) — group seal, poll/event/update card, attendee
    /// strip, Pulse link, and RSVP controls live in `CommunityBody`, so
    /// the standard shell slots stay intentionally quiet.
    private func applyCommunity(
        item: MailboxV2ItemResponse.Item,
        category: MailItemCategory,
        community: CommunityDetailDTO,
        baseTrust: MailTrust
    ) {
        state = .loaded(
            MailboxItemDetailContent(
                category: category,
                trust: baseTrust == .unverified ? .verified : baseTrust,
                sender: SenderBlockContent(
                    displayName: item.senderDisplay,
                    meta: item.base.createdAt,
                    initials: Self.initials(from: item.senderDisplay),
                    senderUserId: item.base.senderUserId
                ),
                aiElf: nil,
                keyFacts: [],
                timeline: [],
                packageInfo: nil,
                ctaEnabled: true,
                isUnread: !item.base.viewed,
                isArchived: item.base.archived,
                payload: .community(community)
            )
        )
    }

    private func applyCoupon(
        item: MailboxV2ItemResponse.Item,
        category: MailItemCategory,
        coupon: CouponDetailDTO,
        baseTrust: MailTrust
    ) {
        let aiElf: AIElfContent? = coupon.expiresAt.flatMap { expiry in
            guard let days = Self.daysUntil(expiry), days >= 0 && days <= 30 else { return nil }
            return AIElfContent(
                suggestion: "Expires in \(days) day\(days == 1 ? "" : "s") — add to wallet before then?",
                primaryChip: "Add to wallet",
                secondaryChip: "Remind me later"
            )
        }
        var facts: [KeyFactRow] = []
        if let merchant = coupon.merchant { facts.append(KeyFactRow(label: "Merchant", value: merchant)) }
        if let code = coupon.code { facts.append(KeyFactRow(label: "Code", value: code, isCode: true)) }
        if let terms = coupon.terms { facts.append(KeyFactRow(label: "Terms", value: terms)) }
        if let minSpend = coupon.minimumSpend { facts.append(KeyFactRow(label: "Minimum spend", value: minSpend)) }

        state = .loaded(
            MailboxItemDetailContent(
                category: category,
                trust: baseTrust,
                sender: SenderBlockContent(
                    displayName: item.senderDisplay,
                    meta: item.base.createdAt,
                    initials: Self.initials(from: item.senderDisplay),
                    senderUserId: item.base.senderUserId
                ),
                aiElf: aiElf,
                keyFacts: facts,
                timeline: [],
                packageInfo: nil,
                ctaEnabled: true,
                isUnread: !item.base.viewed,
                isArchived: item.base.archived,
                payload: .coupon(coupon)
            )
        )
    }

    private func applyBooklet(
        item: MailboxV2ItemResponse.Item,
        category: MailItemCategory,
        booklet: BookletDetailDTO,
        baseTrust: MailTrust
    ) {
        let facts: [KeyFactRow] = [
            KeyFactRow(label: "Sender", value: item.senderDisplay),
            KeyFactRow(label: "Pages", value: "\(booklet.pageCount)"),
            KeyFactRow(label: "Received at", value: item.base.createdAt)
        ]
        state = .loaded(
            MailboxItemDetailContent(
                category: category,
                trust: baseTrust,
                sender: SenderBlockContent(
                    displayName: item.senderDisplay,
                    meta: item.base.createdAt,
                    initials: Self.initials(from: item.senderDisplay),
                    senderUserId: item.base.senderUserId
                ),
                aiElf: nil,
                keyFacts: facts,
                timeline: [],
                packageInfo: nil,
                ctaEnabled: true,
                isUnread: !item.base.viewed,
                isArchived: item.base.archived,
                payload: .booklet(booklet)
            )
        )
    }

    private func applyCertified(
        item: MailboxV2ItemResponse.Item,
        category: MailItemCategory,
        certified: CertifiedDetailDTO
    ) {
        let timeline: [TimelineStep] = certified.chain.map { step in
            TimelineStep(
                id: step.id,
                title: step.label,
                state: step.isComplete ? .done : .upcoming
            )
        }
        let aiElf: AIElfContent? = certified.acknowledgeBy.map { deadline in
            let days = Self.daysUntil(deadline) ?? 0
            return AIElfContent(
                suggestion: "Acknowledge by \(deadline) — \(days) day\(days == 1 ? "" : "s") remaining",
                primaryChip: "Acknowledge now",
                secondaryChip: "View terms"
            )
        }
        var facts: [KeyFactRow] = [
            KeyFactRow(label: "Reference #", value: certified.referenceNumber, isCode: true),
            KeyFactRow(label: "Sender", value: item.senderDisplay)
        ]
        if let ackBy = certified.acknowledgeBy {
            facts.append(KeyFactRow(label: "Acknowledge by", value: ackBy))
        }
        if let docType = certified.documentType {
            facts.append(KeyFactRow(label: "Document type", value: docType))
        }

        state = .loaded(
            MailboxItemDetailContent(
                category: category,
                trust: .certifiedChain,
                sender: SenderBlockContent(
                    displayName: item.senderDisplay,
                    meta: item.base.createdAt,
                    initials: Self.initials(from: item.senderDisplay),
                    senderUserId: item.base.senderUserId,
                    showStamp: true
                ),
                aiElf: aiElf,
                keyFacts: facts,
                timeline: timeline,
                packageInfo: nil,
                ctaEnabled: !certified.isAcknowledged,
                isUnread: !item.base.viewed,
                isArchived: item.base.archived,
                payload: .certified(certified)
            )
        )
    }

    /// Gig (A17.6) — the bidder becomes the sender; the rich gig surface
    /// (bidder/post/bid cards + action row or accepted timeline) lives in
    /// `GigBody`, so the shell carries no AI elf / KeyFacts / timeline and
    /// no sticky CTA shelf (the three-way action row is in the body).
    private func applyGig(
        item: MailboxV2ItemResponse.Item,
        category: MailItemCategory,
        gig: GigDetailDTO,
        baseTrust: MailTrust
    ) {
        state = .loaded(
            MailboxItemDetailContent(
                category: category,
                trust: baseTrust,
                sender: SenderBlockContent(
                    displayName: gig.bidder.name,
                    meta: item.base.createdAt,
                    initials: Self.initials(from: gig.bidder.name),
                    senderUserId: item.base.senderUserId
                ),
                aiElf: nil,
                keyFacts: [],
                timeline: [],
                packageInfo: nil,
                ctaEnabled: true,
                isUnread: !item.base.viewed,
                isArchived: item.base.archived,
                payload: .gig(gig)
            )
        )
    }

    /// Accept the incoming bid. Optimistically flips the gig payload into
    /// its accepted state (the body swaps the action row for the next-steps
    /// timeline). No network — the gig action endpoint was removed with the
    /// backend; re-point this at the real endpoint when it lands.
    func acceptGigBid() async {
        guard case let .loaded(content) = state,
              case let .gig(gig) = content.payload,
              !gig.isAccepted else { return }
        state = .loaded(
            MailboxItemDetailContent(
                category: content.category,
                trust: content.trust,
                sender: content.sender,
                aiElf: content.aiElf,
                keyFacts: content.keyFacts,
                timeline: content.timeline,
                packageInfo: content.packageInfo,
                ctaEnabled: false,
                isUnread: content.isUnread,
                isArchived: content.isArchived,
                payload: .gig(gig.accepted())
            )
        )
    }

    private func fetchPackageDetails(
        for item: MailboxV2ItemResponse.Item,
        category: MailItemCategory
    ) async {
        do {
            let pkg: PackageDetailResponse = try await api.request(
                MailboxV2Endpoints.package(mailId: mailId)
            )
            applyPackage(item: item, pkg: pkg)
        } catch {
            // Fall back to the base mail detail if package lookup fails.
            applyItem(item, category: category)
        }
    }

    private func applyItem(_ item: MailboxV2ItemResponse.Item, category: MailItemCategory) {
        let trust = MailTrust.fromRaw(item.senderTrust)
        Analytics.track(
            .screenMailboxItemDetailViewed(
                category: category.rawValue,
                trustLevel: trust.rawValue
            )
        )
        state = .loaded(
            MailboxItemDetailContent(
                category: category,
                trust: trust,
                sender: SenderBlockContent(
                    displayName: item.senderDisplay,
                    meta: item.base.createdAt,
                    initials: Self.initials(from: item.senderDisplay),
                    senderUserId: item.base.senderUserId
                ),
                aiElf: nil,
                keyFacts: [
                    KeyFactRow(label: "Subject", value: item.base.displayTitle ?? item.base.subject ?? "—"),
                    KeyFactRow(label: "Received", value: item.base.createdAt)
                ],
                timeline: [],
                packageInfo: nil,
                ctaEnabled: true,
                isUnread: !item.base.viewed,
                isArchived: item.base.archived,
                genericBody: Self.genericBody(for: item, category: category)
            )
        )
    }

    /// Projects the readable `GenericMailBody` surface from the base mail
    /// row — body paragraphs, attachments, and tags — for any category
    /// without a bespoke body.
    private static func genericBody(
        for item: MailboxV2ItemResponse.Item,
        category: MailItemCategory
    ) -> GenericMailBodyContent {
        GenericMailBodyContent(
            category: category,
            paragraphs: bodyParagraphs(from: item.base),
            attachments: item.base.attachments ?? [],
            tags: item.base.tags,
            actionLabel: actionLabel(for: item.base)
        )
    }

    /// Splits the mail's `content` (falling back to `preview_text`) into
    /// trimmed, non-empty paragraphs. Empty when no body text shipped.
    private static func bodyParagraphs(from mail: MailItem) -> [String] {
        let content = mail.content?.trimmingCharacters(in: .whitespacesAndNewlines)
        let source = (content?.isEmpty == false ? content : nil)
            ?? mail.previewText?.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let source, !source.isEmpty else { return [] }
        return source
            .components(separatedBy: "\n\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    /// Warning pill copy for the generic body header when the mail asks for
    /// acknowledgement or another action.
    private static func actionLabel(for mail: MailItem) -> String? {
        if mail.ackRequired == true { return "Acknowledge" }
        if mail.actionRequired == true { return "Action needed" }
        return nil
    }

    private func applyPackage(
        item: MailboxV2ItemResponse.Item,
        pkg: PackageDetailResponse
    ) {
        let pkgDict = pkg.package.dictValue
        let trackingNumber = pkgDict?["tracking_number"]?.stringValue
        let carrier = pkgDict?["carrier"]?.stringValue ?? "Carrier"
        let currentStatus = pkgDict?["status"]?.stringValue ?? "in_transit"
        let deliveryStatus = PackageDeliveryStatus(rawStatus: currentStatus)
        let received = pkgDict?["logged_as_received"]?.boolValue
            ?? pkgDict?["received"]?.boolValue
            ?? pkgDict?["received_at"]?.stringValue.map { _ in true }
            ?? false

        var facts: [KeyFactRow] = []
        if let trackingNumber {
            facts.append(KeyFactRow(label: "Tracking #", value: trackingNumber, isCode: true))
        }
        facts.append(KeyFactRow(label: "Sender", value: item.senderDisplay))
        facts.append(KeyFactRow(label: "Carrier", value: carrier))
        facts.append(KeyFactRow(label: "Received at", value: item.base.createdAt))

        let steps = Self.timeline(for: currentStatus)
        let trust = MailTrust.fromRaw(item.senderTrust)
        Analytics.track(
            .screenMailboxItemDetailViewed(
                category: MailItemCategory.package.rawValue,
                trustLevel: trust.rawValue
            )
        )

        state = .loaded(
            MailboxItemDetailContent(
                category: .package,
                trust: trust,
                sender: SenderBlockContent(
                    displayName: item.senderDisplay,
                    meta: pkg.sender?.display ?? carrier,
                    initials: Self.initials(from: item.senderDisplay),
                    senderUserId: item.base.senderUserId
                ),
                aiElf: nil,
                keyFacts: facts,
                timeline: steps,
                packageInfo: Self.packageBodyContent(
                    carrier: carrier,
                    trackingNumber: trackingNumber,
                    package: pkg,
                    status: deliveryStatus,
                    received: received
                ),
                ctaEnabled: deliveryStatus == .delivered && !received,
                isUnread: !item.base.viewed,
                isArchived: item.base.archived
            )
        )
    }

    // MARK: - Helpers

    private static func initials(from display: String) -> String {
        let parts = display.split(separator: " ").prefix(2)
        return parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
    }

    /// Number of whole days from now until the supplied ISO-8601 string,
    /// rounded down. Accepts both full timestamps
    /// (`2026-05-31T12:00:00Z`) and date-only strings (`2026-05-31`).
    /// Returns nil if the string can't be parsed; negative when the
    /// date is in the past.
    static func daysUntil(_ iso: String) -> Int? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let parsed =
            formatter.date(from: iso)
                ?? ISO8601DateFormatter().date(from: iso)
                ?? dateOnlyFormatter.date(from: iso)
        guard let date = parsed else { return nil }
        let interval = date.timeIntervalSinceNow
        return Int((interval / 86400).rounded(.down))
    }

    private static let dateOnlyFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()

    private static func timeline(for status: String) -> [TimelineStep] {
        let deliveryStatus = PackageDeliveryStatus(rawStatus: status)
        return MailItemSampleData.packageTrackingSteps(status: deliveryStatus)
    }

    private static func packageBodyContent(
        carrier: String,
        trackingNumber: String?,
        package: PackageDetailResponse,
        status: PackageDeliveryStatus,
        received: Bool
    ) -> PackageBodyContent {
        let sample = MailItemSampleData.packageBody(status: status)
        let packageDict = package.package.dictValue ?? [:]
        let referenceLine =
            packageDict["reference"]?.stringValue
                ?? packageDict["reference_line"]?.stringValue
                ?? sample.referenceLine
        let statusTitle =
            packageDict["status_title"]?.stringValue
                ?? packageDict["status_label"]?.stringValue
                ?? sample.statusTitle
        let statusDetail =
            packageDict["status_detail"]?.stringValue
                ?? packageDict["eta_line"]?.stringValue
                ?? sample.statusDetail
        let photo = packagePhoto(from: packageDict, fallback: sample.deliveryPhoto, received: received)
        let handoffs = packageHandoffSteps(from: package.timeline, fallback: sample.handoffSteps)
        return PackageBodyContent(
            carrier: carrier,
            etaLine: packageDict["eta_line"]?.stringValue ?? sample.etaLine,
            status: status,
            trackingNumber: trackingNumber ?? sample.trackingNumber,
            referenceLine: referenceLine,
            statusTitle: received ? "Logged as received" : statusTitle,
            statusDetail: received ? "Today - by you" : statusDetail,
            trackingSteps: MailItemSampleData.packageTrackingSteps(status: status).map { step in
                if received {
                    TimelineStep(id: step.id, title: step.title, subtitle: step.subtitle, state: .done)
                } else {
                    step
                }
            },
            handoffSteps: handoffs,
            deliveryPhoto: photo,
            contents: sample.contents
        )
    }

    private static func packageHandoffSteps(
        from timeline: [JSONValue],
        fallback: [PackageHandoffStep]
    ) -> [PackageHandoffStep] {
        let decoded = timeline.enumerated().compactMap { index, raw -> PackageHandoffStep? in
            guard let dict = raw.dictValue else { return nil }
            let title = dict["label"]?.stringValue
                ?? dict["title"]?.stringValue
                ?? dict["status"]?.stringValue
            guard let title, !title.isEmpty else { return nil }
            return PackageHandoffStep(
                id: dict["id"]?.stringValue ?? "handoff-\(index)",
                title: title,
                location: dict["where"]?.stringValue
                    ?? dict["location"]?.stringValue
                    ?? "Carrier network",
                timestamp: dict["when"]?.stringValue
                    ?? dict["timestamp"]?.stringValue
                    ?? dict["occurred_at"]?.stringValue
                    ?? "Pending",
                icon: icon(named: dict["icon"]?.stringValue)
            )
        }
        return decoded.isEmpty ? fallback : decoded
    }

    private static func packagePhoto(
        from dict: [String: JSONValue],
        fallback: PackageDeliveryPhoto?,
        received: Bool
    ) -> PackageDeliveryPhoto? {
        let photoDict = dict["delivery_photo"]?.dictValue ?? dict["photo"]?.dictValue
        guard let fallback else {
            guard let photoDict else { return nil }
            return PackageDeliveryPhoto(
                capturedAt: photoDict["captured_at"]?.stringValue
                    ?? photoDict["time"]?.stringValue
                    ?? "Delivery scan",
                watermark: photoDict["watermark"]?.stringValue
                    ?? photoDict["captured_at"]?.stringValue
                    ?? "Courier proof photo",
                location: photoDict["location"]?.stringValue
                    ?? photoDict["where"]?.stringValue
                    ?? "Delivery location",
                verificationLabel: photoDict["verification_label"]?.stringValue
                    ?? "Verified",
                isReceived: received
            )
        }
        guard let photoDict else {
            return PackageDeliveryPhoto(
                capturedAt: fallback.capturedAt,
                watermark: fallback.watermark,
                location: fallback.location,
                verificationLabel: fallback.verificationLabel,
                isReceived: received || fallback.isReceived
            )
        }
        return PackageDeliveryPhoto(
            capturedAt: photoDict["captured_at"]?.stringValue
                ?? photoDict["time"]?.stringValue
                ?? fallback.capturedAt,
            watermark: photoDict["watermark"]?.stringValue ?? fallback.watermark,
            location: photoDict["location"]?.stringValue
                ?? photoDict["where"]?.stringValue
                ?? fallback.location,
            verificationLabel: photoDict["verification_label"]?.stringValue
                ?? fallback.verificationLabel,
            isReceived: received || fallback.isReceived
        )
    }

    private static func icon(named raw: String?) -> PantopusIcon {
        switch raw {
        case "home": .home
        case "building-2": .building2
        case "tag": .tag
        case "camera": .camera
        case "map-pin": .mapPin
        case "package", "package-2", "truck": .package
        case "arrow-right": .arrowRight
        default: .circle
        }
    }

    private func flipCurrentToDone(_ steps: [TimelineStep]) -> [TimelineStep] {
        guard let index = steps.firstIndex(where: { $0.state == .current }) else { return steps }
        var updated = steps
        updated[index] = TimelineStep(
            id: steps[index].id,
            title: steps[index].title,
            subtitle: steps[index].subtitle,
            state: .done
        )
        if index + 1 < updated.count {
            updated[index + 1] = TimelineStep(
                id: steps[index + 1].id,
                title: steps[index + 1].title,
                subtitle: steps[index + 1].subtitle,
                state: .current
            )
        }
        return updated
    }
}
