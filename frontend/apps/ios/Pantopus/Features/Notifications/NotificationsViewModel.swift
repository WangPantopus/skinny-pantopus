//
//  NotificationsViewModel.swift
//  Pantopus
//
//  T5.1 — Notifications V2. Drives the Notifications center against the
//  shared `ListOfRows` archetype with the new design contract:
//
//    - Two equal-width tabs: "All" + "Unread (N)".
//    - List body grouped by date with overline section headers
//      ("TODAY" / "EARLIER").
//    - Each row is a Shape D notification card — colored 40pt type-icon
//      tile + bold title + 2-line body + chip-with-relative-time meta
//      + unread highlight (`primary25` background + `personalBg` border
//      + 8pt blue dot near the top-right).
//    - Top-bar trailing "Mark all read" text-button, disabled when
//      `unreadCount == 0`.
//    - Empty Unread tab: success-tinted check-check + "View all
//      notifications" CTA that re-keys the tab to All (per §1.9).
//    - Empty All tab: bell icon + "All caught up".
//
//  S5 (RN parity) adds:
//    - a third "Read" filter tab (client-side — the backend only
//      understands `?unread=true`),
//    - long-press / swipe delete backed by `DELETE /api/notifications/:id`
//      behind a confirmation,
//    - the Personal / Audience (Beacon) firewall zone split, entered
//      either from the Hub megaphone (`?context=audience`) or from the
//      in-screen zone strip.
//
//  Backend:
//    - `GET /api/notifications?limit=&offset=&unread=true&context=`
//      (`backend/routes/notifications.js:85`)
//    - `PATCH /api/notifications/:id/read`
//      (`backend/routes/notifications.js:381`)
//    - `POST /api/notifications/read-all` with `{contexts: […]}`
//      (`backend/routes/notifications.js:412`)
//    - `DELETE /api/notifications/:id`
//      (`backend/routes/notifications.js:452`)
//

// swiftlint:disable multiple_closures_with_trailing_closure

import Foundation
import Observation
import SwiftUI

// swiftlint:disable file_length type_body_length

/// Stable tab ids — public so the screen + tests can address them
/// without sprinkling string literals.
public enum NotificationsTab {
    public static let all = "all"
    public static let unread = "unread"
    /// P2.3 parity with RN (`src/app/notifications.tsx:56`) — read rows
    /// are filtered client-side; the backend only understands
    /// `?unread=true`.
    public static let read = "read"
}

/// Identity-firewall context values the backend validates against
/// (`backend/routes/notifications.js:21-22`).
public enum NotificationContext: String, Sendable, CaseIterable {
    case personal
    case audience
    case platform
}

/// Notification zone (P2.3 / unified-IA §6.1). The Personal zone folds
/// `platform` announcements in with `personal`; the Audience (Beacon)
/// zone is isolated so persona traffic never leaks into the personal
/// stream. Mirrors RN `src/app/notifications.tsx:84-91`.
public enum NotificationsZone: String, Sendable, CaseIterable, Hashable {
    case personal
    case audience

    /// Firewall contexts this zone pulls from `GET /api/notifications`.
    public var contexts: [String] {
        switch self {
        case .personal: [NotificationContext.personal.rawValue, NotificationContext.platform.rawValue]
        case .audience: [NotificationContext.audience.rawValue]
        }
    }

    public var label: String {
        switch self {
        case .personal: "Personal"
        case .audience: "Audience"
        }
    }

    /// Does a notification belong to this zone? Unset context defaults to
    /// `personal`, matching RN.
    public func matches(context: String?) -> Bool {
        let resolved = (context?.isEmpty == false ? context : nil) ?? NotificationContext.personal.rawValue
        return contexts.contains(resolved)
    }
}

/// Pending "delete this notification?" confirmation. The screen binds a
/// `confirmationDialog` to this; the VM never destroys anything until
/// `confirmDelete()` runs.
public struct NotificationDeleteRequest: Sendable, Identifiable, Hashable {
    public let id: String
    public let title: String

    public init(id: String, title: String) {
        self.id = id
        self.title = title
    }
}

/// Seven type buckets the Notifications design surfaces. Each one drives
/// the row's tile icon + chip variant + chip label.
public enum NotificationCategory: Sendable, Hashable {
    case reply
    case mention
    case claim
    case gig
    case listing
    case safety
    case system

