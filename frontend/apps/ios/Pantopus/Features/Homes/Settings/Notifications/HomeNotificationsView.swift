//
//  HomeNotificationsView.swift
//  Pantopus
//
//  A14.1 — Per-home notification preferences. Mirrors Android
//  `HomeNotificationsScreen`.
//

import SwiftUI

public struct HomeNotificationsView: View {
    @State private var viewModel: HomeNotificationsViewModel
    private let onBack: @MainActor () -> Void

    public init(
        homeId: String,
        onBack: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(initialValue: HomeNotificationsViewModel(homeId: homeId))
        self.onBack = onBack
    }

    public var body: some View {
        GroupedListView(dataSource: viewModel, onBack: onBack)
            .task { await viewModel.load() }
            .accessibilityIdentifier("homeNotifications")
    }
}
