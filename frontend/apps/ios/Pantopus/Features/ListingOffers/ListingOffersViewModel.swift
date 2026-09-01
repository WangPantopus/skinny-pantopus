//
//  ListingOffersViewModel.swift
//  Pantopus
//
//  T5.3.4 — Listing offers. The offers panel for a SINGLE listing
//  (distinct from `Offers`, the cross-listing panel). Drives the shared
//  `ListOfRowsView` archetype + the listing-context header that sits
//  above the flat offer list.
//
//  Design contract (listingoffers-frames.jsx):
//    - Top bar: back chevron + "Listing offers" title + listing subtitle
//      ("Mid-century walnut credenza") + share trailing icon
//    - NO tabs (this panel is scoped to one listing)
//    - NO FAB (offers are created from a listing detail, not here)
//    - `ListingContextConfig` hero card with thumbnail, title, ask,
//      views/watching/posted meta, status chip + a sort strip below
//      ("5 offers · Highest offer")
//    - Each row uses Shape C minus tabs:
//        leading  : 44pt avatar of the buyer (with optional verified
//                   badge)
//        title    : buyer name
//        trailing : priceStack — offer amount + "asking $X"
//        subtitle : "{relationship} · {time}" (neighborhood degrades to
//                   nil when the backend doesn't enrich the buyer card
//                   with city / state — listing offers' enrichment is
//                   first_name / last_name / username only today)
//        chips    : status chip + optional counter pill
//        metaTail : "N days old · 1 of M offers"
//        footer   :
//          pending   → [Counter (ghost), Accept (primary)]
//          countered → [Withdraw counter (destructive ghost),
//                       Send counter (primary)]
//          accepted  → [View transaction (primary)] — single button
//          declined  → no footer
//    - Top offer (highest amount among pending) gets the `LEADING`
//      highlight (amber border + badge), per the design.
//
//  Backend (existing, no new endpoints — see
//    `backend/routes/listingOffers.js`):
//    - GET    /api/listings/:listingId/offers
//    - POST   /api/listings/:listingId/offers/:offerId/accept
//    - POST   /api/listings/:listingId/offers/:offerId/decline
//    - POST   /api/listings/:listingId/offers/:offerId/counter
//

import Foundation
import Observation
import SwiftUI

// swiftlint:disable file_length type_body_length

// MARK: - Status

/// Status lifecycle for a listing offer. Backend enum values are
/// `pending / accepted / declined / countered / expired / withdrawn /
/// completed`; the design buckets them into four chip variants.
public enum ListingOfferStatus: Sendable, Hashable {
    case pending
    case countered
    case accepted
    case declined
    case expired
    case withdrawn
    case completed

    /// Map a raw backend status string into the canonical case. Unknown
    /// strings fall through to `.pending` so the row still renders.
    public static func fromRaw(_ raw: String?) -> ListingOfferStatus {
        switch (raw ?? "").lowercased() {
        case "pending": .pending
        case "countered": .countered
        case "accepted": .accepted
        case "declined", "rejected": .declined
        case "expired": .expired
        case "withdrawn": .withdrawn
        case "completed": .completed
        default: .pending
        }
    }

    public var label: String {
        switch self {
        case .pending: "Pending"
        case .countered: "Countered"
        case .accepted: "Accepted"
        case .declined: "Declined"
        case .expired: "Expired"
        case .withdrawn: "Withdrawn"
        case .completed: "Completed"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .pending: .sparkles
        case .countered: .arrowsRepeat
        case .accepted: .check
        case .declined: .x
        case .expired: .timer
        case .withdrawn: .arrowLeft
        case .completed: .checkCheck
        }
    }

    public var chipVariant: StatusChipVariant {
        switch self {
        case .pending: .personal
        case .countered: .warning
        case .accepted, .completed: .success
        case .declined, .expired, .withdrawn: .neutral
        }
    }
}

// MARK: - Footer

/// Footer-action archetype per the task's `footer per status` contract.
/// The shell renders each variant as 1–2 `CompactButton.footer` (34pt)
/// entries above the divider.
public enum ListingOfferFooter: Sendable, Hashable {
    /// Pending offer — Counter (ghost) + Accept (primary).
    case respondPending
    /// Countered offer — Withdraw counter (destructive ghost) +
    /// Send counter (primary).
    ///
    /// The backend only allows countering `pending` offers, so
    /// "Send counter" on a countered offer will surface a 409 error
    /// (handled by the optimistic-rollback path). "Withdraw counter"
    /// maps to the decline endpoint — the closest semantic equivalent
    /// the backend exposes today.
    case undoCounter
    /// Accepted offer — single full-width "View transaction" button.
    case viewTransaction
    /// Completed offer — "View transaction" + "Leave a review" (BLOCK 2D).
    /// The review POSTs to `/api/transaction-reviews`; the backend only
    /// accepts reviews on `completed` transactions.
    case reviewTransaction
    /// Declined offer — no footer.
    case none
}

