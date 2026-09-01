//
//  SchedulingHubStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — A1 Scheduling Hub · Stream I1.
//  Placeholder for the I1 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for A1 (Scheduling Hub). Stream I1 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class SchedulingHubStubViewModel {
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

struct SchedulingHubStubView: View {
    @State private var viewModel: SchedulingHubStubViewModel

    init(viewModel: SchedulingHubStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        SchedulingHubScreen(owner: viewModel.owner, push: viewModel.push)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        SchedulingHubStubView(viewModel: SchedulingHubStubViewModel(owner: .personal) { _ in })
    }
}
#endif
