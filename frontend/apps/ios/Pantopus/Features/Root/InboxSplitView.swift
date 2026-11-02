//
//  InboxSplitView.swift
//  Pantopus
//
//  Messages side by side on a wide screen (founder, 2026-11-01). Open, the
//  iPhone Duo's inner screen is regular width: the chat list sits on the
//  leading side and the open conversation beside it, as Mail does there,
//  in Apple's split view (`SideBySideSplit`). Both columns show the route
//  stack the narrow layout pushes (a search in the list's place, everything
//  else in the conversation column), so folding or unfolding keeps what is
//  open: closed, the same routes are the one stack again. Phones never come
//  here.
//

import SwiftUI

/// The Inbox tab's two columns: the chat list (or chat search) and the conversation column.
struct InboxSplitView<List: View, Destination: View>: View {
    @Binding var path: RouteStack<InboxRoute>
    /// The chat list, telling whether it has no conversations.
    @ViewBuilder let list: (@escaping @MainActor (Bool) -> Void) -> List
    @ViewBuilder let destination: (InboxRoute) -> Destination
    /// For what the empty conversation column says.
    @State private var listIsEmpty = false

    var body: some View {
        SideBySideSplit(leadingWidth: .chatList) {
            leadingColumn
        } detail: {
            RouteColumn(path: $path, skipping: searching ? 1 : 0) { first in
                if let first {
                    destination(first)
                        .readableColumn()
                        .environment(\.chatConversationShowsBack, false)
                } else {
                    ChatConversationPlaceholder(listIsEmpty: listIsEmpty)
                }
            } destination: { route in
                destination(route)
            }
        }
    }

    private var searching: Bool {
        path.routes.first == .search
    }

    /// Search covers the list instead of replacing it, so the list keeps its place for when search closes.
    private var leadingColumn: some View {
        ZStack {
            list { listIsEmpty = $0 }
                .environment(\.selectedConversationRowId, selectedRowId)
                .opacity(searching ? 0 : 1)
                .allowsHitTesting(!searching)
                .accessibilityHidden(searching)
            if searching {
                destination(.search)
            }
        }
    }

    /// The row of the conversation open in the column.
    private var selectedRowId: String? {
        guard case let .conversation(conversation)? = path.routes.dropFirst(searching ? 1 : 0).first else { return nil }
        switch conversation.mode {
        case .ai: return ChatListViewModel.assistantRow.id
        case let .room(id): return id
        case let .person(otherUserId): return otherUserId
        }
    }
}

extension RouteStack where Route == InboxRoute {
    /// Opens a conversation or New message: on top of the stack, or side by side in the conversation column's
    /// place, a search in the list's place kept.
    mutating func open(_ route: InboxRoute, sideBySide: Bool) {
        guard sideBySide else {
            append(route)
            return
        }
        replace(with: (routes.first == .search ? [.search] : []) + [route])
    }

    /// Chat search: on top of the stack, or side by side in the list's place, the conversation column kept.
    mutating func openSearch(sideBySide: Bool) {
        guard sideBySide else {
            append(.search)
            return
        }
        guard routes.first != .search else { return }
        replace(with: [.search] + routes)
    }

    /// Search's Cancel: off the top of the stack, or side by side back to the list, the conversation column kept.
    mutating func closeSearch(sideBySide: Bool) {
        guard sideBySide else {
            removeLast()
            return
        }
        replace(with: Array(routes.drop { $0 == .search }))
    }
}
