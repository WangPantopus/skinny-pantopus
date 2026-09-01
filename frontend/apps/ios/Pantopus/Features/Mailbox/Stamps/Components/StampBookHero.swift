//
//  StampBookHero.swift
//  Pantopus
//
//  A17.11 — the wallet hero. A featured `PerforatedStamp` (Local ·
//  Forever book) beside a balance ring ("8 of 12") and the series /
//  validity meta. Ports the `BookHero` block in `stamps.jsx`.
//

import SwiftUI

/// Featured book + balance ring. The ring fills with the remaining
/// fraction; the centre reads "{remaining} of {total}".
public struct StampBookHero: View {
    private let book: StampBook

    public init(book: StampBook) {
        self.book = book
    }

    public var body: some View {
        StampCard {
            HStack(spacing: Spacing.s4) {
                PerforatedStamp(ink: StampInk.local.color, width: 104, height: 132)
                    .shadow(color: StampInk.local.color.opacity(0.28), radius: 8, x: 0, y: 6)
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: Spacing.s0) {
                    Text(book.series.uppercased())
                        .font(.system(size: 11, weight: .bold))
                        .tracking(0.7)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)

                    HStack(spacing: 14) {
                        balanceRing
                        balanceMeta
                    }
                    .padding(.top, Spacing.s3)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(book.series). \(book.remaining) of \(book.total) stamps left. \(book.validityLabel).")
        .accessibilityIdentifier("stampsBookHero")
    }

    private var balanceRing: some View {
        ZStack {
            Circle()
                .stroke(Theme.Color.appSurfaceSunken, lineWidth: 8)
            Circle()
                .trim(from: 0, to: book.remainingFraction)
                .stroke(StampInk.local.color, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 1) {
                Text("\(book.remaining)")
                    .font(.system(size: 22, weight: .heavy))
                    .foregroundStyle(Theme.Color.appText)
                Text("of \(book.total)")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        .frame(width: 60, height: 60)
        .padding(.vertical, Spacing.s1)
    }

    private var balanceMeta: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            Text("\(book.remaining) stamps left")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text("\(book.used) used since \(book.purchasedLabel)")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(.top, 2)
            validityBadge
                .padding(.top, Spacing.s2)
        }
    }

    private var validityBadge: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.infinity, size: 12, color: Theme.Color.success)
            Text(book.validityLabel)
                .font(.system(size: 10.5, weight: .bold))
                .foregroundStyle(Theme.Color.success)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(Theme.Color.successBg)
        .clipShape(Capsule())
    }
}

#if DEBUG
#Preview("Book hero") {
    StampBookHero(book: StampsSampleData.populated.book)
        .padding(Spacing.s4)
        .background(Theme.Color.appBg)
}
#endif
