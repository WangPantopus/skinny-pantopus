//
//  FaceIDConfirmSheet.swift
//  Pantopus
//
//  A13.4 — Bottom-sheet "final confirmation" surface. Renders a dark
//  Face ID disc + compact From / To diff + legal copy + Cancel ghost +
//  primary "Confirm with Face ID" CTA (flex 1.5). Biometric authentication
//  itself goes through `LocalAuthentication`; the host VM owns the
//  evaluatePolicy call and toggles `isAuthenticating`.
//

import SwiftUI

/// One row in the compact From / To diff at the top of the sheet.
public struct ConfirmSheetParty: Identifiable, Equatable, Sendable {
    public let id: String
    public let role: String
    public let name: String
    public let initials: String
    public let avatarStart: Color
    public let avatarEnd: Color
    public let fromPercent: Int
    public let toPercent: Int
    public let verified: Bool

    public init(
        id: String,
        role: String,
        name: String,
        initials: String,
        avatarStart: Color,
        avatarEnd: Color,
        fromPercent: Int,
        toPercent: Int,
        verified: Bool = false
    ) {
        self.id = id
        self.role = role
        self.name = name
        self.initials = initials
        self.avatarStart = avatarStart
        self.avatarEnd = avatarEnd
        self.fromPercent = fromPercent
        self.toPercent = toPercent
        self.verified = verified
    }
}

@MainActor
public struct FaceIDConfirmSheet: View {
    public let parties: [ConfirmSheetParty]
    public let recipientName: String
    public let homeAddress: String
    public let coOwnerNames: String
    public let timestamp: String
    public let biometryLabel: String
    public let isAuthenticating: Bool
    public let onCancel: () -> Void
    public let onConfirm: () -> Void

