//
//  HomeNotificationsViewModel.swift
//  Pantopus
//
//  A14.1 — Per-home notification toggles. Local-only until a prefs API
//  ships (mirrors RN settings + Android `HomeNotificationsViewModel`).
//

import Foundation
import Observation

@Observable
@MainActor
public final class HomeNotificationsViewModel: GroupedListDataSource {
    public let homeId: String

    /// No backend route stores per-home notification preferences (see
    /// `backend/routes/notifications.js` — only device/push registration and
    /// read-state). The toggles are session-local, so the footer says so
    /// instead of implying the choice was saved. Byte-identical to Android.
    public static let unavailableCaption =
        "Per-home notification routing isn't live yet — these switches don't change what you receive."

    public var title: String {
        "Home notifications"
    }

    public var footerCaption: String? {
        Self.unavailableCaption
    }

    public private(set) var state: GroupedListState = .loading

    private var toggles: [String: Bool] = [
        "taskReminders": true,
        "billDue": true,
        "packages": true,
        "maintenance": true,
        "polls": true
    ]

    public init(homeId: String) {
        self.homeId = homeId
    }

    public func load() async {
        state = .loaded(groups())
    }

    public func tapRow(_: String) async {}
    public func selectRadio(_: String) async {}
    public func setSlider(_: String, index _: Int) async {}

    public func toggleRow(_ rowId: String, isOn: Bool) async {
        toggles[rowId] = isOn
        state = .loaded(groups())
    }

    private func groups() -> [GroupedListGroup] {
        [
            GroupedListGroup(
                id: "prefs",
                rows: [
                    toggleRow(id: "taskReminders", label: "Task reminders"),
                    toggleRow(id: "billDue", label: "Bill due dates"),
                    toggleRow(id: "packages", label: "Package arrivals"),
                    toggleRow(id: "maintenance", label: "Maintenance alerts"),
                    toggleRow(id: "polls", label: "New polls")
                ]
            )
        ]
    }

    private func toggleRow(id: String, label: String) -> GroupedListRow {
        GroupedListRow(
            id: id,
            label: label,
            control: .toggle(isOn: toggles[id] ?? false)
        )
    }
}
