//
//  SchedulingNotificationPrefsModel.swift
//  Pantopus
//
//  A4 Notification Preferences view-model. GET/PUT notification-preferences
//  round-trips a flexible `prefs` JSONValue. The backend shape is a single
//  boolean per event (NOT separate push/email), so the matrix P + E chips of a
//  "Notify me" row move together; attendee rows are email-only. Reminder
//  lead-times persist on the BOOKING PAGE (`reminder_minutes[]`), not in prefs.
//  Unknown prefs keys are preserved on write. GET is PERSONAL-only.
//  Matches `scheduling-notif-frames.jsx`.
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class SchedulingNotificationPrefsModel {
    enum Phase: Equatable { case loading, loaded, error(String) }

    /// One row in either sub-card. `key` is the backend prefs key.
    struct Row: Identifiable {
        let key: String
        let label: String
        let sub: String?
        var enabled: Bool
        /// Confirmation row is locked on (attendees always get a confirmation).
        var locked: Bool = false
        var id: String {
            key
        }
    }

    private(set) var phase: Phase = .loading
    let owner: SchedulingOwner
    let push: @MainActor (SchedulingRoute) -> Void

    private(set) var notifyMe: [Row] = []
    private(set) var notifyAttendees: [Row] = []
    /// Reminder lead-times (minutes) currently enabled on the booking page.
    private(set) var reminderMinutes: [Int] = []

    /// The whole decoded prefs object — preserved so unknown keys survive writes.
    private var prefsRoot: [String: JSONValue] = [:]
    private var page: BookingPageDTO?

    private(set) var pushOff = false
    private(set) var paused = false
    /// When the pause lifts. Design PauseBanner reads "Paused for 2 hours" /
    /// "Resumes 11:42 AM · …" (`scheduling-notif-frames.jsx` A14.5) — but the
    /// backend booking page exposes only the `is_paused` boolean (no
    /// `paused_until` on the wire, checked backend/routes/scheduling.js), so
    /// this stays nil and the banner falls back to the untimed copy. DTO gap:
    /// when `BookingPageDTO` gains a pause window, decode it here and the
    /// designed copy lights up unchanged.
    private(set) var pausedUntil: Date?
    /// Whether the "SMS coming soon" tooltip is showing over the locked S column.
    var showSmsHint = false

    private let client = SchedulingClient.shared
    private let api = APIClient.shared

    var theme: SchedulingIdentityTheme {
        owner.theme
    }

    /// Lead-time presets shown as chips (minutes → label).
    static let leadTimePresets: [(Int, String)] = [(1440, "1 day"), (60, "1 hr"), (15, "15 min")]

    init(owner: SchedulingOwner, push: @escaping @MainActor (SchedulingRoute) -> Void) {
        self.owner = owner
        self.push = push
    }

    // MARK: Load

    func load() async {
        phase = .loading
        // Prefs are personal-only (no owner ctx).
        async let prefsR: NotificationPreferencesResponse? = try? client.request(SchedulingEndpoints.getNotificationPreferences())
        async let pageR: BookingPageResponse? = try? client.request(SchedulingEndpoints.getBookingPage(owner: owner))

        let prefs = await prefsR
        let pageResult = await pageR

        guard let prefs else {
            phase = .error("Couldn't load notification preferences.")
            return
        }
        prefsRoot = prefs.prefs.dictValue ?? [:]
        page = pageResult?.page
        reminderMinutes = pageResult?.page.reminderMinutes ?? []
        paused = pageResult?.page.isPaused ?? false
        await refreshPushAuthorization()
        rebuildRows()
        phase = .loaded
    }

    /// Read the real OS push authorization so the design's permission-gated frame
    /// (`scheduling-notif-frames.jsx` `PushOffNotice`) can actually render. `pushOff` was
    /// previously declared and rendered against but never assigned, making the notice and
    /// the greyed-out push column dead code. Android already reads the real value via
    /// `NotificationManagerCompat.areNotificationsEnabled()`.
    ///
    /// Call again when the screen returns to the foreground — the user can flip this in
    /// Settings while the app is backgrounded.
    func refreshPushAuthorization() async {
        pushOff = await NotificationChannelService.shared.pushStatus() != .authorized
        if phase == .loaded { rebuildRows() }
    }

    private func rebuildRows() {
        let me = prefsRoot["notify_me"]?.dictValue ?? [:]
        let att = prefsRoot["notify_attendees"]?.dictValue ?? [:]

        func b(_ dict: [String: JSONValue], _ key: String, default def: Bool) -> Bool {
            dict[key]?.boolValue ?? def
        }

        notifyMe = [
            Row(
                key: "new_booking",
                label: "New booking",
                sub: "We'll tell you the moment someone books.",
                enabled: b(me, "new_booking", default: true)
            ),
            Row(key: "cancellation", label: "Cancellation", sub: nil, enabled: b(me, "cancellation", default: true)),
            Row(key: "reschedule", label: "Reschedule", sub: nil, enabled: b(me, "reschedule", default: true)),
            Row(key: "reminder", label: "Reminder sent", sub: "When your reminder goes out", enabled: b(me, "reminder", default: true)),
            Row(key: "no_show", label: "No-show", sub: "Attendee missed the booking", enabled: b(me, "no_show", default: false)),
            // booking_request is the approval-flow alert, NOT a daily digest —
            // the old "Daily agenda" label toggled a key the server treats as
            // "someone requested a time", silently muting approval alerts for
            // anyone who turned it off. Copy + default mirror Android
            // (NotificationPrefsViewModel).
            Row(
                key: "booking_request",
                label: "Booking request",
                sub: "Someone requests a time that needs your approval",
                enabled: b(me, "booking_request", default: true)
            )
        ]
        notifyAttendees = [
            Row(key: "confirmation", label: "Booking confirmation", sub: "Sent the moment they book", enabled: true, locked: true),
            Row(key: "reminder", label: "Reminder", sub: "Before the booking starts", enabled: b(att, "reminder", default: true)),
            Row(key: "reschedule", label: "Reschedule notice", sub: nil, enabled: b(att, "reschedule", default: true)),
            Row(key: "cancellation", label: "Cancellation notice", sub: nil, enabled: b(att, "cancellation", default: true))
        ]
    }

    // MARK: Toggles

    func toggleNotifyMe(_ key: String) {
        guard let idx = notifyMe.firstIndex(where: { $0.key == key }), !notifyMe[idx].locked else { return }
        notifyMe[idx].enabled.toggle()
        Task { await persistPrefs() }
    }

    func toggleNotifyAttendees(_ key: String) {
        guard let idx = notifyAttendees.firstIndex(where: { $0.key == key }), !notifyAttendees[idx].locked else { return }
        notifyAttendees[idx].enabled.toggle()
        Task { await persistPrefs() }
    }

    func isReminderActive(_ minutes: Int) -> Bool {
        reminderMinutes.contains(minutes)
    }

    func toggleReminder(_ minutes: Int) {
        if let idx = reminderMinutes.firstIndex(of: minutes) {
            reminderMinutes.remove(at: idx)
        } else {
            reminderMinutes.append(minutes)
        }
        reminderMinutes.sort(by: >)
        Task { await persistReminders() }
    }

    // MARK: Pause banner copy

    /// Design title: "Paused for {duration}". Without a pause window on the
    /// wire (see `pausedUntil`) the duration is unknowable, so fall back to
    /// the untimed variant rather than inventing a number.
    var pauseBannerTitle: String {
        guard let until = pausedUntil else { return "Notifications paused" }
        return "Paused for \(Self.pauseDurationLabel(until: until))"
    }

    /// Design subtitle: "Resumes {time} · Emergency alerts still come
    /// through". The trailing clause is the only part the wire data can back
    /// today, so it renders alone until `pausedUntil` exists.
    var pauseBannerSubtitle: String {
        guard let until = pausedUntil else { return "Emergency alerts still come through" }
        return "Resumes \(Self.resumeTimeLabel(until)) · Emergency alerts still come through"
    }

    /// "2 hours" / "45 min" / "1 hr 30 min" — how long until the pause lifts.
    static func pauseDurationLabel(until: Date, from now: Date = Date()) -> String {
        let mins = max(Int(until.timeIntervalSince(now) / 60), 1)
        if mins < 60 { return "\(mins) min" }
        let hours = mins / 60
        let rem = mins % 60
        if rem == 0 { return hours == 1 ? "1 hour" : "\(hours) hours" }
        return "\(hours) hr \(rem) min"
    }

    /// "11:42 AM" — the design's resume-time format.
    static func resumeTimeLabel(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "h:mm a"
        return f.string(from: date)
    }

    /// Immediately resumes notifications (sets isPaused = false). Optimistic.
    func resume() {
        let previous = paused
        paused = false
        Task {
            do {
                let result: BookingPageResponse = try await client.request(
                    SchedulingEndpoints.updateBookingPage(owner: owner, BookingPageUpdateRequest(isPaused: false))
                )
                paused = result.page.isPaused
                page = result.page
            } catch {
                paused = previous
            }
        }
    }

    // MARK: Persistence

    private func persistPrefs() async {
        // Overlay edited keys onto the preserved root.
        var me = prefsRoot["notify_me"]?.dictValue ?? [:]
        for row in notifyMe {
            me[row.key] = .bool(row.enabled)
        }
        var att = prefsRoot["notify_attendees"]?.dictValue ?? [:]
        for row in notifyAttendees where !row.locked {
            att[row.key] = .bool(row.enabled)
        }
        // Keep confirmation explicitly true.
        att["confirmation"] = .bool(true)

        var root = prefsRoot
        root["notify_me"] = .object(me)
        root["notify_attendees"] = .object(att)
        prefsRoot = root

        let request = UpdateNotificationPreferencesRequest(prefs: .object(root))
        do {
            let result: NotificationPreferencesResponse = try await client
                .request(SchedulingEndpoints.updateNotificationPreferences(request))
            prefsRoot = result.prefs.dictValue ?? root
        } catch {
            // Optimistic UI already applied; re-fetch on failure to resync.
            await load()
        }
    }

    private func persistReminders() async {
        let request = BookingPageUpdateRequest(reminderMinutes: reminderMinutes)
        do {
            let result: BookingPageResponse = try await client.request(SchedulingEndpoints.updateBookingPage(owner: owner, request))
            page = result.page
            reminderMinutes = result.page.reminderMinutes ?? reminderMinutes
        } catch {
            await load()
        }
    }
}
