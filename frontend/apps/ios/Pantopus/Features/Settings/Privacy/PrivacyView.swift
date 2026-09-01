//
//  PrivacyView.swift
//  Pantopus
//
//  P7.6 / A14.7 — Privacy preferences. Thin wrapper around
//  `GroupedListView`; `PrivacySettingsViewModel` owns the RadioCards,
//  the location-fuzz section, the activity toggles, the data rows, and
//  the stealth banner. The banner + fuzz section render through the
//  shared shell, so this wrapper stays thin.
//

import SwiftUI

public struct PrivacyView: View {
    @State private var viewModel: PrivacySettingsViewModel
    private let onBack: @MainActor () -> Void

    public init(
        viewModel: PrivacySettingsViewModel,
        onBack: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
    }

    public var body: some View {
        GroupedListView(dataSource: viewModel, onBack: onBack)
            .accessibilityIdentifier("privacySettings")
            .sheet(isPresented: $viewModel.isDeleteSheetPresented) {
                AccountDeleteSheet(
                    isDeleting: viewModel.isDeletingAccount,
                    errorMessage: viewModel.deleteAccountError,
                    onCancel: { viewModel.dismissDeleteSheet() },
                    onConfirm: { await viewModel.confirmDeleteAccount() }
                )
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
                .interactiveDismissDisabled(viewModel.isDeletingAccount)
            }
            .overlay(alignment: .bottom) {
                if let toast = viewModel.toast {
                    ToastView(message: toast)
                        .padding(.bottom, Spacing.s10)
                        .accessibilityIdentifier("privacySettingsToast")
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

#Preview("Defaults") {
    PrivacyView(viewModel: PrivacySettingsViewModel(variant: .populated)) {}
}

#Preview("Stealth") {
    PrivacyView(viewModel: PrivacySettingsViewModel(variant: .stealth)) {}
}
