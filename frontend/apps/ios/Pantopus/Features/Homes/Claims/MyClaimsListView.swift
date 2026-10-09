//
//  MyClaimsListView.swift
//  Pantopus
//
//  Concrete List-of-Rows screen backed by `MyClaimsListViewModel`.
//  Row taps route via the VM's `onOpenClaim` callback; the host
//  (HubTabRoot) currently pushes a placeholder for claim-detail until
//  the dedicated status screen is designed.
//

import SwiftUI

struct MyClaimsListView: View {
    @State private var viewModel: MyClaimsListViewModel

    init(viewModel: MyClaimsListViewModel = MyClaimsListViewModel()) {
        _viewModel = State(initialValue: viewModel)
    }

    var body: some View {
        ListOfRowsView(dataSource: viewModel)
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .onAppear { Analytics.track(.screenMyClaimsViewed) }
            // A claim was submitted, approved or rejected (`homes`): the open list re-reads.
            .refreshesOnStoreChange(affects: { $0.names(topic: ScreenTopic.homes, kind: .homes) }, perform: { await viewModel.load() })
    }
}

#Preview {
    NavigationStack { MyClaimsListView() }
}
