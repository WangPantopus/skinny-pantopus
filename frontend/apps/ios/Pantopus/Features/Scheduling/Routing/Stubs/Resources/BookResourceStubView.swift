//
//  BookResourceStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — F12 Book Resource · Stream I12.
//  Placeholder for the I12 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for F12 (Book Resource). Stream I12 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class BookResourceStubViewModel {
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

struct BookResourceStubView: View {
    @State private var viewModel: BookResourceStubViewModel

    init(viewModel: BookResourceStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        BookResourceView(
            viewModel: BookResourceViewModel(
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
        BookResourceStubView(viewModel: BookResourceStubViewModel(homeId: "preview", resourceId: "preview") { _ in })
    }
}
#endif
