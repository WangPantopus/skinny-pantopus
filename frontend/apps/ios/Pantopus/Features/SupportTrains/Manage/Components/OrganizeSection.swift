//
//  OrganizeSection.swift
//  Pantopus
//
//  A13.13 — Manage train. The two grouped-row cards under the
//  Send-an-update form:
//
//    • Organize — three rows (Edit dates & slots / Invite more helpers /
//      Analytics) inside a single rounded card with hairline dividers.
//    • Wind down — one destructive `Close train` row in its own card,
//      label painted in `Theme.Color.error`.
//
//  Both surfaces share the `ManageControlRow` atom so spacing + icon
//  geometry stays in lock-step.
//

import SwiftUI

/// One row inside an Organize / Wind-down card.
@MainActor
public struct ManageControlRow: View {
    private let content: OrganizeRowContent
    private let isLast: Bool
    private let action: @MainActor () -> Void

    public init(
        content: OrganizeRowContent,
        isLast: Bool,
        action: @escaping @MainActor () -> Void
    ) {
        self.content = content
        self.isLast = isLast
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            VStack(spacing: Spacing.s0) {
                HStack(spacing: Spacing.s3) {
                    iconTile
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: Spacing.s1) {
                            Text(content.label)
                                .font(.system(size: 13.5, weight: .semibold))
                                .foregroundStyle(labelColor)
                            if let meta = content.meta {
                                metaPill(meta)
                            }
                        }
                        if let sub = content.sub {
                            Text(sub)
                                .font(.system(size: 11))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                                .lineLimit(2)
                                .multilineTextAlignment(.leading)
                        }
                    }
                    Spacer(minLength: Spacing.s1)
                    Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s3)
                if !isLast {
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(height: 1)
                        .padding(.leading, Spacing.s3 + 32 + Spacing.s3)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("manageTrainControlRow.\(content.id)")
    }

    private var iconTile: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .fill(tileBackground)
            Icon(content.icon, size: 16, color: tileForeground)
        }
        .frame(width: 32, height: 32)
    }

    private func metaPill(_ value: String) -> some View {
        Text(value)
            .font(.system(size: 10.5, weight: .semibold))
            .monospacedDigit()
            .foregroundStyle(Theme.Color.appTextStrong)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 1)
            .background(
                Capsule(style: .continuous)
                    .fill(Theme.Color.appSurfaceSunken)
            )
    }

    // MARK: - Tone palette

    private var labelColor: Color {
        content.isDestructive ? Theme.Color.error : Theme.Color.appText
    }

    private var tileBackground: Color {
        switch content.tone {
        case .amber: Theme.Color.warmAmberBg
        case .sky: Theme.Color.primary50
        case .green: Theme.Color.successBg
        case .red: Theme.Color.errorBg
        }
    }

    private var tileForeground: Color {
        switch content.tone {
        case .amber: Theme.Color.warmAmber
        case .sky: Theme.Color.primary600
        case .green: Theme.Color.success
        case .red: Theme.Color.error
        }
    }
}

/// Three-row Organize card.
@MainActor
public struct OrganizeSection: View {
    private let rows: [OrganizeRowContent]
    private let onTapRow: @MainActor (OrganizeRowContent) -> Void

    public init(
        rows: [OrganizeRowContent],
        onTapRow: @escaping @MainActor (OrganizeRowContent) -> Void
    ) {
        self.rows = rows
        self.onTapRow = onTapRow
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                ManageControlRow(
                    content: row,
                    isLast: index == rows.count - 1
                ) {
                    onTapRow(row)
                }
            }
        }
        .background(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .fill(Theme.Color.appSurface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("manageTrainOrganizeSection")
    }
}

/// Single-row Wind-down card with the destructive `Close train` row.
@MainActor
public struct WindDownSection: View {
    private let row: OrganizeRowContent
    private let onTap: @MainActor () -> Void

    public init(row: OrganizeRowContent, onTap: @escaping @MainActor () -> Void) {
        self.row = row
        self.onTap = onTap
    }

    public var body: some View {
        ManageControlRow(content: row, isLast: true, action: onTap)
            .background(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .fill(Theme.Color.appSurface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .accessibilityIdentifier("manageTrainWindDownSection")
    }
}

#Preview("Organize") {
    OrganizeSection(
        rows: [
            OrganizeRowContent(
                id: "edit-dates",
                icon: .calendarCog,
                tone: .amber,
                label: "Edit dates & slots",
                meta: "21",
                sub: "Add, swap, or remove cooking days.",
                isDestructive: false
            ),
            OrganizeRowContent(
                id: "invite",
                icon: .userPlus,
                tone: .sky,
                label: "Invite more helpers",
                meta: nil,
                sub: "Share a link or pick from neighbors.",
                isDestructive: false
            ),
            OrganizeRowContent(
                id: "analytics",
                icon: .barChart3,
                tone: .green,
                label: "Analytics",
                meta: nil,
                sub: "Fill rate, response time, top contributors.",
                isDestructive: false
            )
        ]
    ) { _ in }
        .padding()
        .background(Theme.Color.appBg)
}

#Preview("WindDown") {
    WindDownSection(
        row: OrganizeRowContent(
            id: "close",
            icon: .archive,
            tone: .red,
            label: "Close train",
            meta: nil,
            sub: "Lock new signups and send a thank-you to everyone.",
            isDestructive: true
        )
    ) {}
        .padding()
        .background(Theme.Color.appBg)
}
