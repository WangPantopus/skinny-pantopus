//
//  ScheduleVisitStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — F13 Schedule a Visit · Stream I12.
//  Placeholder for the I12 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for F13 (Schedule a Visit). Stream I12 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class ScheduleVisitStubViewModel {
    let homeId: String
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        homeId: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.homeId = homeId
        self.push = push
    }
}

struct ScheduleVisitStubView: View {
    @State private var viewModel: ScheduleVisitStubViewModel

    init(viewModel: ScheduleVisitStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        ScheduleVisitView(
            viewModel: ScheduleVisitViewModel(homeId: viewModel.homeId, push: viewModel.push)
        )
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        ScheduleVisitStubView(viewModel: ScheduleVisitStubViewModel(homeId: "preview") { _ in })
    }
}
#endif
