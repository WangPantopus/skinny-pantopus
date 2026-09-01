//
//  AddGuestFormViewModel.swift
//  Pantopus
//
//  A13.1 — Backs the Add Guest form (issue a short-term guest pass for a
//  home). Built on the shared `FormShell` archetype: name + contact +
//  welcome are tracked as `FormFieldState`s; duration (single-select) and
//  allowed-areas (multi-select) are enum-ish chip selections held
//  directly.
//
//  `submit()` issues the pass via `POST /api/homes/:id/guest-passes`
//  (route `backend/routes/homeIam.js:667`), raises a success toast
//  ("Pass sent to <name>") and publishes `createdShare` — the one-time
//  share token composed into a viewer link. The host offers the OS share
//  sheet (RN parity: `src/app/homes/[id]/share.tsx:60-82`) and then calls
//  `acknowledgeShare()`, which flips `shouldDismiss` so the modal pops.
//  The contact, welcome note, and allowed-area chips are UI affordances
//  the create endpoint doesn't model, so they stay local.
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
public final class AddGuestFormViewModel {
    // MARK: - Bound state

    public private(set) var nameField: FormFieldState
    public private(set) var contactField: FormFieldState
    public private(set) var welcomeField: FormFieldState

    /// Selected duration chip id (single-select). `nil` until the user
    /// picks one. `"custom"` opens the date-range sheet.
    public var duration: String?

    /// Selected allowed-area chip ids (multi-select, optional).
    public var selectedAreas: Set<String> = []

    /// Custom date range, populated when the user commits the picker.
    public private(set) var customStart: Date?
    public private(set) var customEnd: Date?

    public private(set) var isSaving = false
    public var toast: ToastMessage?
    public private(set) var shouldDismiss = false

    /// Set once the pass is created. Carries the raw one-time `token`
    /// (composed into a public viewer URL) so the host can fire the OS
    /// share sheet. Cleared by `acknowledgeShare()`.
    public private(set) var createdShare: GuestPassShare?

    // MARK: - Inputs

    public let homeId: String
    public let homeContext: AddGuestSampleData.HomeContext
    public let durationOptions = AddGuestSampleData.durationOptions
    public let areaOptions = AddGuestSampleData.areaOptions
    public let welcomeMaxLength = AddGuestSampleData.welcomeMaxLength

    private let onSent: (String) -> Void
    private let api: APIClient

    init(
        homeId: String,
        api: APIClient = .shared,
        onSent: @escaping (String) -> Void = { _ in }
    ) {
        self.homeId = homeId
        self.api = api
        homeContext = AddGuestSampleData.homeContext(for: homeId)
        nameField = FormFieldState(id: "name", originalValue: "")
        contactField = FormFieldState(id: "contact", originalValue: "")
        welcomeField = FormFieldState(id: "welcome", originalValue: "")
        self.onSent = onSent
    }

    // MARK: - Aggregate

    /// Required: name non-empty, contact valid (email OR phone), duration
    /// chosen. Areas + welcome are optional.
    public var isValid: Bool {
        !trimmedName.isEmpty
            && Self.isContactValid(contactField.value)
            && duration != nil
    }

    /// Any input touched — drives the dirty-close confirm in `FormShell`.
    public var isDirty: Bool {
        !trimmedName.isEmpty
            || !contactField.value.isEmpty
            || duration != nil
            || !selectedAreas.isEmpty
            || !welcomeField.value.isEmpty
    }

    // MARK: - Field states (drive the text-field visuals)

    public var nameFieldState: PantopusFieldState {
        (nameField.touched && !trimmedName.isEmpty) ? .valid : .default
    }

    public var contactFieldState: PantopusFieldState {
        if let error = contactField.error { return .error(error) }
        if contactField.touched, Self.isContactValid(contactField.value) { return .valid }
        return .default
    }

    // MARK: - Hints

    /// Italic helper under the duration chips. Mirrors the design copy.
    public var durationHint: String {
        switch duration {
        case "2h": "Two-hour pass · auto-revokes after"
        case "today": "Today until 11:59 PM · auto-revokes after"
        case "weekend": "Sat 12:00 AM → Sun 11:59 PM · auto-revokes after"
        case AddGuestSampleData.durationCustomId:
            if let start = customStart, let end = customEnd {
                "\(Self.format(start)) → \(Self.format(end)) · auto-revokes after"
            } else {
                "Pick a custom date range"
            }
        default: "Pick how long the pass is good for."
        }
    }

    /// Italic helper under the allowed-areas chips.
    public var areasHint: String {
        guard !selectedAreas.isEmpty else { return "Front door only, unless you add more." }
        let possessive = firstName.map { "\($0)'s" } ?? "Their"
        return "\(possessive) pass unlocks only what you pick."
    }

    /// First word of the entered name, if any — used for the toast and
    /// the areas-hint possessive.
    public var firstName: String? {
        trimmedName.split(separator: " ").first.map(String.init)
    }

