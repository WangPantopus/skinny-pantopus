//
//  ClaimStartStep.swift
//  Pantopus
//
//  A12.3 FrameStart — home chip, requirements card, and verification explainer.
//

import SwiftUI

struct ClaimStartStep: View {
    let content: ClaimOwnershipStartContent
    /// Only true when the home has a verified owner AND the viewer is
    /// not already a member — RN's condition at
    /// `src/app/homes/[id]/claim-owner/index.tsx:52`.
    let showsAskVerifiedOwner: Bool
    let selectedMethod: ClaimStartMethod
    let onSelectMethod: @MainActor (ClaimStartMethod) -> Void
    @State private var isWhyExpanded = false

    init(
        content: ClaimOwnershipStartContent = ClaimOwnershipSampleData.canonicalStart,
        showsAskVerifiedOwner: Bool = false,
        selectedMethod: ClaimStartMethod = .verifyOwnership,
        onSelectMethod: @escaping @MainActor (ClaimStartMethod) -> Void = { _ in }
    ) {
        self.content = content
        self.showsAskVerifiedOwner = showsAskVerifiedOwner
        self.selectedMethod = selectedMethod
        self.onSelectMethod = onSelectMethod
    }

    var body: some View {
        ClaimHomeChip(label: content.homeLabel)

        if let contestedClaim = content.contestedClaim {
            ContestedClaimNotice(claim: contestedClaim)
        }

        HeadlineBlock(
            content.isContested ? "File a competing claim" : "Let's verify you own this home",
            subtitle: content.isContested ? contestedSubcopy : canonicalSubcopy
        )

        if showsAskVerifiedOwner {
            ClaimMethodPicker(
                selected: selectedMethod,
                onSelect: onSelectMethod
            )
        }

        if selectedMethod == .verifyOwnership {
            RequirementsCardBlock(rows: requirementsRows)
            WhyWeAskSection(isExpanded: $isWhyExpanded)
        }
    }

    private var canonicalSubcopy: String {
        "Claiming ownership lets you invite residents, receive mail, post packages, " +
            "and run the household's command center. Verification is a one-time step."
    }

    private var contestedSubcopy: String {
        "Same process, but the reviewer compares both submissions side-by-side. Bring your strongest documents."
    }

    private var requirementsRows: [RequirementsRow] {
        if content.isContested {
            return [
                RequirementsRow(
                    id: "strongest-doc",
                    icon: .zap,
                    title: "Strongest property record or deed",
                    subcopy: "A deed or county property record gets prioritized in contested reviews.",
                    emphasized: true
                ),
                RequirementsRow(
                    id: "id",
                    icon: .check,
                    title: "Government-issued ID",
                    subcopy: "Driver's license, state ID, or passport."
                ),
                RequirementsRow(
                    id: "utility-bill",
                    icon: .check,
                    title: "Utility bill for this address",
                    subcopy: "A recent bill helps match your name to 412 Elm St."
                )
            ]
        }
        return [
            RequirementsRow(
                id: "id",
                icon: .check,
                title: "Government-issued ID",
                subcopy: "Driver's license, state ID, or passport."
            ),
            RequirementsRow(
                id: "utility-bill",
                icon: .check,
                title: "Utility bill",
                subcopy: "A recent bill showing your name and this address."
            ),
            RequirementsRow(
                id: "property-record",
                icon: .check,
                title: "Property record or deed",
                subcopy: "Deed, tax record, or mortgage statement."
            )
        ]
    }
}

