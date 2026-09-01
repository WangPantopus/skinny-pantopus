//
//  OtherBidsStrip.swift
//  Pantopus
//
//  Horizontal comparison strip of the competing bids on the gig — one
//  compact card per bid showing initials, amount, rating, and a
//  "cheapest" / "top-rated" flag. A "Compare all" affordance opens the
//  full bid comparison.
//
// swiftlint:disable multiple_closures_with_trailing_closure

import SwiftUI

@MainActor
public struct OtherBidsStrip: View {
    private let bids: [GigDetailDTO.OtherBid]
    private let onCompareAll: @MainActor () -> Void

    public init(bids: [GigDetailDTO.OtherBid], onCompareAll: @escaping @MainActor () -> Void = {}) {
        self.bids = bids
        self.onCompareAll = onCompareAll
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            header
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.s2) {
                    ForEach(bids) { bid in
                        OtherBidCompactCard(bid: bid)
                    }
                }
            }
        }
        .accessibilityIdentifier("gigOtherBidsStrip")
    }

    private var header: some View {
        HStack {
            GigSectionLabel(text: "THE OTHER \(bids.count) BIDS")
            Spacer()
            Button(action: { onCompareAll() }) {
                HStack(spacing: 3) {
                    Text("Compare all")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.primary600)
                    Icon(.chevronRight, size: 12, color: Theme.Color.primary600)
                }
                .frame(minHeight: 44)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("gigCompareAllBids")
            .accessibilityLabel("Compare all bids")
        }
    }
}

@MainActor
private struct OtherBidCompactCard: View {
    let bid: GigDetailDTO.OtherBid

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                Circle()
                    .fill(avatarColor)
                    .frame(width: 30, height: 30)
                    .overlay(
                        Text(bid.initials)
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                    )
                    .accessibilityHidden(true)
                Text("$\(bid.amount)")
                    .font(.system(size: 18, weight: .heavy))
                    .foregroundStyle(Theme.Color.appText)
                Spacer(minLength: Spacing.s0)
            }
            Text(bid.who)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(1)
            HStack(spacing: Spacing.s1) {
                Icon(.star, size: 9, color: Theme.Color.warning)
                Text("\(String(format: "%.1f", bid.rating)) · \(bid.jobs) jobs")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            if let flag = bid.flag {
                flagPill(flag)
            }
        }
        .padding(Spacing.s2)
        .frame(width: 150, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityText)
    }

    private var avatarColor: Color {
        switch bid.flag {
        case "cheapest": Theme.Color.success
        case "top-rated": Theme.Color.business
        default: Theme.Color.primary600
        }
    }

    private func flagPill(_ flag: String) -> some View {
        let isCheapest = flag == "cheapest"
        return Text(flag.uppercased())
            .font(.system(size: 9, weight: .heavy))
            .foregroundStyle(isCheapest ? Theme.Color.success : Theme.Color.business)
            .padding(.horizontal, Spacing.s1)
            .padding(.vertical, 2)
            .background(isCheapest ? Theme.Color.successBg : Theme.Color.businessBg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
    }

    private var accessibilityText: String {
        var parts = ["\(bid.who), $\(bid.amount), \(String(format: "%.1f", bid.rating)) stars, \(bid.jobs) jobs"]
        if let flag = bid.flag { parts.append(flag) }
        return parts.joined(separator: ", ")
    }
}
