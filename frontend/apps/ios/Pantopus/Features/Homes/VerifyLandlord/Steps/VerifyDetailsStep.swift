//
//  VerifyDetailsStep.swift
//  Pantopus
//
//  A12.6 — Verify landlord · Details. Three white DCard sections
//  (Business info · Lease/deed · Property manager) plus an optional
//  error summary banner above them. Per-field error chips render
//  inside `DField` when the VM's `errors` snapshot is non-nil.
//
//  The sticky `2 fields need attention` hint above the disabled CTA
//  is rendered by the wizard scaffold itself (see
//  VerifyLandlordWizardView) so the design's stack-up survives the
//  shared shell.
//

import SwiftUI

// swiftlint:disable file_length

struct VerifyDetailsStep: View {
    @Bindable var viewModel: VerifyLandlordWizardViewModel

    var body: some View {
        HeadlineBlock(
            "Landlord & lease details",
            subtitle: "We'll email this person a one-time link to confirm the rental."
        )

        if let errors = viewModel.errors, !errors.isEmpty {
            VerifyErrorSummaryBanner(errors: errors)
        }

        BusinessInfoCard(viewModel: viewModel)
        LeaseUploadCard(viewModel: viewModel)
        PropertyManagerCard(viewModel: viewModel)
        TenancyCard(viewModel: viewModel)

        VerifyEncryptionFootnote()
    }
}

// MARK: - Cards

private struct BusinessInfoCard: View {
    @Bindable var viewModel: VerifyLandlordWizardViewModel

    var body: some View {
        VerifyLandlordCard {
            VerifyLandlordSectionHeader(
                overline: "Business info",
                title: "Who owns this rental?",
                trailing: AnyView(BusinessBadge())
            )
            VerifyLandlordField(
                label: "Owner or business name",
                value: viewModel.form.ownerName,
                placeholder: "Elm Street Holdings LLC",
                icon: .building2,
                error: viewModel.errors?.ownerName,
                onChange: viewModel.setOwnerName
            )
            VerifyLandlordField(
                label: "Owner contact name",
                value: viewModel.form.contactName,
                placeholder: "Mira Patel",
                icon: .user,
                error: viewModel.errors?.contactName,
                onChange: viewModel.setContactName
            )
            VerifyLandlordField(
                label: "Email",
                value: viewModel.form.email,
                placeholder: "mira@elmstholdings.com",
                icon: .mail,
                keyboard: .emailAddress,
                hint: "We'll send a confirmation link here.",
                error: viewModel.errors?.email,
                onChange: viewModel.setEmail
            )
            VerifyLandlordField(
                label: "Phone",
                value: viewModel.form.phone,
                placeholder: "(555) 123-4567",
                icon: .phone,
                keyboard: .phonePad,
                optional: true,
                onChange: viewModel.setPhone
            )
        }
    }
}

private struct LeaseUploadCard: View {
    @Bindable var viewModel: VerifyLandlordWizardViewModel

    var body: some View {
        VerifyLandlordCard {
            VerifyLandlordSectionHeader(
                overline: "Lease or deed",
                title: "Attach proof of the rental",
                subtitle: "One document is enough — the lease you signed, "
                    + "or a deed showing the owner above."
            )
            LeaseUploadView(
                lease: viewModel.form.lease,
                registeredUnit: viewModel.form.registeredUnit,
                hasError: viewModel.errors?.lease != nil,
                onAttach: {
                    // Wired to a real picker when the verify-landlord
                    // bytes upload endpoint ships. For sample data we
                    // attach the populated fixture so QA can step
                    // through the done / warn states inline.
                    viewModel.setLease(VerifyLandlordSampleData.populatedForm.lease)
                },
                onRemove: { viewModel.setLease(nil) }
            )
        }
    }
}

private struct PropertyManagerCard: View {
    @Bindable var viewModel: VerifyLandlordWizardViewModel

