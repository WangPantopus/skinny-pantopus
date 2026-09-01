//
//  UsageHistoryRow.swift
//  Pantopus
//
//  A17.11 — "Usage history": which send consumed which stamp. A card of
//  rows (recipient · kind · date) each led by a tiny ink-matched stamp
//  chit, plus a "See all sends" footer. Ports the `UsageHistory` block
//  in `stamps.jsx`.
//

import SwiftUI

/// The usage-history card — header, ledger rows, and a footer link.
public struct UsageHistoryCard: View {
    private let usage: [StampUsage]
    private let window: String
    private let onSeeAll: () -> Void

    public init(usage: [StampUsage], window: String, onSeeAll: @escaping () -> Void = {}) {
        self.usage = usage
        self.window = window
        self.onSeeAll = onSeeAll
    }

    public var body: some View {
        StampCard(noPad: true) {
            StampSectionLabel("Usage history") {
                AnyView(
                    Text(window)
                        .font(.system(size: 10.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                )
            }
            .padding(.horizontal, 14)
            .padding(.top, Spacing.s3)

            ForEach(Array(usage.enumerated()), id: \.element.id) { index, item in
                if index == 0 {
                    hairline
                }
                UsageHistoryRow(usage: item)
                if index < usage.count - 1 {
                    hairline
                }
            }

            Button(action: onSeeAll) {
                HStack(spacing: Spacing.s1) {
                    Text("See all sends")
                        .font(.system(size: 12, weight: .bold))
                    Icon(.chevronRight, size: 13, color: Theme.Color.primary600)
                }
                .foregroundStyle(Theme.Color.primary600)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 11)
                .overlay(alignment: .top) {
                    Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("stampsUsageSeeAll")
        }
        .accessibilityIdentifier("stampsUsageHistory")
    }

    private var hairline: some View {
        Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
    }
}

/// One ledger row — ink chit + recipient + kind/stamp + date.
public struct UsageHistoryRow: View {
    private let usage: StampUsage

    public init(usage: StampUsage) {
        self.usage = usage
    }

    public var body: some View {
        HStack(spacing: Spacing.s3) {
            PerforatedStamp(ink: usage.ink.color, width: 26, height: 32, toothRadius: 2, toothGap: 7) {
                EmptyView()
            }
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 1) {
                Text(usage.recipient)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                (
                    Text("\(usage.kind) · ")
                        .font(.system(size: 11))
                        .foregroundColor(Theme.Color.appTextSecondary)
                        + Text(usage.stampName)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(Theme.Color.appText)
                        + Text(" stamp")
                        .font(.system(size: 11))
                        .foregroundColor(Theme.Color.appTextSecondary)
                )
                .lineLimit(1)
            }
            Spacer(minLength: Spacing.s0)
            Text(usage.dateLabel)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(usage.recipient), \(usage.kind), \(usage.stampName) stamp, \(usage.dateLabel)")
    }
}

#if DEBUG
#Preview("Usage history") {
    UsageHistoryCard(
        usage: StampsSampleData.populated.usage,
        window: StampsSampleData.populated.usageWindow
    )
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
#endif
