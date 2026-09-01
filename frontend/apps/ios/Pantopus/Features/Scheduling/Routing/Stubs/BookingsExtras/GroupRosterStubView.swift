//
//  GroupRosterStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — E8 Roster & Seats · Stream I9.
//  Placeholder for the I9 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for E8 (Roster & Seats). Stream I9 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class GroupRosterStubViewModel {
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

struct GroupRosterStubView: View {
    @State private var viewModel: GroupRosterStubViewModel

    init(viewModel: GroupRosterStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        GroupRosterView(
            viewModel: GroupRosterViewModel(
                owner: viewModel.owner,
                bookingId: viewModel.bookingId,
                push: viewModel.push,
                client: .shared
            )
        )
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        GroupRosterStubView(viewModel: GroupRosterStubViewModel(owner: .personal, bookingId: "preview") { _ in })
    }
}
#endif
