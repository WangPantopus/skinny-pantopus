//
//  CouponBody.swift
//  Pantopus
//
//  Concrete body for the A17.5 Coupon mailbox category.
//

// swiftlint:disable file_length multiline_function_chains

import SwiftUI
import UIKit

public enum CouponBodyState: String, CaseIterable, Sendable {
    case unused
    case redeemed
    case expired
}

@MainActor
public struct CouponBody: View {
    private let coupon: CouponDetailDTO
    private let state: CouponBodyState
    /// "Similar offers near you" rail entries. There is no backend feed for
    /// these yet, so the live detail screen passes none and the rail stays
    /// hidden — inventing nearby businesses would read as real recommendations.
    /// Previews / snapshots pass the fixtures to keep the design covered.
    private let similarOffers: [MailItemSampleData.SimilarOffer]
    /// Real wallet reminder / at-arrival settings for the redeemed pass. Nil
    /// until the wallet integration lands; the chips render without a detail
    /// line rather than claiming a reminder or geofence the user never set.
    private let walletReminderDetail: String?
    private let walletArrivalDetail: String?
    @State private var isBarcodeExpanded: Bool

    public init(
        coupon: CouponDetailDTO,
        state: CouponBodyState = .unused,
        barcodeInitiallyExpanded: Bool = false,
        similarOffers: [MailItemSampleData.SimilarOffer] = [],
        walletReminderDetail: String? = nil,
        walletArrivalDetail: String? = nil
    ) {
        self.coupon = coupon
        self.state = state
        self.similarOffers = similarOffers
        self.walletReminderDetail = walletReminderDetail
        self.walletArrivalDetail = walletArrivalDetail
        _isBarcodeExpanded = State(initialValue: barcodeInitiallyExpanded)
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            heroSlot

            if state == .redeemed {
                WalletPreviewCard(
                    merchant: merchantName,
                    headline: coupon.headline,
                    code: code,
                    expiresAt: coupon.expiresAt,
                    reminderDetail: walletReminderDetail,
                    arrivalDetail: walletArrivalDetail
                )
            }

            if hasFinePrint {
                FinePrintCard(
                    terms: coupon.terms,
                    finePrint: coupon.finePrint
                )
            }

            barcodeSlot

            if !similarOffers.isEmpty {
                SimilarOffersRail(offers: similarOffers)
            }
        }
        .padding(.horizontal, Spacing.s4)
    }

    @ViewBuilder
    private var heroSlot: some View {
        if state == .redeemed {
            RedeemedRibbon(
                merchant: merchantName,
                headline: coupon.headline,
                code: code,
                expiresAt: coupon.expiresAt
            )
        } else {
            couponHero
        }
    }

    private var couponHero: some View {
        CouponHero(
            brandLogoURL: coupon.brandLogoURL,
            brandName: merchantName,
            headline: coupon.headline,
            subcopy: coupon.subcopy,
            code: code,
            expiresAt: coupon.expiresAt,
            minimumSpend: coupon.minimumSpend,
            isExpired: state == .expired,
            onCopyCode: copyCodeAction
        )
    }

    @ViewBuilder
    private var barcodeSlot: some View {
        switch state {
        case .unused:
            if let code {
                StoreBarcodeCard(
                    code: code,
                    merchant: merchantName,
                    isExpanded: $isBarcodeExpanded
                )
            }
        case .redeemed:
            InactiveCouponCard(
                icon: .checkCircle,
                title: "Redeemed",
                message: "This coupon has already been used at \(merchantName).",
                tone: .success
            )
        case .expired:
            InactiveCouponCard(
                icon: .alertCircle,
                title: "Offer expired",
                message: "The in-store barcode is no longer available for scanning.",
                tone: .error
            )
        }
    }

    private var merchantName: String {
        coupon.brandName?.nilIfBlank ?? coupon.merchant?.nilIfBlank ?? "Local offer"
    }

    private var code: String? {
        coupon.code?.nilIfBlank
    }

    private var hasFinePrint: Bool {
        coupon.terms?.nilIfBlank != nil || coupon.finePrint?.nilIfBlank != nil
    }

    private var copyCodeAction: (@MainActor () -> Void)? {
        guard code != nil else { return nil }
        return copyCode
    }

    private func copyCode() {
        guard let code else { return }
        UIPasteboard.general.string = code
    }
}

