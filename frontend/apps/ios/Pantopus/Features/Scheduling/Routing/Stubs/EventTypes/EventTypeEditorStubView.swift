//
//  EventTypeEditorStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — B2 Event Type Editor · Stream I2.
//  Placeholder for the I2 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for B2 (Event Type Editor). Stream I2 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class EventTypeEditorStubViewModel {
    let owner: SchedulingOwner
    let eventTypeId: String?
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        owner: SchedulingOwner,
        eventTypeId: String?,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.owner = owner
        self.eventTypeId = eventTypeId
        self.push = push
    }
}

struct EventTypeEditorStubView: View {
    @State private var viewModel: EventTypeEditorStubViewModel

    init(viewModel: EventTypeEditorStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        EventTypeEditorView(viewModel: EventTypeEditorViewModel(
            owner: viewModel.owner,
            eventTypeId: viewModel.eventTypeId,
            push: viewModel.push
        ))
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        EventTypeEditorStubView(viewModel: EventTypeEditorStubViewModel(owner: .personal, eventTypeId: nil) { _ in })
    }
}
#endif