// MARK: - Counter sheet target

/// Lightweight presentation contract for the "Counter offer" sheet. The
/// view binds these fields directly; the VM owns the lifecycle.
public struct CounterSheetTarget: Identifiable, Sendable {
    public let id: String
    public let buyerName: String
    public let originalAmount: Double?
    public let suggestedAmount: Double?

    public init(
        id: String,
        buyerName: String,
        originalAmount: Double?,
        suggestedAmount: Double?
    ) {
        self.id = id
        self.buyerName = buyerName
        self.originalAmount = originalAmount
        self.suggestedAmount = suggestedAmount
    }
}

// MARK: - Listing category mapping

/// Eight listing-category buckets that drive the header thumbnail's
/// icon-on-gradient leading. Keeps the call site free of hex literals
/// + free of category-specific switch logic.
public enum ListingOffersCategory: Sendable, Hashable {
    case furniture
    case electronics
    case clothing
    case tools
    case booksMedia
    case freeStuff
    case rentals
    case vehicles
    case other

    public static func from(rawCategory: String?, layer: String?) -> ListingOffersCategory {
        if (layer ?? "").lowercased() == "vehicles" { return .vehicles }
        if (layer ?? "").lowercased() == "rentals" { return .rentals }
        let key = (rawCategory ?? "")
            .lowercased()
            .replacingOccurrences(of: "_", with: "")
            .replacingOccurrences(of: "-", with: "")
            .replacingOccurrences(of: " ", with: "")
        switch key {
        case "furniture", "home", "homegoods": return .furniture
        case "electronics", "tech", "tv": return .electronics
        case "clothing", "clothes", "apparel": return .clothing
        case "tools", "hardware": return .tools
        case "books", "booksmedia", "media": return .booksMedia
        case "freestuff", "free": return .freeStuff
        default: return .other
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .furniture: .home
        case .electronics: .lightbulb
        case .clothing: .shoppingBag
        case .tools: .hammer
        case .booksMedia: .file
        case .freeStuff: .heart
        case .rentals: .calendar
        case .vehicles: .send
        case .other: .shoppingBag
        }
    }

    /// Two-stop gradient sourced from theme tokens.
    public var gradient: GradientPair {
        switch self {
        case .furniture:
            GradientPair(start: Theme.Color.business, end: Theme.Color.primary700)
        case .electronics:
            GradientPair(start: Theme.Color.tech, end: Theme.Color.primary700)
        case .clothing:
            GradientPair(start: Theme.Color.personal, end: Theme.Color.primary600)
        case .tools:
            GradientPair(start: Theme.Color.handyman, end: Theme.Color.warning)
        case .booksMedia:
            GradientPair(start: Theme.Color.tutoring, end: Theme.Color.primary600)
        case .freeStuff:
            GradientPair(start: Theme.Color.success, end: Theme.Color.petCare)
        case .rentals:
            GradientPair(start: Theme.Color.home, end: Theme.Color.primary600)
        case .vehicles:
            GradientPair(start: Theme.Color.delivery, end: Theme.Color.primary700)
        case .other:
            GradientPair(start: Theme.Color.primary600, end: Theme.Color.primary700)
        }
    }
}

// MARK: - Buyer-avatar tone

/// Six categorical avatar tones the design rotates through so that
/// rows in the same scroll feel visually distinct. Maps to the
/// existing `AvatarBackground` cases via theme tokens. Selection is a
/// deterministic hash of the buyer id so the same user always renders
/// in the same colour.
public enum ListingOffersAvatarTone: Sendable, CaseIterable {
    case sky, teal, amber, rose, violet, slate

    public var background: AvatarBackground {
        switch self {
        case .sky: .solid(Theme.Color.personalBg)
        case .teal: .solid(Theme.Color.successBg)
        case .amber: .solid(Theme.Color.warningBg)
        case .rose: .solid(Theme.Color.errorBg)
        case .violet: .solid(Theme.Color.businessBg)
        case .slate: .solid(Theme.Color.appSurfaceSunken)
        }
    }

    public static func deterministic(for seed: String) -> ListingOffersAvatarTone {
        let cases = ListingOffersAvatarTone.allCases
        let value = seed.utf8.reduce(0) { acc, byte in (acc &* 31) &+ Int(byte) }
        let index = abs(value) % cases.count
        return cases[index]
    }
}

// MARK: - View model

@Observable
@MainActor
public final class ListingOffersViewModel: ListOfRowsDataSource {
    // MARK: - Public chrome

    public let title = "Listing offers"

    public var topBarAction: TopBarAction? {
        TopBarAction(
            icon: .share,
            accessibilityLabel: "Share listing"
        ) { [weak self] in
            guard let self else { return }
            Task { @MainActor in self.onShareListing() }
        }
    }

