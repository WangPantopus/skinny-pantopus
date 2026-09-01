//
//  InviteeLandingStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — C5 Book · Stream I5.
//  Placeholder for the I5 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for C5 (Book). Stream I5 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class InviteeLandingStubViewModel {
    let slug: String
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        slug: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.slug = slug
        self.push = push
    }
}

struct InviteeLandingStubView: View {
    private let viewModel: BookingLandingViewModel

    init(viewModel stub: InviteeLandingStubViewModel) {
        viewModel = BookingLandingViewModel(
            slug: stub.slug,
            push: stub.push,
            client: SchedulingClient.shared
        )
    }

    var body: some View {
        BookingLandingView(viewModel: viewModel)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        InviteeLandingStubView(viewModel: InviteeLandingStubViewModel(slug: "preview") { _ in })
    }
}
#endif
