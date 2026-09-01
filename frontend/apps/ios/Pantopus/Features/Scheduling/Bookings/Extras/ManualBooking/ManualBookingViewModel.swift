//
//  ManualBookingViewModel.swift
//  Pantopus
//
//  Stream I9 — E12 Manual / On-Behalf Booking. A 4-step wizard (Event · Time ·
//  Details · Review → Created) driving `WizardShell`. Event types come from
//  `GET /event-types`; step-2 availability reuses the owner's public booking
//  page (`GET /booking-page` slug → `GET /book/:slug/:eventTypeSlug/slots`)
//  since there is no host "new-booking" slots endpoint. Create posts the
//  owner-scoped `POST /bookings`; a 409 surfaces the Foundation SlotTakenSheet,
//  and a client-side overlap pre-check surfaces the advisory Double-Book warning
//  (E10). Neighbor search + skip-approval/notifications are not backed by the
//  create API (documented gaps) — the invitee form posts name + contact.
//

// swiftlint:disable type_body_length

import Observation
import SwiftUI

@Observable
@MainActor
final class ManualBookingViewModel: WizardModel {
    enum Step: Int, Equatable { case eventType = 1, time, details, review, created }
    enum LoadPhase: Equatable { case loading, loaded, error(String) }
    enum ContactMode: Equatable { case email, phone }

    /// Whether the name typed in the invitee search field resolved to a
    /// verified Pantopus directory member or is an unregistered contact.
    /// Defaults to `.unregistered` (the invite-by flow). A future directory
    /// search API should set this to `.verified(neighborLabel:)` when the
    /// query returns a confirmed match — at that point the view will show the
    /// accent card instead of the "Invite by" selector.
    enum InviteeResolutionState: Equatable {
        /// Name resolved to a verified Pantopus user. `neighborLabel` is
        /// the design's "Verified neighbor · Riverside" subtitle line.
        case verified(neighborLabel: String)
        /// Name not found on Pantopus — show the info banner + invite flow.
        case unregistered
    }

    let owner: SchedulingOwner
    let push: @MainActor (SchedulingRoute) -> Void
    let tz = SchedulingTime.deviceTimeZoneIdentifier

    /// Friendly timezone name for the step-2 chip ("Times in Pacific Time"),
    /// matching the design's "Times in Pacific" rather than the raw IANA id.
    /// (Changing the timezone is not yet supported, so the design's
    /// "· tap to change" affordance is deferred.)
    var tzLabel: String {
        guard let zone = TimeZone(identifier: tz) else { return tz }
        return zone.localizedName(for: .generic, locale: .current) ?? tz
    }

    private(set) var step: Step = .eventType
    var shouldDismiss = false

    // Step 1 — event type
    private(set) var eventTypesPhase: LoadPhase = .loading
    private(set) var eventTypes: [EventTypeDTO] = []
    var selectedEventTypeId: String?

    // Step 2 — time
    private(set) var availabilityPhase: LoadPhase = .loading
    private(set) var slots: [SlotDTO] = []
    private var pageSlug: String?
    var selectedSlotStart: String?
    var selectedDay = Calendar.current.startOfDay(for: Date())

    /// Step 3 — details
    var inviteeName = ""
    /// Resolution state for the invitee search — drives whether the verified
    /// card (Frame 3) or the info banner + invite-by flow (Frame 4) is shown.
    var inviteeResolution: InviteeResolutionState = .unregistered
    var contactMode: ContactMode = .email
    var inviteeEmail = ""
    var inviteePhone = ""
    var note = ""

    // Step 4 — review (toggles are visual; the create API accepts neither —
    // booking approval follows the event type's requires_approval).
    var skipApproval = false
    var skipNotifications = false

    // Create
    private(set) var isCreating = false
    var createError: String?
    private(set) var createdBookingId: String?
    var slotConflictAlternatives: [SchedulingSlotAlternative] = []
    var showSlotTaken = false
    var doubleBookConflict: DoubleBookConflict?
    var showDoubleBook = false

    private let client: SchedulingClient

    init(
        owner: SchedulingOwner,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.owner = owner
        self.push = push
        self.client = client
    }

    var selectedEventType: EventTypeDTO? {
        eventTypes.first { $0.id == selectedEventTypeId }
    }

    var identity: WizardIdentity {
        owner.theme.identity
    }

    // MARK: WizardModel chrome

