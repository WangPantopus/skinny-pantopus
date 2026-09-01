//
//  ConnectionsViewModel.swift
//  Pantopus
//
//  T5.2.3 — Connections. Drives the Connections center against the
//  shared `ListOfRows` archetype with the new design contract:
//
//    - Three equal-width tabs: "All (N)" / "Neighbors (N)" / "Pending (N)".
//    - Top-bar trailing `user-plus` icon (find people / invite — wired to
//      onFindPeople callback).
//    - Search bar between the top bar and tab strip; filter is applied
//      client-side over the loaded rows on each tab.
//    - Each row uses Shape F:
//        - 44pt avatar with stable per-user gradient + optional verified
//          check overlay.
//        - Title: display name.
//        - Subtitle: locality ("city · state") prefixed by map-pin.
//        - Body: per-row interaction line ("Connected 3w ago") prefixed
//          by the matching interaction icon.
//        - Trailing: 38pt circular message-CTA on All / Neighbors,
//          stacked Accept / Ignore on Pending.
//    - Empty states per tab (matching the design's empty frame copy).
//
//  S5 (RN parity, `src/app/connections.tsx:16-21,70-82,126-148`) adds
//  the Sent + Blocked tabs, the per-row Remove (disconnect, confirmed)
//  and Unblock actions.
//
//  Backend (verified against `backend/routes/relationships.js`):
//    - `GET /api/relationships`                    :622 → Accepted list
//    - `GET /api/relationships/requests/pending`   :669 → Pending tab
//    - `GET /api/relationships/requests/sent`      :698 → Sent tab
//    - `GET /api/relationships/blocked`            :727 → Blocked tab
//    - `POST /api/relationships/:id/accept`        :217 → Accept
//    - `POST /api/relationships/:id/reject`        :295 → Ignore
//    - `DELETE /api/relationships/:id`             :578 → Remove
//    - `POST /api/relationships/:id/unblock`       :522 → Unblock
//
//  Two GETs fire in parallel on initial load; subsequent tab switches
//  segment over the cached payload (no extra fetch). Accept / Reject are
//  optimistic with rollback.
//

import Foundation
import Observation
import SwiftUI

// swiftlint:disable file_length type_body_length

/// Stable tab ids — public so the screen + tests can address them
/// without sprinkling string literals.
public enum ConnectionsTab {
    public static let all = "all"
    public static let neighbors = "neighbors"
    public static let pending = "pending"
    /// S5 — outbound requests still awaiting a decision. RN
    /// `src/app/connections.tsx:19`.
    public static let sent = "sent"
    /// S5 — people the viewer has blocked. RN
    /// `src/app/connections.tsx:20`.
    public static let blocked = "blocked"
}

/// Pending "remove this connection?" confirmation. Names the person so
/// the dialog copy can't be mistaken for a generic destructive prompt.
public struct ConnectionRemovalRequest: Sendable, Identifiable, Hashable {
    public let id: String
    public let displayName: String

    public init(id: String, displayName: String) {
        self.id = id
        self.displayName = displayName
    }
}

/// Routing payload emitted by the Connections row's message-CTA. The
/// host (`HubTabRoot`) maps this onto a `HubRoute.chatConversation`
/// push.
public struct ConnectionsChatTarget: Sendable, Hashable {
    public let userId: String
    public let displayName: String
    public let initials: String
    public let verified: Bool

    public init(userId: String, displayName: String, initials: String, verified: Bool) {
        self.userId = userId
        self.displayName = displayName
        self.initials = initials
        self.verified = verified
    }
}

/// Six-tone palette for the per-user avatar gradient. Stable mapping
/// from user id keeps the same person always rendering the same color.
public enum ConnectionAvatarTone: Sendable, Hashable, CaseIterable {
    case sky, teal, amber, rose, violet, slate

    /// Pick a deterministic tone for the given identifier so the same
    /// user renders the same color across sessions.
    public static func tone(for id: String) -> ConnectionAvatarTone {
        let palette = ConnectionAvatarTone.allCases
        let hash = id.unicodeScalars.reduce(0) { $0 &+ Int($1.value) }
        let index = abs(hash) % palette.count
        return palette[index]
    }

