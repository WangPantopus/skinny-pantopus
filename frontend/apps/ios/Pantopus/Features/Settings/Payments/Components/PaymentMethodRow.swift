//
//  PaymentMethodRow.swift
//  Pantopus
//
//  A14.6 Payments — one row inside a grouped card. Renders the
//  leading 38×26 brand badge, label, optional sub-label, optional
//  status chip, and the trailing affordance (chevron / chip-chevron /
//  CTA chip / gated em-dash "—"). Mirrors the `Row` / `BrandBadge`
//  primitives in `docs/designs/A14/payments-frames.jsx`.
//

import SwiftUI

struct PaymentMethodRow: View {
    let brand: PaymentMethodBrand?
    let label: String
    let subtext: String?
    let chip: PaymentMethodChip?
    let trailing: PaymentsRowTrailing
    let rowIdentifier: String
    var labelColor: Color = Theme.Color.appText
    var rowAccessibilityIdentifier: String?
    /// Accessibility id applied to the status chip (e.g. the "Default"
    /// badge on a saved method). `nil` leaves the chip untagged.
    var chipIdentifier: String?

    var body: some View {
        HStack(spacing: Spacing.s3) {
            if let brand {
                PaymentBrandBadge(brand: brand)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(labelColor)
                    .lineLimit(1)
                if let subtext, !subtext.isEmpty {
                    Text(subtext)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: Spacing.s0)
            if let chip {
                if let chipIdentifier {
                    PaymentsChipView(label: chip.label, tone: chip.tone)
                        .accessibilityIdentifier(chipIdentifier)
                } else {
                    PaymentsChipView(label: chip.label, tone: chip.tone)
                }
            }
            trailingView
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, 14)
        .frame(minHeight: 48)
        .contentShape(Rectangle())
        .accessibilityIdentifier(rowAccessibilityIdentifier ?? "paymentsRow_\(rowIdentifier)")
    }

    @ViewBuilder
    private var trailingView: some View {
        switch trailing {
        case .chevron:
            Icon(.chevronRight, size: 16, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
        case let .chipChevron(label, tone):
            HStack(spacing: Spacing.s2) {
                PaymentsChipView(label: label, tone: tone)
                Icon(.chevronRight, size: 16, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
            }
        case let .ctaChip(label, tone):
            PaymentsChipView(label: label, tone: tone)
                .accessibilityIdentifier("paymentsRow_\(rowIdentifier)_cta")
        case .gatedDash:
            Text("—")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextMuted)
                .accessibilityIdentifier("paymentsRow_\(rowIdentifier)_gated")
        }
    }
}

/// 38×26 rounded brand mark — Visa navy, MC amber w/ overlapping dots,
/// Amex blue, Apple Pay black + apple glyph, bank sky + landmark
/// glyph, Stripe purple.
struct PaymentBrandBadge: View {
    let brand: PaymentMethodBrand

    var body: some View {
        ZStack {
            background
            content
        }
        .frame(width: 38, height: 26)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                .stroke(Color.black.opacity(0.04), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
        .accessibilityHidden(true)
    }

    @ViewBuilder private var background: some View {
        switch brand {
        case .visa:
            // Visa navy mapped to the closest design token.
            Theme.Color.primary800.opacity(0.94)
        case .mastercard:
            // Warm amber fill mapped to the warning background token.
            Theme.Color.warningBg
        case .amex:
            // Amex blue mapped to the closest primary token.
            Theme.Color.primary600
        case .applePay:
            // Near-black wallet swatch mapped to the dark text token.
            Theme.Color.appText
        case .bank:
            Theme.Color.primary100
        case .stripe:
            // Stripe brand purple — closest token is `magic`.
            Theme.Color.magic
        case .card:
            // Neutral surface for un-branded cards.
            Theme.Color.appSurfaceSunken
        }
    }

    @ViewBuilder private var content: some View {
        switch brand {
        case .visa:
            Text("VISA")
                .font(.system(size: 10, weight: .heavy))
                .tracking(0.4)
                .foregroundStyle(.white)
        case .mastercard:
            HStack(spacing: -4) {
                Circle()
                    .fill(Theme.Color.error.opacity(0.85))
                    .frame(width: 10, height: 10)
                Circle()
                    .fill(Theme.Color.warning.opacity(0.85))
                    .frame(width: 10, height: 10)
            }
        case .amex:
            Text("AMEX")
                .font(.system(size: 9, weight: .heavy))
                .tracking(0.4)
                .foregroundStyle(.white)
        case .applePay:
            Icon(.shoppingBag, size: 14, strokeWidth: 2, color: .white)
        case .bank:
            Icon(.landmark, size: 14, strokeWidth: 2, color: Theme.Color.primary700)
        case .stripe:
            Text("stripe")
                .font(.system(size: 9, weight: .heavy))
                .tracking(0.2)
                .foregroundStyle(.white)
        case .card:
            Icon(.creditCard, size: 14, strokeWidth: 2, color: Theme.Color.appTextSecondary)
        }
    }
}

/// Chip variant matching A14.6's `Chip` vocabulary. Mirrors the
/// `chipView` helper inside `GroupedListView.swift` so settings
/// surfaces read identically.
struct PaymentsChipView: View {
    let label: String
    let tone: PaymentsChipTone

    var body: some View {
        let (bg, fg) = colors
        Text(label.uppercased())
            .font(.system(size: 10.5, weight: .bold))
            .foregroundStyle(fg)
            .kerning(0.4)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 3)
            .background(bg)
            .clipShape(Capsule())
    }

    private var colors: (Color, Color) {
        switch tone {
        case .primary: (Theme.Color.primary50, Theme.Color.primary700)
        case .success: (Theme.Color.successBg, Theme.Color.success)
        case .neutral: (Theme.Color.appSurfaceSunken, Theme.Color.appTextStrong)
        }
    }
}

#Preview("PaymentMethodRow variants") {
    VStack(alignment: .leading, spacing: Spacing.s0) {
        PaymentMethodRow(
            brand: .visa,
            label: "Visa •• 4421",
            subtext: "Expires 09/27",
            chip: PaymentMethodChip(label: "Default", tone: .primary),
            trailing: .chevron,
            rowIdentifier: "preview1"
        )
        PaymentMethodRow(
            brand: .mastercard,
            label: "Mastercard •• 8830",
            subtext: "Expires 03/26",
            chip: nil,
            trailing: .chevron,
            rowIdentifier: "preview2"
        )
        PaymentMethodRow(
            brand: .applePay,
            label: "Apple Pay",
            subtext: "iPhone 15 Pro",
            chip: nil,
            trailing: .chevron,
            rowIdentifier: "preview3"
        )
        PaymentMethodRow(
            brand: .stripe,
            label: "Stripe Connect",
            subtext: "Receive payments from neighbors",
            chip: nil,
            trailing: .ctaChip(label: "Connect", tone: .primary),
            rowIdentifier: "preview4"
        )
        PaymentMethodRow(
            brand: nil,
            label: "Payout method",
            subtext: "Add after connecting Stripe",
            chip: nil,
            trailing: .gatedDash,
            rowIdentifier: "preview5"
        )
    }
    .background(Theme.Color.appSurface)
    .padding()
}