    private static let rawTypeMap: [String: NotificationCategory] = [
        "reply": .reply,
        "comment": .reply,
        "chat": .reply,
        "chat_message": .reply,
        "dm": .reply,
        "mention": .mention,
        "follow": .mention,
        "connection": .mention,
        "connections": .mention,
        "user": .mention,
        "claim": .claim,
        "home_member_request": .claim,
        "home_claim": .claim,
        "home_ownership": .claim,
        "gig": .gig,
        "gig_bid": .gig,
        "gig_match": .gig,
        "listing": .listing,
        "listing_sale": .listing,
        "marketplace": .listing,
        "safety": .safety,
        "alert": .safety,
        "security": .safety,
        "porch_alert": .safety,
        "system": .system,
        "info": .system,
        "support_train": .system,
        "support-train": .system,
        "announcement": .system
    ]

    /// Loose mapping from the backend's `type` strings into the seven
    /// design buckets. Unknown types fall back to `.system`.
    public static func from(rawType: String?) -> NotificationCategory {
        guard let raw = rawType?.lowercased(), !raw.isEmpty else { return .system }
        return rawTypeMap[raw] ?? heuristicCategory(for: raw)
    }

    private static func heuristicCategory(for raw: String) -> NotificationCategory {
        // Heuristic fallbacks for the noisier prefixes the backend emits today.
        if raw.contains("gig") { return .gig }
        if raw.contains("listing") || raw.contains("mail") { return .listing }
        if raw.contains("home") { return .claim }
        if raw.contains("post") || raw.contains("reply") { return .reply }
        return .system
    }

    public var label: String {
        switch self {
        case .reply: "Reply"
        case .mention: "Mention"
        case .claim: "Claim"
        case .gig: "Gig"
        case .listing: "Listing"
        case .safety: "Safety"
        case .system: "System"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .reply: .messageCircle
        case .mention: .atSign
        case .claim: .badgeCheck
        case .gig: .briefcase
        case .listing: .tag
        case .safety: .shieldAlert
        case .system: .info
        }
    }

    public var chipVariant: StatusChipVariant {
        switch self {
        case .reply: .personal
        case .mention: .business
        case .claim: .success
        case .gig: .warning
        case .listing: .home
        case .safety: .error
        case .system: .neutral
        }
    }

    /// Background colour for the row's 40pt leading tile. The shell's
    /// `RowLeading.typeIcon` paints this directly.
    public var tileBackground: Color {
        switch self {
        case .reply: Theme.Color.personalBg
        case .mention: Theme.Color.businessBg
        case .claim: Theme.Color.successBg
        case .gig: Theme.Color.warningBg
        case .listing: Theme.Color.homeBg
        case .safety: Theme.Color.errorBg
        case .system: Theme.Color.appSurfaceSunken
        }
    }

    /// Foreground colour for the row's 40pt leading tile.
    public var tileForeground: Color {
        switch self {
        case .reply: Theme.Color.personal
        case .mention: Theme.Color.business
        case .claim: Theme.Color.success
        case .gig: Theme.Color.warning
        case .listing: Theme.Color.home
        case .safety: Theme.Color.error
        case .system: Theme.Color.appTextSecondary
        }
    }
}

private let notificationsUnreadEmptySubcopy =
    "No unread notifications. Replies, mentions, claim updates, " +
    "and safety alerts from your neighborhood will land here."

@Observable
@MainActor
public final class NotificationsViewModel: ListOfRowsDataSource {
    // MARK: - Public state

    public let title = "Notifications"

    public var tabs: [ListOfRowsTab] {
        [
            ListOfRowsTab(id: NotificationsTab.all, label: "All", count: notifications.count),
            ListOfRowsTab(id: NotificationsTab.unread, label: "Unread", count: unreadCount),
            ListOfRowsTab(id: NotificationsTab.read, label: "Read", count: readCount)
        ]
    }

    public var selectedTab: String = NotificationsTab.all {
        didSet {
            guard oldValue != selectedTab else { return }
            Task { @MainActor in await reloadForTab() }
        }
    }

    /// Active firewall zone. Switching re-fetches against the new
    /// context set.
    public private(set) var zone: NotificationsZone = .personal

    /// Whether the Personal / Audience strip should render. True when the
    /// route explicitly asked for a zone, or once the loaded list has
    /// actually returned an audience-context row. Never assumed — no
    /// probe, no fabricated zone.
    public private(set) var showsZoneStrip: Bool = false

