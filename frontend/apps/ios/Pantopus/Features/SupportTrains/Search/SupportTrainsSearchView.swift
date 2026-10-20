//
//  SupportTrainsSearchView.swift
//  Pantopus
//
//  P4.6 — Support Trains search. Thin wrapper around the shared
//  `SearchListShell`: the shell owns the field, debounce, and the
//  recent / typing / results / empty phases; this view supplies the
//  filtered results and the per-row template (`ListRowCard`, the same
//  visual the Support Trains list renders).
//

import SwiftUI

public struct SupportTrainsSearchView: View {
    @State private var viewModel: SupportTrainsSearchViewModel

    public init(viewModel: SupportTrainsSearchViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        @Bindable var viewModel = viewModel
        SearchListShell(
            placeholder: "Search support trains",
            query: $viewModel.query,
            results: viewModel.results,
            isLoading: viewModel.isLoading,
            filters: viewModel.errorMessage.map { message in
                AnyView(RefreshNotice(text: message) {
                    Task { await viewModel.load() }
                })
            },
            emptyState: EmptyStateContent(
                icon: .search,
                headline: viewModel.errorMessage == nil ? "No matching trains" : "Search unavailable",
                subcopy: viewModel.errorMessage == nil
                    ? "Try a different name or train type, or check the spelling."
                    : "Retry above to load your support trains. Your search is kept."
            ),
            row: { train in
                ListRowCard(row: viewModel.rowModel(for: train))
                    .padding(.horizontal, Spacing.s4)
                    .padding(.top, Spacing.s3)
            },
            onCancel: { viewModel.cancel() }
        )
        .toolbar(.hidden, for: .navigationBar)
        .accessibilityIdentifier("supportTrainsSearch")
        .task { await viewModel.load() }
        .onReceive(NotificationCenter.default.publisher(for: .supportTrainDeleted)) { _ in
            Task { await viewModel.load() }
        }
    }
}

#Preview {
    NavigationStack {
        SupportTrainsSearchView(viewModel: SupportTrainsSearchViewModel())
    }
}
