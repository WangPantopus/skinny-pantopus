//
//  FindATimeSuggestedStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — F5 Suggested Times · Stream I11.
//  Placeholder for the I11 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for F5 (Suggested Times). Stream I11 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class FindATimeSuggestedStubViewModel {
    let homeId: String
    let tz: String
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        homeId: String,
        tz: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.homeId = homeId
        self.tz = tz
        self.push = push
    }
}

struct FindATimeSuggestedStubView: View {
    private let viewModel: FindATimeSuggestedViewModel

    init(viewModel stub: FindATimeSuggestedStubViewModel) {
        viewModel = FindATimeSuggestedViewModel(
            homeId: stub.homeId,
            tz: stub.tz,
            draft: FindATimeDraftStore.draft,
            push: stub.push,
            client: .shared
        )
    }

    var body: some View {
        FindATimeSuggestedView(viewModel: viewModel)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        FindATimeSuggestedStubView(viewModel: FindATimeSuggestedStubViewModel(homeId: "preview", tz: "preview") { _ in })
    }
}
#endif
