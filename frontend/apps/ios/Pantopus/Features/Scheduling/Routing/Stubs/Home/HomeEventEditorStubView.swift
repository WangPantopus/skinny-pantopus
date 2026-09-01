//
//  HomeEventEditorStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — F3 Add Event · Stream I10.
//  Placeholder for the I10 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for F3 (Add Event). Stream I10 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class HomeEventEditorStubViewModel {
    let homeId: String
    let eventId: String?
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        homeId: String,
        eventId: String?,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.homeId = homeId
        self.eventId = eventId
        self.push = push
    }
}

struct HomeEventEditorStubView: View {
    @State private var viewModel: HomeEventEditorStubViewModel
    @Environment(\.dismiss) private var dismiss

    init(viewModel: HomeEventEditorStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        // Secondary entry point. The primary Home-tab flow (HubTabRoot) routes
        // create → detail; here we pop back on close/commit.
        CalendarEventFormRoute(
            homeId: viewModel.homeId,
            eventId: viewModel.eventId,
            onClose: { dismiss() },
            onCommitted: { _ in dismiss() }
        )
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        HomeEventEditorStubView(viewModel: HomeEventEditorStubViewModel(homeId: "preview", eventId: nil) { _ in })
    }
}
#endif
