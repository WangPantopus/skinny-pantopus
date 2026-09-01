//
//  BidCard.swift
//  Pantopus
//
//  The bid headline card for the A17.6 Gig mail body — large amount on
//  the left, unit + ETA, an expiry / "Locked in" pill on the right, and
//  the bidder's multi-line message below. Tinted with the gig accent
//  (orange) so it reads as the focal surface. Mirrors the Android
//  `BidCard.kt` shape so the two platforms render the same focal card.
//

import SwiftUI

@MainActor
public struct BidCard: View {
    private let bid: GigDetailDTO.Bid
    private let isAccepted: Bool

    public init(bid: GigDetailDTO.Bid, isAccepted: Bool) {
        self.bid = bid
        self.isAccepted = isAccepted
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            amountRow
                .padding(Spacing.s3)
            Rectangle()
                .fill(Theme.Color.handyman.opacity(0.3))
                .frame(height: 1)
                .accessibilityHidden(true)
            messageBlock
                .padding(Spacing.s3)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.handyman.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl)
                .stroke(Theme.Color.handyman.opacity(0.4), lineWidth: 1.5)
        )
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("gigBidCard")
    }

    private var amountRow: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("BID AMOUNT")
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(Theme.Color.handyman)
                HStack(alignment: .firstTextBaseline, spacing: Spacing.s1) {
                    Text("$\(bid.amount)")
                        .font(.system(size: 34, weight: .heavy))
                        .foregroundStyle(Theme.Color.appTextStrong)
                    Text("· \(bid.unit)")
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.handyman)
                }
                HStack(spacing: Spacing.s1) {
                    Icon(.clock, size: 12, color: Theme.Color.handyman)
                    Text(bid.eta)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appText)
                }
            }
            Spacer(minLength: Spacing.s0)
            expiryPill
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Bid amount $\(bid.amount) \(bid.unit), \(bid.eta)")
    }

    @ViewBuilder private var expiryPill: some View {
        let text = isAccepted ? "Locked in" : bid.expires
        let tint = isAccepted ? Theme.Color.success : Theme.Color.handyman
        let bg = isAccepted ? Theme.Color.successBg : Theme.Color.appSurface
        if !text.isEmpty {
            Text(text)
                .font(.system(size: 10, weight: .heavy))
                .foregroundStyle(tint)
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, Spacing.s1)
                .background(bg)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.pill)
                        .stroke(tint.opacity(0.4), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
                .fixedSize()
        }
    }

    private var messageBlock: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text("THEIR MESSAGE")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.handyman)
            VStack(alignment: .leading, spacing: Spacing.s1) {
                ForEach(Array(bid.message.enumerated()), id: \.offset) { _, paragraph in
                    Text("“\(paragraph)”")
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.appText)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
