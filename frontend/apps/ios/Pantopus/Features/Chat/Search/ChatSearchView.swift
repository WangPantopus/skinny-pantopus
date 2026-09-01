//
//  ChatSearchView.swift
//  Pantopus
//
//  P4.3 — Chat Search surface, built on the shared `SearchListShell`.
//  Searches conversation names + message bodies; each result row shows
//  the matched conversation with a snippet that highlights the query
//  term. Tapping a row opens the conversation, scrolled to the matched
//  message when the hit came from a message body.
//

import SwiftUI

/// Chat Search screen — the Inbox tab's `.search` destination.
public struct ChatSearchView: View {
    @State private var viewModel: ChatSearchViewModel

    init(viewModel: ChatSearchViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        SearchListShell(
            placeholder: "Search people and messages",
            query: Binding(
                get: { viewModel.query },
                set: { viewModel.setQuery($0) }
            ),
            results: viewModel.results,
            isLoading: viewModel.isLoading,
            emptyState: viewModel.emptyState,
            row: { result in
                ChatSearchResultRow(result: result, onOpen: viewModel.onOpenResult)
            },
            onCancel: { viewModel.onCancel() }
        )
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .accessibilityIdentifier("chatSearch")
    }
}

// MARK: - Result row

private struct ChatSearchResultRow: View {
    let result: ChatSearchResult
    let onOpen: @Sendable (ChatSearchResult) -> Void

    var body: some View {
        Button { onOpen(result) } label: {
            HStack(alignment: .center, spacing: Spacing.s3) {
                avatar
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(ChatSearchText.highlighted(result.displayName, query: result.query))
                            .font(.system(size: 14.5, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                            .lineLimit(1)
                        if let chip = result.identityChip {
                            SearchIdentityChip(chip: chip)
                        }
                        Spacer(minLength: Spacing.s0)
                    }
                    Text(ChatSearchText.highlighted(result.snippet, query: result.query))
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: Spacing.s0)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
            .frame(minHeight: 56)
            .background(Theme.Color.appSurface)
            .overlay(alignment: .bottom) {
                Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityHint(
            result.matchedMessageId != nil
                ? "Opens the conversation at the matching message"
                : "Opens the conversation"
        )
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("chatSearchResult_\(result.conversationId)")
    }

    private var avatar: some View {
        ZStack(alignment: .bottomTrailing) {
            ZStack {
                Circle().fill(Theme.Color.appBorderStrong)
                Text(result.initials)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(width: 40, height: 40)
            if result.verified {
                Icon(.check, size: 8, strokeWidth: 3.5, color: Theme.Color.appTextInverse)
                    .frame(width: 15, height: 15)
                    .background(Theme.Color.primary600)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                    .offset(x: 1, y: 1)
            }
        }
        .frame(width: 42, height: 42)
        .accessibilityHidden(true)
    }

    private var accessibilityLabel: String {
        var parts: [String] = [result.displayName]
        if let chip = result.identityChip { parts.append(chip.label) }
        if result.verified { parts.append("verified") }
        parts.append(result.snippet)
        return parts.joined(separator: ". ")
    }
}

// MARK: - Identity chip

private struct SearchIdentityChip: View {
    let chip: ConversationIdentityChip

    var body: some View {
        HStack(spacing: 3) {
            Icon(icon, size: 8, strokeWidth: 2.6, color: foreground)
            Text(chip.label.uppercased())
                .font(.system(size: 9, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(foreground)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 1)
        .background(background)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
    }

    private var icon: PantopusIcon {
        switch chip {
        case .business: .shoppingBag
        case .home: .home
        }
    }

    private var foreground: Color {
        switch chip {
        case .business: Theme.Color.business
        case .home: Theme.Color.home
        }
    }

    private var background: Color {
        switch chip {
        case .business: Theme.Color.businessBg
        case .home: Theme.Color.homeBg
        }
    }
}
