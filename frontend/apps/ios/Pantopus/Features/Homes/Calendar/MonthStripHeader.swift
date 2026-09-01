//
//  MonthStripHeader.swift
//  Pantopus
//
//  T6.4c — Small "month label + 7-day week strip" calendar component
//  rendered between the top bar and the agenda list on the Home calendar.
//  Mirrors the design's `home-shell.jsx` `MonthStrip` primitive.
//
//  Per the design contract, this component lives in the feature folder
//  (NOT the shared shell) — it's specific to the calendar surface, and
//  the shell's `customHeader` slot (added in T6.4c) hosts it.
//
//  Geometry (home-shell `MonthStrip`):
//    - Container: surface bg + 1px bottom border, padding 8/10/10.
//    - Row 1: bold month label + plain prev/next chevrons (17pt glyphs,
//      muted/secondary tint — no button chrome).
//    - Row 2: 7 day columns in an HStack, each rendering a single-letter
//      weekday initial + a 30×30 date number.
//    - Selected day: 30×30 home-green circle, white number.
//    - Today (not selected): 30×30 transparent circle with a 1.5pt
//      home-green ring. No event-count dots (the home-shell strip drops them).
//

import SwiftUI

/// State payload the host VM hands the strip. One row per day in the
/// current 7-day window plus the month label and the host's
/// `selectedIsoDate` (the date the user has tapped to filter the
/// agenda — `nil` when nothing is selected and the strip should
/// highlight today only).
public struct MonthStripState: Sendable, Equatable {
    /// "October 2025" — already-formatted month + year.
    public let monthLabel: String
    /// 7 entries — one per day in the visible week.
    public let days: [Day]
    /// ISO yyyy-MM-dd of the currently-selected day. `nil` means
    /// "no filter applied".
    public let selectedIsoDate: String?
    /// ISO yyyy-MM-dd of today (anchored to the host's `now`). The
    /// strip pills the matching day even when nothing's selected.
    public let todayIsoDate: String

    public init(
        monthLabel: String,
        days: [Day],
        selectedIsoDate: String?,
        todayIsoDate: String
    ) {
        self.monthLabel = monthLabel
        self.days = days
        self.selectedIsoDate = selectedIsoDate
        self.todayIsoDate = todayIsoDate
    }

    /// One day in the week strip.
    public struct Day: Sendable, Equatable, Identifiable {
        /// ISO yyyy-MM-dd. Used as `id` + comparison key.
        public let id: String
        /// Single-letter weekday initial — "S" / "M" / "T" / …
        public let dayOfWeek: String
        /// 1-based date number rendered below the weekday initial.
        public let date: Int
        /// Number of events scheduled on this day. Retained for the host
        /// VM's projection + tests; the home-shell strip no longer renders
        /// per-day event dots.
        public let eventCount: Int

        public init(id: String, dayOfWeek: String, date: Int, eventCount: Int) {
            self.id = id
            self.dayOfWeek = dayOfWeek
            self.date = date
            self.eventCount = eventCount
        }
    }
}

/// The reusable strip. Pure on its inputs — the caller owns navigation
/// (prev / next month) and selection state.
public struct MonthStripHeader: View {
    let state: MonthStripState
    let onSelectDay: @MainActor (String) -> Void
    let onPrevMonth: @MainActor () -> Void
    let onNextMonth: @MainActor () -> Void

