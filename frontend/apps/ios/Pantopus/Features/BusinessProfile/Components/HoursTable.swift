//
//  HoursTable.swift
//  Pantopus
//
//  A10.6 — the Hours card: an open/closed status header (success- or
//  warning-tinted clock tile + "Open now" / "Closes 6:00 PM") over the
//  week's day rows, with today's row emphasized.
//
//  Design reference: `docs/designs/A10/business-frames.jsx` (Hours).
//

import SwiftUI

@MainActor
struct HoursTable: View {
    let status: BusinessOpenState
    let rows: [BusinessHoursRow]

    var body: some View {
        VStack(spacing: Spacing.s0) {
            statusHeader
            dayRows
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("businessProfile.hours")
    }

    private var statusHeader: some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(status.isOpen ? Theme.Color.successBg : Theme.Color.warningBg)
                    .frame(width: 30, height: 30)
                Icon(.clock, size: 15, strokeWidth: 2, color: status.isOpen ? Theme.Color.success : Theme.Color.warning)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(status.statusLabel)
                    .font(.system(size: 13, weight: .bold))
                    .tracking(-0.1)
                    .foregroundStyle(status.isOpen ? Theme.Color.success : Theme.Color.warning)
                Text(status.statusDetail)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s0)
            Icon(.chevronDown, size: 16, color: Theme.Color.appTextMuted)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(status.statusLabel), \(status.statusDetail)")
    }

    private var dayRows: some View {
        VStack(spacing: Spacing.s0) {
            ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                HStack {
                    Text(row.isToday ? "\(row.dayLabel)  ·  Today" : row.dayLabel)
                        .font(.system(size: 12.5, weight: row.isToday ? .bold : .medium))
                        .foregroundStyle(row.isToday ? Theme.Color.appText : Theme.Color.appTextStrong)
                    Spacer()
                    Text(row.timeLabel)
                        .font(.system(size: 12.5, weight: row.isToday ? .bold : .medium))
                        .foregroundStyle(timeColor(row))
                }
                .padding(.vertical, 6)
                if index != rows.count - 1 {
                    Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.top, 4)
        .padding(.bottom, 6)
    }

    private func timeColor(_ row: BusinessHoursRow) -> Color {
        if row.isClosed {
            return Theme.Color.appTextMuted
        }
        return row.isToday ? Theme.Color.appText : Theme.Color.appTextStrong
    }
}

#Preview("HoursTable") {
    HoursTable(
        status: BusinessOpenState(
            isOpen: true,
            statusLabel: "Open now",
            statusDetail: "Closes 6:00 PM",
            chipLabel: "Open now"
        ),
        rows: [
            BusinessHoursRow(id: "mon", dayLabel: "Monday", timeLabel: "8:00 AM – 6:00 PM", isClosed: false, isToday: true),
            BusinessHoursRow(id: "tue", dayLabel: "Tuesday", timeLabel: "8:00 AM – 6:00 PM", isClosed: false),
            BusinessHoursRow(id: "sun", dayLabel: "Sunday", timeLabel: "Closed", isClosed: true)
        ]
    )
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
