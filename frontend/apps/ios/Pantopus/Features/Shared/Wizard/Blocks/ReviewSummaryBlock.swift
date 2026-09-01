//
//  ReviewSummaryBlock.swift
//  Pantopus
//
//  Wizard content block — read-only K/V summary card used on review steps.
//

import SwiftUI

/// A single label/value row in a `ReviewSummaryBlock`.
public struct ReviewSummaryRow: Identifiable, Equatable {
    public let id = UUID()
    public let label: String
    public let value: String

    public init(label: String, value: String) {
        self.label = label
        self.value = value
    }
}

/// White card with a stack of label/value rows separated by hairlines.
/// Use on the wizard's review step.
public struct ReviewSummaryBlock: View {
    private let rows: [ReviewSummaryRow]

    public init(_ rows: [ReviewSummaryRow]) {
        self.rows = rows
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                HStack(alignment: .firstTextBaseline) {
                    Text(row.label)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .frame(width: 96, alignment: .leading)
                    Text(row.value)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(Spacing.s3)
                if index != rows.count - 1 {
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(height: 1)
                }
            }
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}