private struct StoreBarcodeCard: View {
    let code: String
    let merchant: String
    @Binding var isExpanded: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Button {
                withPantopusAnimation(.componentState, reduceMotion: reduceMotion) {
                    isExpanded.toggle()
                }
            } label: {
                HStack(spacing: Spacing.s3) {
                    Icon(.scanLine, size: 18, color: Theme.Color.primary600)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(isExpanded ? "Hide barcode" : "Show in store")
                            .pantopusTextStyle(.small)
                            .foregroundStyle(Theme.Color.appText)
                        Text(isExpanded ? "Ready for scanning at checkout" : "Tap to enlarge for checkout")
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    Spacer()
                    Icon(isExpanded ? .chevronUp : .chevronDown, size: 18, color: Theme.Color.appTextSecondary)
                }
                .frame(minHeight: 48)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(isExpanded ? "Hide store barcode" : "Show in store barcode")
            .accessibilityIdentifier("couponShowInStoreButton")

            VStack(spacing: Spacing.s3) {
                BarcodeView(
                    code: code,
                    height: isExpanded ? 156 : 64,
                    foreground: Theme.Color.appText
                )
                .accessibilityIdentifier(isExpanded ? "couponBarcodeExpanded" : "couponBarcodeCollapsed")

                HStack(spacing: Spacing.s2) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Checkout code")
                            .pantopusTextStyle(.overline)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                        Text(code)
                            .font(.system(size: isExpanded ? 20 : 15, weight: .heavy, design: .monospaced))
                            .foregroundStyle(Theme.Color.appText)
                            .tracking(1)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                    }
                    Spacer()
                    Button {
                        UIPasteboard.general.string = code
                    } label: {
                        Icon(.copy, size: 18, color: Theme.Color.primary600)
                            .frame(width: 44, height: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Copy coupon code \(code)")
                    .accessibilityIdentifier("couponBarcodeCopyButton")
                }

                if isExpanded {
                    Text("Show this screen to \(merchant). Staff can scan the barcode or key in the code.")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
        }
        .padding(Spacing.s4)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("couponBarcodeCard")
    }
}

private struct RedeemedRibbon: View {
    let merchant: String
    let headline: String
    let code: String?
    let expiresAt: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            HStack(spacing: Spacing.s2) {
                Icon(.checkCircle, size: 18, color: Theme.Color.appTextInverse)
                Text("Redeemed")
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(Theme.Color.appTextInverse)
                Spacer()
                Text("Success")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextInverse.opacity(0.9))
            }
            .padding(.horizontal, Spacing.s4)
            .frame(height: 44)
            .background(Theme.Color.success)

            VStack(alignment: .leading, spacing: Spacing.s3) {
                Text(headline)
                    .pantopusTextStyle(.h2)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Text("Used at \(merchant). The single-use barcode has been retired.")
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appTextStrong)

                HStack(spacing: Spacing.s3) {
                    RibbonFact(label: "Code", value: code ?? "Redeemed")
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(width: 1)
                    RibbonFact(label: "Original expiry", value: expiresAt?.nilIfBlank ?? "No expiry")
                }
            }
            .padding(Spacing.s4)
            .background(Theme.Color.successBg)
        }
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.success.opacity(0.28), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("couponRedeemedRibbon")
    }
}

private struct RibbonFact: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Text(value)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(1)
                .minimumScaleFactor(0.78)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Wallet-pass preview shown once the coupon is redeemed/added
