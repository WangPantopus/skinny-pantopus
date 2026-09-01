//
//  BannerLogoEditor.swift
//  Pantopus
//
//  P4.2 — A13.10 Edit Business Page. Banner + logo composite. Two
//  variants: empty (dashed drop targets with "Add banner" / "Logo"
//  labels) and filled (background palette with optional dirty rim +
//  "New" chip + Change buttons).
//

import SwiftUI

/// Banner + logo editor block. Banner is 16:7 with the logo well
/// overlapping the bottom-left; total content includes 32pt of
/// breathing room below the logo so the next section starts cleanly.
@MainActor
public struct EditBusinessBannerLogoEditor: View {
    private let banner: EditBusinessPageBannerState
    private let logo: EditBusinessPageLogoState

    public init(banner: EditBusinessPageBannerState, logo: EditBusinessPageLogoState) {
        self.banner = banner
        self.logo = logo
    }

    public var body: some View {
        ZStack(alignment: .topLeading) {
            VStack(spacing: Spacing.s0) {
                bannerBlock
                Color.clear.frame(height: 44)
            }

            logoBlock
                .padding(.leading, Spacing.s4)
                .offset(y: logoOffset)
        }
        .accessibilityIdentifier("editBusinessPage.bannerLogo")
    }

    /// Approximate baseline — at typical iPhone width (~328pt after the
    /// section's 16pt insets), the 16:7 banner is ~144pt tall. The 76pt
    /// logo well straddles the bottom edge by ~38pt.
    private var logoOffset: CGFloat {
        106
    }

    private var bannerBlock: some View {
        Group {
            switch banner {
            case .empty:
                emptyBanner
            case let .filled(dirty, palette):
                filledBanner(dirty: dirty, palette: palette)
            }
        }
        .aspectRatio(16 / 7, contentMode: .fit)
    }

