//
//  VaultListView.swift
//  Pantopus
//
//  T6.5e (P19.5) — Mailbox Vault list-of-rows surface. Personal pillar
//  (sky blue) — not scoped to a home. Renders the `VaultListViewModel`
//  through the shared `ListOfRowsView` shell so the standard chrome
//  (top bar + search + offline banner + FAB + Loading / Empty / Error
//  states) all come for free.
//

import SwiftUI

struct VaultListView: View {
    @State private var viewModel: VaultListViewModel

    init(viewModel: VaultListViewModel = VaultListViewModel()) {
        _viewModel = State(initialValue: viewModel)
    }

    var body: some View {
        ListOfRowsView(dataSource: viewModel)
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .accessibilityIdentifier("vaultList")
            .sensitiveScreen()
    }
}

#Preview {
    NavigationStack { VaultListView() }
}
