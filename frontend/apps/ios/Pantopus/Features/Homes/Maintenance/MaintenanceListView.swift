//
//  MaintenanceListView.swift
//  Pantopus
//
//  T6.3b / P10 — Per-home Maintenance list. Thin wrapper around the
//  shared `ListOfRowsView` shell — all behaviour lives in
//  `MaintenanceListViewModel`. Wired to
//  `GET /api/homes/:id/maintenance` (route `backend/routes/home.js`).
//

import SwiftUI

struct MaintenanceListView: View {
    @State private var viewModel: MaintenanceListViewModel

    init(viewModel: MaintenanceListViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    var body: some View {
        ListOfRowsView(dataSource: viewModel)
            .accessibilityIdentifier("maintenanceList")
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .onAppear { Analytics.track(.screenHomeMaintenanceViewed) }
            // Someone changed this Home (`sync:changed`) or the socket came back: re-check the open log,
            // the rows staying on screen meanwhile (Instant Screens).
            .refreshesOnStoreChange(affects: { $0.names(topic: ScreenTopic.home(viewModel.homeId), kind: .homes) }, perform: {
                await viewModel.load()
            })
    }
}

#Preview {
    NavigationStack {
        MaintenanceListView(viewModel: MaintenanceListViewModel(homeId: "preview"))
    }
}