    public var gradient: GradientPair {
        // Each pair walks from a lighter to a darker shade of the same
        // hue. Only existing design tokens are used — no deep variants
        // exist for the semantic / identity scales today, so those
        // collapse the gradient onto two adjacent existing tokens.
        switch self {
        case .sky: GradientPair(start: Theme.Color.primary500, end: Theme.Color.primary700)
        case .teal: GradientPair(start: Theme.Color.success, end: Theme.Color.home)
        case .amber: GradientPair(start: Theme.Color.warning, end: Theme.Color.handyman)
        case .rose: GradientPair(start: Theme.Color.error, end: Theme.Color.vehicles)
        case .violet: GradientPair(start: Theme.Color.business, end: Theme.Color.goods)
        case .slate: GradientPair(start: Theme.Color.appTextSecondary, end: Theme.Color.appTextStrong)
        }
    }
}

@Observable
@MainActor
public final class ConnectionsViewModel: ListOfRowsDataSource {
    // MARK: - Public state

    public let title = "Connections"

    public var topBarAction: TopBarAction? {
        TopBarAction(
            icon: .userPlus,
            accessibilityLabel: "Find people"
        ) { [weak self] in
            MainActor.assumeIsolated { self?.onFindPeople() }
        }
    }

    public var tabs: [ListOfRowsTab] {
        [
            ListOfRowsTab(id: ConnectionsTab.all, label: "All", count: filteredAccepted.count),
            ListOfRowsTab(
                id: ConnectionsTab.neighbors,
                label: "Neighbors",
                count: filteredNeighbors.count
            ),
            ListOfRowsTab(id: ConnectionsTab.pending, label: "Pending", count: filteredPending.count),
            ListOfRowsTab(id: ConnectionsTab.sent, label: "Sent", count: filteredSent.count),
            ListOfRowsTab(id: ConnectionsTab.blocked, label: "Blocked", count: filteredBlocked.count)
        ]
    }

    /// Row awaiting disconnect confirmation. `nil` = no dialog.
    public var pendingRemoval: ConnectionRemovalRequest?

    public var selectedTab: String = ConnectionsTab.all {
        didSet {
            guard oldValue != selectedTab else { return }
            rebuild()
        }
    }

    public var fab: FABAction? {
        FABAction(
            icon: .userPlus,
            accessibilityLabel: "Find people",
            variant: .secondaryCreate
        ) { [weak self] in
            MainActor.assumeIsolated { self?.onFindPeople() }
        }
    }

    public private(set) var state: ListOfRowsState = .loading

    public var searchBar: SearchBarConfig? {
        // The SwiftUI binding setter runs on MainActor; the `@Sendable`
        // closure shape lets us call back into the VM directly without
        // an extra Task hop.
        SearchBarConfig(
            placeholder: "Search by name or neighborhood",
            text: searchText
        ) { [weak self] value in
            MainActor.assumeIsolated { self?.updateSearch(value) }
        }
    }

    /// Live search query; bound to the search bar.
    public private(set) var searchText: String = ""

    // MARK: - Dependencies

    private let api: APIClient
    private let onMessage: @MainActor (ConnectionsChatTarget) -> Void
    private let onFindPeople: @MainActor () -> Void
    private let now: @Sendable () -> Date
    private let calendar: Calendar
    private let timeZone: TimeZone

    private var accepted: [RelationshipDTO] = []
    private var pending: [PendingRequestDTO] = []
    private var sent: [SentRequestDTO] = []
    private var blocked: [BlockedRelationshipDTO] = []
    private var loadedOnce: Bool = false

    init(
        api: APIClient = .shared,
        onMessage: @escaping @MainActor (ConnectionsChatTarget) -> Void = { _ in },
        onFindPeople: @escaping @MainActor () -> Void = {},
        now: @escaping @Sendable () -> Date = { Date() },
        calendar: Calendar = .current,
        timeZone: TimeZone = .current
    ) {
        self.api = api
        self.onMessage = onMessage
        self.onFindPeople = onFindPeople
        self.now = now
        self.calendar = calendar
        self.timeZone = timeZone
    }

    // MARK: - ListOfRowsDataSource

    public func load() async {
        if loadedOnce { return }
        state = .loading
        await fetchAll()
    }

    public func refresh() async {
        await fetchAll()
    }

    public func loadMoreIfNeeded() async {
        // Single-shot list — no pagination on the new design.
    }

    // MARK: - Search

    /// Update the live search query. The view layer wires this to the
    /// shared `SearchBarConfig.onChange` callback; tests call it
    /// directly to avoid the SwiftUI binding round-trip.
    public func updateSearch(_ value: String) {
        guard searchText != value else { return }
        searchText = value
        rebuild()
    }

