//
//  SlotCalendar.swift
//  Pantopus
//
//  4-week support-train slot grid (7 × 4 = 28 cells) used on A10.9
//  Support Train Detail. Each cell is one day in one of five states —
//  past, today, filled, open, mine — rendered as a 40×40pt tile with
//  state-specific bg / fg / border styling. A legend strip pinned below
//  the grid documents the swatch vocabulary; only cells in `.open` /
//  `.mine` are tappable (drives the slot sign-up sheet).
//

import SwiftUI

/// Visual state for a single day cell in `SlotCalendar`.
public enum SlotCalendarState: String, Sendable, Hashable, CaseIterable {
    /// Day is in the past. Date number renders in `appTextMuted`, no
    /// border / fill — the cell is inert and not tappable.
    case past
    /// "Right now" cell. `primary600` fill + white text + a soft halo
    /// shadow so the day reads as the calendar's anchor.
    case today
    /// A neighbor has already signed up for this slot.
    /// `homeBg` fill + `home` text + 1px `home` border.
    case filled
    /// No-one has claimed this slot — dashed `primary300` border on
    /// surface bg + `appText`. Tappable.
    case open
    /// The viewer's own commitment. `primary50` fill + 1.5px
    /// `primary600` border + `primary700` text. Tappable (to edit / drop).
    case mine
}

/// One day in the `SlotCalendar` grid.
public struct SlotCalendarDay: Sendable, Hashable, Identifiable {
    /// Stable identifier — ISO `yyyy-MM-dd` works well. Drives diffing.
    public let id: String
    /// Calendar date this cell represents. Forwarded to `onSelectDate`.
    public let date: Date
    /// Day number rendered in the cell (1…31).
    public let dayNumber: Int
    /// Visual / interaction state.
    public let state: SlotCalendarState

    public init(id: String, date: Date, dayNumber: Int, state: SlotCalendarState) {
        self.id = id
        self.date = date
        self.dayNumber = dayNumber
        self.state = state
    }
}

/// 4-week support-train slot grid + legend strip.
///
/// - Parameters:
///   - days: Exactly 28 cells in row-major order (week 0 Sun … week 3 Sat).
///     The view renders whatever it receives but the visual contract assumes
///     a full 7 × 4 grid.
///   - onSelectDate: Invoked when the user taps an `.open` or `.mine` cell.
///     `.past` / `.today` / `.filled` cells are inert.
@MainActor
public struct SlotCalendar: View {
    private let days: [SlotCalendarDay]
    private let onSelectDate: (Date) -> Void

    /// Weekday header letters — Sun → Sat, per the prompt contract.
    private static let weekdayLetters: [String] = ["S", "M", "T", "W", "T", "F", "S"]

    /// Fixed cell side from the design — 40pt per the prompt.
    private static let cellSide: CGFloat = 40
    /// 4pt gap between cells (matches the spacing-s1 token).
    private static let cellGap: CGFloat = Spacing.s1

