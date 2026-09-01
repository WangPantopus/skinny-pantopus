//
//  BizBannerHeader.swift
//  Pantopus
//
//  Profile header for business surfaces: an identity-tinted cover banner with a
//  rounded logo overlapping its lower edge, the name + handle + locality, a
//  verified disc, and a verified-identity chip beside an optional Open / Closed
//  status chip. Backs A10.6 Business profile (public) and A10.7 owner view.
//
//  Design reference: `docs/designs/A10/business-frames.jsx` (BizHeader) and
//  `docs/new-design-parity-batch2.md` § A10.6.
//
//  Business-violet by default; pass `identity` to retint the banner, logo, and
//  verified chip for personal / home reuse.
//

import SwiftUI

/// Open / Closed (or neutral) status chip shown beside the verified chip.
public struct BizStatusBadge: Hashable, Sendable {
    public enum Tone: Sendable, Hashable {
        case open
        case closed
        case neutral
    }

    public let label: String
    public let tone: Tone

    public init(label: String, tone: Tone) {
        self.label = label
        self.tone = tone
    }

    public static func open(_ label: String) -> BizStatusBadge {
        .init(label: label, tone: .open)
    }

    public static func closed(_ label: String) -> BizStatusBadge {
        .init(label: label, tone: .closed)
    }

    var background: Color {
        switch tone {
        case .open: Theme.Color.successBg
        case .closed: Theme.Color.warningBg
        case .neutral: Theme.Color.appSurfaceSunken
        }
    }

    var foreground: Color {
        switch tone {
        case .open: Theme.Color.success
        case .closed: Theme.Color.warning
        case .neutral: Theme.Color.appTextSecondary
        }
    }
}

/// Cover-banner + overlapping-logo profile header.
///
/// - Parameters:
///   - identity: Banner / logo / verified tint. Defaults to `.business`.
///   - name: Business display name.
///   - handle: `@handle` (rendered in the sky link color).
///   - locality: Neighbourhood / city, shown with a map-pin glyph.
///   - logoInitials: Logo monogram. Falls back to initials derived from `name`.
///   - logoIcon: Optional glyph rendered in the logo instead of initials.
///   - verified: Shows the logo verified disc + "· Verified" chip suffix.
///   - status: Optional Open / Closed chip.
@MainActor
public struct BizBannerHeader: View {
    private let identity: IdentityPillar
    private let name: String
    private let handle: String
    private let locality: String
    private let logoInitials: String?
    private let logoIcon: PantopusIcon?
    private let verified: Bool
    private let status: BizStatusBadge?