    // MARK: - Accept / Reject (optimistic)

    /// Accept a pending request. Optimistically removes the request and
    /// inserts a synthetic accepted row so the All / Neighbors counts
    /// bump immediately. Rolls back on failure.
    public func accept(requestId: String) async {
        guard let request = pending.first(where: { $0.id == requestId }),
              let user = request.requester else { return }
        let previousPending = pending
        let previousAccepted = accepted
        pending.removeAll { $0.id == requestId }
        let synthetic = RelationshipDTO(
            id: requestId,
            status: "accepted",
            createdAt: request.createdAt,
            respondedAt: Self.iso8601String(from: now()),
            acceptedAt: Self.iso8601String(from: now()),
            blockedBy: nil,
            direction: "received",
            otherUser: user
        )
        accepted.insert(synthetic, at: 0)
        rebuild()
        do {
            let _: RelationshipActionEcho = try await api.request(
                RelationshipsEndpoints.accept(id: requestId)
            )
        } catch {
            pending = previousPending
            accepted = previousAccepted
            rebuild()
        }
    }

    /// Decline / ignore a pending request. Optimistically removes and
    /// rolls back on failure.
    public func reject(requestId: String) async {
        let previousPending = pending
        pending.removeAll { $0.id == requestId }
        rebuild()
        do {
            let _: RelationshipActionEcho = try await api.request(
                RelationshipsEndpoints.reject(id: requestId)
            )
        } catch {
            pending = previousPending
            rebuild()
        }
    }

    // MARK: - Remove (disconnect) / Unblock

    /// Ask for confirmation before disconnecting. The screen renders a
    /// `confirmationDialog` off `pendingRemoval`; RN shows the same
    /// Cancel / Remove alert (`src/app/connections.tsx:70-77`).
    public func requestRemoval(relationshipId: String) {
        guard let rel = accepted.first(where: { $0.id == relationshipId }) else { return }
        pendingRemoval = ConnectionRemovalRequest(
            id: relationshipId,
            displayName: Self.displayName(for: rel.otherUser) ?? "this connection"
        )
    }

    /// Dismiss the confirmation without disconnecting.
    public func cancelRemoval() {
        pendingRemoval = nil
    }

    /// Run the confirmed disconnect.
    public func confirmRemoval() async {
        guard let request = pendingRemoval else { return }
        pendingRemoval = nil
        await disconnect(relationshipId: request.id)
    }

    /// `DELETE /api/relationships/:id`. Optimistic — the row disappears
    /// immediately and is restored if the call fails.
    public func disconnect(relationshipId: String) async {
        let previous = accepted
        accepted.removeAll { $0.id == relationshipId }
        rebuild()
        do {
            let _: RelationshipActionEcho = try await api.request(
                ConnectionsEndpoints.disconnect(id: relationshipId)
            )
        } catch {
            accepted = previous
            rebuild()
        }
    }

    /// `POST /api/relationships/:id/unblock`. Optimistic — the row leaves
    /// the Blocked tab and is restored if the call fails. The backend
    /// deletes the row outright, so nothing moves into Connections.
    public func unblock(relationshipId: String) async {
        let previous = blocked
        blocked.removeAll { $0.id == relationshipId }
        rebuild()
        do {
            let _: RelationshipActionEcho = try await api.request(
                ConnectionsEndpoints.unblock(id: relationshipId)
            )
        } catch {
            blocked = previous
            rebuild()
        }
    }

    // MARK: - Fetching

    private func fetchAll() async {
        async let acceptedTask = fetchAccepted()
        async let pendingTask = fetchPending()
        async let sentTask = fetchSent()
        async let blockedTask = fetchBlocked()
        let (acceptedResult, pendingResult) = await (acceptedTask, pendingTask)
        let (sentResult, blockedResult) = await (sentTask, blockedTask)
        if !acceptedResult, !pendingResult, !sentResult, !blockedResult {
            // Everything failed → surface the error banner.
            state = .error(message: "Couldn't load your connections. Try again.")
            return
        }
        loadedOnce = true
        rebuild()
    }

    private func fetchSent() async -> Bool {
        do {
            let response: SentRequestsResponse = try await api.request(
                ConnectionsEndpoints.sentRequests
            )
            sent = response.requests
            return true
        } catch {
            return false
        }
    }

