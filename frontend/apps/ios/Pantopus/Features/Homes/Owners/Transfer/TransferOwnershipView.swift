//
//  TransferOwnershipView.swift
//  Pantopus
//
//  A13.4 — Transfer Ownership form. Built on the shared `FormShell` with
//  a bespoke sticky bottom CTA, the buyer-email recipient field, a
//  typed-confirmation field, and a biometric bottom-sheet confirmation
//  step.
//
//  The share slider / before-after split the design sketches has no
//  backend counterpart — `transferOwnerSchema`
//  (`backend/routes/homeOwnership.js:74-79`) carries no percentage and
//  `executeOwnershipTransfer` (line 2238) revokes the seller's row
//  outright — so this screen commits a full transfer.
//
// swiftlint:disable file_length

import SwiftUI

public struct TransferOwnershipView: View {
    @State private var viewModel: TransferOwnershipViewModel
    @Environment(\.dismiss) private var dismiss

    public init(viewModel: TransferOwnershipViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        ZStack(alignment: .bottom) {
            FormShell(
                title: "Transfer ownership",
                leading: .back,
                rightActionLabel: nil,
                isValid: viewModel.isReadyToCommit,
                isDirty: viewModel.isDirty,
                isSaving: false,
                onClose: { dismiss() },
                onCommit: viewModel.presentConfirmSheet,
                content: { TransferOwnershipContent(viewModel: viewModel) },
                stickyBottom: { AnyView(stickyCTA) }
            )
            .accessibilityIdentifier("transferOwnershipForm")
            .toolbar(.hidden, for: .tabBar)

            if viewModel.sheetPhase != .hidden {
                sheetOverlay
                    .transition(.opacity)
            }
        }
        .task { await viewModel.load() }
        .pantopusAnimation(.componentState, value: viewModel.sheetPhase)
        .overlay(alignment: .bottom) {
            if let toast = viewModel.toast {
                ToastView(message: toast)
                    .padding(.bottom, Spacing.s12)
                    .task {
                        try? await Task.sleep(nanoseconds: 2_000_000_000)
                        viewModel.toast = nil
                    }
                    .transition(.opacity)
                    .accessibilityIdentifier("transferOwnershipToast")
            }
        }
        .pantopusAnimation(.componentState, value: viewModel.toast)
        .onChange(of: viewModel.shouldDismiss) { _, shouldDismiss in
            guard shouldDismiss else { return }
            viewModel.acknowledgeDismiss()
            Task {
                try? await Task.sleep(nanoseconds: 800_000_000)
                dismiss()
            }
        }
    }

    private var stickyCTA: some View {
        VStack(spacing: Spacing.s1 + 2) {
            Button(action: viewModel.presentConfirmSheet) {
                HStack(spacing: Spacing.s2) {
                    Icon(.arrowRightLeft, size: 17, color: Theme.Color.appTextInverse)
                    Text(viewModel.ctaLabel)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, minHeight: 48)
            }
            .background(viewModel.isReadyToCommit ? Theme.Color.primary600 : Theme.Color.appBorderStrong)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .shadow(
                color: viewModel.isReadyToCommit
                    ? Theme.Color.primary600.opacity(0.28)
                    : .clear,
                radius: 8,
                y: 4
            )
            .disabled(!viewModel.isReadyToCommit)
            .accessibilityIdentifier("transferOwnershipCTA")

            HStack(spacing: Spacing.s1) {
                Icon(.lock, size: 11, color: Theme.Color.appTextSecondary)
                Text("Confirmed with \(viewModel.biometryLabel) after tap")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s6 + 4)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Theme.Color.appBorderSubtle)
                .frame(height: 1)
        }
    }

    private var sheetOverlay: some View {
        ZStack(alignment: .bottom) {
            Color.black.opacity(0.5)
                .ignoresSafeArea()
                .onTapGesture {
                    viewModel.dismissConfirmSheet()
                }
                .accessibilityHidden(true)
            VStack(spacing: Spacing.s0) {
                if let message = viewModel.biometricErrorMessage {
                    HStack(spacing: 6) {
                        Icon(.alertCircle, size: 14, color: Theme.Color.error)
                        Text(message)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Theme.Color.error)
                    }
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, Spacing.s2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.Color.errorBg)
                    .accessibilityIdentifier("faceIDConfirmError")
                }
                FaceIDConfirmSheet(
                    parties: viewModel.confirmSheetParties,
                    recipientName: viewModel.recipientEmail,
                    homeAddress: viewModel.homeAddress,
                    coOwnerNames: viewModel.coOwnerNames,
                    timestamp: viewModel.confirmationTimestamp,
                    biometryLabel: viewModel.biometryLabel,
                    isAuthenticating: viewModel.sheetPhase == .authenticating,
                    onCancel: viewModel.dismissConfirmSheet
                ) {
                    Task { await viewModel.authenticateAndCommit() }
                }
            }
            .background(Theme.Color.appSurface)
            .frame(maxWidth: .infinity)
            .transition(.move(edge: .bottom))
        }
        .ignoresSafeArea(edges: .bottom)
    }
}

