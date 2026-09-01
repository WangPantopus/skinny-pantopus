//
//  OneOffLinkGeneratorStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — C4 One-off Link · Stream I4.
//  Placeholder for the I4 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for C4 (One-off Link). Stream I4 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class OneOffLinkGeneratorStubViewModel {
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

struct OneOffLinkGeneratorStubView: View {
    @State private var viewModel: OneOffLinkGeneratorStubViewModel

    init(viewModel: OneOffLinkGeneratorStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        OneOffLinkGeneratorView(owner: viewModel.owner, push: viewModel.push)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        OneOffLinkGeneratorStubView(viewModel: OneOffLinkGeneratorStubViewModel(owner: .personal) { _ in })
    }
}
#endif
