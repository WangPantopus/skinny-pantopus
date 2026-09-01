//
//  InviteTeammateWizardView.swift
//  Pantopus
//
//  UI for the Invite Teammate wizard. Cloned from `InviteMemberWizardView`
//  (per-home invite) — composes `WizardShell` with three step bodies and
//  dispatches the VM's `pendingEvent` to the caller via `onClose`.
//

import SwiftUI

/// Presented as a sheet from `BusinessTeamView`. Calls `onClose` with the
/// newly-created seat (or nil on dismiss without submit).
public struct InviteTeammateWizardView: View {
    @State private var viewModel: InviteTeammateWizardViewModel
    private let onClose: (BusinessSeatDTO?) -> Void

    public init(
        businessId: String,
        onClose: @escaping (BusinessSeatDTO?) -> Void
    ) {
        _viewModel = State(initialValue: InviteTeammateWizardViewModel(businessId: businessId))
        self.onClose = onClose
    }

    public var body: some View {
        WizardShell(model: viewModel) {
            stepBody
            if let error = viewModel.errorMessage {
                InviteTeammateErrorBanner(message: error)
            }
        }
        .onChange(of: viewModel.pendingEvent) { _, event in
            handle(event)
        }
        .accessibilityIdentifier("businessTeam.inviteWizard")
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

    private func handle(_ event: InviteTeammateEvent?) {
        guard let event else { return }
        switch event {
        case .dismiss:
            onClose(nil)
        case let .submitted(seat):
            onClose(seat)
        }
        viewModel.pendingEvent = nil
    }
}

// MARK: - Step 1: Role

private struct RoleStep: View {
    @Bindable var viewModel: InviteTeammateWizardViewModel

    var body: some View {
        HeadlineBlock(InviteTeammateStep.role.title)
        SubcopyBlock(InviteTeammateStep.role.subcopy)
        VStack(spacing: Spacing.s2) {
            ForEach(BusinessRole.assignableRoles, id: \.self) { role in
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
    let role: BusinessRole
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
                    Icon(.checkCircle, size: 20, color: Theme.Color.business)
                }
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(
                        isSelected ? Theme.Color.business : Theme.Color.appBorder,
                        lineWidth: isSelected ? 2 : 1
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("inviteTeammate_role_\(role.rawValue)")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Step 2: Identify

private struct IdentifyStep: View {
    @Bindable var viewModel: InviteTeammateWizardViewModel

    var body: some View {
        HeadlineBlock(InviteTeammateStep.identify.title)
        SubcopyBlock(InviteTeammateStep.identify.subcopy)
        FormFieldsBlock {
            PantopusTextField(
                "Seat name",
                text: Binding(
                    get: { viewModel.form.displayName },
                    set: { viewModel.setDisplayName($0) }
                ),
                placeholder: "e.g. Front desk",
                isRequired: true,
                contentType: .organizationName,
                identifier: "inviteTeammate_displayName"
            )
            PantopusTextField(
                "Email",
                text: Binding(
                    get: { viewModel.form.email },
                    set: { viewModel.setEmail($0) }
                ),
                placeholder: "name@example.com",
                isRequired: true,
                keyboardType: .emailAddress,
                contentType: .emailAddress,
                identifier: "inviteTeammate_email"
            )
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("Note (optional)")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                TextEditor(text: Binding(
                    get: { viewModel.form.note },
                    set: { viewModel.setNote($0) }
                ))
                .frame(minHeight: 80)
                .padding(Spacing.s2)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .accessibilityIdentifier("inviteTeammate_note")
            }
        }
    }
}

// MARK: - Step 3: Review

private struct ReviewStep: View {
    @Bindable var viewModel: InviteTeammateWizardViewModel

    var body: some View {
        HeadlineBlock(InviteTeammateStep.review.title)
        SubcopyBlock(InviteTeammateStep.review.subcopy)
        ReviewSummaryBlock([
            ReviewSummaryRow(label: "Role", value: viewModel.form.role.label),
            ReviewSummaryRow(label: "Seat", value: viewModel.form.displayName.trimmingCharacters(in: .whitespacesAndNewlines)),
            ReviewSummaryRow(label: "Email", value: viewModel.form.email.trimmingCharacters(in: .whitespacesAndNewlines))
        ])
        let trimmedNote = viewModel.form.note.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedNote.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("Note")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text(viewModel.form.note)
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

private struct InviteTeammateErrorBanner: View {
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
        .accessibilityIdentifier("inviteTeammateErrorBanner")
    }
}

#Preview {
    InviteTeammateWizardView(businessId: "preview-business") { _ in }
}
