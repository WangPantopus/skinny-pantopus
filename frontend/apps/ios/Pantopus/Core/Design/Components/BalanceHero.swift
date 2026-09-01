//
//  BalanceHero.swift
//  Pantopus
//
//  Dark sky-gradient hero card for financial surfaces (Wallet,
//  Payments) showing an available balance, currency chip, and a
//  split-strip of secondary stats. Optional `holdTone` adds an
//  inline amber banner under the strip when payouts are paused.
//
//  Design reference: `docs/designs/A10/wallet-frames.jsx` (BalanceHero)
//  and `docs/new-design-parity.md` § A10.10.
//

import SwiftUI

/// Dark sky-gradient hero card surfacing an available balance.
///
/// The component is presentation-only — the caller supplies a
/// pre-formatted `amount` string (the leading "$" glyph is rendered
/// separately so it can be baseline-aligned at half scale), a
/// `currencyCode` for the glass chip, and 0–2 `SplitCell`s for the
/// glass split-strip below the amount.
///
/// Passing a `payoutFooter` swaps the card into the A14.6 Payments
/// shape: the currency chip + arcs + split-strip collapse and a
/// compact "Next payout · date" + frequency pill row renders below
/// the amount. The gradient and glass styling are preserved so both
/// surfaces read as the same primitive family.
public struct BalanceHero: View {
    /// Visual tone — `.holdTone` appends an inline amber banner under
    /// the split strip warning that payouts are paused.
    public enum Tone: String, Sendable, Hashable {
        case `default`
        case holdTone
    }

    /// A single cell in the glass split-strip.
    public struct SplitCell: Sendable, Hashable {
        public let icon: PantopusIcon?
        public let overline: String
        public let value: String
        public let note: String?

        public init(
            icon: PantopusIcon? = nil,
            overline: String,
            value: String,
            note: String? = nil
        ) {
            self.icon = icon
            self.overline = overline
            self.value = value
            self.note = note
        }
    }

    /// A14.6 Payments variant — replaces the currency chip + split
    /// strip with a compact two-element row under the amount:
    /// "Next payout · Mon, May 27" on the leading edge, a frequency
    /// glass pill ("Weekly") on the trailing edge.
    public struct PayoutFooter: Sendable, Hashable {
        public let nextPayoutLabel: String
        public let frequencyPill: String

        public init(nextPayoutLabel: String, frequencyPill: String) {
            self.nextPayoutLabel = nextPayoutLabel
            self.frequencyPill = frequencyPill
        }
    }

    private let overline: String
    private let amount: String
    private let currencyCode: String
    private let split: [SplitCell]
    private let tone: Tone
    private let holdHeadline: String?
    private let holdBody: String?
    private let payoutFooter: PayoutFooter?

    public init(
        overline: String,
        amount: String,
        currencyCode: String,
        split: [SplitCell] = [],
        tone: Tone = .default,
        holdHeadline: String? = nil,
        holdBody: String? = nil,
        payoutFooter: PayoutFooter? = nil
    ) {
        self.overline = overline
        self.amount = amount
        self.currencyCode = currencyCode
        self.split = split
        self.tone = tone
        self.holdHeadline = holdHeadline
        self.holdBody = holdBody
        self.payoutFooter = payoutFooter
    }

    public var body: some View {
        ZStack(alignment: .topTrailing) {
            if payoutFooter == nil {
                arcs
                    .padding(.top, -50)
                    .padding(.trailing, -40)
            }

            VStack(alignment: .leading, spacing: Spacing.s3) {
                topRow
                amountRow
                if let payoutFooter {
                    payoutFooterRow(payoutFooter)
                }
                if payoutFooter == nil, !split.isEmpty {
                    splitStrip
                }
                if tone == .holdTone {
                    holdBanner
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, Spacing.s4)
            .padding(.bottom, 14)
        }
        .background(
            LinearGradient(
                stops: [
                    .init(color: Theme.Color.primary800, location: 0),
                    .init(color: Theme.Color.primary700, location: 0.55),
                    .init(color: Theme.Color.primary600, location: 1.0)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibility)
    }

    private var accessibility: String {
        if let payoutFooter {
            "\(overline): \(amount). \(payoutFooter.nextPayoutLabel), \(payoutFooter.frequencyPill)"
        } else {
            "\(overline): \(amount) \(currencyCode)"
        }
    }

    private var arcs: some View {
        ZStack {
            ForEach([90.0, 60.0, 30.0], id: \.self) { radius in
                Circle()
                    .stroke(Color.white, lineWidth: 1)
                    .frame(width: radius * 2, height: radius * 2)
            }
        }
        .opacity(0.18)
        .allowsHitTesting(false)
    }

    private var topRow: some View {
        HStack(alignment: .center) {
            Text(overline)
                .font(.system(size: 10.5, weight: .bold))
                .tracking(1.0)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Color.primary200)
            Spacer(minLength: Spacing.s2)
            if payoutFooter == nil {
                currencyChip
            }
        }
    }

    private var currencyChip: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.shieldCheck, size: 10, strokeWidth: 2.5, color: .white)
            Text(currencyCode)
                .font(.system(size: 10, weight: .bold))
                .tracking(0.4)
                .textCase(.uppercase)
                .foregroundStyle(.white)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(Color.white.opacity(0.16))
        .clipShape(Capsule())
    }

