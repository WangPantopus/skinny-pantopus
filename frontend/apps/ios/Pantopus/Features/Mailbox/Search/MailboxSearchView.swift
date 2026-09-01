//
//  MailboxSearchView.swift
//  Pantopus
//
//  P4.2 — Mailbox Search surface. Hosts the shared `SearchListShell`
//  (P4.1) and renders each match with the reused Mailbox row (`RowView`).
//  Replaces the "Mail search" placeholder pushed from `MailboxListView`.
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
                RowView(row: viewModel.rowModel(for: mail))
                    .padding(.horizontal, Spacing.s4)
                    .padding(.vertical, Spacing.s1)
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

#Preview {
    NavigationStack {
        MailboxSearchView(viewModel: MailboxSearchViewModel())
    }
}
