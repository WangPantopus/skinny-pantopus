//
//  SchedulingSettingsStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — A3 Scheduling Settings · Stream I1.
//  Placeholder for the I1 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for A3 (Scheduling Settings). Stream I1 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class SchedulingSettingsStubViewModel {
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

struct SchedulingSettingsStubView: View {
    @State private var viewModel: SchedulingSettingsStubViewModel

    init(viewModel: SchedulingSettingsStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        SchedulingSettingsScreen(owner: viewModel.owner, push: viewModel.push)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        SchedulingSettingsStubView(viewModel: SchedulingSettingsStubViewModel(owner: .personal) { _ in })
    }
}
#endif
