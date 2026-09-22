//
//  PackagesListView.swift
//  Pantopus
//
//  T6.3d (P14) — Concrete List-of-Rows screen backed by
//  `PackagesListViewModel`. Wired to `GET /api/homes/:id/packages`
//  (route `backend/routes/home.js:4673`).
//

import SwiftUI

public struct PackagesListView: View {
    @State private var viewModel: PackagesListViewModel
    /// `.task` loads once per view identity; a return from the detail or
    /// log screens must show the status those screens just changed.
    @State private var hasAppeared = false

    public init(viewModel: PackagesListViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        ListOfRowsView(dataSource: viewModel)
            .accessibilityIdentifier("packagesList")
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .onAppear {
                Analytics.track(.screenPackagesViewed)
                if hasAppeared { Task { await viewModel.reloadAfterMutation() } }
                hasAppeared = true
            }
    }
}

#Preview {
    NavigationStack {
        PackagesListView(viewModel: PackagesListViewModel(homeId: "preview"))
    }
}
