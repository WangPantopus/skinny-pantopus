//
//  MyTasksViewModel.swift
//  Pantopus
//
//  T5.3.2 — My tasks V2. The poster's side of the gigs marketplace and
//  the inverse of My bids. Each row represents one task the user has
//  posted, with the status chip + counts oriented around the seller's
//  question: "what do I need to act on next?"
//
//  Design contract (mytasks-frames.jsx):
//    - Top bar: back chevron + "My tasks" + trailing filter icon
//    - Four equal-width tabs:
//        Open (N)   — reviewing bids, urgent (closes soon), no bids yet
//        Active (N) — in progress, scheduled (assigned not started)
//        Done (N)   — completed, await review
//        Closed (N) — cancelled, expired
//    - 56pt round canonical-create FAB (plus icon) — "Post a task"
//    - Each row uses Shape C:
//        leading:  40pt category gradient icon
//        title:    task title (up to 2 lines)
//        trailing: priceStack — task budget + "$X/hr" sublabel for hourly
//        subtitle: "posted {timeAgo} · {bidCount} bids · {bidRange}"
//        bidderStack: 3 overlapping 22pt avatars + `+N` overflow (when
//                     bidders > 0, replaces the meta tail position)
//        chips:    status chip
//        footer:   varies by status (see ACTIONS map below)
//    - Terminal rows (cancelled / expired) render at 0.78 opacity via
//      the shared `RowHighlight.muted` case.
//    - Banner above the Open tab summarises "{newBids} new bids since
//      yesterday · {closing} task closing in the next 24h".
//
//  Backend (this PR lands the missing bits — see gigs.js):
//    - GET    /api/gigs/my-gigs                       (gigs.js:1169 +
//      new top_bidders[≤3] + bid_count + boost fields)
//    - POST   /api/gigs/:gigId/boost                  (new in this PR)
//    - POST   /api/gigs/:gigId/complete               (gigs.js:6170 —
//      poster confirmation, NOT the worker's /mark-completed)
//    - POST   /api/gigs/:gigId/cancel                 (gigs.js:6233)
//    - POST   /api/gigs                               (gigs.js:749 —
//      only used by the FAB)
//

import Foundation
import Observation
import SwiftUI

// swiftlint:disable file_length function_body_length type_body_length

// MARK: - Tab identifiers

public enum MyTasksTab {
    public static let open = "open"
    public static let active = "active"
    public static let done = "done"
    public static let closed = "closed"
}

// MARK: - Chip status

/// One of nine chip variants the design's STATUS map calls out. Derived
/// from `(gig.status, bid_count, deadline, scheduled_start)` by
/// [`MyTasksViewModel.derivedStatus`].
public enum MyTasksStatus: Sendable, Hashable {
    /// "Reviewing bids" — open + has bids.
    case reviewing
    /// "Closes in Xh" — open + deadline within 4h.
    case urgent(hoursLeft: Int)
    /// "No bids yet" — open + zero bids.
    case noBids
    /// "In progress" — gig.status = in_progress.
    case inProgress
    /// "Starts {weekday}" — gig.status = assigned + scheduled_start in
    /// the future.
    case scheduled(weekday: String)
    /// "Leave a review" — completed gigs where the poster hasn't yet
    /// rated the worker (uses awaitReview as a fallback while the
    /// backend doesn't surface `poster_review_left`).
    case awaitReview
    /// "Completed" — completed + the poster has already rated.
    case completed
    /// "Cancelled" — gig.status = cancelled.
    case cancelled
    /// "Expired" — open + deadline has passed.
    case expired

    /// Window inside which the open-tab chip flips to "Closes in Xh".
    public static let urgentWindow: TimeInterval = 4 * 60 * 60

    public var label: String {
        switch self {
        case .reviewing: "Reviewing bids"
        case let .urgent(hours): "Closes in \(hours)h"
        case .noBids: "No bids yet"
        case .inProgress: "In progress"
        case let .scheduled(weekday): "Starts \(weekday)"
        case .awaitReview: "Leave a review"
        case .completed: "Completed"
        case .cancelled: "Cancelled"
        case .expired: "Expired"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .reviewing: .inbox
        case .urgent: .timer
        case .noBids: .circleSlash
        case .inProgress: .play
        case .scheduled: .calendar
        case .awaitReview: .star
        case .completed: .checkCheck
        case .cancelled: .x
        case .expired: .ban
        }
    }

    /// Chip variant straight from the design's STATUS map.
    public var chipVariant: StatusChipVariant {
        switch self {
        case .reviewing, .scheduled, .awaitReview: .info
        case .urgent: .error
        case .noBids, .cancelled, .expired: .neutral
        case .inProgress, .completed: .success
        }
    }
}

// MARK: - Magic archetype + task format

