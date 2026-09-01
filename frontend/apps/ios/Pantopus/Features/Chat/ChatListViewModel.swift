//
//  ChatListViewModel.swift
//  Pantopus
//
//  Loads `GET /api/chat/unified-conversations` + `/stats` and reacts to
//  socket events (`badge:update`, `message:new`). Projects the
//  hetero DTO into a homogeneous list of `ConversationRowContent` plus
//  a synthetic, pinned "Pantopus AI" assistant row.
//

import Foundation
import Logging
import Observation

// swiftlint:disable type_body_length

/// View-model for the Chat List (Inbox tab) screen.
@Observable
@MainActor
public final class ChatListViewModel {
    /// Current render state.
    public private(set) var state: ChatListState = .loading

    /// Active filter tab.
    public private(set) var activeFilter: ChatFilter = .all

    /// Unread counts for the filter-tab badges. The `unread` tab uses
    /// `unread` from this map; other tabs hide their badge.
    public private(set) var unreadByFilter: [ChatFilter: Int] = [:]

    private let api: APIClient
    private let socket: SocketClient
    private let preferences: ChatConversationPreferences
    private let logger = Logger(label: "app.pantopus.ios.ChatList")
    private var allRows: [ConversationRowContent] = []
    private var serverTotalUnread: Int = 0
    private var hiddenKeys: Set<String> = []
    private var mutedKeys: Set<String> = []
    /// Always-pinned synthetic AI assistant row.
    private let aiRow: ConversationRowContent = .init(
        id: "ai_assistant",
        variant: .aiAssistant,
        displayName: "Pantopus AI",
        initials: "AI",
        avatarURL: nil,
        identityChip: nil,
        verified: false,
        preview: "Summaries, drafts, neighborhood help.",
        timeLabel: "now",
        unread: 0,
        pinned: true,
        topicKinds: [],
        storageKey: "ai_assistant"
    )

    private var badgeTask: Task<Void, Never>?
    private var messageTask: Task<Void, Never>?

    init(
        api: APIClient = .shared,
        socket: SocketClient = .shared,
        preferences: ChatConversationPreferences = .shared
    ) {
        self.api = api
        self.socket = socket
        self.preferences = preferences
    }

    // No `deinit { cancel }` — Swift 6's strict concurrency disallows
    // touching `@MainActor`-isolated stored properties from the
    // nonisolated `deinit`. The view calls `teardown()` from
    // `.onDisappear`, and each task captures `[weak self]` so it
    // exits cleanly once the VM is deallocated.

    // MARK: - Public API

    /// First-time load — no-op when we already have content.
    public func load() async {
        if case .loaded = state { return }
        await fetch()
        subscribeToSockets()
    }

    /// Pull-to-refresh / retry.
    public func refresh() async {
        await fetch()
    }

    /// Tap a filter tab. Pure UI — no refetch.
    public func selectFilter(_ filter: ChatFilter) {
        guard filter != activeFilter else { return }
        activeFilter = filter
        applyFilter()
    }

    /// Tear down socket subscriptions when the view disappears.
    public func teardown() {
        badgeTask?.cancel()
        messageTask?.cancel()
        badgeTask = nil
        messageTask = nil
    }

    /// Swipe action — remove the conversation from the list until new unread arrives.
    public func hideConversation(storageKey: String) {
        guard storageKey != aiRow.storageKey else { return }
        let unreadBaseline = allRows.first { $0.storageKey == storageKey }?.unread ?? 0
        preferences.hide(storageKey, unreadBaseline: unreadBaseline)
        hiddenKeys.insert(storageKey)
        applyFilter()
        publishBadgeCount()
    }

    /// Swipe action — exclude this conversation's unread from the tab badge.
    public func toggleMute(storageKey: String) {
        guard storageKey != aiRow.storageKey else { return }
        preferences.toggleMute(storageKey)
        mutedKeys = preferences.mutedKeys()
        decorateRowsWithMuteState()
        applyFilter()
        publishBadgeCount()
    }

    // MARK: - Fetch