    public var tabs: [ListOfRowsTab] {
        []
    }

    public var selectedTab: String = "" {
        didSet { /* no tabs */ }
    }

    public var fab: FABAction? {
        nil
    }

    public private(set) var state: ListOfRowsState = .loading

    public var listingContext: ListingContextConfig? {
        guard let listing else { return loadingContext }
        return Self.context(
            for: listing,
            offerCount: offers.count,
            sortLabel: sort.label,
            sortOptions: sortMenuOptions(),
            onSort: nil
        ) { [weak self] in
            guard let self else { return }
            Task { @MainActor in self.onEditPrice() }
        }
    }

    /// Build the sort-menu options off the canonical `ListingOffersSort`
    /// list, marking the active one. The `select` handler hops to the
    /// main actor and re-projects in place.
    private func sortMenuOptions() -> [ListingContextSortOption] {
        ListingOffersSort.allCases.map { option in
            ListingContextSortOption(
                id: option.rawValue,
                label: option.label,
                isSelected: option == sort
            ) { [weak self] in
                Task { @MainActor in self?.selectSort(option) }
            }
        }
    }

    /// Bound to the view's `.sheet(item:)` to drive the counter
    /// confirmation flow.
    public var counterTarget: CounterSheetTarget?

    /// Bound to the view's `.sheet(item:)` to drive the transaction-review
    /// flow on a completed offer (BLOCK 2D).
    public var leaveReviewTarget: TransactionReviewSheetTarget?

    // MARK: - Dependencies

    private let listingId: String
    private let listingTitleHint: String?
    private let api: APIClient
    private let onShareListing: @MainActor () -> Void
    private let onOpenBuyer: @MainActor (ListingOfferUserDTO) -> Void
    private let onOpenTransaction: @MainActor (ListingOfferDTO) -> Void
    private let onEditPrice: @MainActor () -> Void
    private let currentUserId: @MainActor () -> String?
    private let checkout: CheckoutCoordinator
    private let now: @Sendable () -> Date

    // MARK: - Local data

    private var offers: [ListingOfferDTO] = []
    private(set) var listing: ListingDTO?
    private var loadedAtLeastOnce = false
    private var sort: ListingOffersSort = .highestOffer

    /// Sort options surfaced via the sort menu on the listing-context
    /// strip. Default is `.highestOffer`. "Buyer rating" isn't offered —
    /// the listing-offers payload doesn't carry buyer reputation.
    public enum ListingOffersSort: String, Sendable, Hashable, CaseIterable {
        case highestOffer
        case lowestOffer
        case newestFirst
        case oldestFirst

        public var label: String {
            switch self {
            case .highestOffer: "Highest offer"
            case .lowestOffer: "Lowest offer"
            case .newestFirst: "Newest first"
            case .oldestFirst: "Oldest first"
            }
        }
    }

    init(
        listingId: String,
        listingTitleHint: String? = nil,
        api: APIClient = .shared,
        onShareListing: @escaping @MainActor () -> Void = {},
        onOpenBuyer: @escaping @MainActor (ListingOfferUserDTO) -> Void = { _ in },
        onOpenTransaction: @escaping @MainActor (ListingOfferDTO) -> Void = { _ in },
        onEditPrice: @escaping @MainActor () -> Void = {},
        currentUserId: @escaping @MainActor () -> String? = ListingOffersViewModel.currentSignedInUserId,
        checkout: CheckoutCoordinator = CheckoutCoordinator(),
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.listingId = listingId
        self.listingTitleHint = listingTitleHint
        self.api = api
        self.onShareListing = onShareListing
        self.onOpenBuyer = onOpenBuyer
        self.onOpenTransaction = onOpenTransaction
        self.onEditPrice = onEditPrice
        self.currentUserId = currentUserId
        self.checkout = checkout
        self.now = now
    }

    // MARK: - ListOfRowsDataSource

    public func load() async {
        if !loadedAtLeastOnce { state = .loading }
        await fetchAll()
    }

    public func refresh() async {
        await fetchAll()
    }

    public func loadMoreIfNeeded() async {}

    // MARK: - Fetching

    private func fetchAll() async {
        // Run both requests serially so the SequencedURLProtocol stub
        // in tests stays deterministic. Listing detail and offers are
        // both fast and cached server-side.
        let listingResult = await fetchListing()
        let offersResult = await fetchOffers()
        switch (listingResult, offersResult) {
        case let (.success(detail), .success(items)):
            listing = detail
            offers = items
            loadedAtLeastOnce = true
            rebuild()
        case let (.failure(error), _), let (_, .failure(error)):
            if !loadedAtLeastOnce {
                state = .error(message: error.errorDescription ?? "Couldn't load offers.")
            }
        }
    }

