//
//  RecurringSetupStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — D12 Recurring Setup · Stream I7.
//  Placeholder for the I7 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for D12 (Recurring Setup). Stream I7 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class RecurringSetupStubViewModel {
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

struct RecurringSetupStubView: View {
    private let viewModel: RecurringSetupViewModel

    init(viewModel stub: RecurringSetupStubViewModel) {
        viewModel = RecurringSetupViewModel(
            owner: stub.owner,
            eventTypeId: stub.eventTypeId,
            push: stub.push,
            client: SchedulingClient.shared
        )
    }

    var body: some View {
        RecurringSetupView(viewModel: viewModel)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        RecurringSetupStubView(viewModel: RecurringSetupStubViewModel(owner: .personal, eventTypeId: "preview") { _ in })
    }
}
#endif
