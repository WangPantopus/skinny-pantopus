//
//  MyPostsViewModel.swift
//  Pantopus
//
//  T5.3.3 — My posts. Drives the screen against the shared
//  `ListOfRowsView` archetype.
//
//  Design contract (myposts-frames.jsx):
//    - Top bar: back chevron + "My posts" + trailing filter icon
//    - Two equal-width tabs:
//        Active (N)   — `archived_at IS NULL` (the wire-state of every
//                        post the `/user/:id` endpoint returns today)
//        Archived (N) — post.archivedAt != nil. Populated client-side
//                        from optimistic archive mutations; the backend
//                        `/user/:id` endpoint filters archived rows out,
//                        so the tab is empty on a cold load. Wired to a
//                        future `GET /api/posts/me?status=archived` route
//                        without code change.
//    - 52pt secondary-create FAB ("pen-line") opens the compose-post flow
//    - Each row uses Shape C6 (additive shell fields on T5.0):
//        leading:      none
//        headerChips:  [intent chip]              ← above body
//        timeMeta:     "2h · Elm Park"
//        title:        "" (empty — body IS the headline content)
//        body:         post.content (2-line clamp, primary emphasis)
//        engagement:   [replies / likes-or-equivalent] + Edit / Restore CTA
//        trailing:     .kebab → action sheet (Archive/Restore + Delete)
//        highlight:    .archived on the Archived tab
//    - Active row tap → push pulse post detail
//    - Empty states per tab.
//
//  Backend:
//    - GET    /api/posts/user/:userId            (posts.js:3016, active set)
//    - DELETE /api/posts/:id                     (posts.js:2483)
//    - POST   /api/posts/:id/archive             author-only archive
//    - POST   /api/posts/:id/unarchive           author-only restore
//

import Foundation
import Observation
import SwiftUI

// swiftlint:disable file_length type_body_length

// MARK: - Tab identifiers

public enum MyPostsTab {
    public static let active = "active"
    public static let archived = "archived"
}

// MARK: - Intent palette

/// Re-export of the design's intent set. Mirrors `PulseIntent` 1:1 so
/// the chip colours stay in sync with the Pulse feed; `PulseIntent.all`
/// is the filter-only sentinel and is not a real post intent. Each
/// concrete post resolves to one of `ask, recommend, event, lost,
/// announce` via [`PulseIntent.from(postType:)`].
public typealias MyPostsIntent = PulseIntent

// MARK: - Footer action

/// Which trailing engagement CTA to render. Active rows offer "Edit"
/// (opens the compose flow with the post pre-filled); Archived rows
/// offer "Restore" (unarchive optimistic).
public enum MyPostsEngagementCTA: Sendable {
    case edit
    case restore
}

// MARK: - Kebab sheet target

/// Lightweight presentation contract for the per-row kebab action sheet.
/// The view binds to this directly via `.confirmationDialog(item:)`.
public struct MyPostsKebabTarget: Identifiable, Sendable, Equatable {
    public let id: String
    public let postId: String
    public let isArchived: Bool

    public init(id: String, postId: String, isArchived: Bool) {
        self.id = id
        self.postId = postId
        self.isArchived = isArchived
    }
}

// MARK: - Delete confirmation target

public struct MyPostsDeleteTarget: Identifiable, Sendable, Equatable {
    public let id: String
    public let postId: String

    public init(id: String, postId: String) {
        self.id = id
        self.postId = postId
    }
}

// MARK: - View model

@Observable
@MainActor
public final class MyPostsViewModel: ListOfRowsDataSource {
    // MARK: - Public chrome

    public let title = "My posts"

    public var tabs: [ListOfRowsTab] {
        [
            ListOfRowsTab(id: MyPostsTab.active, label: "Active", count: counts.active),
            ListOfRowsTab(id: MyPostsTab.archived, label: "Archived", count: counts.archived)
        ]
    }

    public var selectedTab: String = MyPostsTab.active {
        didSet {
            guard oldValue != selectedTab else { return }
            rebuild()
        }
    }

