//
//  TodayAgendaList.swift
//  Pantopus
//
//  The rows of "Coming up at home" (`TodayAgenda.swift` builds them): a
//  date block, the title, the day and time, whose date it is, and in place
//  the original details, source and actions. The soonest five show; the rest
//  are one tap away. Parity twin of Android `TodayAgendaList.kt`.
//

import SwiftUI

// MARK: - The list

struct TodayAgendaList: View {
    let items: [TodayAgendaItem]
    let next: TodayAgendaItem?
    let onAction: (TodayAgendaItem.Action) -> Void
    let onShowCalendar: () -> Void
    @State private var open: Set<String> = []
    @State private var showsAll = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// The soonest five; a long week stays one tap away rather than a wall.
    private static let firstRows = 5

    private var shown: [TodayAgendaItem] {
        showsAll ? items : Array(items.prefix(Self.firstRows))
    }

    var body: some View {
        PlaceGroupSurface {
            if items.isEmpty {
                VStack(alignment: .leading, spacing: 0) {
                    Text("Nothing on the calendar this week")
                        .font(.system(size: 14.5, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .padding(.vertical, 14)
                    if let next {
                        PlaceRowDivider()
                        Text("Next")
                            .font(.system(size: 11, weight: .bold))
                            .kerning(0.6)
                            .textCase(.uppercase)
                            .foregroundStyle(Theme.Color.appTextMuted)
                            .padding(.top, 12)
                        row(next)
                    }
                    PlaceRowDivider()
                    PlaceInlineAction(title: "See full calendar", identifier: "today.agenda.fullCalendar", action: onShowCalendar)
                }
            } else {
                ForEach(Array(shown.enumerated()), id: \.element.id) { index, item in
                    if index > 0 { PlaceRowDivider() }
                    row(item)
                }
                if items.count > Self.firstRows {
                    PlaceRowDivider()
                    PlaceInlineAction(
                        title: showsAll ? "Show fewer" : "Show all \(items.count)",
                        identifier: "today.agenda.showAll"
                    ) {
                        withAnimation(reduceMotion ? nil : .snappy(duration: 0.25)) { showsAll.toggle() }
                    }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("today.agenda")
    }

    private func row(_ item: TodayAgendaItem) -> some View {
        let isOpen = open.contains(item.id)
        return VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(reduceMotion ? nil : .snappy(duration: 0.25)) {
                    if isOpen { open.remove(item.id) } else { open.insert(item.id) }
                }
            } label: {
                HStack(alignment: .center, spacing: 12) {
                    TodayDateBlock(day: item.day)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.title)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(item.subtitle)
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                        TodayOwnerLabel(owner: item.owner)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Icon(.chevronDown, size: 16, strokeWidth: 2.25, color: Theme.Color.appTextMuted)
                        .rotationEffect(.degrees(isOpen ? 180 : 0))
                        .accessibilityHidden(true)
                }
                .padding(.vertical, 12)
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityValue(isOpen ? "Expanded" : "Collapsed")
            .accessibilityHint(isOpen ? "Folds the details." : "Shows the details, source and actions.")
            .accessibilityIdentifier("today.agenda.row")
            if isOpen { details(item) }
        }
    }

    private func details(_ item: TodayAgendaItem) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(item.details, id: \.self) { line in
                Text(line)
                    .font(.system(size: 13.5))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let source = item.source {
                Text(source)
                    .font(Theme.Font.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            ForEach(Array(item.actions.enumerated()), id: \.offset) { _, action in
                PlaceInlineAction(title: Self.title(action), identifier: "today.agenda.action") { onAction(action) }
            }
        }
        .padding(.leading, 58)
        .padding(.bottom, 12)
    }

    static func title(_ action: TodayAgendaItem.Action) -> String {
        switch action {
        case .editPickup: "Pickup schedule"
        case let .link(title, _): title
        case .governments: "See the governments on your ballot"
        case .openBallot: "Open your ballot"
        case .openTask: "Open task"
        case .openPlan: "Open plan"
        }
    }
}

/// "NOV" over "3": the agenda's date, on the home's calendar.
struct TodayDateBlock: View {
    let day: String

    var body: some View {
        let date = PlacePresentation.parseCalendarDay(day)
        let utc = TimeZone(identifier: "UTC") ?? .current
        VStack(spacing: 0) {
            Text(date?.formatted(Date.FormatStyle(timeZone: utc).month(.abbreviated)) ?? "")
                .font(.system(size: 11, weight: .semibold))
                .textCase(.uppercase)
                .foregroundStyle(Theme.Color.appTextMuted)
            Text(date?.formatted(Date.FormatStyle(timeZone: utc).day()) ?? "")
                .font(.system(size: 19, weight: .medium))
                .monospacedDigit()
                .foregroundStyle(Theme.Color.appText)
        }
        .frame(width: 46)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(date?.formatted(Date.FormatStyle(timeZone: utc).month(.wide).day()) ?? day)
    }
}

/// "For this address", "Your household" or "Your plan": whose date it is.
struct TodayOwnerLabel: View {
    let owner: TodayAgendaItem.Owner

    var body: some View {
        HStack(spacing: 4) {
            Icon(icon, size: 11, strokeWidth: 2.25, color: Theme.Color.appTextMuted)
            Text(owner.rawValue)
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .padding(.top, 2)
    }

    private var icon: PantopusIcon {
        switch owner {
        case .address: .mapPin
        case .household: .house
        case .plan, .going: .users
        }
    }
}
