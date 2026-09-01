//
//  BeaconIdentityBlock.swift
//  Pantopus
//
//  P8.6 (A21.1 / A21.2) — Bespoke identity card for the public Beacon
//  profile archetype. Sits with a negative top inset so it overlaps the
//  `BeaconBanner` hero, and carries:
//
//    - a 72pt avatar with an identity-tinted `VerifDot` corner badge,
//    - the caller-supplied action slot (share + Follow for personas;
//      Connect + Message for locals) pinned top-right,
//    - name (22/700) + handle + kind chip (gold "Persona · Verified"
//      crown, or green "Verified neighbor" shield) + locality pin,
//    - a 3-line bio clamp,
//    - the StatCell row (Beacons / Broadcasts / Member-since, etc).
//
//  Screen-private to the public Beacon profile (not a shared primitive),
//  so it lives next to `PublicProfileChrome`. Tokens only — no raw hex.
//

import SwiftUI

/// Left-aligned identity card that overlaps the `BeaconBanner`. Generic
/// over an `actions` slot so the host screen supplies the kind-specific
/// header buttons (built from `BeaconHeaderPrimaryButton` /
/// `BeaconHeaderGhostButton`).
@MainActor
struct BeaconIdentityBlock<Actions: View>: View {
    let identity: BeaconIdentity
    let name: String
    let handle: String?
    let tierLabel: String?
    let isVerifiedNeighbor: Bool
    let locality: String?
    let bio: String?
    let isVerified: Bool
    let avatarURL: URL?
    let stats: [ProfileStatCell]
    private let actions: () -> Actions

