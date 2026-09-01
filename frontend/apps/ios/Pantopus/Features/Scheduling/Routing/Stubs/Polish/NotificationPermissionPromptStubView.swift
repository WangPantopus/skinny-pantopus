//
//  NotificationPermissionPromptStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed seam — H15 Notifications · Stream I18.
//  FILLED by I18: the view-model stub carries the route payload (owner + push),
//  and the body now hosts the real channel-connect prompt. The router and the
//  `NotifPermissionPromptStubView`/`…ViewModel` type names are frozen, so the
//  real screen + view model live in `Features/Scheduling/Polish/H15/*` and are
//  bridged here (mirrors the I13 stub-fill pattern).
//

import SwiftUI

/// Routed-screen view-model stub for H15 (Notifications). Carries the route
/// payload; `push` is retained for parity with the seam (the prompt navigates no
/// deeper, so it is unused here).
@Observable
@MainActor
final class NotifPermissionPromptStubViewModel {
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

struct NotifPermissionPromptStubView: View {
    private let viewModel: NotificationPermissionViewModel

    init(viewModel stub: NotifPermissionPromptStubViewModel) {
        viewModel = NotificationPermissionViewModel(
            owner: stub.owner,
            initialFrame: .push,
            accountEmail: NotificationPermissionScreenView.currentAccountEmail(),
            service: .shared
        ) { _ in }
    }

    var body: some View {
        NotificationPermissionScreenView(viewModel: viewModel)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        NotifPermissionPromptStubView(viewModel: NotifPermissionPromptStubViewModel(owner: .personal) { _ in })
    }
}
#endif
