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
    /// How neighbors see you, the card in the list's header slot.
    @State private var neighbors = NeighborsSeeYouViewModel()
    private let onBack: @MainActor () -> Void

    public init(
        viewModel: PrivacySettingsViewModel,
        onBack: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
    }

    public var body: some View {
        GroupedListView(dataSource: viewModel, onBack: onBack, headerView: AnyView(NeighborsSeeYouCard(viewModel: neighbors)))
            .accessibilityIdentifier("privacySettings")
            .task {
                neighbors.onToast = { [weak viewModel] toast in viewModel?.toast = toast }
                await neighbors.load()
            }
            .sheet(isPresented: $viewModel.isDeleteSheetPresented) {
                AccountDeleteSheet(
                    isDeleting: viewModel.isDeletingAccount,
                    errorMessage: viewModel.deleteAccountError,
                    organizedLiveTrainCount: viewModel.organizedLiveTrainCount,
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
                        .dismissToast(after: toast, minimum: 2) {
                            viewModel.toast = nil
                        }
                }
            }
            .pantopusAnimation(.componentState, value: viewModel.toast?.text)
            // Your privacy settings changed on another device (`profile:me`), or your account did: an account edit
            // moves the name and photo neighbors see while they are still the account's.
            .refreshesOnStoreChange(affects: { $0.names(topic: ScreenTopic.profileMe) }, perform: {
                await viewModel.refreshFromSignal()
                await neighbors.load()
            })
    }
}

#Preview("Defaults") {
    PrivacyView(viewModel: PrivacySettingsViewModel(variant: .populated)) {}
}

#Preview("Stealth") {
    PrivacyView(viewModel: PrivacySettingsViewModel(variant: .stealth)) {}
}
