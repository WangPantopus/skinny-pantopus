import Foundation
import Observation

/// The existing search screen reads authorized server results without downloading
/// every conversation's history. Query and account generations reject late pages.
@Observable
@MainActor
public final class ChatSearchViewModel {
    public private(set) var query = ""
    public private(set) var results: [ChatSearchResult] = []
    public private(set) var isLoading = false
    public private(set) var isLoadingMore = false
    public var failureMessage: String?
    public private(set) var searchFailed = false
    public var hasMore: Bool {
        namesCursor != nil || messagesCursor != nil
    }

    var emptyState: EmptyStateContent {
        EmptyStateContent(
            icon: .search,
            headline: searchFailed ? "Search unavailable" : "No matches",
            subcopy: searchFailed ? "Try again when your connection is available." : "Try a name or a word from a message."
        )
    }

    let onOpenResult: @Sendable (ChatSearchResult) -> Void
    let onCancel: @Sendable () -> Void
    private let api: APIClient
    private var queryTask: Task<Void, Never>?
    private var generation = 0
    private var namesCursor: String?
    private var messagesCursor: String?

    init(
        api: APIClient = .shared,
        onOpenResult: @escaping @Sendable (ChatSearchResult) -> Void = { _ in },
        onCancel: @escaping @Sendable () -> Void = {}
    ) {
        self.api = api
        self.onOpenResult = onOpenResult
        self.onCancel = onCancel
    }

    public func load() async {
        if !query.isEmpty, results.isEmpty, queryTask == nil { setQuery(query) }
    }

    public func setQuery(_ value: String) {
        query = String(value.prefix(200))
        queryTask?.cancel()
        generation += 1
        results = []
        namesCursor = nil
        messagesCursor = nil
        failureMessage = nil
        searchFailed = false
        isLoadingMore = false
        let text = query.trimmingCharacters(in: .whitespacesAndNewlines)
        isLoading = !text.isEmpty
        guard !text.isEmpty else { queryTask = nil
            return
        }
        let expected = generation
        queryTask = Task { [weak self] in
            do { try await Task.sleep(nanoseconds: 250_000_000) } catch { return }
            await self?.fetch(query: text, generation: expected, append: false)
        }
    }

    public func loadMore() async {
        guard hasMore, !isLoading, !isLoadingMore else { return }
        await fetch(query: query.trimmingCharacters(in: .whitespacesAndNewlines), generation: generation, append: true)
    }

    public func teardown() {
        queryTask?.cancel()
        queryTask = nil
        generation += 1
        isLoading = false
        isLoadingMore = false
    }

    private func fetch(query text: String, generation expected: Int, append: Bool) async {
        let session = AuthManager.shared.requestSessionGeneration
        if append { isLoadingMore = true }
        defer {
            if expected == generation {
                isLoading = false
                isLoadingMore = false
                queryTask = nil
            }
        }
        do {
            async let names = fetchNames(query: text, enabled: !append || namesCursor != nil)
            async let bodies = fetchMessages(query: text, enabled: !append || messagesCursor != nil)
            let (namePage, messagePage) = try await (names, bodies)
            guard expected == generation, session == AuthManager.shared.requestSessionGeneration, !Task.isCancelled else { return }
            if let page = namePage, page.hasMore == true,
               page.nextCursor == nil || page.nextCursor == namesCursor { throw APIError.invalidResponse }
            if let page = messagePage, page.hasMore,
               page.nextCursor == nil || page.nextCursor == messagesCursor { throw APIError.invalidResponse }
            searchFailed = false
            var additions = (namePage?.conversations ?? []).map { Self.nameResult($0, query: text) }
            if let page = messagePage {
                additions.append(contentsOf: page.messages.compactMap { message in
                    guard let context = page.roomContexts[message.roomId] else { return nil }
                    return ChatSearchResult(
                        conversationId: context.conversationId,
                        kind: context.kind == "room" ? .group : .dm,
                        displayName: context.name,
                        initials: Self.initials(context.name),
                        identityChip: Self.identityChip(context.identity?.identityKind),
                        verified: context.identity?.verified ?? context.identity?.badges?.contains("verified_resident") ?? false,
                        snippet: ChatSearchText.snippet(from: message.messageText ?? "Attachment", matching: text),
                        matchedMessageId: message.id,
                        query: text
                    )
                })
            }
            var seen = Set(append ? results.map(\.id) : [])
            let unique = additions.filter { seen.insert($0.id).inserted }
            results = append ? results + unique : unique
            namesCursor = namePage?.hasMore == true ? namePage?.nextCursor : nil
            messagesCursor = messagePage?.hasMore == true ? messagePage?.nextCursor : nil
        } catch {
            guard expected == generation, session == AuthManager.shared.requestSessionGeneration, !Task.isCancelled else { return }
            failureMessage = "Couldn't search messages. Try again."
            searchFailed = true
        }
    }

    private func fetchNames(query: String, enabled: Bool) async throws -> UnifiedConversationsResponse? {
        guard enabled, query.count <= 160 else { return nil }
        return try await api.request(ChatEndpoints.unifiedConversations(before: namesCursor, query: query))
    }

    private func fetchMessages(query: String, enabled: Bool) async throws -> ChatSearchResponse? {
        guard enabled else { return nil }
        return try await api.request(ChatEndpoints.search(query: query, before: messagesCursor))
    }

    private static func nameResult(_ dto: UnifiedConversation, query: String) -> ChatSearchResult {
        let row = ChatListViewModel.project(dto, mutedKeys: [])
        return ChatSearchResult(
            conversationId: dto.id,
            kind: dto.kind == .room ? .group : .dm,
            displayName: row.displayName,
            initials: row.initials,
            identityChip: row.identityChip,
            verified: row.verified,
            snippet: row.preview,
            matchedMessageId: nil,
            query: query
        )
    }

    private static func initials(_ name: String) -> String {
        let value = name.split(separator: " ").prefix(2).compactMap { $0.first.map(String.init) }.joined().uppercased()
        return value.isEmpty ? "?" : value
    }

    private static func identityChip(_ kind: String?) -> ConversationIdentityChip? {
        switch kind {
        case "business": .business
        case "home": .home
        default: nil
        }
    }
}