    private func fetch() async {
        async let conversationsTask: UnifiedConversationsResponse? = optional {
            try await self.api.request(ChatEndpoints.unifiedConversations())
        }
        async let statsTask: ChatStatsResponse? = optional {
            try await self.api.request(ChatEndpoints.stats())
        }
        guard let response = await conversationsTask else {
            state = .error(message: "Couldn't load conversations.")
            return
        }
        let stats = await statsTask?.stats
        loadPreferences()
        serverTotalUnread = stats?.totalUnread ?? response.totalUnread ?? rowsUnreadTotal(from: response.conversations)
        allRows = response.conversations.map { Self.project($0, mutedKeys: mutedKeys) }
        updateUnreadByFilter()
        applyFilter()
        publishBadgeCount()
    }

    private func loadPreferences() {
        hiddenKeys = preferences.hiddenKeys()
        mutedKeys = preferences.mutedKeys()
    }

    private func rowsUnreadTotal(from conversations: [UnifiedConversation]) -> Int {
        conversations.reduce(0) { $0 + $1.totalUnread }
    }

    private func updateUnreadByFilter() {
        let adjustedUnread = ChatUnreadBadgeMath.adjustedTotal(
            serverTotal: serverTotalUnread,
            rows: allRows,
            mutedKeys: mutedKeys
        )
        unreadByFilter = [
            .all: 0,
            .unread: adjustedUnread,
            .gigs: allRows.filter { $0.topicKinds.contains("gig") }.count,
            .market: allRows.filter { $0.topicKinds.contains("marketplace") }.count
        ]
    }

    private func publishBadgeCount() {
        ChatBadgeStore.shared.applyListSnapshot(
            totalUnread: serverTotalUnread,
            rows: allRows
        )
    }

    private func optional<T: Sendable>(_ operation: @Sendable () async throws -> T) async -> T? {
        do {
            return try await operation()
        } catch {
            logger.warning("Chat-list fetch failed: \(error)")
            return nil
        }
    }

    private func applyFilter() {
        autoUnhideConversationsWithUnread()
        let visibleRows = allRows.filter { !hiddenKeys.contains($0.storageKey) }
        let filtered: [ConversationRowContent] =
            switch activeFilter {
            case .all: visibleRows
            case .unread: visibleRows.filter { $0.unread > 0 }
            case .gigs: visibleRows.filter { $0.topicKinds.contains("gig") }
            case .market: visibleRows.filter { $0.topicKinds.contains("marketplace") }
            }
        // Pin synthetic AI row on top of every filter. The verified
        // floor is enforced by the empty-state copy + the absence of
        // any unverified rows in `allRows` (the backend serializer
        // already excludes unverified DMs).
        let rows = [aiRow] + filtered
        // Pinned-first ordering — AI is always pinned; user-pinned
        // conversations come next; rest follow.
        let pinnedFirst = rows.sorted { lhs, rhs in
            if lhs.pinned == rhs.pinned { return false }
            return lhs.pinned && !rhs.pinned
        }
        if filtered.isEmpty {
            state = .empty
        } else {
            state = .loaded(rows: pinnedFirst)
        }
        updateUnreadByFilter()
    }

    private func autoUnhideConversationsWithUnread() {
        let toUnhide =
            allRows
                .filter { preferences.shouldAutoUnhide(key: $0.storageKey, currentUnread: $0.unread) }
                .map(\.storageKey)
        guard !toUnhide.isEmpty else { return }
        preferences.unhide(toUnhide)
        hiddenKeys.subtract(toUnhide)
    }

    private func decorateRowsWithMuteState() {
        allRows = allRows.map { row in
            ConversationRowContent(
                id: row.id,
                variant: row.variant,
                displayName: row.displayName,
                initials: row.initials,
                avatarURL: row.avatarURL,
                identityChip: row.identityChip,
                verified: row.verified,
                preview: row.preview,
                timeLabel: row.timeLabel,
                unread: row.unread,
                pinned: row.pinned,
                topicKinds: row.topicKinds,
                topics: row.topics,
                gigId: row.gigId,
                storageKey: row.storageKey,
                isMuted: mutedKeys.contains(row.storageKey)
            )
        }
    }

    // MARK: - Realtime

    private func subscribeToSockets() {
        if badgeTask == nil {
            badgeTask = Task { [weak self] in
                guard let self else { return }
                let stream = socket.events(named: "badge:update", as: ChatBadgeUpdate.self)
                for await update in stream {
                    serverTotalUnread = update.totalUnread
                    updateUnreadByFilter()
                    publishBadgeCount()
                }
            }
        }
        if messageTask == nil {
            messageTask = Task { [weak self] in
                guard let self else { return }
                let stream = socket.events(named: "message:new", as: ChatMessageEvent.self)
                for await event in stream {
                    handleMessage(event)
                }
            }
        }
    }

