//
//  NotificationsView.swift
//  Pantopus
//
//  T5.1 — Notifications V2. Thin wrapper around the shared
//  `ListOfRowsView`. The shell's built-in NavigationStack top bar
//  renders the back chevron, the centered title, and the "Mark all
//  read" text-button trailing action.
//

import SwiftUI

public struct NotificationsView: View {
    @State private var viewModel: NotificationsViewModel

    /// `onBack` is kept for source-compat with T4.1 call sites; the
    /// shared shell now uses NavigationStack's built-in back chevron.
    public init(
        viewModel: NotificationsViewModel,
        onBack _: @escaping @MainActor () -> Void = {}
    ) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        ListOfRowsView(dataSource: viewModel) {
            if viewModel.showsZoneStrip {
                NotificationsZoneStrip(
                    zones: viewModel.zoneOptions,
                    selected: viewModel.zone
                ) { zone in
                    viewModel.selectZone(zone)
                }
            }
        }
        .accessibilityIdentifier("notifications")
        .confirmationDialog(
            "Delete notification?",
            isPresented: Binding(
                get: { viewModel.pendingDelete != nil },
                set: { presented in if !presented { viewModel.cancelDelete() } }
            ),
            titleVisibility: .visible,
            presenting: viewModel.pendingDelete
        ) { _ in
            Button("Delete", role: .destructive) {
                Task { @MainActor in await viewModel.confirmDelete() }
            }
            .accessibilityIdentifier("notifications.deleteConfirm")
            Button("Cancel", role: .cancel) { viewModel.cancelDelete() }
                .accessibilityIdentifier("notifications.deleteCancel")
        } message: { request in
            Text("\u{201C}\(request.title)\u{201D} will be removed from your notifications.")
        }
    }
}

#Preview {
    NavigationStack {
        NotificationsView(viewModel: NotificationsViewModel())
    }
}
