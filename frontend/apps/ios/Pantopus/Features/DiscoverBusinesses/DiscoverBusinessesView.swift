//
//  DiscoverBusinessesView.swift
//  Pantopus
//
//  T5.4.2 — Discover businesses. Thin wrapper around `ListOfRowsView`.
//  The shell renders the back chevron, centered "Discover businesses"
//  title, trailing `sliders-horizontal` action, the search bar, the
//  category chip strip, and the category-grouped section cards.
//

import SwiftUI

public struct DiscoverBusinessesView: View {
    @State private var viewModel: DiscoverBusinessesViewModel

    public init(viewModel: DiscoverBusinessesViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        ListOfRowsView(dataSource: viewModel)
            .accessibilityIdentifier("discoverBusinesses")
            .sheet(
                isPresented: Binding(
                    get: { viewModel.isFilterSheetPresented },
                    set: { viewModel.setFilterSheetPresented($0) }
                )
            ) {
                BusinessFilterSheet(
                    initialFilters: viewModel.filters,
                    onApply: { viewModel.applyFilters($0) },
                    onClose: { viewModel.setFilterSheetPresented(false) }
                )
            }
    }
}

#Preview {
    NavigationStack {
        DiscoverBusinessesView(viewModel: DiscoverBusinessesViewModel())
    }
}