/// (coupon.jsx WalletPreview): "In your wallet" header with the Active
/// dot, a pass-styled tile (brand chip + headline + code/expiry
/// columns), and the reminder / at-arrival helper chips.
private struct WalletPreviewCard: View {
    let merchant: String
    let headline: String
    let code: String?
    let expiresAt: String?
    /// Nil when the user has no reminder / at-arrival setting to show.
    let reminderDetail: String?
    let arrivalDetail: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            header
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            VStack(alignment: .leading, spacing: Spacing.s3) {
                passTile
                HStack(spacing: Spacing.s2) {
                    walletAction(icon: .bell, label: "Remind me", detail: reminderDetail)
                    walletAction(icon: .mapPin, label: "At-arrival", detail: arrivalDetail)
                }
            }
            .padding(Spacing.s3)
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("couponWalletPreview")
    }

    private var header: some View {
        HStack {
            Text("IN YOUR WALLET")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            HStack(spacing: 3) {
                Circle().fill(Theme.Color.success).frame(width: 6, height: 6)
                Text("Active")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(Theme.Color.success)
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
    }

    private var passTile: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                Text(merchantInitials)
                    .font(.system(size: 9, weight: .heavy))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .frame(width: 22, height: 22)
                    .background(Theme.Color.appTextInverse.opacity(0.18))
                    .clipShape(RoundedRectangle(cornerRadius: Radii.sm))
                Text(merchant)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .lineLimit(1)
                Spacer()
                Text("PASS")
                    .font(.system(size: 9, weight: .bold))
                    .tracking(0.8)
                    .foregroundStyle(Theme.Color.appTextInverse.opacity(0.75))
            }
            Text(headline)
                .font(.system(size: 22, weight: .heavy))
                .foregroundStyle(Theme.Color.appTextInverse)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 18) {
                if let code {
                    passFact(label: "CODE", value: code, mono: true)
                }
                passFact(label: "EXPIRES", value: expiresAt ?? "No expiry", mono: false)
            }
            .padding(.top, Spacing.s1)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(
                colors: [Theme.Color.warmAmber, Theme.Color.warning],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .overlay(alignment: .bottomTrailing) {
            // Decorative concentric arcs, per the JSX pass artwork.
            ZStack {
                Circle().stroke(Theme.Color.appTextInverse, lineWidth: 2)
                    .frame(width: 96, height: 96)
                Circle().stroke(Theme.Color.appTextInverse, lineWidth: 2)
                    .frame(width: 68, height: 68)
            }
            .opacity(0.12)
            .offset(x: 22, y: 22)
        }
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
    }

    private func passFact(label: String, value: String, mono: Bool) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 8.5, weight: .bold))
                .tracking(0.7)
                .foregroundStyle(Theme.Color.appTextInverse.opacity(0.75))
            Text(value)
                .font(.system(size: 12, weight: .bold, design: mono ? .monospaced : .default))
                .tracking(mono ? 0.6 : 0)
                .foregroundStyle(Theme.Color.appTextInverse)
        }
    }

    private func walletAction(icon: PantopusIcon, label: String, detail: String?) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(icon, size: 13, color: Theme.Color.primary700)
                .frame(width: 26, height: 26)
                .background(Theme.Color.appSurface)
                .overlay(RoundedRectangle(cornerRadius: 7).stroke(Theme.Color.appBorder, lineWidth: 1))
                .clipShape(RoundedRectangle(cornerRadius: 7))
            VStack(alignment: .leading, spacing: 1) {
                Text(label)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                if let detail {
                    Text(detail)
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, Spacing.s2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private var merchantInitials: String {
        merchant.split(separator: " ").prefix(2)
            .compactMap(\.first)
            .map(String.init)
            .joined()
            .uppercased()
    }
}

/// Similar-offers rail (coupon.jsx SimilarOffers): header + horizontal
/// strip of mini ticket cards. Decorative — driven by
/// `MailItemSampleData.couponSimilarOffers` until the rail gets a
/// backend feed.
private struct SimilarOffersRail: View {
    let offers: [MailItemSampleData.SimilarOffer]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            header
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(Array(offers.enumerated()), id: \.element.id) { index, offer in
                        MiniCouponCard(offer: offer, paletteIndex: index)
                    }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("couponSimilarOffers")
    }

    private var header: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 1) {
                Text("Similar offers near you")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Text("From other verified neighbors and businesses")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer()
            HStack(spacing: 3) {
                Text("See all")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(Theme.Color.primary600)
                Icon(.chevronRight, size: 12, color: Theme.Color.primary600)
            }
        }
    }
}

