//
//  MyBidsViewModel.swift
//  Pantopus
//
//  T5.3.1 — My bids. Drives the screen against the shared
//  `ListOfRowsView` archetype.
//
//  Design contract (mybids-frames.jsx):
//    - Top bar: back chevron + "My bids" + trailing filter icon
//    - Four equal-width tabs:
//        Active (N)   — bid is still in play (pending / countered, with
//                        Top bid / Shortlisted / Outbid / Closes in Xh
//                        derived from backend signals + expiry)
//        Accepted (N) — bid was accepted, gig hasn't finished yet
//        Rejected (N) — bid was rejected, withdrawn, expired, or the
//                        gig itself was cancelled (mid-task)
//        Done (N)     — gig completed, paid or awaiting review
//    - 48pt extended-pill FAB labelled "Browse tasks" — this is a
//      navigation FAB, not a create action (see F1 in the buildout plan)
//    - Each row uses Shape C:
//        leading:  40pt category gradient icon
//        title:    gig title (up to 2 lines)
//        trailing: priceStack — bid amount + "budget $X"
//        subtitle: "for {posterName} · {neighborhood} · {postedAgo}"
//        chips:    status chip
//        metaTail: competition / time meta (e.g. "3 others bid · 1d left")
//        footer:   varies by status (see ACTIONS map below)
//    - Terminal rows (rejected / withdrawn / expired / task-cancelled)
//      render at 0.78 opacity via the new `RowHighlight.muted` case.
//    - Banner above the Active tab summarises Top-bid + Closing-soon
//      counts ("Leading on 1 of 5 active bids · 1 closing in 24h").
//
//  Backend (existing, no new endpoints):
//    - GET    /api/gigs/my-bids                        (gigs.js:1253)
//    - PUT    /api/gigs/:gigId/bids/:bidId             (gigs.js:3971) — edit
//    - DELETE /api/gigs/:gigId/bids/:bidId             (gigs.js:5245) — withdraw
//    - POST   /api/gigs/:gigId/mark-completed          (gigs.js:5926) — worker
//    - POST   /api/reviews                             (reviews.js:35) — review
//
//  P3 backend-prep fields (see docs/mobile/pantopus-t5-notes.md §1.10) are
//  read optimistically: when the backend lands `shortlisted`, `your_rank`,
//  and `top_price`, the row mapper starts emitting Top bid / Shortlisted /
//  Outbid chips automatically — no further code change. Until then the
//  chip falls back to "Pending" or "Closes in Xh".
//

import Foundation
import Observation
import SwiftUI

// swiftlint:disable file_length type_body_length

// MARK: - Tab identifiers

public enum MyBidsTab {
    public static let active = "active"
    public static let accepted = "accepted"
    public static let rejected = "rejected"
    public static let done = "done"
}

// MARK: - Chip status

/// One of eleven chip variants the design's STATUS map calls out.
/// Derived from `(bid.status, gig.status, expires_at, shortlisted,
/// your_rank, top_price)` by [`MyBidsViewModel.derivedStatus`].
public enum MyBidsStatus: Sendable, Hashable {
    case topBid
    case shortlisted
    case pending
    case outbid
    /// "Countered $X" — the poster sent a counter-offer that's still
    /// awaiting the bidder's response (`counter_status == "pending"`).
    case countered(amount: String)
    /// "Closes in Xh" — derived from `expires_at` when the bid is
    /// pending and within the warning window.
    case expiring(hoursLeft: Int)
    case accepted
    /// "Starts {weekday}" — derived from `proposed_time` when accepted
    /// and the worker hasn't started yet.
    case scheduled(weekday: String)
    case notSelected
    case taskCancelled
    /// "Paid · $N" — gig is completed and reviewer already left a review
    /// (or the bid is closed without further action expected).
    case paid(amount: String)
    case leaveReview

    /// Window inside which a pending bid flips to the "Closes in Xh"
    /// chip. Mirrors the design's "Closes in 2h" / "Closes in 4h" copy
    /// and the OffersViewModel's `expiringWindow` (4h).
    public static let expiringWindow: TimeInterval = 4 * 60 * 60
    /// Mid-day boundary (in hours) for the "Closes in 2h" rounding.
    public static let warnHours: Double = 2

    public var label: String {
        switch self {
        case .topBid: "Top bid"
        case .shortlisted: "Shortlisted"
        case .pending: "Pending"
        case .outbid: "Outbid"
        case let .countered(amount): "Countered \(amount)"
        case let .expiring(hours): "Closes in \(hours)h"
        case .accepted: "Accepted"
        case let .scheduled(weekday): "Starts \(weekday)"
        case .notSelected: "Not selected"
        case .taskCancelled: "Task cancelled"
        case let .paid(amount): "Paid · \(amount)"
        case .leaveReview: "Leave review"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .topBid: .crown
        case .shortlisted: .star
        case .pending: .hourglass
        case .outbid: .trendingDown
        case .countered: .arrowsRepeat
        case .expiring: .timer
        case .accepted: .check
        case .scheduled: .calendar
        case .notSelected: .x
        case .taskCancelled: .ban
        case .paid: .checkCheck
        case .leaveReview: .star
        }
    }

    /// Chip variant straight from the design's STATUS map (see header
    /// comment). Source-of-truth for what colour a bid lifecycle state
    /// renders as.
    public var chipVariant: StatusChipVariant {
        switch self {
        case .topBid, .accepted, .paid: .success
        case .shortlisted, .scheduled, .leaveReview, .countered: .info
        case .pending, .notSelected, .taskCancelled: .neutral
        case .outbid: .warning
        case .expiring: .error
        }
    }
}

// MARK: - Footer actions

