//
//  CarrierBadge.swift
//  Pantopus
//
//  A17.8 - Carrier identity mark used in the Package detail variant.
//  Renders the carrier brand colors + short label (e.g. USPS / UPS /
//  FedEx). Unknown carriers fall back to the carrier's initials over the
//  primary tone.
//

import SwiftUI

/// Compact brand mark for a parcel carrier. Used inside the Package
/// hero / status card to identify the courier at a glance.
@MainActor
public struct CarrierBadge: View {
    private let carrier: String
    private let size: CGFloat

    public init(carrier: String, size: CGFloat = 46) {
        self.carrier = carrier
        self.size = size
    }

    public var body: some View {
        let palette = CarrierPalette.resolve(for: carrier)
        return ZStack {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .fill(palette.background)
            Rectangle()
                .fill(palette.stripe)
                .frame(height: max(2, size * 0.065))
                .offset(y: size * 0.11)
            VStack(spacing: Spacing.s1) {
                Text(palette.primaryLabel)
                    .font(.system(size: max(8, size * 0.24), weight: .bold))
                    .foregroundStyle(palette.foreground)
                    .tracking(0.4)
                if let subtitle = palette.subtitle {
                    Text(subtitle)
                        .font(.system(size: max(6, size * 0.14), weight: .semibold))
                        .foregroundStyle(palette.foreground.opacity(0.85))
                        .tracking(0.5)
                }
            }
        }
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(palette.accessibilityLabel) carrier")
        .accessibilityIdentifier("carrierBadge")
    }
}

/// Brand palette + label resolver. Keyed off carrier display name.
private struct CarrierPalette {
    let background: Color
    let stripe: Color
    let foreground: Color
    let primaryLabel: String
    let subtitle: String?
    let accessibilityLabel: String

    static func resolve(for carrier: String) -> CarrierPalette {
        let upper = carrier.uppercased()
        if upper.contains("USPS") {
            return CarrierPalette(
                background: Theme.Color.primary900,
                stripe: Theme.Color.error,
                foreground: Theme.Color.appTextInverse,
                primaryLabel: "USPS",
                subtitle: upper.contains("PRIORITY") ? "PRIORITY" : nil,
                accessibilityLabel: carrier
            )
        }
        if upper.contains("UPS") {
            return CarrierPalette(
                background: Theme.Color.appTextStrong,
                stripe: Theme.Color.warning,
                foreground: Theme.Color.appTextInverse,
                primaryLabel: "UPS",
                subtitle: upper.contains("GROUND") ? "GROUND" : nil,
                accessibilityLabel: carrier
            )
        }
        if upper.contains("FEDEX") {
            return CarrierPalette(
                background: Theme.Color.primary700,
                stripe: Theme.Color.warning,
                foreground: Theme.Color.appTextInverse,
                primaryLabel: "FEDEX",
                subtitle: nil,
                accessibilityLabel: carrier
            )
        }
        if upper.contains("DHL") {
            return CarrierPalette(
                background: Theme.Color.warning,
                stripe: Theme.Color.error,
                foreground: Theme.Color.appText,
                primaryLabel: "DHL",
                subtitle: nil,
                accessibilityLabel: carrier
            )
        }
        return CarrierPalette(
            background: Theme.Color.primary600,
            stripe: Theme.Color.primary200,
            foreground: Theme.Color.appTextInverse,
            primaryLabel: initials(for: carrier),
            subtitle: nil,
            accessibilityLabel: carrier
        )
    }

    private static func initials(for carrier: String) -> String {
        let words = carrier.split(separator: " ").prefix(2)
        let letters = words.compactMap(\.first).map(String.init).joined().uppercased()
        return letters.isEmpty ? "PKG" : letters
    }
}

#Preview {
    HStack(spacing: Spacing.s3) {
        CarrierBadge(carrier: "USPS Priority Mail")
        CarrierBadge(carrier: "UPS Ground")
        CarrierBadge(carrier: "FedEx Express")
        CarrierBadge(carrier: "DHL")
        CarrierBadge(carrier: "OnTrac")
    }
    .padding()
}
