//
//  BidderStack.swift
//  Pantopus
//
//  Overlapping 22pt mini-avatars + `+N` overflow tile, used inside My
//  tasks rows to communicate competition at a glance ("3 faces + 9 more
//  bid on this task").
//
//  Not built on top of `AvatarWithIdentityRing`: that component renders
//  the identity-pillar ring and assumes ≥40pt geometry. The bidder
//  primitive is intentionally minimal — initials on a tone-coloured
//  disk with a 2pt surface-coloured border that simulates overlap when
//  the parent gives each tile a -8pt leading margin.
//

import SwiftUI

@MainActor
public struct BidderStack: View {
    private let bidders: [Bidder]
    private let overflow: Int
    /// Each tile is 22pt — matches the design's bidder-stack geometry.
    private let tileSize: CGFloat = 22
    /// Negative leading margin between adjacent tiles. The 2pt surface
    /// border on each tile fills the resulting gap visually.
    private let overlap: CGFloat = -8

    public init(bidders: [Bidder], overflow: Int = 0) {
        self.bidders = bidders
        self.overflow = max(0, overflow)
    }

    public var body: some View {
        HStack(spacing: Spacing.s0) {
            ForEach(Array(bidders.enumerated()), id: \.offset) { index, bidder in
                tile(initials: bidder.initials, tone: bidder.tone, isFirst: index == 0)
            }
            if overflow > 0 {
                overflowTile()
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(a11yLabel)
    }

    private func tile(initials: String, tone: BidderTone, isFirst: Bool) -> some View {
        ZStack {
            Circle().fill(background(for: tone))
            Text(initials.prefix(2).uppercased())
                .font(.system(size: tileSize * 0.36, weight: .semibold))
                .foregroundStyle(foreground(for: tone))
        }
        .frame(width: tileSize, height: tileSize)
        .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
        .padding(.leading, isFirst ? 0 : overlap)
    }

    private func overflowTile() -> some View {
        ZStack {
            Circle().fill(Theme.Color.appSurfaceSunken)
            Text("+\(overflow)")
                .font(.system(size: tileSize * 0.36, weight: .bold))
                .foregroundStyle(Theme.Color.appTextStrong)
        }
        .frame(width: tileSize, height: tileSize)
        .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
        .padding(.leading, bidders.isEmpty ? 0 : overlap)
    }

    private var a11yLabel: String {
        let count = bidders.count + overflow
        if count == 0 {
            return "No bidders"
        } else if count == 1 {
            return "1 bidder"
        } else {
            return "\(count) bidders"
        }
    }

    private func background(for tone: BidderTone) -> Color {
        switch tone {
        case .sky: Theme.Color.primary200
        case .teal: Theme.Color.successLight
        case .amber: Theme.Color.warningLight
        case .rose: Theme.Color.errorLight
        case .violet: Theme.Color.businessBg
        case .slate: Theme.Color.appSurfaceSunken
        }
    }

    private func foreground(for tone: BidderTone) -> Color {
        switch tone {
        case .sky: Theme.Color.primary800
        case .teal: Theme.Color.success
        case .amber: Theme.Color.warning
        case .rose: Theme.Color.error
        case .violet: Theme.Color.business
        case .slate: Theme.Color.appTextStrong
        }
    }
}

#Preview("Bidder stack — 3 + overflow") {
    BidderStack(
        bidders: [
            Bidder(id: "1", initials: "AR", tone: .violet),
            Bidder(id: "2", initials: "MT", tone: .amber),
            Bidder(id: "3", initials: "JP", tone: .teal)
        ],
        overflow: 9
    )
    .padding()
    .background(Theme.Color.appSurface)
}

#Preview("Bidder stack — 1 bidder, no overflow") {
    BidderStack(
        bidders: [Bidder(id: "1", initials: "AR", tone: .sky)]
    )
    .padding()
    .background(Theme.Color.appSurface)
}
