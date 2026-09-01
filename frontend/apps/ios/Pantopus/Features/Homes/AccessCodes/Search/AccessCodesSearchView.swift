//
//  AccessCodesSearchView.swift
//  Pantopus
//
//  P4.6 — Access codes search. Thin wrapper around the shared
//  `SearchListShell`: the shell owns the field, debounce, and the
//  recent / typing / results / empty phases; this view supplies the
//  filtered results and the per-row template (`ListRowCard` mirroring
//  the Access codes list row, with a drill-in chevron).
//

import SwiftUI

struct AccessCodesSearchView: View {
    @State private var viewModel: AccessCodesSearchViewModel

    init(viewModel: AccessCodesSearchViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    var body: some View {
        @Bindable var viewModel = viewModel
        SearchListShell(
            placeholder: "Search access codes",
            query: $viewModel.query,
            results: viewModel.results,
            isLoading: viewModel.isLoading,
            emptyState: EmptyStateContent(
                icon: .search,
                headline: "No matching codes",
                subcopy: "Try a different label or category, or check the spelling."
            ),
            row: { secret in
                ListRowCard(row: viewModel.rowModel(for: secret))
                    .padding(.horizontal, Spacing.s4)
                    .padding(.top, Spacing.s3)
            },
            onCancel: { viewModel.cancel() }
        )
        .toolbar(.hidden, for: .navigationBar)
        .accessibilityIdentifier("accessCodesSearch")
        .sensitiveScreen()
        .task { await viewModel.load() }
    }
}

#Preview {
    NavigationStack {
        AccessCodesSearchView(viewModel: AccessCodesSearchViewModel(homeId: "home_1"))
    }
}
