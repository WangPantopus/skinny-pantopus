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
    public var refreshFailureMessage: String?
    public private(set) var isLoadingMore = false
    public var nextPageCursor: String? {
        inboxResponse?.hasMore == true ? inboxResponse?.nextCursor : nil
    }

    public private(set) var activeFilter: ChatFilter = .all

    public private(set) var emptyFilter: ChatFilter?

    /// The Unread filter's badge; other filter badges remain hidden.
    public private(set) var unreadByFilter: [ChatFilter: Int] = [:]

    private let api: APIClient
    private let store: ScreenStore
    private let socket: SocketClient
    private let preferences: ChatConversationPreferences
    private let logger = Logger(label: "app.pantopus.ios.ChatList")
    private var allRows: [ConversationRowContent] = []
    private var activityDates: [String: Date] = [:]
    private var seenMessageIds: Set<String> = []
    private var recentMessageIds: [String] = []
    private var refreshTask: Task<Void, Never>?
    private var inboxResponse: UnifiedConversationsResponse?
    private var fetchGeneration = 0
    private var activeFetchGeneration: Int?

    private var serverTotalUnread: Int = 0
    private var serverTotalUnmutedUnread: Int?
    private var pendingMuteKeys: Set<String> = []
    private var preferencesTask: Task<Void, Never>?
    private var hiddenKeys: Set<String> = []
    private var mutedKeys: Set<String> = []
    var aiRow: ConversationRowContent {
        Self.assistantRow
    }

    private var badgeTask: Task<Void, Never>?
    private var messageTask: Task<Void, Never>?

    init(
        api: APIClient = .shared,
        socket: SocketClient = .shared,
        preferences: ChatConversationPreferences = .shared
    ) {
        self.api = api
        store = ScreenStore.store(for: api)
        self.socket = socket
        self.preferences = preferences
        if let copy = store.peek(ChatEndpoints.unifiedConversations(), as: UnifiedConversationsResponse.self)?.value {
            apply(copy, stats: store.peek(ChatEndpoints.stats(), as: ChatStatsResponse.self)?.value.stats)
        }
    }

    /// Restore offline navigation, then reconcile every return to the inbox.
    public func load() async {
        subscribeToSockets()
        if allRows.isEmpty, let scope = localCacheScope {
            let session = AuthManager.shared.requestSessionGeneration
            let cached = await ChatLocalStore.shared.inbox(scope: scope)
            guard session == AuthManager.shared.requestSessionGeneration, !Task.isCancelled else { return }
            if allRows.isEmpty, let cached { apply(cached.response, stats: cached.stats) }
        }
        await fetch(force: false)
    }

    private var localCacheScope: String? {
        guard api === APIClient.shared, case let .signedIn(user) = AuthManager.shared.state else { return nil }
        return ChatLocalStore.scope(server: api.apiBaseURL.absoluteString, account: user.id)
    }

    public func refresh() async {
        await fetch(force: true)
    }

    /// Older inbox rows are fetched when their existing list reaches the end.
    public func loadMore() async {
        guard activeFetchGeneration == nil, !isLoadingMore, let cursor = nextPageCursor, let current = inboxResponse else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        let generation = fetchGeneration
        let session = AuthManager.shared.requestSessionGeneration
        let scope = localCacheScope
        let checkpoint = ChatLocalStore.shared.inboxCheckpoint
        do {
            let page: UnifiedConversationsResponse = try await api.request(ChatEndpoints.unifiedConversations(before: cursor))
            guard generation == fetchGeneration, session == AuthManager.shared.requestSessionGeneration, !Task.isCancelled else { return }
            guard page.hasMore != true || (page.nextCursor != nil && page.nextCursor != cursor) else { throw APIError.invalidResponse }
            let combined = Self.appending(page, to: current)
            // A socket may have updated a displayed preview while the older
            // page was in flight. Appending must not restore its old snapshot.
            let displayed = Dictionary(uniqueKeysWithValues: allRows.map { ($0.storageKey, $0) })
            let displayedDates = activityDates
            apply(combined, stats: nil)
            allRows = allRows.map { displayed[$0.storageKey] ?? $0 }
            activityDates.merge(displayedDates) { _, displayed in displayed }
            applyFilter()
            publishBadgeCount()
            if let scope {
                await ChatLocalStore.shared.saveInbox(
                    ChatInboxMemory(response: combined, stats: nil, confirmedAt: Date()), scope: scope, checkpoint: checkpoint
                )
            }
        } catch {
            guard generation == fetchGeneration, session == AuthManager.shared.requestSessionGeneration, !Task.isCancelled else { return }
            if ScreenStore.isRefusal(error) {
                if let scope { ChatLocalStore.shared.removeInbox(scope: scope) }
                inboxResponse = nil
                allRows = []
                state = .error(message: "Couldn't load conversations.")
                return
            }
            refreshFailureMessage = "Couldn't load more conversations. Try again."
        }
    }

    /// Several message/participant changes can describe the same inbox update.
    /// Keep the immediate socket patch visible and coalesce their canonical read.
    public func refreshAfterChange() {
        guard refreshTask == nil else { return }
        refreshTask = Task { [weak self] in
            do { try await Task.sleep(nanoseconds: 500_000_000) } catch { return }
            guard let self else { return }
            await fetch(force: false)
            refreshTask = nil
        }
    }

    public func selectFilter(_ filter: ChatFilter) {
        guard filter != activeFilter else { return }
        activeFilter = filter
        applyFilter()
    }

    public func teardown() {
        fetchGeneration += 1
        badgeTask?.cancel()
        messageTask?.cancel()
        badgeTask = nil
        messageTask = nil
        preferencesTask?.cancel()
        preferencesTask = nil
        refreshTask?.cancel()
        refreshTask = nil
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

    /// Mute is confirmed by the server so other devices and push agree.
    public func toggleMute(storageKey: String) {
        guard storageKey != aiRow.storageKey,
              let row = allRows.first(where: { $0.storageKey == storageKey }),
              pendingMuteKeys.insert(storageKey).inserted else { return }
        let session = AuthManager.shared.requestSessionGeneration
        preferences.beginUserChange(storageKey)
        Task { [self] in
            defer {
                pendingMuteKeys.remove(storageKey)
                preferences.endUserChange(storageKey)
            }
            await preferences.waitForMigration(storageKey)
            guard session == AuthManager.shared.requestSessionGeneration else { return }
            do {
                let response = try await api.request(
                    ChatEndpoints.setPreferences(
                        conversationId: row.id,
                        isRoom: storageKey.hasPrefix("room:"),
                        notificationsEnabled: row.isMuted
                    ),
                    as: ChatPreferencesResponse.self
                )
                guard session == AuthManager.shared.requestSessionGeneration else { return }
                preferences.confirmServerMute(storageKey)
                preferences.setMuted(storageKey, muted: !response.notificationsEnabled)
                mutedKeys = preferences.mutedKeys()
                decorateRowsWithMuteState()
                applyFilter()
                store.markStale(topics: [ScreenTopic.chats])
                await fetch(force: true)
                await ChatBadgeStore.shared.refresh()
            } catch {
                guard session == AuthManager.shared.requestSessionGeneration else { return }
                refreshFailureMessage = "Couldn't change notifications. Try again."
            }
        }
    }

    private func fetch(force: Bool) async {
        fetchGeneration += 1
        let generation = fetchGeneration
        activeFetchGeneration = generation
        defer { if activeFetchGeneration == generation { activeFetchGeneration = nil } }
        let session = AuthManager.shared.requestSessionGeneration
        let cacheCheckpoint = ChatLocalStore.shared.inboxCheckpoint
        let scope = localCacheScope
        let minimumCount = inboxResponse?.conversations.count ?? 0
        async let conversationsTask: (response: UnifiedConversationsResponse, confirmedAt: Date)? = optional(
            refuseInbox: true,
            isCurrent: {
                generation == self.fetchGeneration && session == AuthManager.shared.requestSessionGeneration
            },
            {
                let snapshot = try await self.store.load(
                    ChatEndpoints.unifiedConversations(),
                    as: UnifiedConversationsResponse.self,
                    kind: .messagesList,
                    topics: [ScreenTopic.chats],
                    force: force
                )
                return (snapshot.value, snapshot.fetchedAt)
            }
        )
        async let statsTask: ChatStatsResponse? = optional {
            try await self.store.load(
                ChatEndpoints.stats(),
                as: ChatStatsResponse.self,
                kind: .messagesList,
                topics: [ScreenTopic.chats],
                force: force
            ).value
        }
        let fetched = await conversationsTask
        guard generation == fetchGeneration, session == AuthManager.shared.requestSessionGeneration, !Task.isCancelled else { return }
        guard var response = fetched else {
            switch state {
            case .loaded, .empty:
                // Keep the list on screen; a failed refresh only toasts.
                refreshFailureMessage = "Couldn't refresh conversations."
            case .loading, .error:
                state = .error(message: "Couldn't load conversations.")
            }
            return
        }
        let stats = await statsTask?.stats
        guard generation == fetchGeneration, session == AuthManager.shared.requestSessionGeneration, !Task.isCancelled else { return }
        do {
            response.response = try await Self.revalidatedInbox(response.response, minimumCount: minimumCount, api: api) {
                generation == self.fetchGeneration && session == AuthManager.shared.requestSessionGeneration && !Task.isCancelled
            }
        } catch {
            guard generation == fetchGeneration, session == AuthManager.shared.requestSessionGeneration, !Task.isCancelled else { return }
            if ScreenStore.isRefusal(error) {
                if let scope { ChatLocalStore.shared.removeInbox(scope: scope) }
                inboxResponse = nil
                allRows = []
                state = .error(message: "Couldn't load conversations.")
            } else {
                refreshFailureMessage = "Couldn't refresh conversations."
            }
            return
        }
        guard generation == fetchGeneration, session == AuthManager.shared.requestSessionGeneration, !Task.isCancelled else { return }
        apply(response.response, stats: stats)
        if let scope {
            await ChatLocalStore.shared.saveInbox(
                ChatInboxMemory(response: response.response, stats: stats, confirmedAt: response.confirmedAt),
                scope: scope,
                checkpoint: cacheCheckpoint
            )
        }
    }

    private func apply(_ response: UnifiedConversationsResponse, stats: ChatStatsResponse.Stats?) {
        inboxResponse = response
        preferences.applyServer(response.conversations)
        loadPreferences()
        serverTotalUnmutedUnread = stats?.totalUnmutedUnread ?? response.totalUnmutedUnread
        serverTotalUnread = stats?.totalUnread ?? response.totalUnread ?? Self.rowsUnreadTotal(from: response.conversations)
        activityDates = Dictionary(uniqueKeysWithValues: response.conversations.map {
            ($0.id, $0.lastMessageAt.flatMap(Self.parseISO) ?? .distantPast)
        })
        allRows = response.conversations.map { Self.project($0, mutedKeys: mutedKeys) }
        updateUnreadByFilter()
        applyFilter()
        publishBadgeCount()
    }

    private func loadPreferences() {
        hiddenKeys = preferences.hiddenKeys()
        mutedKeys = preferences.mutedKeys()
    }

    private func updateUnreadByFilter() {
        let adjustedUnread = serverTotalUnmutedUnread ?? ChatUnreadBadgeMath.adjustedTotal(
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
            totalUnmutedUnread: serverTotalUnmutedUnread,
            rows: allRows
        )
    }

    private func optional<T: Sendable>(
        refuseInbox: Bool = false,
        isCurrent: (@MainActor @Sendable () -> Bool)? = nil,
        _ operation: @Sendable () async throws -> T
    ) async -> T? {
        do {
            return try await operation()
        } catch {
            guard isCurrent?() != false else { return nil }
            logger.warning("Chat-list fetch failed: \(error)")
            if refuseInbox, ScreenStore.isRefusal(error) {
                if let scope = localCacheScope { ChatLocalStore.shared.removeInbox(scope: scope) }
                inboxResponse = nil
                allRows = []
                state = .error(message: "Couldn't load conversations.")
            }
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
        let rows = [aiRow] + filtered
        // Pinned-first ordering — AI is always pinned; user-pinned
        // conversations come next; rest follow.
        let pinnedFirst = rows.sorted { lhs, rhs in
            if lhs.id == aiRow.id { return rhs.id != aiRow.id }
            if rhs.id == aiRow.id { return false }
            if lhs.pinned != rhs.pinned { return lhs.pinned }
            return (activityDates[lhs.id] ?? .distantPast, lhs.id) > (activityDates[rhs.id] ?? .distantPast, rhs.id)
        }
        if filtered.isEmpty, activeFilter == .all {
            emptyFilter = nil
            state = .empty
        } else {
            // A filter with no matches keeps the AI row and says what it
            // filtered for, instead of claiming there are no conversations.
            emptyFilter = filtered.isEmpty ? activeFilter : nil
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
        if preferencesTask == nil {
            preferencesTask = Task { [weak self] in
                guard let self else { return }
                for await _ in socket.events(named: "chat:preferences_changed", as: JSONValue.self) {
                    store.markStale(topics: [ScreenTopic.chats])
                    refreshAfterChange()
                }
            }
        }
        if badgeTask == nil {
            badgeTask = Task { [weak self] in
                guard let self else { return }
                let stream = socket.events(named: "badge:update", as: ChatBadgeUpdate.self)
                for await update in stream {
                    serverTotalUnread = update.totalUnread
                    serverTotalUnmutedUnread = update.totalUnmutedUnread
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
        if let id = event.id {
            guard seenMessageIds.insert(id).inserted else { return }
            recentMessageIds.append(id)
            if recentMessageIds.count > 1000 { seenMessageIds.remove(recentMessageIds.removeFirst()) }
        }
        // Match a person thread by other-user-id, or a group/home by room id.
        // Unknown conversations require a canonical inbox read.
        // The row is patched here; the stored list re-checks on the next visit.
        store.markStale(topics: [ScreenTopic.chats])
        let targetId = event.otherUserId ?? event.roomId
        guard let index = allRows.firstIndex(where: { $0.id == targetId }) else {
            refreshAfterChange()
            return
        }
        let original = allRows[index]
        let nextUnread = event.unreadFor ?? (original.unread + 1)
        let eventDate = event.createdAt.flatMap(Self.parseISO) ?? Date()
        let isLatest = eventDate >= (activityDates[targetId] ?? .distantPast)
        let preview = isLatest ? (event.preview ?? original.preview) : original.preview
        let time = isLatest ? (event.createdAt.flatMap(Self.relative(timestamp:)) ?? "now") : original.timeLabel
        if isLatest { activityDates[targetId] = eventDate }
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
        serverTotalUnread = max(0, serverTotalUnread + nextUnread - original.unread)
        applyFilter()
        publishBadgeCount()
    }

    private static let activityISOStyle = Date.ISO8601FormatStyle(includingFractionalSeconds: true)

    private static let activityPlainISOFormatter = ISO8601DateFormatter()

    static func parseISO(_ raw: String) -> Date? {
        (try? activityISOStyle.parse(raw)) ?? activityPlainISOFormatter.date(from: raw)
    }
}
