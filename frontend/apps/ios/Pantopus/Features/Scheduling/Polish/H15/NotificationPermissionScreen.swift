//
//  NotificationPermissionScreen.swift
//  Pantopus
//
//  H15 · Stream I18. The routed full-screen host for the channel-connect prompt.
//  Reconciles the opening frame with the live OS push status, renders the shared
//  `NotificationChannelPromptView`, and pops the navigation stack when the prompt
//  finishes. The same view model is what reminder/workflow channel toggles (I16)
//  drive inside a `.sheet`. Tokens only.
//

import SwiftUI

struct NotificationPermissionScreenView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel: NotificationPermissionViewModel

    init(viewModel: NotificationPermissionViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        NotificationChannelPromptView(viewModel: viewModel, showsCloseButton: false)
            .navigationTitle("Notifications")
            .navigationBarTitleDisplayMode(.inline)
            .task { await viewModel.onAppear() }
            .onChange(of: viewModel.isFinished) { _, finished in
                if finished { dismiss() }
            }
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .accessibilityIdentifier("scheduling.notificationPermissionScreen")
    }

    /// The signed-in account's email — the address email reminders use.
    @MainActor
    static func currentAccountEmail() -> String {
        if case let .signedIn(user) = AuthManager.shared.state {
            return user.email
        }
        return ""
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        NotificationPermissionScreenView(
            viewModel: NotificationPermissionViewModel(
                owner: .personal,
                initialFrame: .push,
                accountEmail: "maria@pantopus.co",
                service: .shared
            ) { _ in }
        )
    }
}
#endif
