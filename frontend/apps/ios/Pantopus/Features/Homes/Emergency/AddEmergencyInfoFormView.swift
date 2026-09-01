//
//  AddEmergencyInfoFormView.swift
//  Pantopus
//
//  P2.8 — Add / Edit Emergency Info form. Built on the shared
//  `FormShell` archetype (`Features/Shared/Form/`). Renders four
//  field groups:
//    Category — 7-option grid picker with the design palette tile.
//    Title    — single-line text field (required).
//    Severity — three-segment chip stack (info / caution / critical)
//               rendered only for severity-relevant categories.
//    Details  — multiline text editor.
//    Verified by — optional member picker; surfaces nil when no
//               occupants exist.
//
//  Last-updated is auto-stamped by the server on create and by the
//  client on local edit; it isn't shown as an editable field.
//

import SwiftUI

public struct AddEmergencyInfoFormView: View {
    @State private var viewModel: AddEmergencyInfoFormViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showsMemberPicker = false

    public init(viewModel: AddEmergencyInfoFormViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        FormShell(
            title: viewModel.screenTitle,
            rightActionLabel: "Save",
            isValid: viewModel.isValid,
            isDirty: viewModel.isDirty,
            isSaving: viewModel.isSaving,
            onClose: { dismiss() },
            onCommit: commit,
            // swiftlint:disable:next trailing_closure
            content: {
                categorySection
                titleSection
                if viewModel.category.supportsSeverity {
                    severitySection
                }
                detailsSection
                verifiedBySection
            }
        )
        .background(Theme.Color.appBg)
        .task { await viewModel.loadMembers() }
        .accessibilityIdentifier("addEmergencyInfoForm")
        .overlay(alignment: .bottom) {
            if let toast = viewModel.toast {
                ToastView(message: toast)
                    .padding(.bottom, Spacing.s10)
                    .task {
                        try? await Task.sleep(nanoseconds: 2_000_000_000)
                        viewModel.toast = nil
                    }
                    .transition(.opacity)
                    .accessibilityIdentifier("addEmergencyInfoToast")
            }
        }
        .pantopusAnimation(.componentState, value: viewModel.toast)
        .onChange(of: viewModel.shouldDismiss) { _, newValue in
            guard newValue else { return }
            viewModel.acknowledgeDismiss()
            Task {
                try? await Task.sleep(nanoseconds: 600_000_000)
                dismiss()
            }
        }
        .sheet(isPresented: $showsMemberPicker) {
            MemberPickerSheet(
                members: viewModel.members,
                selected: viewModel.verifiedByUserId,
                onSelect: { id in
                    viewModel.verifiedByUserId = id
                    showsMemberPicker = false
                },
                onClear: {
                    viewModel.verifiedByUserId = nil
                    showsMemberPicker = false
                }
            )
            .presentationDetents([.medium])
        }
    }

    // MARK: - Sections

    private var categorySection: some View {
        FormFieldGroup("Category") {
            VStack(spacing: Spacing.s2) {
                let categories = EmergencyFormCategory.allCases
                ForEach(0..<(categories.count + 1) / 2, id: \.self) { rowIndex in
                    HStack(spacing: Spacing.s2) {
                        let left = categories[rowIndex * 2]
                        CategoryTile(
                            category: left,
                            isSelected: left == viewModel.category
                        ) { viewModel.category = left }
                        if rowIndex * 2 + 1 < categories.count {
                            let right = categories[rowIndex * 2 + 1]
                            CategoryTile(
                                category: right,
                                isSelected: right == viewModel.category
                            ) { viewModel.category = right }
                        } else {
                            Color.clear
                                .frame(maxWidth: .infinity)
                        }
                    }
                }
            }
        }
    }

    private var titleSection: some View {
        FormFieldGroup("Title") {
            PantopusTextField(
                "Title",
                text: Binding(
                    get: { viewModel.titleField.value },
                    set: { viewModel.updateTitle($0) }
                ),
                placeholder: titlePlaceholder,
                state: fieldState(for: viewModel.titleField),
                identifier: "field_title"
            )
        }
    }

    private var severitySection: some View {
        FormFieldGroup("Severity") {
            HStack(spacing: Spacing.s2) {
                ForEach(EmergencySeverity.allCases) { option in
                    SeverityChipButton(
                        severity: option,
                        isSelected: option == viewModel.severity
                    ) {
                        viewModel.severity = (viewModel.severity == option) ? nil : option
                    }
                }
            }
            Text("Tap a chip to mark how urgent this item is. Tap again to clear.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    private var detailsSection: some View {
        FormFieldGroup("Details") {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                TextEditor(text: Binding(
                    get: { viewModel.detailsField.value },
                    set: { viewModel.updateDetails($0) }
                ))
                .frame(minHeight: 120)
                .padding(Spacing.s2)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(
                            viewModel.detailsField.error != nil
                                ? Theme.Color.error
                                : Theme.Color.appBorder,
                            lineWidth: 1
                        )
                )
                .accessibilityIdentifier("field_details")
                if let error = viewModel.detailsField.error {
                    Text(error)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.error)
                }
            }
        }
    }

    private var verifiedBySection: some View {
        FormFieldGroup("Verified by") {
            Button {
                showsMemberPicker = true
            } label: {
                HStack(spacing: Spacing.s2) {
                    Icon(.userRound, size: 16, color: Theme.Color.appTextSecondary)
                    Text(viewModel.verifiedByLabel ?? "Pick a household member (optional)")
                        .pantopusTextStyle(.body)
                        .foregroundStyle(
                            viewModel.verifiedByLabel == nil
                                ? Theme.Color.appTextMuted
                                : Theme.Color.appText
                        )
                    Spacer()
                    Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                }
                .padding(.horizontal, Spacing.s3)
                .frame(minHeight: 44)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("field_verifiedBy")
            .accessibilityLabel(
                viewModel.verifiedByLabel.map { "Verified by \($0)" } ?? "Verified by — none selected"
            )
        }
    }

    // MARK: - Helpers

    private var titlePlaceholder: String {
        switch viewModel.category {
        case .allergy: "e.g. Penicillin allergy"
        case .medicalCondition: "e.g. Asthma"
        case .medication: "e.g. Daily metformin"
        case .contact: "e.g. Dr. Lin — family doctor"
        case .petMedical: "e.g. Murphy — chicken allergy"
        case .powerOfAttorney: "e.g. Healthcare POA — Sarah"
        case .other: "Short, scannable label"
        }
    }

    private func fieldState(for snapshot: FormFieldState) -> PantopusFieldState {
        if let error = snapshot.error { return .error(error) }
        if snapshot.touched, snapshot.isDirty { return .valid }
        return .default
    }

    private func commit() {
        Task { await viewModel.submit() }
    }
}