    var body: some View {
        VerifyLandlordCard {
            VerifyLandlordSectionHeader(
                overline: "Property manager",
                title: "If different from the owner"
            )
            PMToggleRow(
                isOn: Binding(
                    get: { viewModel.form.pmEnabled },
                    set: { viewModel.setPMEnabled($0) }
                )
            )
            if viewModel.form.pmEnabled {
                VerifyLandlordField(
                    label: "PM contact name",
                    value: viewModel.form.pmName,
                    placeholder: "Daniel Ortega",
                    icon: .user,
                    error: viewModel.errors?.pmName,
                    onChange: viewModel.setPMName
                )
                VerifyLandlordField(
                    label: "PM email",
                    value: viewModel.form.pmEmail,
                    placeholder: "dortega@anchorpm.co",
                    icon: .mail,
                    keyboard: .emailAddress,
                    error: viewModel.errors?.pmEmail,
                    onChange: viewModel.setPMEmail
                )
                VerifyLandlordField(
                    label: "PM phone",
                    value: viewModel.form.pmPhone,
                    placeholder: "(555) 123-4567",
                    icon: .phone,
                    keyboard: .phonePad,
                    optional: true,
                    onChange: viewModel.setPMPhone
                )
            }
        }
    }
}

/// A12.6 "Your tenancy" — the two fields the backend actually persists
/// on `POST /api/v1/tenant/request-approval` (`start_at` + `message`).
private struct TenancyCard: View {
    @Bindable var viewModel: VerifyLandlordWizardViewModel

    var body: some View {
        VerifyLandlordCard {
            VerifyLandlordSectionHeader(
                overline: "Your tenancy",
                title: "When did you move in?",
                subtitle: "Optional, but it helps your landlord process the request faster."
            )
            VerifyLandlordField(
                label: "Move-in date",
                value: viewModel.form.moveInDate,
                placeholder: "YYYY-MM-DD",
                icon: .calendar,
                keyboard: .numbersAndPunctuation,
                optional: true,
                hint: "When did you move in, or plan to?",
                error: viewModel.errors?.moveInDate,
                onChange: viewModel.setMoveInDate
            )
            VerifyLandlordMessageField(
                value: viewModel.form.messageToLandlord,
                onChange: viewModel.setMessageToLandlord
            )
        }
    }
}

/// Multiline note forwarded to the landlord as the request `message`.
private struct VerifyLandlordMessageField: View {
    let value: String
    let onChange: (String) -> Void

    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s1) {
                Text("Message to landlord")
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appTextStrong)
                Text("· optional")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            TextEditor(text: Binding(
                get: { value },
                set: { onChange($0) }
            ))
            .focused($isFocused)
            .font(Theme.Font.body)
            .foregroundStyle(Theme.Color.appText)
            .scrollContentBackground(.hidden)
            .frame(minHeight: 96)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, Spacing.s2)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(
                        isFocused ? Theme.Color.primary600 : Theme.Color.appBorder,
                        lineWidth: isFocused ? 1.5 : 1
                    )
            }
            .accessibilityIdentifier("verifyLandlordMessageField")
            Text("\(value.count)/\(VerifyLandlordForm.messageMaxLength)")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextMuted)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .accessibilityIdentifier("verifyLandlordMessageCount")
        }
    }
}

// MARK: - Atoms

/// White surface card with rounded corners + 1pt border + soft shadow.
/// Encapsulates the section-card geometry used by all three DCards on
/// A12.6.
private struct VerifyLandlordCard<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            content()
        }
        .padding(Spacing.s4)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        }
    }
}

private struct VerifyLandlordSectionHeader: View {
    let overline: String
    let title: String
    var subtitle: String?
    var trailing: AnyView?

    var body: some View {
        HStack(alignment: .bottom, spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: 2) {
                Text(overline.uppercased())
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text(title)
                    .pantopusTextStyle(.body)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                if let subtitle {
                    Text(subtitle)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if let trailing { trailing }
        }
    }
}

/// Violet business pillar pill — surfaces in the Business info card
/// header's right slot.
private struct BusinessBadge: View {
    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.building2, size: 9, color: Theme.Color.business)
            Text("BUSINESS")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.business)
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .background(Theme.Color.businessBg)
        .clipShape(Capsule())
        .accessibilityIdentifier("verifyLandlordBusinessBadge")
    }
}

