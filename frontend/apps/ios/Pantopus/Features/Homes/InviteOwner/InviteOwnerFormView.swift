//
//  InviteOwnerFormView.swift
//  Pantopus
//
//  A13.2 — Invite Owner as a single-screen form. Presented as a modal
//  form with top-bar Send action; ownership math lives in the form body.
//

import SwiftUI

/// Invite-an-owner form for a given home.
@MainActor
public struct InviteOwnerFormView: View {
    @State private var viewModel: InviteOwnerFormViewModel
    private let onClose: @MainActor () -> Void

    public init(
        homeId: String,
        currentUserEmail: String,
        onClose: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(initialValue: InviteOwnerFormViewModel(
            homeId: homeId,
            currentUserEmail: currentUserEmail
        ))
        self.onClose = onClose
    }

    init(
        viewModel: InviteOwnerFormViewModel,
        onClose: @escaping @MainActor () -> Void = {}
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onClose = onClose
    }

    public var body: some View {
        content
            .formShakeOnChange(of: viewModel.shakeTrigger)
            .toolbar(.hidden, for: .tabBar)
            .background(Theme.Color.appBg)
            .accessibilityIdentifier("inviteOwnerForm")
            .task { await viewModel.load() }
            .overlay(alignment: .bottom) { toastOverlay }
            .pantopusAnimation(.componentState, value: viewModel.toast)
            .onChange(of: viewModel.shouldDismiss) { _, dismiss in
                guard dismiss else { return }
                viewModel.acknowledgeDismiss()
                onClose()
            }
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            InviteOwnerLoadingForm(onClose: onClose)
        case .empty:
            InviteOwnerEmptyForm(onClose: onClose) {
                Task { await viewModel.refresh() }
            }
        case let .error(message):
            InviteOwnerErrorForm(message: message, onClose: onClose) {
                Task { await viewModel.refresh() }
            }
        case .editing:
            InviteOwnerLoadedForm(
                viewModel: viewModel,
                onClose: onClose
            ) {
                Task { await viewModel.submit() }
            }
        }
    }

    @ViewBuilder private var toastOverlay: some View {
        if let toast = viewModel.toast {
            ToastView(message: toast)
                .padding(.bottom, Spacing.s8)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .task(id: toast) {
                    try? await Task.sleep(nanoseconds: 2_000_000_000)
                    viewModel.toast = nil
                }
                .accessibilityIdentifier("inviteOwnerToast")
        }
    }
}

@MainActor
struct InviteOwnerLoadedForm: View {
    @Bindable var viewModel: InviteOwnerFormViewModel
    let onClose: @MainActor () -> Void
    let onCommit: @MainActor () -> Void

    var body: some View {
        FormShell(
            title: "Invite owner",
            rightActionLabel: "Send",
            isValid: viewModel.isValid,
            isDirty: viewModel.isDirty,
            isSaving: viewModel.isSaving,
            onClose: onClose,
            onCommit: onCommit
        ) {
            InviteOwnerFormContent(viewModel: viewModel)
        }
        .accessibilityIdentifier("inviteOwnerLoadedForm")
    }
}

private struct InviteOwnerLoadingForm: View {
    let onClose: @MainActor () -> Void

    var body: some View {
        FormShell(
            title: "Invite owner",
            rightActionLabel: "Send",
            isValid: false,
            isDirty: false,
            onClose: onClose,
            onCommit: {},
            content: {
                VStack(alignment: .leading, spacing: Spacing.s5) {
                    Shimmer(height: 52, cornerRadius: Radii.lg)
                        .padding(.horizontal, Spacing.s4)
                    FormFieldGroup("Contact info") {
                        Shimmer(height: 64, cornerRadius: Radii.md)
                        Shimmer(height: 64, cornerRadius: Radii.md)
                    }
                    FormFieldGroup("Ownership share") {
                        Shimmer(height: 44, cornerRadius: Radii.md)
                        Shimmer(height: 44, cornerRadius: Radii.md)
                    }
                    FormFieldGroup("Role") {
                        Shimmer(height: 128, cornerRadius: Radii.md)
                    }
                }
                .accessibilityIdentifier("inviteOwnerLoading")
            }
        )
    }
}

private struct InviteOwnerEmptyForm: View {
    let onClose: @MainActor () -> Void
    let onRetry: @MainActor () -> Void

    var body: some View {
        FormShell(
            title: "Invite owner",
            rightActionLabel: "Send",
            isValid: false,
            isDirty: false,
            onClose: onClose,
            onCommit: {},
            content: {
                EmptyState(
                    icon: .home,
                    headline: "No ownership context",
                    subcopy: "Add or verify this home before inviting another owner.",
                    cta: .init(title: "Reload") { onRetry() },
                    tint: Theme.Color.homeBg,
                    accent: Theme.Color.home
                )
                .frame(minHeight: 520)
                .accessibilityIdentifier("inviteOwnerEmpty")
            }
        )
    }
}

private struct InviteOwnerErrorForm: View {
    let message: String
    let onClose: @MainActor () -> Void
    let onRetry: @MainActor () -> Void

    var body: some View {
        FormShell(
            title: "Invite owner",
            rightActionLabel: "Send",
            isValid: false,
            isDirty: false,
            onClose: onClose,
            onCommit: {},
            content: {
                EmptyState(
                    icon: .alertCircle,
                    headline: "Couldn't load ownership",
                    subcopy: message,
                    cta: .init(title: "Try again") { onRetry() },
                    tint: Theme.Color.errorBg,
                    accent: Theme.Color.error
                )
                .frame(minHeight: 520)
                .accessibilityIdentifier("inviteOwnerError")
            }
        )
    }
}

@available(*, deprecated, message: "Use InviteOwnerFormView; Invite Owner is now a single-screen A13 form.")
public typealias InviteOwnerWizardView = InviteOwnerFormView

#Preview("Valid") {
    InviteOwnerFormView(
        viewModel: InviteOwnerFormViewModel(
            homeId: "preview",
            currentUserEmail: "me@example.com",
            initialDraft: InviteOwnerSampleData.valid,
            initialState: .editing
        )
    )
}

#Preview("Conflict") {
    InviteOwnerFormView(
        viewModel: InviteOwnerFormViewModel(
            homeId: "preview",
            currentUserEmail: "me@example.com",
            initialDraft: InviteOwnerSampleData.conflict,
            initialState: .editing
        )
    )
}
