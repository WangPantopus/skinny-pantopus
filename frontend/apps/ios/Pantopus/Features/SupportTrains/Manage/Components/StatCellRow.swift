//
//  StatCellRow.swift
//  Pantopus
//
//  A13.13 — Manage train. 4-cell at-a-glance card: Slots (success tone) ·
//  Helpers (neutral) · Days left (neutral) · Dropouts (warn tone, only
//  when > 0). Each cell shows a 19pt value + an 10pt uppercase label.
//

import SwiftUI

/// Visual tone for a single stat cell — drives the value's color.
public enum StatCellTone: Sendable, Hashable {
    case neutral
    case success
    case warn
}

/// One cell in `StatCellRow`. Public so tests + previews can build one.
public struct StatCellContent: Sendable, Hashable, Identifiable {
    public let id: String
    public let value: String
    public let label: String
    public let tone: StatCellTone

    public init(id: String, value: String, label: String, tone: StatCellTone) {
        self.id = id
        self.value = value
        self.label = label
        self.tone = tone
    }
}

/// 4-cell at-a-glance stat row used on the Manage Train screen.
@MainActor
public struct StatCellRow: View {
    private let cells: [StatCellContent]

    public init(cells: [StatCellContent]) {
        self.cells = cells
    }

    public var body: some View {
        HStack(spacing: Spacing.s0) {
            ForEach(Array(cells.enumerated()), id: \.element.id) { index, cell in
                cellView(cell)
                if index < cells.count - 1 {
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(width: 1)
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
        .accessibilityIdentifier("manageTrainStatCellRow")
    }

    private func cellView(_ cell: StatCellContent) -> some View {
        VStack(spacing: 3) {
            Text(cell.value)
                .font(.system(size: 19, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(valueColor(for: cell.tone))
                .accessibilityIdentifier("manageTrainStatCellValue.\(cell.id)")
            Text(cell.label.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.66)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s3)
        .padding(.horizontal, Spacing.s1)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(cell.label) \(cell.value)")
    }

    private func valueColor(for tone: StatCellTone) -> Color {
        switch tone {
        case .success: Theme.Color.success
        case .warn: Theme.Color.warmAmber
        case .neutral: Theme.Color.appText
        }
    }
}

#Preview {
    StatCellRow(cells: [
        StatCellContent(id: "slots", value: "18/21", label: "Slots", tone: .success),
        StatCellContent(id: "helpers", value: "12", label: "Helpers", tone: .neutral),
        StatCellContent(id: "left", value: "9d", label: "Left", tone: .neutral),
        StatCellContent(id: "drop", value: "1", label: "Dropout", tone: .warn)
    ])
    .padding()
    .background(Theme.Color.appBg)
}