/// A12.3 method picker. Rendered only when the home already has a
/// verified owner and the viewer is not a member, so a non-member can
/// ask the owners to add them instead of filing an ownership claim.
private struct ClaimMethodPicker: View {
    let selected: ClaimStartMethod
    let onSelect: @MainActor (ClaimStartMethod) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text("Verification method")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)

            methodRow(
                method: .verifyOwnership,
                icon: .fileText,
                label: "Upload ownership document",
                subcopy: "Deed, tax bill, or closing disclosure.",
                identifier: "claimOwnershipMethod.verifyOwnership"
            )
            methodRow(
                method: .askVerifiedOwner,
                icon: .users,
                label: "Ask a verified owner to add me",
                subcopy: "Sends a notification to verified owner(s). "
                    + "They can add you from Members with the role you need.",
                identifier: "claimOwnershipMethod.askVerifiedOwner"
            )
        }
        .accessibilityIdentifier("claimOwnershipMethodPicker")
    }

    private func methodRow(
        method: ClaimStartMethod,
        icon: PantopusIcon,
        label: String,
        subcopy: String,
        identifier: String
    ) -> some View {
        let isSelected = selected == method
        return Button { onSelect(method) } label: {
            HStack(alignment: .top, spacing: Spacing.s3) {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(isSelected ? Theme.Color.personalBg : Theme.Color.appSurfaceSunken)
                    .frame(width: 42, height: 42)
                    .overlay {
                        Icon(
                            icon,
                            size: 20,
                            strokeWidth: 2,
                            color: isSelected ? Theme.Color.primary600 : Theme.Color.appTextSecondary
                        )
                    }
                VStack(alignment: .leading, spacing: 2) {
                    Text(label)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(isSelected ? Theme.Color.primary600 : Theme.Color.appText)
                        .multilineTextAlignment(.leading)
                    Text(subcopy)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: Spacing.s0)
                Circle()
                    .stroke(
                        isSelected ? Theme.Color.primary600 : Theme.Color.appBorderStrong,
                        lineWidth: 2
                    )
                    .frame(width: 22, height: 22)
                    .overlay {
                        if isSelected {
                            Circle().fill(Theme.Color.primary600).frame(width: 12, height: 12)
                        }
                    }
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(isSelected ? Theme.Color.primary50 : Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(
                        isSelected ? Theme.Color.primary600 : Theme.Color.appBorder,
                        lineWidth: 1.5
                    )
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : [.isButton])
        .accessibilityLabel("\(label). \(subcopy)")
        .accessibilityIdentifier(identifier)
    }
}

private struct ContestedClaimNotice: View {
    let claim: ClaimOwnershipContestedClaim

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                Circle()
                    .fill(Theme.Color.warning)
                    .frame(width: 30, height: 30)
                    .overlay {
                        Icon(.users, size: 15, strokeWidth: 2.2, color: Theme.Color.appTextInverse)
                    }
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(claim.title)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.warning)
                    Text(claim.body)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextStrong)
                }
            }
            ClaimantChip(claim: claim)
        }
        .padding(Spacing.s4)
        .background(Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.warningLight, lineWidth: 1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("claimOwnershipContestedNotice")
    }
}

private struct ClaimantChip: View {
    let claim: ClaimOwnershipContestedClaim

    var body: some View {
        HStack(spacing: Spacing.s3) {
            Text(claim.claimantInitials)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.business)
                .frame(width: 28, height: 28)
                .background(Theme.Color.businessBg)
                .clipShape(Circle())
            Text("\(claim.claimantName) · \(claim.filedLabel) · \(claim.statusLabel)")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextStrong)
                .frame(maxWidth: .infinity, alignment: .leading)
            Icon(.lock, size: 13, color: Theme.Color.appTextMuted)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.warningLight, lineWidth: 1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Existing claimant \(claim.claimantName), \(claim.filedLabel), \(claim.statusLabel)")
        .accessibilityIdentifier("claimOwnershipExistingClaimant")
    }
}

private struct WhyWeAskSection: View {
    @Binding var isExpanded: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Button {
                withPantopusAnimation(.componentState, reduceMotion: reduceMotion) {
                    isExpanded.toggle()
                }
            } label: {
                HStack(spacing: Spacing.s3) {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(Theme.Color.appSurface)
                        .frame(width: 28, height: 28)
                        .overlay {
                            Icon(.shieldCheck, size: 15, strokeWidth: 2.2, color: Theme.Color.primary600)
                        }
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Why we ask")
                            .pantopusTextStyle(.body)
                            .foregroundStyle(Theme.Color.primary700)
                        Text("Address proof keeps Pantopus real-people only.")
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    Spacer(minLength: Spacing.s0)
                    Icon(
                        isExpanded ? .chevronUp : .chevronDown,
                        size: 16,
                        color: Theme.Color.primary600
                    )
                }
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(isExpanded ? "Hide why we ask" : "Show why we ask")
            .accessibilityIdentifier("claimOwnershipWhyWeAsk")

            if isExpanded {
                Text(
                    "A reviewer checks that your ID and address documents match this home, " +
                        "then compares ownership records. Your files stay private and are only used for verification."
                )
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextStrong)
                .padding(.leading, Spacing.s10)
                .accessibilityIdentifier("claimOwnershipWhyWeAskDetail")
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.primary50)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.primary100, lineWidth: 1)
        }
    }
}

#Preview {
    VStack(alignment: .leading, spacing: Spacing.s5) {
        ClaimStartStep(content: ClaimOwnershipSampleData.canonicalStart)
        ClaimStartStep(content: ClaimOwnershipSampleData.contestedStart)
    }
    .padding()
    .background(Theme.Color.appBg)
}
