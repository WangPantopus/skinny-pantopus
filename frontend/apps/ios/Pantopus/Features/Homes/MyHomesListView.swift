//
//  MyHomesListView.swift
//  Pantopus
//
//  Concrete List-of-Rows screen backed by `MyHomesListViewModel`.
//

import SwiftUI

/// `GET /api/homes/my-homes` wrapped in the List-of-Rows archetype.
/// Rows whose `can_delete_home` flag is set expose a kebab that opens the
/// destructive "Delete home" confirm (`DELETE /api/homes/:id`).
struct MyHomesListView: View {
    @State private var viewModel: MyHomesListViewModel
    @State private var deleteTarget: DeleteTarget?

    init(viewModel: MyHomesListViewModel = MyHomesListViewModel()) {
        _viewModel = State(initialValue: viewModel)
    }

    var body: some View {
        ListOfRowsView(dataSource: viewModel)
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .accessibilityIdentifier("myHomesList")
            .onAppear { Analytics.track(.screenMyHomesViewed) }
            .onChange(of: viewModel.pendingEvent) { _, event in
                handle(event)
            }
            .confirmationDialog(
                "Delete home",
                isPresented: Binding(
                    get: { deleteTarget != nil },
                    set: { if !$0 { deleteTarget = nil } }
                ),
                titleVisibility: .visible,
                presenting: deleteTarget
            ) { target in
                Button("Delete", role: .destructive) {
                    Task { await viewModel.deleteHome(homeId: target.homeId) }
                    deleteTarget = nil
                }
                .accessibilityIdentifier("myHomesList_deleteConfirm")
                Button("Cancel", role: .cancel) { deleteTarget = nil }
            } message: { target in
                Text(
                    "Are you sure you want to permanently delete “\(target.name)”? "
                        + "This removes it for all members."
                )
            }
            .alert(
                "Couldn’t delete home",
                isPresented: Binding(
                    get: { viewModel.actionError != nil },
                    set: { if !$0 { viewModel.actionError = nil } }
                )
            ) {
                Button("OK", role: .cancel) { viewModel.actionError = nil }
            } message: {
                Text(viewModel.actionError ?? "")
            }
    }

    private func handle(_ event: MyHomesListEvent?) {
        guard let event else { return }
        switch event {
        case let .confirmDelete(homeId, name):
            deleteTarget = DeleteTarget(homeId: homeId, name: name)
        }
        viewModel.pendingEvent = nil
    }

    private struct DeleteTarget: Identifiable, Equatable {
        let homeId: String
        let name: String
        var id: String {
            homeId
        }
    }
}

#Preview {
    NavigationStack { MyHomesListView() }
}
