//
//  NoShowReportStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — H11 No-show Report · Stream I17.
//  Placeholder for the I17 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for H11 (No-show Report). Stream I17 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class NoShowReportStubViewModel {
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

struct NoShowReportStubView: View {
    @State private var viewModel: NoShowReportStubViewModel

    init(viewModel: NoShowReportStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        NoShowReportView(owner: viewModel.owner, push: viewModel.push)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        NoShowReportStubView(viewModel: NoShowReportStubViewModel(owner: .personal) { _ in })
    }
}
#endif
