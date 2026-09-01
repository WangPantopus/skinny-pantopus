//
//  NotificationSettingsViewModel.swift
//  Pantopus
//
//  A14.5 — Notification & briefing preferences, backed by
//  `GET/PUT /api/hub/preferences` (`backend/routes/hub.js:648` / `:716`).
//
//  Four cards, projected onto the shared GroupedList archetype and
//  mirrored row-for-row in the Android `NotificationSettingsViewModel`:
//    Briefings        — morning + evening enable toggles, each revealing
//                       a send-time chip strip when on.
//    Alert preferences— weather / AQI / home reminders / gig updates /
//                       mail summary switches.
//    Quiet hours      — one toggle (start-time presence is the server's
//                       on/off signal) plus From / Until chip strips.
//    Briefing location— radio over `primary_home | viewing_location |
//                       device_location`.
//
//  Mutations are optimistic and debounce-saved on a 600 ms timer, so a
//  burst of taps collapses into one PUT carrying the merged patch (RN
//  debounces the same window at `notification-preferences.tsx:62-75`
//  but drops all but the last key — we merge instead). A failed PUT
//  toasts and re-fetches, which rolls the row back to server truth.
//
//  Times go over the wire as `HH:mm` strings: Joi rejects anything else
//  (`hub.js:699-709`), so never format them for display locale.
//

// swiftlint:disable type_body_length

import Foundation
import Observation

@Observable
@MainActor
public final class NotificationSettingsViewModel: GroupedListDataSource {
    public var title: String {
        "Notifications"
    }

    /// Which zone the server interprets the briefing times in. Pinned
    /// under the last card so `07:30` is never ambiguous.
    public var footerCaption: String? {
        guard let zone = preferences?.dailyBriefingTimezone, !zone.isEmpty else { return nil }
        return "Briefing times use \(zone)"
    }

    public private(set) var state: GroupedListState = .loading

    /// Transient save / load feedback, mirroring RN's toasts
    /// (`notification-preferences.tsx:48`, `:69`, `:71`). The view
    /// renders it and clears it after the auto-dismiss delay.
    public var toast: ToastMessage?

    /// Server truth, mutated optimistically ahead of the debounced PUT.
    public private(set) var preferences: NotificationPreferencesDTO?

    private let api: APIClient
    private let saveDebounce: Duration
    /// Wire-name keys accumulated since the last flush. Merged rather
    /// than replaced so a burst of taps on different rows all persist.
    private var pendingPatch: [String: JSONValue] = [:]
    private var saveTask: Task<Void, Never>?

    init(api: APIClient = .shared, saveDebounce: Duration = .milliseconds(600)) {
        self.api = api
        self.saveDebounce = saveDebounce
    }

    // MARK: - GroupedListDataSource

