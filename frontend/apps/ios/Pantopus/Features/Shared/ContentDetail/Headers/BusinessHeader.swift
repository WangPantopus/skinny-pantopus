//
//  BusinessHeader.swift
//  Pantopus
//
//  `business_header` slot for the Content Detail shell. Cover banner with an
//  overlapping rounded logo + verified badge, business name, handle ·
//  locality row, identity / status chips, and an optional stat strip.
//  Replaces the former `BusinessHeaderStub` NotYetAvailable placeholder.
//  Mirrors the A10.6 Business profile `BizHeader` + `StatStrip`.
//

import SwiftUI

/// Visual tone for a stat cell's icon + value.
public enum BusinessHeaderStatTone: Sendable, Hashable {
    case neutral
    case rating
    case success
}

/// One cell in the business header's stat strip.
public struct BusinessHeaderStat: Sendable, Hashable, Identifiable {
    public let id: String
    public let value: String
    public let label: String
    public let icon: PantopusIcon?
    public let tone: BusinessHeaderStatTone

    public init(
        id: String,
        value: String,
        label: String,
        icon: PantopusIcon? = nil,
        tone: BusinessHeaderStatTone = .neutral
    ) {
        self.id = id
        self.value = value
        self.label = label
        self.icon = icon
        self.tone = tone
    }
}

/// A chip in the business header's chip row (e.g. "Business · Verified").
public struct BusinessHeaderChip: Sendable, Hashable, Identifiable {
    public let label: String
    public let variant: StatusChipVariant
    public let icon: PantopusIcon?

    public init(label: String, variant: StatusChipVariant = .neutral, icon: PantopusIcon? = nil) {
        self.label = label
        self.variant = variant
        self.icon = icon
    }

    public var id: String {
        label
    }
}

/// Business profile header. Banner → overlapping logo → identity block →
/// chip row → optional stat strip, clipped into a single surface card to
/// match the shell's inset header aesthetic.
@MainActor
public struct BusinessHeader: View {
    private let name: String
    private let handle: String?
    private let locality: String?
    private let logoURL: URL?
    private let bannerURL: URL?
    private let isVerified: Bool
    private let chips: [BusinessHeaderChip]
    private let stats: [BusinessHeaderStat]

