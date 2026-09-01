//
//  WorkflowsListStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — H2 Workflows · Stream I16.
//  Placeholder for the I16 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for H2 (Workflows). Stream I16 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class WorkflowsListStubViewModel {
    let owner: SchedulingOwner
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        owner: SchedulingOwner,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.owner = owner
        self.push = push
    }
}

struct WorkflowsListStubView: View {
    @State private var viewModel: WorkflowsListStubViewModel

    init(viewModel: WorkflowsListStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        WorkflowsListView(owner: viewModel.owner, push: viewModel.push)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        WorkflowsListStubView(viewModel: WorkflowsListStubViewModel(owner: .personal) { _ in })
    }
}
#endif