/// Single DField row — label + optional · per-field error chip + the
/// 44pt input with leading icon, error border, hint line.
private struct VerifyLandlordField: View {
    let label: String
    let value: String
    let placeholder: String
    let icon: PantopusIcon
    var keyboard: UIKeyboardType = .default
    var optional: Bool = false
    var hint: String?
    var error: String?
    let onChange: (String) -> Void

    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .firstTextBaseline) {
                HStack(spacing: Spacing.s1) {
                    Text(label)
                        .pantopusTextStyle(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appTextStrong)
                    if optional {
                        Text("· optional")
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextMuted)
                    }
                }
                Spacer()
                if let error {
                    HStack(spacing: 3) {
                        Icon(.alertCircle, size: 10, color: Theme.Color.error)
                        Text(error)
                            .pantopusTextStyle(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.Color.error)
                    }
                }
            }
            HStack(spacing: Spacing.s2) {
                Icon(icon, size: 15, color: Theme.Color.appTextSecondary)
                TextField(placeholder, text: Binding(
                    get: { value },
                    set: { onChange($0) }
                ))
                .focused($isFocused)
                .keyboardType(keyboard)
                .textInputAutocapitalization(keyboard == .emailAddress ? .never : .sentences)
                .autocorrectionDisabled(keyboard == .emailAddress)
                .font(Theme.Font.body)
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityIdentifier("verifyLandlordField_\(label)")
            }
            .frame(height: 44)
            .padding(.horizontal, Spacing.s3)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(borderColor, lineWidth: borderWidth)
            }
            .overlay {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.primary100, lineWidth: isFocused ? 3 : 0)
                    .blur(radius: isFocused ? 0.5 : 0)
                    .opacity(isFocused ? 1 : 0)
                    .padding(-2)
            }
            if let hint, error == nil {
                Text(hint)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
    }

    private var borderColor: Color {
        if error != nil { return Theme.Color.error }
        if isFocused { return Theme.Color.primary600 }
        return Theme.Color.appBorder
    }

    private var borderWidth: CGFloat {
        isFocused || error != nil ? 1.5 : 1
    }
}

/// PM toggle row — title + sub copy + native Toggle styled to match
/// the design's compact 22pt switch.
private struct PMToggleRow: View {
    @Binding var isOn: Bool

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Property manager handles this rental")
                    .pantopusTextStyle(.body)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                Text(
                    "Add a PM if someone other than the owner collects rent or "
                        + "handles maintenance."
                )
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Toggle("", isOn: $isOn)
                .labelsHidden()
                .tint(Theme.Color.primary600)
                .accessibilityIdentifier("verifyLandlordPMToggle")
        }
    }
}

// MARK: - Lease upload variants

private struct LeaseUploadView: View {
    let lease: VerifyLandlordLeaseFile?
    let registeredUnit: String
    let hasError: Bool
    let onAttach: () -> Void
    let onRemove: () -> Void

    var body: some View {
        if let lease {
            LeaseUploadDoneRow(
                lease: lease,
                registeredUnit: registeredUnit,
                hasError: hasError,
                onRemove: onRemove
            )
        } else {
            LeaseUploadEmptyButton(onAttach: onAttach)
        }
    }
}

private struct LeaseUploadEmptyButton: View {
    let onAttach: () -> Void

    var body: some View {
        Button(action: onAttach) {
            HStack(spacing: Spacing.s3) {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(Theme.Color.primary50)
                    .frame(width: 36, height: 36)
                    .overlay {
                        Icon(.upload, size: 16, strokeWidth: 2.2, color: Theme.Color.primary600)
                    }
                VStack(alignment: .leading, spacing: 2) {
                    Text("Attach lease or deed")
                        .pantopusTextStyle(.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appText)
                    Text("PDF, JPG, or PNG · up to 10 MB")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s0)
                Icon(.plus, size: 17, color: Theme.Color.appTextSecondary)
            }
            .padding(Spacing.s4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .overlay {
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .strokeBorder(
                        Theme.Color.appBorderStrong,
                        style: StrokeStyle(lineWidth: 1.5, dash: [4, 4])
                    )
            }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("verifyLandlordAttachLease")
    }
}

private struct LeaseUploadDoneRow: View {
    let lease: VerifyLandlordLeaseFile
    let registeredUnit: String
    let hasError: Bool
    let onRemove: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .center, spacing: Spacing.s3) {
                PDFThumb()
                VStack(alignment: .leading, spacing: 1) {
                    Text(lease.filename)
                        .pantopusTextStyle(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    Text(
                        "\(lease.sizeLabel) · \(lease.pageCount) pages · Uploaded just now"
                    )
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Button(action: onRemove) {
                    Icon(.trash2, size: 13, color: Theme.Color.appTextSecondary)
                        .frame(width: 26, height: 26)
                }
                .accessibilityLabel("Remove lease")
                .accessibilityIdentifier("verifyLandlordRemoveLease")
            }
            LeaseParseStatusRow(
                lease: lease,
                registeredUnit: registeredUnit,
                hasError: hasError
            )
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(
                    hasError ? Theme.Color.warningLight : Theme.Color.successLight,
                    lineWidth: 1
                )
        }
        .accessibilityIdentifier("verifyLandlordLeaseDone")
    }
}

private struct PDFThumb: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 5, style: .continuous)
            .fill(Theme.Color.errorBg)
            .frame(width: 36, height: 44)
            .overlay {
                Text("PDF")
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(Theme.Color.error)
                    .tracking(0.4)
            }
    }
}

