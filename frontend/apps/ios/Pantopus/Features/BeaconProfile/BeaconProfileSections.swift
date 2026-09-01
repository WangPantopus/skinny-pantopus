//
//  BeaconProfileSections.swift
//  Pantopus
//
//  Screen-private sections for the Beacon profile (A21.1): the underline
//  tab strip, the owner analytics strip + broadcast composer CTA, the
//  owner empty-broadcasts state, and the About / Tiers tab bodies.
//
//  Tokens only — no raw hex.
//

import SwiftUI

// MARK: - Tab strip

/// Underline-active tab strip beneath the identity block. Mirrors the A21
/// design's `TabStrip` (Broadcasts · About · Tiers) with an optional count.
@MainActor
struct BeaconProfileTabStrip: View {
    struct Tab: Identifiable, Equatable {
        let tab: BeaconProfileTab
        let label: String
        let count: Int?
        var id: BeaconProfileTab {
            tab
        }
    }

    let tabs: [Tab]
    let selected: BeaconProfileTab
    let onSelect: @MainActor (BeaconProfileTab) -> Void

    var body: some View {
        HStack(spacing: Spacing.s6) {
            ForEach(tabs) { item in
                let isActive = item.tab == selected
                Button {
                    onSelect(item.tab)
                } label: {
                    VStack(spacing: Spacing.s2) {
                        HStack(spacing: Spacing.s1) {
                            Text(item.label)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(isActive ? Theme.Color.primary700 : Theme.Color.appTextSecondary)
                            if let count = item.count {
                                Text("\(count)")
                                    .font(.system(size: 10.5))
                                    .foregroundStyle(Theme.Color.appTextMuted)
                            }
                        }
                        Rectangle()
                            .fill(isActive ? Theme.Color.primary600 : Color.clear)
                            .frame(height: 2)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("beaconProfileTab_\(item.tab.rawValue)")
                .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
            }
            Spacer(minLength: Spacing.s0)
        }
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Theme.Color.appBorder)
                .frame(height: 1)
        }
    }
}

// MARK: - Owner analytics strip

/// Sunken analytics strip the owner sees under the identity block. Taps
/// through to the full audience dashboard (insights). Renders the real
/// follower count rather than a fabricated weekly delta.
@MainActor
struct BeaconOwnerAnalyticsStrip: View {
    let followerStat: String
    let onTap: @MainActor () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(Theme.Color.primary50)
                        .frame(width: 34, height: 34)
                    Icon(.trendingUp, size: 17, color: Theme.Color.primary600)
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text("Your audience")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Text("\(followerStat) beacons following · View insights")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                }
                Spacer(minLength: Spacing.s0)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s3)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("beaconProfileAnalyticsStrip")
        .accessibilityLabel("View audience insights")
    }
}

// MARK: - Compose CTA

/// Owner broadcast composer entry. Mirrors the RN `updatesCta` — a tinted
/// card with a megaphone disc, title, and audience-aware subtitle.
@MainActor
struct BeaconComposeCTA: View {
    let audienceLabel: String
    let onTap: @MainActor () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    Circle()
                        .fill(Theme.Color.primary600)
                        .frame(width: 38, height: 38)
                    Icon(.megaphone, size: 18, color: Theme.Color.appTextInverse)
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text("Updates")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text("Post one-way news to your \(audienceLabel.lowercased()).")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: Spacing.s0)
                Icon(.arrowRight, size: 18, color: Theme.Color.primary600)
            }
            .padding(Spacing.s3)
            .background(Theme.Color.primary50)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.primary100, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("beaconProfileComposeCTA")
        .accessibilityLabel("Compose a broadcast")
    }
}

// MARK: - Owner empty broadcasts

/// Owner-flavoured empty state for the Broadcasts tab — invites the owner
/// to post their first update rather than the visitor's "follow" CTA.
@MainActor
struct BeaconOwnerEmptyBroadcasts: View {
    let broadcastEnabled: Bool
    let onCompose: @MainActor () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ZStack {
                Circle()
                    .fill(Theme.Color.primary50)
                    .frame(width: 72, height: 72)
                Icon(.radioTower, size: 32, strokeWidth: 1.6, color: Theme.Color.primary600)
            }
            .padding(.bottom, 18)

