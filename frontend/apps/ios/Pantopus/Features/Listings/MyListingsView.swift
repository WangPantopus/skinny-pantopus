//
//  MyListingsView.swift
//  Pantopus
//
//  T6.3f / P14 — concrete List-of-Rows screen backed by
//  `MyListingsViewModel`. The view stays thin; the projection lives in
//  the ViewModel.
//

import SwiftUI

/// `GET /api/listings/me` wrapped in the List-of-Rows archetype.
struct MyListingsView: View {
    @State private var viewModel: MyListingsViewModel

    init(viewModel: MyListingsViewModel = MyListingsViewModel()) {
        _viewModel = State(initialValue: viewModel)
    }

    var body: some View {
        ListOfRowsView(dataSource: viewModel)
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .onAppear { Analytics.track(.screenMyListingsViewed) }
    }
}

#Preview {
    NavigationStack { MyListingsView() }
}
