//
//  PlaceWorthALook.swift
//  Pantopus
//
//  "Worth a look" on Your Place (the November 2026 redesign): only real
//  items, most consequential first — what changed since the last visit,
//  systems beyond their typical range (age isn't condition), household tasks
//  that are overdue, and what the server already marks as worth checking.
//  Nothing is padded or invented; the section hides when it is empty.
//  Parity twin of Android `PlaceWorthALook`.
//

import SwiftUI

struct PlaceAttentionItem: Identifiable {
    let id: String
    let icon: PantopusIcon
    let title: String
    let detail: String
    /// "Nov 1 · NWS Portland OR": when and where a change came from.
    var origin: String?
    let open: @MainActor () -> Void

    init(
        id: String,
        icon: PantopusIcon,
        title: String,
        detail: String,
        origin: String? = nil,
        open: @escaping @MainActor () -> Void
    ) {
        self.id = id
        self.icon = icon
        self.title = title
        self.detail = detail
        self.origin = origin
        self.open = open
    }

    /// Systems beyond (else nearing) their typical service-life range.
    static func systems(_ data: PlaceHomeSystemsData, open: @escaping @MainActor () -> Void) -> PlaceAttentionItem? {
        let past = data.systems.filter { $0.status == "past_expected" }
        let aging = data.systems.filter { $0.status == "aging" }
        let detail = "Age isn't condition. See install years, how each is known and service dates."
        if let first = past.first {
            let title = past.count == 1 ? "\(first.label) is beyond its typical range"
                : "\(past.count) systems beyond their typical range"
            return PlaceAttentionItem(id: "systems", icon: .wrench, title: title, detail: detail, open: open)
        }
        if let first = aging.first {
            let title = aging.count == 1 ? "\(first.label) is nearing its typical range"
                : "\(aging.count) systems nearing their typical range"
            return PlaceAttentionItem(id: "systems", icon: .wrench, title: title, detail: detail, open: open)
        }
        return nil
    }

    enum TaskDue { case overdue, today }

    /// Household tasks this viewer can read, overdue or due today: one opens
    /// itself, several open Tasks ("Overdue: Smoke alarms", "3 overdue household tasks").
    static func tasks(
        _ tasks: [HomeTaskDTO],
        due: TaskDue,
        homeId: String,
        calendar: Calendar,
        openList: @escaping @MainActor () -> Void
    ) -> [PlaceAttentionItem] {
        guard let first = tasks.first else { return [] }
        let id = due == .overdue ? "tasks.overdue" : "tasks.today"
        if tasks.count == 1 {
            let path = "/homes/\(homeId)/tasks/\(first.id)"
            let title = (due == .overdue ? "Overdue: " : "Due today: ") + first.title
            let item = PlaceAttentionItem(id: id, icon: .listChecks, title: title, detail: dueLine(first, due: due, calendar)) {
                DeepLinkRouter.shared.handle(path: path)
            }
            return [item]
        }
        let titles = tasks.prefix(2).map(\.title).joined(separator: ", ")
        let item = PlaceAttentionItem(
            id: id,
            icon: .listChecks,
            title: due == .overdue ? "\(tasks.count) overdue household tasks" : "\(tasks.count) household tasks due today",
            detail: tasks.count > 2 ? "\(titles) and more" : titles,
            open: openList
        )
        return [item]
    }

    /// "Was due Fri, Oct 30 · household task" or "Due 6 PM · household task",
    /// on the home's calendar.
    private static func dueLine(_ task: HomeTaskDTO, due: TaskDue, _ calendar: Calendar) -> String {
        guard let date = PlacePresentation.parseISO(task.dueAt) ?? RadonToday.date(task.dueAt) else { return "Household task" }
        if due == .today { return "Due \(TodayClock.time(date, calendar: calendar)) · household task" }
        let day = date.formatted(Date.FormatStyle(timeZone: calendar.timeZone).weekday(.abbreviated).month(.abbreviated).day())
        return "Was due \(day) · household task"
    }
}

struct PlaceWorthALook: View {
    let items: [PlaceAttentionItem]

    var body: some View {
        PlaceGroupSurface {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                if index > 0 { PlaceRowDivider() }
                Button(action: item.open) {
                    HStack(alignment: .top, spacing: 12) {
                        // A warm mark: worth a look, not an alarm.
                        RoundedRectangle(cornerRadius: 1.5)
                            .fill(Theme.Color.warning)
                            .frame(width: 3)
                            .padding(.vertical, 2)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(item.title)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(Theme.Color.appText)
                                .fixedSize(horizontal: false, vertical: true)
                            Text(item.detail)
                                .font(.system(size: 13))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                            if let origin = item.origin {
                                Text(origin)
                                    .font(Theme.Font.caption)
                                    .foregroundStyle(Theme.Color.appTextMuted)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        PlaceChevron()
                            .padding(.top, 2)
                    }
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.vertical, 12)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isButton)
                .accessibilityIdentifier("place.worthALook.\(item.id)")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("place.worthALook")
    }
}
