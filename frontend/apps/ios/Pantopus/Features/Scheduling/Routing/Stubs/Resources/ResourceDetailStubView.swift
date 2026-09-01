//
//  ResourceDetailStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — F11 Resource · Stream I12.
//  Placeholder for the I12 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for F11 (Resource). Stream I12 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class ResourceDetailStubViewModel {
    let homeId: String
    let resourceId: String
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        homeId: String,
        resourceId: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.homeId = homeId
        self.resourceId = resourceId
        self.push = push
    }
}

struct ResourceDetailStubView: View {
    @State private var viewModel: ResourceDetailStubViewModel

    init(viewModel: ResourceDetailStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        ResourceDetailView(
            viewModel: ResourceDetailViewModel(
                homeId: viewModel.homeId,
                resourceId: viewModel.resourceId,
                push: viewModel.push
            )
        )
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        ResourceDetailStubView(viewModel: ResourceDetailStubViewModel(homeId: "preview", resourceId: "preview") { _ in })
    }
}
#endif
