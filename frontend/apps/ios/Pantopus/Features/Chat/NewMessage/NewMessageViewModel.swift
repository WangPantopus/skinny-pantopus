//
//  NewMessageViewModel.swift
//  Pantopus
//
//  Backs the New Message contact picker (T6.6b P25). Three sections
//  surface separate data sources:
//
//  - Connections — `GET /api/relationships?status=accepted` (existing
//    endpoint, same source as the Connections center).
//  - Recent — derived from `GET /api/chat/unified-conversations` (DM
//    peers, top 10 by `lastMessageAt`).
//  - All verified — search-driven via `GET /api/users/search?q=…` when
//    the search query reaches the backend's 2-character minimum. With
//    no query, this section is hidden; the Connections + Recent
//    sections remain visible.
//
//  Selecting a row emits a `NewMessageDestination` to the host; the
//  host pops the picker and pushes the chat-conversation route with a
//  `person(otherUserId:)` thread mode.
//

// swiftlint:disable type_body_length

import Foundation
import Logging
import Observation

@Observable
@MainActor
public final class NewMessageViewModel {
    public private(set) var state: NewMessageState = .loading

    /// Live search query — bound to the sticky search bar.
    public private(set) var searchText: String = ""

    /// Empty-state copy + CTA labels, sized for the design's pivot
    /// frame. Pure constants for now.
    public let emptyHeadline = "Search for someone to message"
    public let emptyBody =
        "You can message anyone with a verified Pantopus account. Search by name, " +
        "or invite someone who isn't on the platform yet."
    public let emptySearchHints = ["A neighbor's name", "Your block", "A local business"]

    private let api: APIClient
    private let onSelect: @MainActor (NewMessageDestination) -> Void
    private let onCancel: @MainActor () -> Void
    private let onInvite: @MainActor () -> Void
    private let logger = Logger(label: "app.pantopus.ios.NewMessage")

    private var accepted: [RelationshipDTO] = []
    private var recents: [UnifiedConversation] = []
    private var verifiedResults: [UserSearchResultDTO] = []
    private var loadedOnce: Bool = false
    private var searchTask: Task<Void, Never>?
    /// Sequence guard — every search firing increments this. Late
    /// responses with a stale value are dropped so the rendered
    /// "All verified" rows always reflect the most recent query.
    private var searchSequence: Int = 0

    init(
        api: APIClient = .shared,
        onSelect: @escaping @MainActor (NewMessageDestination) -> Void = { _ in },
        onCancel: @escaping @MainActor () -> Void = {},
        onInvite: @escaping @MainActor () -> Void = {}
    ) {
        self.api = api
        self.onSelect = onSelect
        self.onCancel = onCancel
        self.onInvite = onInvite
    }

    // MARK: - Public API

    public func load() async {
        if loadedOnce { return }
        state = .loading
        await fetchInitial()
    }

    public func refresh() async {
        await fetchInitial()
    }

    public func updateSearch(_ value: String) {
        guard searchText != value else { return }
        searchText = value
        rebuild()
        scheduleSearch(value)
    }

    public func clearSearch() {
        updateSearch("")
    }

    public func tapCancel() {
        searchTask?.cancel()
        onCancel()
    }

    public func tapInvite() {
        onInvite()
    }

    /// Tap a row → emit a routing payload. The host swaps the picker
    /// for the chat conversation. Tapping does NOT depend on whether
    /// the contact has an existing room — the conversation endpoint
    /// resolves or creates the DM on first send.
    public func tap(row: NewMessageContactRow) {
        let destination = NewMessageDestination(
            userId: row.userId,
            displayName: row.name,
            initials: row.initials,
            verified: row.verified,
            locality: row.locality
        )
        onSelect(destination)
    }

    // MARK: - Fetch

    private func fetchInitial() async {
        async let connectionsTask = fetchConnections()
        async let recentsTask = fetchRecents()
        let (connectionsOK, recentsOK) = await (connectionsTask, recentsTask)
        if !connectionsOK && !recentsOK {
            state = .error(message: "Couldn't load contacts. Try again.")
            return
        }
        loadedOnce = true
        rebuild()
    }

    private func fetchConnections() async -> Bool {
        do {
            let response: RelationshipsListResponse = try await api.request(
                RelationshipsEndpoints.list(status: "accepted")
            )
            accepted = response.relationships
            return true
        } catch {
            logger.warning("Connections fetch failed: \(error)")
            return false
        }
    }

