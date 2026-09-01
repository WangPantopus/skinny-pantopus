//
//  ChatRichCardViews.swift
//  Pantopus
//
//  Rich message cards for location, gig offer, and listing offer —
//  mirrors `frontend/apps/web/src/components/chat/ChatRichCard.tsx`.
//

import SwiftUI

struct ChatLocationCardView: View {
    let card: ChatLocationCard
    let isOutgoing: Bool
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    HStack(spacing: Spacing.s2) {
                        Text("📍")
                            .font(.system(size: 18))
                        Text("Location")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(isOutgoing ? Theme.Color.appTextInverse : Theme.Color.appText)
                    }
                    Text(card.address)
                        .font(.system(size: 14))
                        .foregroundStyle(isOutgoing ? Theme.Color.appTextInverse.opacity(0.85) : Theme.Color.appTextSecondary)
                        .multilineTextAlignment(.leading)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                Divider()
                    .overlay(isOutgoing ? Theme.Color.primary500.opacity(0.5) : Theme.Color.appBorder)
                HStack(spacing: 6) {
                    Text("🧭")
                        .font(.system(size: 12))
                    Text("Open in Maps")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(isOutgoing ? Theme.Color.appTextInverse : Theme.Color.primary600)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
            }
            .frame(maxWidth: 260, alignment: .leading)
            .background(isOutgoing ? Theme.Color.primary600 : Theme.Color.appSurface)
            .clipShape(richCardShape)
            .overlay(
                richCardShape.stroke(isOutgoing ? Theme.Color.primary500 : Theme.Color.appBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Location: \(card.address)")
    }

    private var richCardShape: UnevenRoundedRectangle {
        UnevenRoundedRectangle(
            topLeadingRadius: Radii.xl,
            bottomLeadingRadius: isOutgoing ? Radii.xl : 4,
            bottomTrailingRadius: isOutgoing ? 4 : Radii.xl,
            topTrailingRadius: Radii.xl
        )
    }
}

struct ChatGigOfferCardView: View {
    let card: ChatGigOfferCard
    let isOutgoing: Bool
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top, spacing: Spacing.s2) {
                    Text("💼")
                        .font(.system(size: 18))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(card.title)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(isOutgoing ? Theme.Color.appTextInverse : Theme.Color.appText)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                        HStack(spacing: Spacing.s2) {
                            if let category = card.category, !category.isEmpty {
                                Text(category)
                                    .font(.system(size: 11))
                                    .foregroundStyle(isOutgoing ? Theme.Color.appTextInverse.opacity(0.75) : Theme.Color.appTextSecondary)
                            }
                            if let status = card.status, !status.isEmpty {
                                Text(status.replacingOccurrences(of: "_", with: " ").capitalized)
                                    .font(.system(size: 11))
                                    .foregroundStyle(isOutgoing ? Theme.Color.appTextInverse.opacity(0.75) : Theme.Color.appTextSecondary)
                            }
                        }
                    }
                    if let priceLabel = card.priceLabel {
                        Text(priceLabel)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(isOutgoing ? Theme.Color.appTextInverse : Theme.Color.appText)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                Divider()
                    .overlay(isOutgoing ? Theme.Color.primary500.opacity(0.5) : Theme.Color.appBorder)
                HStack(spacing: 6) {
                    Text("🔗")
                        .font(.system(size: 12))
                    Text("View Task")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(isOutgoing ? Theme.Color.appTextInverse : Theme.Color.primary600)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
            }
            .frame(maxWidth: 260, alignment: .leading)
            .background(isOutgoing ? Theme.Color.primary600 : Theme.Color.appSurface)
            .clipShape(richCardShape)
            .overlay(
                richCardShape.stroke(isOutgoing ? Theme.Color.primary500 : Theme.Color.appBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Task: \(card.title)")
    }

    private var richCardShape: UnevenRoundedRectangle {
        UnevenRoundedRectangle(
            topLeadingRadius: Radii.xl,
            bottomLeadingRadius: isOutgoing ? Radii.xl : 4,
            bottomTrailingRadius: isOutgoing ? 4 : Radii.xl,
            topTrailingRadius: Radii.xl
        )
    }
}

struct ChatListingOfferCardView: View {
    let card: ChatListingOfferCard
    let isOutgoing: Bool
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: 0) {
                if let imageURL = card.imageURL {
                    ZStack(alignment: .topTrailing) {
                        AsyncImage(url: imageURL) { phase in
                            switch phase {
                            case let .success(image):
                                image.resizable().scaledToFill()
                            default:
                                Rectangle().fill(Theme.Color.appSurfaceSunken)
                            }
                        }
                        .frame(height: 128)
                        .clipped()
                        Text(card.priceLabel)
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(card.priceLabel == "FREE" ? Theme.Color.success : Theme.Color.appSurface)
                            .clipShape(Capsule())
                            .padding(8)
                    }
                }
                HStack(alignment: .top, spacing: Spacing.s2) {
                    if card.imageURL == nil {
                        Text("🏷️")
                            .font(.system(size: 18))
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text(card.title)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(isOutgoing ? Theme.Color.appTextInverse : Theme.Color.appText)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                        HStack(spacing: Spacing.s2) {
                            if let category = card.category, !category.isEmpty {
                                Text(category)
                                    .font(.system(size: 11))
                                    .foregroundStyle(isOutgoing ? Theme.Color.appTextInverse.opacity(0.75) : Theme.Color.appTextSecondary)
                            }
                            if let condition = card.condition, !condition.isEmpty {
                                Text(Self.conditionLabel(condition))
                                    .font(.system(size: 11))
                                    .foregroundStyle(isOutgoing ? Theme.Color.appTextInverse.opacity(0.75) : Theme.Color.appTextSecondary)
                            }
                        }
                    }
                    if card.imageURL == nil {
                        Text(card.priceLabel)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(isOutgoing ? Theme.Color.appTextInverse : Theme.Color.appText)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                Divider()
                    .overlay(isOutgoing ? Theme.Color.primary500.opacity(0.5) : Theme.Color.appBorder)
                HStack(spacing: 6) {
                    Text("🔗")
                        .font(.system(size: 12))
                    Text("View Listing")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(isOutgoing ? Theme.Color.appTextInverse : Theme.Color.primary600)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
            }
            .frame(maxWidth: 260, alignment: .leading)
            .background(isOutgoing ? Theme.Color.primary600 : Theme.Color.appSurface)
            .clipShape(richCardShape)
            .overlay(
                richCardShape.stroke(isOutgoing ? Theme.Color.primary500 : Theme.Color.appBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Listing: \(card.title)")
    }

    private static func conditionLabel(_ raw: String) -> String {
        switch raw {
        case "new": "New"
        case "like_new": "Like New"
        case "good": "Good"
        case "fair": "Fair"
        case "poor": "Poor"
        default: raw.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    private var richCardShape: UnevenRoundedRectangle {
        UnevenRoundedRectangle(
            topLeadingRadius: Radii.xl,
            bottomLeadingRadius: isOutgoing ? Radii.xl : 4,
            bottomTrailingRadius: isOutgoing ? 4 : Radii.xl,
            topTrailingRadius: Radii.xl
        )
    }
}
