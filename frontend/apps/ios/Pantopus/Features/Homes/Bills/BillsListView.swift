//
//  BillsListView.swift
//  Pantopus
//
//  Concrete List-of-Rows screen backed by `BillsListViewModel`. Wired
//  to `GET /api/homes/:id/bills` (route `backend/routes/home.js:4506`).
//

import SwiftUI

struct BillsListView: View {
    @State private var viewModel: BillsListViewModel

    init(viewModel: BillsListViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    var body: some View {
        ListOfRowsView(dataSource: viewModel)
            .accessibilityIdentifier("billsList")
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .onAppear { Analytics.track(.screenBillsViewed) }
    }
}

#Preview {
    NavigationStack {
        BillsListView(viewModel: BillsListViewModel(homeId: "preview"))
    }
}
