//
//  BookingPageZeroStateStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — H16 Get Started · Stream I4.
//  Placeholder for the I4 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for H16 (Get Started). Stream I4 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class BookingPageZeroStateStubViewModel {
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

struct BookingPageZeroStateStubView: View {
    @State private var viewModel: BookingPageZeroStateStubViewModel

    init(viewModel: BookingPageZeroStateStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        BookingPageZeroStateView(owner: viewModel.owner, push: viewModel.push)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        BookingPageZeroStateStubView(viewModel: BookingPageZeroStateStubViewModel(owner: .personal) { _ in })
    }
}
#endif
