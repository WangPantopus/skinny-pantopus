//
//  NearbyProvidersCard.swift
//  Pantopus
//
//  "Nearby Providers" on Pulse post detail — the organically matched local
//  businesses for a post's `service_category`. Ranked by proximity, neighbor
//  trust, and rating; never paid placement (the help tooltip says so). Mirrors
//  RN `post/[id].tsx:600`.
//

import SwiftUI

/// One row's render model. Built in the view-model from
/// `MatchedBusinessDTO` so the view stays formatting-only.
public struct NearbyProviderRow: Identifiable, Sendable, Hashable {
    public let id: String
    public let username: String
    public let name: String
    public let avatarURL: URL?
    public let category: String?
    public let ratingLabel: String?
    public let reviewCountLabel: String?
    public let distanceLabel: String?
    public let neighborLabel: String?
    public let isNew: Bool

    public init(
        id: String,
        username: String,
        name: String,
        avatarURL: URL?,
        category: String?,
        ratingLabel: String?,
        reviewCountLabel: String?,
        distanceLabel: String?,
        neighborLabel: String?,
        isNew: Bool
    ) {
        self.id = id
        self.username = username
        self.name = name
        self.avatarURL = avatarURL
        self.category = category
        self.ratingLabel = ratingLabel
        self.reviewCountLabel = reviewCountLabel
        self.distanceLabel = distanceLabel
        self.neighborLabel = neighborLabel
        self.isNew = isNew
    }
}

/// Formatting helpers shared with the Android mapper.
public enum NearbyProviderFormat {
    /// `< 1 mi` renders in feet (RN parity: `distance_miles * 5280`).
    public static func distanceLabel(_ miles: Double?) -> String? {
        guard let miles, miles >= 0 else { return nil }
        if miles < 1 {
            return "\(Int((miles * 5280).rounded())) ft"
        }
        return String(format: "%.1f mi", miles)
    }

    public static func ratingLabel(_ rating: Double?) -> String? {
        guard let rating, rating > 0 else { return nil }
        return String(format: "%.1f", rating)
    }

    public static func neighborLabel(_ count: Int?) -> String? {
        guard let count, count > 0 else { return nil }
        return "\(count) neighbor\(count == 1 ? "" : "s")"
    }
}

public struct NearbyProvidersCard: View {
    private let rows: [NearbyProviderRow]
    private let onOpenBusiness: @MainActor (String) -> Void
    @State private var showsTooltip = false

    public init(
        rows: [NearbyProviderRow],
        onOpenBusiness: @escaping @MainActor (String) -> Void = { _ in }
    ) {
        self.rows = rows
        self.onOpenBusiness = onOpenBusiness
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            header
            if showsTooltip {
                Text(
                    "These providers are matched based on proximity, neighbor trust, "
                        + "and ratings \u{2014} never paid placement."
                )
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(Spacing.s3)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(Theme.Color.appSurfaceSunken)
                )
                .accessibilityIdentifier("nearbyProviders.tooltip")
            }
            ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                if index > 0 {
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(height: 1)
                }
                providerRow(row)
            }
        }
        .padding(Spacing.s3)
        .background(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .fill(Theme.Color.appSurface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("nearbyProvidersCard")
    }

    private var header: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.shoppingBag, size: 16, color: Theme.Color.success)
            Text("Nearby Providers")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Spacer(minLength: Spacing.s0)
            Button { showsTooltip.toggle() } label: {
                Icon(.helpCircle, size: 18, color: Theme.Color.appTextMuted)
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("How are these matched?")
            .accessibilityIdentifier("nearbyProviders.help")
        }
    }

    private func providerRow(_ row: NearbyProviderRow) -> some View {
        Button { onOpenBusiness(row.username) } label: {
            HStack(spacing: Spacing.s3) {
                avatar(row)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: Spacing.s2) {
                        Text(row.name)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                            .lineLimit(1)
                        if row.isNew {
                            Text("NEW")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(Theme.Color.success)
                                .padding(.horizontal, 5)
                                .padding(.vertical, 1)
                                .background(
                                    Capsule().fill(Theme.Color.successBg)
                                )
                                .accessibilityIdentifier("nearbyProviders.newBadge")
                        }
                    }
                    if let category = row.category {
                        Text(category)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .lineLimit(1)
                    }
                    metaRow(row)
                }
                Spacer(minLength: Spacing.s0)
                Icon(.chevronRight, size: 18, color: Theme.Color.appTextMuted)
            }
            .padding(.vertical, Spacing.s2)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("nearbyProviders.row.\(row.id)")
    }

    private func metaRow(_ row: NearbyProviderRow) -> some View {
        HStack(spacing: Spacing.s2) {
            if let rating = row.ratingLabel {
                HStack(spacing: 2) {
                    Icon(.star, size: 11, color: Theme.Color.warning)
                    Text(rating)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    if let reviews = row.reviewCountLabel {
                        Text("(\(reviews))")
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.Color.appTextMuted)
                    }
                }
            }
            if let distance = row.distanceLabel {
                Text(distance)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            if let neighbors = row.neighborLabel {
                HStack(spacing: 2) {
                    Icon(.users, size: 11, color: Theme.Color.success)
                    Text(neighbors)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.success)
                }
            }
        }
    }

    private func avatar(_ row: NearbyProviderRow) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .fill(Theme.Color.appSurfaceSunken)
            if let url = row.avatarURL {
                AsyncImage(url: url) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    Icon(.shoppingBag, size: 18, color: Theme.Color.appTextMuted)
                }
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            } else {
                Icon(.shoppingBag, size: 18, color: Theme.Color.appTextMuted)
            }
        }
        .frame(width: 40, height: 40)
    }
}
