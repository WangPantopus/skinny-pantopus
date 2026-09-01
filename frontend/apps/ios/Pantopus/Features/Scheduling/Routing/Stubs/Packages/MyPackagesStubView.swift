//
//  MyPackagesStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — G11 My Packages · Stream I15.
//  Placeholder for the I15 feature stream to replace. The init is
//  wired with `push`; the route/router are frozen. Customer self-service
//  route — no owner context.
//
//

import SwiftUI

/// Routed-screen view-model stub for G11 (My Packages). Stream I15 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class MyPackagesStubViewModel {
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(push: @escaping @MainActor (SchedulingRoute) -> Void) {
        self.push = push
    }
}

struct MyPackagesStubView: View {
    @State private var viewModel: MyPackagesStubViewModel

    init(viewModel: MyPackagesStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        MyPackagesView(push: viewModel.push)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        MyPackagesStubView(viewModel: MyPackagesStubViewModel { _ in })
    }
}
#endif