    public func load() async {
        if preferences == nil { state = .loading }
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    public func tapRow(_: String) async {}
    public func setSlider(_: String, index _: Int) async {}

    public func toggleRow(_ rowId: String, isOn: Bool) async {
        guard preferences != nil else { return }
        switch rowId {
        case RowID.morningBriefing:
            preferences?.dailyBriefingEnabled = isOn
            enqueue(["daily_briefing_enabled": .bool(isOn)])
        case RowID.eveningBriefing:
            preferences?.eveningBriefingEnabled = isOn
            enqueue(["evening_briefing_enabled": .bool(isOn)])
        case RowID.weatherAlerts:
            preferences?.weatherAlertsEnabled = isOn
            enqueue(["weather_alerts_enabled": .bool(isOn)])
        case RowID.aqiAlerts:
            preferences?.aqiAlertsEnabled = isOn
            enqueue(["aqi_alerts_enabled": .bool(isOn)])
        case RowID.homeReminders:
            preferences?.homeRemindersEnabled = isOn
            enqueue(["home_reminders_enabled": .bool(isOn)])
        case RowID.gigUpdates:
            preferences?.gigUpdatesEnabled = isOn
            enqueue(["gig_updates_enabled": .bool(isOn)])
        case RowID.mailSummary:
            preferences?.mailSummaryEnabled = isOn
            enqueue(["mail_summary_enabled": .bool(isOn)])
        case RowID.quietHours:
            setQuietHours(enabled: isOn)
        default:
            break
        }
    }

    public func selectChip(_ rowId: String, value: String) async {
        guard preferences != nil else { return }
        switch rowId {
        case RowID.morningTime:
            preferences?.dailyBriefingTimeLocal = value
            enqueue(["daily_briefing_time_local": .string(value)])
        case RowID.eveningTime:
            preferences?.eveningBriefingTimeLocal = value
            enqueue(["evening_briefing_time_local": .string(value)])
        case RowID.quietHoursStart:
            preferences?.quietHoursStartLocal = value
            enqueue(["quiet_hours_start_local": .string(value)])
        case RowID.quietHoursEnd:
            preferences?.quietHoursEndLocal = value
            enqueue(["quiet_hours_end_local": .string(value)])
        default:
            break
        }
    }

    public func selectRadio(_ rowId: String) async {
        guard preferences != nil,
              let option = Self.locationOptions.first(where: { $0.rowId == rowId })
        else { return }
        preferences?.locationMode = option.mode.rawValue
        enqueue(["location_mode": .string(option.mode.rawValue)])
    }

    // MARK: - Networking

    private func fetch() async {
        do {
            let response: NotificationPreferencesResponseDTO = try await api.request(
                NotificationPreferencesEndpoints.fetch()
            )
            preferences = response.preferences
            state = .loaded(groups())
        } catch {
            guard preferences != nil else {
                state = .error(
                    message: (error as? APIError)?.errorDescription
                        ?? "Couldn't load your notification preferences."
                )
                return
            }
            // We already have something on screen — keep it and surface
            // the failure as a toast, exactly like RN.
            toast = ToastMessage(text: "Failed to load preferences", kind: .error)
            state = .loaded(groups())
        }
    }

    /// Apply locally, re-project, and (re)arm the debounce timer.
    private func enqueue(_ patch: [String: JSONValue]) {
        for (key, value) in patch {
            pendingPatch[key] = value
        }
        state = .loaded(groups())
        saveTask?.cancel()
        let delay = saveDebounce
        saveTask = Task { [weak self] in
            try? await Task.sleep(for: delay)
            guard !Task.isCancelled else { return }
            await self?.flushPendingSave()
        }
    }

    /// Test seam — drain the debounce window immediately.
    func flushPendingSaveNow() async {
        saveTask?.cancel()
        saveTask = nil
        await flushPendingSave()
    }

    private func flushPendingSave() async {
        let patch = pendingPatch
        pendingPatch = [:]
        guard !patch.isEmpty else { return }
        do {
            let response: NotificationPreferencesResponseDTO = try await api.request(
                NotificationPreferencesEndpoints.update(patch)
            )
            preferences = response.preferences
            state = .loaded(groups())
            toast = ToastMessage(text: "Saved", kind: .success)
        } catch {
            toast = ToastMessage(text: "Failed to save", kind: .error)
            // Roll back by re-reading server truth (RN does the same).
            await fetch()
        }
    }

    private func setQuietHours(enabled: Bool) {
        if enabled {
            preferences?.quietHoursStartLocal = Self.defaultQuietStart
            preferences?.quietHoursEndLocal = Self.defaultQuietEnd
            enqueue([
                "quiet_hours_start_local": .string(Self.defaultQuietStart),
                "quiet_hours_end_local": .string(Self.defaultQuietEnd)
            ])
        } else {
            preferences?.quietHoursStartLocal = nil
            preferences?.quietHoursEndLocal = nil
            enqueue([
                "quiet_hours_start_local": .null,
                "quiet_hours_end_local": .null
            ])
        }
    }

    // MARK: - Group projection

    private func groups() -> [GroupedListGroup] {
        guard let prefs = preferences else { return [] }
        return [
            briefingsGroup(prefs),
            alertsGroup(prefs),
            quietHoursGroup(prefs),
            locationGroup(prefs)
        ]
    }

    private func briefingsGroup(_ prefs: NotificationPreferencesDTO) -> GroupedListGroup {
        var rows: [GroupedListRow] = [
            GroupedListRow(
                id: RowID.morningBriefing,
                label: "Morning Briefing",
                subtext: "Current weather plus the most relevant thing for today",
                control: .toggle(isOn: prefs.dailyBriefingEnabled)
            )
        ]
        if prefs.dailyBriefingEnabled {
            rows.append(
                GroupedListRow(
                    id: RowID.morningTime,
                    label: "Briefing Time",
                    subtext: "Choose when this briefing arrives",
                    control: .chips(
                        options: Self.morningTimeOptions,
                        selected: prefs.dailyBriefingTimeLocal
                    )
                )
            )
        }
        rows.append(
            GroupedListRow(
                id: RowID.eveningBriefing,
                label: "Evening Briefing",
                subtext: "Tomorrow's forecast plus one useful thing to handle tonight",
                control: .toggle(isOn: prefs.eveningBriefingEnabled)
            )
        )
        if prefs.eveningBriefingEnabled {
            rows.append(
                GroupedListRow(
                    id: RowID.eveningTime,
                    label: "Briefing Time",
                    subtext: "Choose when this briefing arrives",
                    control: .chips(
                        options: Self.eveningTimeOptions,
                        selected: prefs.eveningBriefingTimeLocal
                    )
                )
            )
        }
        return GroupedListGroup(id: GroupID.briefings, overline: "Briefings", rows: rows)
    }

    private func alertsGroup(_ prefs: NotificationPreferencesDTO) -> GroupedListGroup {
        GroupedListGroup(
            id: GroupID.alerts,
            overline: "Alert preferences",
            rows: [
                GroupedListRow(
                    id: RowID.weatherAlerts,
                    label: "Weather Alerts",
                    subtext: "Severe weather and storm warnings",
                    control: .toggle(isOn: prefs.weatherAlertsEnabled)
                ),
                GroupedListRow(
                    id: RowID.aqiAlerts,
                    label: "Air Quality Alerts",
                    subtext: "Unhealthy AQI notifications",
                    control: .toggle(isOn: prefs.aqiAlertsEnabled)
                ),
                GroupedListRow(
                    id: RowID.homeReminders,
                    label: "Home Reminders",
                    subtext: "Bills, tasks, and calendar events",
                    control: .toggle(isOn: prefs.homeRemindersEnabled)
                ),
                GroupedListRow(
                    id: RowID.gigUpdates,
                    label: "Gig Updates",
                    subtext: "Active gig status changes",
                    control: .toggle(isOn: prefs.gigUpdatesEnabled)
                ),
                GroupedListRow(
                    id: RowID.mailSummary,
                    label: "Mail Summary",
                    subtext: "Daily mailbox digest",
                    control: .toggle(isOn: prefs.mailSummaryEnabled)
                )
            ]
        )
    }

    private func quietHoursGroup(_ prefs: NotificationPreferencesDTO) -> GroupedListGroup {
        var rows: [GroupedListRow] = [
            GroupedListRow(
                id: RowID.quietHours,
                label: "Quiet Hours",
                subtext: "Silence briefings during set hours",
                control: .toggle(isOn: prefs.quietHoursEnabled)
            )
        ]
        if prefs.quietHoursEnabled {
            rows.append(
                GroupedListRow(
                    id: RowID.quietHoursStart,
                    label: "From",
                    control: .chips(
                        options: Self.quietStartOptions,
                        selected: prefs.quietHoursStartLocal ?? Self.defaultQuietStart
                    )
                )
            )
            rows.append(
                GroupedListRow(
                    id: RowID.quietHoursEnd,
                    label: "Until",
                    control: .chips(
                        options: Self.quietEndOptions,
                        selected: prefs.quietHoursEndLocal ?? Self.defaultQuietEnd
                    )
                )
            )
        }
        return GroupedListGroup(id: GroupID.quietHours, overline: "Quiet hours", rows: rows)
    }

    private func locationGroup(_ prefs: NotificationPreferencesDTO) -> GroupedListGroup {
        GroupedListGroup(
            id: GroupID.briefingLocation,
            overline: "Briefing location",
            rows: Self.locationOptions.map { option in
                GroupedListRow(
                    id: option.rowId,
                    label: option.label,
                    control: .radio(isSelected: prefs.locationMode == option.mode.rawValue)
                )
            }
        )
    }

    // MARK: - Stable identifiers (parity contract — mirrored on Android)

    public enum GroupID {
        public static let briefings = "briefings"
        public static let alerts = "alerts"
        public static let quietHours = "quietHours"
        public static let briefingLocation = "briefingLocation"
    }

    public enum RowID {
        public static let morningBriefing = "briefings.morning"
        public static let morningTime = "briefings.morningTime"
        public static let eveningBriefing = "briefings.evening"
        public static let eveningTime = "briefings.eveningTime"
        public static let weatherAlerts = "alerts.weather"
        public static let aqiAlerts = "alerts.aqi"
        public static let homeReminders = "alerts.homeReminders"
        public static let gigUpdates = "alerts.gigUpdates"
        public static let mailSummary = "alerts.mailSummary"
        public static let quietHours = "quietHours.enabled"
        public static let quietHoursStart = "quietHours.start"
        public static let quietHoursEnd = "quietHours.end"
        public static let locationPrimaryHome = "briefingLocation.primaryHome"
        public static let locationViewing = "briefingLocation.viewingLocation"
        public static let locationDevice = "briefingLocation.deviceLocation"
    }

    // MARK: - Option catalogues (parity contract — mirrored on Android)

    /// One radio row in the Briefing-location card.
    public struct LocationOption: Sendable, Hashable {
        public let mode: BriefingLocationMode
        public let rowId: String
        public let label: String
    }

    /// RN `TIME_OPTIONS` (`notification-preferences.tsx:16-18`).
    public static let morningTimeOptions = [
        "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00"
    ]
    /// RN `EVENING_TIME_OPTIONS` (`notification-preferences.tsx:20-22`).
    public static let eveningTimeOptions = [
        "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"
    ]
    public static let quietStartOptions = ["20:00", "21:00", "22:00", "23:00", "00:00"]
    public static let quietEndOptions = ["05:00", "06:00", "07:00", "08:00", "09:00"]
    /// RN seeds these when quiet hours are switched on
    /// (`notification-preferences.tsx:208`).
    public static let defaultQuietStart = "22:00"
    public static let defaultQuietEnd = "07:00"

    /// RN `LOCATION_MODES` (`notification-preferences.tsx:24-28`). The
    /// backend also accepts `custom`, which needs lat/lng and has no RN
    /// or native editor — a stored `custom` simply leaves all three
    /// radios unselected rather than being silently rewritten.
    public static let locationOptions: [LocationOption] = [
        LocationOption(mode: .primaryHome, rowId: RowID.locationPrimaryHome, label: "Primary Home"),
        LocationOption(
            mode: .viewingLocation,
            rowId: RowID.locationViewing,
            label: "Current Viewing Location"
        ),
        LocationOption(mode: .deviceLocation, rowId: RowID.locationDevice, label: "Device Location")
    ]
}
