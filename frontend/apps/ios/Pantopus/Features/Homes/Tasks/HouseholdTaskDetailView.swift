import SwiftUI

/// Task browsing is independent of the editable creation form.
struct HouseholdTaskDetailView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var viewModel: HouseholdTaskDetailViewModel
    @State private var isVisible = false
    @State private var mediaModel: HomeTaskMediaViewModel?
    @State private var attachmentPresentation: AttachmentPresentation?
    @State private var recurrencePresentation: RecurrencePresentation?
    @State private var gigPresentation: GigPresentation?
    private let homeId: String
    private let taskId: String
    private let onEdit: @MainActor () -> Void

    init(
        homeId: String,
        taskId: String,
        viewModel: HouseholdTaskDetailViewModel? = nil,
        onEdit: @escaping @MainActor () -> Void = {}
    ) {
        _viewModel = State(initialValue: viewModel ?? HouseholdTaskDetailViewModel(homeId: homeId, taskId: taskId))
        self.onEdit = onEdit
        self.homeId = homeId
        self.taskId = taskId
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
        // Keep screen lifecycle callbacks on one container as its content changes.
        ZStack {
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
                        if let automatic = task.automaticRecurrence {
                            Text(automatic.label)
                        } else if let recurrence = HouseholdTasksListViewModel.humanRecurrence(rule: task.recurrenceRule) {
                            LabeledContent("Repeat preference", value: recurrence)
                            Text("Automatic repeats are off.").font(.caption)
                        }
                        if task.capabilities?.canComplete == true {
                            Button(task.status == "done" ? "Mark not done" : "Mark done") {
                                Task { await viewModel.toggleDone() }
                            }
                            .disabled(viewModel.acting)
                            .accessibilityIdentifier("householdTaskDetail.complete")
                        }
                    }
                    Section {
                        Button("Repeat schedule") {
                            guard viewModel.isCurrent, isVisible else { return }
                            recurrencePresentation = RecurrencePresentation(model: HomeTaskRecurrenceViewModel(
                                homeId: homeId,
                                taskId: taskId
                            ))
                        }.accessibilityIdentifier("householdTaskDetail.recurrence")
                        Button("Private attachments") {
                            guard viewModel.isCurrent, isVisible else { return }
                            if mediaModel == nil { mediaModel = HomeTaskMediaViewModel(homeId: homeId, taskId: taskId) }
                            if let mediaModel { attachmentPresentation = AttachmentPresentation(model: mediaModel) }
                        }
                        .accessibilityIdentifier("householdTaskDetail.attachments")
                    }
                    if task.capabilities?.canEdit == true {
                        Section {
                            // Launch cut #4 (Open gigs): publishing a household task as
                            // an open Gig is hidden; Edit task stays.
                            if LaunchFeatures.openGigs {
                                Button("Review Gig publication") {
                                    guard viewModel.isCurrent, isVisible else { return }
                                    gigPresentation = GigPresentation(model: HomeTaskGigViewModel(homeId: homeId, taskId: taskId))
                                }.disabled(viewModel.acting).accessibilityIdentifier("householdTaskDetail.gig")
                            }
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
        .sheet(item: $attachmentPresentation) { presentation in
            HomeTaskMediaView(model: presentation.model)
        }
        .sheet(item: $recurrencePresentation, onDismiss: { resumeCurrentScreen() }, content: { presentation in
            HomeTaskRecurrenceView(model: presentation.model)
        })
        .sheet(item: $gigPresentation, onDismiss: { resumeCurrentScreen() }, content: { presentation in
            HomeTaskGigView(model: presentation.model)
        })
        .onAppear { isVisible = true
            traceLifecycle("view.appear")
        }
        .task {
            traceLifecycle("view.task.begin")
            defer { traceLifecycle("view.task.end") }
            await viewModel.load()
        }
        .onChange(of: scenePhase) { _, phase in
            traceLifecycle(phase == .active ? "view.scene.active" : "view.scene.inactive")
            guard isVisible else { return }
            if phase == .active { resumeCurrentScreen() } else { viewModel.suspend() }
        }
        .onChange(of: viewModel.loading) { _, loading in
            traceLifecycle(loading ? "view.loading.true" : "view.loading.false")
            if !loading, isVisible, viewModel.isCurrent, viewModel.task != nil || viewModel.error != nil {
                DeepLinkRouter.shared.completeHomeTaskArrival(homeId: homeId, taskId: taskId)
            }
        }
        .onChange(of: viewModel.isCurrent) { _, current in
            traceLifecycle("view.current.changed")
            viewModel.accessChanged()
            if !current { mediaModel?.retire()
                mediaModel = nil
                attachmentPresentation = nil
                recurrencePresentation?.model.retire()
                recurrencePresentation = nil
                gigPresentation?.model.retire()
                gigPresentation = nil
            }
        }
        .onDisappear { traceLifecycle("view.disappear")
            DeepLinkRouter.shared.completeHomeTaskArrival(homeId: homeId, taskId: taskId)
            isVisible = false
            viewModel.suspend()
            if attachmentPresentation == nil { mediaModel?.retire()
                mediaModel = nil
            }
        }
    }

    /// Present the model atomically. A separate Boolean can present the sheet
    /// before SwiftUI observes the lazily initialized model, leaving it empty.
    private struct AttachmentPresentation: Identifiable {
        let id = UUID()
        let model: HomeTaskMediaViewModel
    }

    private struct GigPresentation: Identifiable {
        let id = UUID()
        let model: HomeTaskGigViewModel
    }

    private struct RecurrencePresentation: Identifiable {
        let id = UUID()
        let model: HomeTaskRecurrenceViewModel
    }

    private func resumeCurrentScreen() {
        let revision = viewModel.activationRevision
        traceLifecycle("view.resume.queued", expectedRevision: revision)
        Task {
            traceLifecycle("view.resume.start", expectedRevision: revision)
            guard isVisible, scenePhase == .active else { return }
            await viewModel.resume(ifCurrent: revision)
        }
    }

    private func traceLifecycle(_ event: StaticString, expectedRevision: Int = -1) {
        viewModel.traceLifecycle(event, expectedRevision: expectedRevision, viewVisible: isVisible, sceneActive: scenePhase == .active)
    }
}