/// Footer-action archetype per the design's `actions` prop. The shell
/// renders each variant as 1–3 `CompactButton.footer` (34pt) entries.
public enum MyBidsFooter: Sendable, Hashable {
    /// Active bid: ghost "Withdraw" (destructive) + primary "Edit bid".
    case edit
    /// Countered bid awaiting the bidder's response: destructive
    /// "Decline counter" + primary "Accept $X".
    case counter(amount: String)
    /// Accepted, work not started: ghost "View details" + primary
    /// "Message client".
    case message
    /// Accepted, work in progress: ghost "Message" + primary "Mark
    /// complete".
    case complete
    /// Gig completed, no review left yet: single full-width primary
    /// "Leave a review for {firstName}".
    case review(firstName: String)
    /// Terminal rejection: single full-width primary "Bid again".
    case rebid
    /// No footer.
    case none
}

// MARK: - Withdrawal sheet

/// Lightweight presentation contract for the "Withdraw bid" sheet. The
/// view binds these fields directly; the VM owns the lifecycle.
public struct WithdrawSheetTarget: Identifiable, Sendable {
    public let id: String
    public let gigId: String
    public let gigTitle: String

    public init(id: String, gigId: String, gigTitle: String) {
        self.id = id
        self.gigId = gigId
        self.gigTitle = gigTitle
    }
}

// MARK: - View model

@Observable
@MainActor
public final class MyBidsViewModel: ListOfRowsDataSource {
    // MARK: - Public chrome

    public let title = "My bids"

    public var tabs: [ListOfRowsTab] {
        [
            ListOfRowsTab(id: MyBidsTab.active, label: "Active", count: counts.active),
            ListOfRowsTab(id: MyBidsTab.accepted, label: "Accepted", count: counts.accepted),
            ListOfRowsTab(id: MyBidsTab.rejected, label: "Rejected", count: counts.rejected),
            ListOfRowsTab(id: MyBidsTab.done, label: "Done", count: counts.done)
        ]
    }

    public var selectedTab: String = MyBidsTab.active {
        didSet {
            guard oldValue != selectedTab else { return }
            rebuild()
        }
    }

    public var fab: FABAction? {
        FABAction(
            icon: .compass,
            accessibilityLabel: "Browse tasks",
            variant: .extendedNav(label: "Browse tasks")
        ) { [weak self] in
            guard let self else { return }
            Task { @MainActor in self.onBrowseTasks() }
        }
    }

    public var topBarAction: TopBarAction? {
        TopBarAction(
            icon: .filter,
            accessibilityLabel: "Filter bids"
        ) { [weak self] in
            guard let self else { return }
            Task { @MainActor in self.isFilterPresented = true }
        }
    }

    // MARK: - Activity filter (P5.4)

    /// Bound to the view's `.sheet(isPresented:)` so the shared
    /// `ActivityFilterSheet` presents over the list.
    public var isFilterPresented = false

    /// The applied status / sort / date-range selection. Default is the
    /// "no filter" position, so `rebuild()` keeps the unfiltered order.
    public private(set) var activityFilter = ActivityFilter()

    /// Section header for the status chips in the sheet.
    public let statusFilterTitle = "Bid status"

    /// Per-surface status chips (coarse bid lifecycle buckets).
    public let statusFilterOptions: [FilterOption] = [
        FilterOption(id: "pending", label: "Pending"),
        FilterOption(id: "accepted", label: "Accepted"),
        FilterOption(id: "declined", label: "Declined"),
        FilterOption(id: "completed", label: "Completed")
    ]

    /// Bids carry an amount, so the full sort set (incl. value) applies.
    public let sortFilterOptions = ActivitySortOrder.all

    /// Store the applied filter and re-project the visible rows.
    public func applyFilter(_ filter: ActivityFilter) {
        activityFilter = filter
        rebuild()
    }

    public var banner: BannerConfig? {
        guard selectedTab == MyBidsTab.active else { return nil }
        let leadingCount = counts.leading
        let activeTotal = counts.active
        let closingSoon = counts.closingSoon
        guard activeTotal > 0 else { return nil }
        let title = if leadingCount > 0 {
            "Leading on \(leadingCount) of your \(activeTotal) active bids"
        } else {
            "\(activeTotal) active bid\(activeTotal == 1 ? "" : "s")"
        }
        let subtitle: String? = if closingSoon > 0 {
            "\(closingSoon) closing in the next 24h"
        } else {
            nil
        }
        return BannerConfig(icon: .gavel, title: title, subtitle: subtitle, onTap: nil)
    }

    public private(set) var state: ListOfRowsState = .loading

    /// Bound to the view's `.sheet` so the view layer can present the
    /// confirmation flow without owning any business logic.
    public var withdrawTarget: WithdrawSheetTarget?

    /// Bound to the Edit Bid sheet — populated when the user taps the
    /// "Edit bid" footer action on an Active row.
    public var editBidTarget: EditBidSheetTarget?

    /// Bound to the Leave Review sheet — populated when the user taps
    /// "Leave a review" on a Done row.
    public var leaveReviewTarget: LeaveReviewSheetTarget?

    /// Transient confirmation banner. Set after a successful edit /
    /// review submission so the view can flash a toast.
    public var toast: ToastMessage?

    // MARK: - Dependencies

    private let api: APIClient
    private let onOpenBid: @MainActor (BidDTO) -> Void
    private let onBrowseTasks: @MainActor () -> Void
    private let onMessageClient: @MainActor (BidDTO) -> Void
    private let now: @Sendable () -> Date

    // MARK: - Local data

    private var bids: [BidDTO] = []
    private var loadedAtLeastOnce = false
    private var counts = TabCounts()

    private struct TabCounts {
        var active = 0
        var accepted = 0
        var rejected = 0
        var done = 0
        var leading = 0 // bids where status is Top bid
        var closingSoon = 0 // active bids closing within 24h
    }

