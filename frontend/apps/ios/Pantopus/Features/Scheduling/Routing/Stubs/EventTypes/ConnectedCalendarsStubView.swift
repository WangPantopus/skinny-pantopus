//
//  ConnectedCalendarsStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — B8 Connected Calendars · Stream I2.
//  Placeholder for the I2 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for B8 (Connected Calendars). Stream I2 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class ConnectedCalendarsStubViewModel {
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

struct ConnectedCalendarsStubView: View {
    @State private var viewModel: ConnectedCalendarsStubViewModel

    init(viewModel: ConnectedCalendarsStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        ConnectedCalendarsView(
            viewModel: ConnectedCalendarsViewModel(owner: viewModel.owner)
        )
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        ConnectedCalendarsStubView(viewModel: ConnectedCalendarsStubViewModel(owner: .personal) { _ in })
    }
}
#endif
