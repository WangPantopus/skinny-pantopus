//
//  OffersViewModel.swift
//  Pantopus
//
//  T5.2.4 — Cross-listing Offers. Drives the screen against the shared
//  `ListOfRows` archetype with the new design contract:
//
//    - Two equal-width tabs: "Received (N)" + "Sent (N)".
//    - Top-bar trailing "Filter" icon (a11y-only placeholder until P11
//      Listing offers brings the filter sheet design).
//    - No FAB (offers are created from a listing/gig detail, not here).
//    - Each row uses the Shape C anatomy:
//        leading  : category gradient icon (driven by gig category)
//        title    : gig title (allowed to wrap to 2 lines)
//        subtitle : "{From|Your offer} {name} · {city} · {time ago}"
//        trailing : priceStack — offer amount on top, "asking $X" below
//        chip row : status chip (+ optional metaTail)
//    - No row footer (offers are managed from the offer/gig detail).
//
//  Backend (existing, no new endpoints):
//    - `GET /api/gigs/my-bids`         → Sent tab
//    - `GET /api/gigs/received-offers` → Received tab
//

import Foundation
import Observation
import SwiftUI

// swiftlint:disable file_length function_parameter_count type_body_length

/// Stable tab ids — public so the screen + tests address them without
/// stringly-typed call sites.
public enum OffersTab {
    public static let received = "received"
    public static let sent = "sent"
}

/// Six lifecycle states the design's STATUS map calls out. Common-case
/// statuses are `pending / countered / accepted / declined / withdrawn /
/// expired`; the design also surfaces `new` (recently-created pending)
/// and `expiring` (pending with `expires_at` inside the warning window)
/// as derived variants of `pending`.
public enum OfferStatus: Sendable, Hashable {
    case new
    case expiring
    case countered
    case accepted
    case pending
    case declined
    case withdrawn
    case expired

    /// Window (in seconds) within which a pending bid is treated as
    /// "new" (12h, mirrors how the design's "12m" / "2d ago" copy reads
    /// freshness).
    static let newWindow: TimeInterval = 12 * 60 * 60
    /// Window before `expires_at` that flips a pending bid into the
    /// expiring chip (4h, matches the design "Expires in 4h" copy).
    static let expiringWindow: TimeInterval = 4 * 60 * 60

    public var label: String {
        switch self {
        case .new: "New offer"
        case .expiring: "Expiring soon"
        case .countered: "Countered"
        case .accepted: "Accepted"
        case .pending: "Pending response"
        case .declined: "Declined"
        case .withdrawn: "Withdrawn"
        case .expired: "Expired"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .new: .sparkles
        case .expiring: .timer
        case .countered: .arrowsRepeat
        case .accepted: .check
        case .pending: .hourglass
        case .declined: .x
        case .withdrawn: .arrowLeft
        case .expired: .alertCircle
        }
    }

    public var chipVariant: StatusChipVariant {
        switch self {
        case .new: .personal
        case .expiring: .error
        case .countered: .warning
        case .accepted: .success
        case .pending, .declined, .withdrawn, .expired: .neutral
        }
    }
}

/// Eight gig-category buckets the row's leading icon represents. Wraps
/// the existing `GigsCategory` enum with an icon + theme-token gradient
/// pair so the shell can render `RowLeading.categoryGradientIcon`
/// without leaking any hex literals.
public enum OffersCategory: Sendable, Hashable {
    case handyman, cleaning, moving, petCare, childCare, tutoring, tech, delivery, other

