//
//  ProfileHeader.swift
//  Pantopus
//
//  `profile_header` slot for the Public profile detail. Centered 72pt
//  avatar with 28pt VerifiedBadge overlay, name + handle/locality row,
//  identity-pillar chip row.
//

import SwiftUI

/// Verification state for one of the three identity pillars.
public enum IdentityPillarVerificationState: Sendable, Equatable {
    case verified
    case unverified
}

/// Lightweight tuple — pillar + its verification state.
public struct IdentityPillarBadge: Sendable, Identifiable, Hashable {
    public let pillar: IdentityPillar
    public let state: IdentityPillarVerificationState

    public init(pillar: IdentityPillar, state: IdentityPillarVerificationState) {
        self.pillar = pillar
        self.state = state
    }

    public var id: String {
        switch pillar {
        case .personal: "personal"
        case .home: "home"
        case .business: "business"
        }
    }

    var label: String {
        switch pillar {
        case .personal: "Personal"
        case .home: "Home"
        case .business: "Business"
        }
    }

    var chipVariant: StatusChipVariant {
        switch (pillar, state) {
        case (.personal, .verified): .personal
        case (.home, .verified): .home
        case (.business, .verified): .business
        case (_, .unverified): .neutral
        }
    }

    var leadingIcon: PantopusIcon {
        state == .verified ? .check : .circle
    }
}

/// Centered profile header: 72pt avatar + verified-badge overlay, name,
/// handle/locality, identity-pillar chip row.
///
/// P6.5 adds two optional kind-aware chips between the handle row and the
/// identity-pillar chip row: a gold tier label (e.g. "Persona · Verified")
/// for creator profiles, and a green "Verified neighbor" shield chip for
/// residency-verified Local profiles.
@MainActor
public struct ProfileHeader: View {
    private let displayName: String
    private let handle: String?
    private let locality: String?
    private let avatarURL: URL?
    private let isVerified: Bool
    private let identityBadges: [IdentityPillarBadge]
    private let tierLabel: String?
    private let isVerifiedNeighbor: Bool
    /// `nil` renders the badges as non-tappable status chips. Pass a
    /// real handler to make them open an identity-detail surface.
    private let onBadgeTap: (@MainActor (IdentityPillar) -> Void)?

    public init(
        displayName: String,
        handle: String?,
        locality: String?,
        avatarURL: URL?,
        isVerified: Bool,
        identityBadges: [IdentityPillarBadge],
        tierLabel: String? = nil,
        isVerifiedNeighbor: Bool = false,
        onBadgeTap: (@MainActor (IdentityPillar) -> Void)? = nil
    ) {
        self.displayName = displayName
        self.handle = handle
        self.locality = locality
        self.avatarURL = avatarURL
        self.isVerified = isVerified
        self.identityBadges = identityBadges
        self.tierLabel = tierLabel
        self.isVerifiedNeighbor = isVerifiedNeighbor
        self.onBadgeTap = onBadgeTap
    }

    public var body: some View {
        VStack(spacing: Spacing.s3) {
            ZStack(alignment: .bottomTrailing) {
                AvatarWithIdentityRing(
                    name: displayName,
                    imageURL: avatarURL,
                    identity: .personal,
                    ringProgress: 1,
                    size: 72
                )
                if isVerified {
                    VerifiedBadge(size: 28).offset(x: 4, y: 4)
                }
            }
            .frame(width: 80, height: 80)

            Text(displayName)
                .font(.system(size: PantopusTextStyle.h3.size, weight: .bold))
                .tracking(-0.25)
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .accessibilityAddTraits(.isHeader)

            if handle != nil || locality != nil {
                Text(handleAndLocality)
                    .font(.system(size: PantopusTextStyle.caption.size, weight: .regular))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }

            if tierLabel != nil || isVerifiedNeighbor {
                HStack(spacing: Spacing.s2) {
                    if let tierLabel {
                        TierChip(label: tierLabel)
                    }
                    if isVerifiedNeighbor {
                        VerifiedNeighborChip()
                    }
                }
            }

            if !identityBadges.isEmpty {
                HStack(spacing: Spacing.s2) {
                    ForEach(identityBadges) { badge in
                        if let onBadgeTap {
                            Button { onBadgeTap(badge.pillar) } label: {
                                StatusChip(
                                    badge.label,
                                    variant: badge.chipVariant,
                                    icon: badge.leadingIcon
                                )
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(
                                "\(badge.label) identity, \(badge.state == .verified ? "verified" : "not verified")"
                            )
                        } else {
                            StatusChip(
                                badge.label,
                                variant: badge.chipVariant,
                                icon: badge.leadingIcon
                            )
                            .accessibilityElement()
                            .accessibilityLabel(
                                "\(badge.label) identity, \(badge.state == .verified ? "verified" : "not verified")"
                            )
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s4)
        .padding(.bottom, Spacing.s5)
        .accessibilityElement(children: .contain)
    }

    private var handleAndLocality: String {
        switch (handle, locality) {
        case let (h?, l?) where !h.isEmpty && !l.isEmpty: "@\(h) · \(l)"
        case let (h?, _) where !h.isEmpty: "@\(h)"
        case let (_, l?) where !l.isEmpty: l
        default: ""
        }
    }
}

/// Gold tier chip ("Persona · Verified" / "Gold member") rendered between
/// the handle row and the identity-pillar chip row on Persona profiles.
/// The accent uses the warning palette as a stand-in for the design's
/// custom gold; warning is the closest semantic match in the token set
/// (amber accent with caution-free meaning when it carries the crown
/// glyph).
@MainActor
private struct TierChip: View {
    let label: String

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.crown, size: 12, color: Theme.Color.warning)
            Text(label.uppercased())
                .font(.system(size: 10, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Theme.Color.warning)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s1)
        .background(Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        .accessibilityElement()
        .accessibilityLabel("\(label) tier")
    }
}

/// Green "Verified neighbor" shield chip rendered on Local profiles.
@MainActor
private struct VerifiedNeighborChip: View {
    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.shieldCheck, size: 12, color: Theme.Color.home)
            Text("VERIFIED NEIGHBOR")
                .font(.system(size: 10, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Theme.Color.home)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s1)
        .background(Theme.Color.homeBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        .accessibilityElement()
        .accessibilityLabel("Verified neighbor")
        .accessibilityIdentifier("publicProfileVerifiedNeighborChip")
    }
}

#Preview("Verified + all badges") {
    ProfileHeader(
        displayName: "Alex Rivera",
        handle: "alex",
        locality: "Cambridge, MA",
        avatarURL: nil,
        isVerified: true,
        identityBadges: [
            IdentityPillarBadge(pillar: .personal, state: .verified),
            IdentityPillarBadge(pillar: .home, state: .verified),
            IdentityPillarBadge(pillar: .business, state: .unverified)
        ]
    )
    .padding(.vertical, Spacing.s4)
    .background(Theme.Color.appBg)
}
