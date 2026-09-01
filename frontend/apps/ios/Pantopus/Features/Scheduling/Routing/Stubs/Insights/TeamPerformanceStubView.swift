//
//  TeamPerformanceStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — H12 Team Performance · Stream I17.
//  Placeholder for the I17 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for H12 (Team Performance). Stream I17 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class TeamPerformanceStubViewModel {
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

struct TeamPerformanceStubView: View {
    @State private var viewModel: TeamPerformanceStubViewModel

    init(viewModel: TeamPerformanceStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        TeamPerformanceView(owner: viewModel.owner, push: viewModel.push)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        TeamPerformanceStubView(viewModel: TeamPerformanceStubViewModel(owner: .personal) { _ in })
    }
}
#endif
