//
//  PasswordChangeView.swift
//  Pantopus
//
//  A13.14 — Settings → Change password (reshape).
//
//  Bespoke shell rather than `FormShell`: the top bar carries only a back
//  chevron + title (no top-right Save), and the commit lives inline at the
//  bottom of the body as an `Update password` button. A `ContextBand` pins
//  under the top bar; the body stacks the "Verify it's you" + "Choose a new
//  one" sections, a `StrengthMeter`, the inline CTA, a Cancel link, and an
//  info chip. A `FormBanner` appears at the top after a rejected submit.
//

import SwiftUI

public struct PasswordChangeView: View {
    @State private var viewModel: PasswordChangeViewModel
    private let onBack: @MainActor () -> Void

    init(
        viewModel: PasswordChangeViewModel = PasswordChangeViewModel(),
        onBack: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            topBar
            ContextBand(email: viewModel.accountEmail, lastChanged: viewModel.lastChangedLabel)
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s5) {
                    if let formError = viewModel.formError {
                        FormBanner(tone: .error, title: formError.title, message: formError.message)
                    }
                    if viewModel.requiresCurrent {
                        verifySection
                    }
                    chooseNewSection
                    actions
                    if viewModel.formError == nil {
                        infoChip
                    }
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s4)
            }
            .background(Theme.Color.appBg)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("passwordChange")
        .task { await viewModel.load() }
        .overlay(alignment: .bottom) {
            if let toast = viewModel.toast {
                ToastView(message: ToastMessage(text: toast, kind: .success))
                    .padding(.bottom, Spacing.s10)
                    .accessibilityIdentifier("passwordChangeToast")
                    .transition(.opacity)
                    .task {
                        try? await Task.sleep(nanoseconds: 2_000_000_000)
                        viewModel.dismissToast()
                    }
            }
        }
        .pantopusAnimation(.componentState, value: viewModel.toast)
        .onChange(of: viewModel.shouldDismiss) { _, newValue in
            guard newValue else { return }
            viewModel.acknowledgeDismiss()
            Task {
                try? await Task.sleep(nanoseconds: 700_000_000)
                onBack()
            }
        }
    }

    // MARK: - Top bar

    private var topBar: some View {
        ZStack {
            Text("Change password")
                .pantopusTextStyle(.body)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            HStack {
                Button(action: onBack) {
                    Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel("Back")
                .accessibilityIdentifier("passwordChangeBack")
                Spacer()
                // Reserve the trailing slot so the title stays optically centered.
                Color.clear.frame(width: 44, height: 44)
            }
            .padding(.horizontal, Spacing.s2)
        }
        .frame(height: 44)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }

    // MARK: - Sections

    private var verifySection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            SectionHeader("Verify it's you")
            PasswordEntryField(
                "Current password",
                text: binding(.current),
                state: state(for: .current),
                isRequired: true,
                leftIcon: .lock,
                contentType: .password,
                identifier: "field_current"
            )
            if viewModel.fields[.current]?.error != nil {
                Button(
                    action: { viewModel.requestResetLink() },
                    label: {
                        HStack(spacing: Spacing.s1) {
                            Icon(.mail, size: 12, color: Theme.Color.primary600)
                            Text("Email me a reset link instead")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Theme.Color.primary600)
                        }
                    }
                )
                .buttonStyle(.plain)
                .accessibilityIdentifier("passwordChangeResetLink")
            }
        }
    }

    private var chooseNewSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            SectionHeader("Choose a new one")
            VStack(alignment: .leading, spacing: Spacing.s2) {
                PasswordEntryField(
                    "New password",
                    text: binding(.new),
                    state: state(for: .new),
                    isRequired: true,
                    revealedByDefault: viewModel.isNewValid,
                    contentType: .newPassword,
                    identifier: "field_new"
                )
                StrengthMeter(viewModel.strength)
            }
            PasswordEntryField(
                "Confirm new password",
                text: binding(.confirm),
                state: state(for: .confirm),
                isRequired: true,
                helper: viewModel.isConfirmValid ? "Matches new password." : nil,
                contentType: .newPassword,
                identifier: "field_confirm"
            )
        }
    }

    // MARK: - Actions

    private var actions: some View {
        VStack(spacing: Spacing.s2) {
            updateButton
            Button(action: onBack) {
                Text("Cancel")
                    .font(.system(size: 13, weight: .semibold))
                    .underline()
                    .foregroundStyle(Theme.Color.primary600)
                    .frame(maxWidth: .infinity, minHeight: 38)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("passwordChangeCancel")
        }
    }

    private var updateButton: some View {
        Button(
            action: { Task { await viewModel.save() } },
            label: {
                Group {
                    if viewModel.isSaving {
                        ProgressView().tint(Theme.Color.appTextInverse)
                    } else {
                        HStack(spacing: Spacing.s2) {
                            Icon(
                                viewModel.isValid ? .keyRound : .lock,
                                size: 16,
                                color: viewModel.isValid ? Theme.Color.appTextInverse : Theme.Color.appTextMuted
                            )
                            Text("Update password")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(viewModel.isValid ? Theme.Color.appTextInverse : Theme.Color.appTextMuted)
                        }
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 50)
            }
        )
        .background(viewModel.isValid ? Theme.Color.primary600 : Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .disabled(!viewModel.isValid || viewModel.isSaving)
        .accessibilityLabel("Update password")
        .accessibilityIdentifier("passwordChangeUpdateButton")
    }

    private var infoChip: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.info, size: 13, color: Theme.Color.primary600)
                .padding(.top, 1)
            Text("You'll be signed out of other devices after updating.")
                .font(.system(size: 11.5))
                .foregroundStyle(Theme.Color.primary700)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.primary50)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.primary200, lineWidth: 1)
        )
        .accessibilityIdentifier("passwordChangeInfoChip")
    }

    // MARK: - Helpers

    private func binding(_ key: PasswordChangeViewModel.FieldKey) -> Binding<String> {
        Binding(
            get: { viewModel.fields[key]?.value ?? "" },
            set: { viewModel.update(key, to: $0) }
        )
    }

    private func state(for key: PasswordChangeViewModel.FieldKey) -> PantopusFieldState {
        if let error = viewModel.fields[key]?.error { return .error(error) }
        switch key {
        case .current: return viewModel.isCurrentValid ? .valid : .default
        case .new: return viewModel.isNewValid ? .valid : .default
        case .confirm: return viewModel.isConfirmValid ? .valid : .default
        }
    }
}

#Preview {
    NavigationStack {
        PasswordChangeView {}
    }
}
