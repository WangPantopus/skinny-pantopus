//
//  DocumentSearchView.swift
//  Pantopus
//
//  P4.5 — Document Search surface. Hosts the shared `SearchListShell`
//  (P4.1) and renders each match with the reused Documents row
//  (`RowView`) plus inline matched-tag chips. Replaces the
//  "Search documents" placeholder pushed from `DocumentsView`.
//

import SwiftUI

struct DocumentSearchView: View {
    @State private var viewModel: DocumentSearchViewModel

    init(viewModel: DocumentSearchViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    var body: some View {
        SearchListShell(
            placeholder: "Search documents",
            query: Binding(
                get: { viewModel.query },
                set: { viewModel.query = $0 }
            ),
            results: viewModel.results,
            isLoading: viewModel.isLoading,
            emptyState: viewModel.emptyState,
            row: { dto in
                RowView(row: viewModel.rowModel(for: dto))
                    .padding(.horizontal, Spacing.s4)
                    .padding(.vertical, Spacing.s1)
            },
            onCancel: { viewModel.onCancel() }
        )
        // The shell paints its own header (back chevron + field); hide the
        // system bar so there's no double chrome.
        .toolbar(.hidden, for: .navigationBar)
        .accessibilityIdentifier("documentSearch")
        .task { await viewModel.load() }
    }
}

#Preview {
    NavigationStack {
        DocumentSearchView(viewModel: DocumentSearchViewModel(homeId: "preview"))
    }
}
