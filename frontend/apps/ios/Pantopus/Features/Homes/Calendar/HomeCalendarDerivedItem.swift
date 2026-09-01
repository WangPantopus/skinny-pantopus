//
//  HomeCalendarDerivedItem.swift
//  Pantopus
//
//  Task due-dates, bill due-dates and package expected-delivery dates
//  plotted on the Home calendar alongside the home's own events.
//
//  RN's month grid does exactly this
//  (`src/app/homes/[id]/calendar.tsx:48-74`): it fans out to
//  `getHomeTasks` / `getHomeBills` / `getHomePackages`, keeps only the
//  rows that carry a date, and colour-codes each by type. Without it a
//  household sees an empty-looking month even when three bills are due
//  that week.
//
//  Parity contract — mirrored in Android
//  `ui/screens/homes/calendar/HomeCalendarDerivedItem.kt`.
//

import Foundation
import SwiftUI

/// Which feed a derived calendar row came from. The tone matches the
/// Home dashboard's own per-feature accents (tasks = warning,
/// bills = error, deliveries = business) so the colour-coding reads the
/// same across the pillar.
public enum HomeCalendarDerivedKind: String, Sendable, Hashable, CaseIterable {
    case task
    case bill
    case package

    /// Chip / section label.
    public var label: String {
        switch self {
        case .task: "Task"
        case .bill: "Bill"
        case .package: "Delivery"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .task: .listChecks
        case .bill: .receipt
        case .package: .package
        }
    }

    public var background: Color {
        switch self {
        case .task: Theme.Color.warningBg
        case .bill: Theme.Color.errorBg
        case .package: Theme.Color.businessBg
        }
    }

    public var foreground: Color {
        switch self {
        case .task: Theme.Color.warning
        case .bill: Theme.Color.error
        case .package: Theme.Color.business
        }
    }
}

/// One derived, dated row for the Home calendar.
public struct HomeCalendarDerivedItem: Sendable, Hashable, Identifiable {
    public let id: String
    public let kind: HomeCalendarDerivedKind
    public let title: String
    /// Short status / amount line rendered under the title.
    public let detail: String?
    /// The date this item lands on — `due_at` (task), `due_date` (bill)
    /// or `expected_at` / `delivered_at` (package).
    public let dateISO: String

    public init(
        id: String,
        kind: HomeCalendarDerivedKind,
        title: String,
        detail: String?,
        dateISO: String
    ) {
        self.id = id
        self.kind = kind
        self.title = title
        self.detail = detail
        self.dateISO = dateISO
    }

    /// Fan-in from the three feeds. Rows without a date are dropped —
    /// they have nothing to plot. Mirrors RN's `if (t.due_date)` /
    /// `if (b.due_date)` / `const d = p.expected_date || p.delivered_at`
    /// guards.
    public static func build(
        tasks: [HomeTaskDTO],
        bills: [BillDTO],
        packages: [PackageDTO]
    ) -> [HomeCalendarDerivedItem] {
        var out: [HomeCalendarDerivedItem] = []

        for task in tasks {
            guard let due = task.dueAt, !due.isEmpty else { continue }
            out.append(
                HomeCalendarDerivedItem(
                    id: "task-\(task.id)",
                    kind: .task,
                    title: task.title,
                    detail: statusDetail(task.status),
                    dateISO: due
                )
            )
        }

        for bill in bills {
            guard let due = bill.dueDate, !due.isEmpty else { continue }
            let name = HomeDashboardProjection.billLabel(bill)
            out.append(
                HomeCalendarDerivedItem(
                    id: "bill-\(bill.id)",
                    kind: .bill,
                    title: "\(name) bill due",
                    detail: HomeDashboardProjection.currency(
                        bill.displayAmount,
                        code: bill.currency
                    ),
                    dateISO: due
                )
            )
        }

        for parcel in packages {
            let date = [parcel.expectedAt, parcel.deliveredAt]
                .compactMap { $0 }
                .first { !$0.isEmpty }
            guard let date else { continue }
            let name = [parcel.description, parcel.vendorName, parcel.carrier]
                .compactMap { $0 }
                .first { !$0.isEmpty } ?? "Package"
            out.append(
                HomeCalendarDerivedItem(
                    id: "package-\(parcel.id)",
                    kind: .package,
                    title: name,
                    detail: statusDetail(parcel.status),
                    dateISO: date
                )
            )
        }

        return out
    }

    /// `in_progress` → "In progress". Nil for empty statuses so the row
    /// falls back to its type label.
    static func statusDetail(_ raw: String?) -> String? {
        guard let raw, !raw.isEmpty else { return nil }
        let spaced = raw.replacingOccurrences(of: "_", with: " ")
        guard let first = spaced.first else { return nil }
        return first.uppercased() + spaced.dropFirst()
    }

    /// Row projection for the agenda list. Read-only — these rows are a
    /// mirror of surfaces that own their own screens, so tapping is a
    /// no-op exactly as in RN's calendar.
    /// `@MainActor` because the date helpers it borrows from
    /// `HomeCalendarViewModel` are main-actor isolated; the only caller is the
    /// view model itself, which is already on the main actor.
    @MainActor
    public func row(calendar: Calendar) -> RowModel {
        let timeLabel = HomeCalendarViewModel.parseIsoInstant(dateISO).map {
            HomeCalendarViewModel.formatTime(start: $0, endIso: nil, calendar: calendar)
        }
        return RowModel(
            id: id,
            title: title,
            subtitle: detail ?? kind.label,
            template: .statusChip,
            leading: .typeIcon(
                kind.icon,
                background: kind.background,
                foreground: kind.foreground
            ),
            trailing: .none,
            chips: [
                RowChip(
                    text: kind.label,
                    icon: kind.icon,
                    tint: .custom(
                        background: kind.background,
                        foreground: kind.foreground
                    )
                )
            ],
            timeMeta: timeLabel
        )
    }
}
