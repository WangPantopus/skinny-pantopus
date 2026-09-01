//
//  ProfessionalProfileView.swift
//  Pantopus
//
//  A.5 (A13.11) — the Professional Profile screen (Business pillar). A
//  pushed `FormShell` route with a back chevron, a verification-aware
//  sticky bar, and five sections: Role · Skills · Certifications ·
//  Portfolio · Visibility. Distinct from the Personal `EditProfile` (A13.9).
//
//  Three modes, mirroring RN `professional.tsx`:
//  • **create** — professional mode is off (`profile: null` or
//    `is_active: false`); rendered by `ProfessionalEnableFormView`.
//  • **view/edit** — the editor below, with the destructive Disable row.
//  • Disable is a confirmed `DELETE /api/professional/profile/me`, which
//    drops the screen back into the re-enable form.
//

// swiftlint:disable file_length type_body_length

import SwiftUI

public struct ProfessionalProfileView: View {
    @State private var viewModel: ProfessionalProfileViewModel
    private let onBack: @MainActor () -> Void

    public init(
        viewModel: ProfessionalProfileViewModel = ProfessionalProfileViewModel(),
        onBack: @escaping @MainActor () -> Void = {}
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                ProfessionalProfileSkeleton()
            case let .create(draft):
                ProfessionalEnableFormView(draft: draft, viewModel: viewModel, onBack: onBack)
            case let .verified(content):
                loaded(content, mode: .saved, dirtyCount: 0, pendingCount: content.pendingCount)
            case let .pending(content, dirtyCount, pendingCount):
                loaded(content, mode: .pendingSave, dirtyCount: dirtyCount, pendingCount: pendingCount)
            case let .error(message):
                EmptyState(
                    icon: .alertCircle,
                    headline: "Couldn't load professional profile",
                    subcopy: message,
                    cta: EmptyState.CTA(title: "Try again") { await viewModel.refresh() },
                    tint: Theme.Color.businessBg,
                    accent: Theme.Color.business
                )
            }
        }
        .background(Theme.Color.appBg)
        .task { await viewModel.load() }
        .overlay(alignment: .bottom) {
            if let toast = viewModel.toast {
                ToastView(message: toast)
                    .padding(.bottom, Spacing.s16)
                    .task {
                        try? await Task.sleep(nanoseconds: 2_000_000_000)
                        viewModel.toast = nil
                    }
                    .transition(.opacity)
                    .accessibilityIdentifier("professionalProfileToast")
            }
        }
        .pantopusAnimation(.componentState, value: viewModel.toast)
        .confirmationDialog(
            "Disable professional mode?",
            isPresented: Binding(
                get: { viewModel.showsDisableConfirm },
                set: { viewModel.showsDisableConfirm = $0 }
            ),
            titleVisibility: .visible
        ) {
            Button("Disable", role: .destructive) {
                Task { await viewModel.disableConfirmed() }
            }
            .accessibilityIdentifier("proDisableConfirmButton")
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Your profile will no longer be visible to the public.")
        }
        .accessibilityIdentifier("professionalProfile")
    }

    // MARK: - Populated

    private func loaded(
        _ content: ProfessionalProfileContent,
        mode: ProSticky.Mode,
        dirtyCount: Int,
        pendingCount: Int
    ) -> some View {
        FormShell(
            title: "Professional profile",
            leading: .back,
            rightActionLabel: nil,
            isValid: true,
            isDirty: mode == .pendingSave,
            onClose: onBack,
            onCommit: {},
            content: {
                pillarHeader(content)
                roleSection(content)
                skillsSection(content)
                categoriesSection(content)
                serviceAreaSection(content)
                certificationsSection(content)
                portfolioSection(content)
                verificationSection(content)
                visibilitySection(content)
                disableSection()
            },
            stickyBottom: {
                AnyView(
                    ProSticky(
                        mode: mode,
                        dirtyCount: dirtyCount,
                        pendingCount: pendingCount,
                        onDiscard: { viewModel.discard() },
                        onSaveSubmit: { viewModel.saveAndSubmit() }
                    )
                )
            }
        )
        .accessibilityIdentifier("professionalProfileShell")
    }

    // MARK: - Pillar header

    private func pillarHeader(_ content: ProfessionalProfileContent) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(Theme.Color.business)
                        .frame(width: 40, height: 40)
                    Icon(.briefcase, size: 18, color: Theme.Color.appTextInverse)
                }
                .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 1) {
                    Text("\(content.proName) · Pro")
                        .pantopusTextStyle(.small)
                        .fontWeight(.bold)
                        .foregroundStyle(Theme.Color.appText)
                    Text("Separate from your personal & home identities")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.business)
                }
                Spacer(minLength: Spacing.s0)
                Text("Business")
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s2)
                    .padding(.vertical, 3)
                    .background(Theme.Color.business)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
            }
            PillarStrip(
                title: "Profile strength",
                percent: content.strength,
                tint: Theme.Color.business,
                caption: content.strengthCaption,
                identifier: "proProfileStrength"
            )
        }
        .padding(Spacing.s3)
        .background(Theme.Color.businessBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.business.opacity(0.2), lineWidth: 1)
        )
        .padding(.horizontal, Spacing.s4)
        .accessibilityIdentifier("proPillarHeader")
    }

    // MARK: - Sections

    private func roleSection(_ content: ProfessionalProfileContent) -> some View {
        ProSectionBlock("Role") {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                ProFieldLabelRow(text: "Company", dirty: content.company.isDirty)
                CompanyField(company: content.company)
                if let hint = content.company.hint {
                    HStack(alignment: .top, spacing: Spacing.s1) {
                        Icon(.info, size: 11, color: Theme.Color.warning)
                        Text(hint)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.warning)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            ProTextFieldRow(
                spec: .init(
                    label: "Title",
                    required: true,
                    value: content.title.value,
                    dirty: content.title.isDirty,
                    placeholder: "e.g. Licensed General Handyman",
                    identifier: "proTitleField"
                )
            ) { viewModel.updateTitle($0) }
            ProTextFieldRow(
                spec: .init(
                    label: "Years in role",
                    required: true,
                    value: content.yearsInRole.value,
                    dirty: content.yearsInRole.isDirty,
                    placeholder: "0",
                    identifier: "proYearsInRoleField",
                    keyboard: .numberPad
                )
            ) { viewModel.updateYearsInRole($0) }
        }
    }

    private func skillsSection(_ content: ProfessionalProfileContent) -> some View {
        ProSectionBlock("Skills") {
            ProFieldLabelRow(text: "Specialties", dirty: content.skills.contains(where: \.isFresh))
            FilterSheetFlowLayout(spacing: Spacing.s1) {
                ForEach(content.skills) { skill in
                    ProSkillChip(skill: skill) { viewModel.removeSkill(skill.id) }
                }
                AddSkillChip { viewModel.addSkill() }
            }
            .padding(Spacing.s2)
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            Text("Match jobs Pantopus shows you. Up to 8.")
                .pantopusTextStyle(.caption)
                .italic()
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    /// `categories[]` on `PATCH /api/professional/profile/me`
    /// (`professional.js:190`). Server enum + 5-item cap
    /// (`professional.js:45`); mirrors RN's chip picker
    /// (`professional.tsx:494`).
    private func categoriesSection(_ content: ProfessionalProfileContent) -> some View {
        ProSectionBlock("Categories") {
            ProFieldLabelRow(
                text: "Up to \(ProfessionalCategory.selectionLimit)",
                dirty: content.categoriesAreDirty
            )
            FilterSheetFlowLayout(spacing: Spacing.s1) {
                ForEach(ProfessionalCategory.all) { category in
                    let isOn = content.categories.contains(category.key)
                    ProCategoryChip(
                        label: category.label,
                        isOn: isOn,
                        isDisabled: !isOn && !content.canSelectMoreCategories,
                        identifier: "proEditCategoryChip_\(category.key)"
                    ) { viewModel.toggleCategory(category.key) }
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
            .accessibilityIdentifier("proEditCategoryPicker")
            Text("Used to rank you in search and on the pro map.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    /// `service_area.city/state/radius_km` + `pricing_meta.hourly_rate`
    /// (`professional.js:47` / `:54`) — RN's editor writes the same four
    /// values (`professional.tsx:123`).
    private func serviceAreaSection(_ content: ProfessionalProfileContent) -> some View {
        ProSectionBlock("Service area & pricing") {
            ProTextFieldRow(
                spec: .init(
                    label: "City",
                    optional: true,
                    value: content.serviceCity.value,
                    dirty: content.serviceCity.isDirty,
                    placeholder: "City",
                    identifier: "proServiceCityField"
                )
            ) { viewModel.updateServiceCity($0) }
            ProTextFieldRow(
                spec: .init(
                    label: "State",
                    optional: true,
                    value: content.serviceState.value,
                    dirty: content.serviceState.isDirty,
                    placeholder: "State",
                    identifier: "proServiceStateField"
                )
            ) { viewModel.updateServiceState($0) }
            ProTextFieldRow(
                spec: .init(
                    label: "Radius (km)",
                    optional: true,
                    value: content.serviceRadiusKm.value,
                    dirty: content.serviceRadiusKm.isDirty,
                    placeholder: "50",
                    identifier: "proServiceRadiusField",
                    keyboard: .numberPad
                )
            ) { viewModel.updateServiceRadius($0) }
            ProTextFieldRow(
                spec: .init(
                    label: "Hourly rate (USD)",
                    optional: true,
                    value: content.hourlyRate.value,
                    dirty: content.hourlyRate.isDirty,
                    placeholder: "0",
                    identifier: "proHourlyRateField",
                    keyboard: .decimalPad
                )
            ) { viewModel.updateHourlyRate($0) }
        }
    }

    /// Verification status + RN's "Start verification" CTA
    /// (`professional.tsx:377-400`) — `POST /api/professional/
    /// verification/start` (`professional.js:310`).
    private func verificationSection(_ content: ProfessionalProfileContent) -> some View {
        ProSectionBlock("Verification") {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                HStack(spacing: Spacing.s2) {
                    Icon(content.verification.status.icon, size: 16, color: content.verification.status.foreground)
                    Text(content.verification.summary)
                        .pantopusTextStyle(.small)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appText)
                    Spacer(minLength: Spacing.s0)
                }
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("proVerificationStatus")
                if content.verification.canStart {
                    Button {
                        Task { await viewModel.startVerification() }
                    } label: {
                        Group {
                            if content.verification.isStarting {
                                ProgressView().tint(Theme.Color.appTextInverse)
                            } else {
                                Text("Start verification")
                                    .pantopusTextStyle(.small)
                                    .fontWeight(.semibold)
                                    .foregroundStyle(Theme.Color.appTextInverse)
                            }
                        }
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(Theme.Color.business)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .disabled(content.verification.isStarting)
                    .accessibilityIdentifier("proStartVerificationButton")
                    .accessibilityLabel("Start verification")
                }
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
        }
    }

    private func certificationsSection(_ content: ProfessionalProfileContent) -> some View {
        ProSectionBlock("Certifications") {
            ForEach(content.certifications) { cert in
                CertCard(cert: cert) { viewModel.removeCertification(cert.id) }
            }
            AddCertButton { viewModel.addCertification() }
        }
    }

    private func portfolioSection(_ content: ProfessionalProfileContent) -> some View {
        ProSectionBlock("Portfolio") {
            ForEach(content.portfolio) { link in
                LinkCard(link: link)
            }
            AddLinkRow { viewModel.addPortfolioLink() }
        }
    }

    private func visibilitySection(_ content: ProfessionalProfileContent) -> some View {
        ProSectionBlock("Visibility") {
            VStack(spacing: Spacing.s0) {
                ForEach(Array(content.visibility.enumerated()), id: \.element.id) { index, row in
                    VisRow(row: row) { viewModel.setVisibility(row.id, isOn: $0) }
                    if index < content.visibility.count - 1 {
                        Rectangle()
                            .fill(Theme.Color.appBorderSubtle)
                            .frame(height: 1)
                            .padding(.leading, Spacing.s3)
                    }
                }
            }
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
        }
    }

    /// RN's destructive "Disable" action (`professional.tsx:410`). Soft
    /// disable — `DELETE /api/professional/profile/me` keeps the record so
    /// the screen falls back to the re-enable form.
    private func disableSection() -> some View {
        ProSectionBlock("Professional mode") {
            Button {
                viewModel.requestDisable()
            } label: {
                HStack(spacing: Spacing.s3) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Disable professional mode")
                            .pantopusTextStyle(.small)
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.Color.error)
                        Text("Your profile will no longer be visible to the public.")
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                            .multilineTextAlignment(.leading)
                    }
                    Spacer(minLength: Spacing.s0)
                    if viewModel.isDisabling {
                        ProgressView()
                    } else {
                        Icon(.circleSlash, size: 18, color: Theme.Color.error)
                    }
                }
                .padding(Spacing.s3)
                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(Theme.Color.error.opacity(0.4), lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
            .disabled(viewModel.isDisabling)
            .accessibilityIdentifier("proDisableButton")
            .accessibilityLabel("Disable professional mode")
            .accessibilityHint("Your profile will no longer be visible to the public")
        }
    }
}

// MARK: - Loading skeleton

/// Shimmer placeholder that mirrors the populated geometry: pillar header,
/// a couple of fields, and stacked cards.
@MainActor
struct ProfessionalProfileSkeleton: View {
    var body: some View {
        VStack(spacing: Spacing.s0) {
            // Top bar stand-in.
            HStack {
                Icon(.chevronLeft, size: 22, color: Theme.Color.appTextMuted)
                    .frame(width: 44, height: 44)
                Spacer()
                Text("Professional profile")
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appText)
                Spacer()
                Color.clear.frame(width: 44, height: 44)
            }
            .padding(.horizontal, Spacing.s2)
            .frame(height: 44)
            .background(Theme.Color.appSurface)
            .overlay(alignment: .bottom) {
                Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            }
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s5) {
                    Shimmer(height: 96, cornerRadius: Radii.lg)
                        .padding(.horizontal, Spacing.s4)
                    sectionSkeleton(rows: 2, height: 44)
                    sectionSkeleton(rows: 1, height: 56)
                    sectionSkeleton(rows: 3, height: 64)
                }
                .padding(.vertical, Spacing.s4)
            }
            .background(Theme.Color.appBg)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("professionalProfileLoading")
    }

    private func sectionSkeleton(rows: Int, height: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Shimmer(width: 90, height: 12, cornerRadius: Radii.xs)
                .padding(.horizontal, Spacing.s4)
            VStack(spacing: Spacing.s2) {
                ForEach(0..<rows, id: \.self) { _ in
                    Shimmer(height: height, cornerRadius: Radii.md)
                }
            }
            .padding(.horizontal, Spacing.s4)
        }
    }
}

#Preview("Verified") {
    ProfessionalProfileView(viewModel: ProfessionalProfileViewModel(seed: ProfessionalProfileSampleData.published))
}

#Preview("Pending") {
    ProfessionalProfileView(viewModel: ProfessionalProfileViewModel(
        seed: ProfessionalProfileSampleData.pendingEdits,
        baseline: ProfessionalProfileSampleData.published
    ))
}

#Preview("Loading") {
    ProfessionalProfileSkeleton()
}
