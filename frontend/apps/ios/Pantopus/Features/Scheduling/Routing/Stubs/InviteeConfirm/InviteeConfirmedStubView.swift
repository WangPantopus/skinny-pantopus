//
//  InviteeConfirmedStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — D3 Confirmed · Stream I6.
//  Placeholder for the I6 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for D3 (Confirmed). Stream I6 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class InviteeConfirmedStubViewModel {
    let manageToken: String
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        manageToken: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.manageToken = manageToken
        self.push = push
    }
}

/// Stream I6 adapter — builds the real D3 view-model from the routed stub payload
/// (the one-time manage token) and renders the real confirmation screen.
struct InviteeConfirmedStubView: View {
    private let viewModel: InviteeConfirmedViewModel

    init(viewModel stub: InviteeConfirmedStubViewModel) {
        viewModel = InviteeConfirmedViewModel(
            manageToken: stub.manageToken,
            push: stub.push,
            client: SchedulingClient.shared
        )
    }

    var body: some View {
        InviteeConfirmedView(viewModel: viewModel)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        InviteeConfirmedStubView(viewModel: InviteeConfirmedStubViewModel(manageToken: "preview") { _ in })
    }
}
#endif