    /// Zone options rendered by the screen's segmented strip.
    public let zoneOptions: [NotificationsZone] = NotificationsZone.allCases

    /// Row awaiting delete confirmation. `nil` = no dialog.
    public var pendingDelete: NotificationDeleteRequest?

    public var fab: FABAction? {
        nil
    }

    public private(set) var state: ListOfRowsState = .loading

    public var topBarAction: TopBarAction? {
        TopBarAction(
            label: "Mark all read",
            accessibilityLabel: "Mark all read",
            isEnabled: unreadCount > 0
        ) { [weak self] in
            Task { @MainActor in await self?.markAllRead() }
        }
    }

    /// Latest unread count — drives the bell badge + the read-all
    /// action's enabled state.
    public private(set) var unreadCount: Int = 0

    // MARK: - Dependencies

    private let api: APIClient
    private let onSelect: @MainActor (NotificationDTO) -> Void
    private let now: @Sendable () -> Date
    private let calendar: Calendar
    private let timeZone: TimeZone

    private var notifications: [NotificationDTO] = []
    private var hasMore: Bool = false
    private var loadingPage: Bool = false
    /// Per-context pagination cursors. The Personal zone fans out over
    /// two contexts, so a single `notifications.count` offset would skip
    /// rows on the second page (RN keeps the same per-context map —
    /// `src/app/notifications.tsx:16-18`).
    private var offsets: [String: Int] = [:]
    /// True once the route explicitly requested a zone (Hub megaphone →
    /// `?context=audience`). Keeps the strip visible from first paint.
    private let hasExplicitZone: Bool
    /// True once the user picked a zone from the strip. Until then the
    /// list stays unscoped, matching RN's flag-off behaviour.
    private var zoneWasChosen: Bool = false
    private let pageSize = 20

    init(
        api: APIClient = .shared,
        initialContext: String? = nil,
        onSelect: @escaping @MainActor (NotificationDTO) -> Void = { _ in },
        now: @escaping @Sendable () -> Date = { Date() },
        calendar: Calendar = .current,
        timeZone: TimeZone = .current
    ) {
        self.api = api
        let requested = NotificationsZone(rawValue: initialContext ?? "")
        hasExplicitZone = requested != nil
        zone = requested ?? .personal
        showsZoneStrip = requested != nil
        self.onSelect = onSelect
        self.now = now
        self.calendar = calendar
        self.timeZone = timeZone
    }

    // MARK: - Zone switching

    /// Switch the firewall zone and refetch. Also the moment the list
    /// stops being unscoped: once the user (or the route) has named a
    /// zone we start sending `?context=`.
    public func selectZone(_ next: NotificationsZone) {
        let becomesScoped = !useScopedZones
        guard zone != next || becomesScoped else { return }
        zone = next
        zoneWasChosen = true
        Task { @MainActor in await reloadForTab() }
    }

    /// Contexts the current view is scoped to — `nil` while nobody has
    /// named a zone, which keeps the legacy unscoped list so Beacon rows
    /// are not silently hidden (RN `src/app/notifications.tsx:60-66`).
    private var activeContexts: [String]? {
        useScopedZones ? zone.contexts : nil
    }

    private var useScopedZones: Bool {
        hasExplicitZone || zoneWasChosen
    }

    private var readCount: Int {
        notifications.filter { $0.isRead == true }.count
    }

    // MARK: - ListOfRowsDataSource

    public func load() async {
        state = .loading
        await fetch(reset: true)
    }

    public func refresh() async {
        await fetch(reset: true)
    }

    public func loadMoreIfNeeded() async {
        guard hasMore, !loadingPage else { return }
        await fetch(reset: false)
    }

    // MARK: - Mark read

    /// Mark a single row as read. The row stays in the list but the
    /// unread highlight + 8pt dot disappear. Optimistic — rolls back on
    /// failure.
    public func markRead(id: String) async {
        let previous = notifications
        let previousUnread = unreadCount
        let target = notifications.first { $0.id == id }
        guard let target, target.isRead != true else { return }
        notifications = notifications.map { row in
            row.id == id ? row.markedRead() : row
        }
        unreadCount = max(0, previousUnread - 1)
        rebuild()
        do {
            let _: NotificationActionEcho = try await api.request(
                NotificationsEndpoints.markRead(id: id)
            )
        } catch {
            notifications = previous
            unreadCount = previousUnread
            rebuild()
        }
    }

