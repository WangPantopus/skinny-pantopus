//
//  AvailabilityScheduleListStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — B4 Availability · Stream I3.
//  Placeholder for the I3 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for B4 (Availability). Stream I3 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class AvailabilityScheduleListStubViewModel {
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.push = push
    }
}

struct AvailabilityScheduleListStubView: View {
    @State private var viewModel: AvailabilityScheduleListStubViewModel

    init(viewModel: AvailabilityScheduleListStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        AvailabilityScheduleListView(
            viewModel: AvailabilityScheduleListViewModel(push: viewModel.push)
        )
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        AvailabilityScheduleListStubView(viewModel: AvailabilityScheduleListStubViewModel { _ in })
    }
}
#endif