    public init(
        parties: [ConfirmSheetParty],
        recipientName: String,
        homeAddress: String,
        coOwnerNames: String,
        timestamp: String,
        biometryLabel: String = "Face ID",
        isAuthenticating: Bool,
        onCancel: @escaping () -> Void,
        onConfirm: @escaping () -> Void
    ) {
        self.parties = parties
        self.recipientName = recipientName
        self.homeAddress = homeAddress
        self.coOwnerNames = coOwnerNames
        self.timestamp = timestamp
        self.biometryLabel = biometryLabel
        self.isAuthenticating = isAuthenticating
        self.onCancel = onCancel
        self.onConfirm = onConfirm
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            Capsule()
                .fill(Theme.Color.appBorderStrong)
                .frame(width: 38, height: 4)
                .padding(.top, Spacing.s2 + 2)
                .padding(.bottom, Spacing.s3 + 2)
            header
                .padding(.bottom, Spacing.s4)
            diffCard
                .padding(.horizontal, Spacing.s4)
                .padding(.bottom, Spacing.s3 + 2)
            legal
                .padding(.horizontal, Spacing.s4)
                .padding(.bottom, Spacing.s3 + 2)
            buttons
                .padding(.horizontal, Spacing.s4)
                .padding(.bottom, Spacing.s8)
        }
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .clipShape(
            UnevenRoundedRectangle(
                topLeadingRadius: Radii.xl2,
                bottomLeadingRadius: 0,
                bottomTrailingRadius: 0,
                topTrailingRadius: Radii.xl2,
                style: .continuous
            )
        )
        .accessibilityIdentifier("faceIDConfirmSheet")
    }

    private var header: some View {
        VStack(spacing: Spacing.s2) {
            ZStack {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [Theme.Color.appText, Theme.Color.appTextStrong],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 56, height: 56)
                    .shadow(color: Theme.Color.appText.opacity(0.25), radius: 10, y: 6)
                Icon(.scanFace, size: 28, color: Theme.Color.appTextInverse)
            }
            Text("Final confirmation")
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Text("\(biometryLabel) will sign the transfer and record it on the home's chain.")
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 280)
        }
    }

    private var diffCard: some View {
        VStack(spacing: Spacing.s0) {
            ForEach(Array(parties.enumerated()), id: \.element.id) { offset, party in
                partyRow(party)
                if offset < parties.count - 1 {
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(height: 1)
                }
            }
        }
        .padding(.vertical, Spacing.s2)
        .padding(.horizontal, Spacing.s3 + 2)
        .background(Theme.Color.appSurfaceMuted)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md + 2, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md + 2, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }

    private func partyRow(_ party: ConfirmSheetParty) -> some View {
        HStack(spacing: Spacing.s2 + 2) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [party.avatarStart, party.avatarEnd],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                Text(party.initials)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(width: 34, height: 34)
            VStack(alignment: .leading, spacing: 1) {
                Text(party.role)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                HStack(spacing: Spacing.s1) {
                    Text(party.name)
                        .font(.system(size: 13.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    if party.verified {
                        Icon(.badgeCheck, size: 13, color: Theme.Color.success)
                    }
                }
            }
            Spacer(minLength: Spacing.s0)
            percentage(party)
        }
        .padding(.vertical, Spacing.s2 + 2)
    }

    private func percentage(_ party: ConfirmSheetParty) -> some View {
        HStack(spacing: Spacing.s1) {
            Text("\(party.fromPercent)%")
                .font(.system(size: 12, design: .monospaced))
                .foregroundStyle(Theme.Color.appTextMuted)
                .strikethrough(true, color: Theme.Color.appTextMuted)
            Icon(.arrowRight, size: 11, color: Theme.Color.appTextMuted)
            Text("\(party.toPercent)%")
                .font(.system(size: 14, weight: .bold, design: .monospaced))
                .foregroundStyle(party.toPercent > party.fromPercent ? Theme.Color.success : Theme.Color.appText)
        }
    }

    private var legalGrantCopy: String {
        let coOwnerClause = coOwnerNames.isEmpty
            ? ""
            : "\(coOwnerNames) must approve before it takes effect. "
        return "you grant \(recipientName) ownership of \(homeAddress) and forfeit your own "
            + "owner record. They must verify ownership before the transfer completes. "
            + coOwnerClause
            + "Recorded on chain at "
    }

    private var legal: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            (Text("By confirming with \(biometryLabel): ")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                + Text(legalGrantCopy)
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextSecondary)
                + Text(timestamp)
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(Theme.Color.appTextStrong)
                + Text(".")
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextSecondary))
                .lineSpacing(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, Spacing.s2 + 2)
        .padding(.horizontal, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md + 2, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md + 2, style: .continuous))
    }

    private var buttons: some View {
        HStack(spacing: Spacing.s2) {
            Button(action: onCancel) {
                Text("Cancel")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .frame(maxWidth: .infinity)
            .accessibilityIdentifier("faceIDConfirmCancel")

            Button(action: onConfirm) {
                Group {
                    if isAuthenticating {
                        ProgressView()
                            .tint(Theme.Color.appTextInverse)
                    } else {
                        HStack(spacing: 7) {
                            Icon(.scanFace, size: 16, color: Theme.Color.appTextInverse)
                            Text("Confirm with \(biometryLabel)")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Theme.Color.appTextInverse)
                        }
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 48)
            }
            .background(Theme.Color.primary600)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .shadow(color: Theme.Color.primary600.opacity(0.28), radius: 8, y: 4)
            .layoutPriority(1.5)
            .frame(maxWidth: .infinity)
            .disabled(isAuthenticating)
            .accessibilityIdentifier("faceIDConfirmConfirm")
        }
    }
}

#Preview {
    FaceIDConfirmSheet(
        parties: [
            ConfirmSheetParty(
                id: "you",
                role: "From",
                name: "You · Daniel Kovács",
                initials: "DK",
                avatarStart: Theme.Color.primary500,
                avatarEnd: Theme.Color.primary700,
                fromPercent: 100,
                toPercent: 0
            ),
            ConfirmSheetParty(
                id: "maya",
                role: "To",
                name: "buyer@example.com",
                initials: "B",
                avatarStart: Theme.Color.business,
                avatarEnd: Theme.Color.businessDark,
                fromPercent: 0,
                toPercent: 100,
                verified: true
            )
        ],
        recipientName: "buyer@example.com",
        homeAddress: "412 Elm St.",
        coOwnerNames: "Mateo & Jin",
        timestamp: "14:23 May 26",
        biometryLabel: "Face ID",
        isAuthenticating: false,
        onCancel: {},
        onConfirm: {}
    )
    .background(Color.black.opacity(0.5))
}
