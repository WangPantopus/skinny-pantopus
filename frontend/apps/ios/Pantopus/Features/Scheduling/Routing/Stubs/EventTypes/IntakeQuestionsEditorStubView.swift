//
//  IntakeQuestionsEditorStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — B3 Intake Questions · Stream I2.
//  Placeholder for the I2 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for B3 (Intake Questions). Stream I2 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class IntakeQuestionsEditorStubViewModel {
    let owner: SchedulingOwner
    let eventTypeId: String
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        owner: SchedulingOwner,
        eventTypeId: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.owner = owner
        self.eventTypeId = eventTypeId
        self.push = push
    }
}

struct IntakeQuestionsEditorStubView: View {
    @State private var viewModel: IntakeQuestionsEditorStubViewModel

    init(viewModel: IntakeQuestionsEditorStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        IntakeQuestionsEditorView(viewModel: IntakeQuestionsEditorViewModel(
            owner: viewModel.owner,
            eventTypeId: viewModel.eventTypeId
        ))
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        IntakeQuestionsEditorStubView(viewModel: IntakeQuestionsEditorStubViewModel(
            owner: .personal,
            eventTypeId: "preview"
        ) { _ in })
    }
}
#endif
