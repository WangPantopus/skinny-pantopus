//
//  InviteMemberWizardView.swift
//  Pantopus
//
//  T6.3a / P9 — UI for the Invite Member wizard. Composes WizardShell
//  with three step bodies and dispatches the VM's `pendingEvent` to
//  the caller via `onClose`.
//

import SwiftUI

/// Presented as a sheet from `MembersListView`. Calls `onClose` with
/// the newly-created invitation (or nil on dismiss without submit).
public struct InviteMemberWizardView: View {
    @State private var viewModel: InviteMemberWizardViewModel
    private let onClose: (InvitationDTO?) -> Void

    public init(
        homeId: String,
        onClose: @escaping (InvitationDTO?) -> Void
    ) {
        _viewModel = State(initialValue: InviteMemberWizardViewModel(homeId: homeId))
        self.onClose = onClose
    }

    public var body: some View {
        WizardShell(model: viewModel) {
            stepBody
            if let error = viewModel.errorMessage {
                InviteMemberErrorBanner(message: error)
            }
        }
        .onChange(of: viewModel.pendingEvent) { _, event in
            handle(event)
        }
        .onAppear {
            Analytics.track(
                .screenMembersWizardStepViewed(
                    stepNumber: viewModel.currentStep.stepNumber,
                    stepName: String(describing: viewModel.currentStep)
                )
            )
        }
        .accessibilityIdentifier("inviteMemberWizard")
    }

    @ViewBuilder
    private var stepBody: some View {
        switch viewModel.currentStep {
        case .role:
            RoleStep(viewModel: viewModel)
        case .identify:
            IdentifyStep(viewModel: viewModel)
        case .review:
            ReviewStep(viewModel: viewModel)
        }
    }

    private func handle(_ event: InviteMemberEvent?) {
        guard let event else { return }
        switch event {
        case .dismiss:
            onClose(nil)
        case let .submitted(invitation):
            onClose(invitation)
        }
        viewModel.pendingEvent = nil
    }
}

// MARK: - Step 1: Role

private struct RoleStep: View {
    @Bindable var viewModel: InviteMemberWizardViewModel

    var body: some View {
        HeadlineBlock(InviteMemberStep.role.title)
        SubcopyBlock(InviteMemberStep.role.subcopy)
        VStack(spacing: Spacing.s2) {
            ForEach([MemberRole.member, MemberRole.guest], id: \.self) { role in
                RoleTile(
                    role: role,
                    isSelected: viewModel.form.role == role
                ) {
                    viewModel.setRole(role)
                }
            }
        }
    }
}

private struct RoleTile: View {
    let role: MemberRole
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        let palette = role.palette
        Button(action: onTap) {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(palette.background)
                    Icon(role.icon, size: 22, color: palette.foreground)
                }
                .frame(width: 44, height: 44)
                VStack(alignment: .leading, spacing: 2) {
                    Text(role.label)
                        .pantopusTextStyle(.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appText)
                    Text(role.tileSubcopy)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer()
                if isSelected {
                    Icon(.checkCircle, size: 20, color: Theme.Color.home)
                }
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(
                        isSelected ? Theme.Color.home : Theme.Color.appBorder,
                        lineWidth: isSelected ? 2 : 1
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("inviteMember_role_\(role.rawValue)")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Step 2: Identify

private struct IdentifyStep: View {
    @Bindable var viewModel: InviteMemberWizardViewModel

    var body: some View {
        HeadlineBlock(InviteMemberStep.identify.title)
        SubcopyBlock(InviteMemberStep.identify.subcopy)
        FormFieldsBlock {
            PantopusTextField(
                "Email",
                text: Binding(
                    get: { viewModel.form.email },
                    set: { viewModel.setEmail($0) }
                ),
                placeholder: "name@example.com",
                keyboardType: .emailAddress,
                contentType: .emailAddress,
                identifier: "inviteMember_email"
            )
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("Personal note (optional)")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                TextEditor(text: Binding(
                    get: { viewModel.form.message },
                    set: { viewModel.setMessage($0) }
                ))
                .frame(minHeight: 80)
                .padding(Spacing.s2)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .accessibilityIdentifier("inviteMember_message")
            }
        }
    }
}

// MARK: - Step 3: Review

private struct ReviewStep: View {
    @Bindable var viewModel: InviteMemberWizardViewModel

    var body: some View {
        HeadlineBlock(InviteMemberStep.review.title)
        SubcopyBlock(InviteMemberStep.review.subcopy)
        ReviewSummaryBlock([
            ReviewSummaryRow(label: "Role", value: viewModel.form.role.label),
            ReviewSummaryRow(label: "Email", value: viewModel.form.email.trimmingCharacters(in: .whitespacesAndNewlines))
        ])
        if !viewModel.form.message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("Personal note")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text(viewModel.form.message)
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appText)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(Spacing.s3)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
        }
    }
}

// MARK: - Helpers

private struct InviteMemberErrorBanner: View {
    let message: String

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.alertCircle, size: 18, color: Theme.Color.error)
            Text(message)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.error)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.errorBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityIdentifier("inviteMemberErrorBanner")
    }
}

private extension MemberRole {
    /// Sub-line copy for the Role-step tiles.
    var tileSubcopy: String {
        switch self {
        case .member: "Full access — tasks, bills, calendar, codes."
        case .guest: "Short-term — sitters, visitors, contractors."
        default: ""
        }
    }
}

#Preview {
    InviteMemberWizardView(homeId: "preview-home") { _ in }
}
