//
//  BlockedUsersView.swift
//  Pantopus
//
//  Thin wrapper around `ListOfRowsView` backed by
//  `BlockedUsersViewModel`. Wired from the Settings index Blocked
//  users row. The Settings stack hides the system nav bar, so this
//  view supplies its own top bar matching `GroupedListView`'s 52pt
//  chrome.
//

import SwiftUI

public struct BlockedUsersView: View {
    @State private var viewModel: BlockedUsersViewModel
    private let onBack: @MainActor () -> Void

    init(
        viewModel: BlockedUsersViewModel = BlockedUsersViewModel(),
        onBack: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            SettingsTopBar(title: "Blocked users", onBack: onBack)
                .accessibilityIdentifier("blockedUsersTopBar")
            ListOfRowsView(dataSource: viewModel)
                .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("blockedUsers")
    }
}

#Preview {
    NavigationStack {
        BlockedUsersView {}
    }
}
