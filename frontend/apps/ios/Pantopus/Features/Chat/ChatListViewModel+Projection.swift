import Foundation

extension ChatListViewModel {
    static func rowsUnreadTotal(from conversations: [UnifiedConversation]) -> Int {
        conversations.reduce(0) { $0 + $1.totalUnread }
    }

    static let assistantRow: ConversationRowContent = .init(
        id: "ai_assistant",
        variant: .aiAssistant,
        displayName: "Pantopus AI",
        initials: "AI",
        avatarURL: nil,
        identityChip: nil,
        verified: false,
        preview: "Pickup days, alerts, posts and more.",
        timeLabel: "now",
        unread: 0,
        pinned: true,
        topicKinds: [],
        storageKey: "ai_assistant"
    )

    /// Revalidate the previously displayed depth before replacing its rows.
    /// Do not splice an old tail onto a new authorized head: revoked entries
    /// must disappear, and the cursor must match the rows actually retained.
    static func revalidatedInbox(
        _ head: UnifiedConversationsResponse, minimumCount: Int, api: APIClient, isCurrent: () -> Bool
    ) async throws -> UnifiedConversationsResponse {
        var result = head
        guard result.hasMore != true || result.nextCursor != nil else { throw APIError.invalidResponse }
        var cursors: Set<String> = []
        while result.conversations.count < minimumCount, result.hasMore == true {
            guard isCurrent() else { throw CancellationError() }
            guard let cursor = result.nextCursor, cursors.insert(cursor).inserted else { throw APIError.invalidResponse }
            let page: UnifiedConversationsResponse = try await api.request(ChatEndpoints.unifiedConversations(before: cursor))
            guard isCurrent() else { throw CancellationError() }
            guard page.hasMore != true || (page.nextCursor != nil && page.nextCursor != cursor) else { throw APIError.invalidResponse }
            result = appending(page, to: result)
        }
        return result
    }

    static func appending(_ page: UnifiedConversationsResponse, to current: UnifiedConversationsResponse) -> UnifiedConversationsResponse {
        var seen = Set(current.conversations.map { "\($0.kind):\($0.id)" })
        let appended = page.conversations.filter { seen.insert("\($0.kind):\($0.id)").inserted }
        return UnifiedConversationsResponse(
            conversations: current.conversations + appended,
            total: page.total,
            totalUnread: page.totalUnread,
            totalUnmutedUnread: page.totalUnmutedUnread,
            hasMore: page.hasMore,
            nextCursor: page.nextCursor
        )
    }

    // MARK: - Projection

    static func project(
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
            // Launch cut #3 (Marketplace): no listing topic pills; the
            // direct-message thread itself stays.
            topics: dto.topics.filter { LaunchFeatures.marketplace || !["listing", "marketplace"].contains($0.topicType) }.map {
                ConversationRowTopic(id: $0.id, title: $0.title, topicType: $0.topicType)
            },
            gigId: dto.gigId,
            storageKey: storageKey,
            isMuted: mutedKeys.contains(storageKey)
        )
    }

    static func variant(for dto: UnifiedConversation) -> ConversationRowVariant {
        switch dto.kind {
        case .conversation:
            .dm
        case .room:
            .group(extraAvatars: [], extraCount: 0)
        }
    }

    static func identityChip(for dto: UnifiedConversation) -> ConversationIdentityChip? {
        switch (dto.kind, dto.identityKind, dto.roomType) {
        case (.conversation, "business"?, _): .business
        case (.conversation, "home"?, _): .home
        case (.room, _, "home"?): .home
        default: nil
        }
    }

    static func defaultName(for dto: UnifiedConversation) -> String {
        switch dto.kind {
        case .room: dto.name ?? "Group"
        case .conversation: dto.name ?? "Pantopus user"
        }
    }

    static func defaultPreview(for dto: UnifiedConversation) -> String {
        switch dto.kind {
        case .conversation: "Start the conversation"
        case .room: "No messages yet"
        }
    }

    static func initials(from name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        let result = parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
        return result.isEmpty ? "?" : result
    }

    static func relative(timestamp: String) -> String {
        guard let date = parseISO(timestamp) else {
            return timestamp
        }
        // A message can be a hair ahead of the phone's clock; "in 0 sec." reads as a bug.
        if Date().timeIntervalSince(date) < 60 { return "Just now" }
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
