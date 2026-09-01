//
//  WorkflowEditorStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — H3 Workflow Editor · Stream I16.
//  Placeholder for the I16 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for H3 (Workflow Editor). Stream I16 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class WorkflowEditorStubViewModel {
    let owner: SchedulingOwner
    let workflowId: String?
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        owner: SchedulingOwner,
        workflowId: String?,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.owner = owner
        self.workflowId = workflowId
        self.push = push
    }
}

struct WorkflowEditorStubView: View {
    @State private var viewModel: WorkflowEditorStubViewModel

    init(viewModel: WorkflowEditorStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        WorkflowEditorView(owner: viewModel.owner, workflowId: viewModel.workflowId)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        WorkflowEditorStubView(viewModel: WorkflowEditorStubViewModel(owner: .personal, workflowId: nil) { _ in })
    }
}
#endif