    private func fetchRecents() async -> Bool {
        do {
            let response: UnifiedConversationsResponse = try await api.request(
                ChatEndpoints.unifiedConversations(limit: 50)
            )
            // Recent section is DM peers only (group / AI rows are
            // surfaced elsewhere in the chat list). Keep the top 10
            // by backend-supplied ordering (already lastMessageAt
            // desc).
            recents = Array(
                response.conversations
                    .filter { $0.kind == .conversation }
                    .prefix(10)
            )
            return true
        } catch {
            logger.warning("Recents fetch failed: \(error)")
            return false
        }
    }

    // MARK: - Search

    private func scheduleSearch(_ query: String) {
        searchTask?.cancel()
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else {
            verifiedResults = []
            rebuild()
            return
        }
        searchSequence += 1
        let seq = searchSequence
        searchTask = Task { [weak self] in
            // 280ms debounce — matches the backend rate-limit budget
            // and keeps keystroke chatter manageable on the picker.
            // Cancellation throws out of Task.sleep; bail before the
            // network call so a quick-clear doesn't fire a stale
            // request.
            do {
                try await Task.sleep(nanoseconds: 280_000_000)
            } catch {
                return
            }
            await self?.runSearch(trimmed, sequence: seq)
        }
    }

    private func runSearch(_ query: String, sequence: Int) async {
        do {
            let response: UserSearchResponse = try await api.request(
                UsersEndpoints.search(query: query, limit: 20)
            )
            // Drop the response if the user has typed again since.
            guard sequence == searchSequence else { return }
            verifiedResults = response.users
            rebuild()
        } catch {
            guard sequence == searchSequence else { return }
            // Search failures don't tip the whole screen into error
            // state — the Connections + Recent sections stay visible.
            // We just clear "All verified" and keep going.
            verifiedResults = []
            rebuild()
            logger.warning("User search failed: \(error)")
        }
    }

    // MARK: - Projection

    private func rebuild() {
        let connectionsSection = makeConnectionsSection()
        let recentSection = makeRecentSection(excluding: rowIds(connectionsSection))
        let allVerifiedSection = makeAllVerifiedSection(
            excluding: rowIds(connectionsSection).union(rowIds(recentSection))
        )

        var sections: [NewMessageSection] = []
        if !connectionsSection.rows.isEmpty { sections.append(connectionsSection) }
        if !recentSection.rows.isEmpty { sections.append(recentSection) }
        if !allVerifiedSection.rows.isEmpty { sections.append(allVerifiedSection) }

        let queryActive = !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        if sections.isEmpty {
            // No connections / recents / search hits → pivot the body
            // to the search-affordance empty frame. The search bar
            // remains sticky above.
            state = queryActive ? .loaded(sections: []) : .empty
            return
        }
        state = .loaded(sections: sections)
    }

    private func rowIds(_ section: NewMessageSection) -> Set<String> {
        Set(section.rows.map(\.userId))
    }

    private func makeConnectionsSection() -> NewMessageSection {
        let needle = normalizedSearch
        let filtered = accepted.filter { rel in
            guard !needle.isEmpty else { return true }
            return Self.searchable(for: rel.otherUser).contains(needle)
        }
        let rows: [NewMessageContactRow] = filtered.compactMap { rel in
            rowForConnection(rel)
        }
        return NewMessageSection(id: .connections, label: "Connections", rows: rows)
    }

    private func makeRecentSection(excluding: Set<String>) -> NewMessageSection {
        let needle = normalizedSearch
        let filtered = recents.filter { dto in
            guard !excluding.contains(dto.id) else { return false }
            guard !needle.isEmpty else { return true }
            return (dto.name ?? "").lowercased().contains(needle)
        }
        let rows: [NewMessageContactRow] = filtered.compactMap { rowForRecent($0) }
        return NewMessageSection(id: .recent, label: "Recent", rows: rows)
    }

    private func makeAllVerifiedSection(excluding: Set<String>) -> NewMessageSection {
        // Hide the section when there's no active search query — the
        // verified directory is search-driven, not enumerated.
        guard !normalizedSearch.isEmpty else {
            return NewMessageSection(id: .allVerified, label: "All verified", rows: [])
        }
        let filtered = verifiedResults.filter { !excluding.contains($0.id) }
        let rows: [NewMessageContactRow] = filtered.map { rowForVerified($0) }
        return NewMessageSection(id: .allVerified, label: "All verified", rows: rows)
    }