    private func fetchBlocked() async -> Bool {
        do {
            let response: BlockedRelationshipsResponse = try await api.request(
                ConnectionsEndpoints.blocked
            )
            blocked = response.blocked
            return true
        } catch {
            return false
        }
    }

    private func fetchAccepted() async -> Bool {
        do {
            let response: RelationshipsListResponse = try await api.request(
                RelationshipsEndpoints.list(status: "accepted")
            )
            accepted = response.relationships
            return true
        } catch {
            return false
        }
    }

    private func fetchPending() async -> Bool {
        do {
            let response: PendingRequestsResponse = try await api.request(
                RelationshipsEndpoints.pending
            )
            pending = response.requests
            return true
        } catch {
            return false
        }
    }

    // MARK: - State projection

    private var filteredAccepted: [RelationshipDTO] {
        applySearch(accepted) { rel in
            Self.searchableText(for: rel.otherUser)
        }
    }

    /// Neighbors = accepted relationships where the other user has
    /// populated a city. The current backend doesn't expose a richer
    /// "neighbor verified" signal, so locality presence is the honest
    /// stand-in until that lands.
    private var neighborsAccepted: [RelationshipDTO] {
        accepted.filter { ($0.otherUser?.city ?? "").isEmpty == false }
    }

    private var filteredNeighbors: [RelationshipDTO] {
        applySearch(neighborsAccepted) { rel in
            Self.searchableText(for: rel.otherUser)
        }
    }

    private var filteredPending: [PendingRequestDTO] {
        applySearch(pending) { req in
            Self.searchableText(for: req.requester)
        }
    }

    private var filteredSent: [SentRequestDTO] {
        applySearch(sent) { req in
            Self.searchableText(for: req.addressee)
        }
    }

    private var filteredBlocked: [BlockedRelationshipDTO] {
        applySearch(blocked) { rel in
            Self.searchableText(for: rel.blockedUser)
        }
    }

    private func applySearch<T>(_ items: [T], by text: (T) -> String) -> [T] {
        let needle = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !needle.isEmpty else { return items }
        return items.filter { text($0).contains(needle) }
    }

    private func rebuild() {
        let rows: [RowModel] = switch selectedTab {
        case ConnectionsTab.pending:
            filteredPending.map { rowForPending($0) }
        case ConnectionsTab.sent:
            filteredSent.map { rowForSent($0) }
        case ConnectionsTab.blocked:
            filteredBlocked.map { rowForBlocked($0) }
        case ConnectionsTab.neighbors:
            filteredNeighbors.map { rowForAccepted($0) }
        default:
            filteredAccepted.map { rowForAccepted($0) }
        }
        if rows.isEmpty {
            state = .empty(emptyContent(for: selectedTab))
            return
        }
        let section = RowSection(id: "connections", rows: rows)
        state = .loaded(sections: [section], hasMore: false)
    }

    private func emptyContent(for tab: String) -> ListOfRowsState.EmptyContent {
        switch tab {
        case ConnectionsTab.pending:
            ListOfRowsState.EmptyContent(
                icon: .mailbox,
                headline: "No pending requests",
                subcopy: "When someone sends you a connection request, it'll show up here."
            )
        case ConnectionsTab.sent:
            ListOfRowsState.EmptyContent(
                icon: .send,
                headline: "No sent requests",
                subcopy: "Requests you send will appear here until accepted or declined."
            )
        case ConnectionsTab.blocked:
            ListOfRowsState.EmptyContent(
                icon: .ban,
                headline: "No blocked users",
                subcopy: "People you block stop seeing your posts and can't message you.",
                tint: Theme.Color.appSurfaceSunken,
                accent: Theme.Color.appTextSecondary
            )
        case ConnectionsTab.neighbors:
            ListOfRowsState.EmptyContent(
                icon: .mapPin,
                headline: "No neighbors yet",
                subcopy:
                "Connections who share their locality show up here. " +
                    "Invite a neighbor or accept a nearby request to get started."
            )
        default:
            ListOfRowsState.EmptyContent(
                icon: .userPlus,
                headline: "No connections yet",
                subcopy:
                "Meet verified neighbors. Browse the Pulse, reply to a post, " +
                    "or invite someone you know on the block.",
                ctaTitle: "Find people"
            ) { [weak self] in
                MainActor.assumeIsolated { self?.onFindPeople() }
            }
        }
    }

