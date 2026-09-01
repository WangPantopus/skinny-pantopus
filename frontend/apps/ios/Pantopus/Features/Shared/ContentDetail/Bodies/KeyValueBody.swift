//
//  KeyValueBody.swift
//  Pantopus
//
//  `key_value` body slot for the Content Detail shell — sectioned label /
//  value rows in a surface card. Replaces the former `KeyValueBodyStub`
//  NotYetAvailable placeholder. Mirrors the A10.8 Membership tier rows
//  (icon tile → stacked label / value → optional disclosure) and the
//  transactional shell's `detailsGrid` module.
//

import SwiftUI

/// One label / value row. An optional leading `icon` renders a tinted tile;
/// `showsDisclosure` adds a trailing chevron for tappable rows.
public struct KeyValueRow: Sendable, Hashable, Identifiable {
    public let id: String
    public let icon: PantopusIcon?
    public let label: String
    public let value: String
    public let caption: String?
    public let showsDisclosure: Bool

    public init(
        id: String,
        icon: PantopusIcon? = nil,
        label: String,
        value: String,
        caption: String? = nil,
        showsDisclosure: Bool = false
    ) {
        self.id = id
        self.icon = icon
        self.label = label
        self.value = value
        self.caption = caption
        self.showsDisclosure = showsDisclosure
    }
}

/// A group of rows under an optional overline title.
public struct KeyValueSection: Sendable, Hashable, Identifiable {
    public let id: String
    public let title: String?
    public let rows: [KeyValueRow]

    public init(id: String, title: String? = nil, rows: [KeyValueRow]) {
        self.id = id
        self.title = title
        self.rows = rows
    }
}

/// Key / value body. Each section is an overline title above a hairline-
/// divided surface card of rows.
@MainActor
public struct KeyValueBody: View {
    private let sections: [KeyValueSection]

    public init(sections: [KeyValueSection]) {
        self.sections = sections
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            ForEach(sections) { section in
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    if let title = section.title {
                        Text(title.uppercased())
                            .pantopusTextStyle(.overline)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    sectionCard(section.rows)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.s4)
        .accessibilityIdentifier("contentDetail.keyValueBody")
        .accessibilityElement(children: .contain)
    }

    private func sectionCard(_ rows: [KeyValueRow]) -> some View {
        VStack(spacing: Spacing.s0) {
            ForEach(rows) { row in
                rowView(row)
                if row.id != rows.last?.id {
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(height: 1)
                        .padding(.leading, row.icon == nil ? Spacing.s3 : Spacing.s10)
                }
            }
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }

    private func rowView(_ row: KeyValueRow) -> some View {
        HStack(spacing: Spacing.s3) {
            if let icon = row.icon {
                iconTile(icon)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(row.label)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text(row.value)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                if let caption = row.caption {
                    Text(caption)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            Spacer(minLength: Spacing.s2)
            if row.showsDisclosure {
                Icon(.chevronRight, size: 14, color: Theme.Color.appTextMuted)
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(row.label), \(row.value)")
    }

    private func iconTile(_ icon: PantopusIcon) -> some View {
        Icon(icon, size: 15, color: Theme.Color.primary600)
            .frame(width: 30, height: 30)
            .background(Theme.Color.primary50)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }
}

#Preview("Key / value") {
    ScrollView {
        KeyValueBody(
            sections: [
                KeyValueSection(
                    id: "plan",
                    title: "Your membership",
                    rows: [
                        KeyValueRow(
                            id: "renewal",
                            icon: .calendarClock,
                            label: "Next renewal",
                            value: "Dec 12, 2026",
                            caption: "in 22 days"
                        ),
                        KeyValueRow(
                            id: "payment",
                            icon: .creditCard,
                            label: "Payment",
                            value: "Visa •••• 4242",
                            showsDisclosure: true
                        )
                    ]
                ),
                KeyValueSection(
                    id: "facts",
                    title: "Details",
                    rows: [
                        KeyValueRow(id: "tier", label: "Tier", value: "Silver · 2 of 3"),
                        KeyValueRow(id: "since", label: "Member since", value: "March 2025")
                    ]
                )
            ]
        )
        .padding(.vertical, Spacing.s4)
    }
    .background(Theme.Color.appBg)
}
