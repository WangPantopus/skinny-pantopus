//
//  EventTypeListStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — B1 Event Types · Stream I2.
//  Placeholder for the I2 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for B1 (Event Types). Stream I2 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class EventTypeListStubViewModel {
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

struct EventTypeListStubView: View {
    @State private var viewModel: EventTypeListStubViewModel

    init(viewModel: EventTypeListStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        EventTypeListView(
            viewModel: EventTypeListViewModel(owner: viewModel.owner, push: viewModel.push)
        )
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        EventTypeListStubView(viewModel: EventTypeListStubViewModel(owner: .personal) { _ in })
    }
}
#endif