    private var emptyBanner: some View {
        VStack(spacing: Spacing.s1) {
            Icon(.imagePlus, size: 22, color: Theme.Color.appTextSecondary)
            Text("Add banner")
                .font(.system(size: PantopusTextStyle.caption.size, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
            Text("1600 × 700 · JPG or PNG")
                .font(.system(size: 10))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(
                    Theme.Color.appBorderStrong,
                    style: StrokeStyle(lineWidth: 1.5, dash: [5, 4])
                )
        )
    }

    private func filledBanner(
        dirty: Bool,
        palette _: EditBusinessPageBannerState.BannerPalette
    ) -> some View {
        ZStack(alignment: .topTrailing) {
            // Background palette art — Roost-Café golden-hour
            // storefront drawn in SwiftUI shapes (no raster asset).
            CafeGoldenHourBanner()
            // Change-cover affordance — pill chip top-right.
            HStack(spacing: 5) {
                Icon(.image, size: 12, color: Theme.Color.appTextInverse)
                Text("Change banner")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 6)
            .background(Theme.Color.appText.opacity(0.7))
            .clipShape(Capsule())
            .padding(.horizontal, Spacing.s2)
            .padding(.top, Spacing.s2)
            .accessibilityIdentifier("editBusinessPage.changeBanner")

            if dirty {
                HStack(spacing: 0) {
                    Text("New")
                        .font(.system(size: 9.5, weight: .bold))
                        .tracking(0.3)
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, 3)
                .background(Theme.Color.warning)
                .clipShape(Capsule())
                .padding(.horizontal, Spacing.s2)
                .padding(.top, Spacing.s2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityLabel("New banner uploaded")
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.warning, lineWidth: dirty ? 2 : 0)
        )
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder private var logoBlock: some View {
        switch logo {
        case .empty:
            VStack(spacing: 2) {
                Icon(.plus, size: 18, color: Theme.Color.appTextSecondary)
                Text("Logo")
                    .font(.system(size: 9.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .frame(width: 76, height: 76)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .strokeBorder(
                        Theme.Color.appBorderStrong,
                        style: StrokeStyle(lineWidth: 1.5, dash: [5, 4])
                    )
            )
            .pantopusShadow(.sm)
            .accessibilityIdentifier("editBusinessPage.logoEmpty")
        case let .filled(initial, palette):
            VStack(alignment: .leading, spacing: 2) {
                LogoDisc(initial: initial, palette: palette)
                Text("Change logo")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.business)
                    .padding(.leading, 4)
            }
            .accessibilityIdentifier("editBusinessPage.logoFilled")
        }
    }
}

private struct LogoDisc: View {
    let initial: String
    let palette: EditBusinessPageLogoState.LogoPalette

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .fill(
                    RadialGradient(
                        colors: gradientColors,
                        center: UnitPoint(x: 0.3, y: 0.3),
                        startRadius: 4,
                        endRadius: 60
                    )
                )
            Text(initial)
                .font(.system(size: 28, weight: .bold, design: .serif))
                .tracking(-1)
                .foregroundStyle(Theme.Color.appTextInverse)
        }
        .frame(width: 76, height: 76)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .strokeBorder(Theme.Color.appSurface, lineWidth: 3)
        )
        .pantopusShadow(.md)
        .accessibilityLabel("Logo, \(initial)")
    }

    private var gradientColors: [Color] {
        switch palette {
        case .sunrise:
            // Warm cream → amber → bronze, matches the cafe palette.
            [Theme.Color.warningLight, Theme.Color.warning, Theme.Color.warmAmber]
        }
    }
}

/// Hand-rolled storefront illustration — sun + awning + windows +
/// silhouettes. Mirrors the design's CSS SVG so we don't need a raster
/// asset and the banner stays crisp at any density.
private struct CafeGoldenHourBanner: View {
    var body: some View {
        ZStack {
            // Sky gradient.
            LinearGradient(
                colors: [
                    Theme.Color.warningLight,
                    Theme.Color.warning,
                    Theme.Color.warmAmber
                ],
                startPoint: .top,
                endPoint: .bottom
            )

            // Sun + glow.
            GeometryReader { proxy in
                let w = proxy.size.width
                let h = proxy.size.height
                ZStack {
                    Circle()
                        .fill(Theme.Color.warningLight)
                        .frame(width: w * 0.18, height: w * 0.18)
                        .blur(radius: w * 0.05)
                        .opacity(0.85)
                    Circle()
                        .fill(Color.white.opacity(0.95))
                        .frame(width: w * 0.08, height: w * 0.08)
                }
                .position(x: w * 0.78, y: h * 0.28)
            }

            // Sidewalk band (bottom 15%).
            GeometryReader { proxy in
                Path { path in
                    let w = proxy.size.width
                    let h = proxy.size.height
                    path.addRect(CGRect(x: 0, y: h * 0.85, width: w, height: h * 0.15))
                }
                .fill(Theme.Color.appText)
            }

            // Facade + windows + awning.
            GeometryReader { proxy in
                let w = proxy.size.width
                let h = proxy.size.height
                ZStack {
                    // Facade
                    Rectangle()
                        .fill(Theme.Color.appText)
                        .frame(width: w * 0.75, height: h * 0.45)
                        .position(x: w * 0.5, y: h * 0.66)
                    // Awning (red trapezoid)
                    awning(width: w * 0.8)
                        .fill(Theme.Color.error)
                        .frame(width: w * 0.8, height: h * 0.12)
                        .position(x: w * 0.5, y: h * 0.39)
                    // Door
                    Rectangle()
                        .fill(Theme.Color.warmAmber.opacity(0.9))
                        .frame(width: w * 0.10, height: h * 0.40)
                        .position(x: w * 0.5, y: h * 0.67)
                    // Windows (3)
                    ForEach(0..<3) { idx in
                        let xPositions: [CGFloat] = [0.22, 0.5, 0.78]
                        if xPositions.indices.contains(idx) {
                            let position = xPositions[idx]
                            Rectangle()
                                .fill(Theme.Color.warningLight)
                                .frame(width: w * 0.14, height: h * 0.28)
                                .position(x: w * position, y: h * 0.62)
                                .opacity(0.92)
                        }
                    }
                }
            }
        }
    }

    private func awning(width: CGFloat) -> Path {
        Path { path in
            // Trapezoid — wider on bottom.
            path.move(to: CGPoint(x: 0, y: 0))
            path.addLine(to: CGPoint(x: width, y: 0))
            path.addLine(to: CGPoint(x: width * 0.95, y: -40))
            path.addLine(to: CGPoint(x: width * 0.05, y: -40))
            path.closeSubpath()
        }
    }
}

#Preview("Empty") {
    EditBusinessBannerLogoEditor(banner: .empty, logo: .empty)
        .padding()
        .background(Theme.Color.appBg)
}

#Preview("Filled dirty") {
    EditBusinessBannerLogoEditor(
        banner: .filled(dirty: true, palette: .cafeGoldenHour),
        logo: .filled(initial: "R", palette: .sunrise)
    )
    .padding()
    .background(Theme.Color.appBg)
}
