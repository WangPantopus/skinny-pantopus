//
//  BookingLimitsStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — B7 Booking Limits · Stream I3.
//  Placeholder for the I3 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for B7 (Booking Limits). Stream I3 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class BookingLimitsStubViewModel {
    let owner: SchedulingOwner
    let eventTypeId: String
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        owner: SchedulingOwner,
        eventTypeId: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.owner = owner
        self.eventTypeId = eventTypeId
        self.push = push
    }
}

struct BookingLimitsStubView: View {
    @State private var viewModel: BookingLimitsStubViewModel

    init(viewModel: BookingLimitsStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        BookingLimitsView(
            viewModel: BookingLimitsViewModel(owner: viewModel.owner, eventTypeId: viewModel.eventTypeId)
        )
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        BookingLimitsStubView(viewModel: BookingLimitsStubViewModel(owner: .personal, eventTypeId: "preview") { _ in })
    }
}
#endif