    public init(
        name: String,
        handle: String? = nil,
        locality: String? = nil,
        logoURL: URL? = nil,
        bannerURL: URL? = nil,
        isVerified: Bool = false,
        chips: [BusinessHeaderChip] = [],
        stats: [BusinessHeaderStat] = []
    ) {
        self.name = name
        self.handle = handle
        self.locality = locality
        self.logoURL = logoURL
        self.bannerURL = bannerURL
        self.isVerified = isVerified
        self.chips = chips
        self.stats = stats
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            banner
            VStack(alignment: .leading, spacing: Spacing.s2) {
                logo
                    .offset(y: -32)
                    .padding(.bottom, -32)
                identityBlock
                if !chips.isEmpty {
                    chipRow
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s2)
            .padding(.bottom, Spacing.s4)
            if !stats.isEmpty {
                statStrip
            }
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .padding(.horizontal, Spacing.s4)
        .accessibilityIdentifier("contentDetail.businessHeader")
        .accessibilityElement(children: .contain)
        .accessibilityLabel(accessibilitySummary)
    }

    private var accessibilitySummary: String {
        var parts = [name]
        if isVerified {
            parts.append("verified business")
        }
        if let locality {
            parts.append(locality)
        }
        return parts.joined(separator: ", ")
    }

    // MARK: - Banner

    private var banner: some View {
        bannerBackground
            .frame(maxWidth: .infinity)
            .frame(height: 116)
            .clipped()
    }

    @ViewBuilder
    private var bannerBackground: some View {
        if let bannerURL {
            AsyncImage(url: bannerURL) { phase in
                switch phase {
                case let .success(image):
                    image.resizable().aspectRatio(contentMode: .fill)
                default:
                    bannerGradient
                }
            }
        } else {
            bannerGradient
        }
    }

    private var bannerGradient: some View {
        LinearGradient(
            colors: [Theme.Color.business, Theme.Color.businessDark],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    // MARK: - Logo

    private var logo: some View {
        ZStack(alignment: .bottomTrailing) {
            logoSurface
                .frame(width: 64, height: 64)
                .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                        .stroke(Theme.Color.appSurface, lineWidth: 3)
                )
                .pantopusShadow(.md)
            if isVerified {
                VerifiedBadge(size: 18, tint: Theme.Color.business)
                    .offset(x: 4, y: 4)
            }
        }
    }

    @ViewBuilder
    private var logoSurface: some View {
        if let logoURL {
            AsyncImage(url: logoURL) { phase in
                switch phase {
                case let .success(image):
                    image.resizable().aspectRatio(contentMode: .fill)
                default:
                    logoPlaceholder
                }
            }
        } else {
            logoPlaceholder
        }
    }

    private var logoPlaceholder: some View {
        ZStack {
            Theme.Color.businessBg
            Text(initials)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Theme.Color.business)
        }
    }

    private var initials: String {
        let words = name.split(separator: " ").prefix(2)
        let letters = words.compactMap(\.first)
        return String(letters).uppercased()
    }

    // MARK: - Identity

    private var identityBlock: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text(name)
                .font(.system(size: PantopusTextStyle.h3.size, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(2)
                .accessibilityAddTraits(.isHeader)
            if handle != nil || locality != nil {
                metaRow
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var metaRow: some View {
        HStack(spacing: Spacing.s2) {
            if let handle {
                Text(handle)
                    .font(.system(size: PantopusTextStyle.caption.size, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary700)
            }
            if handle != nil, locality != nil {
                Circle()
                    .fill(Theme.Color.appTextMuted)
                    .frame(width: 3, height: 3)
            }
            if let locality {
                HStack(spacing: 3) {
                    Icon(.mapPin, size: 11, color: Theme.Color.appTextSecondary)
                    Text(locality)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
        }
    }

    private var chipRow: some View {
        ContentDetailFlowLayout(spacing: 6) {
            ForEach(chips) { chip in
                StatusChip(chip.label, variant: chip.variant, icon: chip.icon)
            }
        }
    }

    // MARK: - Stat strip

    private var statStrip: some View {
        HStack(spacing: Spacing.s0) {
            ForEach(stats) { stat in
                statCell(stat)
                    .frame(maxWidth: .infinity)
                    .overlay(alignment: .trailing) {
                        if stat.id != stats.last?.id {
                            Rectangle()
                                .fill(Theme.Color.appBorderSubtle)
                                .frame(width: 1)
                                .padding(.vertical, Spacing.s2)
                        }
                    }
            }
        }
        .padding(.vertical, Spacing.s3)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Theme.Color.appBorderSubtle)
                .frame(height: 1)
        }
    }

    private func statCell(_ stat: BusinessHeaderStat) -> some View {
        VStack(spacing: 2) {
            HStack(spacing: 3) {
                if let icon = stat.icon {
                    Icon(icon, size: 12, color: statTint(stat.tone))
                }
                Text(stat.value)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(statValueColor(stat.tone))
            }
            Text(stat.label.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.4)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(stat.value) \(stat.label)")
    }

    private func statTint(_ tone: BusinessHeaderStatTone) -> Color {
        switch tone {
        case .neutral: Theme.Color.appTextSecondary
        case .rating: Theme.Color.star
        case .success: Theme.Color.success
        }
    }

    private func statValueColor(_ tone: BusinessHeaderStatTone) -> Color {
        switch tone {
        case .neutral, .rating: Theme.Color.appText
        case .success: Theme.Color.success
        }
    }
}

#Preview("Business header") {
    ScrollView {
        BusinessHeader(
            name: "Elm Park Eats",
            handle: "@elmparkeats",
            locality: "Cambridge, MA",
            isVerified: true,
            chips: [
                BusinessHeaderChip(label: "Business · Verified", variant: .business, icon: .shieldCheck),
                BusinessHeaderChip(label: "Open now", variant: .success, icon: .clock)
            ],
            stats: [
                BusinessHeaderStat(id: "rating", value: "4.9", label: "Rating", icon: .star, tone: .rating),
                BusinessHeaderStat(id: "reviews", value: "212", label: "Reviews"),
                BusinessHeaderStat(id: "years", value: "6", label: "Years")
            ]
        )
        .padding(.vertical, Spacing.s4)
    }
    .background(Theme.Color.appBg)
}
