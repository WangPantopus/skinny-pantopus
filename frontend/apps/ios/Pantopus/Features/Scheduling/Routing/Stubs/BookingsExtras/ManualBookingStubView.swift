//
//  ManualBookingStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — E12 Manual Booking · Stream I9.
//  Placeholder for the I9 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for E12 (Manual Booking). Stream I9 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class ManualBookingStubViewModel {
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

struct ManualBookingStubView: View {
    @State private var viewModel: ManualBookingStubViewModel

    init(viewModel: ManualBookingStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        ManualBookingView(
            viewModel: ManualBookingViewModel(
                owner: viewModel.owner,
                push: viewModel.push,
                client: .shared
            )
        )
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        ManualBookingStubView(viewModel: ManualBookingStubViewModel(owner: .personal) { _ in })
    }
}
#endif
