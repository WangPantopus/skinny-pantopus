//
//  DeepLinkInterstitialStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — D9 Open in App · Stream I7.
//  Placeholder for the I7 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for D9 (Open in App). Stream I7 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class DeepLinkInterstitialStubViewModel {
    let token: String
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        token: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.token = token
        self.push = push
    }
}

struct DeepLinkInterstitialStubView: View {
    private let viewModel: DeepLinkHandoffViewModel

    init(viewModel stub: DeepLinkInterstitialStubViewModel) {
        viewModel = DeepLinkHandoffViewModel(
            token: stub.token,
            push: stub.push,
            client: SchedulingClient.shared
        )
    }

    var body: some View {
        DeepLinkHandoffView(viewModel: viewModel)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        DeepLinkInterstitialStubView(viewModel: DeepLinkInterstitialStubViewModel(token: "preview") { _ in })
    }
}
#endif
