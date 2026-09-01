//
//  DefaultRemindersViewModel.swift
//  Pantopus
//
//  Stream I16 — H1 Default Reminders Quick-Setup. The flagship simple reminder
//  surface: pick the lead-times that auto-attach to every event the owner owns.
//  Lead-times persist on the BOOKING PAGE (`reminder_minutes[]`) via
//  `PUT /booking-page` — there is no per-reminder channel store, so the Push /
//  Email channel chips on each active row are illustrative. On first open with no
//  saved reminders we pre-pick the smart default (1 day + 1 hour). A real push
//  authorization check drives the permission-gated banner. Owner-polymorphic.
//

import Foundation
import Observation
import SwiftUI
import UserNotifications

@Observable
@MainActor
final class DefaultRemindersViewModel {
    enum Phase: Equatable { case loading, loaded, error(String) }

    // MARK: Inputs

    let owner: SchedulingOwner
    private let client: SchedulingClient

    // MARK: State

    private(set) var phase: Phase = .loading
    /// Selected lead-times (minutes before start), sorted longest-first.
    private(set) var reminderMinutes: [Int] = []
    /// True when the screen opened with no saved reminders (smart-default copy).
    private(set) var firstOpen = false
    /// OS push permission is denied → show the amber "email still works" banner.
    private(set) var pushOff = false
    private(set) var isSaving = false
    private(set) var showSavedToast = false
    /// Inline save failure (kept beside the card so selections aren't lost).
    private(set) var saveError: String?

    /// Inline custom-time stepper state.
    var showCustom = false
    var customValue = 2
    var customUnit: ReminderPreset.Unit = .hours

    private var lastSaved: [Int] = []

    /// Backend caps (`PUT /booking-page` — scheduling.js `reminder_minutes`
    /// Joi `.max(5)`, items `.max(43200)`): at most 5 lead-times, each within
    /// 30 days of the start. Enforced client-side so Save can never 400 on a
    /// selection the sheet happily allowed.
    static let maxReminders = 5
    static let maxLeadTimeMinutes = 43200

    /// True once the selection hits the backend's 5-reminder cap — unselected
    /// rows and "Add custom time" disable with the "Up to 5 reminders" note.
    var atCap: Bool {
        reminderMinutes.count >= Self.maxReminders
    }

    // MARK: Derived

    var theme: SchedulingIdentityTheme {
        owner.theme
    }

    var accent: Color {
        theme.accent
    }

    var accentBg: Color {
        theme.accentBg
    }

    /// Page minutes that aren't one of the fixed presets — rendered as extra
    /// "custom" rows beneath the preset card so saved values never disappear.
    var customMinutes: [Int] {
        let presets = Set(ReminderPreset.all.map(\.minutes))
        return reminderMinutes.filter { !presets.contains($0) }.sorted(by: >)
    }

    var isDirty: Bool {
        Set(reminderMinutes) != Set(lastSaved)
    }

    /// Custom value resolves to this many minutes-before-start, clamped to the
    /// backend's 30-day per-item ceiling (43200) so e.g. "999 hours" saves as
    /// the max instead of failing validation.
    var customResolvedMinutes: Int {
        min(max(0, customValue) * customUnit.multiplier, Self.maxLeadTimeMinutes)
    }

    init(owner: SchedulingOwner, client: SchedulingClient) {
        self.owner = owner
        self.client = client
    }

    // MARK: Lifecycle

    func load() async {
        if case .loaded = phase {} else { phase = .loading }
        // Non-blocking: the OS push check decorates the banner but must never
        // gate (or stall) the reminder load.
        Task { await refreshPushState() }
        do {
            let result: BookingPageResponse = try await client.request(SchedulingEndpoints.getBookingPage(owner: owner))
            let saved = result.page.reminderMinutes ?? []
            if saved.isEmpty {
                firstOpen = true
                reminderMinutes = ReminderPreset.smartDefault.sorted(by: >)
                lastSaved = [] // dirty so first Save persists the smart default
            } else {
                firstOpen = false
                reminderMinutes = saved.sorted(by: >)
                lastSaved = reminderMinutes
            }
            phase = .loaded
        } catch let error as SchedulingError {
            phase = .error(error.userMessage ?? "Couldn't load your reminders.")
        } catch {
            phase = .error("Couldn't load your reminders.")
        }
    }

    /// Reads the OS notification authorization without prompting.
    private func refreshPushState() async {
        let status = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
        pushOff = status == .denied
    }

    // MARK: Editing

    func isOn(_ minutes: Int) -> Bool {
        reminderMinutes.contains(minutes)
    }

    func toggle(_ minutes: Int) {
        if let idx = reminderMinutes.firstIndex(of: minutes) {
            reminderMinutes.remove(at: idx)
        } else {
            guard !atCap else { return } // backend rejects a 6th reminder
            reminderMinutes.append(minutes)
        }
        reminderMinutes.sort(by: >)
    }

    func stepCustom(_ delta: Int) {
        customValue = max(1, min(customValue + delta, 999))
    }

    func setCustomUnit(_ unit: ReminderPreset.Unit) {
        customUnit = unit
    }

    func addCustom() {
        let minutes = customResolvedMinutes
        guard minutes > 0, !reminderMinutes.contains(minutes), !atCap else {
            showCustom = false
            return
        }
        reminderMinutes.append(minutes)
        reminderMinutes.sort(by: >)
        showCustom = false
        customValue = 2
        customUnit = .hours
    }

    // MARK: Save

    func save() async {
        guard !isSaving else { return }
        isSaving = true
        saveError = nil
        defer { isSaving = false }
        do {
            let result: BookingPageResponse = try await client.request(
                SchedulingEndpoints.updateBookingPage(owner: owner, BookingPageUpdateRequest(reminderMinutes: reminderMinutes))
            )
            reminderMinutes = (result.page.reminderMinutes ?? reminderMinutes).sorted(by: >)
            lastSaved = reminderMinutes
            firstOpen = false
            flashSaved()
        } catch let error as SchedulingError {
            saveError = error.userMessage ?? "Couldn't save your reminders. Try again."
        } catch {
            saveError = "Couldn't save your reminders. Try again."
        }
    }

    private func flashSaved() {
        showSavedToast = true
        Task {
            try? await Task.sleep(nanoseconds: 1_900_000_000)
            showSavedToast = false
        }
    }
}
