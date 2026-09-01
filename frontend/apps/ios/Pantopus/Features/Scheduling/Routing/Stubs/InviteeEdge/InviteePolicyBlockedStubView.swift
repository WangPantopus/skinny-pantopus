//
//  InviteePolicyBlockedStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — D10 Booking Policy · Stream I7.
//  Placeholder for the I7 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for D10 (Booking Policy). Stream I7 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class InviteePolicyBlockedStubViewModel {
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

struct InviteePolicyBlockedStubView: View {
    private let viewModel: PolicyBlockedViewModel

    init(viewModel stub: InviteePolicyBlockedStubViewModel) {
        viewModel = PolicyBlockedViewModel(
            token: stub.token,
            push: stub.push,
            client: SchedulingClient.shared
        )
    }

    var body: some View {
        PolicyBlockedView(viewModel: viewModel)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        InviteePolicyBlockedStubView(viewModel: InviteePolicyBlockedStubViewModel(token: "preview") { _ in })
    }
}
#endif
