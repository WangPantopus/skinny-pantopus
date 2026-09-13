//
//  AddHouseholdTaskFormView.swift
//  Pantopus
//
//  P2.4 — Add/Edit Household Task form. Single screen built on
//  `FormShell`; the same view renders both Add (no `taskId`) and Edit
//  (`taskId` provided) modes — only the top-bar title, the load
//  behavior, and the wire verb differ. Pushed from the household
//  tasks list FAB and the "Edit recurring" overflow action.
//

import SwiftUI

/// Add / Edit one household chore.
@MainActor
public struct AddHouseholdTaskFormView: View {
    @State var viewModel: AddHouseholdTaskFormViewModel
    @State private var isVisible = false
    @Environment(\.scenePhase) private var scenePhase
    private let onClose: @MainActor () -> Void
    private let onCreated: (@MainActor (String) -> Void)?

    init(
        homeId: String,
        taskId: String? = nil,
        api: APIClient = .shared,
        onClose: @escaping @MainActor () -> Void,
        onCreated: (@MainActor (String) -> Void)? = nil
    ) {
        _viewModel = State(
            initialValue: AddHouseholdTaskFormViewModel(
                homeId: homeId,
                taskId: taskId,
                api: api
            )
        )
        self.onClose = onClose
        self.onCreated = onCreated
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                AddHouseholdTaskFormSkeleton()
            case .editing:
                editor
            case let .error(message):
                EmptyState(
                    icon: .alertCircle,
                    headline: viewModel.terminalRequestMessage != nil ? "Saved request ended" : "Task unavailable",
                    subcopy: viewModel.terminalRequestMessage ?? message,
                    cta: EmptyState.CTA(title: viewModel.terminalRequestMessage != nil ? "Clear saved request" : "Try again") {
                        guard isVisible, scenePhase == .active else { return }
                        if viewModel.terminalRequestMessage != nil { viewModel.acknowledgeTerminalRequest() } else {
                            await viewModel.resume(ifCurrent: viewModel.activationRevision)
                        }
                    }
                )
                .background(Theme.Color.appBg)
            }
        }
        .background(Theme.Color.appBg)
        .task { await viewModel.load() }
        .onAppear { isVisible = true }
        .onDisappear { isVisible = false
            viewModel.suspend()
        }
        .onChange(of: viewModel.isCurrent) { _, _ in viewModel.accessChanged() }
        .onChange(of: scenePhase) { _, phase in
            guard isVisible else { return }
            if phase == .active {
                let revision = viewModel.activationRevision
                Task {
                    guard isVisible, scenePhase == .active else { return }
                    await viewModel.resume(ifCurrent: revision)
                }
            } else { viewModel.suspend() }
        }
        .overlay(alignment: .bottom) {
            if let toast = viewModel.toast {
                ToastView(message: toast)
                    .padding(.bottom, Spacing.s10)
                    .transition(.opacity)
                    .task(id: toast) {
                        try? await Task.sleep(nanoseconds: 2_000_000_000)
                        viewModel.toast = nil
                    }
                    .accessibilityIdentifier("addHouseholdTaskToast")
            }
        }
        .pantopusAnimation(.componentState, value: viewModel.toast)
        .onChange(of: viewModel.shouldDismiss) { _, newValue in
            guard newValue, isVisible, scenePhase == .active, viewModel.isCurrent else { return }
            viewModel.acknowledgeDismiss()
            if let newId = viewModel.createdTaskId, let onCreated { onCreated(newId) } else { onClose() }
        }
    }

    private var editor: some View {
        FormShell(
            title: viewModel.isEditing ? "Edit task" : "Add task",
            rightActionLabel: viewModel.saveLabel,
            isValid: viewModel.isValid,
            isDirty: viewModel.isDirty,
            isSaving: viewModel.isSaving,
            onClose: onClose,
            onCommit: { Task { await viewModel.save() } },
            content: {
                if let message = viewModel.recoveryMessage {
                    Text(message).font(.callout).accessibilityIdentifier("homeTask.savedRequest")
                }
                Group {
                    titleAndCategorySection
                    assigneeSection
                    scheduleSection
                    notesSection
                }.disabled(viewModel.hasPendingSave || viewModel.isSaving)
            }
        )
        .formShakeOnChange(of: viewModel.shakeTrigger)
        .accessibilityIdentifier("addHouseholdTaskFormShell")
    }
}
