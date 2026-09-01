//
//  HomeCalendarStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — F1 Home Calendar · Stream I10.
//  Placeholder for the I10 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for F1 (Home Calendar). Stream I10 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class HomeCalendarStubViewModel {
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

struct HomeCalendarStubView: View {
    @State private var viewModel: HomeCalendarStubViewModel

    init(viewModel: HomeCalendarStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        let homeId = viewModel.homeId
        let push = viewModel.push
        HomeCalendarView(
            viewModel: HomeCalendarViewModel(
                homeId: homeId,
                onAddEvent: {
                    Task { @MainActor in push(.homeEventEditor(homeId: homeId, eventId: nil)) }
                },
                onOpenEvent: { eventId in
                    Task { @MainActor in push(.homeEventDetail(homeId: homeId, eventId: eventId)) }
                }
            )
        )
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        HomeCalendarStubView(viewModel: HomeCalendarStubViewModel(homeId: "preview") { _ in })
    }
}
#endif