    /// Mark every unread row as read. Same optimistic + rollback pattern.
    ///
    /// Scoped to the active zone so "Mark all read" in the Personal zone
    /// never silently clears the Beacon stream (RN
    /// `src/app/notifications.tsx:206-214`).
    public func markAllRead() async {
        guard unreadCount > 0 else { return }
        let previous = notifications
        let previousCount = unreadCount
        notifications = notifications.map { $0.markedRead() }
        unreadCount = 0
        rebuild()
        do {
            let _: NotificationActionEcho = try await api.request(
                NotificationsEndpoints.markAllRead(contexts: activeContexts)
            )
        } catch {
            notifications = previous
            unreadCount = previousCount
            rebuild()
        }
    }

    // MARK: - Delete

    /// Ask for confirmation before deleting a row. The screen renders a
    /// `confirmationDialog` off `pendingDelete`.
    public func requestDelete(id: String) {
        guard let target = notifications.first(where: { $0.id == id }) else { return }
        pendingDelete = NotificationDeleteRequest(
            id: target.id,
            title: target.title ?? "this notification"
        )
    }

    /// Dismiss the confirmation without deleting.
    public func cancelDelete() {
        pendingDelete = nil
    }

    /// `DELETE /api/notifications/:id`. Optimistic — the row disappears
    /// immediately and is restored if the call fails.
    public func confirmDelete() async {
        guard let request = pendingDelete else { return }
        pendingDelete = nil
        await delete(id: request.id)
    }

    /// Delete without the confirmation hop. Exposed for tests.
    public func delete(id: String) async {
        guard let target = notifications.first(where: { $0.id == id }) else { return }
        let previous = notifications
        let previousUnread = unreadCount
        notifications.removeAll { $0.id == id }
        if target.isRead != true { unreadCount = max(0, previousUnread - 1) }
        rebuild()
        do {
            let _: NotificationActionEcho = try await api.request(
                NotificationsEndpoints.delete(id: id)
            )
        } catch {
            notifications = previous
            unreadCount = previousUnread
            rebuild()
        }
    }

    // MARK: - Socket integration

    /// Hand a freshly-arrived notification to the VM. Used by the
    /// socket bridge in `RootView` so the list updates in real time.
    public func handleIncoming(_ dto: NotificationDTO) {
        // Dedupe — sockets and the GET can race.
        if notifications.contains(where: { $0.id == dto.id }) { return }
        // Zone firewall: an audience notification must not land in the
        // personal stream (RN `src/app/notifications.tsx:180`).
        if useScopedZones, !zone.matches(context: dto.context) { return }
        notifications.insert(dto, at: 0)
        if dto.isRead != true { unreadCount += 1 }
        rebuild()
    }

    // MARK: - Tab switching

    private func reloadForTab() async {
        notifications = []
        hasMore = false
        offsets = [:]
        state = .loading
        await fetch(reset: true)
    }

    // MARK: - Fetching

    private func fetch(reset: Bool) async {
        loadingPage = true
        defer { loadingPage = false }
        if reset { offsets = [:] }
        await fetchPage(reset: reset)
    }

    /// Pull one page for the active zone.
    private func fetchPage(reset: Bool) async {
        let unreadOnly = selectedTab == NotificationsTab.unread
        do {
            let contexts = activeContexts ?? [""]
            var incoming: [NotificationDTO] = []
            var anyMore = false
            var scopedUnread = 0
            var sawUnreadCount = false
            for context in contexts {
                let response: NotificationsListResponse = try await api.request(
                    NotificationsEndpoints.list(
                        limit: pageSize,
                        offset: offsets[context] ?? 0,
                        unreadOnly: unreadOnly,
                        context: context.isEmpty ? nil : context
                    )
                )
                incoming.append(contentsOf: response.notifications)
                offsets[context] = (offsets[context] ?? 0) + response.notifications.count
                anyMore = anyMore || (response.hasMore ?? false)
                if let count = response.unreadCount {
                    scopedUnread += count
                    sawUnreadCount = true
                }
            }
            notifications = reset
                ? Self.sortedByRecency(incoming)
                : Self.merged(existing: notifications, incoming: incoming)
            hasMore = anyMore
            unreadCount = sawUnreadCount
                ? scopedUnread
                : notifications.filter { $0.isRead != true }.count
            revealZoneStripIfAudienceSeen()
            rebuild()
        } catch {
            if reset {
                state = .error(
                    message: (error as? APIError)?.errorDescription ?? "Couldn't load notifications."
                )
            }
        }
    }

