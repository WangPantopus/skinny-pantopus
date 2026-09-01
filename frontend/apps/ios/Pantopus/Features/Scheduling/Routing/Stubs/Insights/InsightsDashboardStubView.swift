//
//  InsightsDashboardStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — H9 Insights · Stream I17.
//  Placeholder for the I17 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for H9 (Insights). Stream I17 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class InsightsDashboardStubViewModel {
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

struct InsightsDashboardStubView: View {
    @State private var viewModel: InsightsDashboardStubViewModel

    init(viewModel: InsightsDashboardStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        InsightsDashboardView(owner: viewModel.owner, push: viewModel.push)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        InsightsDashboardStubView(viewModel: InsightsDashboardStubViewModel(owner: .personal) { _ in })
    }
}
#endif
