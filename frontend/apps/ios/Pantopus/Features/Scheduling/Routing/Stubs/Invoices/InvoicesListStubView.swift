//
//  InvoicesListStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — G12 Invoices · Stream I15.
//  Placeholder for the I15 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for G12 (Invoices). Stream I15 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class InvoicesListStubViewModel {
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

struct InvoicesListStubView: View {
    @State private var viewModel: InvoicesListStubViewModel

    init(viewModel: InvoicesListStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        InvoicesListView(owner: viewModel.owner, push: viewModel.push)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        InvoicesListStubView(viewModel: InvoicesListStubViewModel(owner: .personal) { _ in })
    }
}
#endif