    public static func from(rawCategory: String?) -> OffersCategory {
        let key = (rawCategory ?? "")
            .lowercased()
            .replacingOccurrences(of: "_", with: "")
            .replacingOccurrences(of: "-", with: "")
            .replacingOccurrences(of: " ", with: "")
        switch key {
        case "handyman", "handy", "repair", "repairs": return .handyman
        case "cleaning", "clean": return .cleaning
        case "moving", "move", "movers": return .moving
        case "petcare", "pet", "pets", "dogwalking", "petsitting": return .petCare
        case "childcare", "child", "babysitting", "nanny": return .childCare
        case "tutoring", "tutor", "lessons", "teaching": return .tutoring
        case "tech", "technology", "it", "computer", "techsupport": return .tech
        case "delivery", "deliveries", "courier": return .delivery
        default: return .other
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .handyman: .hammer
        case .cleaning: .briefcase
        case .moving: .package
        case .petCare: .heart
        case .childCare: .userPlus
        case .tutoring: .lightbulb
        case .tech: .info
        case .delivery: .send
        case .other: .briefcase
        }
    }

    /// Two-stop gradient sourced from theme tokens — no hex at call
    /// sites. Each category pairs its token with the surrounding light
    /// tint to give the tile a subtle vertical fade.
    public var gradient: GradientPair {
        switch self {
        case .handyman: GradientPair(start: Theme.Color.handyman, end: Theme.Color.warning)
        case .cleaning: GradientPair(start: Theme.Color.cleaning, end: Theme.Color.primary600)
        case .moving: GradientPair(start: Theme.Color.moving, end: Theme.Color.business)
        case .petCare: GradientPair(start: Theme.Color.petCare, end: Theme.Color.success)
        case .childCare: GradientPair(start: Theme.Color.childCare, end: Theme.Color.error)
        case .tutoring: GradientPair(start: Theme.Color.tutoring, end: Theme.Color.warning)
        case .tech: GradientPair(start: Theme.Color.tech, end: Theme.Color.appTextSecondary)
        case .delivery: GradientPair(start: Theme.Color.delivery, end: Theme.Color.primary700)
        case .other: GradientPair(start: Theme.Color.primary600, end: Theme.Color.primary700)
        }
    }
}

@Observable
@MainActor
public final class OffersViewModel: ListOfRowsDataSource {
    // MARK: - Static copy

    private static let receivedEmptySubcopy =
        "When a neighbor offers a price on one of your listings, " +
        "it’ll land here. Listings with photos and a fair ask tend " +
        "to draw offers within a day."

    private static let sentEmptySubcopy =
        "Browse listings and gigs you'd like to buy or help with — " +
        "your offers will show up here."

    // MARK: - Public state

    public let title = "Offers"

    public var tabs: [ListOfRowsTab] {
        [
            ListOfRowsTab(id: OffersTab.received, label: "Received", count: received.count),
            ListOfRowsTab(id: OffersTab.sent, label: "Sent", count: sent.count)
        ]
    }

    public var selectedTab: String = OffersTab.received {
        didSet {
            guard oldValue != selectedTab else { return }
            rebuild()
        }
    }

    public var fab: FABAction? {
        nil
    }

    public var topBarAction: TopBarAction? {
        TopBarAction(
            icon: .filter,
            accessibilityLabel: "Filter offers"
        ) { [weak self] in
            Task { @MainActor in self?.isFilterPresented = true }
        }
    }

    // MARK: - Activity filter (P5.4)

    /// Bound to the view's `.sheet(isPresented:)` so the shared
    /// `ActivityFilterSheet` presents over the list.
    public var isFilterPresented = false

    /// The applied status / sort / date-range selection. Default is the
    /// "no filter" position.
    public private(set) var activityFilter = ActivityFilter()

    /// Section header for the status chips in the sheet.
    public let statusFilterTitle = "Offer status"

    /// Per-surface status chips (the three offer lifecycle buckets).
    public let statusFilterOptions: [FilterOption] = [
        FilterOption(id: "pending", label: "Pending"),
        FilterOption(id: "accepted", label: "Accepted"),
        FilterOption(id: "declined", label: "Declined")
    ]

    /// Offers carry an amount, so the full sort set (incl. value) applies.
    public let sortFilterOptions = ActivitySortOrder.all

    /// Store the applied filter and re-project the visible rows.
    public func applyFilter(_ filter: ActivityFilter) {
        activityFilter = filter
        rebuild()
    }

