//
//  ChatListView.swift
//  Pantopus
//
//  Chat list (Inbox tab) entry point. Three frames: loading shimmer,
//  empty (verified-floor reassurance), populated. Underline filter
//  tabs (not pills). Compose FAB / new-message intent surfaced as a
//  top-bar pencil button + empty-state CTA. Row tap → conversation
//  detail (T2.2 placeholder).
//

import SwiftUI

/// Chat list screen.
public struct ChatListView: View {
    @State private var viewModel: ChatListViewModel
    private let onOpenConversation: @MainActor (ConversationRowContent) -> Void
    private let onCompose: @MainActor () -> Void
    private let onOpenSearch: @MainActor () -> Void

    init(
        viewModel: ChatListViewModel = ChatListViewModel(),
        onOpenConversation: @escaping @MainActor (ConversationRowContent) -> Void = { _ in },
        onCompose: @escaping @MainActor () -> Void = {},
        onOpenSearch: @escaping @MainActor () -> Void = {}
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onOpenConversation = onOpenConversation
        self.onCompose = onCompose
        self.onOpenSearch = onOpenSearch
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            ChatListTopBar(onCompose: onCompose)
            ChatListSearchBar(skeleton: viewModel.state.isLoading) {
                onOpenSearch()
            }
            ChatListFilterTabs(
                active: viewModel.activeFilter,
                unreadByFilter: viewModel.unreadByFilter,
                skeleton: viewModel.state.isLoading
            ) { viewModel.selectFilter($0) }
            content
        }
        .background(Theme.Color.appSurface)
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .onDisappear { viewModel.teardown() }
        .accessibilityIdentifier("chatList")
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading: loadingFrame
        case .empty: emptyFrame
        case let .loaded(rows): populatedFrame(rows)
        case let .error(message): errorFrame(message)
        }
    }

    private var loadingFrame: some View {
        ScrollView {
            VStack(spacing: Spacing.s0) {
                ForEach(0..<6, id: \.self) { _ in ChatListSkeletonRow() }
            }
        }
        .accessibilityIdentifier("chatListLoading")
    }

    private var emptyFrame: some View {
        VStack(spacing: 14) {
            Spacer()
            Icon(.send, size: 30, strokeWidth: 1.8, color: Theme.Color.primary600)
                .frame(width: 72, height: 72)
                .background(Theme.Color.primary50)
                .clipShape(Circle())
            Text("No conversations yet")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text("Message someone you've verified nearby.")
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 260)
            Button(action: onCompose) {
                HStack(spacing: Spacing.s2) {
                    Icon(.edit2, size: 15, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                    Text("New message")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .padding(.horizontal, 22)
                .frame(height: 44)
                .background(Theme.Color.primary600)
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("chatListNewMessage")
            HStack(spacing: Spacing.s2) {
                Icon(.shieldCheck, size: 13, color: Theme.Color.primary600)
                Text("Only verified neighbors can DM you")
                    .font(.system(size: 11.5, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Theme.Color.appSurfaceMuted)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .padding(.top, Spacing.s3)
            .accessibilityIdentifier("chatListVerifiedFloor")
            Spacer()
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("chatListEmpty")
    }

    private func populatedFrame(_ rows: [ConversationRowContent]) -> some View {
        ScrollView {
            LazyVStack(spacing: Spacing.s0) {
                ForEach(rows) { row in
                    if row.variant == .aiAssistant {
                        ConversationRow(content: row) { onOpenConversation(row) }
                    } else {
                        SwipeableConversationRow(
                            content: row,
                            onTap: { onOpenConversation(row) },
                            onMute: { viewModel.toggleMute(storageKey: row.storageKey) },
                            onHide: { viewModel.hideConversation(storageKey: row.storageKey) }
                        )
                    }
                }
            }
        }
        .refreshable { await viewModel.refresh() }
        .accessibilityIdentifier("chatListContent")
    }

    private func errorFrame(_ message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Spacer()
            Icon(.alertCircle, size: 40, color: Theme.Color.error)
            Text("Couldn't load chat")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button { Task { await viewModel.refresh() } } label: {
                Text("Try again")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, 22)
                    .frame(height: 44)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("chatListRetry")
            Spacer()
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("chatListError")
    }
}

private extension ChatListState {
    var isLoading: Bool {
        if case .loading = self { true } else { false }
    }
}

// MARK: - Top bar

private struct ChatListTopBar: View {
    let onCompose: @MainActor () -> Void

    var body: some View {
        HStack {
            Text("Chat")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Spacer()
            Button(action: onCompose) {
                Icon(.edit2, size: 20, color: Theme.Color.appText)
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("New message")
            .accessibilityIdentifier("chatListComposeButton")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, 10)
        .background(Theme.Color.appSurface)
    }
}

// MARK: - Search bar

private struct ChatListSearchBar: View {
    let skeleton: Bool
    let onTap: @MainActor () -> Void

    var body: some View {
        Group {
            if skeleton {
                Shimmer(height: 44, cornerRadius: Radii.md)
            } else {
                Button(action: onTap) {
                    HStack(spacing: 10) {
                        Icon(.search, size: 17, color: Theme.Color.appTextSecondary)
                        Text("Search people and messages")
                            .font(.system(size: 13.5, weight: .medium))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                        Spacer()
                    }
                    .padding(.horizontal, 14)
                    .frame(height: 44)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("chatListSearchButton")
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s1)
        .background(Theme.Color.appSurface)
    }
}

// MARK: - Filter tabs

private struct ChatListFilterTabs: View {
    let active: ChatFilter
    let unreadByFilter: [ChatFilter: Int]
    let skeleton: Bool
    let onSelect: @MainActor (ChatFilter) -> Void

    var body: some View {
        HStack(spacing: Spacing.s0) {
            if skeleton {
                ForEach(0..<4, id: \.self) { _ in
                    Shimmer(width: 48, height: 14, cornerRadius: Radii.xs)
                        .padding(.trailing, Spacing.s6)
                        .padding(.bottom, Spacing.s3)
                }
            } else {
                ForEach(ChatFilter.allCases, id: \.rawValue) { filter in
                    tabButton(filter: filter)
                        .padding(.trailing, Spacing.s6)
                }
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.leading, Spacing.s4)
        .padding(.top, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }

    private func tabButton(filter: ChatFilter) -> some View {
        Button { onSelect(filter) } label: {
            HStack(spacing: 6) {
                Text(filter.label)
                    .font(.system(size: 13.5, weight: filter == active ? .bold : .medium))
                    .foregroundStyle(filter == active ? Theme.Color.appText : Theme.Color.appTextSecondary)
                if let badge = unreadByFilter[filter], badge > 0, filter == .unread {
                    Text("\(badge)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(filter == active ? Theme.Color.appTextInverse : Theme.Color.appTextSecondary)
                        .padding(.horizontal, 5)
                        .frame(minWidth: 18, minHeight: 16)
                        .background(filter == active ? Theme.Color.primary600 : Theme.Color.appSurfaceSunken)
                        .clipShape(Capsule())
                }
            }
            .padding(.bottom, Spacing.s3)
            .overlay(alignment: .bottom) {
                if filter == active {
                    Rectangle()
                        .fill(Theme.Color.primary600)
                        .frame(height: 2)
                        .clipShape(RoundedRectangle(cornerRadius: 2, style: .continuous))
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(filter.label)
        .accessibilityAddTraits(filter == active ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("chatListFilter_\(filter.rawValue)")
    }
}

// MARK: - Skeleton row

private struct ChatListSkeletonRow: View {
    var body: some View {
        HStack(spacing: Spacing.s3) {
            Shimmer(width: 44, height: 44, cornerRadius: 22)
            VStack(alignment: .leading, spacing: 7) {
                Shimmer(width: 140, height: 12, cornerRadius: Radii.xs)
                Shimmer(width: 220, height: 10, cornerRadius: Radii.xs)
            }
            Spacer(minLength: Spacing.s0)
            Shimmer(width: 26, height: 9, cornerRadius: Radii.xs)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, 14)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
        .accessibilityHidden(true)
    }
}