    var chrome: WizardChrome {
        if step == .created {
            return WizardChrome(
                title: "Book someone in",
                progressLabel: .hidden,
                progressFraction: nil,
                leading: .close,
                primaryCTALabel: "View booking",
                primaryCTAEnabled: true,
                primaryCTAIdentifier: "manualBooking.viewBooking",
                secondaryCTA: WizardSecondaryCTA(label: "Book another", identifier: "manualBooking.bookAnother"),
                isSubmitting: false,
                dirty: false,
                showsProgressBar: false
            )
        }
        // The design replaces the generic N/4 readout + segmented bar with a
        // named StepRail rendered in the wizard content (see ManualBookingView
        // `stepRail`); suppress the shell's progress chrome so the rail is the
        // sole step indicator.
        return WizardChrome(
            title: "Book someone in",
            progressLabel: .hidden,
            progressFraction: nil,
            leading: step == .eventType ? .close : .back,
            primaryCTALabel: primaryLabel,
            primaryCTAEnabled: primaryEnabled,
            primaryCTAIdentifier: "manualBooking.continue",
            isSubmitting: isCreating,
            dirty: selectedEventTypeId != nil,
            showsProgressBar: false
        )
    }

    /// The named step-rail model (reschedule-frames StepRail: Event · Time ·
    /// Details · Review). The active step is filled; completed steps show a
    /// check; the active label is shown inline.
    var stepRailSteps: [(index: Int, title: String, isCurrent: Bool, isDone: Bool)] { // swiftlint:disable:this large_tuple
        let titles = ["Event", "Time", "Details", "Review"]
        return titles.enumerated().map { offset, title in
            let idx = offset + 1
            return (index: idx, title: title, isCurrent: idx == step.rawValue, isDone: idx < step.rawValue)
        }
    }

    private var primaryLabel: String {
        if step == .review { return "Create booking" }
        if step == .time, case .error = availabilityPhase { return "Try again" }
        return "Continue"
    }

    private var primaryEnabled: Bool {
        switch step {
        case .eventType: selectedEventTypeId != nil
        case .time:
            if case .error = availabilityPhase { true } else { selectedSlotStart != nil }
        case .details: isDetailsValid
        case .review: !isCreating
        case .created: true
        }
    }

