//
//  WeeklyHoursEditorStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — B5 Weekly Hours · Stream I3.
//  Placeholder for the I3 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for B5 (Weekly Hours). Stream I3 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class WeeklyHoursEditorStubViewModel {
    let scheduleId: String
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        scheduleId: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.scheduleId = scheduleId
        self.push = push
    }
}

struct WeeklyHoursEditorStubView: View {
    @State private var viewModel: WeeklyHoursEditorStubViewModel

    init(viewModel: WeeklyHoursEditorStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        WeeklyHoursEditorView(
            viewModel: WeeklyHoursEditorViewModel(scheduleId: viewModel.scheduleId, push: viewModel.push)
        )
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        WeeklyHoursEditorStubView(viewModel: WeeklyHoursEditorStubViewModel(scheduleId: "preview") { _ in })
    }
}
#endif