/// T6.0b — Magic Task archetype taxonomy. Maps the backend's
/// `task_archetype` enum to the design's row chrome — uppercase
/// overline label, leading-tile icon, and the two-stop gradient used
/// to tint the tile background. The mapping mirrors the
/// `mytasks-frames.jsx` populated frame (Mount & install · Moving
/// help · Pet care · Tech support · Furniture assembly).
public enum MyTasksArchetype: String, Sendable, Hashable, CaseIterable {
    case quickHelp = "quick_help"
    case deliveryErrand = "delivery_errand"
    case homeService = "home_service"
    case proServiceQuote = "pro_service_quote"
    case careTask = "care_task"
    case eventShift = "event_shift"
    case remoteTask = "remote_task"
    case recurringService = "recurring_service"
    case general

    /// Resolve a raw backend string to the typed enum. Unknown values
    /// fall through to `.general` so a future backend addition doesn't
    /// break the row.
    public static func from(rawArchetype: String?) -> MyTasksArchetype {
        guard let raw = rawArchetype?.lowercased(), !raw.isEmpty else { return .general }
        return MyTasksArchetype(rawValue: raw) ?? .general
    }

    /// Uppercase, +0.06em-tracked overline label rendered above the row
    /// title — the design's "MOUNT & INSTALL" / "MOVING HELP" /
    /// "DOG-WALK" overline.
    public var overlineLabel: String {
        switch self {
        case .quickHelp: "Quick help"
        case .deliveryErrand: "Delivery"
        case .homeService: "Mount & install"
        case .proServiceQuote: "Pro service"
        case .careTask: "Pet care"
        case .eventShift: "Event help"
        case .remoteTask: "Tech support"
        case .recurringService: "Recurring"
        case .general: "Magic task"
        }
    }

    /// Leading-tile icon for the archetype. White-on-gradient.
    public var icon: PantopusIcon {
        switch self {
        case .quickHelp: .sparkles
        case .deliveryErrand: .package
        case .homeService: .tv
        case .proServiceQuote: .hammer
        case .careTask: .dog
        case .eventShift: .calendar
        case .remoteTask: .laptop
        case .recurringService: .arrowsRepeat
        case .general: .clipboardList
        }
    }

    /// Two-stop linear gradient (135°) used to tint the leading tile.
    /// Per-archetype palette mirrors the design's frame —
    /// `mytasks-frames.jsx:540-585`.
    public var gradient: GradientPair {
        switch self {
        case .quickHelp:
            // Sky 400 → Blue 700
            GradientPair(start: Theme.Color.primary400, end: Theme.Color.primary700)
        case .deliveryErrand:
            // Violet 400 → Violet 700 (matches "Moving help" tile)
            GradientPair(start: Theme.Color.business, end: Theme.Color.magic)
        case .homeService:
            // Sky 400 → Blue 700 (TV mount)
            GradientPair(start: Theme.Color.primary400, end: Theme.Color.primary700)
        case .proServiceQuote:
            // Amber 500 → Amber 700 (furniture assembly)
            GradientPair(start: Theme.Color.warning, end: Theme.Color.warning)
        case .careTask:
            // Emerald 400 → Emerald 700 (pet care)
            GradientPair(start: Theme.Color.success, end: Theme.Color.success)
        case .eventShift:
            // Rose 400 → Rose 700
            GradientPair(start: Theme.Color.error, end: Theme.Color.error)
        case .remoteTask:
            // Cyan 400 → Cyan 700 (tech support)
            GradientPair(start: Theme.Color.primary500, end: Theme.Color.primary800)
        case .recurringService:
            // Sky 600 → Sky 800
            GradientPair(start: Theme.Color.primary600, end: Theme.Color.primary800)
        case .general:
            // Magic lavender — when the archetype is unknown we still
            // surface the Magic Task signal via the lavender tint.
            GradientPair(start: Theme.Color.magicBorder, end: Theme.Color.magic)
        }
    }
}

/// T6.0b — Helper-engagement format taxonomy. Per T6 Q13 the design's
/// `engagement_mode` concept is renamed `task_format` on the backend
/// to avoid colliding with the offer-acceptance mode. Drives the
/// neutral-tinted badge that sits flush after the status chip on a
/// My tasks V2 row.
public enum MyTasksFormat: String, Sendable, Hashable, CaseIterable {
    case inPerson = "in_person"
    case dropOff = "drop_off"
    case remote
    case hybrid

    public static func from(rawFormat: String?) -> MyTasksFormat? {
        guard let raw = rawFormat?.lowercased(), !raw.isEmpty else { return nil }
        return MyTasksFormat(rawValue: raw)
    }

    public var label: String {
        switch self {
        case .inPerson: "In person"
        case .dropOff: "Drop-off"
        case .remote: "Remote"
        case .hybrid: "Hybrid"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .inPerson: .mapPin
        case .dropOff: .package
        case .remote: .monitor
        case .hybrid: .shuffle
        }
    }
}