    private func fetchListing() async -> Result<ListingDTO, APIError> {
        do {
            let response: ListingDetailResponse = try await api.request(
                ListingsEndpoints.detail(id: listingId)
            )
            return .success(response.listing)
        } catch {
            return .failure((error as? APIError) ?? .invalidResponse)
        }
    }

    private func fetchOffers() async -> Result<[ListingOfferDTO], APIError> {
        do {
            let response: ListingOffersResponse = try await api.request(
                ListingOffersEndpoints.list(listingId: listingId)
            )
            return .success(response.offers)
        } catch {
            return .failure((error as? APIError) ?? .invalidResponse)
        }
    }

    // MARK: - State projection

    private func rebuild() {
        if offers.isEmpty {
            state = .empty(emptyContent())
            return
        }
        let sorted = sortedOffers()
        let leadingId = leadingOfferId()
        let total = sorted.count
        let nowSnapshot = now()
        let rows = sorted.enumerated().map { index, dto in
            let context = RowProjectionContext(
                index: index,
                total: total,
                askingPrice: listing?.price,
                isLeading: dto.id == leadingId,
                now: nowSnapshot,
                callbacks: callbacks(for: dto)
            )
            return Self.row(
                offer: dto,
                context: context
            )
        }
        state = .loaded(sections: [RowSection(id: "offers", rows: rows)], hasMore: false)
    }

    private func emptyContent() -> ListOfRowsState.EmptyContent {
        ListOfRowsState.EmptyContent(
            icon: .handCoins,
            headline: "No offers on this listing yet",
            subcopy: "Most listings draw their first offer within 24 hours. "
                + "Share it with a few neighborhoods to speed things up.",
            ctaTitle: "Share listing"
        ) { [weak self] in
            Task { @MainActor in self?.onShareListing() }
        }
    }

    // MARK: - Callbacks

    /// Bundle of per-row callbacks. Mirrors the `RowCallbacks` shape on
    /// the My-bids VM so tests can assert the wiring without standing
    /// up real network state.
    public struct RowCallbacks: Sendable {
        public let onTap: @Sendable () -> Void
        public let onAccept: @Sendable () -> Void
        public let onCounter: @Sendable () -> Void
        public let onDecline: @Sendable () -> Void
        public let onViewTransaction: @Sendable () -> Void
        public let onLeaveReview: @Sendable () -> Void

        public init(
            onTap: @escaping @Sendable () -> Void = {},
            onAccept: @escaping @Sendable () -> Void = {},
            onCounter: @escaping @Sendable () -> Void = {},
            onDecline: @escaping @Sendable () -> Void = {},
            onViewTransaction: @escaping @Sendable () -> Void = {},
            onLeaveReview: @escaping @Sendable () -> Void = {}
        ) {
            self.onTap = onTap
            self.onAccept = onAccept
            self.onCounter = onCounter
            self.onDecline = onDecline
            self.onViewTransaction = onViewTransaction
            self.onLeaveReview = onLeaveReview
        }
    }

    public struct RowProjectionContext: Sendable {
        public let index: Int
        public let total: Int
        public let askingPrice: Double?
        public let isLeading: Bool
        public let now: Date
        public let callbacks: RowCallbacks

        public init(
            index: Int,
            total: Int,
            askingPrice: Double?,
            isLeading: Bool,
            now: Date,
            callbacks: RowCallbacks
        ) {
            self.index = index
            self.total = total
            self.askingPrice = askingPrice
            self.isLeading = isLeading
            self.now = now
            self.callbacks = callbacks
        }
    }

    private func callbacks(for dto: ListingOfferDTO) -> RowCallbacks {
        RowCallbacks(
            onTap: { [weak self] in
                guard let self, let buyer = dto.buyer else { return }
                Task { @MainActor in self.onOpenBuyer(buyer) }
            },
            onAccept: { [weak self] in
                guard let self else { return }
                Task { @MainActor in await self.acceptOffer(dto) }
            },
            onCounter: { [weak self] in
                guard let self else { return }
                Task { @MainActor in self.requestCounter(dto) }
            },
            onDecline: { [weak self] in
                guard let self else { return }
                Task { @MainActor in await self.declineOffer(dto) }
            },
            onViewTransaction: { [weak self] in
                guard let self else { return }
                Task { @MainActor in self.onOpenTransaction(dto) }
            },
            onLeaveReview: { [weak self] in
                guard let self else { return }
                Task { @MainActor in self.requestLeaveReview(dto) }
            }
        )
    }

    /// Switch the active sort and re-project. Selection is in-memory, so
    /// it persists for the session but resets on a fresh push.
    public func selectSort(_ newSort: ListingOffersSort) {
        guard newSort != sort else { return }
        sort = newSort
        rebuild()
    }

    // MARK: - Mutations