    private var trimmedName: String {
        nameField.value.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    // MARK: - Field updates

    public func updateName(_ value: String) {
        nameField.value = value
        nameField.touched = true
    }

    public func updateContact(_ value: String) {
        contactField.value = value
        contactField.touched = true
        contactField.error = Self.validateContact(value)
    }

    public func updateWelcome(_ value: String) {
        welcomeField.value = String(value.prefix(welcomeMaxLength))
        welcomeField.touched = true
    }

    // MARK: - Custom duration range

    public func setCustomRange(_ start: Date, _ end: Date) {
        customStart = start
        customEnd = end
        duration = AddGuestSampleData.durationCustomId
    }

    public func clearCustomRange() {
        customStart = nil
        customEnd = nil
        if duration == AddGuestSampleData.durationCustomId { duration = nil }
    }

    // MARK: - Submit

    public func submit() async {
        guard isValid, !isSaving else { return }
        isSaving = true
        // `label` carries the guest's name; the time window comes from the
        // selected duration chip. Contact, welcome note, and allowed-area
        // chips are UI affordances the create endpoint doesn't model, so
        // they stay local (a backend follow-up would persist them).
        let window = guestPassWindow()
        let request = CreateGuestPassRequest(
            label: trimmedName,
            kind: "guest",
            durationHours: window.durationHours,
            startAt: window.startAt,
            endAt: window.endAt
        )
        let response: CreateGuestPassResponse
        do {
            response = try await api.request(
                HomesEndpoints.createGuestPass(homeId: homeId, request: request),
                as: CreateGuestPassResponse.self
            )
        } catch {
            isSaving = false
            toast = ToastMessage(
                text: (error as? APIError)?.errorDescription
                    ?? "Couldn't issue the pass. Try again.",
                kind: .error
            )
            return
        }
        isSaving = false
        let name = firstName ?? "your guest"
        toast = ToastMessage(text: "Pass sent to \(name)", kind: .success)
        onSent(name)
        // The raw token is returned exactly once (homeIam.js:762-767) —
        // this is the only moment a shareable link can be built.
        createdShare = GuestPassShare(
            id: response.pass.id,
            guestName: firstName ?? "",
            urlString: GuestPassShare.url(forToken: response.token)
        )
    }

    /// Called by the host once the user has either shared the new pass or
    /// declined. Clears the offer and asks the host to pop the form.
    public func acknowledgeShare() {
        createdShare = nil
        shouldDismiss = true
    }

    // MARK: - Guest-pass window

    /// The backend resolves `end_at` > `duration_hours` > template
    /// default, so the 2-hour preset sends a relative `durationHours`
    /// while the dated presets send absolute ISO `start`/`end` stamps.
    struct GuestPassWindow {
        var durationHours: Int?
        var startAt: String?
        var endAt: String?
    }

    func guestPassWindow() -> GuestPassWindow {
        switch duration {
        case "2h":
            return GuestPassWindow(durationHours: 2)
        case "today":
            return GuestPassWindow(endAt: Self.isoStartOfTomorrow())
        case "weekend":
            let (start, end) = Self.weekendWindow()
            return GuestPassWindow(startAt: start, endAt: end)
        case AddGuestSampleData.durationCustomId:
            // Day-precision boundaries (parity with Android's day picker):
            // start of the first day → start of the day after the last.
            return GuestPassWindow(
                startAt: customStart.map(Self.isoStartOfDay),
                endAt: customEnd.map(Self.isoStartOfNextDay)
            )
        default:
            // `isValid` guarantees a duration is chosen before submit;
            // fall back to the 2-hour preset defensively.
            return GuestPassWindow(durationHours: 2)
        }
    }

    private static func iso(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: date)
    }

    private static func isoStartOfDay(_ date: Date) -> String {
        iso(Calendar.current.startOfDay(for: date))
    }

    private static func isoStartOfNextDay(_ date: Date) -> String {
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: date)
        let next = calendar.date(byAdding: .day, value: 1, to: startOfDay) ?? startOfDay
        return iso(next)
    }

    /// Local next-midnight — the exclusive end of "today".
    private static func isoStartOfTomorrow() -> String {
        let calendar = Calendar.current
        let startOfToday = calendar.startOfDay(for: Date())
        let startOfTomorrow = calendar.date(byAdding: .day, value: 1, to: startOfToday) ?? startOfToday
        return iso(startOfTomorrow)
    }

    /// Upcoming (or current) Sat 00:00 → Mon 00:00 window.
    private static func weekendWindow() -> (String, String) {
        let calendar = Calendar.current
        let startOfToday = calendar.startOfDay(for: Date())
        // `.weekday`: 1 = Sunday … 7 = Saturday.
        let weekday = calendar.component(.weekday, from: startOfToday)
        let daysUntilSaturday = (7 - weekday) % 7
        let saturday = calendar.date(byAdding: .day, value: daysUntilSaturday, to: startOfToday) ?? startOfToday
        let monday = calendar.date(byAdding: .day, value: 2, to: saturday) ?? saturday
        return (iso(saturday), iso(monday))
    }

    public func acknowledgeDismiss() {
        shouldDismiss = false
    }

    // MARK: - Validation (static — testable without the view layer)

    /// Returns an error string when a non-empty contact is neither a
    /// valid email nor a valid phone; `nil` when empty (required-ness is
    /// enforced by `isValid`) or valid.
    static func validateContact(_ raw: String) -> String? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return nil }
        return isContactValid(trimmed) ? nil : "Enter a valid email or phone number."
    }

    static func isContactValid(_ raw: String) -> Bool {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        return matchesEmail(trimmed) || matchesPhone(trimmed)
    }

    static func matchesEmail(_ value: String) -> Bool {
        let pattern = "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$"
        return value.range(of: pattern, options: .regularExpression) != nil
    }

    static func matchesPhone(_ value: String) -> Bool {
        let allowed = CharacterSet(charactersIn: "0123456789 +()-.")
        guard value.unicodeScalars.allSatisfy({ allowed.contains($0) }) else { return false }
        let digits = value.filter(\.isNumber)
        return digits.count >= 7 && digits.count <= 15
    }

    private static func format(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }
}
