//
//  CouponHero.swift
//  Pantopus
//
//  A17.5 ticket-style hero card for coupon mail. The full scanner
//  affordance lives at the bottom of CouponBody; this hero carries the
//  brand, headline, code, and expiry/minimum strip.
//

import SwiftUI

@MainActor
public struct CouponHero: View {
    private let brandLogoURL: URL?
    private let brandName: String?
    private let headline: String
    private let subcopy: String?
    private let code: String?
    private let expiresAt: String?
    private let minimumSpend: String?
    private let isExpired: Bool
    private let onCopyCode: (@MainActor () -> Void)?

    public init(
        brandLogoURL: URL?,
        brandName: String?,
        headline: String,
        subcopy: String?,
        code: String? = nil,
        expiresAt: String? = nil,
        minimumSpend: String? = nil,
        isExpired: Bool = false,
        onCopyCode: (@MainActor () -> Void)? = nil
    ) {
        self.brandLogoURL = brandLogoURL
        self.brandName = brandName
        self.headline = headline
        self.subcopy = subcopy
        self.code = code
        self.expiresAt = expiresAt
        self.minimumSpend = minimumSpend
        self.isExpired = isExpired
        self.onCopyCode = onCopyCode
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            HStack(alignment: .top, spacing: Spacing.s0) {
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    HStack(alignment: .center, spacing: Spacing.s2) {
                        BrandChip(
                            brandLogoURL: brandLogoURL,
                            brandName: brandName
                        )
                        Spacer(minLength: Spacing.s2)
                        StatusPill(isExpired: isExpired)
                    }

                    VStack(alignment: .leading, spacing: Spacing.s1) {
                        Text(headline)
                            .font(.system(size: 42, weight: .heavy))
                            .foregroundStyle(isExpired ? Theme.Color.appTextSecondary : Theme.Color.warning)
                            .tracking(-1.2)
                            .lineLimit(2)
                            .minimumScaleFactor(0.72)
                            .accessibilityAddTraits(.isHeader)

                        if let subcopy, !subcopy.isEmpty {
                            Text(subcopy)
                                .pantopusTextStyle(.small)
                                .foregroundStyle(Theme.Color.appTextStrong)
                                .lineLimit(2)
                        }
                    }

                    if let code, !code.isEmpty {
                        CodeCapsule(code: code, isExpired: isExpired, onCopyCode: onCopyCode)
                    }
                }
                .padding(Spacing.s4)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(isExpired ? Theme.Color.appSurfaceSunken : Theme.Color.warningBg)

                TicketStub(isExpired: isExpired)
                    .frame(width: 92)
                    .background(Theme.Color.appSurface)
                    .overlay(alignment: .leading) {
                        DashedDivider(color: isExpired ? Theme.Color.appBorderStrong : Theme.Color.warning)
                            .frame(width: 1)
                    }
            }

            ExpiryBanner(
                expiresAt: expiresAt,
                minimumSpend: minimumSpend,
                isExpired: isExpired
            )
        }
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous)
                .stroke(isExpired ? Theme.Color.appBorderStrong : Theme.Color.warningLight, lineWidth: 1)
        )
        .background(
            RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous)
                .fill(Theme.Color.appSurface)
        )
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("couponHero")
    }
}

private struct BrandChip: View {
    let brandLogoURL: URL?
    let brandName: String?

    var body: some View {
        HStack(spacing: Spacing.s2) {
            BrandTile(brandLogoURL: brandLogoURL, brandName: brandName)
            VStack(alignment: .leading, spacing: 2) {
                Text(brandName?.nilIfBlank ?? "Local offer")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                HStack(spacing: 3) {
                    Icon(.star, size: 10, color: Theme.Color.warning)
                    Text("Verified business")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
            }
        }
        .padding(.trailing, Spacing.s2)
        .frame(minHeight: 44)
    }
}

private struct BrandTile: View {
    let brandLogoURL: URL?
    let brandName: String?

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .fill(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.warningLight, lineWidth: 1)
                )
            if let url = brandLogoURL {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case let .success(image):
                        image.resizable().scaledToFit().padding(Spacing.s1)
                    default:
                        brandInitials
                    }
                }
            } else {
                brandInitials
            }
        }
        .frame(width: 40, height: 40)
        .accessibilityHidden(true)
    }

    private var brandInitials: some View {
        Text(initials(brandName))
            .font(.system(size: 13, weight: .heavy))
            .foregroundStyle(Theme.Color.warning)
    }

    private func initials(_ name: String?) -> String {
        let parts = (name ?? "?").split(separator: " ").prefix(2)
        let resolved = parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
        return resolved.isEmpty ? "?" : resolved
    }
}

private struct StatusPill: View {
    let isExpired: Bool

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(isExpired ? .alertCircle : .clock, size: 12, color: foreground)
            Text(isExpired ? "Expired" : "Ready")
                .pantopusTextStyle(.caption)
                .foregroundStyle(foreground)
        }
        .padding(.horizontal, Spacing.s2)
        .frame(minHeight: 28)
        .background(background)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.pill)
                .stroke(border, lineWidth: 1)
        )
        .accessibilityLabel(isExpired ? "Coupon expired" : "Coupon ready to use")
    }

    private var foreground: Color {
        isExpired ? Theme.Color.error : Theme.Color.warning
    }

    private var background: Color {
        isExpired ? Theme.Color.errorBg : Theme.Color.appSurface
    }

    private var border: Color {
        isExpired ? Theme.Color.errorLight : Theme.Color.warningLight
    }
}