    public func acceptOffer(_ dto: ListingOfferDTO) async {
        let previous = offers
        applyOptimisticStatus(for: dto.id, status: "accepted")
        do {
            let response: ListingOfferResponse = try await api.request(
                ListingOffersEndpoints.accept(listingId: listingId, offerId: dto.id)
            )
            let accepted = response.offer
            replace(offer: accepted)
            if shouldCheckoutAcceptedOffer(accepted, fallback: dto) {
                let outcome = await checkout.pay(CheckoutRequest(
                    listingId: accepted.listingId ?? dto.listingId ?? listingId,
                    offerId: accepted.id,
                    description: listing?.title ?? listingTitleHint
                ))
                if outcome == .paid {
                    await refresh()
                }
            }
        } catch {
            offers = previous
            rebuild()
        }
    }

    private func shouldCheckoutAcceptedOffer(_ offer: ListingOfferDTO, fallback: ListingOfferDTO? = nil) -> Bool {
        guard ListingOfferStatus.fromRaw(offer.status) == .accepted,
              let me = currentUserId(),
              !me.isEmpty else { return false }
        return me == (offer.buyerId ?? offer.buyer?.id ?? fallback?.buyerId ?? fallback?.buyer?.id)
    }

    public func declineOffer(_ dto: ListingOfferDTO) async {
        let previous = offers
        applyOptimisticStatus(for: dto.id, status: "declined")
        do {
            let response: ListingOfferResponse = try await api.request(
                ListingOffersEndpoints.decline(listingId: listingId, offerId: dto.id)
            )
            replace(offer: response.offer)
        } catch {
            offers = previous
            rebuild()
        }
    }

    /// Open the counter sheet for the offer. The actual POST runs from
    /// `confirmCounter` once the user enters an amount.
    public func requestCounter(_ dto: ListingOfferDTO) {
        counterTarget = CounterSheetTarget(
            id: dto.id,
            buyerName: Self.displayName(for: dto.buyer),
            originalAmount: dto.amount,
            suggestedAmount: dto.amount ?? listing?.price
        )
    }

    public func cancelCounter() {
        counterTarget = nil
    }

    // MARK: - Leave review (BLOCK 2D)

    /// Resolve the signed-in user id so the panel can address the *other*
    /// party as the reviewee. Mirrors `GigDetailViewModel`'s accessor.
    @MainActor
    public static func currentSignedInUserId() -> String? {
        if case let .signedIn(user) = AuthManager.shared.state { return user.id }
        return nil
    }

    /// Open the transaction-review sheet for a completed offer. The reviewee
    /// is whichever party the signed-in viewer is not; this panel is
    /// seller-side, so it defaults to reviewing the buyer.
    public func requestLeaveReview(_ dto: ListingOfferDTO) {
        let me = currentUserId()
        let reviewedId: String?
        let reviewedName: String?
        if let me, me == dto.buyerId {
            reviewedId = dto.sellerId ?? dto.seller?.id
            reviewedName = Self.displayName(for: dto.seller)
        } else {
            reviewedId = dto.buyerId ?? dto.buyer?.id
            reviewedName = Self.displayName(for: dto.buyer)
        }
        guard let reviewedId else { return }
        leaveReviewTarget = TransactionReviewSheetTarget(
            id: dto.id,
            context: .listingSale,
            reviewedId: reviewedId,
            reviewedName: reviewedName,
            transactionTitle: listing?.title ?? listingTitleHint ?? "this sale",
            listingId: dto.listingId,
            offerId: dto.id
        )
    }

    /// Tear down the review sheet without committing.
    public func cancelLeaveReview() {
        leaveReviewTarget = nil
    }

    /// Submit the review draft. The sheet renders the result (submitted /
    /// duplicate / failed); only `cancelLeaveReview` dismisses it.
    public func submitLeaveReview(
        _ draft: TransactionReviewDraft
    ) async -> TransactionReviewSubmitResult {
        guard let target = leaveReviewTarget else { return .failed("No review in progress.") }
        let body = CreateTransactionReviewBody(
            reviewedId: target.reviewedId,
            context: target.context.wireValue,
            listingId: target.listingId,
            offerId: target.offerId,
            tradeId: target.tradeId,
            gigId: target.gigId,
            rating: draft.rating,
            comment: draft.comment,
            communicationRating: draft.communicationRating,
            accuracyRating: draft.accuracyRating,
            punctualityRating: draft.punctualityRating
        )
        do {
            _ = try await api.request(
                TransactionReviewsEndpoints.create(body: body),
                as: EmptyResponse.self
            )
            return .submitted
        } catch let APIError.clientError(status, _) where status == 409 {
            return .duplicate
        } catch {
            return .failed(
                (error as? APIError)?.errorDescription ?? "Couldn't submit your review."
            )
        }
    }

