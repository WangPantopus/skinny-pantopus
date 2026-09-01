//
//  PerEventTypePerformanceStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — H10 Performance · Stream I17.
//  Placeholder for the I17 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for H10 (Performance). Stream I17 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class PerEventTypePerformanceStubViewModel {
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

struct PerEventTypePerformanceStubView: View {
    @State private var viewModel: PerEventTypePerformanceStubViewModel

    init(viewModel: PerEventTypePerformanceStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        PerEventTypePerformanceView(
            owner: viewModel.owner,
            eventTypeId: viewModel.eventTypeId,
            push: viewModel.push
        )
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        PerEventTypePerformanceStubView(viewModel: PerEventTypePerformanceStubViewModel(
            owner: .personal,
            eventTypeId: "preview"
        ) { _ in })
    }
}
#endif