private struct CodeCapsule: View {
    let code: String
    let isExpired: Bool
    let onCopyCode: (@MainActor () -> Void)?

    var body: some View {
        HStack(spacing: Spacing.s0) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Code")
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(isExpired ? Theme.Color.appTextMuted : Theme.Color.warning)
                Text(code)
                    .font(.system(size: 16, weight: .heavy, design: .monospaced))
                    .foregroundStyle(isExpired ? Theme.Color.appTextSecondary : Theme.Color.appText)
                    .tracking(0.8)
                    .lineLimit(1)
                    .minimumScaleFactor(0.76)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)

            Spacer(minLength: Spacing.s2)

            if let onCopyCode, !isExpired {
                Button(action: onCopyCode) {
                    HStack(spacing: Spacing.s1) {
                        Icon(.copy, size: 13, color: Theme.Color.warning)
                        Text("Copy")
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.warning)
                    }
                    .padding(.horizontal, Spacing.s3)
                    .frame(minHeight: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Copy coupon code \(code)")
                .accessibilityIdentifier("couponHeroCopyCodeButton")
                .overlay(alignment: .leading) {
                    DashedDivider(color: Theme.Color.warning)
                        .frame(width: 1)
                }
            }
        }
        .background(Theme.Color.appSurface.opacity(isExpired ? 0.72 : 0.86))
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(
                    isExpired ? Theme.Color.appBorderStrong : Theme.Color.warning,
                    style: StrokeStyle(lineWidth: 1.5, dash: [4, 4])
                )
        )
    }
}

private struct TicketStub: View {
    let isExpired: Bool

    var body: some View {
        VStack(spacing: Spacing.s2) {
            Icon(.tag, size: 22, color: isExpired ? Theme.Color.appTextMuted : Theme.Color.warning)
            Text("Single\nuse")
                .pantopusTextStyle(.overline)
                .foregroundStyle(isExpired ? Theme.Color.appTextMuted : Theme.Color.warning)
                .multilineTextAlignment(.center)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityHidden(true)
    }
}

private struct ExpiryBanner: View {
    let expiresAt: String?
    let minimumSpend: String?
    let isExpired: Bool

    var body: some View {
        HStack(spacing: Spacing.s3) {
            BannerFact(
                icon: .calendarClock,
                label: isExpired ? "Expired" : "Expires",
                value: displayDate(expiresAt),
                isExpired: isExpired
            )
            Rectangle()
                .fill(Theme.Color.appBorderSubtle)
                .frame(width: 1)
                .accessibilityHidden(true)
            BannerFact(
                icon: .receipt,
                label: "Minimum",
                value: minimumSpend?.nilIfBlank ?? "No minimum",
                isExpired: false
            )
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.appSurface)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "\(isExpired ? "Expired" : "Expires") \(displayDate(expiresAt)). " +
                "Minimum spend \(minimumSpend?.nilIfBlank ?? "No minimum")."
        )
    }

    private func displayDate(_ raw: String?) -> String {
        guard let raw = raw?.nilIfBlank else { return "No expiry" }
        if let date = ISO8601DateFormatter().date(from: raw) {
            return outputDateFormatter().string(from: date)
        }
        if let date = inputDateFormatter().date(from: raw) {
            return outputDateFormatter().string(from: date)
        }
        return raw
    }

    private func inputDateFormatter() -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter
    }

    private func outputDateFormatter() -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM d, yyyy"
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter
    }
}

private struct BannerFact: View {
    let icon: PantopusIcon
    let label: String
    let value: String
    let isExpired: Bool

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(icon, size: 15, color: isExpired ? Theme.Color.error : Theme.Color.appTextSecondary)
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text(value)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(isExpired ? Theme.Color.error : Theme.Color.appText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct DashedDivider: View {
    let color: Color

    var body: some View {
        GeometryReader { proxy in
            Path { path in
                path.move(to: CGPoint(x: proxy.size.width / 2, y: 0))
                path.addLine(to: CGPoint(x: proxy.size.width / 2, y: proxy.size.height))
            }
            .stroke(color, style: StrokeStyle(lineWidth: 1.5, dash: [4, 4]))
        }
        .accessibilityHidden(true)
    }
}

private extension String {
    var nilIfBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

#Preview {
    VStack(spacing: Spacing.s4) {
        CouponHero(
            brandLogoURL: nil,
            brandName: "Brass Owl Bakery",
            headline: "25% OFF",
            subcopy: "Your next in-store purchase",
            code: "BRASS25",
            expiresAt: "2026-06-30",
            minimumSpend: "$8 minimum"
        )
        CouponHero(
            brandLogoURL: nil,
            brandName: "Brass Owl Bakery",
            headline: "25% OFF",
            subcopy: "Your next in-store purchase",
            code: "BRASS25",
            expiresAt: "2026-05-01",
            minimumSpend: "$8 minimum",
            isExpired: true
        )
    }
    .padding()
    .background(Theme.Color.appBg)
}
