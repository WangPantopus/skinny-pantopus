//
//  InviteeManageBookingStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — D4 Manage Booking · Stream I6.
//  Placeholder for the I6 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for D4 (Manage Booking). Stream I6 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class InviteeManageBookingStubViewModel {
    let token: String
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        token: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.token = token
        self.push = push
    }
}

/// Stream I6 adapter — builds the real D4 view-model from the routed stub payload
/// (the manage token) and renders the real manage-booking screen.
struct InviteeManageBookingStubView: View {
    private let viewModel: InviteeManageBookingViewModel

    init(viewModel stub: InviteeManageBookingStubViewModel) {
        viewModel = InviteeManageBookingViewModel(
            token: stub.token,
            push: stub.push,
            client: SchedulingClient.shared
        )
    }

    var body: some View {
        InviteeManageBookingView(viewModel: viewModel)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        InviteeManageBookingStubView(viewModel: InviteeManageBookingStubViewModel(token: "preview") { _ in })
    }
}
#endif