    // MARK: - Row mapping (pure projections, public for tests)

    public func rowForAccepted(_ rel: RelationshipDTO) -> RowModel {
        let user = rel.otherUser
        let displayName = Self.displayName(for: user) ?? "Member"
        let initials = Self.initials(for: user, displayName: displayName)
        let target = ConnectionsChatTarget(
            userId: user?.id ?? rel.id,
            displayName: displayName,
            initials: initials,
            verified: true
        )
        let acceptedAtRaw = rel.acceptedAt ?? rel.createdAt
        let body = "Connected " + (
            Self.formatRelativeTime(
                acceptedAtRaw,
                now: now(),
                calendar: calendar,
                timeZone: timeZone
            ) ?? "recently"
        )
        return RowModel(
            id: rel.id,
            title: displayName,
            subtitle: Self.localityText(user),
            template: .statusChip,
            leading: .avatarWithBadge(
                name: displayName,
                imageURL: Self.avatarURL(user),
                background: .gradient(ConnectionAvatarTone.tone(for: user?.id ?? rel.id).gradient),
                size: .large,
                verified: true
            ),
            trailing: .circularAction(
                icon: .messageCircle,
                accessibilityLabel: "Message \(displayName)",
                background: Theme.Color.primary50,
                foreground: Theme.Color.primary600
            ) { [weak self] in
                MainActor.assumeIsolated { self?.onMessage(target) }
            },
            body: body,
            subtitleIcon: Self.localityText(user) == nil ? nil : .mapPin,
            bodyIcon: .userPlus,
            destructiveAction: RowDestructiveAction(
                label: "Remove",
                identifier: "connections.row.\(rel.id).remove"
            ) { [weak self] in
                Task { @MainActor in self?.requestRemoval(relationshipId: rel.id) }
            }
        )
    }

    /// Outbound request row — no actions, just the "Pending" status the
    /// RN screen shows (`src/app/connections.tsx:141-143`).
    public func rowForSent(_ request: SentRequestDTO) -> RowModel {
        let user = request.addressee
        let displayName = Self.displayName(for: user) ?? "Member"
        let body = "Sent " + (
            Self.formatRelativeTime(
                request.createdAt,
                now: now(),
                calendar: calendar,
                timeZone: timeZone
            ) ?? "just now"
        )
        return RowModel(
            id: request.id,
            title: displayName,
            subtitle: Self.localityText(user),
            template: .statusChip,
            leading: .avatarWithBadge(
                name: displayName,
                imageURL: Self.avatarURL(user),
                background: .gradient(ConnectionAvatarTone.tone(for: user?.id ?? request.id).gradient),
                size: .large,
                verified: false
            ),
            trailing: .statusChip(text: "Pending", variant: .warning),
            body: body,
            subtitleIcon: Self.localityText(user) == nil ? nil : .mapPin,
            bodyIcon: .clock
        )
    }

    /// Blocked row — trailing neutral "Unblock" pill, matching the
    /// A14.4 blocked-users treatment the shell already ships.
    public func rowForBlocked(_ rel: BlockedRelationshipDTO) -> RowModel {
        let user = rel.blockedUser
        let displayName = Self.displayName(for: user) ?? "Member"
        let body = "Blocked " + (
            Self.formatRelativeTime(
                rel.respondedAt ?? rel.createdAt,
                now: now(),
                calendar: calendar,
                timeZone: timeZone
            ) ?? "recently"
        )
        let relationshipId = rel.id
        return RowModel(
            id: rel.id,
            title: displayName,
            subtitle: Self.localityText(user),
            template: .statusChip,
            leading: .avatarWithBadge(
                name: displayName,
                imageURL: Self.avatarURL(user),
                background: .gradient(ConnectionAvatarTone.tone(for: user?.id ?? rel.id).gradient),
                size: .large,
                verified: false
            ),
            trailing: .pillButton(label: "Unblock", tone: .neutral) { [weak self] in
                Task { @MainActor in await self?.unblock(relationshipId: relationshipId) }
            },
            body: body,
            subtitleIcon: Self.localityText(user) == nil ? nil : .mapPin,
            bodyIcon: .ban,
            note: rel.blockReason?.isEmpty == false ? rel.blockReason : nil
        )
    }

