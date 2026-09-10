import SwiftUI

/// Task browsing is independent of the editable creation form.
struct HouseholdTaskDetailView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var viewModel: HouseholdTaskDetailViewModel
    @State private var isVisible = false
    private let onEdit: @MainActor () -> Void

    init(homeId: String, taskId: String, onEdit: @escaping @MainActor () -> Void = {}) {
        _viewModel = State(initialValue: HouseholdTaskDetailViewModel(homeId: homeId, taskId: taskId))
        self.onEdit = onEdit
    }

    private func dueLabel(_ value: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let fractional = formatter.date(from: value)
        formatter.formatOptions = [.withInternetDateTime]
        guard let date = fractional ?? formatter.date(from: value) else { return "Date unavailable" }
        return date.formatted(date: .abbreviated, time: .shortened)
    }

    var body: some View {
        Group {
            if viewModel.loading {
                ProgressView("Loading task…")
            } else if let task = viewModel.task, viewModel.isCurrent {
                Form {
                    Section {
                        Text(task.title).font(.headline)
                        if let description = task.description, !description.isEmpty { Text(description) }
                    }
                    Section("Details") {
                        LabeledContent("Status", value: task.status.replacingOccurrences(of: "_", with: " ").capitalized)
                        if let priority = task.priority { LabeledContent("Priority", value: priority.capitalized) }
                        if let due = task.dueAt { LabeledContent("Due", value: dueLabel(due)) }
                        if let recurrence = HouseholdTasksListViewModel.humanRecurrence(rule: task.recurrenceRule) {
                            LabeledContent("Repeat preference", value: recurrence)
                            Text("New tasks are not created automatically.").font(.caption)
                        }
                    }
                    if task.capabilities?.canEdit == true {
                        Section {
                            Button("Edit task") { Task { await viewModel.edit(onAllowed: onEdit) } }
                                .disabled(viewModel.acting)
                        }
                    }
                }
                .refreshable { await viewModel.load() }
            } else {
                ContentUnavailableView {
                    Label("Task unavailable", systemImage: "checklist")
                } description: {
                    Text(viewModel.error ?? "This task is unavailable.")
                } actions: {
                    if viewModel.isCurrent {
                        Button("Retry") { resumeCurrentScreen() }
                    }
                }
            }
        }
        .navigationTitle("Task")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("householdTaskDetail")
        .onAppear { isVisible = true }
        .task { await viewModel.load() }
        .onChange(of: scenePhase) { _, phase in
            guard isVisible else { return }
            if phase == .active { resumeCurrentScreen() } else { viewModel.suspend() }
        }
        .onChange(of: viewModel.isCurrent) { _, _ in viewModel.accessChanged() }
        .onDisappear { isVisible = false
            viewModel.suspend()
        }
    }

    private func resumeCurrentScreen() {
        let revision = viewModel.activationRevision
        Task {
            guard isVisible, scenePhase == .active else { return }
            await viewModel.resume(ifCurrent: revision)
        }
    }
}
