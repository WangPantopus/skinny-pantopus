//
//  BeaconBanner.swift
//  Pantopus
//
//  120pt identity-tinted hero band for A21.1 / A21.2 public beacon
//  profiles. Renders a 140° linear-gradient (identityDark → identity600)
//  with three signature diagonal stripes and a caller-supplied trailing
//  slot (verified-neighbor shield, tier crown, etc).
//

import SwiftUI

/// Identity-tinted variants the beacon banner can paint with.
public enum BeaconIdentity: String, Sendable, CaseIterable {
    case personal
    case home
    case business
}

/// 120pt identity-tinted top banner for public profiles. The trailing
/// slot is right-aligned inside the band and is intended for compact
/// chips (verified-neighbor shield, tier crown).
public struct BeaconBanner<Trailing: View>: View {
    private let identity: BeaconIdentity
    private let showStripes: Bool
    private let trailing: () -> Trailing

    public init(
        identity: BeaconIdentity,
        showStripes: Bool = true,
        @ViewBuilder trailing: @escaping () -> Trailing = { EmptyView() }
    ) {
        self.identity = identity
        self.showStripes = showStripes
        self.trailing = trailing
    }

    public var body: some View {
        ZStack(alignment: .topTrailing) {
            backgroundGradient
            if showStripes { stripesLayer }
            trailingSlot
        }
        .frame(maxWidth: .infinity)
        .frame(height: 120)
        .clipped()
        .accessibilityHidden(true)
        .accessibilityIdentifier("beaconBanner_\(identity.rawValue)")
    }

    // MARK: - Layers

    private var backgroundGradient: some View {
        LinearGradient(
            colors: [darkColor, baseColor],
            startPoint: UnitPoint(x: 0.171, y: 0), // 140° start
            endPoint: UnitPoint(x: 0.829, y: 1)
        )
    }

    private var stripesLayer: some View {
        GeometryReader { proxy in
            let stripe = stripeTint
            let w = proxy.size.width
            let h = proxy.size.height
            Path { path in
                let stripeWidth: CGFloat = 1.5
                let diag = h * 0.85
                let offsets: [CGFloat] = [0.18, 0.34, 0.50]
                for ratio in offsets {
                    let x = w * ratio
                    path.move(to: CGPoint(x: x, y: -10))
                    path.addLine(to: CGPoint(x: x + diag, y: h + 10))
                    path.addLine(to: CGPoint(x: x + diag + stripeWidth, y: h + 10))
                    path.addLine(to: CGPoint(x: x + stripeWidth, y: -10))
                    path.closeSubpath()
                }
            }
            .fill(stripe.opacity(0.2))
        }
        .allowsHitTesting(false)
    }

    private var trailingSlot: some View {
        trailing()
            .padding(.top, Spacing.s3)
            .padding(.horizontal, Spacing.s4)
    }

    // MARK: - Palette

    private var baseColor: Color {
        switch identity {
        case .personal: Theme.Color.primary600
        case .home: Theme.Color.home
        case .business: Theme.Color.business
        }
    }

    private var darkColor: Color {
        switch identity {
        case .personal: Theme.Color.primary800
        case .home: Theme.Color.homeDark
        case .business: Theme.Color.businessDark
        }
    }

    private var stripeTint: Color {
        switch identity {
        case .personal: Theme.Color.primary200
        case .home: Theme.Color.homeBg
        case .business: Theme.Color.businessBg
        }
    }
}

#Preview("Personal") {
    BeaconBanner(identity: .personal) {
        HStack {
            Icon(.shieldCheck, size: 14, color: Theme.Color.appTextInverse)
            Text("Verified")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Theme.Color.appTextInverse)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s1)
        .background(Color.black.opacity(0.25))
        .clipShape(Capsule())
    }
}

#Preview("Home") {
    BeaconBanner(identity: .home) { EmptyView() }
}

#Preview("Business") {
    BeaconBanner(identity: .business, showStripes: false) { EmptyView() }
}
