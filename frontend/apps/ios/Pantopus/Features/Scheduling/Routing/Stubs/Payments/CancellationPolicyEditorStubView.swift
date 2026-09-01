//
//  CancellationPolicyEditorStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — G14 Cancellation Policy · Stream I14.
//  Placeholder for the I14 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for G14 (Cancellation Policy). Stream I14 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class CancellationPolicyEditorStubViewModel {
    let owner: SchedulingOwner
    let eventTypeId: String?
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        owner: SchedulingOwner,
        eventTypeId: String?,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.owner = owner
        self.eventTypeId = eventTypeId
        self.push = push
    }
}

struct CancellationPolicyEditorStubView: View {
    @State private var viewModel: CancellationPolicyEditorStubViewModel

    init(viewModel: CancellationPolicyEditorStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        CancellationPolicyEditorView(
            owner: viewModel.owner,
            eventTypeId: viewModel.eventTypeId,
            push: viewModel.push
        )
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        CancellationPolicyEditorStubView(viewModel: CancellationPolicyEditorStubViewModel(
            owner: .personal,
            eventTypeId: nil
        ) { _ in })
    }
}
#endif
