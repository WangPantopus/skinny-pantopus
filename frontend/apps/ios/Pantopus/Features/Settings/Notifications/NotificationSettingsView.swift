//
//  NotificationSettingsView.swift
//  Pantopus
//
//  A14.5 — Notification & briefing preferences. Thin wrapper around
//  `GroupedListView`; `NotificationSettingsViewModel` owns the four
//  cards, the `GET/PUT /api/hub/preferences` round-trip, and the
//  debounced optimistic save. Named `NotificationSettings…` (not
//  `Notifications…`) to avoid colliding with the notification-feed
//  `NotificationsView`.
//

import SwiftUI

public struct NotificationSettingsView: View {
    @State private var viewModel: NotificationSettingsViewModel
    private let onBack: @MainActor () -> Void

    public init(onBack: @escaping @MainActor () -> Void) {
        _viewModel = State(initialValue: NotificationSettingsViewModel())
        self.onBack = onBack
    }

    /// Test / preview seam — inject a view-model driven by a stubbed
    /// `APIClient`.
    init(
        viewModel: NotificationSettingsViewModel,
        onBack: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
    }

    public var body: some View {
        GroupedListView(dataSource: viewModel, onBack: onBack)
            .accessibilityIdentifier("notificationSettings")
            .overlay(alignment: .bottom) {
                if let toast = viewModel.toast {
                    ToastView(message: toast)
                        .padding(.bottom, Spacing.s10)
                        .accessibilityIdentifier("notificationSettingsToast")
                        .transition(.opacity)
                        .task(id: toast.text) {
                            try? await Task.sleep(nanoseconds: 2_000_000_000)
                            viewModel.toast = nil
                        }
                }
            }
            .pantopusAnimation(.componentState, value: viewModel.toast?.text)
    }
}

#Preview("Notification preferences") {
    NotificationSettingsView {}
}
