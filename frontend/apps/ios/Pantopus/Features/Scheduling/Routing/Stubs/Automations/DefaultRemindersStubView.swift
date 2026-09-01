//
//  DefaultRemindersStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — H1 Reminders · Stream I16.
//  Placeholder for the I16 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for H1 (Reminders). Stream I16 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class DefaultRemindersStubViewModel {
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

struct DefaultRemindersStubView: View {
    @State private var viewModel: DefaultRemindersStubViewModel

    init(viewModel: DefaultRemindersStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        DefaultRemindersView(owner: viewModel.owner)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        DefaultRemindersStubView(viewModel: DefaultRemindersStubViewModel(owner: .personal) { _ in })
    }
}
#endif