    /// Send the counter offer. Reverts the optimistic update on failure
    /// (the backend may 409 on "only pending offers can be countered" if
    /// the row was already accepted/declined by another session).
    public func confirmCounter(amount: Double, message: String? = nil) async {
        guard let target = counterTarget else { return }
        counterTarget = nil
        let previous = offers
        applyOptimisticStatus(for: target.id, status: "countered", counterAmount: amount)
        do {
            let response: ListingOfferResponse = try await api.request(
                ListingOffersEndpoints.counter(
                    listingId: listingId,
                    offerId: target.id,
                    body: CounterListingOfferBody(counterAmount: amount, counterMessage: message)
                )
            )
            replace(offer: response.offer)
        } catch {
            offers = previous
            rebuild()
        }
    }

    private func applyOptimisticStatus(
        for offerId: String,
        status: String,
        counterAmount: Double? = nil
    ) {
        guard let index = offers.firstIndex(where: { $0.id == offerId }) else { return }
        let previous = offers[index]
        offers[index] = ListingOfferDTO(
            id: previous.id,
            listingId: previous.listingId,
            buyerId: previous.buyerId,
            sellerId: previous.sellerId,
            amount: previous.amount,
            message: previous.message,
            status: status,
            counterAmount: counterAmount ?? previous.counterAmount,
            counterMessage: previous.counterMessage,
            parentOfferId: previous.parentOfferId,
            expiresAt: previous.expiresAt,
            respondedAt: ISO8601DateFormatter().string(from: Date()),
            completedAt: previous.completedAt,
            createdAt: previous.createdAt,
            updatedAt: ISO8601DateFormatter().string(from: Date()),
            buyer: previous.buyer,
            seller: previous.seller
        )
        rebuild()
    }

    private func replace(offer: ListingOfferDTO) {
        if let index = offers.firstIndex(where: { $0.id == offer.id }) {
            // Preserve the inlined buyer/seller from our enriched fetch;
            // the mutation endpoints return the bare offer row.
            let previous = offers[index]
            offers[index] = ListingOfferDTO(
                id: offer.id,
                listingId: offer.listingId ?? previous.listingId,
                buyerId: offer.buyerId ?? previous.buyerId,
                sellerId: offer.sellerId ?? previous.sellerId,
                amount: offer.amount ?? previous.amount,
                message: offer.message ?? previous.message,
                status: offer.status,
                counterAmount: offer.counterAmount ?? previous.counterAmount,
                counterMessage: offer.counterMessage ?? previous.counterMessage,
                parentOfferId: offer.parentOfferId ?? previous.parentOfferId,
                expiresAt: offer.expiresAt ?? previous.expiresAt,
                respondedAt: offer.respondedAt ?? previous.respondedAt,
                completedAt: offer.completedAt ?? previous.completedAt,
                createdAt: offer.createdAt ?? previous.createdAt,
                updatedAt: offer.updatedAt ?? previous.updatedAt,
                buyer: previous.buyer,
                seller: previous.seller
            )
        } else {
            offers.append(offer)
        }
        rebuild()
    }

    // MARK: - Pure projections (test surface)

    /// Render a single row. Pure — tests assert the mapping without
    /// touching network state.
    public static func row(
        offer: ListingOfferDTO,
        context: RowProjectionContext
    ) -> RowModel {
        let status = ListingOfferStatus.fromRaw(offer.status)
        let footer = footerFor(status: status)
        let buyerName = displayName(for: offer.buyer)
        let tone = ListingOffersAvatarTone.deterministic(for: offer.buyer?.id ?? offer.id)
        let amount = Self.formatPrice(offer.amount)
        let asking = Self.formatAskingSublabel(context.askingPrice)
        let statusChip = RowChip(
            text: status.label,
            icon: status.icon,
            tint: .status(status.chipVariant)
        )
        var chips = [statusChip]
        if status == .countered, let counter = offer.counterAmount {
            chips.append(
                RowChip(
                    text: "Your counter \(formatPrice(counter))",
                    icon: .arrowsRepeat,
                    tint: .custom(
                        background: Theme.Color.appSurfaceSunken,
                        foreground: Theme.Color.appTextStrong
                    )
                )
            )
        }
        return RowModel(
            id: offer.id,
            title: buyerName,
            subtitle: subtitle(for: offer, now: context.now),
            template: .statusChip,
            leading: .avatarWithBadge(
                name: buyerName,
                imageURL: offer.buyer?.profilePictureUrl.flatMap(URL.init(string:)),
                background: tone.background,
                size: .large,
                verified: false
            ),
            trailing: .priceStack(amount: amount, sublabel: asking),
            onTap: context.callbacks.onTap,
            chips: chips,
            metaTail: metaTail(for: offer, index: context.index, total: context.total, now: context.now),
            note: offer.message?.isEmpty == false ? offer.message : nil,
            highlight: context.isLeading ? .leading : nil,
            footer: footerActions(for: footer, callbacks: context.callbacks)
        )
    }

    public static func footerFor(status: ListingOfferStatus) -> ListingOfferFooter {
        switch status {
        case .pending: .respondPending
        case .countered: .undoCounter
        case .accepted: .viewTransaction
        case .completed: .reviewTransaction
        case .declined, .expired, .withdrawn: .none
        }
    }

