//
//  BookingDetailStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — E2 Booking · Stream I8.
//  Placeholder for the I8 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for E2 (Booking). Stream I8 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class BookingDetailStubViewModel {
    let owner: SchedulingOwner
    let bookingId: String
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        owner: SchedulingOwner,
        bookingId: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.owner = owner
        self.bookingId = bookingId
        self.push = push
    }
}

struct BookingDetailStubView: View {
    private let viewModel: BookingDetailViewModel

    init(viewModel stub: BookingDetailStubViewModel) {
        viewModel = BookingDetailViewModel(
            owner: stub.owner,
            bookingId: stub.bookingId,
            push: stub.push,
            actions: BookingActions(owner: stub.owner)
        )
    }

    var body: some View {
        BookingDetailView(viewModel: viewModel)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        BookingDetailStubView(viewModel: BookingDetailStubViewModel(owner: .personal, bookingId: "preview") { _ in })
    }
}
#endif