// MARK: - Category tile

private struct CategoryTile: View {
    let category: EmergencyFormCategory
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s2) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.sm)
                        .fill(category.palette.background)
                        .frame(width: 32, height: 32)
                    Icon(category.icon, size: 16, color: category.palette.foreground)
                }
                Text(category.label)
                    .pantopusTextStyle(.small)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.leading)
                    .lineLimit(2)
                Spacer(minLength: Spacing.s0)
                if isSelected {
                    Icon(.check, size: 14, color: Theme.Color.primary600)
                }
            }
            .padding(Spacing.s2)
            .frame(maxWidth: .infinity, minHeight: 56, alignment: .leading)
            .background(
                isSelected ? Theme.Color.primary50 : Theme.Color.appSurfaceMuted
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(
                        isSelected ? Theme.Color.primary600 : Theme.Color.appBorderSubtle,
                        lineWidth: isSelected ? 2 : 1
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("categoryTile_\(category.rawValue)")
        .accessibilityLabel(category.label)
        .accessibilityAddTraits(isSelected ? [.isSelected, .isButton] : .isButton)
    }
}

// MARK: - Severity chip

private struct SeverityChipButton: View {
    let severity: EmergencySeverity
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s1) {
                Icon(severity.icon, size: 12, color: severity.foreground)
                Text(severity.label)
                    .pantopusTextStyle(.small)
                    .fontWeight(.semibold)
                    .foregroundStyle(severity.foreground)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(maxWidth: .infinity, minHeight: 36)
            .background(severity.background)
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                    .stroke(
                        isSelected ? severity.foreground : .clear,
                        lineWidth: isSelected ? 2 : 0
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("severityChip_\(severity.rawValue)")
        .accessibilityLabel("Severity \(severity.label)")
        .accessibilityAddTraits(isSelected ? [.isSelected, .isButton] : .isButton)
    }
}

// MARK: - Member picker

private struct MemberPickerSheet: View {
    let members: [OccupantDTO]
    let selected: String?
    let onSelect: (String) -> Void
    let onClear: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            HStack {
                Text("Verified by")
                    .pantopusTextStyle(.h3)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                Button("Close") { dismiss() }
                    .foregroundStyle(Theme.Color.primary600)
                    .accessibilityIdentifier("memberPicker_close")
            }
            .padding(Spacing.s4)
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            ScrollView {
                LazyVStack(spacing: Spacing.s0) {
                    if selected != nil {
                        Button(action: onClear) {
                            HStack {
                                Icon(.x, size: 16, color: Theme.Color.appTextSecondary)
                                Text("Clear selection")
                                    .pantopusTextStyle(.body)
                                    .foregroundStyle(Theme.Color.appText)
                                Spacer()
                            }
                            .padding(Spacing.s4)
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("memberPicker_clear")
                        Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                    }
                    if members.isEmpty {
                        Text("No household members yet.")
                            .pantopusTextStyle(.body)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .padding(Spacing.s4)
                    } else {
                        ForEach(members) { member in
                            Button {
                                onSelect(member.userId)
                            } label: {
                                HStack(spacing: Spacing.s3) {
                                    ZStack {
                                        Circle()
                                            .fill(Theme.Color.appSurfaceSunken)
                                            .frame(width: 32, height: 32)
                                        Icon(.userRound, size: 16, color: Theme.Color.appTextSecondary)
                                    }
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(member.displayName ?? member.username ?? "Member")
                                            .pantopusTextStyle(.body)
                                            .foregroundStyle(Theme.Color.appText)
                                        if let role = member.role, !role.isEmpty {
                                            Text(role.capitalized)
                                                .pantopusTextStyle(.caption)
                                                .foregroundStyle(Theme.Color.appTextSecondary)
                                        }
                                    }
                                    Spacer()
                                    if selected == member.userId {
                                        Icon(.check, size: 16, color: Theme.Color.primary600)
                                    }
                                }
                                .padding(Spacing.s4)
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("memberPicker_member_\(member.userId)")
                        }
                    }
                }
            }
        }
        .background(Theme.Color.appSurface)
    }
}

#Preview {
    AddEmergencyInfoFormView(
        viewModel: AddEmergencyInfoFormViewModel(homeId: "preview")
    )
}
