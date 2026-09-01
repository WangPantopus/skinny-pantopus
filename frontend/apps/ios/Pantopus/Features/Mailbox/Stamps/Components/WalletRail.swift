//
//  WalletRail.swift
//  Pantopus
//
//  A17.11 — "Other stamps you own": a horizontal rail of the other
//  owned designs (Express / Civic / Spring / Business), each a mini
//  `PerforatedStamp` + quantity pill tinted by its ink. Ports the
//  `WalletRail` / `WalletTile` blocks in `stamps.jsx`.
//

import SwiftUI

/// Horizontal rail of owned stamp designs. Bleeds to the screen edges so
/// tiles can scroll under the gutter, matching the design's `margin: 0
/// -16` rail.
public struct WalletRail: View {
    private let stamps: [WalletStamp]
    private let summary: String
    private let onSeeCollection: () -> Void

    public init(
        stamps: [WalletStamp],
        summary: String,
        onSeeCollection: @escaping () -> Void = {}
    ) {
        self.stamps = stamps
        self.summary = summary
        self.onSeeCollection = onSeeCollection
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            header
                .padding(.horizontal, 2)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(stamps) { stamp in
                        WalletTile(stamp: stamp)
                    }
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, 2)
            }
            .padding(.horizontal, -Spacing.s4)
        }
        .accessibilityIdentifier("stampsWalletRail")
    }

    private var header: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 1) {
                Text("Other stamps you own")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text(summary)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s2)
            Button(action: onSeeCollection) {
                HStack(spacing: 3) {
                    Text("Collection")
                        .font(.system(size: 11, weight: .bold))
                    Icon(.chevronRight, size: 12, color: Theme.Color.primary600)
                }
                .foregroundStyle(Theme.Color.primary600)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("stampsWalletCollection")
        }
    }
}

/// One owned design — a mini stamp over a name + ink-tinted quantity pill.
private struct WalletTile: View {
    let stamp: WalletStamp

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            PerforatedStamp(ink: stamp.ink.color, width: 74, height: 94, toothRadius: 4, toothGap: 11) {
                StampMiniArt(name: stamp.name)
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s1)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: Spacing.s1) {
                    Text(stamp.name)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    Spacer(minLength: Spacing.s0)
                    Text("\(stamp.quantity)")
                        .font(.system(size: 11, weight: .heavy))
                        .foregroundStyle(stamp.ink.color)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 1)
                        .background(stamp.ink.color.opacity(0.08))
                        .clipShape(Capsule())
                }
                Text("\(stamp.tag) · \(stamp.denom)")
                    .font(.system(size: 10.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.bottom, 11)
        }
        .frame(width: 124)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .shadow(color: Color.black.opacity(0.03), radius: 1, x: 0, y: 1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(stamp.name), \(stamp.quantity) stamps. \(stamp.tag), \(stamp.denom).")
    }
}

/// Compact engraved artwork for wallet tiles — "PANTOPUS POST" + two
/// rings + the design name. White ink on the stamp's colour.
private struct StampMiniArt: View {
    let name: String

    var body: some View {
        VStack(spacing: Spacing.s0) {
            Text("PANTOPUS POST")
                .font(.system(size: 5.5, weight: .heavy))
                .tracking(0.6)
                .opacity(0.85)
            Spacer(minLength: 2)
            ZStack {
                ring(26)
                ring(15)
            }
            .frame(width: 26, height: 26)
            Spacer(minLength: 2)
            Text(name)
                .font(.system(size: 8.5, weight: .heavy))
                .tracking(0.3)
                .lineLimit(1)
        }
        .foregroundStyle(Color.white.opacity(0.95))
        .padding(.horizontal, 5)
        .padding(.vertical, Spacing.s2)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func ring(_ diameter: CGFloat) -> some View {
        Circle()
            .strokeBorder(Color.white.opacity(0.45), lineWidth: 1)
            .frame(width: diameter, height: diameter)
    }
}

#if DEBUG
#Preview("Wallet rail") {
    WalletRail(
        stamps: StampsSampleData.populated.wallet,
        summary: StampsSampleData.populated.walletSummary
    )
    .padding(.vertical, Spacing.s4)
    .background(Theme.Color.appBg)
}
#endif
