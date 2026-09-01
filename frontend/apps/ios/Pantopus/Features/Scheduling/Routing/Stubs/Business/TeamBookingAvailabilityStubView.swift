//
//  TeamBookingAvailabilityStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — G3 Team Availability · Stream I13.
//  Placeholder for the I13 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for G3 (Team Availability). Stream I13 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class TeamBookingAvailabilityStubViewModel {
    let owner: SchedulingOwner
    let tz: String
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        owner: SchedulingOwner,
        tz: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.owner = owner
        self.tz = tz
        self.push = push
    }
}

struct TeamBookingAvailabilityStubView: View {
    @State private var viewModel: TeamBookingAvailabilityStubViewModel

    init(viewModel: TeamBookingAvailabilityStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        TeamBookingAvailabilityView(owner: viewModel.owner, tz: viewModel.tz, push: viewModel.push)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        TeamBookingAvailabilityStubView(viewModel: TeamBookingAvailabilityStubViewModel(owner: .personal, tz: "preview") { _ in })
    }
}
#endif