    public static func subtitle(for offer: ListingOfferDTO, now: Date) -> String {
        var parts: [String] = []
        // Listing offers' enrichment doesn't include city/neighborhood
        // yet — we keep the trust-tier placeholder ("New neighbor")
        // off until a follow-up extends the user payload.
        if let time = formatRelativeTime(offer.createdAt, now: now) {
            parts.append(time)
        }
        if parts.isEmpty { return "" }
        return parts.joined(separator: " · ")
    }

    public static func metaTail(
        for offer: ListingOfferDTO,
        index: Int,
        total: Int,
        now: Date
    ) -> String? {
        var parts: [String] = []
        if let age = ageInDays(of: offer.createdAt, now: now), age >= 1 {
            parts.append("\(age) day\(age == 1 ? "" : "s") old")
        }
        if total > 1 {
            parts.append("\(index + 1) of \(total) offers")
        }
        if parts.isEmpty { return nil }
        return parts.joined(separator: " · ")
    }

    public static func displayName(for user: ListingOfferUserDTO?) -> String {
        if let first = user?.firstName, !first.isEmpty {
            if let last = user?.lastName, !last.isEmpty {
                return "\(first) \(last)"
            }
            return first
        }
        if let username = user?.username, !username.isEmpty { return username }
        return "Someone"
    }

    // MARK: - Listing-context projection

    /// While the first fetch is in flight, surface the title hint passed
    /// by the entry point so the header isn't empty.
    private var loadingContext: ListingContextConfig? {
        guard let titleHint = listingTitleHint, !titleHint.isEmpty else { return nil }
        return ListingContextConfig(
            thumbnail: .icon(
                .shoppingBag,
                gradient: GradientPair(start: Theme.Color.primary600, end: Theme.Color.primary700)
            ),
            title: titleHint,
            askPrice: "",
            meta: [],
            statusChip: ListingContextStatus(label: "Loading…", variant: .neutral)
        )
    }

    /// Pure projection from a [ListingDTO] to a [ListingContextConfig].
    public static func context(
        for listing: ListingDTO,
        offerCount: Int,
        sortLabel: String?,
        sortOptions: [ListingContextSortOption] = [],
        onSort: (@Sendable () -> Void)? = nil,
        onEditPrice: (@Sendable () -> Void)? = nil
    ) -> ListingContextConfig {
        let category = ListingOffersCategory.from(
            rawCategory: listing.category,
            layer: listing.layer
        )
        let thumbnail: ThumbnailImage = if let url = listing.firstImage.flatMap(URL.init(string:)) {
            .url(url, fallback: category.icon, gradient: category.gradient)
        } else if let firstMedia = listing.mediaUrls?.first.flatMap(URL.init(string:)) {
            .url(firstMedia, fallback: category.icon, gradient: category.gradient)
        } else {
            .icon(category.icon, gradient: category.gradient)
        }
        let askPrice = formatHeaderPrice(listing.price, isFree: listing.isFree)
        let meta = headerMeta(for: listing)
        let status = headerStatus(for: listing)
        return ListingContextConfig(
            thumbnail: thumbnail,
            title: listing.title ?? "Listing",
            askPrice: askPrice,
            meta: meta,
            statusChip: status,
            offerCount: offerCount,
            sortLabel: sortLabel,
            sortOptions: sortOptions,
            onSort: onSort,
            onEditPrice: onEditPrice
        )
    }

    private static func headerMeta(for listing: ListingDTO) -> [ListingContextMeta] {
        var items: [ListingContextMeta] = []
        // The current ListingDTO doesn't decode the view / save counters
        // (the backend returns them via the same response but the iOS
        // DTO is a slim projection used by the marketplace tab). The
        // "Listed N ago" item is always present.
        if let posted = postedAgo(listing.createdAt) {
            items.append(ListingContextMeta(icon: .clock, text: "Listed \(posted)"))
        }
        return items
    }

    private static func headerStatus(for listing: ListingDTO) -> ListingContextStatus {
        let raw = (listing.status ?? "active").lowercased()
        switch raw {
        case "active":
            return ListingContextStatus(label: "Active", icon: .circle, variant: .success)
        case "reserved":
            return ListingContextStatus(label: "Reserved", icon: .check, variant: .info)
        case "sold":
            return ListingContextStatus(label: "Sold", icon: .checkCheck, variant: .success)
        case "expired":
            return ListingContextStatus(label: "Expired", icon: .timer, variant: .neutral)
        case "draft":
            return ListingContextStatus(label: "Draft", icon: .pencil, variant: .neutral)
        default:
            return ListingContextStatus(label: raw.capitalized, variant: .neutral)
        }
    }

