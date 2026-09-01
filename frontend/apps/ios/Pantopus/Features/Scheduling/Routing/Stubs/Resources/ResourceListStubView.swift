//
//  ResourceListStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — F9 Resources · Stream I12.
//  Placeholder for the I12 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for F9 (Resources). Stream I12 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class ResourceListStubViewModel {
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

struct ResourceListStubView: View {
    @State private var viewModel: ResourceListStubViewModel

    init(viewModel: ResourceListStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        ResourceListView(
            viewModel: ResourceListViewModel(homeId: viewModel.homeId, push: viewModel.push)
        )
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        ResourceListStubView(viewModel: ResourceListStubViewModel(homeId: "preview") { _ in })
    }
}
#endif
