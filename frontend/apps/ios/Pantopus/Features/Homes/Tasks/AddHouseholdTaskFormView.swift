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
                    headline: "Couldn't load the task",
                    subcopy: message,
                    cta: EmptyState.CTA(title: "Try again") {
                        await viewModel.refresh()
                    }
                )
                .background(Theme.Color.appBg)
            }
        }
        .background(Theme.Color.appBg)
        .task { await viewModel.load() }
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
            guard newValue else { return }
            viewModel.acknowledgeDismiss()
            let newId = viewModel.createdTaskId
            Task {
                try? await Task.sleep(nanoseconds: 700_000_000)
                if let newId, let onCreated {
                    onCreated(newId)
                } else {
                    onClose()
                }
            }
        }
    }

    private var editor: some View {
        FormShell(
            title: viewModel.isEditing ? "Edit task" : "Add task",
            rightActionLabel: "Save",
            isValid: viewModel.isValid,
            isDirty: viewModel.isDirty,
            isSaving: viewModel.isSaving,
            onClose: onClose,
            onCommit: { Task { await viewModel.save() } },
            content: {
                titleAndCategorySection
                assigneeSection
                scheduleSection
                notesSection
            }
        )
        .formShakeOnChange(of: viewModel.shakeTrigger)
        .accessibilityIdentifier("addHouseholdTaskFormShell")
    }
}
