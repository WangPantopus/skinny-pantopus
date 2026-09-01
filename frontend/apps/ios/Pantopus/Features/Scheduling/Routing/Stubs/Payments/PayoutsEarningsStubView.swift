//
//  PayoutsEarningsStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — G7 Payouts & Earnings · Stream I14.
//  Placeholder for the I14 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for G7 (Payouts & Earnings). Stream I14 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class PayoutsEarningsStubViewModel {
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

struct PayoutsEarningsStubView: View {
    @State private var viewModel: PayoutsEarningsStubViewModel

    init(viewModel: PayoutsEarningsStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        PayoutsEarningsView(owner: viewModel.owner, push: viewModel.push)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        PayoutsEarningsStubView(viewModel: PayoutsEarningsStubViewModel(owner: .personal) { _ in })
    }
}
#endif
