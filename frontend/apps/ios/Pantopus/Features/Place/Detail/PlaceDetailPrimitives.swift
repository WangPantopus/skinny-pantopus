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
    /// A section page's "Ask Pantopus" about that section (nil: none).
    var onAsk: (() -> Void)?

    var body: some View {
        HStack(spacing: 10) {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 20, strokeWidth: 2.5, color: Theme.Color.appTextStrong)
                    .frame(width: 34, height: 34)
                    .background(Theme.Color.appSurface)
                    .clipShape(Circle())
                    .shadow(color: .black.opacity(0.06), radius: 1, x: 0, y: 1)
                    // A 44-pt target around the 34-pt circle, as Ask has; the
                    // negative padding keeps the circle and title where they were.
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .padding(-5)
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
            if let onAsk {
                AskPantopusButton(accessibilityIdentifier: "placeDetail.askPantopus", action: onAsk) {
                    AskPantopusGlyph(size: 18)
                        .frame(width: 34, height: 34)
                        .background(Theme.Color.appSurface)
                        .clipShape(Circle())
                        .shadow(color: .black.opacity(0.06), radius: 1, x: 0, y: 1)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
            }
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
        // One text: a long source ("AirNow · <monitor>, within 50 miles")
        // wraps as a sentence with the time after it. Three texts in a row put
        // the time beside the source's second line.
        note
            .font(Theme.Font.caption)
            .foregroundStyle(Theme.Color.appTextMuted)
            .accessibilityLabel(asOf.map { "\(name), \($0)" } ?? name)
            .padding(.top, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var note: Text {
        let source = Text(name).fontWeight(.medium)
        guard let asOf else { return source }
        let dot = Text("·").foregroundStyle(Theme.Color.appTextMuted.opacity(0.5))
        // The no-break space keeps the dot at the end of the source's line.
        return Text("\(source)\u{00A0}\(dot) \(asOf)")
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

// MARK: - Progress toward a k-anonymity floor

/// A "N of M" unlock track — the Real Rent build-up and the Block
/// Founders meters both read one. Never draws past full (the server
/// clamps `current` too), and a zero reading draws an empty track
/// rather than a misleading sliver.
struct PlaceProgressBar: View {
    let current: Int
    let needed: Int
    var tone: Color = Theme.Color.primary600

    private var fraction: Double {
        guard needed > 0 else { return 0 }
        return min(max(Double(current) / Double(needed), 0), 1)
    }

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.Color.appSurfaceSunken)
                if fraction > 0 {
                    Capsule()
                        .fill(tone)
                        .frame(width: max(proxy.size.width * fraction, 6))
                }
            }
        }
        .frame(height: 7)
        .accessibilityLabel("\(current) of \(needed)")
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