    private static func formatHeaderPrice(_ amount: Double?, isFree: Bool?) -> String {
        if isFree == true { return "Free" }
        return formatPrice(amount)
    }

    /// "4 days ago" / "6 hours ago" / "just now" — used by the listing
    /// context header's posted-meta line.
    public static func postedAgo(_ raw: String?) -> String? {
        guard let date = parseDate(raw) else { return nil }
        let seconds = Date().timeIntervalSince(date)
        if seconds < 60 { return "just now" }
        if seconds < 3600 { return "\(Int(seconds / 60))m ago" }
        if seconds < 86400 { return "\(Int(seconds / 3600))h ago" }
        let days = Int(seconds / 86400)
        if days == 1 { return "yesterday" }
        return "\(days) days ago"
    }

    // MARK: - Helpers

    /// Order the offers for display per the active sort. The LEADING
    /// badge is computed separately so it always tracks the top offer,
    /// not whatever happens to sit first in the current order.
    private func sortedOffers() -> [ListingOfferDTO] {
        switch sort {
        case .highestOffer:
            offers.sorted { ($0.amount ?? 0) > ($1.amount ?? 0) }
        case .lowestOffer:
            offers.sorted { ($0.amount ?? 0) < ($1.amount ?? 0) }
        case .newestFirst:
            offers.sorted { sortDate($0) > sortDate($1) }
        case .oldestFirst:
            offers.sorted { sortDate($0) < sortDate($1) }
        }
    }

    private func sortDate(_ offer: ListingOfferDTO) -> Date {
        Self.parseDate(offer.createdAt) ?? .distantPast
    }

    private func leadingOfferId() -> String? {
        // Highest-amount pending offer wins the LEADING badge, regardless
        // of the display sort.
        offers
            .sorted { ($0.amount ?? 0) > ($1.amount ?? 0) }
            .first { ListingOfferStatus.fromRaw($0.status) == .pending }?
            .id
    }

    private static func footerActions(
        for variant: ListingOfferFooter,
        callbacks: RowCallbacks
    ) -> RowFooter? {
        switch variant {
        case .none:
            nil
        case .respondPending:
            RowFooter(actions: [
                RowFooterAction(
                    title: "Counter",
                    icon: .arrowsRepeat,
                    variant: .ghost,
                    handler: callbacks.onCounter
                ),
                RowFooterAction(
                    title: "Accept",
                    icon: .check,
                    variant: .primary,
                    handler: callbacks.onAccept
                )
            ])
        case .undoCounter:
            RowFooter(actions: [
                RowFooterAction(
                    title: "Withdraw counter",
                    icon: .x,
                    variant: .destructive,
                    handler: callbacks.onDecline
                ),
                RowFooterAction(
                    title: "Send counter",
                    icon: .arrowsRepeat,
                    variant: .primary,
                    handler: callbacks.onCounter
                )
            ])
        case .viewTransaction:
            RowFooter(actions: [
                RowFooterAction(
                    title: "View transaction",
                    icon: .fileText,
                    variant: .primary,
                    handler: callbacks.onViewTransaction
                )
            ])
        case .reviewTransaction:
            RowFooter(actions: [
                RowFooterAction(
                    title: "View transaction",
                    icon: .fileText,
                    variant: .ghost,
                    handler: callbacks.onViewTransaction
                ),
                RowFooterAction(
                    title: "Leave a review",
                    icon: .star,
                    variant: .primary,
                    handler: callbacks.onLeaveReview
                )
            ])
        }
    }

    /// `12` → `"$12"`, `12.5` → `"$13"`. Truncated to whole dollars to
    /// match the design's $-prefix headline price.
    public static func formatPrice(_ amount: Double?) -> String {
        guard let amount else { return "$—" }
        return "$\(Int(amount.rounded()))"
    }

    /// Sub-label used by the price stack: `"asking $240"`.
    public static func formatAskingSublabel(_ askingPrice: Double?) -> String? {
        guard let price = askingPrice, price > 0 else { return nil }
        return "asking \(formatPrice(price))"
    }

    public static func ageInDays(of raw: String?, now: Date) -> Int? {
        guard let date = parseDate(raw) else { return nil }
        let seconds = now.timeIntervalSince(date)
        return Int(seconds / 86400)
    }

    public static func formatRelativeTime(_ raw: String?, now: Date) -> String? {
        guard let date = parseDate(raw) else { return nil }
        let interval = now.timeIntervalSince(date)
        if interval < 60 { return "now" }
        if interval < 3600 { return "\(Int(interval / 60))m" }
        if interval < 86400 { return "\(Int(interval / 3600))h" }
        let days = Int(interval / 86400)
        if days == 1 { return "yesterday" }
        if days < 7 { return "\(days)d" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }

    private static let iso8601: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let iso8601NoFraction: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    public static func parseDate(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        return iso8601.date(from: raw) ?? iso8601NoFraction.date(from: raw)
    }
}