    private var normalizedSearch: String {
        searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    // MARK: - Row mapping (pure projections, public for tests)

    public func rowForConnection(_ rel: RelationshipDTO) -> NewMessageContactRow? {
        let user = rel.otherUser
        let displayName = ConnectionsViewModel.displayName(for: user) ?? "Member"
        let initials = ConnectionsViewModel.initials(for: user, displayName: displayName)
        return NewMessageContactRow(
            id: "connection_\(rel.id)",
            userId: user?.id ?? rel.id,
            name: displayName,
            initials: initials,
            locality: ConnectionsViewModel.localityText(user),
            sub: Self.connectionSub(for: rel),
            subIcon: Self.connectionSubIcon(for: rel),
            verified: true,
            identity: .personal
        )
    }

    public func rowForRecent(_ dto: UnifiedConversation) -> NewMessageContactRow? {
        let displayName = (dto.name?.isEmpty == false ? dto.name : nil) ?? "Pantopus user"
        let initials = Self.initials(from: displayName)
        let verified = dto.isVerified ?? false
        let identity: NewMessageIdentityBadge = Self.identity(for: dto.identityKind)
        return NewMessageContactRow(
            id: "recent_\(dto.id)",
            userId: dto.id,
            name: displayName,
            initials: initials,
            locality: Self.localityText(dto),
            sub: Self.recentSub(for: dto),
            subIcon: .messageCircle,
            verified: verified,
            identity: identity
        )
    }

    public func rowForVerified(_ dto: UserSearchResultDTO) -> NewMessageContactRow {
        let displayName = (dto.name?.isEmpty == false ? dto.name : nil)
            ?? (dto.username?.isEmpty == false ? dto.username : nil)
            ?? "Member"
        let initials = Self.initials(from: displayName)
        let identity: NewMessageIdentityBadge = dto.accountType == "business" ? .business : .personal
        return NewMessageContactRow(
            id: "verified_\(dto.id)",
            userId: dto.id,
            name: displayName,
            initials: initials,
            locality: Self.searchLocalityText(dto),
            sub: nil,
            subIcon: nil,
            verified: true,
            identity: identity
        )
    }

    // MARK: - Helpers (static, pure)

    private static func connectionSub(for rel: RelationshipDTO) -> String? {
        guard let raw = rel.acceptedAt ?? rel.createdAt, !raw.isEmpty else { return nil }
        guard let relative = formatRelative(raw) else { return nil }
        return "Connected \(relative)"
    }

    private static func connectionSubIcon(for rel: RelationshipDTO) -> PantopusIcon? {
        let raw = rel.acceptedAt ?? rel.createdAt
        return (raw?.isEmpty == false) ? .userPlus : nil
    }

    private static func recentSub(for dto: UnifiedConversation) -> String? {
        guard let timestamp = dto.lastMessageAt, let relative = formatRelative(timestamp) else {
            return "Last chat recently"
        }
        return "Last chat \(relative)"
    }

    private static func identity(for raw: String?) -> NewMessageIdentityBadge {
        switch raw {
        case "business": .business
        case "home": .home
        default: .personal
        }
    }

    private static func localityText(_ dto: UnifiedConversation) -> String? {
        // Unified conversation DTO has no city / state today; surface
        // the kind+verified hint instead so the row's secondary line
        // isn't blank.
        if dto.isVerified == true { return "Verified neighbor" }
        return nil
    }

    private static func searchLocalityText(_ dto: UserSearchResultDTO) -> String? {
        let city = (dto.city ?? "").trimmingCharacters(in: .whitespaces)
        let state = (dto.state ?? "").trimmingCharacters(in: .whitespaces)
        switch (city.isEmpty, state.isEmpty) {
        case (false, false): return "\(city), \(state)"
        case (false, true): return city
        case (true, false): return state
        default: return nil
        }
    }

    private static func initials(from name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        let result = parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
        return result.isEmpty ? "?" : result
    }

    private static func searchable(for user: RelationshipUserDTO?) -> String {
        var parts: [String] = []
        if let name = ConnectionsViewModel.displayName(for: user) { parts.append(name) }
        if let username = user?.username { parts.append(username) }
        if let city = user?.city { parts.append(city) }
        if let state = user?.state { parts.append(state) }
        return parts.joined(separator: " ").lowercased()
    }

    private static func formatRelative(_ raw: String) -> String? {
        guard !raw.isEmpty else { return nil }
        let formatter1 = ISO8601DateFormatter()
        formatter1.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let formatter2 = ISO8601DateFormatter()
        guard let date = formatter1.date(from: raw) ?? formatter2.date(from: raw) else {
            return nil
        }
        let interval = Date().timeIntervalSince(date)
        if interval < 60 { return "just now" }
        if interval < 3600 { return "\(Int(interval / 60))m ago" }
        if interval < 86400 { return "\(Int(interval / 3600))h ago" }
        if interval < 7 * 86400 { return "\(Int(interval / 86400))d ago" }
        if interval < 30 * 86400 { return "\(Int(interval / (7 * 86400)))w ago" }
        return "\(Int(interval / (30 * 86400)))mo ago"
    }
}
