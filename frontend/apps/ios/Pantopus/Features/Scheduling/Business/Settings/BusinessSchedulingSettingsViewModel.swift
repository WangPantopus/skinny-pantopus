//
//  BusinessSchedulingSettingsViewModel.swift
//  Pantopus
//
//  G5 Business Scheduling Settings (Stream I13). The Business-pillar variant of
//  A3's booking-settings index: Confirmation · Scheduling defaults · Policy ·
//  Notifications · Payments. Loads the business booking page (+ payments status,
//  event types for the representative defaults, notification preferences, and the
//  team access record for admin gating). States: loading / loaded / auto-confirm
//  / payments-required / permission-gated / error. Matches `bizsettings-frames.jsx`.
//
//  Wiring notes (honest backend mapping):
//   • Timezone → real (PUT /booking-page). • Notifications → real (PUT
//     /notification-preferences, merged, business-namespaced keys). • Payments →
//     real status (GET /payments/status) + Connect deep-link.
//   • Confirmation / min-notice / horizon / buffers are per-SERVICE on the
//     backend (no owner-level store); shown as representative defaults derived
//     from the owner's event types and routed to the event-type list to change.
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class BusinessSchedulingSettingsViewModel {
    enum Phase: Equatable { case loading, loaded, error(String) }

    // MARK: Inputs

    let owner: SchedulingOwner
    let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    // MARK: State

    private(set) var phase: Phase = .loading
    private(set) var page: BookingPageDTO?
    private(set) var payments: PaymentsStatusDTO?
    private(set) var eventTypes: [EventTypeDTO] = []
    private(set) var access: BusinessTeamAccessDTO?
    private var prefs: [String: JSONValue] = [:]

    /// Local confirmation default (no owner-level backend store — set per service
    /// in the event-type editor). Seeded from the owner's event types.
    var confirmationApprove = true
    /// Notification toggles — round-trip through `/notification-preferences`.
    private(set) var notifyOwner = true
    private(set) var notifyAssigned = false

    private(set) var savingTimezone = false
    var showTimezoneSheet = false
    private(set) var showSavedToast = false

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

    /// Admin gating — only show the read-only lock when we positively know the
    /// caller lacks `team.manage`. Unknown/owner ⇒ editable.
    var canManage: Bool {
        guard let access else { return true }
        return access.isOwner == true || access.permissions.contains("team.manage")
    }

    var isGated: Bool {
        access != nil && !canManage
    }

    var timezone: String {
        page?.timezone ?? SchedulingTime.deviceTimeZoneIdentifier
    }

    var paymentsConnected: Bool {
        payments?.connected == true
    }

    /// Connected-payout sub-line. The design shows the masked payout account
    /// ("Payout to ••4291"), but `PaymentsStatusDTO` exposes no bank-last4 /
    /// payout-destination field, so we surface the honest "Payout connected"
    /// until that lands (see deferredBackend). Kept as a single source so the
    /// row updates automatically once the field exists.
    var payoutSub: String {
        "Payout connected"
    }

    var hasPaidServices: Bool {
        eventTypes.contains { ($0.priceCents ?? 0) > 0 }
    }

    /// Frame 4 trigger — paid services exist but Stripe isn't connected yet.
    var paymentsRequired: Bool {
        hasPaidServices && !paymentsConnected
    }

    init(
        owner: SchedulingOwner,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.owner = owner
        self.push = push
        self.client = client
    }

    // MARK: Lifecycle

    func load() async {
        phase = .loading
        do {
            let pageResult: BookingPageResponse = try await client.request(SchedulingEndpoints.getBookingPage(owner: owner))
            page = pageResult.page

            async let paymentsR: PaymentsStatusDTO? = try? client.request(SchedulingEndpoints.paymentsStatus(owner: owner))
            async let typesR: EventTypesResponse? = try? client.request(SchedulingEndpoints.getEventTypes(owner: owner))
            async let prefsR: NotificationPreferencesResponse? = try? client.request(SchedulingEndpoints.getNotificationPreferences())

            payments = await paymentsR
            eventTypes = await (typesR)?.eventTypes ?? []
            await applyPrefs(prefsR?.prefs)
            confirmationApprove = majorityRequiresApproval

            if let businessId = owner.businessIdValue {
                access = try? await client.request(BusinessTeamEndpoints.access(businessId: businessId))
            }
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

    // MARK: Notification preferences

    private func applyPrefs(_ value: JSONValue?) {
        prefs = value?.dictValue ?? [:]
        notifyOwner = prefs["business_notify_owner"]?.boolValue ?? true
        notifyAssigned = prefs["business_notify_assigned_member"]?.boolValue ?? false
    }

    func setNotifyOwner(_ on: Bool) async {
        notifyOwner = on
        await persistPrefs()
    }

    func setNotifyAssigned(_ on: Bool) async {
        notifyAssigned = on
        await persistPrefs()
    }

    private func persistPrefs() async {
        var merged = prefs
        merged["business_notify_owner"] = .bool(notifyOwner)
        merged["business_notify_assigned_member"] = .bool(notifyAssigned)
        do {
            let result: NotificationPreferencesResponse = try await client.request(
                SchedulingEndpoints.updateNotificationPreferences(
                    UpdateNotificationPreferencesRequest(prefs: .object(merged))
                )
            )
            applyPrefs(result.prefs)
            flashSaved()
        } catch {
            // Re-sync from the last known good prefs on failure.
            applyPrefs(.object(prefs))
        }
    }

    // MARK: Timezone

    func saveTimezone(_ identifier: String) async {
        guard identifier != timezone else { return }
        savingTimezone = true
        defer { savingTimezone = false }
        let previous = page
        do {
            let result: BookingPageResponse = try await client.request(
                SchedulingEndpoints.updateBookingPage(owner: owner, BookingPageUpdateRequest(timezone: identifier))
            )
            page = result.page
            flashSaved()
        } catch {
            page = previous
        }
    }

    private func flashSaved() {
        showSavedToast = true
        Task {
            try? await Task.sleep(nanoseconds: 1_800_000_000)
            showSavedToast = false
        }
    }

    // MARK: Navigation

    func openTimezone() {
        showTimezoneSheet = true
    }

    func openSchedulingDefaults() {
        push(.eventTypeList(owner: owner))
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

    // MARK: Representative defaults (per-service on the backend)

    private var majorityRequiresApproval: Bool {
        let flags = eventTypes.compactMap(\.requiresApproval)
        guard !flags.isEmpty else { return true }
        return flags.filter { $0 }.count * 2 >= flags.count
    }

    var minNoticeValue: String {
        mostCommon(eventTypes.compactMap(\.minNoticeMin)).map(Self.durationLabel) ?? "Set per service"
    }

    var horizonValue: String {
        guard let days = mostCommon(eventTypes.compactMap(\.maxHorizonDays)) else { return "Set per service" }
        return "\(days) days out"
    }

    var buffersValue: String {
        let before = mostCommon(eventTypes.compactMap(\.bufferBeforeMin)) ?? 0
        let after = mostCommon(eventTypes.compactMap(\.bufferAfterMin)) ?? 0
        if before == 0, after == 0 { return eventTypes.isEmpty ? "Set per service" : "None" }
        return "\(before) min before · \(after) after"
    }

    var cancellationValue: String {
        if let raw = page?.cancellationPolicy?.stringValue, !raw.isEmpty { return raw }
        if page?.cancellationPolicy?.dictValue != nil { return "Custom" }
        if let window = mostCommon(eventTypes.compactMap(\.cancellationWindowMin)), window > 0 {
            return "Flexible · \(Self.durationLabel(window))"
        }
        return eventTypes.isEmpty ? "Set per service" : "Flexible"
    }

    private func mostCommon(_ values: [Int]) -> Int? {
        guard !values.isEmpty else { return nil }
        let counts = Dictionary(values.map { ($0, 1) }, uniquingKeysWith: +)
        return counts.max { lhs, rhs in
            lhs.value == rhs.value ? lhs.key > rhs.key : lhs.value < rhs.value
        }?.key
    }

    static func durationLabel(_ minutes: Int) -> String {
        switch minutes {
        case let m where m % 1440 == 0: "\(m / 1440) day\(m / 1440 == 1 ? "" : "s")"
        case let m where m % 60 == 0: "\(m / 60) hour\(m / 60 == 1 ? "" : "s")"
        default: "\(minutes) min"
        }
    }
}