    init(
        api: APIClient = .shared,
        onOpenBid: @escaping @MainActor (BidDTO) -> Void = { _ in },
        onBrowseTasks: @escaping @MainActor () -> Void = {},
        onMessageClient: @escaping @MainActor (BidDTO) -> Void = { _ in },
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.api = api
        self.onOpenBid = onOpenBid
        self.onBrowseTasks = onBrowseTasks
        self.onMessageClient = onMessageClient
        self.now = now
    }

    // MARK: - ListOfRowsDataSource

    public func load() async {
        if !loadedAtLeastOnce { state = .loading }
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    /// All four tabs come from the same response; we don't paginate.
    public func loadMoreIfNeeded() async {}

    // MARK: - Fetching

    private func fetch() async {
        do {
            let response: MyBidsResponse = try await api.request(OffersEndpoints.myBids())
            bids = response.bids
            loadedAtLeastOnce = true
            rebuild()
        } catch {
            if !loadedAtLeastOnce {
                let message = (error as? APIError)?.errorDescription ?? "Couldn't load your bids."
                state = .error(message: message)
            }
        }
    }

    // MARK: - State projection

    /// Recomputes the section list + tab counts + banner from the
    /// cached `bids` array against the current `selectedTab`.
    private func rebuild() {
        let nowSnapshot = now()
        // Compute tab assignments + chip status once per bid so the
        // count summary and the row list stay in sync.
        let projections = bids.map { dto -> BidProjection in
            let tab = Self.tabFor(dto: dto, now: nowSnapshot)
            let status = Self.derivedStatus(for: dto, now: nowSnapshot)
            let footer = Self.footerFor(dto: dto, tab: tab, status: status)
            return BidProjection(dto: dto, tab: tab, status: status, footer: footer)
        }

        counts = Self.tabCounts(for: projections, now: nowSnapshot)

        let tabItems = projections.filter { $0.tab == selectedTab }
        let visible = activityFilter.apply(
            to: tabItems,
            now: nowSnapshot,
            statusId: { Self.statusFilterId(for: $0.status) },
            date: { Self.parseDate($0.dto.createdAt) },
            value: { $0.dto.bidAmount }
        )
        if visible.isEmpty {
            let isFiltered = activityFilter.isActive && !tabItems.isEmpty
            state = .empty(isFiltered ? filteredEmptyContent() : emptyContent(for: selectedTab))
            return
        }
        let rows = visible.map { proj in
            Self.row(
                projection: proj,
                now: nowSnapshot,
                callbacks: callbacks(for: proj.dto)
            )
        }
        state = .loaded(sections: [RowSection(id: selectedTab, rows: rows)], hasMore: false)
    }

    /// Map a derived bid status onto one of the four filter chip ids.
    public static func statusFilterId(for status: MyBidsStatus) -> String {
        switch status {
        case .topBid, .shortlisted, .pending, .outbid, .expiring, .countered: "pending"
        case .accepted, .scheduled: "accepted"
        case .notSelected, .taskCancelled: "declined"
        case .paid, .leaveReview: "completed"
        }
    }

    /// Empty state shown when an active filter hides every row in the tab.
    private func filteredEmptyContent() -> ListOfRowsState.EmptyContent {
        ListOfRowsState.EmptyContent(
            icon: .filter,
            headline: "No bids match your filters",
            subcopy: "Try a different status, date range, or sort — or clear "
                + "your filters to see everything in this tab.",
            ctaTitle: "Clear filters"
        ) { [weak self] in
            Task { @MainActor in self?.applyFilter(ActivityFilter()) }
        }
    }

    /// Build the bundled [RowCallbacks] for a given bid — each handler
    /// dispatches back onto the @MainActor so the row's `@Sendable`
    /// closure contract holds.
    private func callbacks(for dto: BidDTO) -> RowCallbacks {
        RowCallbacks(
            onTap: { [weak self] in
                guard let self else { return }
                Task { @MainActor in self.onOpenBid(dto) }
            },
            onWithdraw: { [weak self] in
                guard let self else { return }
                Task { @MainActor in self.requestWithdraw(dto) }
            },
            onEditBid: { [weak self] in
                guard let self else { return }
                Task { @MainActor in self.requestEditBid(dto) }
            },
            onMessage: { [weak self] in
                guard let self else { return }
                Task { @MainActor in self.onMessageClient(dto) }
            },
            onMarkComplete: { [weak self] in
                guard let self else { return }
                Task { @MainActor in await self.markComplete(dto) }
            },
            onLeaveReview: { [weak self] in
                guard let self else { return }
                Task { @MainActor in self.requestLeaveReview(dto) }
            },
            onRebid: { [weak self] in
                guard let self else { return }
                Task { @MainActor in self.onBrowseTasks() }
            },
            onAcceptCounter: { [weak self] in
                guard let self else { return }
                Task { @MainActor in await self.acceptCounter(dto) }
            },
            onDeclineCounter: { [weak self] in
                guard let self else { return }
                Task { @MainActor in await self.declineCounter(dto) }
            }
        )
    }

    private func emptyContent(for tab: String) -> ListOfRowsState.EmptyContent {
        switch tab {
        case MyBidsTab.active:
            ListOfRowsState.EmptyContent(
                icon: .gavel,
                headline: "You haven’t bid on any tasks yet",
                subcopy: "Neighbors post small jobs here all the time — moves, "
                    + "mounts, dog walks, repairs. Place a bid and they’ll "
                    + "get back to you within a day or two.",
                ctaTitle: "Browse tasks"
            ) { [weak self] in
                Task { @MainActor in self?.onBrowseTasks() }
            }
        case MyBidsTab.accepted:
            ListOfRowsState.EmptyContent(
                icon: .check,
                headline: "No accepted bids yet",
                subcopy: "Bids the poster accepts will show up here so you can "
                    + "coordinate the work.",
                ctaTitle: "Browse tasks"
            ) { [weak self] in
                Task { @MainActor in self?.onBrowseTasks() }
            }
        case MyBidsTab.rejected:
            ListOfRowsState.EmptyContent(
                icon: .x,
                headline: "Nothing here",
                subcopy: "Rejected, withdrawn, or expired bids will land here.",
                ctaTitle: nil,
                onCTA: nil
            )
        case MyBidsTab.done:
            ListOfRowsState.EmptyContent(
                icon: .checkCheck,
                headline: "No completed gigs yet",
                subcopy: "Finished gigs and their reviews will show up here.",
                ctaTitle: nil,
                onCTA: nil
            )
        default:
            ListOfRowsState.EmptyContent(
                icon: .gavel,
                headline: "Nothing here",
                subcopy: "",
                ctaTitle: nil,
                onCTA: nil
            )
        }
    }

    // MARK: - Mutations

    /// Open the withdraw confirmation sheet. The actual DELETE call
    /// runs through [`confirmWithdraw(reason:)`] after the user picks
    /// a reason in the sheet.
    public func requestWithdraw(_ dto: BidDTO) {
        guard let gigId = dto.gigId else { return }
        let title = dto.gig?.title ?? "this task"
        withdrawTarget = WithdrawSheetTarget(id: dto.id, gigId: gigId, gigTitle: title)
    }

    /// Cancel the sheet without performing a withdrawal.
    public func cancelWithdraw() {
        withdrawTarget = nil
    }

    /// Optimistically withdraw the bid. The row immediately disappears
    /// from the Active tab and re-appears (with the previous server
    /// state) if the DELETE fails.
    public func confirmWithdraw(reason: WithdrawBidReason?) async {
        guard let target = withdrawTarget else { return }
        withdrawTarget = nil
        let previous = bids
        guard let index = bids.firstIndex(where: { $0.id == target.id }) else { return }
        // Optimistically mark withdrawn so the row leaves the Active tab.
        bids[index] = Self.withdrawnCopy(of: bids[index], reason: reason)
        rebuild()
        do {
            _ = try await api.request(
                GigsEndpoints.withdrawBid(
                    gigId: target.gigId,
                    bidId: target.id,
                    reason: reason
                ),
                as: WithdrawBidResponse.self
            )
        } catch {
            // Roll back so the user can retry.
            bids = previous
            rebuild()
        }
    }

    // MARK: - Edit bid sheet

    /// Open the Edit Bid sheet pre-filled with the bid's current values.
    /// The view binds `editBidTarget` and renders the sheet on demand.
    public func requestEditBid(_ dto: BidDTO) {
        guard let gigId = dto.gigId else { return }
        let messageParts = Self.splitMessageAndTerms(dto.message)
        editBidTarget = EditBidSheetTarget(
            id: dto.id,
            gigId: gigId,
            gigTitle: dto.gig?.title ?? "this task",
            bidId: dto.id,
            initialAmount: dto.bidAmount,
            initialMessage: messageParts.message,
            initialProposedTime: dto.proposedTime,
            initialTerms: messageParts.terms
        )
    }

    /// Tear down the Edit Bid sheet without committing.
    public func cancelEditBid() {
        editBidTarget = nil
    }

    /// Submit the Edit Bid draft. Returns `true` on success so the sheet
    /// can self-dismiss; on failure the sheet renders its inline error.
    /// Mutates the cached bid optimistically when the PUT succeeds so
    /// the row reflects the new amount + message without a full refetch.
    @discardableResult
    public func submitEditBid(_ draft: EditBidDraft) async -> Bool {
        guard let target = editBidTarget,
              let bidId = target.bidId
        else { return false }
        let body = PlaceBidBody(
            bidAmount: draft.amount,
            message: draft.message,
            proposedTime: draft.proposedTime
        )
        do {
            _ = try await api.request(
                GigsEndpoints.updateBid(gigId: target.gigId, bidId: bidId, body: body),
                as: PlaceBidResponse.self
            )
            if let index = bids.firstIndex(where: { $0.id == bidId }) {
                bids[index] = Self.updatedCopy(of: bids[index], draft: draft)
                rebuild()
            }
            editBidTarget = nil
            toast = ToastMessage(text: "Bid updated.", kind: .success)
            return true
        } catch {
            toast = ToastMessage(
                text: (error as? APIError)?.errorDescription ?? "Couldn't update bid.",
                kind: .error
            )
            return false
        }
    }

    // MARK: - Leave review sheet

    /// Open the Leave Review sheet for the bid's gig. The reviewee is
    /// the gig poster (the worker reviews the client they did the work
    /// for after the gig is marked completed).
    public func requestLeaveReview(_ dto: BidDTO) {
        guard let gigId = dto.gigId,
              let revieweeId = dto.gig?.userId
        else { return }
        leaveReviewTarget = LeaveReviewSheetTarget(
            id: dto.id,
            gigId: gigId,
            revieweeId: revieweeId,
            gigTitle: dto.gig?.title ?? "this task",
            revieweeName: nil
        )
    }

    /// Tear down the Leave Review sheet without committing.
    public func cancelLeaveReview() {
        leaveReviewTarget = nil
    }

    /// Submit the review draft. Returns `true` on success.
    @discardableResult
    public func submitLeaveReview(_ draft: LeaveReviewDraft) async -> Bool {
        guard let target = leaveReviewTarget else { return false }
        let body = CreateReviewBody(
            gigId: target.gigId,
            revieweeId: target.revieweeId,
            rating: draft.rating,
            comment: draft.comment
        )
        do {
            _ = try await api.request(
                ReviewsEndpoints.create(body: body),
                as: EmptyResponse.self
            )
            leaveReviewTarget = nil
            toast = ToastMessage(text: "Review submitted. Thanks!", kind: .success)
            return true
        } catch {
            toast = ToastMessage(
                text: (error as? APIError)?.errorDescription ?? "Couldn't submit review.",
                kind: .error
            )
            return false
        }
    }

    // MARK: - Counter response (Phase 5)

    /// Bidder accepts the poster's counter-offer:
    /// `POST /api/gigs/:gigId/bids/:bidId/counter/accept`
    /// (`backend/routes/gigs.js:5187`). Optimistic — the bid amount
    /// becomes the counter and the row settles back to Pending; rolls
    /// back on failure.
    public func acceptCounter(_ dto: BidDTO) async {
        guard let gigId = dto.gigId, let counter = dto.counterAmount,
              let index = bids.firstIndex(where: { $0.id == dto.id }) else { return }
        let previous = bids
        bids[index] = Self.counterRespondedCopy(of: bids[index], accepted: true)
        rebuild()
        do {
            _ = try await api.request(
                GigsEndpoints.acceptCounter(gigId: gigId, bidId: dto.id),
                as: PlaceBidResponse.self
            )
            toast = ToastMessage(
                text: "Counter accepted — your bid is now \(OffersViewModel.formatPrice(counter)).",
                kind: .success
            )
        } catch {
            bids = previous
            rebuild()
            toast = ToastMessage(
                text: (error as? APIError)?.errorDescription ?? "Couldn't accept the counter-offer.",
                kind: .error
            )
        }
    }

    /// Bidder declines the counter — the original pending bid stands.
    /// `POST .../counter/decline` (`backend/routes/gigs.js:5263`).
    public func declineCounter(_ dto: BidDTO) async {
        guard let gigId = dto.gigId,
              let index = bids.firstIndex(where: { $0.id == dto.id }) else { return }
        let previous = bids
        bids[index] = Self.counterRespondedCopy(of: bids[index], accepted: false)
        rebuild()
        do {
            _ = try await api.request(
                GigsEndpoints.declineCounter(gigId: gigId, bidId: dto.id),
                as: PlaceBidResponse.self
            )
            toast = ToastMessage(text: "Counter declined — your original bid stands.", kind: .success)
        } catch {
            bids = previous
            rebuild()
            toast = ToastMessage(
                text: (error as? APIError)?.errorDescription ?? "Couldn't decline the counter-offer.",
                kind: .error
            )
        }
    }

    /// Optimistically mark the assigned gig as complete. The row moves
    /// from Accepted → Done; on failure we restore the cached state.
    public func markComplete(_ dto: BidDTO) async {
        guard let gigId = dto.gigId, let index = bids.firstIndex(where: { $0.id == dto.id }) else {
            return
        }
        let previous = bids
        bids[index] = Self.markedCompleteCopy(of: bids[index])
        rebuild()
        do {
            _ = try await api.request(
                GigsEndpoints.markCompleted(gigId: gigId),
                as: EmptyResponse.self
            )
        } catch {
            bids = previous
            rebuild()
        }
    }

    // MARK: - Pure projections (test surface)

    public struct BidProjection: Sendable {
        public let dto: BidDTO
        public let tab: String
        public let status: MyBidsStatus
        public let footer: MyBidsFooter
    }

    /// Map a backend bid to its tab based on `bid.status` + `gig.status`.
    /// Mirrors the canonical map in docs/t5-buildout-plan.md:
    ///   Active   = pending OR countered (gig still open)
    ///   Accepted = accepted, gig not completed
    ///   Rejected = rejected OR withdrawn OR expired OR (gig cancelled)
    ///   Done     = completed gigs
    public static func tabFor(dto: BidDTO, now _: Date) -> String {
        let bidStatus = (dto.status ?? "").lowercased()
        let gigStatus = (dto.gig?.status ?? "").lowercased()
        // A cancelled gig drops the bid into Rejected regardless of its
        // own status, *unless* it already finished.
        if gigStatus == "cancelled" && bidStatus != "accepted" {
            return MyBidsTab.rejected
        }
        if gigStatus == "completed" && bidStatus == "accepted" {
            return MyBidsTab.done
        }
        switch bidStatus {
        case "pending", "countered":
            return MyBidsTab.active
        case "accepted", "assigned":
            return MyBidsTab.accepted
        case "rejected", "declined", "withdrawn", "expired":
            return MyBidsTab.rejected
        default:
            return MyBidsTab.active
        }
    }

    /// Compute the design chip for a bid. See header comment for the
    /// full mapping table.
    public static func derivedStatus(for dto: BidDTO, now: Date) -> MyBidsStatus {
        let bidStatus = (dto.status ?? "").lowercased()
        let gigStatus = (dto.gig?.status ?? "").lowercased()

        // Terminal states take precedence over the live signals.
        if gigStatus == "cancelled", bidStatus != "accepted" {
            return .taskCancelled
        }
        if gigStatus == "completed", bidStatus == "accepted" {
            // TODO(reviews-flag): swap to `.paid(amount:)` when a
            // backend-driven "already_reviewed" signal lands. For now
            // the chip prompts for a review on every completed gig.
            return .leaveReview
        }

        switch bidStatus {
        case "rejected", "declined", "withdrawn", "expired":
            return .notSelected
        case "accepted", "assigned":
            return acceptedStatus(for: dto, now: now)
        case "pending", "countered":
            return pendingStatus(for: dto, now: now)
        default:
            return .pending
        }
    }

    /// `accepted` / `assigned` projection — "Starts {weekday}" when the
    /// worker has a future `proposed_time`, otherwise the plain
    /// "Accepted" chip.
    private static func acceptedStatus(for dto: BidDTO, now: Date) -> MyBidsStatus {
        if let proposed = parseDate(dto.proposedTime), proposed > now {
            return .scheduled(weekday: formatWeekday(proposed))
        }
        return .accepted
    }

    /// `pending` / `countered` projection — a live counter-offer wins
    /// (the bidder has an action to take), then expiring-soon, then the
    /// P3 backend-prep signals (Top bid / Shortlisted / Outbid). Falls
    /// back to a neutral "Pending" chip when no signal fires.
    private static func pendingStatus(for dto: BidDTO, now: Date) -> MyBidsStatus {
        if (dto.status ?? "").lowercased() == "countered",
           dto.counterStatus == "pending",
           let counter = dto.counterAmount {
            return .countered(amount: OffersViewModel.formatPrice(counter))
        }
        if let expires = parseDate(dto.expiresAt) {
            let timeLeft = expires.timeIntervalSince(now)
            if timeLeft > 0, timeLeft < MyBidsStatus.expiringWindow {
                let hours = max(1, Int(ceil(timeLeft / 3600)))
                return .expiring(hoursLeft: hours)
            }
        }
        if dto.shortlisted == true { return .shortlisted }
        if let rank = dto.yourRank, rank == 1 { return .topBid }
        if let rank = dto.yourRank, rank > 1, dto.topPrice != nil { return .outbid }
        return .pending
    }

    /// Footer action for the row. Live bids are editable / withdrawable;
    /// accepted-pending-work bids let the user nudge the client;
    /// in-progress lets the worker mark complete; completed prompts a
    /// review; terminal rows offer "Bid again".
    public static func footerFor(dto: BidDTO, tab: String, status: MyBidsStatus) -> MyBidsFooter {
        switch tab {
        case MyBidsTab.active:
            if case let .countered(amount) = status {
                return .counter(amount: amount)
            }
            return .edit
        case MyBidsTab.accepted:
            // "Mark complete" only when the gig is in progress; before
            // that the worker just messages the poster.
            let gigStatus = (dto.gig?.status ?? "").lowercased()
            if gigStatus == "in_progress" {
                return .complete
            }
            return .message
        case MyBidsTab.done:
            if case .leaveReview = status {
                // `/api/gigs/my-bids` does not inline the gig poster, so
                // we degrade the design's "Leave a review for {first}"
                // to "Leave a review" until a future backend PR adds
                // `poster: {…}` to the bid DTO. Footer renders the
                // shorter label via the empty-string fall-through.
                return .review(firstName: "")
            }
            return .none
        case MyBidsTab.rejected:
            return .rebid
        default:
            return .none
        }
    }

    /// Bundle of row callbacks — keeps the public `row()` projection
    /// under SwiftLint's 5-param ceiling without losing wire fidelity.
    public struct RowCallbacks: Sendable {
        public let onTap: @Sendable () -> Void
        public let onWithdraw: @Sendable () -> Void
        public let onEditBid: @Sendable () -> Void
        public let onMessage: @Sendable () -> Void
        public let onMarkComplete: @Sendable () -> Void
        public let onLeaveReview: @Sendable () -> Void
        public let onRebid: @Sendable () -> Void
        public let onAcceptCounter: @Sendable () -> Void
        public let onDeclineCounter: @Sendable () -> Void

        public init(
            onTap: @escaping @Sendable () -> Void = {},
            onWithdraw: @escaping @Sendable () -> Void = {},
            onEditBid: @escaping @Sendable () -> Void = {},
            onMessage: @escaping @Sendable () -> Void = {},
            onMarkComplete: @escaping @Sendable () -> Void = {},
            onLeaveReview: @escaping @Sendable () -> Void = {},
            onRebid: @escaping @Sendable () -> Void = {},
            onAcceptCounter: @escaping @Sendable () -> Void = {},
            onDeclineCounter: @escaping @Sendable () -> Void = {}
        ) {
            self.onTap = onTap
            self.onWithdraw = onWithdraw
            self.onEditBid = onEditBid
            self.onMessage = onMessage
            self.onMarkComplete = onMarkComplete
            self.onLeaveReview = onLeaveReview
            self.onRebid = onRebid
            self.onAcceptCounter = onAcceptCounter
            self.onDeclineCounter = onDeclineCounter
        }
    }

    /// Render a single row. Pure projection — public so tests can
    /// assert the mapping without standing up the VM.
    public static func row(
        projection: BidProjection,
        now: Date,
        callbacks: RowCallbacks
    ) -> RowModel {
        let dto = projection.dto
        let category = OffersCategory.from(rawCategory: dto.gig?.category)
        let amount = OffersViewModel.formatPrice(dto.bidAmount)
        let budget = formatBudgetSublabel(dto.gig?.price)
        let title = dto.gig?.title?.isEmpty == false ? (dto.gig?.title ?? "Bid") : "Bid"
        let chip = RowChip(
            text: projection.status.label,
            icon: projection.status.icon,
            tint: .status(projection.status.chipVariant)
        )

        return RowModel(
            id: dto.id,
            title: title,
            subtitle: subtitle(for: dto, now: now),
            template: .statusChip,
            leading: .categoryGradientIcon(category.icon, gradient: category.gradient),
            trailing: .priceStack(amount: amount, sublabel: budget),
            onTap: callbacks.onTap,
            chips: [chip],
            metaTail: metaTail(for: dto, status: projection.status, now: now),
            highlight: highlight(for: projection),
            footer: footer(for: projection.footer, callbacks: callbacks, bidId: dto.id)
        )
    }

    // MARK: - Helpers

    private static func tabCounts(for projections: [BidProjection], now: Date) -> TabCounts {
        var counts = TabCounts()
        for proj in projections {
            switch proj.tab {
            case MyBidsTab.active: counts.active += 1
            case MyBidsTab.accepted: counts.accepted += 1
            case MyBidsTab.rejected: counts.rejected += 1
            case MyBidsTab.done: counts.done += 1
            default: break
            }
            if proj.tab == MyBidsTab.active {
                if case .topBid = proj.status { counts.leading += 1 }
                if let expires = parseDate(proj.dto.expiresAt) {
                    let timeLeft = expires.timeIntervalSince(now)
                    if timeLeft > 0, timeLeft < 24 * 3600 { counts.closingSoon += 1 }
                }
            }
        }
        return counts
    }

    /// The `/api/gigs/my-bids` endpoint does NOT inline the gig
    /// poster's user identity (only `gig.user_id`). The design's
    /// "for {posterName} · {neighborhood} · {postedAgo}" line therefore
    /// degrades to the parts we can reliably render today — the gig
    /// price-ask context + the bid's age. The poster name is added as
    /// a sentence prefix when the backend lands a `poster: {…}` field
    /// (planned with the P3 enrichment PR).
    private static func subtitle(for dto: BidDTO, now: Date) -> String {
        var parts: [String] = []
        if let category = dto.gig?.category, !category.isEmpty {
            parts.append(humanizeCategory(category))
        }
        if let time = OffersViewModel.formatRelativeTime(dto.createdAt, now: now) {
            parts.append(time)
        }
        return parts.joined(separator: " · ")
    }

    static func humanizeCategory(_ raw: String) -> String {
        let cleaned = raw
            .replacingOccurrences(of: "_", with: " ")
            .replacingOccurrences(of: "-", with: " ")
        return cleaned.prefix(1).uppercased() + cleaned.dropFirst()
    }

    /// Optional small dim text appended after the chip on the row's
    /// chip line. Conveys "3 others bid · 1d left" / "top now $65 · 2h
    /// to revise" — the exact tail depends on the chip variant.
    public static func metaTail(for dto: BidDTO, status: MyBidsStatus, now: Date) -> String? {
        switch status {
        case .outbid:
            if let topPrice = dto.topPrice {
                return "top now \(OffersViewModel.formatPrice(topPrice))"
            }
            return nil
        case .expiring, .countered:
            // Already in the chip; no tail needed.
            return nil
        case .topBid, .shortlisted, .pending:
            if let expires = parseDate(dto.expiresAt), expires > now {
                return timeLeftLabel(from: now, to: expires)
            }
            return nil
        case .accepted, .scheduled:
            return nil
        case .notSelected, .taskCancelled, .paid, .leaveReview:
            return nil
        }
    }

    /// Apply the `RowHighlight.muted` opacity to terminal rows.
    public static func highlight(for projection: BidProjection) -> RowHighlight? {
        switch projection.status {
        case .notSelected, .taskCancelled: .muted
        default: nil
        }
    }

    // swiftlint:disable:next function_body_length
    private static func footer(
        for variant: MyBidsFooter,
        callbacks: RowCallbacks,
        bidId: String = ""
    ) -> RowFooter? {
        switch variant {
        case .none:
            return nil
        case .edit:
            return RowFooter(actions: [
                RowFooterAction(
                    title: "Withdraw",
                    icon: .x,
                    variant: .destructive,
                    handler: callbacks.onWithdraw
                ),
                RowFooterAction(
                    title: "Edit bid",
                    icon: .pencil,
                    variant: .primary,
                    handler: callbacks.onEditBid
                )
            ])
        case let .counter(amount):
            return RowFooter(actions: [
                RowFooterAction(
                    title: "Decline counter",
                    icon: .x,
                    variant: .destructive,
                    identifier: "myBids.counter_\(bidId).decline",
                    handler: callbacks.onDeclineCounter
                ),
                RowFooterAction(
                    title: "Accept \(amount)",
                    icon: .check,
                    variant: .primary,
                    identifier: "myBids.counter_\(bidId).accept",
                    handler: callbacks.onAcceptCounter
                )
            ])
        case .message:
            return RowFooter(actions: [
                RowFooterAction(
                    title: "View details",
                    icon: .fileText,
                    variant: .ghost,
                    handler: callbacks.onTap
                ),
                RowFooterAction(
                    title: "Message client",
                    icon: .messageCircle,
                    variant: .primary,
                    handler: callbacks.onMessage
                )
            ])
        case .complete:
            return RowFooter(actions: [
                RowFooterAction(
                    title: "Message",
                    icon: .messageCircle,
                    variant: .ghost,
                    handler: callbacks.onMessage
                ),
                RowFooterAction(
                    title: "Mark complete",
                    icon: .checkCheck,
                    variant: .primary,
                    handler: callbacks.onMarkComplete
                )
            ])
        case let .review(firstName):
            let title = firstName.isEmpty ? "Leave a review" : "Leave a review for \(firstName)"
            return RowFooter(actions: [
                RowFooterAction(
                    title: title,
                    icon: .star,
                    variant: .primary,
                    handler: callbacks.onLeaveReview
                )
            ])
        case .rebid:
            return RowFooter(actions: [
                RowFooterAction(
                    title: "Bid on similar",
                    icon: .arrowsRepeat,
                    variant: .ghost,
                    handler: callbacks.onRebid
                )
            ])
        }
    }

    public static func formatBudgetSublabel(_ price: Double?) -> String? {
        guard let price, price > 0 else { return nil }
        return "budget \(OffersViewModel.formatPrice(price))"
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

    static func formatWeekday(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "EEE"
        return formatter.string(from: date)
    }

    /// "1d left" / "2h left" / "Closing soon" — the small dim text we
    /// append after the chip on Active rows.
    public static func timeLeftLabel(from now: Date, to expires: Date) -> String {
        let seconds = expires.timeIntervalSince(now)
        if seconds <= 0 { return "Closing soon" }
        let days = Int(seconds / 86400)
        if days >= 1 { return "\(days)d left" }
        let hours = Int(seconds / 3600)
        if hours >= 1 { return "\(hours)h left" }
        let minutes = max(1, Int(seconds / 60))
        return "\(minutes)m left"
    }

    /// Build an optimistic copy of a bid that's just been edited.
    /// Replaces amount + message + proposed_time; leaves everything
    /// else (status, rank, etc.) untouched.
    public static func updatedCopy(of dto: BidDTO, draft: EditBidDraft) -> BidDTO {
        BidDTO(
            id: dto.id,
            gigId: dto.gigId,
            userId: dto.userId,
            bidAmount: draft.amount,
            message: draft.message,
            proposedTime: draft.proposedTime,
            status: dto.status,
            createdAt: dto.createdAt,
            updatedAt: ISO8601DateFormatter().string(from: Date()),
            expiresAt: dto.expiresAt,
            counterAmount: dto.counterAmount,
            counterStatus: dto.counterStatus,
            counteredAt: dto.counteredAt,
            withdrawnAt: dto.withdrawnAt,
            withdrawalReason: dto.withdrawalReason,
            gig: dto.gig,
            bidder: dto.bidder,
            shortlisted: dto.shortlisted,
            yourRank: dto.yourRank,
            topPrice: dto.topPrice
        )
    }

    /// Reverse of `EditBidSheetView.composeMessage(…)` — split a stored
    /// bid `message` back into its `(message, terms)` halves so the
    /// edit sheet can pre-fill both fields.
    public static func splitMessageAndTerms(_ raw: String?) -> (message: String?, terms: String?) {
        guard let raw, !raw.isEmpty else { return (nil, nil) }
        guard let range = raw.range(of: "\n\nTerms: ") else {
            if raw.hasPrefix("Terms: ") {
                let terms = String(raw.dropFirst("Terms: ".count))
                return (nil, terms.isEmpty ? nil : terms)
            }
            return (raw, nil)
        }
        let message = String(raw[..<range.lowerBound])
        let terms = String(raw[range.upperBound...])
        return (
            message.isEmpty ? nil : message,
            terms.isEmpty ? nil : terms
        )
    }

    /// Build an optimistic copy of a bid whose counter the bidder just
    /// answered. Mirrors the backend transition: accept moves
    /// `bid_amount` to the counter; both arms settle back to `pending`.
    public static func counterRespondedCopy(of dto: BidDTO, accepted: Bool) -> BidDTO {
        BidDTO(
            id: dto.id,
            gigId: dto.gigId,
            userId: dto.userId,
            bidAmount: accepted ? (dto.counterAmount ?? dto.bidAmount) : dto.bidAmount,
            message: dto.message,
            proposedTime: dto.proposedTime,
            status: "pending",
            createdAt: dto.createdAt,
            updatedAt: ISO8601DateFormatter().string(from: Date()),
            expiresAt: dto.expiresAt,
            counterAmount: dto.counterAmount,
            counterStatus: accepted ? "accepted" : "declined",
            counteredAt: dto.counteredAt,
            withdrawnAt: dto.withdrawnAt,
            withdrawalReason: dto.withdrawalReason,
            gig: dto.gig,
            bidder: dto.bidder,
            shortlisted: dto.shortlisted,
            yourRank: dto.yourRank,
            topPrice: dto.topPrice
        )
    }

    /// Build an optimistic copy of a bid that's just been withdrawn.
    /// `withdrawnAt` flips the tab to Rejected; the chip becomes "Not
    /// selected".
    public static func withdrawnCopy(of dto: BidDTO, reason: WithdrawBidReason?) -> BidDTO {
        BidDTO(
            id: dto.id,
            gigId: dto.gigId,
            userId: dto.userId,
            bidAmount: dto.bidAmount,
            message: dto.message,
            proposedTime: dto.proposedTime,
            status: "withdrawn",
            createdAt: dto.createdAt,
            updatedAt: ISO8601DateFormatter().string(from: Date()),
            expiresAt: dto.expiresAt,
            counterAmount: dto.counterAmount,
            counterStatus: dto.counterStatus,
            counteredAt: dto.counteredAt,
            withdrawnAt: ISO8601DateFormatter().string(from: Date()),
            withdrawalReason: reason?.rawValue,
            gig: dto.gig,
            bidder: dto.bidder,
            shortlisted: dto.shortlisted,
            yourRank: dto.yourRank,
            topPrice: dto.topPrice
        )
    }

    /// Build an optimistic copy of a bid whose gig was just marked
    /// completed. The bid stays `accepted` but the gig flips to
    /// `completed`, which moves the row to the Done tab.
    public static func markedCompleteCopy(of dto: BidDTO) -> BidDTO {
        guard let gig = dto.gig else { return dto }
        let updatedGig = BidGigDTO(
            id: gig.id,
            title: gig.title,
            description: gig.description,
            price: gig.price,
            category: gig.category,
            status: "completed",
            userId: gig.userId
        )
        return BidDTO(
            id: dto.id,
            gigId: dto.gigId,
            userId: dto.userId,
            bidAmount: dto.bidAmount,
            message: dto.message,
            proposedTime: dto.proposedTime,
            status: dto.status,
            createdAt: dto.createdAt,
            updatedAt: ISO8601DateFormatter().string(from: Date()),
            expiresAt: dto.expiresAt,
            counterAmount: dto.counterAmount,
            counterStatus: dto.counterStatus,
            counteredAt: dto.counteredAt,
            withdrawnAt: dto.withdrawnAt,
            withdrawalReason: dto.withdrawalReason,
            gig: updatedGig,
            bidder: dto.bidder,
            shortlisted: dto.shortlisted,
            yourRank: dto.yourRank,
            topPrice: dto.topPrice
        )
    }
}

// MARK: - Withdraw response

/// Body returned by `DELETE /api/gigs/:gigId/bids/:bidId`.
public struct WithdrawBidResponse: Decodable, Sendable {
    public let message: String?
    public let rebidAvailableAt: String?

    enum CodingKeys: String, CodingKey {
        case message
        case rebidAvailableAt = "rebid_available_at"
    }
}
