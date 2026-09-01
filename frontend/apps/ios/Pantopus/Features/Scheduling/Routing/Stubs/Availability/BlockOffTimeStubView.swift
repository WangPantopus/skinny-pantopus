//
//  BlockOffTimeStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — B9 Block Off Time · Stream I3.
//  Placeholder for the I3 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for B9 (Block Off Time). Stream I3 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class BlockOffTimeStubViewModel {
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.push = push
    }
}

struct BlockOffTimeStubView: View {
    @State private var viewModel: BlockOffTimeStubViewModel

    init(viewModel: BlockOffTimeStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        BlockOffTimeView(viewModel: BlockOffTimeViewModel())
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        BlockOffTimeStubView(viewModel: BlockOffTimeStubViewModel { _ in })
    }
}
#endif