    /// Reveal the Personal / Audience strip once the unscoped list has
    /// actually returned a Beacon row. No probe request, no feature
    /// flag, no fabricated zone — the strip only appears when the
    /// backend has handed us audience-context data.
    private func revealZoneStripIfAudienceSeen() {
        guard !showsZoneStrip else { return }
        showsZoneStrip = notifications.contains {
            $0.context == NotificationContext.audience.rawValue
        }
    }

    /// Newest-first, matching the backend's `created_at desc` ordering
    /// after a multi-context fan-out has interleaved two pages.
    private static func sortedByRecency(_ items: [NotificationDTO]) -> [NotificationDTO] {
        items.sorted { lhs, rhs in
            let left = parseDate(lhs.createdAt) ?? .distantPast
            let right = parseDate(rhs.createdAt) ?? .distantPast
            return left > right
        }
    }

    private static func merged(
        existing: [NotificationDTO],
        incoming: [NotificationDTO]
    ) -> [NotificationDTO] {
        var seen = Set(existing.map(\.id))
        var next = existing
        for item in incoming where !seen.contains(item.id) {
            seen.insert(item.id)
            next.append(item)
        }
        return sortedByRecency(next)
    }

    // MARK: - State projection

    /// Rows for the active tab. `read` has no backend filter — the
    /// handler only understands `?unread=true` — so it is applied
    /// client-side exactly like RN (`src/app/notifications.tsx:259`).
    private var displayedNotifications: [NotificationDTO] {
        selectedTab == NotificationsTab.read
            ? notifications.filter { $0.isRead == true }
            : notifications
    }

    private func rebuild() {
        let rows = displayedNotifications
        if rows.isEmpty {
            state = .empty(emptyContent(for: selectedTab))
            return
        }
        let sections = Self.makeSections(
            rows,
            now: now(),
            calendar: calendar,
            timeZone: timeZone,
            onDelete: { [weak self] id in
                Task { @MainActor in self?.requestDelete(id: id) }
            }
        ) { [weak self] dto in
            Task { @MainActor in self?.handleTap(dto: dto) }
        }
        state = .loaded(sections: sections, hasMore: hasMore)
    }

    private func emptyContent(for tab: String) -> ListOfRowsState.EmptyContent {
        switch tab {
        case NotificationsTab.unread:
            ListOfRowsState.EmptyContent(
                icon: .checkCheck,
                headline: "You\u{2019}re all caught up",
                subcopy: notificationsUnreadEmptySubcopy,
                ctaTitle: "View all notifications"
            ) { [weak self] in
                Task { @MainActor in
                    self?.selectedTab = NotificationsTab.all
                }
            }
        case NotificationsTab.read:
            ListOfRowsState.EmptyContent(
                icon: .bellOff,
                headline: "No read notifications",
                subcopy: "Notifications you\u{2019}ve already opened will collect here.",
                ctaTitle: "View all notifications"
            ) { [weak self] in
                Task { @MainActor in
                    self?.selectedTab = NotificationsTab.all
                }
            }
        default:
            ListOfRowsState.EmptyContent(
                icon: .bell,
                headline: zone == .audience ? "No audience activity" : "All caught up",
                subcopy: zone == .audience
                    ? "Replies, follows, and mentions on your Beacon land here."
                    : "When something needs your attention, it'll show up here."
            )
        }
    }

    private func handleTap(dto: NotificationDTO) {
        if dto.isRead != true {
            Task { @MainActor in await markRead(id: dto.id) }
        }
        if let link = dto.link, !link.isEmpty {
            DeepLinkRouter.shared.handle(path: link)
        }
        onSelect(dto)
    }

    // MARK: - Pure projections (test surface)