private struct MiniCouponCard: View {
    let offer: MailItemSampleData.SimilarOffer
    let paletteIndex: Int

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            tintPanel
            Rectangle().fill(Theme.Color.appBorderStrong).frame(height: 1)
            footer
        }
        .frame(width: 168)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("couponSimilarOffer_\(offer.id)")
    }

    /// Per-card tone/tint pairs from the design's SIMILAR palette,
    /// mapped onto tokens: sky, magic violet, home green, error red.
    private var palette: [(tone: Color, tint: Color)] {
        [
            (Theme.Color.primary900, Theme.Color.primary100),
            (Theme.Color.magic, Theme.Color.magicBg),
            (Theme.Color.homeDark, Theme.Color.homeBg),
            (Theme.Color.error, Theme.Color.errorBg)
        ]
    }

    private var tone: Color {
        palette[paletteIndex % palette.count].tone
    }

    private var tint: Color {
        palette[paletteIndex % palette.count].tint
    }

    private var tintPanel: some View {
        VStack(alignment: .leading, spacing: Spacing.s2 + 2) {
            HStack(spacing: Spacing.s2) {
                Text(offer.initials)
                    .font(.system(size: 9, weight: .heavy))
                    .foregroundColor(tone)
                    .frame(width: 24, height: 24)
                    .background(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.sm)
                            .stroke(tone.opacity(0.2), lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.sm))
                VStack(alignment: .leading, spacing: 1) {
                    Text(offer.brand)
                        .font(.system(size: 10.5, weight: .bold))
                        .foregroundColor(tone)
                        .lineLimit(1)
                    Text(offer.distance)
                        .font(.system(size: 9))
                        .foregroundColor(tone.opacity(0.7))
                }
            }
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text(offer.amount)
                    .font(.system(size: 20, weight: .heavy))
                    .foregroundColor(tone)
                Text(offer.subline)
                    .font(.system(size: 10.5, weight: .semibold))
                    .foregroundColor(tone.opacity(0.85))
                    .lineLimit(1)
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tint)
    }

    private var footer: some View {
        HStack {
            (
                Text("Expires ")
                    .foregroundColor(Theme.Color.appTextSecondary)
                    + Text(offer.expires)
                    .fontWeight(.semibold)
                    .foregroundColor(Theme.Color.appTextStrong)
            )
            .font(.system(size: 10))
            Spacer()
            HStack(spacing: 2) {
                Text("Claim")
                    .font(.system(size: 10.5, weight: .bold))
                    .foregroundColor(Theme.Color.primary600)
                Icon(.arrowRight, size: 10, color: Theme.Color.primary600)
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
    }
}

private struct FinePrintCard: View {
    let terms: String?
    let finePrint: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(spacing: Spacing.s2) {
                Icon(.fileText, size: 15, color: Theme.Color.appTextSecondary)
                Text("Fine print")
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer()
                Text("From sender")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }

            VStack(alignment: .leading, spacing: Spacing.s2) {
                if let finePrint = finePrint?.nilIfBlank {
                    BulletLine(text: finePrint)
                }
                if let terms = terms?.nilIfBlank {
                    BulletLine(text: terms)
                }
            }
        }
        .padding(Spacing.s4)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("couponFinePrintCard")
    }
}

private struct BulletLine: View {
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Circle()
                .fill(Theme.Color.appTextMuted)
                .frame(width: 4, height: 4)
                .padding(.top, 7)
                .accessibilityHidden(true)
            Text(text)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextStrong)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

private enum InactiveTone {
    case success
    case error

    var foreground: Color {
        switch self {
        case .success: Theme.Color.success
        case .error: Theme.Color.error
        }
    }

    var background: Color {
        switch self {
        case .success: Theme.Color.successBg
        case .error: Theme.Color.errorBg
        }
    }
}

private struct InactiveCouponCard: View {
    let icon: PantopusIcon
    let title: String
    let message: String
    let tone: InactiveTone

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            Icon(icon, size: 20, color: tone.foreground)
                .frame(width: 32, height: 32)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text(title)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appText)
                Text(message)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        .padding(Spacing.s4)
        .background(tone.background)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(tone.foreground.opacity(0.22), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("couponInactiveStatusCard")
    }
}

private extension String {
    var nilIfBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

#Preview("Unused") {
    ScrollView {
        CouponBody(
            coupon: MailItemSampleData.couponUnused,
            state: .unused,
            similarOffers: MailItemSampleData.couponSimilarOffers
        )
    }
    .background(Theme.Color.appBg)
}

#Preview("Redeemed") {
    ScrollView {
        CouponBody(
            coupon: MailItemSampleData.couponRedeemed,
            state: .redeemed,
            similarOffers: MailItemSampleData.couponSimilarOffers,
            walletReminderDetail: MailItemSampleData.couponWalletReminderDetail,
            walletArrivalDetail: MailItemSampleData.couponWalletArrivalDetail
        )
    }
    .background(Theme.Color.appBg)
}

#Preview("Expired") {
    ScrollView {
        CouponBody(
            coupon: MailItemSampleData.couponExpired,
            state: .expired,
            similarOffers: MailItemSampleData.couponSimilarOffers
        )
    }
    .background(Theme.Color.appBg)
}
