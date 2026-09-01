//
//  PaymentsSetupStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — G6 Payments Setup · Stream I14.
//  Placeholder for the I14 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for G6 (Payments Setup). Stream I14 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class PaymentsSetupStubViewModel {
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

struct PaymentsSetupStubView: View {
    @State private var viewModel: PaymentsSetupStubViewModel

    init(viewModel: PaymentsSetupStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        PaymentsSetupView(owner: viewModel.owner, push: viewModel.push)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        PaymentsSetupStubView(viewModel: PaymentsSetupStubViewModel(owner: .personal) { _ in })
    }
}
#endif