    /// Group a list of DTOs into Today + Earlier sections, in that
    /// order. Public so the test suite can assert bucketing directly.
    public static func makeSections(
        _ dtos: [NotificationDTO],
        now: Date,
        calendar: Calendar,
        timeZone: TimeZone,
        onDelete: (@Sendable (String) -> Void)? = nil,
        onTap: @escaping @Sendable (NotificationDTO) -> Void
    ) -> [RowSection] {
        var cal = calendar
        cal.timeZone = timeZone
        let startOfToday = cal.startOfDay(for: now)
        var todayRows: [RowModel] = []
        var earlierRows: [RowModel] = []
        for dto in dtos {
            let created = parseDate(dto.createdAt) ?? now
            let dtoSnapshot = dto
            let row = row(
                dto: dto,
                now: now,
                calendar: cal,
                timeZone: timeZone,
                onDelete: onDelete
            ) { onTap(dtoSnapshot) }
            if created >= startOfToday {
                todayRows.append(row)
            } else {
                earlierRows.append(row)
            }
        }
        var sections: [RowSection] = []
        if !todayRows.isEmpty {
            sections.append(RowSection(id: "today", header: "Today", rows: todayRows))
        }
        if !earlierRows.isEmpty {
            sections.append(RowSection(id: "earlier", header: "Earlier", rows: earlierRows))
        }
        return sections
    }

    /// Pure projection from a `NotificationDTO` to a `RowModel`. Public
    /// so the test suite can assert the mapping without standing up the
    /// full VM.
    public static func row(
        dto: NotificationDTO,
        now: Date = Date(),
        calendar: Calendar = .current,
        timeZone: TimeZone = .current,
        onDelete: (@Sendable (String) -> Void)? = nil,
        onSelect: @Sendable @escaping () -> Void
    ) -> RowModel {
        let unread = dto.isRead != true
        let category = NotificationCategory.from(rawType: dto.type)
        let rowId = dto.id
        let destructive = onDelete.map { handler in
            RowDestructiveAction(
                label: "Delete",
                identifier: "notifications.row.\(rowId).delete"
            ) { handler(rowId) }
        }
        return RowModel(
            id: dto.id,
            title: dto.title ?? "Notification",
            template: .statusChip,
            leading: .typeIcon(
                category.icon,
                background: category.tileBackground,
                foreground: category.tileForeground
            ),
            trailing: .none,
            onTap: onSelect,
            body: dto.body,
            chips: [
                RowChip(
                    text: category.label,
                    icon: category.icon,
                    tint: .status(category.chipVariant)
                )
            ],
            timeMeta: formatRelativeTime(
                dto.createdAt,
                now: now,
                calendar: calendar,
                timeZone: timeZone
            ),
            highlight: unread ? .unread : nil,
            destructiveAction: destructive
        )
    }

    // MARK: - Date helpers

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

    /// Parse a backend `created_at` timestamp. Tries fractional-second
    /// ISO-8601 first, then falls back to the no-fraction form Supabase
    /// emits for whole-second rows.
    public static func parseDate(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        return iso8601.date(from: raw) ?? iso8601NoFraction.date(from: raw)
    }

    /// Format the per-row time meta:
    ///   < 1m  → "now"
    ///   < 1h  → "Nm"
    ///   < 24h → "Nh"
    ///   yesterday → "Yesterday"
    ///   2–6 days → weekday short ("Tue")
    ///   ≥ 7 days → "MMM d" ("Mar 10")
    public static func formatRelativeTime(
        _ raw: String?,
        now: Date,
        calendar: Calendar,
        timeZone: TimeZone
    ) -> String? {
        guard let date = parseDate(raw) else { return nil }
        let interval = now.timeIntervalSince(date)
        if interval < 60 { return "now" }
        if interval < 3600 { return "\(Int(interval / 60))m" }
        if interval < 86400 { return "\(Int(interval / 3600))h" }
        var cal = calendar
        cal.timeZone = timeZone
        let startOfNow = cal.startOfDay(for: now)
        let startOfDate = cal.startOfDay(for: date)
        let dayDelta = cal.dateComponents([.day], from: startOfDate, to: startOfNow).day ?? 0
        if dayDelta == 1 { return "Yesterday" }
        if dayDelta < 7 {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = timeZone
            formatter.dateFormat = "EEE"
            return formatter.string(from: date)
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }
}

private extension NotificationDTO {
    func markedRead() -> NotificationDTO {
        NotificationDTO(
            id: id,
            userId: userId,
            type: type,
            title: title,
            body: body,
            icon: icon,
            link: link,
            isRead: true,
            createdAt: createdAt,
            context: context
        )
    }
}