/// True when a gig was posted via the Magic Task flow. Pure projection
/// from the DTO's `source_flow` field; exposed at module scope so the
/// shell, tests, and the row mapper can all share one definition.
public func isMagicTask(_ dto: MyGigDTO) -> Bool {
    (dto.sourceFlow ?? "").lowercased() == "magic"
}

// MARK: - Footer actions

/// Footer-action archetype per the design's `actions` prop. The shell
/// renders each variant as 1–2 `CompactButton.footer` (34pt) entries.
public enum MyTasksFooter: Sendable, Hashable {
    /// `open` — [Edit (ghost), Review N bids (primary 2× flex)].
    case open(bidCount: Int)
    /// `urgent` — [Extend 24h (ghost), Review N bids (primary 2× flex)].
    case urgent(bidCount: Int)
    /// `boost` — [Edit details (ghost), Boost in feed (primary)]. Used
    /// for open + no-bids tasks.
    case boost
    /// `inprogress` — [Message (ghost), Mark complete (primary)].
    case inProgress
    /// `review` — single full-width "Leave a review".
    case review
    /// `repost` — single full-width "Repost task".
    case repost
    /// No footer (terminal rows).
    case none
}

// MARK: - View model

@Observable
@MainActor
public final class MyTasksViewModel: ListOfRowsDataSource {
    // MARK: - Public chrome

    public let title = "My tasks"

    public var tabs: [ListOfRowsTab] {
        [
            ListOfRowsTab(id: MyTasksTab.open, label: "Open", count: counts.open),
            ListOfRowsTab(id: MyTasksTab.active, label: "Active", count: counts.active),
            ListOfRowsTab(id: MyTasksTab.done, label: "Done", count: counts.done),
            ListOfRowsTab(id: MyTasksTab.closed, label: "Closed", count: counts.closed)
        ]
    }

    public var selectedTab: String = MyTasksTab.open {
        didSet {
            guard oldValue != selectedTab else { return }
            rebuild()
        }
    }

    public var fab: FABAction? {
        // T6.0b — Magic Task FAB. 60pt gradient (primary600 → primary700)
        // with a sparkles disc clipped over the top-right corner.
        // Tapping invokes the same `onPostTask` callback the screen
        // already wires; the destination route is responsible for
        // opening the Magic Task draft flow (or falling back to the
        // classic compose form when Magic Task is feature-flagged off).
        FABAction(
            icon: .plus,
            accessibilityLabel: "Post a task with Magic Task",
            variant: .magicCreate
        ) { [weak self] in
            guard let self else { return }
            Task { @MainActor in self.onPostTask() }
        }
    }

    /// One-tap rebook from the "Rebook a favorite helper" rail. Opens the
    /// composer for the completed task's category.
    ///
    /// RN additionally prefills the task *title*, which the native compose
    /// route cannot carry — `HubRoute.composeGig` takes `category` only
    /// (HubTabRoot.swift:213), and widening it would touch every existing
    /// caller. Category prefill ships; title prefill is recorded as a gap.
    public func rebook(_ gig: RebookableGigDTO) {
        onRebook(gig)
    }