    public var fab: FABAction? {
        FABAction(
            icon: .pencil,
            accessibilityLabel: "Write a post",
            variant: .secondaryCreate
        ) { [weak self] in
            guard let self else { return }
            Task { @MainActor in self.onCompose() }
        }
    }

    public var topBarAction: TopBarAction? {
        TopBarAction(
            icon: .filter,
            accessibilityLabel: "Filter posts"
        ) { [weak self] in
            guard let self else { return }
            Task { @MainActor in self.isFilterPresented = true }
        }
    }

    // MARK: - Activity filter (P5.4)

    /// Bound to the view's `.sheet(isPresented:)` so the shared
    /// `ActivityFilterSheet` presents over the list.
    public var isFilterPresented = false

    /// The applied type / sort / date-range selection. Default is the
    /// "no filter" position.
    public private(set) var activityFilter = ActivityFilter()

    /// Section header for the status chips. Posts filter by intent, so
    /// the chips read as a post "Type".
    public let statusFilterTitle = "Type"

    /// Per-surface status chips — the post intents (ask / recommend /
    /// event / lost & found / announce).
    public var statusFilterOptions: [FilterOption] {
        [PulseIntent.ask, .recommend, .event, .lost, .announce].map {
            FilterOption(id: Self.intentFilterId($0), label: Self.intentLabel($0))
        }
    }

    /// Posts have no per-row value — only date ordering applies.
    public let sortFilterOptions = ActivitySortOrder.timeOnly

    /// Store the applied filter and re-project the visible rows.
    public func applyFilter(_ filter: ActivityFilter) {
        activityFilter = filter
        rebuild()
    }

    public private(set) var state: ListOfRowsState = .loading

    /// Bound to the view's `.confirmationDialog(item:)` so the row's
    /// kebab pops Archive/Restore + Delete options without owning the
    /// state machine.
    public var kebabTarget: MyPostsKebabTarget?

    /// Bound to a second `.alert(item:)` for the destructive delete
    /// confirmation. Kept separate from the kebab sheet so the user
    /// sees an explicit two-step confirmation for irreversible deletes.
    public var deleteTarget: MyPostsDeleteTarget?

    // MARK: - Dependencies

    private let api: APIClient
    private let currentUserId: @MainActor () -> String?
    private let onOpenPost: @MainActor (MyPostDTO) -> Void
    private let onCompose: @MainActor () -> Void
    private let onEditPost: @MainActor (MyPostDTO) -> Void
    private let now: @Sendable () -> Date

    // MARK: - Local data

    private var posts: [MyPostDTO] = []
    /// Per-post optimistic override that wins over the wire `archivedAt`.
    /// Survives across `rebuild` calls but is wiped on `refresh()` (the
    /// backend doesn't surface archived state today). When the future
    /// `POST /api/posts/:id/archive` route lands, this map becomes the
    /// optimistic-cache for in-flight mutations and the wire DTO carries
    /// the canonical value.
    private enum ArchiveOverride {
        case archived
        case unarchived
    }

    private var localArchiveOverrides: [String: ArchiveOverride] = [:]
    private var loadedAtLeastOnce = false
    private var counts = TabCounts()

    private struct TabCounts {
        var active = 0
        var archived = 0
    }

    init(
        api: APIClient = .shared,
        currentUserId: @escaping @MainActor () -> String? = { MyPostsViewModel.defaultCurrentUserId() },
        onOpenPost: @escaping @MainActor (MyPostDTO) -> Void = { _ in },
        onCompose: @escaping @MainActor () -> Void = {},
        onEditPost: @escaping @MainActor (MyPostDTO) -> Void = { _ in },
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.api = api
        self.currentUserId = currentUserId
        self.onOpenPost = onOpenPost
        self.onCompose = onCompose
        self.onEditPost = onEditPost
        self.now = now
    }

    /// Read the signed-in user's id from `AuthManager` for the default
    /// initialiser. Tests inject a fixed id via the explicit override.
    @MainActor
    private static func defaultCurrentUserId() -> String? {
        if case let .signedIn(user) = AuthManager.shared.state {
            return user.id
        }
        return nil
    }

    // MARK: - ListOfRowsDataSource

    public func load() async {
        if !loadedAtLeastOnce { state = .loading }
        await fetch()
    }