    public init(
        days: [SlotCalendarDay],
        onSelectDate: @escaping (Date) -> Void
    ) {
        self.days = days
        self.onSelectDate = onSelectDate
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            weekdayHeader
            grid
            legend
        }
        .accessibilityIdentifier("slotCalendar")
    }

    // MARK: - Header

    private var weekdayHeader: some View {
        HStack(spacing: Self.cellGap) {
            ForEach(0..<7, id: \.self) { col in
                Text(Self.weekdayLetters[col])
                    .font(.system(size: PantopusTextStyle.overline.size, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .frame(width: Self.cellSide)
                    .accessibilityHidden(true)
            }
        }
    }

    // MARK: - Grid

    private var grid: some View {
        VStack(spacing: Self.cellGap) {
            ForEach(0..<4, id: \.self) { row in
                HStack(spacing: Self.cellGap) {
                    ForEach(0..<7, id: \.self) { col in
                        let idx = row * 7 + col
                        if idx < days.count {
                            cell(for: days[idx])
                        } else {
                            Color.clear.frame(width: Self.cellSide, height: Self.cellSide)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func cell(for day: SlotCalendarDay) -> some View {
        let style = CellStyle.of(day.state)
        let tappable = day.state == .open || day.state == .mine
        let cellView = ZStack {
            cellBackground(for: day.state, style: style)
            Text("\(day.dayNumber)")
                .font(.system(size: 13, weight: style.weight))
                .foregroundStyle(style.foreground)
                .monospacedDigit()
        }
        .frame(width: Self.cellSide, height: Self.cellSide)
        .shadow(color: style.shadow, radius: style.shadowRadius, y: style.shadowYOffset)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(day.dayNumber), \(day.state.rawValue)")
        .accessibilityAddTraits(tappable ? .isButton : [])

        if tappable {
            Button { onSelectDate(day.date) } label: { cellView }
                .buttonStyle(.plain)
        } else {
            cellView
        }
    }

    @ViewBuilder
    private func cellBackground(for state: SlotCalendarState, style: CellStyle) -> some View {
        switch state {
        case .open:
            // Dashed primary300 border, surface bg
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .fill(style.background)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .strokeBorder(
                            style.border,
                            style: StrokeStyle(lineWidth: 1, dash: [3, 2])
                        )
                )
        default:
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .fill(style.background)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .strokeBorder(style.border, lineWidth: style.borderWidth)
                )
        }
    }

    // MARK: - Legend

    private var legend: some View {
        HStack(spacing: Spacing.s2) {
            ForEach(SlotCalendarState.allCases, id: \.self) { state in
                LegendChip(state: state)
            }
        }
        .padding(.top, Spacing.s1)
    }
}

// MARK: - Cell styling helpers

private struct CellStyle {
    let background: Color
    let foreground: Color
    let border: Color
    let borderWidth: CGFloat
    let weight: Font.Weight
    let shadow: Color
    let shadowRadius: CGFloat
    let shadowYOffset: CGFloat

    static func of(_ state: SlotCalendarState) -> CellStyle {
        switch state {
        case .past:
            CellStyle(
                background: Theme.Color.appSurface,
                foreground: Theme.Color.appTextMuted,
                border: .clear,
                borderWidth: 0,
                weight: .regular,
                shadow: .clear,
                shadowRadius: 0,
                shadowYOffset: 0
            )
        case .today:
            CellStyle(
                background: Theme.Color.primary600,
                foreground: Theme.Color.appTextInverse,
                border: Theme.Color.primary600,
                borderWidth: 1,
                weight: .bold,
                shadow: Theme.Color.primary600.opacity(0.30),
                shadowRadius: 6,
                shadowYOffset: 2
            )
        case .filled:
            CellStyle(
                background: Theme.Color.homeBg,
                foreground: Theme.Color.home,
                border: Theme.Color.home,
                borderWidth: 1,
                weight: .semibold,
                shadow: .clear,
                shadowRadius: 0,
                shadowYOffset: 0
            )
        case .open:
            CellStyle(
                background: Theme.Color.appSurface,
                foreground: Theme.Color.appText,
                border: Theme.Color.primary300,
                borderWidth: 1,
                weight: .semibold,
                shadow: .clear,
                shadowRadius: 0,
                shadowYOffset: 0
            )
        case .mine:
            CellStyle(
                background: Theme.Color.primary50,
                foreground: Theme.Color.primary700,
                border: Theme.Color.primary600,
                borderWidth: 1.5,
                weight: .bold,
                shadow: .clear,
                shadowRadius: 0,
                shadowYOffset: 0
            )
        }
    }
}

// MARK: - Legend chip

private struct LegendChip: View {
    let state: SlotCalendarState

    var body: some View {
        HStack(spacing: Spacing.s1) {
            swatch
                .frame(width: 10, height: 10)
            Text(label)
                .font(.system(size: PantopusTextStyle.caption.size, weight: .regular))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var swatch: some View {
        let style = CellStyle.of(state)
        switch state {
        case .open:
            RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                .fill(style.background)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                        .strokeBorder(
                            style.border,
                            style: StrokeStyle(lineWidth: 1, dash: [2, 1.5])
                        )
                )
        default:
            RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                .fill(style.background)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                        .strokeBorder(style.border, lineWidth: max(style.borderWidth, 0.5))
                )
        }
    }

    private var label: String {
        switch state {
        case .past: "Past"
        case .today: "Today"
        case .filled: "Covered"
        case .open: "Open"
        case .mine: "Mine"
        }
    }
}

// MARK: - Preview

#Preview("Mixed states") {
    let cal = Calendar.current
    let base = cal.startOfDay(for: Date(timeIntervalSince1970: 1_733_011_200)) // 2024-12-01
    let states: [SlotCalendarState] = [
        .past, .past, .past, .past, .past, .past, .past,
        .past, .today, .filled, .open, .filled, .open, .filled,
        .open, .filled, .open, .mine, .open, .open, .filled,
        .open, .open, .open, .open, .open, .open, .open
    ]
    let days: [SlotCalendarDay] = (0..<28).map { i in
        let date = cal.date(byAdding: .day, value: i, to: base) ?? base
        let comps = cal.dateComponents([.day], from: date)
        return SlotCalendarDay(
            id: "preview-\(i)",
            date: date,
            dayNumber: comps.day ?? 1,
            state: states[i]
        )
    }
    return SlotCalendar(days: days) { _ in }
        .padding(Spacing.s4)
        .background(Theme.Color.appSurface)
}
