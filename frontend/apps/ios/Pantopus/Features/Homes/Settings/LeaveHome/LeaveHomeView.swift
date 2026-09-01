//
//  LeaveHomeView.swift
//  Pantopus
//
//  Destructive confirmation to leave a home (move-out). Mirrors Android
//  `LeaveHomeScreen`.
//

import SwiftUI

public struct LeaveHomeView: View {
    @State private var viewModel: LeaveHomeViewModel
    private let onBack: @MainActor () -> Void
    private let onLeft: @MainActor () -> Void

    public init(
        viewModel: LeaveHomeViewModel,
        onBack: @escaping @MainActor () -> Void,
        onLeft: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
        self.onLeft = onLeft
    }

    public var body: some View {
        FormShell(
            title: "Leave home",
            leading: .back,
            rightActionLabel: nil,
            bottomActionLabel: viewModel.isSubmitting ? "Leaving…" : "Leave this home",
            isValid: !viewModel.isSubmitting,
            isDirty: false,
            isSaving: viewModel.isSubmitting,
            onClose: onBack,
            onCommit: { viewModel.submit() },
            content: {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    if let errorMessage = viewModel.errorMessage {
                        Text(errorMessage)
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.Color.error)
                            .accessibilityIdentifier("leaveHomeError")
                    }
                    Text("Leave this home?")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .accessibilityAddTraits(.isHeader)
                    Text(
                        "You will lose access to mail, tasks, and household features for this address. You can request to join again later."
                    )
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(Spacing.s4)
            }
        )
        .toolbar(.hidden, for: .tabBar)
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("leaveHome")
        .onChange(of: viewModel.shouldDismissAfterLeave) { _, shouldDismiss in
            guard shouldDismiss else { return }
            viewModel.acknowledgeDismiss()
            onLeft()
        }
    }
}
