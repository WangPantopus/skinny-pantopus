//
//  BookingsInboxStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — E1 Bookings · Stream I8.
//  Placeholder for the I8 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for E1 (Bookings). Stream I8 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class BookingsInboxStubViewModel {
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

struct BookingsInboxStubView: View {
    private let viewModel: BookingsInboxViewModel

    init(viewModel stub: BookingsInboxStubViewModel) {
        viewModel = BookingsInboxViewModel(
            owner: stub.owner,
            push: stub.push,
            actions: BookingActions(owner: stub.owner)
        )
    }

    var body: some View {
        BookingsInboxView(viewModel: viewModel)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        BookingsInboxStubView(viewModel: BookingsInboxStubViewModel(owner: .personal) { _ in })
    }
}
#endif
