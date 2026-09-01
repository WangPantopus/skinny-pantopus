//
//  HouseholdTasksListView.swift
//  Pantopus
//
//  T6.3c — Concrete List-of-Rows screen backed by
//  `HouseholdTasksListViewModel`. Wired to `GET /api/homes/:id/tasks`
//  (route `backend/routes/home.js:4170`).
//
//  Distinct from `MyTasksView` (T5.3.2) which lists the user's
//  posted-to-neighbours gigs reached via `me.gigs`.
//

import SwiftUI

struct HouseholdTasksListView: View {
    @State private var viewModel: HouseholdTasksListViewModel
    @State private var deleteTarget: DeleteTarget?

    init(viewModel: HouseholdTasksListViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    var body: some View {
        ListOfRowsView(dataSource: viewModel)
            .accessibilityIdentifier("householdTasksList")
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .onAppear { Analytics.track(.screenHouseholdTasksViewed) }
            .onChange(of: viewModel.pendingEvent) { _, event in
                handle(event)
            }
            .confirmationDialog(
                "Delete task",
                isPresented: Binding(
                    get: { deleteTarget != nil },
                    set: { if !$0 { deleteTarget = nil } }
                ),
                titleVisibility: .visible,
                presenting: deleteTarget
            ) { target in
                Button("Delete", role: .destructive) {
                    Task { await viewModel.deleteTask(taskId: target.taskId) }
                    deleteTarget = nil
                }
                .accessibilityIdentifier("householdTasksList_deleteConfirm")
                Button("Cancel", role: .cancel) { deleteTarget = nil }
            } message: { target in
                Text("Delete “\(target.title)”? This can’t be undone.")
            }
            .alert(
                "Couldn’t delete task",
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

    private func handle(_ event: HouseholdTasksListEvent?) {
        guard let event else { return }
        switch event {
        case let .confirmDelete(taskId, title):
            deleteTarget = DeleteTarget(taskId: taskId, title: title)
        }
        viewModel.pendingEvent = nil
    }

    private struct DeleteTarget: Identifiable, Equatable {
        let taskId: String
        let title: String
        var id: String {
            taskId
        }
    }
}

#Preview {
    NavigationStack {
        HouseholdTasksListView(viewModel: HouseholdTasksListViewModel(homeId: "preview"))
    }
}
