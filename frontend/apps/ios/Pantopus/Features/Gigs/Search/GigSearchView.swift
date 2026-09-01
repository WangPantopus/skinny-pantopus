//
//  GigSearchView.swift
//  Pantopus
//
//  Gig Search surface (P4.4). Built on the shared `SearchListShell`: the
//  search field lives in the shell header, the category-filter chip strip
//  sits in the shell's `filters` slot (above the results), and results
//  reuse the feed's `GigRow`. Reached from the Gigs feed search bar.
//

import SwiftUI

/// Keyword search over open gigs, refined by the category chips.
public struct GigSearchView: View {
    @State private var viewModel: GigSearchViewModel
    private let onOpenGig: @MainActor (String) -> Void
    private let onBack: @MainActor () -> Void

    init(
        viewModel: GigSearchViewModel = GigSearchViewModel(),
        onOpenGig: @escaping @MainActor (String) -> Void = { _ in },
        onBack: @escaping @MainActor () -> Void = {}
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onOpenGig = onOpenGig
        self.onBack = onBack
    }

    public var body: some View {
        SearchListShell(
            placeholder: "Search gigs, skills, neighborhoods…",
            query: Binding(
                get: { viewModel.query },
                set: { newValue in
                    viewModel.query = newValue
                    viewModel.scheduleSearch()
                }
            ),
            results: viewModel.results,
            isLoading: viewModel.isLoading,
            filters: AnyView(
                GigsCategoryChipRow(active: viewModel.activeCategory) { category in
                    Task { await viewModel.selectCategory(category) }
                }
            ),
            emptyState: viewModel.emptyStateContent,
            row: { content in
                Button {
                    onOpenGig(content.id)
                } label: {
                    GigRow(content: content)
                        .padding(.horizontal, Spacing.s3)
                        .padding(.vertical, Spacing.s1)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("gigsRow_\(content.id)")
            },
            onCancel: onBack
        )
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        // The shell paints its own header (back chevron + field); hide the
        // system bar so there's no double chrome.
        .toolbar(.hidden, for: .navigationBar)
        .accessibilityIdentifier("gigSearch")
    }
}

#Preview {
    GigSearchView()
}