    public init(
        state: MonthStripState,
        onSelectDay: @escaping @MainActor (String) -> Void,
        onPrevMonth: @escaping @MainActor () -> Void,
        onNextMonth: @escaping @MainActor () -> Void
    ) {
        self.state = state
        self.onSelectDay = onSelectDay
        self.onPrevMonth = onPrevMonth
        self.onNextMonth = onNextMonth
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            monthRow
            weekRow
        }
        .padding(.horizontal, 10)
        .padding(.top, Spacing.s2)
        .padding(.bottom, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Theme.Color.appBorder)
                .frame(height: 1)
        }
        .accessibilityIdentifier("homeCalendar_monthStrip")
    }

    private var monthRow: some View {
        HStack(spacing: Spacing.s1) {
            Text(state.monthLabel)
                .font(.system(size: 13, weight: .bold))
                .tracking(-0.2)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityIdentifier("homeCalendar_monthLabel")
            Spacer()
            HStack(spacing: 2) {
                chevronButton(.chevronLeft, label: "Previous month", handler: onPrevMonth)
                    .accessibilityIdentifier("homeCalendar_prevMonth")
                chevronButton(.chevronRight, label: "Next month", handler: onNextMonth)
                    .accessibilityIdentifier("homeCalendar_nextMonth")
            }
        }
        .padding(.horizontal, Spacing.s1)
    }

    private func chevronButton(
        _ icon: PantopusIcon,
        label: String,
        handler: @escaping @MainActor () -> Void
    ) -> some View {
        // Design renders these as plain glyphs (no button chrome): prev tinted
        // `N.fg4` (muted), next `N.fg3` (secondary), 17pt. Kept tappable.
        Button {
            handler()
        } label: {
            Icon(
                icon,
                size: 17,
                color: icon == .chevronLeft
                    ? Theme.Color.appTextMuted
                    : Theme.Color.appTextSecondary
            )
            .frame(width: 26, height: 26)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private var weekRow: some View {
        HStack(spacing: 2) {
            ForEach(state.days) { day in
                dayCell(day)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private func dayCell(_ day: MonthStripState.Day) -> some View {
        let selected = isSelected(day)
        let isToday = day.id == state.todayIsoDate
        return Button {
            onSelectDay(day.id)
        } label: {
            VStack(spacing: 4) {
                Text(day.dayOfWeek)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextMuted)
                Text("\(day.date)")
                    .font(.system(size: 13, weight: selected ? .bold : .semibold))
                    .foregroundStyle(
                        selected ? Theme.Color.appTextInverse : Theme.Color.appText
                    )
                    .frame(width: 30, height: 30)
                    .background(
                        Circle().fill(selected ? Theme.Color.home : Color.clear)
                    )
                    .overlay(
                        Circle()
                            .strokeBorder(
                                isToday && !selected ? Theme.Color.home : Color.clear,
                                lineWidth: 1.5
                            )
                    )
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("homeCalendar_day_\(day.id)")
        .accessibilityLabel("\(day.dayOfWeek) \(day.date)")
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }

    /// The selected-day pill is the user-selected day, or — when nothing is
    /// selected — today (today otherwise renders a green ring, not a fill).
    private func isSelected(_ day: MonthStripState.Day) -> Bool {
        if let selected = state.selectedIsoDate {
            return day.id == selected
        }
        return day.id == state.todayIsoDate
    }
}

#Preview {
    let today = "2025-10-12"
    let week: [MonthStripState.Day] = [
        .init(id: "2025-10-12", dayOfWeek: "S", date: 12, eventCount: 3),
        .init(id: "2025-10-13", dayOfWeek: "M", date: 13, eventCount: 1),
        .init(id: "2025-10-14", dayOfWeek: "T", date: 14, eventCount: 2),
        .init(id: "2025-10-15", dayOfWeek: "W", date: 15, eventCount: 1),
        .init(id: "2025-10-16", dayOfWeek: "T", date: 16, eventCount: 0),
        .init(id: "2025-10-17", dayOfWeek: "F", date: 17, eventCount: 1),
        .init(id: "2025-10-18", dayOfWeek: "S", date: 18, eventCount: 2)
    ]
    MonthStripHeader(
        state: MonthStripState(
            monthLabel: "October 2025",
            days: week,
            selectedIsoDate: nil,
            todayIsoDate: today
        ),
        onSelectDay: { _ in },
        onPrevMonth: {},
        onNextMonth: {}
    )
    .frame(width: 360)
    .background(Theme.Color.appBg)
}