    public func refresh() async {
        // Refresh re-queries the wire, which today returns only active
        // posts. Drop the local archive overrides so the user doesn't
        // see stale optimistic state if they've been gone for a while.
        localArchiveOverrides.removeAll()
        await fetch()
    }

    /// All posts come from a single (paginated) endpoint; the screen
    /// currently fetches the first page only. Cursor pagination is a
    /// follow-up.
    public func loadMoreIfNeeded() async {}

    // MARK: - Fetching

    private func fetch() async {
        guard let userId = currentUserId() else {
            // No signed-in user — render the empty-active state. Defensive;
            // this VM is only reachable from the You/Me tab which requires
            // authentication.
            posts = []
            loadedAtLeastOnce = true
            rebuild()
            return
        }
        do {
            let response: MyPostsResponse = try await api.request(
                PostsEndpoints.userPosts(userId: userId)
            )
            posts = response.posts
            loadedAtLeastOnce = true
            rebuild()
        } catch {
            if !loadedAtLeastOnce {
                let message = (error as? APIError)?.errorDescription ?? "Couldn't load your posts."
                state = .error(message: message)
            }
        }
    }

    // MARK: - State projection

    /// Recompute the tab counts + visible section list from the cached
    /// `posts` array, applying any `localArchiveOverrides`.
    private func rebuild() {
        let nowSnapshot = now()
        let projections = posts.map { dto -> PostProjection in
            let archived = isArchived(dto)
            let tab = archived ? MyPostsTab.archived : MyPostsTab.active
            return PostProjection(dto: dto, tab: tab, isArchived: archived)
        }

        let publicCounts = Self.tabCounts(for: projections)
        counts = TabCounts(active: publicCounts.active, archived: publicCounts.archived)

        let tabItems = projections.filter { $0.tab == selectedTab }
        let visible = activityFilter.apply(
            to: tabItems,
            now: nowSnapshot,
            statusId: { Self.intentFilterId(PulseIntent.from(postType: $0.dto.postType)) },
            date: { Self.parseDate($0.dto.createdAt) },
            value: { _ in nil }
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

    /// Map a post intent onto its filter chip id. `.all` is the Pulse
    /// "all" sentinel and never appears as a real post intent.
    public static func intentFilterId(_ intent: PulseIntent) -> String {
        switch intent {
        case .all: "all"
        case .ask: "ask"
        case .recommend: "recommend"
        case .event: "event"
        case .lost: "lost"
        case .alert: "alert"
        case .deal: "deal"
        case .announce: "announce"
        case .neighborhoodWin: "neighborhoodWin"
        case .visitorGuide: "visitorGuide"
        }
    }

    /// Empty state shown when an active filter hides every row in the tab.
    private func filteredEmptyContent() -> ListOfRowsState.EmptyContent {
        ListOfRowsState.EmptyContent(
            icon: .filter,
            headline: "No posts match your filters",
            subcopy: "Try a different type, date range, or sort — or clear "
                + "your filters to see everything in this tab.",
            ctaTitle: "Clear filters"
        ) { [weak self] in
            Task { @MainActor in self?.applyFilter(ActivityFilter()) }
        }
    }

    /// Per-row callbacks bundle. Same pattern as MyBids — keeps the
    /// row projection under the SwiftLint parameter ceiling.
    private func callbacks(for dto: MyPostDTO) -> RowCallbacks {
        RowCallbacks(
            onTap: { [weak self] in
                guard let self else { return }
                Task { @MainActor in self.onOpenPost(dto) }
            },
            onKebab: { [weak self] in
                guard let self else { return }
                Task { @MainActor in self.requestKebab(dto) }
            },
            onEdit: { [weak self] in
                guard let self else { return }
                Task { @MainActor in self.onEditPost(dto) }
            },
            onRestore: { [weak self] in
                guard let self else { return }
                Task { @MainActor in await self.unarchive(dto) }
            }
        )
    }

    private func emptyContent(for tab: String) -> ListOfRowsState.EmptyContent {
        switch tab {
        case MyPostsTab.active:
            ListOfRowsState.EmptyContent(
                icon: .messageSquarePlus,
                headline: "You haven\u{2019}t posted yet",
                subcopy: "Ask a question, recommend a spot, or share a local heads-up. "
                    + "Your neighbors will see it on the Pulse.",
                ctaTitle: "Write a post"
            ) { [weak self] in
                Task { @MainActor in self?.onCompose() }
            }
        case MyPostsTab.archived:
            ListOfRowsState.EmptyContent(
                icon: .archive,
                headline: "Nothing archived",
                subcopy: "Archived posts move out of the Pulse but stay on your profile. "
                    + "Use the kebab on any active post to archive it.",
                ctaTitle: nil,
                onCTA: nil
            )
        default:
            ListOfRowsState.EmptyContent(
                icon: .messageSquarePlus,
                headline: "Nothing here",
                subcopy: "",
                ctaTitle: nil,
                onCTA: nil
            )
        }
    }

    // MARK: - Mutations

    /// Open the per-row action sheet. The sheet shows Archive/Restore
    /// (depending on current state) + Delete.
    public func requestKebab(_ dto: MyPostDTO) {
        kebabTarget = MyPostsKebabTarget(
            id: dto.id,
            postId: dto.id,
            isArchived: isArchived(dto)
        )
    }

    /// Dismiss the kebab sheet without doing anything.
    public func cancelKebab() {
        kebabTarget = nil
    }

    /// Open the destructive-delete confirmation alert.
    public func requestDelete(_ dto: MyPostDTO) {
        kebabTarget = nil
        deleteTarget = MyPostsDeleteTarget(id: dto.id, postId: dto.id)
    }

    public func cancelDelete() {
        deleteTarget = nil
    }

    /// Optimistically archive the post, then persist via the backend.
    public func archive(_ dto: MyPostDTO) async {
        kebabTarget = nil
        let previousOverrides = localArchiveOverrides
        localArchiveOverrides[dto.id] = .archived
        rebuild()
        do {
            _ = try await api.request(
                PostsEndpoints.archive(id: dto.id),
                as: PostArchiveResponse.self
            )
        } catch {
            localArchiveOverrides = previousOverrides
            rebuild()
        }
    }

    /// Optimistically unarchive (Restore), then persist via the backend.
    public func unarchive(_ dto: MyPostDTO) async {
        kebabTarget = nil
        let previousOverrides = localArchiveOverrides
        localArchiveOverrides[dto.id] = .unarchived
        rebuild()
        do {
            _ = try await api.request(
                PostsEndpoints.unarchive(id: dto.id),
                as: PostArchiveResponse.self
            )
        } catch {
            localArchiveOverrides = previousOverrides
            rebuild()
        }
    }

    /// Optimistically delete the post. Hits the real DELETE endpoint;
    /// rolls back if it fails.
    public func confirmDelete() async {
        guard let target = deleteTarget else { return }
        deleteTarget = nil
        let previousPosts = posts
        let previousOverrides = localArchiveOverrides
        posts.removeAll { $0.id == target.postId }
        localArchiveOverrides.removeValue(forKey: target.postId)
        rebuild()
        do {
            let _: EmptyResponse = try await api.request(PostsEndpoints.deletePost(id: target.postId))
        } catch {
            posts = previousPosts
            localArchiveOverrides = previousOverrides
            rebuild()
        }
    }

    // MARK: - Pure projections (test surface)

    public struct PostProjection: Sendable {
        public let dto: MyPostDTO
        public let tab: String
        public let isArchived: Bool
    }

    public struct RowCallbacks: Sendable {
        public let onTap: @Sendable () -> Void
        public let onKebab: @Sendable () -> Void
        public let onEdit: @Sendable () -> Void
        public let onRestore: @Sendable () -> Void

        public init(
            onTap: @escaping @Sendable () -> Void = {},
            onKebab: @escaping @Sendable () -> Void = {},
            onEdit: @escaping @Sendable () -> Void = {},
            onRestore: @escaping @Sendable () -> Void = {}
        ) {
            self.onTap = onTap
            self.onKebab = onKebab
            self.onEdit = onEdit
            self.onRestore = onRestore
        }
    }

    /// Compute the visible-archive verdict by merging the wire `archivedAt`
    /// with any local optimistic override. Exposed so tests can assert the
    /// merge rule without going through the full VM.
    public func isArchived(_ dto: MyPostDTO) -> Bool {
        switch localArchiveOverrides[dto.id] {
        case .archived: true
        case .unarchived: false
        case .none: dto.archivedAt != nil
        }
    }

    public static func tabCounts(for projections: [PostProjection]) -> TabCountsPublic {
        var active = 0
        var archived = 0
        for proj in projections {
            if proj.isArchived { archived += 1 } else { active += 1 }
        }
        return TabCountsPublic(active: active, archived: archived)
    }

    /// Public mirror of the internal `TabCounts` so tests can assert
    /// counts without accessing private state.
    public struct TabCountsPublic: Sendable, Equatable {
        public let active: Int
        public let archived: Int
    }

    /// Render a single row. Pure projection — public for tests.
    public static func row(
        projection: PostProjection,
        now: Date,
        callbacks: RowCallbacks
    ) -> RowModel {
        let dto = projection.dto
        let intent = PulseIntent.from(postType: dto.postType)
        let body = postBody(for: dto)
        let chips = [intentChip(for: intent, isArchived: projection.isArchived)]
            + (projection.isArchived ? [archivedChip()] : [])
        let cta: RowEngagementCTA = projection.isArchived
            ? RowEngagementCTA(
                label: "Restore",
                icon: .arrowsRepeat,
                accessibilityLabel: "Restore post"
            ) { callbacks.onRestore() }
            : RowEngagementCTA(
                label: "Edit",
                icon: .pencil,
                accessibilityLabel: "Edit post"
            ) { callbacks.onEdit() }

        return RowModel(
            id: dto.id,
            title: "",
            template: .statusChip,
            leading: .none,
            trailing: .kebab,
            onTap: callbacks.onTap,
            onSecondary: callbacks.onKebab,
            body: body,
            bodyEmphasis: .primary,
            headerChips: chips,
            timeMeta: timeMetaLabel(for: dto, now: now),
            highlight: projection.isArchived ? .archived : nil,
            engagement: RowEngagement(
                items: engagementItems(for: dto, intent: intent),
                cta: cta
            )
        )
    }

    // MARK: - Row helpers

    /// Resolve the body text for a row. Falls back to the title when
    /// the post has no body (e.g. event with only a title field).
    private static func postBody(for dto: MyPostDTO) -> String {
        if !dto.content.isEmpty { return dto.content }
        if let title = dto.title, !title.isEmpty { return title }
        return ""
    }

    /// Map an intent to its design palette using the shared
    /// `PulseIntentChip` token bundle.
    public static func intentChip(for intent: PulseIntent, isArchived: Bool) -> RowChip {
        let palette = paletteFor(intent: intent)
        return RowChip(
            text: intentLabel(intent),
            icon: intent.icon,
            tint: .custom(
                background: isArchived ? Theme.Color.appSurfaceSunken : palette.background,
                foreground: isArchived ? Theme.Color.appTextSecondary : palette.foreground
            )
        )
    }

    private static func archivedChip() -> RowChip {
        RowChip(
            text: "ARCHIVED",
            icon: .archive,
            tint: .custom(
                background: Theme.Color.appSurfaceSunken,
                foreground: Theme.Color.appTextSecondary
            )
        )
    }

    /// Intent → display label per design (`Lost & Found` not `Lost`).
    public static func intentLabel(_ intent: PulseIntent) -> String {
        switch intent {
        case .all: "All"
        case .ask: "Ask"
        case .recommend: "Recommend"
        case .event: "Event"
        case .lost: "Lost & Found"
        case .alert: "Alerts"
        case .deal: "Deals"
        case .announce: "Announce"
        case .neighborhoodWin: "Wins"
        case .visitorGuide: "Guide"
        }
    }

    private struct IntentPalette {
        let foreground: Color
        let background: Color
    }

    /// Centralised intent → foreground/background colour mapping. Mirrors
    /// `PulseIntentChip` exactly so the My posts chip matches the Pulse
    /// feed pixel-for-pixel.
    private static func paletteFor(intent: PulseIntent) -> IntentPalette {
        switch intent {
        case .all:
            IntentPalette(foreground: Theme.Color.appTextSecondary, background: Theme.Color.appSurfaceSunken)
        case .ask:
            IntentPalette(foreground: Theme.Color.warning, background: Theme.Color.warningBg)
        case .recommend:
            IntentPalette(foreground: Theme.Color.success, background: Theme.Color.successBg)
        case .event:
            IntentPalette(foreground: Theme.Color.business, background: Theme.Color.businessBg)
        case .lost:
            IntentPalette(foreground: Theme.Color.error, background: Theme.Color.errorBg)
        case .alert:
            IntentPalette(foreground: Theme.Color.error, background: Theme.Color.errorBg)
        case .deal:
            IntentPalette(foreground: Theme.Color.success, background: Theme.Color.successBg)
        case .announce:
            IntentPalette(foreground: Theme.Color.appTextStrong, background: Theme.Color.appSurfaceSunken)
        case .neighborhoodWin:
            IntentPalette(foreground: Theme.Color.warning, background: Theme.Color.warningBg)
        case .visitorGuide:
            IntentPalette(foreground: Theme.Color.info, background: Theme.Color.infoBg)
        }
    }

    /// Engagement strip items per intent. Maps the available backend
    /// counters (`comment_count`, `like_count`) to the closest design
    /// label for each intent so the strip reads naturally:
    ///   ask / announce / lost: "X replies" + "X likes"
    ///   event:                  "X going" (likes) + "X comments"
    ///   recommend:              "X helpful" (likes) + "X replies"
    public static func engagementItems(
        for dto: MyPostDTO,
        intent: PulseIntent
    ) -> [RowEngagementItem] {
        let replies = RowEngagementItem(
            id: "replies",
            icon: .messageCircle,
            label: "\(dto.commentCount) \(dto.commentCount == 1 ? "reply" : "replies")"
        )
        let likes = RowEngagementItem(
            id: "likes",
            icon: .thumbsUp,
            label: "\(dto.likeCount) \(dto.likeCount == 1 ? "like" : "likes")"
        )
        switch intent {
        case .event:
            return [
                RowEngagementItem(
                    id: "going",
                    icon: .checkCircle,
                    label: "\(dto.likeCount) going"
                ),
                replies
            ]
        case .recommend:
            return [
                RowEngagementItem(
                    id: "helpful",
                    icon: .thumbsUp,
                    label: "\(dto.likeCount) helpful"
                ),
                replies
            ]
        case .lost:
            return [
                replies,
                RowEngagementItem(
                    id: "seen",
                    icon: .eye,
                    label: "\(dto.likeCount) seen"
                )
            ]
        case .ask, .announce, .all, .alert, .deal, .neighborhoodWin, .visitorGuide:
            return [replies, likes]
        }
    }

    /// "2h · Elm Park" / "Yesterday · Burnside" — meta line in the row
    /// header above the body.
    public static func timeMetaLabel(for dto: MyPostDTO, now: Date) -> String {
        var parts: [String] = []
        if let time = relativeTime(dto.createdAt, now: now) {
            parts.append(time)
        }
        if let location = dto.locationName, !location.isEmpty {
            parts.append(location)
        }
        return parts.joined(separator: " · ")
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

    private static func parseDate(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        return iso8601.date(from: raw) ?? iso8601NoFraction.date(from: raw)
    }

    /// Relative time formatter mirroring MyBids' so iOS feels coherent
    /// across the You-tab list screens.
    public static func relativeTime(
        _ raw: String?,
        now: Date,
        calendar: Calendar = .current
    ) -> String? {
        guard let date = parseDate(raw) else { return nil }
        let seconds = now.timeIntervalSince(date)
        switch seconds {
        case ..<60: return "now"
        case ..<3600: return "\(Int(seconds / 60))m"
        case ..<86400: return "\(Int(seconds / 3600))h"
        default:
            let dayDiff = calendar.dateComponents([.day], from: date, to: now).day ?? 0
            if dayDiff == 1 { return "Yesterday" }
            if dayDiff < 7 {
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
}

// swiftlint:enable file_length type_body_length