    public var topBarAction: TopBarAction? {
        TopBarAction(
            icon: .filter,
            accessibilityLabel: "Filter tasks"
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
    /// "no filter" position.
    public private(set) var activityFilter = ActivityFilter()

    /// Section header for the status chips in the sheet.
    public let statusFilterTitle = "Task status"

    /// Per-surface status chips (the four task lifecycle buckets).
    public let statusFilterOptions: [FilterOption] = [
        FilterOption(id: "open", label: "Open"),
        FilterOption(id: "in_progress", label: "In progress"),
        FilterOption(id: "done", label: "Done"),
        FilterOption(id: "closed", label: "Closed")
    ]

    /// Tasks carry a budget, so the full sort set (incl. value) applies.
    public let sortFilterOptions = ActivitySortOrder.all

    /// Store the applied filter and re-project the visible rows.
    public func applyFilter(_ filter: ActivityFilter) {
        activityFilter = filter
        rebuild()
    }

    public var banner: BannerConfig? {
        guard selectedTab == MyTasksTab.open else { return nil }
        guard counts.openTotal > 0 else { return nil }
        let title: String
        if counts.newBidsToday > 0 {
            let bidWord = counts.newBidsToday == 1 ? "bid" : "bids"
            title = "\(counts.newBidsToday) new \(bidWord) since yesterday"
        } else {
            let taskWord = counts.openTotal == 1 ? "task" : "tasks"
            title = "\(counts.openTotal) open \(taskWord)"
        }
        let subtitle: String? = if counts.closingSoon > 0 {
            "\(counts.closingSoon) closing in the next 24h"
        } else {
            nil
        }
        return BannerConfig(icon: .inbox, title: title, subtitle: subtitle, onTap: nil)
    }

    public private(set) var state: ListOfRowsState = .loading

    // MARK: - Dependencies

    private let api: APIClient
    private let onOpenTask: @MainActor (MyGigDTO) -> Void
    private let onOpenBids: @MainActor (MyGigDTO) -> Void
    private let onEditTask: @MainActor (MyGigDTO) -> Void
    private let onMessageWorker: @MainActor (MyGigDTO) -> Void
    private let onLeaveReview: @MainActor (MyGigDTO) -> Void
    private let onPostTask: @MainActor () -> Void
    private let onRepost: @MainActor (MyGigDTO) -> Void
    private let onRebook: @MainActor (RebookableGigDTO) -> Void
    private let now: @Sendable () -> Date

    // MARK: - Local data

    private var gigs: [MyGigDTO] = []
    private var loadedAtLeastOnce = false
    private var counts = TabCounts()

    private struct TabCounts {
        var open = 0
        var active = 0
        var done = 0
        var closed = 0
        // Open-tab banner signals
        var openTotal = 0
        var newBidsToday = 0
        var closingSoon = 0
    }

    init(
        api: APIClient = .shared,
        onOpenTask: @escaping @MainActor (MyGigDTO) -> Void = { _ in },
        onOpenBids: @escaping @MainActor (MyGigDTO) -> Void = { _ in },
        onEditTask: @escaping @MainActor (MyGigDTO) -> Void = { _ in },
        onMessageWorker: @escaping @MainActor (MyGigDTO) -> Void = { _ in },
        onLeaveReview: @escaping @MainActor (MyGigDTO) -> Void = { _ in },
        onPostTask: @escaping @MainActor () -> Void = {},
        onRepost: @escaping @MainActor (MyGigDTO) -> Void = { _ in },
        onRebook: @escaping @MainActor (RebookableGigDTO) -> Void = { _ in },
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.api = api
        self.onOpenTask = onOpenTask
        self.onOpenBids = onOpenBids
        self.onEditTask = onEditTask
        self.onMessageWorker = onMessageWorker
        self.onLeaveReview = onLeaveReview
        self.onPostTask = onPostTask
        self.onRepost = onRepost
        self.onRebook = onRebook
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

    /// All four tabs come from one response; no pagination.
    public func loadMoreIfNeeded() async {}

    // MARK: - Fetching

    private func fetch() async {
        do {
            let response: MyGigsResponse = try await api.request(GigsEndpoints.myGigs())
            gigs = response.gigs
            loadedAtLeastOnce = true
            rebuild()
        } catch {
            if !loadedAtLeastOnce {
                let message = (error as? APIError)?.errorDescription ?? "Couldn't load your tasks."
                state = .error(message: message)
            }
        }
    }

    // MARK: - State projection

    private func rebuild() {
        let nowSnapshot = now()
        let projections = gigs.map { dto -> GigProjection in
            let status = Self.derivedStatus(for: dto, now: nowSnapshot)
            let tab = Self.tabFor(status: status)
            let footer = Self.footerFor(status: status, bidCount: dto.bidCount ?? 0)
            return GigProjection(dto: dto, tab: tab, status: status, footer: footer)
        }
        counts = Self.tabCounts(for: projections, now: nowSnapshot)

        let tabItems = projections.filter { $0.tab == selectedTab }
        let visible = activityFilter.apply(
            to: tabItems,
            now: nowSnapshot,
            statusId: { Self.statusFilterId(for: $0.status) },
            date: { Self.parseDate($0.dto.createdAt) },
            value: { $0.dto.price }
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

    /// Map a derived task status onto one of the four filter chip ids.
    public static func statusFilterId(for status: MyTasksStatus) -> String {
        switch status {
        case .reviewing, .urgent, .noBids: "open"
        case .inProgress, .scheduled: "in_progress"
        case .completed, .awaitReview: "done"
        case .cancelled, .expired: "closed"
        }
    }

    /// Empty state shown when an active filter hides every row in the tab.
    private func filteredEmptyContent() -> ListOfRowsState.EmptyContent {
        ListOfRowsState.EmptyContent(
            icon: .filter,
            headline: "No tasks match your filters",
            subcopy: "Try a different status, date range, or sort — or clear "
                + "your filters to see everything in this tab.",
            ctaTitle: "Clear filters"
        ) { [weak self] in
            Task { @MainActor in self?.applyFilter(ActivityFilter()) }
        }
    }

    private func callbacks(for dto: MyGigDTO) -> RowCallbacks {
        RowCallbacks(
            onTap: { [weak self] in
                guard let self else { return }
                Task { @MainActor in self.onOpenTask(dto) }
            },
            onReviewBids: { [weak self] in
                guard let self else { return }
                Task { @MainActor in self.onOpenBids(dto) }
            },
            onEdit: { [weak self] in
                guard let self else { return }
                Task { @MainActor in self.onEditTask(dto) }
            },
            onBoost: { [weak self] in
                guard let self else { return }
                Task { @MainActor in await self.boost(dto) }
            },
            onMessage: { [weak self] in
                guard let self else { return }
                Task { @MainActor in self.onMessageWorker(dto) }
            },
            onMarkComplete: { [weak self] in
                guard let self else { return }
                Task { @MainActor in await self.markComplete(dto) }
            },
            onLeaveReview: { [weak self] in
                guard let self else { return }
                Task { @MainActor in self.onLeaveReview(dto) }
            },
            onRepost: { [weak self] in
                guard let self else { return }
                Task { @MainActor in self.onRepost(dto) }
            }
        )
    }

    private func emptyContent(for tab: String) -> ListOfRowsState.EmptyContent {
        switch tab {
        case MyTasksTab.open:
            // T6.0b — Magic Task primary CTA. The shell's EmptyState
            // renders the headline + body + single primary button; the
            // ghost "Or post manually" fallback is wired through the
            // FAB which remains visible underneath.
            ListOfRowsState.EmptyContent(
                icon: .clipboardList,
                headline: "No tasks posted yet — try Magic Task",
                subcopy: "Describe what you need in a sentence. Magic Task "
                    + "drafts the title, budget, and schedule — you just "
                    + "confirm and post.",
                ctaTitle: "Try Magic Task"
            ) { [weak self] in
                Task { @MainActor in self?.onPostTask() }
            }
        case MyTasksTab.active:
            ListOfRowsState.EmptyContent(
                icon: .play,
                headline: "No active tasks",
                subcopy: "Tasks you've assigned to a helper will show up here "
                    + "while the work is in progress.",
                ctaTitle: nil,
                onCTA: nil
            )
        case MyTasksTab.done:
            ListOfRowsState.EmptyContent(
                icon: .checkCheck,
                headline: "No completed tasks yet",
                subcopy: "Finished tasks land here so you can leave reviews.",
                ctaTitle: nil,
                onCTA: nil
            )
        case MyTasksTab.closed:
            ListOfRowsState.EmptyContent(
                icon: .ban,
                headline: "Nothing here",
                subcopy: "Cancelled or expired tasks will land here.",
                ctaTitle: nil,
                onCTA: nil
            )
        default:
            ListOfRowsState.EmptyContent(
                icon: .clipboardList,
                headline: "Nothing here",
                subcopy: "",
                ctaTitle: nil,
                onCTA: nil
            )
        }
    }

    // MARK: - Mutations

    /// Optimistically boost the gig. The chip stays the same (Reviewing /
    /// No bids) but the row's `boost_expires_at` is updated locally so
    /// future renders can surface a "Boosted" hint.
    public func boost(_ dto: MyGigDTO) async {
        guard let index = gigs.firstIndex(where: { $0.id == dto.id }) else { return }
        let previous = gigs
        gigs[index] = Self.boostedCopy(of: gigs[index], now: now())
        rebuild()
        do {
            _ = try await api.request(
                GigsEndpoints.boostGig(gigId: dto.id),
                as: BoostGigResponse.self
            )
        } catch {
            gigs = previous
            rebuild()
        }
    }

    /// Optimistically mark the assigned gig as complete (poster
    /// confirmation). The row moves from Active → Done with the "Leave
    /// a review" chip.
    public func markComplete(_ dto: MyGigDTO) async {
        guard let index = gigs.firstIndex(where: { $0.id == dto.id }) else { return }
        let previous = gigs
        gigs[index] = Self.completedCopy(of: gigs[index])
        rebuild()
        do {
            _ = try await api.request(
                GigsEndpoints.completeGigAsPoster(gigId: dto.id),
                as: EmptyResponse.self
            )
        } catch {
            gigs = previous
            rebuild()
        }
    }

    // MARK: - Pure projections (test surface)

    public struct GigProjection: Sendable {
        public let dto: MyGigDTO
        public let tab: String
        public let status: MyTasksStatus
        public let footer: MyTasksFooter
    }

    public struct RowCallbacks: Sendable {
        public let onTap: @Sendable () -> Void
        public let onReviewBids: @Sendable () -> Void
        public let onEdit: @Sendable () -> Void
        public let onBoost: @Sendable () -> Void
        public let onMessage: @Sendable () -> Void
        public let onMarkComplete: @Sendable () -> Void
        public let onLeaveReview: @Sendable () -> Void
        public let onRepost: @Sendable () -> Void

        public init(
            onTap: @escaping @Sendable () -> Void = {},
            onReviewBids: @escaping @Sendable () -> Void = {},
            onEdit: @escaping @Sendable () -> Void = {},
            onBoost: @escaping @Sendable () -> Void = {},
            onMessage: @escaping @Sendable () -> Void = {},
            onMarkComplete: @escaping @Sendable () -> Void = {},
            onLeaveReview: @escaping @Sendable () -> Void = {},
            onRepost: @escaping @Sendable () -> Void = {}
        ) {
            self.onTap = onTap
            self.onReviewBids = onReviewBids
            self.onEdit = onEdit
            self.onBoost = onBoost
            self.onMessage = onMessage
            self.onMarkComplete = onMarkComplete
            self.onLeaveReview = onLeaveReview
            self.onRepost = onRepost
        }
    }

    /// Map a status onto its tab. Pure projection — exposed for tests.
    public static func tabFor(status: MyTasksStatus) -> String {
        switch status {
        case .reviewing, .urgent, .noBids:
            MyTasksTab.open
        case .inProgress, .scheduled:
            MyTasksTab.active
        case .completed, .awaitReview:
            MyTasksTab.done
        case .cancelled, .expired:
            MyTasksTab.closed
        }
    }

    /// Compute the design chip for a posted gig. See header comment for
    /// the full mapping table.
    public static func derivedStatus(for dto: MyGigDTO, now: Date) -> MyTasksStatus {
        let gigStatus = (dto.status ?? "").lowercased()
        switch gigStatus {
        case "cancelled":
            return .cancelled
        case "completed":
            // Until a backend `poster_review_left` flag lands, every
            // completed gig prompts a review.
            return .awaitReview
        case "in_progress":
            return .inProgress
        case "assigned":
            if let scheduled = parseDate(dto.scheduledStart), scheduled > now {
                return .scheduled(weekday: formatWeekday(scheduled))
            }
            return .inProgress
        case "open":
            return openStatus(for: dto, now: now)
        default:
            return .reviewing
        }
    }

    private static func openStatus(for dto: MyGigDTO, now: Date) -> MyTasksStatus {
        if let deadline = parseDate(dto.deadline) {
            if deadline <= now {
                return .expired
            }
            let timeLeft = deadline.timeIntervalSince(now)
            if timeLeft < MyTasksStatus.urgentWindow {
                let hours = max(1, Int(ceil(timeLeft / 3600)))
                return .urgent(hoursLeft: hours)
            }
        }
        let bidCount = dto.bidCount ?? 0
        return bidCount == 0 ? .noBids : .reviewing
    }

    /// Footer archetype for a row.
    public static func footerFor(status: MyTasksStatus, bidCount: Int) -> MyTasksFooter {
        switch status {
        case .reviewing: .open(bidCount: bidCount)
        case .urgent: .urgent(bidCount: bidCount)
        case .noBids: .boost
        case .inProgress: .inProgress
        case .scheduled: .inProgress
        case .awaitReview: .review
        case .completed: .none
        case .cancelled, .expired: .repost
        }
    }

    /// Render a single row. Pure projection — public so tests can assert
    /// the mapping without standing up the VM.
    public static func row(
        projection: GigProjection,
        now: Date,
        callbacks: RowCallbacks
    ) -> RowModel {
        let dto = projection.dto
        let category = OffersCategory.from(rawCategory: dto.category)
        let budget = Self.formatBudget(price: dto.price, payType: dto.payType)
        let title = dto.title.isEmpty ? "Untitled task" : dto.title
        let statusChip = RowChip(
            text: projection.status.label,
            icon: projection.status.icon,
            tint: .status(projection.status.chipVariant)
        )
        let bidderStack = Self.bidderStack(for: dto)
        let isMagic = isMagicTask(dto)
        let archetype = MyTasksArchetype.from(rawArchetype: dto.taskArchetype)

        // Build chip list. Status chip first (always), then optional
        // engagement-mode badge as a neutral-tinted custom chip.
        var chips: [RowChip] = [statusChip]
        if let format = MyTasksFormat.from(rawFormat: dto.taskFormat) {
            chips.append(modeChip(format))
        }

        // Magic Task rows use the new sparkles-disc tile + lavender
        // gradient + uppercase overline. Non-magic rows keep the
        // existing 40pt category gradient icon for back-compat.
        let leading: RowLeading
        let overline: String?
        if isMagic {
            leading = .magicArchetypeTile(archetype.icon, gradient: archetype.gradient)
            overline = archetype.overlineLabel
        } else {
            leading = .categoryGradientIcon(category.icon, gradient: category.gradient)
            overline = nil
        }

        return RowModel(
            id: dto.id,
            title: title,
            subtitle: subtitle(for: dto, now: now, status: projection.status),
            template: .statusChip,
            leading: leading,
            trailing: .priceStack(amount: budget.amount, sublabel: budget.sublabel),
            onTap: callbacks.onTap,
            chips: chips,
            highlight: highlight(for: projection.status),
            footer: footer(for: projection.footer, callbacks: callbacks),
            bidderStack: bidderStack,
            archetypeOverline: overline
        )
    }

    /// Neutral-tinted chip rendering for the engagement-mode badge.
    /// Distinct from the status chip's variant tint so it reads as a
    /// task PROPERTY rather than a state.
    public static func modeChip(_ format: MyTasksFormat) -> RowChip {
        RowChip(
            text: format.label,
            icon: format.icon,
            tint: .custom(
                background: Theme.Color.appSurface,
                foreground: Theme.Color.appTextStrong
            )
        )
    }

    // MARK: - Helpers

    private static func tabCounts(for projections: [GigProjection], now: Date) -> TabCounts {
        var counts = TabCounts()
        let yesterday = now.addingTimeInterval(-24 * 3600)
        for proj in projections {
            switch proj.tab {
            case MyTasksTab.open: counts.open += 1
            case MyTasksTab.active: counts.active += 1
            case MyTasksTab.done: counts.done += 1
            case MyTasksTab.closed: counts.closed += 1
            default: break
            }
            if proj.tab == MyTasksTab.open {
                counts.openTotal += 1
                // Approximate "new bids since yesterday" as the bid_count
                // on tasks updated in the last 24h. The backend doesn't
                // surface a per-day bid delta yet; this gives the banner
                // a usable signal until that lands.
                if let updated = parseDate(proj.dto.updatedAt), updated > yesterday {
                    counts.newBidsToday += proj.dto.bidCount ?? 0
                }
                if let deadline = parseDate(proj.dto.deadline) {
                    let timeLeft = deadline.timeIntervalSince(now)
                    if timeLeft > 0, timeLeft < 24 * 3600 { counts.closingSoon += 1 }
                }
            }
        }
        return counts
    }

    public static func bidderStack(for dto: MyGigDTO) -> BidderStackData? {
        let topBidders = dto.topBidders ?? []
        let bidCount = dto.bidCount ?? 0
        if topBidders.isEmpty { return nil }
        let bidders = topBidders.map { tb in
            Bidder(id: tb.id, initials: tb.initials, tone: Self.tone(for: tb.color))
        }
        let overflow = max(0, bidCount - bidders.count)
        return BidderStackData(bidders: bidders, overflow: overflow)
    }

    /// Map the backend's tone string ("sky", "teal", …) to the shared
    /// `BidderTone` enum. Unknown values fall through to `.slate` so a
    /// future palette change on one side doesn't break decoding.
    public static func tone(for raw: String) -> BidderTone {
        switch raw.lowercased() {
        case "sky": .sky
        case "teal": .teal
        case "amber": .amber
        case "rose": .rose
        case "violet": .violet
        default: .slate
        }
    }

    public static func subtitle(
        for dto: MyGigDTO,
        now: Date,
        status: MyTasksStatus
    ) -> String {
        // Active rows surface the worker context instead of bid info.
        if case .inProgress = status, let workerId = dto.acceptedBy, !workerId.isEmpty {
            if let posted = formatRelativeTime(dto.createdAt, now: now) {
                return "Helper assigned · \(posted)"
            }
            return "Helper assigned"
        }
        var parts: [String] = []
        if let posted = formatRelativeTime(dto.createdAt, now: now) {
            parts.append("Posted \(posted)")
        }
        let bidCount = dto.bidCount ?? 0
        if bidCount > 0 {
            parts.append("\(bidCount) \(bidCount == 1 ? "bid" : "bids")")
            if let range = formatBidRange(top: dto.topBidAmount, ask: dto.price) {
                parts.append(range)
            }
        }
        return parts.joined(separator: " · ")
    }

    public static func formatBidRange(top: Double?, ask: Double?) -> String? {
        guard let top, top > 0 else { return nil }
        if let ask, ask > 0, abs(top - ask) > 0.01 {
            let lo = min(top, ask)
            let hi = max(top, ask)
            return "$\(formatAmount(lo)) – $\(formatAmount(hi))"
        }
        return "$\(formatAmount(top))"
    }

    public struct BudgetText: Sendable, Hashable {
        public let amount: String
        public let sublabel: String?
    }

    public static func formatBudget(price: Double?, payType: String?) -> BudgetText {
        guard let price, price > 0 else { return BudgetText(amount: "—", sublabel: nil) }
        let isHourly = (payType ?? "").lowercased() == "hourly"
        let amount = isHourly ? "$\(formatAmount(price))/hr" : "$\(formatAmount(price))"
        return BudgetText(amount: amount, sublabel: nil)
    }

    public static func formatAmount(_ value: Double) -> String {
        let rounded = Int(value.rounded())
        return "\(rounded)"
    }

    public static func highlight(for status: MyTasksStatus) -> RowHighlight? {
        switch status {
        case .cancelled, .expired: .muted
        default: nil
        }
    }

    private static func footer(
        for variant: MyTasksFooter,
        callbacks: RowCallbacks
    ) -> RowFooter? {
        switch variant {
        case .none:
            nil
        case let .open(bidCount):
            RowFooter(actions: [
                RowFooterAction(
                    title: "Edit",
                    icon: .pencil,
                    variant: .ghost,
                    handler: callbacks.onEdit
                ),
                RowFooterAction(
                    title: bidCount > 0 ? "Review \(bidCount) bids" : "Review bids",
                    icon: .inbox,
                    variant: .primary,
                    flex: 2,
                    handler: callbacks.onReviewBids
                )
            ])
        case let .urgent(bidCount):
            RowFooter(actions: [
                RowFooterAction(
                    title: "Extend 24h",
                    icon: .clockPlus,
                    variant: .ghost,
                    handler: callbacks.onEdit
                ),
                RowFooterAction(
                    title: bidCount > 0 ? "Review \(bidCount) bids" : "Review bids",
                    icon: .inbox,
                    variant: .primary,
                    flex: 2,
                    handler: callbacks.onReviewBids
                )
            ])
        case .boost:
            RowFooter(actions: [
                RowFooterAction(
                    title: "Edit details",
                    icon: .pencil,
                    variant: .ghost,
                    handler: callbacks.onEdit
                ),
                RowFooterAction(
                    title: "Boost in feed",
                    icon: .rocket,
                    variant: .primary,
                    handler: callbacks.onBoost
                )
            ])
        case .inProgress:
            RowFooter(actions: [
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
        case .review:
            RowFooter(actions: [
                RowFooterAction(
                    title: "Leave a review",
                    icon: .star,
                    variant: .primary,
                    handler: callbacks.onLeaveReview
                )
            ])
        case .repost:
            RowFooter(actions: [
                RowFooterAction(
                    title: "Repost task",
                    icon: .arrowsRepeat,
                    variant: .primary,
                    handler: callbacks.onRepost
                )
            ])
        }
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

    public static func formatWeekday(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "EEE"
        return formatter.string(from: date)
    }

    public static func formatRelativeTime(_ raw: String?, now: Date) -> String? {
        guard let date = parseDate(raw) else { return nil }
        let seconds = now.timeIntervalSince(date)
        if seconds < 60 { return "just now" }
        if seconds < 3600 { return "\(Int(seconds / 60))m ago" }
        if seconds < 86400 { return "\(Int(seconds / 3600))h ago" }
        let days = Int(seconds / 86400)
        if days == 1 { return "1d ago" }
        if days < 7 { return "\(days)d ago" }
        let weeks = days / 7
        if weeks < 4 { return "\(weeks)w ago" }
        let months = days / 30
        return "\(months)mo ago"
    }

    /// Build an optimistic copy of a gig that was just boosted.
    public static func boostedCopy(of dto: MyGigDTO, now: Date) -> MyGigDTO {
        let expires = now.addingTimeInterval(24 * 3600)
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return MyGigDTO(
            id: dto.id,
            title: dto.title,
            description: dto.description,
            price: dto.price,
            category: dto.category,
            status: dto.status,
            createdAt: dto.createdAt,
            updatedAt: formatter.string(from: now),
            deadline: dto.deadline,
            isUrgent: dto.isUrgent,
            userId: dto.userId,
            acceptedBy: dto.acceptedBy,
            acceptedAt: dto.acceptedAt,
            scheduledStart: dto.scheduledStart,
            payType: dto.payType,
            bidCount: dto.bidCount,
            topBidAmount: dto.topBidAmount,
            topBidders: dto.topBidders,
            boostedAt: formatter.string(from: now),
            boostExpiresAt: formatter.string(from: expires),
            sourceFlow: dto.sourceFlow,
            taskArchetype: dto.taskArchetype,
            taskFormat: dto.taskFormat
        )
    }

    /// Build an optimistic copy of a gig whose status is flipped to
    /// completed (used by `markComplete`).
    public static func completedCopy(of dto: MyGigDTO) -> MyGigDTO {
        MyGigDTO(
            id: dto.id,
            title: dto.title,
            description: dto.description,
            price: dto.price,
            category: dto.category,
            status: "completed",
            createdAt: dto.createdAt,
            updatedAt: ISO8601DateFormatter().string(from: Date()),
            deadline: dto.deadline,
            isUrgent: dto.isUrgent,
            userId: dto.userId,
            acceptedBy: dto.acceptedBy,
            acceptedAt: dto.acceptedAt,
            scheduledStart: dto.scheduledStart,
            payType: dto.payType,
            bidCount: dto.bidCount,
            topBidAmount: dto.topBidAmount,
            topBidders: dto.topBidders,
            boostedAt: dto.boostedAt,
            boostExpiresAt: dto.boostExpiresAt,
            sourceFlow: dto.sourceFlow,
            taskArchetype: dto.taskArchetype,
            taskFormat: dto.taskFormat
        )
    }
}

// swiftlint:enable file_length function_body_length type_body_length