    private var amountRow: some View {
        let isCompact = payoutFooter != nil
        return HStack(alignment: .firstTextBaseline, spacing: Spacing.s1) {
            Text("$")
                .font(.system(size: isCompact ? 16 : 22, weight: .bold))
                .foregroundStyle(Theme.Color.primary200)
            Text(amount)
                .font(.system(size: isCompact ? 28 : 44, weight: isCompact ? .bold : .heavy))
                .tracking(isCompact ? -0.5 : -1.4)
                .foregroundStyle(.white)
                .monospacedDigit()
        }
    }

    private func payoutFooterRow(_ footer: PayoutFooter) -> some View {
        HStack(alignment: .center) {
            Text(footer.nextPayoutLabel)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Color.white.opacity(0.85))
                .lineLimit(1)
            Spacer(minLength: Spacing.s2)
            Text(footer.frequencyPill)
                .font(.system(size: 10.5, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(.white)
                .padding(.horizontal, 9)
                .padding(.vertical, 3)
                .background(Color.white.opacity(0.18))
                .clipShape(Capsule())
        }
    }

    private var splitStrip: some View {
        HStack(alignment: .top, spacing: Spacing.s0) {
            ForEach(Array(split.enumerated()), id: \.offset) { index, cell in
                splitCellView(cell)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if index < split.count - 1 {
                    Rectangle()
                        .fill(Color.white.opacity(0.16))
                        .frame(width: 1)
                        .padding(.horizontal, Spacing.s3)
                }
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 10)
        .background(Color.white.opacity(0.10))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Color.white.opacity(0.14), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private func splitCellView(_ cell: SplitCell) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: Spacing.s1) {
                if let icon = cell.icon {
                    Icon(icon, size: 10, strokeWidth: 2.5, color: Theme.Color.primary200)
                        .opacity(0.85)
                }
                Text(cell.overline)
                    .font(.system(size: 9.5, weight: .bold))
                    .tracking(0.6)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.Color.primary200.opacity(0.85))
            }
            Text(cell.value)
                .font(.system(size: 16, weight: .bold))
                .tracking(-0.25)
                .foregroundStyle(.white)
                .monospacedDigit()
            if let note = cell.note {
                Text(note)
                    .font(.system(size: 10.5))
                    .foregroundStyle(Theme.Color.primary200.opacity(0.8))
                    .lineLimit(1)
            }
        }
    }

    private var holdBanner: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.alertTriangle, size: 14, strokeWidth: 2.4, color: Theme.Color.warningLight)
            VStack(alignment: .leading, spacing: 1) {
                if let headline = holdHeadline {
                    Text(headline)
                        .font(.system(size: 11.5, weight: .bold))
                        .tracking(-0.05)
                        .foregroundStyle(Theme.Color.warningBg)
                }
                if let body = holdBody {
                    Text(body)
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.warningLight.opacity(0.9))
                }
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.warningLight.opacity(0.18))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Theme.Color.warningLight.opacity(0.45), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

#Preview("BalanceHero variants") {
    VStack(spacing: Spacing.s4) {
        BalanceHero(
            overline: "Available to withdraw",
            amount: "847.50",
            currencyCode: "USD",
            split: [
                .init(
                    icon: .clock,
                    overline: "Pending",
                    value: "$186.00",
                    note: "3 tasks · clears by Dec 4"
                ),
                .init(
                    icon: .trendingUp,
                    overline: "This month",
                    value: "$1,284.50",
                    note: "8 tasks · ▲22% vs Oct"
                )
            ]
        )

        BalanceHero(
            overline: "Available to withdraw",
            amount: "847.50",
            currencyCode: "USD",
            split: [
                .init(
                    icon: .clock,
                    overline: "Pending",
                    value: "$186.00",
                    note: "3 tasks · clears by Dec 4"
                ),
                .init(
                    icon: .trendingUp,
                    overline: "This month",
                    value: "$1,284.50",
                    note: "8 tasks · ▲22% vs Oct"
                )
            ],
            tone: .holdTone,
            holdHeadline: "Withdrawals paused",
            holdBody: "Re-verify your bank to release funds."
        )

        // A14.6 Payments — compact payout-footer variant.
        BalanceHero(
            overline: "Available to pay out",
            amount: "124.50",
            currencyCode: "USD",
            payoutFooter: BalanceHero.PayoutFooter(
                nextPayoutLabel: "Next payout · Mon, May 27",
                frequencyPill: "Weekly"
            )
        )
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