// MARK: - Form body

private struct TransferOwnershipContent: View {
    @Bindable var viewModel: TransferOwnershipViewModel

    var body: some View {
        switch viewModel.loadState {
        case .loading:
            HomeStripSkeleton()
                .padding(.horizontal, Spacing.s4)
        case let .error(message):
            TransferLoadError(message: message) {
                Task { await viewModel.refresh() }
            }
            .padding(.horizontal, Spacing.s4)
        case .loaded:
            HomeStrip(
                title: viewModel.homeTitle,
                address: viewModel.homeAddress,
                ownerSummary: viewModel.ownerSummary
            )
            .padding(.horizontal, Spacing.s4)
        }

        FormFieldGroup("Recipient") {
            RecipientEmailField(viewModel: viewModel)
            if viewModel.recipientIsValid {
                TransferRecipientCard(
                    email: viewModel.recipientEmail,
                    initials: viewModel.recipientInitials
                ) {
                    viewModel.clearRecipientEmail()
                }
            }
        }

        FormFieldGroup("Confirmation") {
            ConfirmationField(viewModel: viewModel)
            WarningBlock(text: viewModel.warningCopy)
        }
    }
}

// MARK: - Home strip

private struct HomeStrip: View {
    let title: String
    let address: String
    let ownerSummary: String

    var body: some View {
        HStack(spacing: Spacing.s2 + 2) {
            ZStack {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [Theme.Color.success, Theme.Color.homeDark],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 32, height: 32)
                Icon(.home, size: 15, color: Theme.Color.appTextInverse)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                Text(ownerSummary)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s0)
            HStack(spacing: 3) {
                Icon(.alertTriangle, size: 9, color: Theme.Color.warning)
                Text("IRREVERSIBLE")
                    .font(.system(size: 9.5, weight: .bold))
                    .tracking(0.6)
                    .foregroundStyle(Theme.Color.warning)
            }
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(Theme.Color.warningLight.opacity(0.7))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                    .stroke(Theme.Color.warningLight, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2 + 2)
        .background(Theme.Color.appSurfaceRaised)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md + 2, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md + 2, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(address), \(ownerSummary), transfer is irreversible")
        .accessibilityIdentifier("transferHomeStrip")
    }
}

private struct HomeStripSkeleton: View {
    var body: some View {
        HStack(spacing: Spacing.s2 + 2) {
            Shimmer(width: 32, height: 32, cornerRadius: 9)
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Shimmer(width: 140, height: 11, cornerRadius: Radii.xs)
                Shimmer(width: 96, height: 9, cornerRadius: Radii.xs)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2 + 2)
        .background(Theme.Color.appSurfaceRaised)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md + 2, style: .continuous))
        .accessibilityIdentifier("transferHomeStripSkeleton")
    }
}

private struct TransferLoadError: View {
    let message: String
    let onRetry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Couldn't load this home")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Button("Retry", action: onRetry)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.primary600)
                .accessibilityIdentifier("transferOwnershipRetry")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.s3)
        .background(Theme.Color.appSurfaceRaised)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md + 2, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md + 2, style: .continuous))
        .accessibilityIdentifier("transferOwnershipLoadError")
    }
}

