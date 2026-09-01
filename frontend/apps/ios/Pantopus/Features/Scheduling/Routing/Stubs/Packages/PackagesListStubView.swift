//
//  PackagesListStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — G8 Packages · Stream I15.
//  Placeholder for the I15 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for G8 (Packages). Stream I15 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class PackagesListStubViewModel {
    let owner: SchedulingOwner
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        owner: SchedulingOwner,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.owner = owner
        self.push = push
    }
}

struct PackagesListStubView: View {
    @State private var viewModel: PackagesListStubViewModel

    init(viewModel: PackagesListStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        SchedulingPackagesListView(owner: viewModel.owner, push: viewModel.push)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        PackagesListStubView(viewModel: PackagesListStubViewModel(owner: .personal) { _ in })
    }
}
#endif
