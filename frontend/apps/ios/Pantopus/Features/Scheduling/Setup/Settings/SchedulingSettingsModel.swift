//
//  SchedulingSettingsModel.swift
//  Pantopus
//
//  A3 "Booking settings" view-model. Loads the booking page (+ payments status,
//  + event types for the fresh/loaded split) and projects the grouped settings
//  index: Automation · Scheduling defaults · Payments (gated) · Team (Business)
//  · Danger zone. Danger actions (reset slug / disable) hit the backend with a
//  confirm. States: loaded / fresh (amber chips) / saving / saved. Matches
//  `scheduling-settings-frames.jsx`.
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class SchedulingSettingsModel {
    enum Phase: Equatable { case loading, loaded, error(String) }

    private(set) var phase: Phase = .loading
    let owner: SchedulingOwner
    let push: @MainActor (SchedulingRoute) -> Void

    private(set) var page: BookingPageDTO?
    private(set) var payments: PaymentsStatusDTO?
    private(set) var eventTypeCount = 0

    /// Whether the page is freshly created (no real config yet) → amber defaults.
    private(set) var isFresh = false
    private(set) var showSavedToast = false
    private(set) var isDisabling = false
    private(set) var isResetting = false
    /// Danger-zone failure surface. These are destructive, deliberate actions — a silent
    /// no-op (e.g. tapping "Disable scheduling" offline) left the page live with zero
    /// feedback. Android shows a failure toast here; this is its mirror.
    private(set) var dangerError: String?

    /// Per-row write fidelity (matches the JSX 'saving'/'saved' frames): the row
    /// id whose value is being written (shows a Shimmer in its trailing slot) and
    /// the one that just succeeded (shows a green "Saved" chip briefly).
    enum RowID: Equatable { case cancellationPolicy, defaultTimezone }
    private(set) var savingRow: RowID?
    private(set) var justSavedRow: RowID?

    private let client = SchedulingClient.shared
    private let api = APIClient.shared

    var theme: SchedulingIdentityTheme {
        owner.theme
    }

    var isBusiness: Bool {
        if case .business = owner { return true }
        return false
    }

    var paidEnabled: Bool {
        SchedulingFeatureFlags.paidEnabled
    }

    init(owner: SchedulingOwner, push: @escaping @MainActor (SchedulingRoute) -> Void) {
        self.owner = owner
        self.push = push
    }

    // MARK: Lifecycle

    func load() async {
        phase = .loading
        do {
            let pageResult: BookingPageResponse = try await client.request(SchedulingEndpoints.getBookingPage(owner: owner))
            page = pageResult.page
            async let paymentsR: PaymentsStatusDTO? = try? api.request(SchedulingEndpoints.paymentsStatus(owner: owner))
            async let typesR: EventTypesResponse? = try? api.request(SchedulingEndpoints.getEventTypes(owner: owner))
            payments = await paymentsR
            eventTypeCount = await (typesR)?.eventTypes.count ?? 0
            // "Fresh" when the page has no reminders configured and no event types.
            isFresh = (pageResult.page.reminderMinutes?.isEmpty ?? true) && eventTypeCount == 0
            phase = .loaded
        } catch let error as SchedulingError {
            phase = .error(error.userMessage ?? "Couldn't load booking settings.")
        } catch {
            phase = .error("Couldn't load booking settings.")
        }
    }

    func refresh() async {
        await load()
    }

    // MARK: Derived display

    var slug: String {
        page?.slug ?? ""
    }

    var monoFooter: String {
        let ownerTag: String = switch owner {
        case .personal: "owner · you"
        case .home: "owner · household"
        case .business: "owner · business"
        }
        return "pantopus.com/book/\(slug.isEmpty ? "…" : slug) · \(ownerTag)"
    }

    var timezoneValue: String {
        let tz = page?.timezone ?? SchedulingTime.deviceTimeZoneIdentifier
        return "\(tz) · auto"
    }

    var remindersValue: String? {
        guard let mins = page?.reminderMinutes, !mins.isEmpty else { return nil }
        return mins.sorted(by: >).map(Self.reminderLabel).joined(separator: " · ")
    }

    var paymentsConnected: Bool {
        payments?.connected == true
    }

    var paymentsApplicable: Bool {
        payments?.applicable == true
    }

    static func reminderLabel(_ minutes: Int) -> String {
        switch minutes {
        case let m where m % 1440 == 0: "\(m / 1440) day"
        case let m where m % 60 == 0: "\(m / 60) hr"
        default: "\(minutes) min"
        }
    }

    // MARK: Navigation

    func openNotifications() {
        push(.notificationPreferences(owner: owner))
    }

    func openReminders() {
        push(.defaultReminders(owner: owner))
    }

    func openWorkflows() {
        push(.workflowsList(owner: owner))
    }

    func openTemplates() {
        push(.messageTemplateLibrary(owner: owner))
    }

    func openAvailability() {
        push(.availabilityScheduleList)
    }

    func openCancellationPolicy() {
        push(.cancellationPolicyEditor(owner: owner, eventTypeId: nil))
    }

    func openPayments() {
        push(.paymentsSetup(owner: owner))
    }

    func openTeam() {
        push(.teamBookingAvailability(owner: owner, tz: SchedulingTime.deviceTimeZoneIdentifier))
    }

    // MARK: Danger zone

    func resetSlug() async {
        guard !isResetting else { return }
        isResetting = true
        defer { isResetting = false }
        do {
            let result: BookingPageResponse = try await client.request(SchedulingEndpoints.resetSlug(owner: owner))
            page = result.page
            flashSaved()
        } catch {
            flashDangerError((error as? SchedulingError)?.userMessage ?? "Couldn't reset the link. Try again.")
        }
    }

    func disableScheduling() async {
        guard !isDisabling else { return }
        isDisabling = true
        defer { isDisabling = false }
        do {
            let result: BookingPageResponse = try await client.request(SchedulingEndpoints.disableBookingPage(owner: owner))
            page = result.page
            flashSaved()
        } catch {
            flashDangerError((error as? SchedulingError)?.userMessage ?? "Couldn't disable scheduling. The page is still live.")
        }
    }

    private func flashSaved() {
        showSavedToast = true
        Task {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            showSavedToast = false
        }
    }

    private func flashDangerError(_ message: String) {
        dangerError = message
        Task {
            try? await Task.sleep(nanoseconds: 3_500_000_000)
            dangerError = nil
        }
    }

    /// Mark a settings row as actively writing: shows a Shimmer in its trailing
    /// slot until `finishSavingRow` clears it. Matches the JSX 'saving' frame.
    func beginSavingRow(_ row: RowID) {
        justSavedRow = nil
        savingRow = row
    }

    /// Resolve an in-flight row write: clear the Shimmer and briefly show the
    /// green "Saved" chip in that row's trailing slot, plus the top toast.
    func finishSavingRow(_ row: RowID) {
        savingRow = nil
        justSavedRow = row
        flashSaved()
        Task {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            if justSavedRow == row { justSavedRow = nil }
        }
    }
}
