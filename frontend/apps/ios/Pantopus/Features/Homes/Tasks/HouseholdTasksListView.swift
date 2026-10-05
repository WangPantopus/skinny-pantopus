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
    @Environment(\.scenePhase) private var scenePhase
    @State private var deleteTarget: DeleteTarget?
    @State private var isVisible = false
    @State private var hasAppeared = false

    init(viewModel: HouseholdTasksListViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    var body: some View {
        ListOfRowsView(dataSource: viewModel)
            .accessibilityIdentifier("householdTasksList")
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .onAppear { isVisible = true
                Analytics.track(.screenHouseholdTasksViewed)
                // The shared list owns its initial load. A retained navigation
                // destination must also refresh after editing/completing a task.
                if hasAppeared { resumeCurrentScreen() }
                hasAppeared = true
            }
            .onDisappear { isVisible = false
                viewModel.suspend()
                deleteTarget = nil
            }
            .onChange(of: scenePhase) { _, phase in
                guard isVisible else { return }
                if phase == .active {
                    resumeCurrentScreen()
                } else { viewModel.suspend()
                    deleteTarget = nil
                }
            }
            .onChange(of: viewModel.isCurrent) { _, _ in viewModel.accessChanged() }
            .onChange(of: viewModel.hasLoadedContent) { _, loaded in if !loaded { deleteTarget = nil } }
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
                "Task action unavailable",
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

    private func resumeCurrentScreen() {
        let revision = viewModel.activationRevision
        Task {
            guard isVisible, scenePhase == .active else { return }
            await viewModel.resume(ifCurrent: revision)
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
