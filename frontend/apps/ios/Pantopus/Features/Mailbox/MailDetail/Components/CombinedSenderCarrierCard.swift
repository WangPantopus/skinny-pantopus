//
//  CombinedSenderCarrierCard.swift
//  Pantopus
//
//  T6.5c (P21) — Two-row Sender + Carrier card for the Certified mail
//  variant. Lifted from `certified.jsx:285-386`. Top row is the
//  government / business sender with its verification badge; bottom row
//  is the postal carrier (USPS Certified Mail) with the tracking number
//  + "Signature required" / "Postmark verified" pills.
//
//  Feature-local — only Certified composes sender + carrier in one card.
//  The generic A17.1 sender card stays in `MailDetailView`.
//

import SwiftUI

/// Carrier metadata rendered in the second row of the combined card.
public struct MailCarrierInfo: Sendable, Hashable {
    public let service: String
    public let trackingId: String?
    public let signatureRequired: Bool
    public let postmarkVerified: Bool

    public init(
        service: String,
        trackingId: String? = nil,
        signatureRequired: Bool = true,
        postmarkVerified: Bool = true
    ) {
        self.service = service
        self.trackingId = trackingId
        self.signatureRequired = signatureRequired
        self.postmarkVerified = postmarkVerified
    }
}

public struct CombinedSenderCarrierCard: View {
    public let senderName: String
    public let senderMeta: String?
    public let senderInitials: String
    public let senderAvatarTint: Color
    public let senderUserId: String?
    public let trust: MailTrust
    public let carrier: MailCarrierInfo
    public let onOpenSenderProfile: (@MainActor (String) -> Void)?

    public init(
        senderName: String,
        senderMeta: String?,
        senderInitials: String,
        senderAvatarTint: Color,
        senderUserId: String?,
        trust: MailTrust,
        carrier: MailCarrierInfo,
        onOpenSenderProfile: (@MainActor (String) -> Void)? = nil
    ) {
        self.senderName = senderName
        self.senderMeta = senderMeta
        self.senderInitials = senderInitials
        self.senderAvatarTint = senderAvatarTint
        self.senderUserId = senderUserId
        self.trust = trust
        self.carrier = carrier
        self.onOpenSenderProfile = onOpenSenderProfile
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            header
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            senderRow
            Rectangle()
                .fill(Theme.Color.appBorder)
                .frame(height: 1)
                .padding(.horizontal, Spacing.s3)
            carrierRow
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .accessibilityIdentifier("combinedSenderCarrierCard")
    }

    private var header: some View {
        Text("SENDER & CARRIER")
            .font(.system(size: 11, weight: .bold))
            .tracking(0.5)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s2)
            .padding(.bottom, Spacing.s2)
            .accessibilityAddTraits(.isHeader)
    }

    private var senderRow: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            ZStack(alignment: .bottomTrailing) {
                Text(senderInitials)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .frame(width: 40, height: 40)
                    .background(senderAvatarTint)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
                Icon(.check, size: 9, color: Theme.Color.appTextInverse)
                    .frame(width: 15, height: 15)
                    .background(Theme.Color.success)
                    .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                    .clipShape(Circle())
                    .offset(x: 3, y: 3)
            }
            VStack(alignment: .leading, spacing: 2) {
                eyebrow("FROM")
                Text(senderName)
                    .font(.system(size: 13.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                if let meta = senderMeta {
                    Text(meta)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                HStack(spacing: Spacing.s1) {
                    pill(
                        icon: .landmark,
                        text: trust.label,
                        background: Theme.Color.primary100,
                        foreground: Theme.Color.primary800
                    )
                    pill(
                        icon: nil,
                        text: "Sender domain checked",
                        background: Theme.Color.successBg,
                        foreground: Theme.Color.success
                    )
                }
                .padding(.top, Spacing.s1)
            }
            Spacer(minLength: Spacing.s0)
            if onOpenSenderProfile != nil, senderUserId != nil {
                Icon(.chevronRight, size: 14, color: Theme.Color.appTextMuted)
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .contentShape(Rectangle())
        .onTapGesture {
            if let onOpenSenderProfile, let userId = senderUserId {
                onOpenSenderProfile(userId)
            }
        }
        .accessibilityIdentifier("combinedSenderCarrierCard_sender")
    }

    private var carrierRow: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            ZStack {
                Icon(.mailbox, size: 18, color: stampForeground)
            }
            .frame(width: 40, height: 40)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .stroke(stampForeground, lineWidth: 1.5)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
            VStack(alignment: .leading, spacing: 2) {
                eyebrow("DELIVERED VIA")
                Text(carrier.service)
                    .font(.system(size: 13.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                if let trackingId = carrier.trackingId {
                    Text("#\(trackingId)")
                        .font(.system(size: 11.5, design: .monospaced))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                HStack(spacing: Spacing.s1) {
                    if carrier.signatureRequired {
                        pill(
                            icon: .pencil,
                            text: "Signature required",
                            background: Theme.Color.warningBg,
                            foreground: Theme.Color.warning
                        )
                    }
                    if carrier.postmarkVerified {
                        pill(
                            icon: nil,
                            text: "Postmark verified",
                            background: Theme.Color.successBg,
                            foreground: Theme.Color.success
                        )
                    }
                }
                .padding(.top, Spacing.s1)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .accessibilityIdentifier("combinedSenderCarrierCard_carrier")
    }

    private func eyebrow(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 10, weight: .bold))
            .tracking(0.4)
            .foregroundStyle(Theme.Color.appTextSecondary)
    }

    private func pill(
        icon: PantopusIcon?,
        text: String,
        background: Color,
        foreground: Color
    ) -> some View {
        HStack(spacing: 3) {
            if let icon {
                Icon(icon, size: 9, color: foreground)
            }
            Text(text)
                .font(.system(size: 9.5, weight: .bold))
                .foregroundStyle(foreground)
        }
        .padding(.horizontal, Spacing.s1 + 2)
        .padding(.vertical, 2)
        .background(background)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
    }

    /// Same documented palette exception as `CertifiedStampBadge` — the
    /// USPS orange isn't in the semantic token set.
    private var stampForeground: Color {
        Color(red: 0x7B / 255.0, green: 0x2D / 255.0, blue: 0x0E / 255.0)
    }
}