    public private(set) var state: ListOfRowsState = .loading

    // MARK: - Row actions (RN `offers.tsx`)

    /// Bid awaiting the Accept confirm (payment-authorization copy).
    public var acceptCandidate: BidDTO?
    /// Bid awaiting the Reject confirm.
    public var rejectCandidate: BidDTO?
    /// Bid awaiting the Withdraw confirm.
    public var withdrawCandidate: BidDTO?
    /// Id of the bid whose mutation is in flight — the footer disables.
    public private(set) var actionInFlight: String?
    /// Transient toast surfaced by the screen.
    public var toast: ToastMessage?

    // MARK: - Dependencies

    private let api: APIClient
    private let checkout: CheckoutCoordinator
    private let onOpenOfferDetail: @MainActor (BidDTO) -> Void
    private let onBrowseListings: @MainActor () -> Void
    private let onPostTask: @MainActor () -> Void
    private let now: @Sendable () -> Date

    // MARK: - Local data

    private var received: [BidDTO] = []
    private var sent: [BidDTO] = []
    private var loadedAtLeastOnce = false

    init(
        api: APIClient = .shared,
        checkout: CheckoutCoordinator = CheckoutCoordinator(),
        onOpenOfferDetail: @escaping @MainActor (BidDTO) -> Void = { _ in },
        onBrowseListings: @escaping @MainActor () -> Void = {},
        onPostTask: @escaping @MainActor () -> Void = {},
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.api = api
        self.checkout = checkout
        self.onOpenOfferDetail = onOpenOfferDetail
        self.onBrowseListings = onBrowseListings
        self.onPostTask = onPostTask
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

    /// Cross-tab pagination isn't part of T5.2.4 — both endpoints return
    /// the full list under the default 100 limit. Re-checking on
    /// `loadMoreIfNeeded` is a no-op for now.
    public func loadMoreIfNeeded() async {}

    // MARK: - Fetching

    private func fetchAll() async {
        // Serial — keeps the FIFO `SequencedURLProtocol` stub
        // deterministic in tests. Both endpoints are quick; the
        // sub-200ms latency we trade away isn't worth flaky tests.
        let receivedResult = await Self.fetchReceived(api: api)
        let sentResult = await Self.fetchSent(api: api)
        switch (receivedResult, sentResult) {
        case let (.success(r), .success(s)):
            received = r
            sent = s
            loadedAtLeastOnce = true
            rebuild()
        case let (.failure(error), _), let (_, .failure(error)):
            // Only surface a banner when we have no cached data to fall
            // back to — keeps the screen useful when the second tab's
            // endpoint flakes after the first one already painted.
            if !loadedAtLeastOnce {
                state = .error(message: error.errorDescription ?? "Couldn't load offers.")
            }
        }
    }

    private static func fetchReceived(api: APIClient) async -> Result<[BidDTO], APIError> {
        do {
            let response: ReceivedOffersResponse = try await api.request(
                OffersEndpoints.receivedOffers()
            )
            return .success(response.offers)
        } catch {
            return .failure((error as? APIError) ?? .invalidResponse)
        }
    }

    private static func fetchSent(api: APIClient) async -> Result<[BidDTO], APIError> {
        do {
            let response: MyBidsResponse = try await api.request(
                OffersEndpoints.myBids()
            )
            return .success(response.bids)
        } catch {
            return .failure((error as? APIError) ?? .invalidResponse)
        }
    }

    // MARK: - State projection

    private func rebuild() {
        let items = selectedTab == OffersTab.sent ? sent : received
        let perspective: OfferPerspective = selectedTab == OffersTab.sent ? .sent : .received
        let nowSnapshot = now()
        let visible = activityFilter.apply(
            to: items,
            now: nowSnapshot,
            statusId: { Self.statusFilterId(for: Self.derivedStatus(for: $0, now: nowSnapshot)) },
            date: { Self.parseDate($0.createdAt) },
            value: { $0.bidAmount }
        )
        if visible.isEmpty {
            let isFiltered = activityFilter.isActive && !items.isEmpty
            state = .empty(isFiltered ? filteredEmptyContent() : emptyContent(for: selectedTab))
            return
        }
        let inFlight = actionInFlight
        let rows = visible.map { dto in
            Self.row(
                dto: dto,
                perspective: perspective,
                now: nowSnapshot,
                footer: Self.footer(
                    dto: dto,
                    perspective: perspective,
                    isBusy: inFlight != nil,
                    onAccept: { [weak self] in
                        Task { @MainActor in self?.acceptCandidate = dto }
                    },
                    onReject: { [weak self] in
                        Task { @MainActor in self?.rejectCandidate = dto }
                    },
                    onWithdraw: { [weak self] in
                        Task { @MainActor in self?.withdrawCandidate = dto }
                    }
                )
            ) { [weak self] in
                guard let self else { return }
                Task { @MainActor in self.onOpenOfferDetail(dto) }
            }
        }
        let section = RowSection(id: selectedTab, rows: rows)
        state = .loaded(sections: [section], hasMore: false)
    }

    /// Map a derived offer status onto one of the three filter chip ids.
    public static func statusFilterId(for status: OfferStatus) -> String {
        switch status {
        case .new, .expiring, .countered, .pending: "pending"
        case .accepted: "accepted"
        case .declined, .withdrawn, .expired: "declined"
        }
    }

    /// Empty state shown when an active filter hides every row in the tab.
    private func filteredEmptyContent() -> ListOfRowsState.EmptyContent {
        ListOfRowsState.EmptyContent(
            icon: .filter,
            headline: "No offers match your filters",
            subcopy: "Try a different status, date range, or sort — or clear "
                + "your filters to see everything in this tab.",
            ctaTitle: "Clear filters"
        ) { [weak self] in
            Task { @MainActor in self?.applyFilter(ActivityFilter()) }
        }
    }

    private func emptyContent(for tab: String) -> ListOfRowsState.EmptyContent {
        switch tab {
        case OffersTab.sent:
            ListOfRowsState.EmptyContent(
                icon: .handCoins,
                headline: "No offers sent yet",
                subcopy: Self.sentEmptySubcopy,
                ctaTitle: "Browse listings"
            ) { [weak self] in
                Task { @MainActor in self?.onBrowseListings() }
            }
        default:
            ListOfRowsState.EmptyContent(
                icon: .handCoins,
                headline: "No offers yet",
                subcopy: Self.receivedEmptySubcopy,
                ctaTitle: "Post a task"
            ) { [weak self] in
                Task { @MainActor in self?.onPostTask() }
            }
        }
    }

    // MARK: - Mutations (RN `offers.tsx`)

    /// Confirm copy for Accept. Paid offers authorize a hold first, so
    /// the dialog quotes the exact amount (RN `handleAcceptBid`).
    public static func acceptConfirmTitle(for dto: BidDTO) -> String {
        (dto.bidAmount ?? 0) > 0 ? "Authorize payment method?" : "Accept offer"
    }

    public static func acceptConfirmMessage(for dto: BidDTO) -> String {
        guard let amount = dto.bidAmount, amount > 0 else {
            return "Accept this offer?"
        }
        return "Pantopus will place a temporary authorization hold of "
            + formatUSD(amount)
            + ". You are charged only after you confirm the task is completed. "
            + "If canceled per policy, the hold is released (or only applicable fees apply)."
    }

    public static func acceptConfirmCTA(for dto: BidDTO) -> String {
        (dto.bidAmount ?? 0) > 0 ? "Continue to Payment" : "Accept"
    }

    /// `$120.00` — the accept dialog quotes cents, unlike the row's
    /// whole-dollar price stack.
    public static func formatUSD(_ amount: Double) -> String {
        String(format: "$%.2f", amount)
    }

    /// Poster accepts a received bid: `POST .../bids/:bidId/accept`;
    /// paid gigs return PaymentSheet params → present → `finalize-accept`
    /// (or `abort-accept` on cancel/decline). Mirrors the gig-detail flow.
    public func confirmAccept() async {
        guard let dto = acceptCandidate else { return }
        acceptCandidate = nil
        guard let gigId = dto.gigId ?? dto.gig?.id else {
            toast = ToastMessage(text: "Gig not found for this offer.", kind: .error)
            return
        }
        guard actionInFlight == nil else { return }
        actionInFlight = dto.id
        rebuild()
        defer {
            actionInFlight = nil
            rebuild()
        }
        do {
            let response: GigBidAcceptResponse = try await api.request(
                GigsEndpoints.acceptBid(gigId: gigId, bidId: dto.id)
            )
            let requiresPayment = response.requiresPaymentSetup == true
                || response.sheetParams.clientSecret != nil
            if requiresPayment {
                switch await checkout.present(response.sheetParams) {
                case .paid:
                    let _: GigBidAcceptResponse = try await api.request(
                        GigsEndpoints.finalizeAcceptBid(gigId: gigId, bidId: dto.id)
                    )
                    toast = ToastMessage(text: "Offer accepted and payment authorized.", kind: .success)
                case .canceled:
                    _ = try? await api.request(
                        GigsEndpoints.abortAcceptBid(gigId: gigId, bidId: dto.id),
                        as: GigBidAcceptResponse.self
                    )
                    toast = ToastMessage(
                        text: "Payment authorization is required before accepting this offer.",
                        kind: .error
                    )
                case let .declined(message), let .failed(message):
                    _ = try? await api.request(
                        GigsEndpoints.abortAcceptBid(gigId: gigId, bidId: dto.id),
                        as: GigBidAcceptResponse.self
                    )
                    toast = ToastMessage(text: message, kind: .error)
                }
            } else {
                toast = ToastMessage(text: "Offer accepted.", kind: .success)
            }
            await fetchAll()
        } catch {
            toast = ToastMessage(
                text: (error as? APIError)?.errorDescription ?? "Couldn't accept this offer.",
                kind: .error
            )
        }
    }

    /// Poster rejects a received bid — `POST .../bids/:bidId/reject`.
    public func confirmReject() async {
        guard let dto = rejectCandidate else { return }
        rejectCandidate = nil
        guard let gigId = dto.gigId ?? dto.gig?.id else {
            toast = ToastMessage(text: "Gig not found for this offer.", kind: .error)
            return
        }
        await mutate(bidId: dto.id, success: "Offer rejected.", failure: "Couldn't reject this offer.") {
            _ = try await self.api.request(
                GigsEndpoints.rejectBid(gigId: gigId, bidId: dto.id),
                as: EmptyResponse.self
            )
        }
    }

    /// Bidder withdraws their own sent offer —
    /// `DELETE /api/gigs/:gigId/bids/:bidId` with `reason=other`, exactly
    /// as RN's `withdrawBid(gigId, bidId, 'other')`.
    public func confirmWithdraw() async {
        guard let dto = withdrawCandidate else { return }
        withdrawCandidate = nil
        guard let gigId = dto.gigId ?? dto.gig?.id else {
            toast = ToastMessage(text: "Gig not found for this offer.", kind: .error)
            return
        }
        await mutate(bidId: dto.id, success: "Offer withdrawn.", failure: "Couldn't withdraw this offer.") {
            _ = try await self.api.request(
                GigsEndpoints.withdrawBid(gigId: gigId, bidId: dto.id, reason: .other),
                as: EmptyResponse.self
            )
        }
    }

    /// Shared in-flight / toast / refetch wrapper for the simple mutations.
    private func mutate(
        bidId: String,
        success: String,
        failure: String,
        _ body: () async throws -> Void
    ) async {
        guard actionInFlight == nil else { return }
        actionInFlight = bidId
        rebuild()
        defer {
            actionInFlight = nil
            rebuild()
        }
        do {
            try await body()
            toast = ToastMessage(text: success, kind: .success)
            await fetchAll()
        } catch {
            toast = ToastMessage(text: (error as? APIError)?.errorDescription ?? failure, kind: .error)
        }
    }

    // MARK: - Pure projections (test surface)

    /// Pure projection from a `BidDTO` to a `RowModel`. Public so the
    /// test suite can assert the mapping (status derivation, perspective
    /// subtitle, price stack) without standing up the full VM.
    public static func row(
        dto: BidDTO,
        perspective: OfferPerspective,
        now: Date = Date(),
        footer: RowFooter? = nil,
        onTap: @escaping @Sendable () -> Void
    ) -> RowModel {
        let status = derivedStatus(for: dto, now: now)
        let category = OffersCategory.from(rawCategory: dto.gig?.category)
        let amount = formatPrice(dto.bidAmount)
        let askingSublabel = formatAskingSublabel(askingPrice: dto.gig?.price)
        let subtitle = subtitle(for: dto, perspective: perspective, now: now)
        let metaTail = makeMetaTail(for: dto, status: status, perspective: perspective)
        return RowModel(
            id: dto.id,
            title: dto.gig?.title?.isEmpty == false ? (dto.gig?.title ?? "Offer") : "Offer",
            subtitle: subtitle,
            template: .statusChip,
            leading: .categoryGradientIcon(category.icon, gradient: category.gradient),
            trailing: .priceStack(amount: amount, sublabel: askingSublabel),
            onTap: onTap,
            chips: [
                RowChip(
                    text: status.label,
                    icon: status.icon,
                    tint: .status(status.chipVariant)
                )
            ],
            metaTail: metaTail,
            footer: footer
        )
    }

    /// In-card action footer. Mirrors RN `offers.tsx`: the Received tab
    /// exposes Accept + Reject on a still-pending bid, the Sent tab
    /// exposes Withdraw while the bid is `pending` or `countered`. Every
    /// other lifecycle state renders footer-less (managed from detail).
    public static func footer(
        dto: BidDTO,
        perspective: OfferPerspective,
        isBusy: Bool,
        onAccept: @escaping @Sendable () -> Void,
        onReject: @escaping @Sendable () -> Void,
        onWithdraw: @escaping @Sendable () -> Void
    ) -> RowFooter? {
        let status = (dto.status ?? "").lowercased()
        switch perspective {
        case .received:
            guard status == "pending" else { return nil }
            return RowFooter(actions: [
                RowFooterAction(
                    title: "Reject",
                    icon: .x,
                    variant: .destructive,
                    identifier: "offers.\(dto.id).reject"
                ) { if !isBusy { onReject() } },
                RowFooterAction(
                    title: "Accept",
                    icon: .check,
                    variant: .primary,
                    identifier: "offers.\(dto.id).accept"
                ) { if !isBusy { onAccept() } }
            ])
        case .sent:
            guard status == "pending" || status == "countered" else { return nil }
            return RowFooter(actions: [
                RowFooterAction(
                    title: "Withdraw",
                    icon: .x,
                    variant: .destructive,
                    identifier: "offers.\(dto.id).withdraw"
                ) { if !isBusy { onWithdraw() } }
            ])
        }
    }

    /// Map a backend bid to one of the eight design statuses. Pure +
    /// time-deterministic — pass an explicit `now` to fix the result.
    public static func derivedStatus(for dto: BidDTO, now: Date) -> OfferStatus {
        // Counter offers take precedence — a pending bid that's also got
        // a live counter is "countered" regardless of the time window.
        let hasLiveCounter = (dto.counterAmount ?? 0) > 0 || (dto.counterStatus?.isEmpty == false)
        if hasLiveCounter, isPending(dto.status) { return .countered }

        switch (dto.status ?? "").lowercased() {
        case "accepted", "assigned": return .accepted
        case "rejected", "declined": return .declined
        case "withdrawn": return .withdrawn
        case "expired": return .expired
        case "pending":
            if let expires = parseDate(dto.expiresAt) {
                let timeLeft = expires.timeIntervalSince(now)
                if timeLeft > 0, timeLeft < OfferStatus.expiringWindow { return .expiring }
                if timeLeft <= 0 { return .expired }
            }
            if let created = parseDate(dto.createdAt) {
                if now.timeIntervalSince(created) < OfferStatus.newWindow { return .new }
            }
            return .pending
        default:
            return .pending
        }
    }

    /// Render the row subtitle: counterparty + city + relative time.
    public static func subtitle(
        for dto: BidDTO,
        perspective: OfferPerspective,
        now: Date
    ) -> String {
        let counterparty: String
        let city: String?
        switch perspective {
        case .received:
            let name = displayName(for: dto.bidder)
            counterparty = "From \(name)"
            city = dto.bidder?.city?.isEmpty == false ? dto.bidder?.city : nil
        case .sent:
            counterparty = "Your offer"
            // Sent perspective has no inlined buyer/seller user — the
            // city slot is omitted.
            city = nil
        }
        var parts = [counterparty]
        if let city { parts.append(city) }
        if let time = formatRelativeTime(dto.createdAt, now: now) { parts.append(time) }
        return parts.joined(separator: " · ")
    }

    /// Optional meta tail rendered after the chip — surfaces the
    /// counter amount when the status chip already says "Countered" so
    /// the user can read the counter at a glance without opening the
    /// offer detail.
    public static func makeMetaTail(
        for dto: BidDTO,
        status: OfferStatus,
        perspective: OfferPerspective
    ) -> String? {
        switch status {
        case .countered:
            guard let counter = dto.counterAmount, counter > 0 else { return nil }
            switch perspective {
            case .received: return "you countered \(formatPrice(counter))"
            case .sent: return "counter \(formatPrice(counter))"
            }
        default:
            return nil
        }
    }

    public enum OfferPerspective: Sendable {
        case received
        case sent
    }
}

// MARK: - Helpers

extension OffersViewModel {
    static func isPending(_ raw: String?) -> Bool {
        (raw ?? "").lowercased() == "pending"
    }

