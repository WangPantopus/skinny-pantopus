//
//  ChatSearchViewModel.swift
//  Pantopus
//
//  P4.3 — Backs the Chat Search surface. The backend exposes no
//  message-search endpoint, so search runs client-side: on first
//  appearance we fetch the unified conversation list and, in parallel,
//  the most-recent page of messages for each conversation, then build an
//  in-memory index. Every keystroke filters that index locally — instant,
//  no per-keystroke network.
//
//  Indexing the same most-recent page the conversation screen loads on
//  open is deliberate: it guarantees any matched message id is present in
//  the conversation's first page, so "scroll to the matching message"
//  always resolves without extra pagination.
//

import Foundation
import Logging
import Observation

/// View-model for the Chat Search screen.
@Observable
@MainActor
public final class ChatSearchViewModel {
    /// Live query — the view binds the search field to this through
    /// `setQuery(_:)` so each edit re-filters the index synchronously.
    public private(set) var query: String = ""

    /// Filtered results for the current query. Empty while the query is
    /// blank or while the index is still loading.
    public private(set) var results: [ChatSearchResult] = []

    /// True until the index finishes building. Drives the shell's
    /// typing-shimmer when the user types before indexing completes.
    public private(set) var isLoading: Bool = true

    /// No-results payload for the shell's empty phase.
    let emptyState = EmptyStateContent(
        icon: .search,
        headline: "No matches",
        subcopy: "Try a name or a word from a message."
    )

    /// Open a tapped result — wired by `InboxTabRoot` to push the
    /// conversation (scrolled to the matched message when present).
    let onOpenResult: @Sendable (ChatSearchResult) -> Void
    /// Pop the search surface — wired to the shell's back control.
    let onCancel: @Sendable () -> Void

    private let api: APIClient
    private let logger = Logger(label: "app.pantopus.ios.ChatSearch")
    private var index: [IndexedConversation] = []
    private var didLoad = false

    init(
        api: APIClient = .shared,
        onOpenResult: @escaping @Sendable (ChatSearchResult) -> Void = { _ in },
        onCancel: @escaping @Sendable () -> Void = {}
    ) {
        self.api = api
        self.onOpenResult = onOpenResult
        self.onCancel = onCancel
    }

    // MARK: - Public API

    /// Build the search index once, then filter for whatever the user has
    /// already typed.
    public func load() async {
        guard !didLoad else { return }
        didLoad = true
        await buildIndex()
        isLoading = false
        recompute()
    }

    /// Update the query and re-filter. Wired to the shell's field binding
    /// and clear button.
    public func setQuery(_ value: String) {
        query = value
        recompute()
    }

    // MARK: - Filtering

    private func recompute() {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            results = []
            return
        }
        // Index not ready yet — leave results empty so the shell keeps
        // shimmering instead of flashing "no matches".
        guard !isLoading else { return }
        results = search(trimmed)
    }

    private func search(_ query: String) -> [ChatSearchResult] {
        var out: [ChatSearchResult] = []
        for entry in index {
            let nameMatches = ChatSearchText.matches(entry.displayName, query: query)
            // Messages arrive newest-first, so the first match is the most
            // recent one — the message we scroll to.
            let bodyMatch = entry.messages.first { message in
                guard let text = message.messageText, !text.isEmpty else { return false }
                return ChatSearchText.matches(text, query: query)
            }

            let snippet: String
            let matchedMessageId: String?
            if let bodyMatch, let text = bodyMatch.messageText {
                snippet = ChatSearchText.snippet(from: text, matching: query)
                matchedMessageId = bodyMatch.id
            } else if nameMatches {
                snippet = entry.lastPreview
                matchedMessageId = nil
            } else {
                continue
            }

            out.append(ChatSearchResult(
                conversationId: entry.id,
                kind: entry.kind,
                displayName: entry.displayName,
                initials: entry.initials,
                identityChip: entry.identityChip,
                verified: entry.verified,
                snippet: snippet,
                matchedMessageId: matchedMessageId,
                query: query
            ))
        }
        return out
    }

    // MARK: - Index

    private func buildIndex() async {
        guard let response: UnifiedConversationsResponse =
            try? await api.request(ChatEndpoints.unifiedConversations())
        else {
            logger.warning("Chat-search index: conversation list fetch failed")
            index = []
            return
        }

        let conversations = response.conversations.map(Self.meta(from:))
        let api = api
        var messagesById: [String: [ChatMessageDTO]] = [:]

        await withTaskGroup(of: (String, [ChatMessageDTO]).self) { group in
            for conversation in conversations {
                let id = conversation.id
                let isRoom = conversation.kind == .group
                group.addTask {
                    let endpoint = isRoom
                        ? ChatEndpoints.roomMessages(roomId: id)
                        : ChatEndpoints.conversationMessages(otherUserId: id)
                    let response: ChatMessagesResponse? = try? await api.request(endpoint)
                    return (id, response?.messages ?? [])
                }
            }
            for await (id, messages) in group {
                messagesById[id] = messages
            }
        }

        index = conversations.map { conversation in
            IndexedConversation(
                id: conversation.id,
                kind: conversation.kind,
                displayName: conversation.displayName,
                initials: conversation.initials,
                identityChip: conversation.identityChip,
                verified: conversation.verified,
                lastPreview: conversation.lastPreview,
                messages: messagesById[conversation.id] ?? []
            )
        }
    }

    // MARK: - Projection

    private static func meta(from dto: UnifiedConversation) -> IndexedConversation {
        let kind: ChatSearchResult.Kind = dto.kind == .room ? .group : .dm
        let displayName = dto.name?.nilIfEmpty ?? defaultName(for: dto)
        let lastPreview = dto.lastMessagePreview?.nilIfEmpty ?? defaultPreview(for: dto)
        return IndexedConversation(
            id: dto.id,
            kind: kind,
            displayName: displayName,
            initials: initials(from: displayName),
            identityChip: identityChip(for: dto),
            verified: dto.isVerified ?? false,
            lastPreview: lastPreview,
            messages: []
        )
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
        case .room: "Group"
        case .conversation: "Pantopus user"
        }
    }

    private static func defaultPreview(for dto: UnifiedConversation) -> String {
        switch dto.kind {
        case .room: "No messages yet"
        case .conversation: "Start the conversation"
        }
    }

    private static func initials(from name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        let result = parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
        return result.isEmpty ? "?" : result
    }
}

/// One conversation's searchable record — identity metadata plus the
/// most-recent page of messages.
private struct IndexedConversation {
    let id: String
    let kind: ChatSearchResult.Kind
    let displayName: String
    let initials: String
    let identityChip: ConversationIdentityChip?
    let verified: Bool
    let lastPreview: String
    let messages: [ChatMessageDTO]
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
