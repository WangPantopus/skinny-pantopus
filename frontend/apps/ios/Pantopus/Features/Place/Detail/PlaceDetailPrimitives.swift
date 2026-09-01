//
//  PlaceDetailPrimitives.swift
//  Pantopus
//
//  Shared chrome for the Place group-detail pages — ported from the
//  design kit's ContentDetail layout (place-*-detail.jsx): the sticky
//  blurred header (back chevron + title + address), the section-label
//  overline, the provider Source caption, and small fact primitives the
//  bespoke detail cards compose.
//

import SwiftUI

// MARK: - Detail header (back + title + address)

struct PlaceDetailHeader: View {
    let title: String
    let address: String
    var onBack: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 20, strokeWidth: 2.5, color: Theme.Color.appTextStrong)
                    .frame(width: 34, height: 34)
                    .background(Theme.Color.appSurface)
                    .clipShape(Circle())
                    .shadow(color: .black.opacity(0.06), radius: 1, x: 0, y: 1)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.system(size: 20, weight: .bold))
                    .kerning(-0.4)
                    .foregroundStyle(Theme.Color.appText)
                Text(address)
                    .font(.system(size: 12.5, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.top, 6)
        .padding(.bottom, 12)
        .background(.bar)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }
}

/// Compact header address: "1421 SE Oak St · Portland".
func placeDetailAddress(_ place: PlaceAddressRef) -> String {
    let line1 = place.line1.trimmingCharacters(in: .whitespaces)
    let city = place.city.trimmingCharacters(in: .whitespaces)
    if !line1.isEmpty, !city.isEmpty { return "\(line1) · \(city)" }
    return line1.isEmpty ? place.label : line1
}

// MARK: - Section overline

struct PlaceDetailSectionLabel: View {
    let text: String

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .bold))
            .kerning(0.88)
            .foregroundStyle(Theme.Color.appTextMuted)
            .padding(.horizontal, 4)
            .padding(.top, 26)
            .padding(.bottom, 9)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityAddTraits(.isHeader)
    }
}

// MARK: - Provider source caption

struct PlaceSourceNote: View {
    let name: String
    var asOf: String?

    var body: some View {
        HStack(spacing: 6) {
            Text(name)
                .fontWeight(.medium)
            if let asOf {
                Text("·").opacity(0.5)
                Text(asOf)
            }
        }
        .font(Theme.Font.caption)
        .foregroundStyle(Theme.Color.appTextMuted)
        .padding(.top, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Bare card surface (detail cards compose into it)

struct PlaceDetailCard<Content: View>: View {
    var padding: CGFloat = 18
    @ViewBuilder var content: Content

    var body: some View {
        content
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(padding)
            .placeCard()
    }
}

// MARK: - A labelled fact (2×2 grid cell)

struct PlaceFactCell: View {
    let icon: PantopusIcon
    let label: String
    let value: String

    var body: some View {
        HStack(spacing: 9) {
            PlaceIconTile(icon: icon, tone: .home, size: 30)
            VStack(alignment: .leading, spacing: 1) {
                Text(label)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
                Text(value)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
    }
}

// MARK: - "Coming soon" placeholder row (uncovered/BUILD_PENDING)

struct PlaceComingSoonRow: View {
    let icon: PantopusIcon
    let title: String
    var subtitle: String?

    var body: some View {
        HStack(spacing: 11) {
            PlaceIconTile(icon: icon, tone: .muted, size: 32)
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.system(size: 14.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            Spacer(minLength: 0)
            PlaceChip(model: PlaceChipModel(tone: .neutral, text: "Coming soon"))
        }
        .padding(14)
        .placeCard()
    }
}
