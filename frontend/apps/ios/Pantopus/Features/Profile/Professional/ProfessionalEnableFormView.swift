//
//  ProfessionalEnableFormView.swift
//  Pantopus
//
//  The "professional mode is off" frame of the Professional Profile screen —
//  RN's `mode === 'create'` (`pantopus/frontend/apps/mobile/src/app/
//  professional.tsx:273`). Shown when `GET /api/professional/profile/me`
//  returns `profile: null` (never enabled) or a row with
//  `is_active: false` (disabled), and after a successful Disable.
//
//  The CTA either creates (`POST /api/professional/profile`,
//  `backend/routes/professional.js:89`) or re-enables
//  (`PATCH /api/professional/profile/me { is_active: true }`,
//  `professional.js:190`), matching RN's split.
//

import SwiftUI

@MainActor
struct ProfessionalEnableFormView: View {
    let draft: ProfessionalEnableDraft
    let viewModel: ProfessionalProfileViewModel
    let onBack: @MainActor () -> Void

    var body: some View {
        FormShell(
            title: "Professional",
            leading: .back,
            rightActionLabel: nil,
            bottomActionLabel: draft.ctaLabel,
            bottomActionIcon: .briefcase,
            isValid: true,
            isDirty: false,
            isSaving: draft.isSubmitting,
            onClose: onBack,
            onCommit: { Task { await viewModel.enable() } },
            content: {
                hero
                aboutSection
                categoriesSection
                serviceAreaSection
                visibilitySection
                if let message = draft.errorMessage {
                    errorNote(message)
                }
            }
        )
        .accessibilityIdentifier("professionalProfileCreate")
    }

    // MARK: - Sections

    private var hero: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .fill(Theme.Color.business)
                    .frame(width: 48, height: 48)
                Icon(.wrench, size: 22, color: Theme.Color.appTextInverse)
            }
            .accessibilityHidden(true)
            Text(draft.isReEnable ? "Turn professional mode back on" : "Enable Professional Mode")
                .pantopusTextStyle(.h2)
                .foregroundStyle(Theme.Color.appText)
            Text("Become discoverable on the map and in search. Free to enable, no commitment.")
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.s4)
        .background(Theme.Color.businessBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.business.opacity(0.2), lineWidth: 1)
        )
        .padding(.horizontal, Spacing.s4)
        .accessibilityIdentifier("proEnableHero")
    }

    private var aboutSection: some View {
        ProSectionBlock("About your work") {
            ProTextFieldRow(
                spec: .init(
                    label: "Headline",
                    value: draft.headline,
                    dirty: false,
                    placeholder: "e.g. Experienced handyman",
                    identifier: "proEnableHeadlineField"
                )
            ) { viewModel.updateDraftHeadline($0) }
            ProTextFieldRow(
                spec: .init(
                    label: "Bio",
                    optional: true,
                    value: draft.bio,
                    dirty: false,
                    placeholder: "Describe your services…",
                    identifier: "proEnableBioField"
                )
            ) { viewModel.updateDraftBio($0) }
        }
    }

    private var categoriesSection: some View {
        ProSectionBlock("Categories") {
            ProFieldLabelRow(text: "Up to \(ProfessionalCategory.selectionLimit)")
            FilterSheetFlowLayout(spacing: Spacing.s1) {
                ForEach(ProfessionalCategory.all) { category in
                    let isOn = draft.categories.contains(category.key)
                    ProCategoryChip(
                        label: category.label,
                        isOn: isOn,
                        isDisabled: !isOn && !draft.canSelectMoreCategories,
                        identifier: "proCategoryChip_\(category.key)"
                    ) { viewModel.toggleDraftCategory(category.key) }
                }
            }
            .padding(Spacing.s2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .accessibilityIdentifier("proCategoryPicker")
        }
    }

    private var serviceAreaSection: some View {
        ProSectionBlock("Service area") {
            ProTextFieldRow(
                spec: .init(
                    label: "City",
                    optional: true,
                    value: draft.city,
                    dirty: false,
                    placeholder: "City",
                    identifier: "proEnableCityField"
                )
            ) { viewModel.updateDraftCity($0) }
            ProTextFieldRow(
                spec: .init(
                    label: "State",
                    optional: true,
                    value: draft.state,
                    dirty: false,
                    placeholder: "State",
                    identifier: "proEnableStateField"
                )
            ) { viewModel.updateDraftState($0) }
            ProTextFieldRow(
                spec: .init(
                    label: "Radius (km)",
                    optional: true,
                    value: draft.radiusKm,
                    dirty: false,
                    placeholder: "50",
                    identifier: "proEnableRadiusField",
                    keyboard: .numberPad
                )
            ) { viewModel.updateDraftRadius($0) }
            ProTextFieldRow(
                spec: .init(
                    label: "Hourly rate (USD)",
                    optional: true,
                    value: draft.hourlyRate,
                    dirty: false,
                    placeholder: "0",
                    identifier: "proEnableHourlyRateField",
                    keyboard: .decimalPad
                )
            ) { viewModel.updateDraftHourlyRate($0) }
        }
    }

    private var visibilitySection: some View {
        ProSectionBlock("Visibility") {
            VisRow(
                row: ProVisibilityRow(
                    id: "publicProfile",
                    label: "Public profile",
                    sub: "Neighbors can find you on the map and in search.",
                    isOn: draft.isPublic
                )
            ) { viewModel.setDraftPublic($0) }
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
        }
    }

    private func errorNote(_ message: String) -> some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.alertCircle, size: 14, color: Theme.Color.error)
            Text(message)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.error)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.s3)
        .background(Theme.Color.errorBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .padding(.horizontal, Spacing.s4)
        .accessibilityIdentifier("proEnableError")
    }
}
