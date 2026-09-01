//
//  BookingPageManagementStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — C1 Booking Page · Stream I4.
//  Placeholder for the I4 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for C1 (Booking Page). Stream I4 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class BookingPageManagementStubViewModel {
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

struct BookingPageManagementStubView: View {
    @State private var viewModel: BookingPageManagementStubViewModel

    init(viewModel: BookingPageManagementStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        BookingPageManagementView(owner: viewModel.owner, push: viewModel.push)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        BookingPageManagementStubView(viewModel: BookingPageManagementStubViewModel(owner: .personal) { _ in })
    }
}
#endif