    public func rowForPending(_ request: PendingRequestDTO) -> RowModel {
        let user = request.requester
        let displayName = Self.displayName(for: user) ?? "Member"
        let body = "New request " + (
            Self.formatRelativeTime(
                request.createdAt,
                now: now(),
                calendar: calendar,
                timeZone: timeZone
            ) ?? "just now"
        )
        let requestId = request.id
        return RowModel(
            id: request.id,
            title: displayName,
            subtitle: Self.localityText(user),
            template: .statusChip,
            leading: .avatarWithBadge(
                name: displayName,
                imageURL: Self.avatarURL(user),
                background: .gradient(ConnectionAvatarTone.tone(for: user?.id ?? request.id).gradient),
                size: .large,
                verified: false
            ),
            trailing: .verticalActions(
                primary: VerticalAction(label: "Accept", variant: .primary) { [weak self] in
                    Task { @MainActor in await self?.accept(requestId: requestId) }
                },
                secondary: VerticalAction(label: "Ignore", variant: .ghost) { [weak self] in
                    Task { @MainActor in await self?.reject(requestId: requestId) }
                }
            ),
            body: body,
            subtitleIcon: Self.localityText(user) == nil ? nil : .mapPin,
            bodyIcon: .userPlus
        )
    }

    // MARK: - Helpers (pure)

    static func displayName(for user: RelationshipUserDTO?) -> String? {
        guard let user else { return nil }
        if let name = user.name, !name.isEmpty { return name }
        if let first = user.firstName, !first.isEmpty {
            if let last = user.lastName, !last.isEmpty {
                return "\(first) \(last)"
            }
            return first
        }
        if let username = user.username, !username.isEmpty { return username }
        return nil
    }

    static func initials(for user: RelationshipUserDTO?, displayName: String) -> String {
        let parts = displayName.split(separator: " ").prefix(2)
        let derived = parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
        if !derived.isEmpty { return derived }
        if let first = user?.firstName?.first.map(String.init),
           let last = user?.lastName?.first.map(String.init) {
            return (first + last).uppercased()
        }
        return String(displayName.prefix(2)).uppercased()
    }

    static func localityText(_ user: RelationshipUserDTO?) -> String? {
        guard let user else { return nil }
        let city = (user.city ?? "").trimmingCharacters(in: .whitespaces)
        let state = (user.state ?? "").trimmingCharacters(in: .whitespaces)
        switch (city.isEmpty, state.isEmpty) {
        case (false, false): return "\(city), \(state)"
        case (false, true): return city
        case (true, false): return state
        default: return nil
        }
    }

    static func avatarURL(_ user: RelationshipUserDTO?) -> URL? {
        guard let raw = user?.profilePictureURL, !raw.isEmpty else { return nil }
        return URL(string: raw)
    }

    static func searchableText(for user: RelationshipUserDTO?) -> String {
        var parts: [String] = []
        if let name = displayName(for: user) { parts.append(name) }
        if let username = user?.username { parts.append(username) }
        if let city = user?.city { parts.append(city) }
        if let state = user?.state { parts.append(state) }
        return parts.joined(separator: " ").lowercased()
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

    private static let iso8601Encoder: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    public static func parseDate(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        return iso8601.date(from: raw) ?? iso8601NoFraction.date(from: raw)
    }

    public static func iso8601String(from date: Date) -> String {
        iso8601Encoder.string(from: date)
    }

    /// Format a relative-time string for the row body. Shorter forms
    /// only — the full `Yesterday` / weekday escalation matches
    /// Notifications.
    public static func formatRelativeTime(
        _ raw: String?,
        now: Date,
        calendar: Calendar,
        timeZone: TimeZone
    ) -> String? {
        guard let date = parseDate(raw) else { return nil }
        let interval = now.timeIntervalSince(date)
        if interval < 60 { return "just now" }
        if interval < 3600 { return "\(Int(interval / 60))m ago" }
        if interval < 86400 { return "\(Int(interval / 3600))h ago" }
        var cal = calendar
        cal.timeZone = timeZone
        let startOfNow = cal.startOfDay(for: now)
        let startOfDate = cal.startOfDay(for: date)
        let dayDelta = cal.dateComponents([.day], from: startOfDate, to: startOfNow).day ?? 0
        if dayDelta == 1 { return "yesterday" }
        if dayDelta < 7 { return "\(dayDelta)d ago" }
        if dayDelta < 30 { return "\(dayDelta / 7)w ago" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }
}
