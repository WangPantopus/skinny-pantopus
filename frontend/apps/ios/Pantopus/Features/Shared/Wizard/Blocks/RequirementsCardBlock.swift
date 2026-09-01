//
//  RequirementsCardBlock.swift
//  Pantopus
//
//  Wizard content block — UPPERCASE overline header followed by a
//  white surface card listing requirement rows. Used by P20's claim
//  ownership Step 1 to show what the user needs to complete the flow.
//

import SwiftUI

/// One row inside `RequirementsCardBlock` — checklist icon, bold title,
/// secondary subcopy.
public struct RequirementsRow: Identifiable, Sendable {
    public let id: String
    public let icon: PantopusIcon
    public let title: String
    public let subcopy: String
    public let emphasized: Bool

    public init(
        id: String,
        icon: PantopusIcon,
        title: String,
        subcopy: String,
        emphasized: Bool = false
    ) {
        self.id = id
        self.icon = icon
        self.title = title
        self.subcopy = subcopy
        self.emphasized = emphasized
    }
}

/// Card block listing prerequisite requirements for a wizard flow.
@MainActor
public struct RequirementsCardBlock: View {
    private let title: String
    private let rows: [RequirementsRow]

    public init(title: String = "What you'll need", rows: [RequirementsRow]) {
        self.title = title
        self.rows = rows
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text(title.uppercased())
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            ForEach(rows) { row in
                HStack(alignment: .top, spacing: Spacing.s3) {
                    Circle()
                        .fill(row.emphasized ? Theme.Color.warningBg : Theme.Color.homeBg)
                        .frame(width: 22, height: 22)
                        .overlay {
                            Icon(
                                row.icon,
                                size: row.emphasized ? 12 : 13,
                                strokeWidth: row.emphasized ? 2.6 : 3,
                                color: row.emphasized ? Theme.Color.warning : Theme.Color.home
                            )
                        }
                        .padding(.top, 1)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(row.title)
                            .pantopusTextStyle(.body)
                            .foregroundStyle(Theme.Color.appText)
                        Text(row.subcopy)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    Spacer(minLength: Spacing.s0)
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("\(row.title). \(row.subcopy)")
            }
        }
        .padding(Spacing.s4)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        }
        .accessibilityIdentifier("requirementsCard")
    }
}

#Preview {
    RequirementsCardBlock(rows: [
        RequirementsRow(
            id: "id",
            icon: .check,
            title: "Government-issued ID",
            subcopy: "Driver's license, state ID, or passport."
        ),
        RequirementsRow(
            id: "doc",
            icon: .check,
            title: "Proof of ownership",
            subcopy: "Deed, tax record, or recent mortgage statement."
        ),
        RequirementsRow(
            id: "time",
            icon: .check,
            title: "A few minutes",
            subcopy: "Most claims take 4–5 min end to end."
        )
    ])
    .padding()
    .background(Theme.Color.appBg)
}