private struct LeaseParseStatusRow: View {
    let lease: VerifyLandlordLeaseFile
    let registeredUnit: String
    let hasError: Bool

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Circle()
                .fill(hasError ? Theme.Color.warning : Theme.Color.success)
                .frame(width: 16, height: 16)
                .overlay {
                    Icon(
                        hasError ? .alertTriangle : .check,
                        size: 10,
                        strokeWidth: 3,
                        color: Theme.Color.appTextInverse
                    )
                }
            (Text(hasError ? "Unit doesn't match. " : "Lease parsed. ")
                .fontWeight(.bold)
                +
                Text(statusBody)
            )
            .pantopusTextStyle(.caption)
            .foregroundStyle(hasError ? Theme.Color.warning : Theme.Color.success)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 7)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(hasError ? Theme.Color.warningBg : Theme.Color.successBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }

    private var statusBody: String {
        if hasError {
            let detected = lease.detectedUnit ?? "Unknown"
            return "Detected \"\(detected)\" — your home is registered as \"\(registeredUnit)\". "
                + "Re-upload the correct lease or update your home."
        }
        let owner = lease.detectedOwner ?? "M. Patel"
        let unit = lease.detectedUnit ?? registeredUnit
        return "Owner \"\(owner)\" and unit \"\(unit)\" detected."
    }
}

// MARK: - Summary banner

private struct VerifyErrorSummaryBanner: View {
    let errors: VerifyLandlordValidationErrors

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            Circle()
                .fill(Theme.Color.error)
                .frame(width: 22, height: 22)
                .overlay {
                    Icon(.alertCircle, size: 13, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                }
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: 3) {
                Text("Fix \(errors.count) thing\(errors.count == 1 ? "" : "s") to submit")
                    .pantopusTextStyle(.body)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.error)
                Text(errors.compactSummary)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.error)
                    .opacity(0.9)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.errorBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.errorLight, lineWidth: 1)
        }
        .accessibilityIdentifier("verifyLandlordErrorSummary")
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Footnote

private struct VerifyEncryptionFootnote: View {
    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.lock, size: 12, color: Theme.Color.appTextSecondary)
            Text(
                "Confirmation email goes only to the landlord. "
                    + "Your name and unit will be shown."
            )
            .pantopusTextStyle(.caption)
            .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, 2)
    }
}

#Preview("Verify Landlord — Details populated") {
    let vm = VerifyLandlordWizardViewModel(
        homeId: "home-preview",
        form: VerifyLandlordSampleData.populatedForm
    )
    vm.primaryTapped()
    return ScrollView {
        VStack(alignment: .leading, spacing: Spacing.s5) {
            VerifyDetailsStep(viewModel: vm)
        }
        .padding(Spacing.s4)
    }
    .background(Theme.Color.appBg)
}

#Preview("Verify Landlord — Details errors") {
    let vm = VerifyLandlordWizardViewModel(
        homeId: "home-preview",
        form: VerifyLandlordSampleData.errorForm
    )
    vm.primaryTapped()
    Task { await vm.submit() }
    return ScrollView {
        VStack(alignment: .leading, spacing: Spacing.s5) {
            VerifyDetailsStep(viewModel: vm)
        }
        .padding(Spacing.s4)
    }
    .background(Theme.Color.appBg)
}
