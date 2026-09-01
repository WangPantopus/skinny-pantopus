//
//  VisitDetailStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — F14 Visit · Stream I12.
//  Placeholder for the I12 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for F14 (Visit). Stream I12 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class VisitDetailStubViewModel {
    let homeId: String
    let eventId: String
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        homeId: String,
        eventId: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.homeId = homeId
        self.eventId = eventId
        self.push = push
    }
}

struct VisitDetailStubView: View {
    @State private var viewModel: VisitDetailStubViewModel

    init(viewModel: VisitDetailStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        VisitDetailView(
            viewModel: VisitDetailViewModel(
                homeId: viewModel.homeId,
                eventId: viewModel.eventId,
                push: viewModel.push
            )
        )
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        VisitDetailStubView(viewModel: VisitDetailStubViewModel(homeId: "preview", eventId: "preview") { _ in })
    }
}
#endif