    init(
        identity: BeaconIdentity,
        name: String,
        handle: String?,
        tierLabel: String?,
        isVerifiedNeighbor: Bool,
        locality: String?,
        bio: String?,
        isVerified: Bool,
        avatarURL: URL?,
        stats: [ProfileStatCell],
        @ViewBuilder actions: @escaping () -> Actions
    ) {
        self.identity = identity
        self.name = name
        self.handle = handle
        self.tierLabel = tierLabel
        self.isVerifiedNeighbor = isVerifiedNeighbor
        self.locality = locality
        self.bio = bio
        self.isVerified = isVerified
        self.avatarURL = avatarURL
        self.stats = stats
        self.actions = actions
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            topRow

            Text(name)
                .font(.system(size: 22, weight: .bold))
                .tracking(-0.3)
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(2)
                .padding(.top, 10)
                .accessibilityAddTraits(.isHeader)

            metaRow
                .padding(.top, 3)

            if let bio, !bio.isEmpty {
                Text(bio)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineSpacing(3)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
                    .padding(.top, 10)
            }

            if !stats.isEmpty {
                Rectangle()
                    .fill(Theme.Color.appBorderSubtle)
                    .frame(height: 1)
                    .padding(.top, 14)
                statRow
                    .padding(.top, 12)
            }
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .fill(Theme.Color.appSurface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .pantopusShadow(.lg)
        .padding(.horizontal, Spacing.s4)
        // Overlap the 120pt banner hero — mirrors the StatsTabsBody
        // offset trick so the following body content keeps flowing.
        .offset(y: -40)
        .padding(.bottom, -40)
        .accessibilityIdentifier("beaconIdentityBlock_\(identity.rawValue)")
    }

    // MARK: - Rows

    private var topRow: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            ZStack(alignment: .bottomTrailing) {
                AvatarWithIdentityRing(
                    name: name,
                    imageURL: avatarURL,
                    identity: avatarIdentity,
                    ringProgress: 1,
                    size: 72
                )
                if isVerified {
                    BeaconVerifDot(color: accentColor)
                        .offset(x: 2, y: 2)
                }
            }
            .frame(width: 72, height: 72)

            Spacer(minLength: Spacing.s0)

            actions()
        }
    }

    private var metaRow: some View {
        HStack(spacing: Spacing.s2) {
            if let handle, !handle.isEmpty {
                Text(handle.hasPrefix("@") ? handle : "@\(handle)")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            if let tierLabel, !tierLabel.isEmpty {
                BeaconTierChip(label: tierLabel)
            }
            if isVerifiedNeighbor {
                BeaconNeighborChip()
            }
            if let locality, !locality.isEmpty {
                HStack(spacing: 3) {
                    Icon(.mapPin, size: 11, color: Theme.Color.appTextSecondary)
                    Text(locality)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: Spacing.s0)
        }
    }

    private var statRow: some View {
        HStack(spacing: Spacing.s0) {
            ForEach(Array(stats.enumerated()), id: \.element.id) { index, stat in
                VStack(spacing: 2) {
                    Text(stat.value)
                        .font(.system(size: 15, weight: .bold))
                        .tracking(-0.2)
                        .foregroundStyle(Theme.Color.appText)
                    Text(stat.label.uppercased())
                        .font(.system(size: 9.5, weight: .semibold))
                        .tracking(0.4)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity)

                if index < stats.count - 1 {
                    Rectangle()
                        .fill(Theme.Color.appBorder)
                        .frame(width: 1, height: 24)
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(statAccessibilityLabel)
    }

    // MARK: - Palette

    private var accentColor: Color {
        switch identity {
        case .personal: Theme.Color.primary600
        case .home: Theme.Color.home
        case .business: Theme.Color.business
        }
    }

    private var avatarIdentity: IdentityPillar {
        switch identity {
        case .personal: .personal
        case .home: .home
        case .business: .business
        }
    }

    private var statAccessibilityLabel: String {
        stats.map { "\($0.value) \($0.label)" }.joined(separator: ", ")
    }
}

// MARK: - Verif dot

/// Identity-tinted verification dot pinned to the avatar corner — a
/// filled accent circle with a white ring + check glyph.
@MainActor
private struct BeaconVerifDot: View {
    let color: Color

    var body: some View {
        ZStack {
            Circle()
                .fill(color)
                .frame(width: 20, height: 20)
            Circle()
                .stroke(Theme.Color.appSurface, lineWidth: 2.5)
                .frame(width: 20, height: 20)
            Icon(.check, size: 11, strokeWidth: 4, color: Theme.Color.appTextInverse)
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Chips

/// Gold "Persona · Verified" crown chip. Uses the warning palette as the
/// token-set stand-in for the design's custom gold (mirrors the existing
/// `TierChip` in `ProfileHeader`).
@MainActor
private struct BeaconTierChip: View {
    let label: String

    var body: some View {
        HStack(spacing: 3) {
            Icon(.crown, size: 10, color: Theme.Color.warning)
            Text(label.uppercased())
                .font(.system(size: 9.5, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(Theme.Color.warning)
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 2)
        .background(Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        .accessibilityElement()
        .accessibilityLabel("\(label) tier")
    }
}

/// Green "Verified neighbor" shield chip for Local profiles.
@MainActor
private struct BeaconNeighborChip: View {
    var body: some View {
        HStack(spacing: 3) {
            Icon(.shieldCheck, size: 10, color: Theme.Color.home)
            Text("VERIFIED NEIGHBOR")
                .font(.system(size: 9.5, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(Theme.Color.home)
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 2)
        .background(Theme.Color.homeBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        .accessibilityElement()
        .accessibilityLabel("Verified neighbor")
        .accessibilityIdentifier("publicProfileVerifiedNeighborChip")
    }
}

// MARK: - Header action buttons

/// Filled primary header action (Follow / Message) with a leading icon.
/// Compact 36pt pill — distinct from the screen-level `PrimaryButton`
/// which is full-width.
@MainActor
struct BeaconHeaderPrimaryButton: View {
    let title: String
    let icon: PantopusIcon
    var isProminent: Bool = true
    let action: @MainActor () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Icon(icon, size: 14, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                Text(title)
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(height: 36)
            .background(isProminent ? Theme.Color.primary600 : Theme.Color.appTextSecondary)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .pantopusShadow(isProminent ? .primary : .sm)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .accessibilityAddTraits(.isButton)
    }
}

/// Outlined neutral header action (share / Connect). When `title` is nil
/// it renders as a 36pt square icon-only button (the share kebab).
@MainActor
struct BeaconHeaderGhostButton: View {
    let title: String?
    let icon: PantopusIcon
    let accessibilityLabel: String
    let action: @MainActor () -> Void

    init(
        title: String? = nil,
        icon: PantopusIcon,
        accessibilityLabel: String,
        action: @escaping @MainActor () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.accessibilityLabel = accessibilityLabel
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Icon(icon, size: 14, color: Theme.Color.appText)
                if let title {
                    Text(title)
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                }
            }
            .padding(.horizontal, title == nil ? 0 : Spacing.s3)
            .frame(width: title == nil ? 36 : nil, height: 36)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityAddTraits(.isButton)
    }
}

#Preview("Persona") {
    ScrollView {
        VStack(spacing: Spacing.s0) {
            BeaconBanner(identity: .personal) { EmptyView() }
            BeaconIdentityBlock(
                identity: .personal,
                name: "Sana Ortiz",
                handle: "sanaortiz",
                tierLabel: "Persona · Verified",
                isVerifiedNeighbor: false,
                locality: nil,
                bio: "Urban sketcher — watercolors at lunch, ink at night.",
                isVerified: true,
                avatarURL: nil,
                stats: [
                    ProfileStatCell(id: "beacons", value: "3.4K", label: "Beacons"),
                    ProfileStatCell(id: "broadcasts", value: "92", label: "Broadcasts"),
                    ProfileStatCell(id: "member", value: "Mar 24", label: "Member")
                ]
            ) {
                BeaconHeaderGhostButton(icon: .share, accessibilityLabel: "Share") {}
                BeaconHeaderPrimaryButton(title: "Follow", icon: .plus) {}
            }
        }
    }
    .background(Theme.Color.appBg)
}