            Text("No broadcasts yet")
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)

            Text("Share an update and it lands in every follower's Beacon feed.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 260)
                .padding(.top, Spacing.s2)

            if broadcastEnabled {
                Button(action: onCompose) {
                    HStack(spacing: 6) {
                        Icon(.megaphone, size: 14, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                        Text("Compose broadcast")
                            .font(.system(size: 12.5, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                    }
                    .padding(.horizontal, Spacing.s4)
                    .frame(height: 40)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                }
                .buttonStyle(.plain)
                .padding(.top, Spacing.s4)
                .accessibilityIdentifier("beaconProfileComposeEmptyCTA")
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.s12)
        .padding(.bottom, Spacing.s5)
        .accessibilityIdentifier("beaconProfileOwnerEmptyBroadcasts")
    }
}

// MARK: - About tab

/// About tab — bio, category / audience / follow-mode meta rows, and the
/// owner's public links.
@MainActor
struct BeaconAboutSection: View {
    let payload: BeaconProfileContent
    let onOpenLink: @MainActor (URL) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            if let bio = payload.bio, !bio.isEmpty {
                Text(bio)
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineSpacing(3)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            VStack(spacing: Spacing.s0) {
                if let category = payload.categoryLabel {
                    metaRow(icon: .crown, label: "Category", value: category)
                }
                metaRow(icon: .users, label: "Audience", value: payload.audienceLabel)
                if let mode = payload.audienceModeLabel {
                    metaRow(icon: .lock, label: "Follow mode", value: mode)
                }
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )

            if !payload.links.isEmpty {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Text("LINKS")
                        .font(.system(size: 11, weight: .semibold))
                        .tracking(0.6)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    ForEach(payload.links) { link in
                        Button {
                            if let url = URL(string: link.url) { onOpenLink(url) }
                        } label: {
                            HStack(spacing: Spacing.s2) {
                                Icon(.link, size: 14, color: Theme.Color.primary600)
                                Text(link.label)
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(Theme.Color.primary700)
                                Spacer(minLength: Spacing.s0)
                                Icon(.arrowRight, size: 14, color: Theme.Color.appTextMuted)
                            }
                            .padding(Spacing.s3)
                            .background(Theme.Color.appSurface)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                                    .stroke(Theme.Color.appBorder, lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("beaconProfileLink_\(link.label)")
                    }
                }
            }
        }
        .padding(.vertical, Spacing.s2)
        .accessibilityIdentifier("beaconProfileAbout")
    }

    private func metaRow(icon: PantopusIcon, label: String, value: String) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(icon, size: 14, color: Theme.Color.appTextSecondary)
            Text(label)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: Spacing.s0)
            Text(value)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
        }
        .padding(.vertical, Spacing.s2)
    }
}

// MARK: - Tiers tab

/// Tiers tab — the persona's subscription ladder. Visitors see the price
/// ladder; the owner sees the same with a "Manage" hint in the header.
@MainActor
struct BeaconTiersSection: View {
    let tiers: [BeaconTier]
    let isOwner: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            ForEach(tiers) { tier in
                HStack(alignment: .top, spacing: Spacing.s3) {
                    ZStack {
                        Circle()
                            .fill(Theme.Color.warningBg)
                            .frame(width: 36, height: 36)
                        Icon(.crown, size: 16, color: Theme.Color.warning)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(tier.name)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Theme.Color.appText)
                        if let detail = tier.detail, !detail.isEmpty {
                            Text(detail)
                                .font(.system(size: 12))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                                .lineLimit(2)
                        }
                    }
                    Spacer(minLength: Spacing.s0)
                    Text(tier.priceLabel)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.primary700)
                }
                .padding(Spacing.s3)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .accessibilityIdentifier("beaconProfileTier_\(tier.rank)")
            }
        }
        .padding(.vertical, Spacing.s2)
        .accessibilityIdentifier("beaconProfileTiers")
    }
}
