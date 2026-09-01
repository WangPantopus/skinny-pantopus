//
//  WaitlistManagementStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — E13 Waitlist · Stream I9.
//  Placeholder for the I9 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for E13 (Waitlist). Stream I9 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class WaitlistManagementStubViewModel {
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

struct WaitlistManagementStubView: View {
    @State private var viewModel: WaitlistManagementStubViewModel

    init(viewModel: WaitlistManagementStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        WaitlistManagementView(
            viewModel: WaitlistManagementViewModel(
                owner: viewModel.owner,
                eventTypeId: viewModel.eventTypeId,
                push: viewModel.push,
                client: .shared
            )
        )
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        WaitlistManagementStubView(viewModel: WaitlistManagementStubViewModel(owner: .personal, eventTypeId: "preview") { _ in })
    }
}
#endif
