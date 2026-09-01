//
//  CustomerMyBookingsStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — D11 My Bookings · Stream I7.
//  Placeholder for the I7 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for D11 (My Bookings). Stream I7 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class CustomerMyBookingsStubViewModel {
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.push = push
    }
}

struct CustomerMyBookingsStubView: View {
    private let viewModel: MyBookingsViewModel

    init(viewModel stub: CustomerMyBookingsStubViewModel) {
        viewModel = MyBookingsViewModel(push: stub.push, client: SchedulingClient.shared)
    }

    var body: some View {
        MyBookingsView(viewModel: viewModel)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        CustomerMyBookingsStubView(viewModel: CustomerMyBookingsStubViewModel { _ in })
    }
}
#endif
