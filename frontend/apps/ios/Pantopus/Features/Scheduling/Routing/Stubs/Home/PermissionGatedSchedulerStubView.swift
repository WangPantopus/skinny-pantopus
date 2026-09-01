//
//  PermissionGatedSchedulerStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — F15 Scheduler · Stream I10.
//  Placeholder for the I10 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for F15 (Scheduler). Stream I10 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class PermissionGatedSchedulerStubViewModel {
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

struct PermissionGatedSchedulerStubView: View {
    @State private var viewModel: PermissionGatedSchedulerStubViewModel

    init(viewModel: PermissionGatedSchedulerStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        GatedSchedulerView(
            viewModel: GatedSchedulerViewModel(homeId: viewModel.homeId)
        )
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        PermissionGatedSchedulerStubView(viewModel: PermissionGatedSchedulerStubViewModel(homeId: "preview") { _ in })
    }
}
#endif