    public init(
        identity: IdentityPillar = .business,
        name: String,
        handle: String,
        locality: String,
        logoInitials: String? = nil,
        logoIcon: PantopusIcon? = nil,
        verified: Bool = true,
        status: BizStatusBadge? = nil
    ) {
        self.identity = identity
        self.name = name
        self.handle = handle
        self.locality = locality
        self.logoInitials = logoInitials
        self.logoIcon = logoIcon
        self.verified = verified
        self.status = status
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            banner
            content
        }
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Theme.Color.appBorder)
                .frame(height: 1)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityIdentifier("bizBannerHeader")
    }

    private var banner: some View {
        LinearGradient(
            colors: [identity.deepColor, identity.color],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .frame(height: 116)
        .overlay(
            LinearGradient(
                colors: [Color.black.opacity(0), Color.black.opacity(0.18)],
                startPoint: .top,
                endPoint: .bottom
            )
        )
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            logo
                .padding(.top, -34)
                .padding(.bottom, 10)
            Text(name)
                .font(.system(size: 20, weight: .heavy))
                .tracking(-0.5)
                .foregroundStyle(Theme.Color.appText)
            metaRow
                .padding(.top, Spacing.s1)
            chipRow
                .padding(.top, 11)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 18)
        .padding(.bottom, Spacing.s4)
    }

    private var logo: some View {
        ZStack(alignment: .bottomTrailing) {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [identity.color, identity.deepColor],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 68, height: 68)
                .overlay(logoMonogram)
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(Theme.Color.appSurface, lineWidth: 3)
                )
                .shadow(color: Color.black.opacity(0.18), radius: 6, y: 4)

            if verified {
                VerifiedBadge(size: 18, tint: identity.color)
                    .offset(x: 3, y: 3)
            }
        }
    }

    @ViewBuilder private var logoMonogram: some View {
        if let logoIcon {
            Icon(logoIcon, size: 30, strokeWidth: 2, color: Theme.Color.appTextInverse)
        } else {
            Text(resolvedInitials)
                .font(.system(size: 26, weight: .black))
                .tracking(-0.5)
                .foregroundStyle(Theme.Color.appTextInverse)
        }
    }

    private var metaRow: some View {
        HStack(spacing: Spacing.s2) {
            Text(handle)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.primary700)
            Circle()
                .fill(Theme.Color.appTextMuted)
                .frame(width: 3, height: 3)
            HStack(spacing: 3) {
                Icon(.mapPin, size: 11, strokeWidth: 2, color: Theme.Color.appTextSecondary)
                Text(locality)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
    }

    private var chipRow: some View {
        HStack(spacing: 6) {
            verifiedChip
            if let status {
                statusChip(status)
            }
        }
    }

    private var verifiedChip: some View {
        chip(
            icon: .shieldCheck,
            dot: nil,
            text: verified ? "\(identity.displayName) · Verified" : identity.displayName,
            background: identity.backgroundColor,
            foreground: identity.deepColor
        )
    }

    private func statusChip(_ status: BizStatusBadge) -> some View {
        chip(
            icon: nil,
            dot: status.foreground,
            text: status.label,
            background: status.background,
            foreground: status.foreground
        )
    }

    private func chip(
        icon: PantopusIcon?,
        dot: Color?,
        text: String,
        background: Color,
        foreground: Color
    ) -> some View {
        HStack(spacing: Spacing.s1) {
            if let dot {
                Circle().fill(dot).frame(width: 6, height: 6)
            }
            if let icon {
                Icon(icon, size: 11, strokeWidth: 2.2, color: foreground)
            }
            Text(text)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(foreground)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, Spacing.s1)
        .background(background)
        .clipShape(Capsule())
    }

    private var resolvedInitials: String {
        if let logoInitials, !logoInitials.isEmpty { return logoInitials }
        let parts = name.split(separator: " ").prefix(2)
        let derived = parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
        return derived.isEmpty ? "?" : derived
    }

    private var accessibilityLabel: String {
        var label = "\(name), \(identity.displayName)"
        if verified { label += ", verified" }
        label += ", \(locality)"
        if let status { label += ", \(status.label)" }
        return label
    }
}

// MARK: - Identity helpers (file-private)

private extension IdentityPillar {
    /// Dark gradient stop for the banner / logo, paired with `color`.
    var deepColor: Color {
        switch self {
        case .personal: Theme.Color.primary800
        case .home: Theme.Color.homeDark
        case .business: Theme.Color.businessDark
        }
    }

    var displayName: String {
        switch self {
        case .personal: "Personal"
        case .home: "Home"
        case .business: "Business"
        }
    }
}

#Preview("BizBannerHeader — open + closed") {
    VStack(spacing: Spacing.s4) {
        BizBannerHeader(
            identity: .business,
            name: "Marlow & Co. Cleaning",
            handle: "@marlowco",
            locality: "Elm Park",
            logoIcon: .sparkles,
            status: .open("Open now")
        )
        BizBannerHeader(
            identity: .business,
            name: "Tide Pool Pet Care",
            handle: "@tidepoolpets",
            locality: "Cedar Heights",
            logoIcon: .pawPrint,
            status: .closed("Closed · opens 8 AM")
        )
    }
    .padding(.vertical, Spacing.s4)
    .background(Theme.Color.appBg)
}
