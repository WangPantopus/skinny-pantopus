//
//  BuyPackageStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — G10 Buy Package · Stream I15.
//  Placeholder for the I15 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for G10 (Buy Package). Stream I15 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class BuyPackageStubViewModel {
    let owner: SchedulingOwner
    let packageId: String
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        owner: SchedulingOwner,
        packageId: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.owner = owner
        self.packageId = packageId
        self.push = push
    }
}

struct BuyPackageStubView: View {
    @State private var viewModel: BuyPackageStubViewModel

    init(viewModel: BuyPackageStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        BuyPackageView(owner: viewModel.owner, packageId: viewModel.packageId, push: viewModel.push)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        BuyPackageStubView(viewModel: BuyPackageStubViewModel(owner: .personal, packageId: "pkg") { _ in })
    }
}
#endif