    var isDetailsValid: Bool {
        !inviteeName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    // MARK: WizardModel actions

    func leadingTapped() {
        switch step {
        case .eventType: shouldDismiss = true
        case .time: step = .eventType
        case .details: step = .time
        case .review: step = .details
        case .created: shouldDismiss = true
        }
    }

    func discardConfirmed() {
        shouldDismiss = true
    }

    func primaryTapped() {
        switch step {
        case .eventType:
            guard selectedEventTypeId != nil else { return }
            step = .time
            Task { await loadSlots() }
        case .time:
            if case .error = availabilityPhase {
                Task { await loadSlots() }
            } else if selectedSlotStart != nil {
                step = .details
            }
        case .details:
            if isDetailsValid { step = .review }
        case .review:
            Task { await attemptCreate() }
        case .created:
            viewBooking()
        }
    }

    func secondaryTapped() {
        guard step == .created else { return }
        resetForAnother()
    }

    // MARK: Loading

    func load() async {
        if eventTypes.isEmpty { await loadEventTypes() }
    }

    private func loadEventTypes() async {
        eventTypesPhase = .loading
        do {
            let response: EventTypesResponse = try await client.request(SchedulingEndpoints.getEventTypes(owner: owner))
            eventTypes = response.eventTypes.filter { $0.isActive ?? true }
            eventTypesPhase = .loaded
        } catch let error as SchedulingError {
            eventTypesPhase = .error(error.userMessage ?? "Couldn't load event types")
        } catch {
            eventTypesPhase = .error("Couldn't load event types")
        }
    }

    func loadSlots() async {
        guard let eventType = selectedEventType else { return }
        availabilityPhase = .loading
        selectedSlotStart = nil
        do {
            let slug = try await resolveSlug()
            let calendar = tzCalendar()
            let from = isoDay(calendar.startOfDay(for: Date()))
            let to = isoDay(calendar.date(byAdding: .day, value: 14, to: Date()) ?? Date())
            let response: PublicSlotsResponse = try await client.request(
                SchedulingPublicEndpoints.slots(slug: slug, eventTypeSlug: eventType.slug, from: from, to: to, tz: tz)
            )
            slots = response.slots
            if let firstDay = slots.compactMap({ slotDay($0) }).min() {
                selectedDay = firstDay
            }
            availabilityPhase = .loaded
        } catch let error as SchedulingError {
            availabilityPhase = .error(error.userMessage ?? "Couldn't load availability")
        } catch {
            availabilityPhase = .error("Couldn't load availability")
        }
    }

    private func resolveSlug() async throws -> String {
        if let pageSlug { return pageSlug }
        let response: BookingPageResponse = try await client.request(SchedulingEndpoints.getBookingPage(owner: owner))
        pageSlug = response.page.slug
        return response.page.slug
    }

    // MARK: Day strip / slot helpers

    var dayStrip: [Date] {
        let calendar = tzCalendar()
        let start = calendar.startOfDay(for: Date())
        return (0..<7).compactMap { calendar.date(byAdding: .day, value: $0, to: start) }
    }

    var slotsForSelectedDay: [SlotDTO] {
        let calendar = tzCalendar()
        return slots.filter { slot in
            guard let day = slotDay(slot) else { return false }
            return calendar.isDate(day, inSameDayAs: selectedDay)
        }
    }

    func slotTimeLabel(_ slot: SlotDTO) -> String {
        let startText = SchedulingTime.localString(utcISO: slot.start, tz: tz, dateStyle: .none, timeStyle: .short) ?? ""
        let endText = SchedulingTime.localString(utcISO: slot.end, tz: tz, dateStyle: .none, timeStyle: .short) ?? ""
        return endText.isEmpty ? startText : "\(startText) – \(endText)"
    }

    private func slotDay(_ slot: SlotDTO) -> Date? {
        guard let date = SchedulingTime.parseUTC(slot.start) else { return nil }
        return tzCalendar().startOfDay(for: date)
    }

    private func tzCalendar() -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: tz) ?? .current
        return calendar
    }

    private func isoDay(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: tz) ?? .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    // MARK: Create

    private func attemptCreate() async {
        if let conflict = await overlapConflict() {
            doubleBookConflict = conflict
            showDoubleBook = true
            return
        }
        await create()
    }

    func bookAnyway() async {
        showDoubleBook = false
        await create()
    }

    func selectAlternative(_ alternative: SchedulingSlotAlternative) {
        selectedSlotStart = alternative.start
        showSlotTaken = false
        Task { await create() }
    }

    func dismissSlotTaken() {
        showSlotTaken = false
        step = .time
    }

    private func create() async {
        guard let eventTypeId = selectedEventTypeId, let start = selectedSlotStart else { return }
        isCreating = true
        createError = nil
        defer { isCreating = false }
        let trimmedName = inviteeName.trimmingCharacters(in: .whitespacesAndNewlines)
        let request = CreateBookingRequest(
            eventTypeId: eventTypeId,
            startAt: start,
            inviteeName: trimmedName.isEmpty ? nil : trimmedName,
            inviteeEmail: contactMode == .email ? nonEmpty(inviteeEmail) : nil,
            inviteePhone: contactMode == .phone ? nonEmpty(inviteePhone) : nil,
            inviteeTimezone: tz
        )
        do {
            let response: BookingResponse = try await client.request(
                SchedulingEndpoints.createBooking(owner: owner, request)
            )
            createdBookingId = response.booking.id
            step = .created
        } catch let error as SchedulingError {
            if case let .slotConflict(_, _, alternatives) = error {
                slotConflictAlternatives = alternatives
                showSlotTaken = true
            } else {
                createError = error.userMessage ?? "Couldn't create the booking"
            }
        } catch {
            createError = "Couldn't create the booking"
        }
    }

    /// Best-effort advisory overlap check against the owner's upcoming bookings.
    private func overlapConflict() async -> DoubleBookConflict? {
        guard let start = selectedSlotStart,
              let slot = slots.first(where: { $0.start == start }),
              let startDate = SchedulingTime.parseUTC(slot.start),
              let endDate = SchedulingTime.parseUTC(slot.end)
        else { return nil }
        do {
            let response: BookingsResponse = try await client.request(
                SchedulingEndpoints.getBookings(owner: owner, status: "upcoming")
            )
            for booking in response.bookings where booking.status == "confirmed" || booking.status == "pending" {
                guard let existingStart = SchedulingTime.parseUTC(booking.startAt ?? ""),
                      let existingEnd = SchedulingTime.parseUTC(booking.endAt ?? "")
                else { continue }
                if existingStart < endDate, startDate < existingEnd {
                    let detail = SchedulingTime.localString(
                        date: existingStart, tz: tz, dateStyle: .none, timeStyle: .short
                    ) ?? "Existing booking"
                    return DoubleBookConflict(
                        severity: .soft,
                        title: "This time overlaps",
                        message: "You already have a booking that overlaps this time.",
                        linkedEvent: .init(title: booking.inviteeName ?? "Existing booking", detail: "\(detail) · this calendar")
                    )
                }
            }
        } catch {
            return nil // advisory only — never block on the pre-check
        }
        return nil
    }

    private func viewBooking() {
        if let id = createdBookingId {
            push(.bookingDetail(owner: owner, bookingId: id))
        }
        shouldDismiss = true
    }

    private func resetForAnother() {
        step = .eventType
        selectedEventTypeId = nil
        selectedSlotStart = nil
        slots = []
        availabilityPhase = .loading
        inviteeName = ""
        inviteeResolution = .unregistered
        inviteeEmail = ""
        inviteePhone = ""
        note = ""
        createdBookingId = nil
        createError = nil
    }

    private func nonEmpty(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