    private func handleMessage(_ event: ChatMessageEvent) {
        // Best-effort: bump the matching row's preview + timestamp +
        // unread count. We match by conversation other-user-id (DM /
        // gig merged rows) or by room id (group / home). When neither
        // matches, trigger a full refetch so the new conversation
        // appears.
        let targetId = event.otherUserId ?? event.roomId
        guard let index = allRows.firstIndex(where: { $0.id == targetId }) else {
            Task { await self.refresh() }
            return
        }
        let original = allRows[index]
        let nextUnread = event.unreadFor ?? (original.unread + 1)
        let preview = event.preview ?? original.preview
        let time = event.createdAt.flatMap(Self.relative(timestamp:)) ?? "now"
        let updated = ConversationRowContent(
            id: original.id,
            variant: original.variant,
            displayName: original.displayName,
            initials: original.initials,
            avatarURL: original.avatarURL,
            identityChip: original.identityChip,
            verified: original.verified,
            preview: preview,
            timeLabel: time,
            unread: nextUnread,
            pinned: original.pinned,
            topicKinds: original.topicKinds,
            topics: original.topics,
            gigId: original.gigId,
            storageKey: original.storageKey,
            isMuted: original.isMuted
        )
        allRows[index] = updated
        if nextUnread > original.unread {
            serverTotalUnread += nextUnread - original.unread
        }
        applyFilter()
        publishBadgeCount()
    }

    // MARK: - Projection

    private static func project(
        _ dto: UnifiedConversation,
        mutedKeys: Set<String>
    ) -> ConversationRowContent {
        let unread = dto.totalUnread
        let preview = dto.lastMessagePreview ?? defaultPreview(for: dto)
        let time = dto.lastMessageAt.flatMap(relative(timestamp:)) ?? ""
        let identityChip = identityChip(for: dto)
        let displayName = dto.name?.nilIfEmpty ?? defaultName(for: dto)
        let storageKey =
            switch dto.kind {
            case .conversation: ChatConversationPreferences.personKey(dto.id)
            case .room: ChatConversationPreferences.roomKey(dto.id)
            }
        return ConversationRowContent(
            id: dto.id,
            variant: variant(for: dto),
            displayName: displayName,
            initials: initials(from: displayName),
            avatarURL: dto.avatarURL,
            identityChip: identityChip,
            verified: dto.isVerified ?? false,
            preview: preview,
            timeLabel: time,
            unread: unread,
            pinned: false,
            topicKinds: Set(dto.topicKinds),
            topics: dto.topics.map {
                ConversationRowTopic(id: $0.id, title: $0.title, topicType: $0.topicType)
            },
            gigId: dto.gigId,
            storageKey: storageKey,
            isMuted: mutedKeys.contains(storageKey)
        )
    }

    private static func variant(for dto: UnifiedConversation) -> ConversationRowVariant {
        switch dto.kind {
        case .conversation:
            .dm
        case .room:
            .group(extraAvatars: [], extraCount: 0)
        }
    }

    private static func identityChip(for dto: UnifiedConversation) -> ConversationIdentityChip? {
        switch (dto.kind, dto.identityKind, dto.roomType) {
        case (.conversation, "business"?, _): .business
        case (.conversation, "home"?, _): .home
        case (.room, _, "home"?): .home
        default: nil
        }
    }

    private static func defaultName(for dto: UnifiedConversation) -> String {
        switch dto.kind {
        case .room: dto.name ?? "Group"
        case .conversation: dto.name ?? "Pantopus user"
        }
    }

    private static func defaultPreview(for dto: UnifiedConversation) -> String {
        switch dto.kind {
        case .conversation: "Start the conversation"
        case .room: "No messages yet"
        }
    }

    private static func initials(from name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        let result = parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
        return result.isEmpty ? "?" : result
    }

    private static func relative(timestamp: String) -> String {
        let parsers: [ISO8601DateFormatter] = {
            let withFraction = ISO8601DateFormatter()
            withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            let plain = ISO8601DateFormatter()
            return [withFraction, plain]
        }()
        guard let date = parsers.lazy.compactMap({ $0.date(from: timestamp) }).first else {
            return timestamp
        }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
