//
//  DateOverridesStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — B6 Date Overrides · Stream I3.
//  Placeholder for the I3 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for B6 (Date Overrides). Stream I3 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class DateOverridesStubViewModel {
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

struct DateOverridesStubView: View {
    @State private var viewModel: DateOverridesStubViewModel

    init(viewModel: DateOverridesStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        DateOverridesView(
            viewModel: DateOverridesViewModel(scheduleId: viewModel.scheduleId)
        )
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        DateOverridesStubView(viewModel: DateOverridesStubViewModel(scheduleId: "preview") { _ in })
    }
}
#endif