    /// `12` → `"$12"`, `12.5` → `"$12"` (truncated to whole dollars to
    /// match the design's $-prefix headline price).
    public static func formatPrice(_ amount: Double?) -> String {
        guard let amount else { return "$—" }
        return "$\(Int(amount.rounded()))"
    }

    /// Sub-label used by the price stack: `"asking $240"`. Returns
    /// `nil` when the gig has no listed price (e.g. open-ended task).
    public static func formatAskingSublabel(askingPrice: Double?) -> String? {
        guard let price = askingPrice, price > 0 else { return nil }
        return "asking \(formatPrice(price))"
    }

    static func displayName(for bidder: BidderUserDTO?) -> String {
        if let name = bidder?.name, !name.isEmpty { return name }
        if let first = bidder?.firstName, !first.isEmpty { return first }
        if let username = bidder?.username, !username.isEmpty { return username }
        return "Someone"
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

    static func parseDate(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        return iso8601.date(from: raw) ?? iso8601NoFraction.date(from: raw)
    }

    /// "12m" / "3h" / "Yesterday" / "Tue" / "Mar 10" — mirrors the
    /// Notifications V2 helper for visual parity in the row meta line.
    public static func formatRelativeTime(_ raw: String?, now: Date) -> String? {
        guard let date = parseDate(raw) else { return nil }
        let interval = now.timeIntervalSince(date)
        if interval < 60 { return "now" }
        if interval < 3600 { return "\(Int(interval / 60))m" }
        if interval < 86400 { return "\(Int(interval / 3600))h" }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        let startOfNow = calendar.startOfDay(for: now)
        let startOfDate = calendar.startOfDay(for: date)
        let days = calendar.dateComponents([.day], from: startOfDate, to: startOfNow).day ?? 0
        if days == 1 { return "Yesterday" }
        if days < 7 {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.dateFormat = "EEE"
            return formatter.string(from: date)
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }
}
