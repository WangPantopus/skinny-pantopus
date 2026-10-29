//
//  MailboxSearchView.swift
//  Pantopus
//
//  P4.2 — Mailbox Search surface. Hosts the shared `SearchListShell`
//  (P4.1); each match is drawn as the piece it is, as in the Mailbox. The
//  server searches all of this person's mail.
//

import SwiftUI

struct MailboxSearchView: View {
    @State private var viewModel: MailboxSearchViewModel

    init(viewModel: MailboxSearchViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    var body: some View {
        SearchListShell(
            placeholder: "Search mail",
            query: Binding(
                get: { viewModel.query },
                set: { viewModel.query = $0 }
            ),
            results: viewModel.results,
            isLoading: viewModel.isLoading,
            emptyState: viewModel.emptyState,
            row: { mail in
                let piece = viewModel.piece(for: mail)
                Button { viewModel.open(mail) } label: {
                    VStack(alignment: .leading, spacing: 6) {
                        MailPieceView(model: piece)
                        Text(piece.meta.line)
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.Color.appTextMuted)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(piece.spokenWithArrival)
                .accessibilityAddTraits(.isButton)
                .accessibilityIdentifier("mailboxSearchResult.\(mail.id)")
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s2)
                if mail.id == viewModel.results.last?.id, viewModel.hasMore {
                    MailSearchPageControls(
                        isLoading: viewModel.isLoadingMore,
                        hasMore: viewModel.hasMore,
                        failure: viewModel.failureMessage,
                        action: viewModel.loadMore
                    )
                    .accessibilityIdentifier("mailboxSearchMore")
                    .padding(.horizontal, Spacing.s4)
                }
            },
            onCancel: { viewModel.onCancel() }
        )
        // The shell paints its own header (back chevron + field); hide the
        // system bar so there's no double chrome.
        .toolbar(.hidden, for: .navigationBar)
        .accessibilityIdentifier("mailboxSearch")
        .task { await viewModel.load() }
    }
}

/// The next search page, with a retry that keeps the matches already on screen.
struct MailSearchPageControls: View {
    let isLoading: Bool
    let hasMore: Bool
    let failure: String?
    let action: () -> Void

    var body: some View {
        if hasMore || failure != nil {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                if let failure {
                    Text(failure)
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Button(isLoading ? "Loading…" : failure == nil ? "Show more" : "Try again", action: action)
                    .font(.system(size: 14, weight: .semibold))
                    .frame(minHeight: 44)
                    .disabled(isLoading)
            }
        }
    }
}

#Preview {
    NavigationStack {
        MailboxSearchView(viewModel: MailboxSearchViewModel())
    }
}
