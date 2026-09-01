//
//  InvoiceDetailStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — G13 Invoice · Stream I15.
//  Placeholder for the I15 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for G13 (Invoice). Stream I15 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class InvoiceDetailStubViewModel {
    let owner: SchedulingOwner
    let invoiceId: String
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        owner: SchedulingOwner,
        invoiceId: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.owner = owner
        self.invoiceId = invoiceId
        self.push = push
    }
}

struct InvoiceDetailStubView: View {
    @State private var viewModel: InvoiceDetailStubViewModel

    init(viewModel: InvoiceDetailStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        SchedulingInvoiceDetailView(owner: viewModel.owner, invoiceId: viewModel.invoiceId, push: viewModel.push)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        InvoiceDetailStubView(viewModel: InvoiceDetailStubViewModel(owner: .personal, invoiceId: "preview") { _ in })
    }
}
#endif
