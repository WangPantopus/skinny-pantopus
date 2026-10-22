//
//  ReceivedInvoicesView.swift
//  Pantopus
//
//  Concrete List-of-Rows screen backed by `ReceivedInvoicesViewModel`: the
//  invoices businesses sent you, opened from the Wallet's Invoices row.
//

import SwiftUI

struct ReceivedInvoicesView: View {
    @State private var viewModel: ReceivedInvoicesViewModel

    init(viewModel: ReceivedInvoicesViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    var body: some View {
        ListOfRowsView(dataSource: viewModel)
            .accessibilityIdentifier("receivedInvoices")
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
    }
}

#Preview {
    NavigationStack {
        ReceivedInvoicesView(viewModel: ReceivedInvoicesViewModel())
    }
}