// MARK: - Recipient email

private struct RecipientEmailField: View {
    @Bindable var viewModel: TransferOwnershipViewModel

    var body: some View {
        PantopusTextField(
            "Buyer's email",
            text: Binding(
                get: { viewModel.recipientField.value },
                set: { viewModel.updateRecipientEmail($0) }
            ),
            placeholder: "buyer@example.com",
            state: viewModel.recipientFieldState,
            isRequired: true,
            keyboardType: .emailAddress,
            contentType: .emailAddress,
            identifier: "field_recipientEmail"
        )
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
    }
}

// MARK: - Recipient card

private struct TransferRecipientCard: View {
    let email: String
    let initials: String
    let onClear: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Theme.Color.business, Theme.Color.businessDark],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                Text(initials)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(width: 48, height: 48)
            VStack(alignment: .leading, spacing: 2) {
                Text(email)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                Text(
                    "We'll notify this address. If they don't have a Pantopus "
                        + "account yet, the claim waits for them to sign up."
                )
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s0)
            Button(action: onClear) {
                Text("Change")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary600)
            }
            .accessibilityIdentifier("recipientClearButton")
        }
        .padding(Spacing.s3 + 2)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.primary600, lineWidth: 1.5)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Transfer recipient \(email)")
        .accessibilityIdentifier("recipientCard")
    }
}

// MARK: - Confirmation field

private struct ConfirmationField: View {
    @Bindable var viewModel: TransferOwnershipViewModel
    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: 2) {
                Text("Type ")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                Text(viewModel.confirmationPhrase)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(Theme.Color.appText)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 1)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
                Text(" to confirm")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                Text("*")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.error)
            }
            HStack(spacing: Spacing.s2) {
                TextField(
                    viewModel.confirmationPhrase,
                    text: Binding(
                        get: { viewModel.confirmationField.value },
                        set: { viewModel.updateConfirmation($0) }
                    )
                )
                .font(.system(size: 14, design: .monospaced))
                .autocorrectionDisabled()
                .textInputAutocapitalization(.characters)
                .focused($isFocused)
                .accessibilityIdentifier("field_confirmationPhrase")
                .accessibilityLabel("Type \(viewModel.confirmationPhrase) to confirm")
                if viewModel.confirmationMatches {
                    Icon(.check, size: 18, color: Theme.Color.success)
                }
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 44)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(
                        viewModel.confirmationMatches
                            ? Theme.Color.success
                            : (isFocused ? Theme.Color.primary600 : Theme.Color.appBorder),
                        lineWidth: isFocused || viewModel.confirmationMatches ? 2 : 1
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
    }
}

// MARK: - Warning block

private struct WarningBlock: View {
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.info, size: 14, color: Theme.Color.warning)
                .padding(.top, 2)
            Text(text)
                .font(.system(size: 11.5))
                .foregroundStyle(Theme.Color.warning)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2 + 2)
        .background(Theme.Color.warningBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md + 2, style: .continuous)
                .stroke(Theme.Color.warningLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md + 2, style: .continuous))
        .accessibilityIdentifier("transferIrreversibleWarning")
    }
}

#Preview("Ready") {
    let viewModel = TransferOwnershipViewModel(
        homeId: "preview",
        biometricEvaluator: { _ in .success(()) },
        transferExecutor: { _ in "Transfer initiated." }
    )
    viewModel.updateRecipientEmail("buyer@example.com")
    return NavigationStack {
        TransferOwnershipView(viewModel: viewModel)
    }
}

#Preview("Confirm sheet") {
    let viewModel = TransferOwnershipViewModel(
        homeId: "preview",
        biometricEvaluator: { _ in .success(()) },
        transferExecutor: { _ in "Transfer initiated." }
    )
    viewModel.updateRecipientEmail("buyer@example.com")
    viewModel.updateConfirmation(TransferOwnershipViewModel.confirmationPhraseLiteral)
    viewModel.presentConfirmSheet()
    return NavigationStack {
        TransferOwnershipView(viewModel: viewModel)
    }
}
