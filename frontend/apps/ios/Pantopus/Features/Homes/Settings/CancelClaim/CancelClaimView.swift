//
//  CancelClaimView.swift
//  Pantopus
//
//  Destructive confirmation to cancel an ownership claim. Mirrors Android
//  `CancelClaimScreen`.
//

import SwiftUI

public struct CancelClaimView: View {
    @State private var viewModel: CancelClaimViewModel
    private let onBack: @MainActor () -> Void
    private let onCancelled: @MainActor () -> Void

    public init(
        viewModel: CancelClaimViewModel,
        onBack: @escaping @MainActor () -> Void,
        onCancelled: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
        self.onCancelled = onCancelled
    }

    public var body: some View {
        FormShell(
            title: "Cancel claim",
            leading: .back,
            rightActionLabel: nil,
            bottomActionLabel: {
                if viewModel.isSubmitting { return "Cancelling…" }
                if case .error = viewModel.phase, viewModel.canSubmit { return "Try again" }
                return "Cancel claim"
            }(),
            isValid: viewModel.canSubmit,
            isDirty: false,
            isSaving: viewModel.isSubmitting,
            onClose: onBack,
            onCommit: { viewModel.submit() },
            content: {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    if let errorMessage = viewModel.errorMessage {
                        Text(errorMessage)
                            .pantopusTextStyle(.small)
                            .foregroundStyle(Theme.Color.error)
                            .accessibilityIdentifier("cancelClaimError")
                    }
                    switch viewModel.phase {
                    case .loading:
                        Shimmer(width: 320, height: 120, cornerRadius: Radii.lg)
                    case let .error(message):
                        Text(message)
                            .pantopusTextStyle(.small)
                            .foregroundStyle(Theme.Color.error)
                            .accessibilityIdentifier("cancelClaimLoadError")
                    case .noClaim:
                        Text("No open ownership claim for this home.")
                            .pantopusTextStyle(.small)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    case .ready, .submitting:
                        Text("Cancel this ownership claim?")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundStyle(Theme.Color.appText)
                            .accessibilityAddTraits(.isHeader)
                        Text(
                            "Your pending claim will be withdrawn. You can start a new claim later if you still need to verify ownership."
                        )
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(Spacing.s4)
            }
        )
        .toolbar(.hidden, for: .tabBar)
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("cancelClaim")
        .task { viewModel.load() }
        .onChange(of: viewModel.shouldDismissAfterCancel) { _, shouldDismiss in
            guard shouldDismiss else { return }
            viewModel.acknowledgeDismiss()
            onCancelled()
        }
    }
}
