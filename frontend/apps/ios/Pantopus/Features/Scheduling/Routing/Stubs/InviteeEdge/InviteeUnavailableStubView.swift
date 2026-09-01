//
//  InviteeUnavailableStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — D7 Unavailable · Stream I7.
//  Placeholder for the I7 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for D7 (Unavailable). Stream I7 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class InviteeUnavailableStubViewModel {
    let slug: String?
    let oneOffToken: String?
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        slug: String?,
        oneOffToken: String?,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.slug = slug
        self.oneOffToken = oneOffToken
        self.push = push
    }
}

struct InviteeUnavailableStubView: View {
    private let viewModel: TerminalStateViewModel

    init(viewModel stub: InviteeUnavailableStubViewModel) {
        viewModel = TerminalStateViewModel(
            slug: stub.slug,
            oneOffToken: stub.oneOffToken,
            push: stub.push,
            client: SchedulingClient.shared
        )
    }

    var body: some View {
        TerminalStateView(viewModel: viewModel)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        InviteeUnavailableStubView(viewModel: InviteeUnavailableStubViewModel(slug: nil, oneOffToken: nil) { _ in })
    }
}
#endif
