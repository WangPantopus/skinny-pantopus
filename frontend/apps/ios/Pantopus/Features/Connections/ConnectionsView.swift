//
//  ConnectionsView.swift
//  Pantopus
//
//  T5.2.3 — Connections. Thin wrapper around the shared `ListOfRowsView`.
//  The shell renders the back chevron, centered title, trailing
//  `user-plus` action, search bar, three tabs, and the row card body.
//

import SwiftUI

public struct ConnectionsView: View {
    @State private var viewModel: ConnectionsViewModel

    public init(viewModel: ConnectionsViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        ListOfRowsView(dataSource: viewModel)
            .accessibilityIdentifier("connections")
            .confirmationDialog(
                "Remove connection?",
                isPresented: Binding(
                    get: { viewModel.pendingRemoval != nil },
                    set: { presented in if !presented { viewModel.cancelRemoval() } }
                ),
                titleVisibility: .visible,
                presenting: viewModel.pendingRemoval
            ) { _ in
                Button("Remove", role: .destructive) {
                    Task { @MainActor in await viewModel.confirmRemoval() }
                }
                .accessibilityIdentifier("connections.removeConfirm")
                Button("Cancel", role: .cancel) { viewModel.cancelRemoval() }
                    .accessibilityIdentifier("connections.removeCancel")
            } message: { request in
                Text(
                    "\(request.displayName) will be removed from your connections. " +
                        "You can send a new request later."
                )
            }
    }
}

#Preview {
    NavigationStack {
        ConnectionsView(viewModel: ConnectionsViewModel())
    }
}
