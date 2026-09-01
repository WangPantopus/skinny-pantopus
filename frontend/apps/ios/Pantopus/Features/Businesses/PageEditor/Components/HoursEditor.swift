//
//  HoursEditor.swift
//  Pantopus
//
//  P4.2 — A13.10 Edit Business Page. 7-row hours card. Each row carries
//  a day label, a state (open/closed/notSet), and an optional dirty
//  marker (orange dot + amber row tint). Setup variant exposes
//  quick-apply chips beneath the card.
//

import SwiftUI

@MainActor
public struct EditBusinessHoursEditor: View {
    private let state: EditBusinessPageHoursState

    public init(state: EditBusinessPageHoursState) {
        self.state = state
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            card
            footer
        }
        .accessibilityIdentifier("editBusinessPage.hours")
    }

    private var rows: [EditBusinessPageHoursRow] {
        switch state {
        case let .rows(rows, _): rows
        case let .quickApply(rows): rows
        }
    }

    private var card: some View {
        VStack(spacing: Spacing.s0) {
            ForEach(Array(rows.enumerated()), id: \.element.id) { idx, row in
                EditHoursRowView(row: row)
                if idx != rows.count - 1 {
                    Divider()
                        .background(Theme.Color.appBorderSubtle)
                        .padding(.horizontal, Spacing.s3)
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

    @ViewBuilder private var footer: some View {
        switch state {
        case let .rows(_, hint):
            if let hint {
                HStack(spacing: Spacing.s1) {
                    Icon(.info, size: 11, color: Theme.Color.appTextSecondary)
                    Text(hint)
                        .font(.system(size: 11).italic())
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .padding(.top, 2)
            }
        case .quickApply:
            HStack(spacing: Spacing.s2) {
                quickApplyButton(
                    label: "Apply 9–5 weekdays",
                    icon: .calendarClock,
                    tint: .violet
                )
                quickApplyButton(
                    label: "Copy from another biz",
                    icon: .copy,
                    tint: .neutral
                )
            }
        }
    }

    private enum QuickTint { case violet, neutral }

    private func quickApplyButton(label: String, icon: PantopusIcon, tint: QuickTint) -> some View {
        HStack(spacing: 5) {
            Icon(
                icon,
                size: 13,
                color: tint == .violet ? Theme.Color.businessDark : Theme.Color.appTextStrong
            )
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(tint == .violet ? Theme.Color.businessDark : Theme.Color.appTextStrong)
        }
        .frame(maxWidth: .infinity, minHeight: 34)
        .padding(.horizontal, Spacing.s2)
        .background(tint == .violet ? Theme.Color.businessBg : Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(
                    tint == .violet ? Theme.Color.business.opacity(0.25) : Theme.Color.appBorder,
                    lineWidth: 1
                )
        )
    }
}

private struct EditHoursRowView: View {
    let row: EditBusinessPageHoursRow

    var body: some View {
        HStack(spacing: Spacing.s2) {
            HStack(spacing: 4) {
                Text(row.dayLabel)
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(
                        isNotSet ? Theme.Color.appTextSecondary : Theme.Color.appText
                    )
                if row.isDirty {
                    Circle()
                        .fill(Theme.Color.warning)
                        .frame(width: 6, height: 6)
                        .overlay(
                            Circle()
                                .stroke(Theme.Color.warningBg, lineWidth: 2)
                        )
                        .accessibilityHidden(true)
                }
            }
            .frame(width: 50, alignment: .leading)

            stateView
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 11)
        .frame(minHeight: 44)
        .background(row.isDirty ? Theme.Color.warningBg : Color.clear)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(a11yLabel)
    }

    private var isNotSet: Bool {
        if case .notSet = row.state { return true }
        return false
    }

    @ViewBuilder private var stateView: some View {
        switch row.state {
        case let .open(openLabel, closeLabel):
            HStack(spacing: 6) {
                TimePill(value: openLabel)
                Text("—")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextMuted)
                TimePill(value: closeLabel)
                Spacer()
                Icon(.moreHorizontal, size: 14, color: Theme.Color.appTextSecondary)
                    .padding(4)
            }
        case .closed:
            HStack {
                Text("Closed")
                    .font(.system(size: 12).italic())
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer()
                Text("Set hours")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.business)
            }
        case .notSet:
            HStack {
                Text("Not set")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextMuted)
                Spacer()
                Text("Add")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Color.businessDark)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Theme.Color.businessBg)
                    .clipShape(Capsule())
                    .overlay(
                        Capsule().stroke(Theme.Color.business.opacity(0.25), lineWidth: 1)
                    )
            }
        }
    }

    private var a11yLabel: String {
        let stateLabel = switch row.state {
        case let .open(open, close): "\(open) to \(close)"
        case .closed: "Closed"
        case .notSet: "Not set"
        }
        let dirtyTag = row.isDirty ? ", unsaved" : ""
        return "\(row.dayLabel), \(stateLabel)\(dirtyTag)"
    }
}

private struct TimePill: View {
    let value: String

    var body: some View {
        Text(value)
            .font(.system(size: 11.5, weight: .semibold, design: .monospaced))
            .foregroundStyle(Theme.Color.appText)
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
    }
}

#Preview("Populated") {
    EditBusinessHoursEditor(state: .rows(
        rows: [
            .init(id: "mon", dayLabel: "Mon", state: .open(openLabel: "7:00 AM", closeLabel: "3:00 PM"), isDirty: true),
            .init(id: "tue", dayLabel: "Tue", state: .open(openLabel: "7:00 AM", closeLabel: "5:00 PM")),
            .init(id: "wed", dayLabel: "Wed", state: .open(openLabel: "7:00 AM", closeLabel: "5:00 PM")),
            .init(id: "thu", dayLabel: "Thu", state: .open(openLabel: "7:00 AM", closeLabel: "5:00 PM")),
            .init(id: "fri", dayLabel: "Fri", state: .open(openLabel: "7:00 AM", closeLabel: "9:00 PM")),
            .init(id: "sat", dayLabel: "Sat", state: .open(openLabel: "8:00 AM", closeLabel: "9:00 PM")),
            .init(id: "sun", dayLabel: "Sun", state: .open(openLabel: "8:00 AM", closeLabel: "2:00 PM"))
        ],
        footerHint: "Holiday hours can be added per date — neighbors see a banner."
    ))
    .padding()
    .background(Theme.Color.appBg)
}

#Preview("Setup") {
    EditBusinessHoursEditor(state: .quickApply(
        rows: (1...7).map { day in
            .init(
                id: "d\(day)",
                dayLabel: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day - 1],
                state: .notSet
            )
        }
    ))
    .padding()
    .background(Theme.Color.appBg)
}
