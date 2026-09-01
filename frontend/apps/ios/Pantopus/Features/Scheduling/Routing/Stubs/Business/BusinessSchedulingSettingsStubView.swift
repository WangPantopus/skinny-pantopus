//
//  BusinessSchedulingSettingsStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — G5 Business Settings · Stream I13.
//  Placeholder for the I13 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for G5 (Business Settings). Stream I13 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class BusinessSchedulingSettingsStubViewModel {
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

struct BusinessSchedulingSettingsStubView: View {
    @State private var viewModel: BusinessSchedulingSettingsStubViewModel

    init(viewModel: BusinessSchedulingSettingsStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        BusinessSchedulingSettingsView(owner: viewModel.owner, push: viewModel.push)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        BusinessSchedulingSettingsStubView(viewModel: BusinessSchedulingSettingsStubViewModel(owner: .personal) { _ in })
    }
}
#endif
