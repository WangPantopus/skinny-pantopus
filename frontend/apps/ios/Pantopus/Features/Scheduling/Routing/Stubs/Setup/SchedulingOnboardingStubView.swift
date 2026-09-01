//
//  SchedulingOnboardingStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — A6 Scheduling Onboarding · Stream I1.
//  Placeholder for the I1 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for A6 (Scheduling Onboarding). Stream I1 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class SchedulingOnboardingStubViewModel {
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

struct SchedulingOnboardingStubView: View {
    @State private var viewModel: SchedulingOnboardingStubViewModel

    init(viewModel: SchedulingOnboardingStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        SchedulingOnboardingScreen(owner: viewModel.owner, push: viewModel.push)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        SchedulingOnboardingStubView(viewModel: SchedulingOnboardingStubViewModel(owner: .personal) { _ in })
    }
}
#endif
