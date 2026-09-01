//
//  EventTypeEditorViewModel.swift
//  Pantopus
//
//  Stream I2 — B2 Event Type / Service Editor. One Form view-model for create
//  (`POST /event-types`) and edit (`GET` then `PUT /event-types/:id`): basics,
//  colour swatch, durations, location, business assignment, advanced limits,
//  visibility toggles, and the flagged pricing card. Owner-polymorphic via
//  `SchedulingOwner`; 409 `SLUG_TAKEN` + 400 validation map back onto fields.
//

// swiftlint:disable file_length
import Observation
import SwiftUI

/// Single vs. multiple bookable durations.
enum DurationMode: String {
    case single
    case multiple
}

/// What the booker pays up front — the design `PricingCard` "Collect" segmented
/// (Full amount / Deposit). Deposit collects a partial amount at booking
/// (defaulting to half the price) with the balance settled later.
enum CollectMode: String, CaseIterable, Identifiable {
    case full
    case deposit

    var id: String {
        rawValue
    }

    var label: String {
        switch self {
        case .full: "Full amount"
        case .deposit: "Deposit"
        }
    }
}

@Observable
@MainActor
final class EventTypeEditorViewModel {
    enum Phase: Equatable {
        case loading
        case ready
        case error(message: String)
    }

    private(set) var phase: Phase = .loading

    // MARK: Editable state (View binds these directly)

    var name = ""
    var slug = ""
    var detailDescription = ""
    var swatch: EventTypeSwatch = .sky
    var durationMode: DurationMode = .single
    var durations = [30]
    var defaultDuration = 30
    var location: EventLocationMode = .video
    var locationDetail = ""
    var assignment: EventAssignmentMode = .oneOnOne
    var seatCap = 1
    var requiredHosts = 2
    var requiresApproval = false
    var visibilitySecret = false
    var isActiveField = true
    var advancedExpanded = false
    var bufferBeforeMin = 0
    var bufferAfterMin = 0
    var minNoticeHours = 0
    var maxHorizonDays = 60
    var dailyCap = 0
    var chargeEnabled = false
    var priceDollars = ""
    var currency = "USD"
    /// Design `PricingCard` "Collect" segmented — full amount vs. deposit.
    var collectMode: CollectMode = .full

    // MARK: Transient

    var slugManuallyEdited = false
    var slugError: String?
    var nameError: String?
    var durationError: String?
    var saveError: String?
    private(set) var isSaving = false
    private(set) var stripeConnected: Bool?
    /// Intake questions already attached to this event type — drives the
    /// design `LinksCard` "N questions" value on the link row. `nil` until the
    /// detail response lands (create mode never sets it).
    private(set) var questionCount: Int?

    // MARK: Dependencies

    let owner: SchedulingOwner
    let eventTypeId: String?
    private let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient
    private var scheduleId: String?
    private var baselineSignature = ""

    var isEditing: Bool {
        eventTypeId != nil
    }

    /// Full-width save-bar label — the design's "Create event type" (create) /
    /// "Save event type" (edit).
    var saveBarLabel: String {
        isEditing ? "Save event type" : "Create event type"
    }

    var showsAssignment: Bool {
        switch owner {
        case .business: true
        default: false
        }
    }

    var paidVisible: Bool {
        SchedulingFeatureFlags.paidEnabled && owner.supportsPayments
    }

    init(
        owner: SchedulingOwner,
        eventTypeId: String?,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient = .shared
    ) {
        self.owner = owner
        self.eventTypeId = eventTypeId
        self.push = push
        self.client = client
    }

    // MARK: Load

    func load() async {
        if case .ready = phase { return }
        guard let eventTypeId else {
            // Create — start from the backend's documented defaults.
            baselineSignature = signature()
            phase = .ready
            await loadPaymentsStatus()
            return
        }
        await fetch(id: eventTypeId)
    }

    func reload() async {
        guard let eventTypeId else { phase = .ready
            return
        }
        await fetch(id: eventTypeId)
    }

    private func fetch(id: String) async {
        phase = .loading
        do {
            let response: EventTypeDetailResponse = try await client.request(
                SchedulingEndpoints.getEventType(owner: owner, id: id)
            )
            apply(response.eventType)
            questionCount = response.questions?.count
            baselineSignature = signature()
            phase = .ready
            await loadPaymentsStatus()
        } catch let error as SchedulingError {
            phase = .error(message: error.userMessage ?? "Couldn't load this event type.")
        } catch {
            phase = .error(message: "Couldn't load this event type.")
        }
    }

    private func loadPaymentsStatus() async {
        guard paidVisible else { return }
        let status = try? await client.request(
            SchedulingEndpoints.paymentsStatus(owner: owner),
            as: PaymentsStatusDTO.self
        )
        stripeConnected = status?.chargesEnabled ?? status?.connected
    }

    // MARK: Field editing

    func updateName(_ value: String) {
        name = value
        nameError = nil
        if !slugManuallyEdited {
            slug = EventTypeFormat.slugify(value)
        }
    }

    func updateSlug(_ value: String) {
        slugManuallyEdited = true
        slug = value.lowercased().trimmingCharacters(in: .whitespaces)
        slugError = nil
    }

    func setSingleDuration(_ minutes: Int) {
        durations = [minutes]
        defaultDuration = minutes
        durationError = nil
    }

    func toggleDuration(_ minutes: Int) {
        durationError = nil
        if durations.contains(minutes) {
            guard durations.count > 1 else { return }
            durations.removeAll { $0 == minutes }
            if defaultDuration == minutes { defaultDuration = durations.min() ?? durations[0] }
        } else {
            durations = (durations + [minutes]).sorted()
        }
    }

    func setDefaultDuration(_ minutes: Int) {
        if !durations.contains(minutes) { durations = (durations + [minutes]).sorted() }
        defaultDuration = minutes
    }

    /// Chip tap: a selected length becomes the default, an unselected one is
    /// added to the offered set.
    func selectDuration(_ minutes: Int) {
        if durations.contains(minutes) {
            setDefaultDuration(minutes)
        } else {
            toggleDuration(minutes)
        }
    }

    func setDurationMode(_ mode: DurationMode) {
        durationMode = mode
        if mode == .single {
            let keep = durations.contains(defaultDuration) ? defaultDuration : (durations.first ?? 30)
            durations = [keep]
            defaultDuration = keep
        }
    }

    // MARK: Navigation handoffs

    func openIntakeQuestions() {
        guard let eventTypeId else { return }
        push(.intakeQuestionsEditor(owner: owner, eventTypeId: eventTypeId))
    }

    func openBookingLimits() {
        guard let eventTypeId else { return }
        push(.bookingLimits(owner: owner, eventTypeId: eventTypeId))
    }

    func openReminders() {
        push(.defaultReminders(owner: owner))
    }

    func openAvailability() {
        if let scheduleId {
            push(.weeklyHoursEditor(scheduleId: scheduleId))
        } else {
            push(.availabilityScheduleList)
        }
    }

    func connectStripe() {
        push(.paymentsSetup(owner: owner))
    }

    // MARK: Link-row values

    // The design `LinkRow` carries the field's CURRENT value under the label
    // ("2 questions", "Off", …) rather than a static description. These mirror
    // Android's `EventTypeEditorScreen` link-row values one-for-one.

    /// "2 questions" / "1 question" / "Add questions" while none are attached.
    var intakeQuestionsValue: String {
        guard let questionCount else { return "Add questions" }
        return questionCount == 1 ? "1 question" : "\(questionCount) questions"
    }

    /// "4h notice · 8/day", or "Off" when neither limit is set.
    var bookingLimitsValue: String {
        var parts: [String] = []
        if minNoticeHours > 0 { parts.append("\(minNoticeHours)h notice") }
        if dailyCap > 0 { parts.append("\(dailyCap)/day") }
        return parts.isEmpty ? "Off" : parts.joined(separator: " · ")
    }
}

// MARK: - Apply / validate / save

extension EventTypeEditorViewModel {
    /// Preset durations offered as chips in multiple-duration mode.
    static let durationPresets = [15, 30, 45, 60, 90, 120]

    var trimmedName: String {
        name.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var nameValid: Bool {
        !trimmedName.isEmpty
    }

    var slugValid: Bool {
        EventTypeFormat.isValidSlug(slug)
    }

    /// Backend bounds (scheduling.js `durations` Joi min 5 / max 1440) — one
    /// constant drives both the validation and the error copy so they can't
    /// drift apart again.
    static let durationBounds = 5...1440

    var durationsValid: Bool {
        !durations.isEmpty
            && durations.allSatisfy { Self.durationBounds.contains($0) }
            && durations.contains(defaultDuration)
    }

    var parsedPriceCents: Int? {
        // Shared locale-aware money parser (SchedulingMoney.parseCents): the
        // old trim-based cleanup only stripped LEADING/TRAILING separators, so
        // a comma-locale decimal ("120,50" from a de/fr keypad) survived into
        // Double(), failed, and silently disabled Save with no price error.
        // parseCents normalises the locale decimal separator, accepts ASCII
        // digits only, and clamps the scaled value so oversized input can
        // never trap `Int(_:)`.
        SchedulingMoney.parseCents(priceDollars)
    }

    var priceValid: Bool {
        !chargeEnabled || (parsedPriceCents.map { $0 > 0 } ?? false)
    }

    var formValid: Bool {
        nameValid && slugValid && durationsValid && priceValid
    }

    var isDirty: Bool {
        signature() != baselineSignature
    }

    private func apply(_ dto: EventTypeDTO) {
        name = dto.name
        slug = dto.slug
        slugManuallyEdited = true
        detailDescription = dto.description ?? ""
        swatch = EventTypeSwatch.match(dto.color)
        durations = dto.durations.isEmpty ? [30] : dto.durations.sorted()
        defaultDuration = dto.defaultDuration.flatMap { durations.contains($0) ? $0 : nil } ?? durations[0]
        durationMode = durations.count > 1 ? .multiple : .single
        location = EventLocationMode.from(dto.locationMode)
        locationDetail = dto.locationDetail ?? ""
        assignment = EventAssignmentMode.from(dto.assignmentMode)
        seatCap = dto.seatCap ?? 1
        requiresApproval = dto.requiresApproval ?? false
        visibilitySecret = dto.visibility == "secret"
        isActiveField = dto.isActive ?? true
        bufferBeforeMin = dto.bufferBeforeMin ?? 0
        bufferAfterMin = dto.bufferAfterMin ?? 0
        minNoticeHours = (dto.minNoticeMin ?? 0) / 60
        maxHorizonDays = dto.maxHorizonDays ?? 60
        dailyCap = dto.dailyCap ?? 0
        chargeEnabled = (dto.priceCents ?? 0) > 0
        priceDollars = chargeEnabled ? Self.dollarString(dto.priceCents ?? 0) : ""
        currency = dto.currency ?? "USD"
        collectMode = (dto.depositCents ?? 0) > 0 ? .deposit : .full
        scheduleId = dto.scheduleId
    }

    func signature() -> String {
        [
            trimmedName, slug, detailDescription, swatch.rawValue,
            durations.sorted().map(String.init).joined(separator: "-"), "\(defaultDuration)",
            location.rawValue, locationDetail, assignment.rawValue, "\(seatCap)",
            "\(requiresApproval)", "\(visibilitySecret)", "\(isActiveField)",
            "\(bufferBeforeMin)", "\(bufferAfterMin)", "\(minNoticeHours)", "\(maxHorizonDays)",
            "\(dailyCap)", "\(chargeEnabled)", priceDollars, currency, collectMode.rawValue
        ].joined(separator: "|")
    }

    /// Deposit collected at booking when `collectMode == .deposit` — half the
    /// price (rounded to the nearest cent). `nil` for the full-amount path.
    var depositCents: Int? {
        guard chargeEnabled, collectMode == .deposit, let cents = parsedPriceCents, cents > 0 else { return nil }
        return max(1, cents / 2)
    }

    /// Returns `true` when the save succeeded so the caller can pop the editor.
    func save() async -> Bool {
        guard !isSaving else { return false }
        guard validateBeforeSave() else { return false }
        isSaving = true
        defer { isSaving = false }
        do {
            if let eventTypeId {
                _ = try await client.request(
                    SchedulingEndpoints.updateEventType(owner: owner, id: eventTypeId, updateRequest()),
                    as: EventTypeResponse.self
                )
            } else {
                _ = try await client.request(
                    SchedulingEndpoints.createEventType(owner: owner, createRequest()),
                    as: EventTypeResponse.self
                )
            }
            baselineSignature = signature()
            return true
        } catch let error as SchedulingError {
            handle(error)
            return false
        } catch {
            saveError = "Couldn't save your event type."
            return false
        }
    }

    private func validateBeforeSave() -> Bool {
        nameError = nameValid ? nil : "Give this a name."
        slugError = slugValid ? nil : "Use lowercase letters, numbers and hyphens."
        durationError = durationsValid
            ? nil
            : "Enter a length between \(Self.durationBounds.lowerBound) and \(Self.durationBounds.upperBound) minutes."
        return formValid
    }

    private func handle(_ error: SchedulingError) {
        switch error.code {
        case "SLUG_TAKEN":
            slugError = "That booking link is taken. Try another."
        default:
            for detail in error.validationDetails {
                switch detail.field {
                case "slug": slugError = detail.message ?? "Check this link."
                case "name": nameError = detail.message ?? "Check this name."
                case "durations", "default_duration": durationError = detail.message
                default: break
                }
            }
            if error.validationDetails.isEmpty {
                saveError = error.userMessage ?? "Couldn't save your event type."
            }
        }
    }

    private var normalizedDurations: [Int] {
        let unique = Array(Set(durations)).sorted()
        return unique.isEmpty ? [defaultDuration] : unique
    }

    private var resolvedDefault: Int {
        normalizedDurations.contains(defaultDuration) ? defaultDuration : normalizedDurations[0]
    }

    private func createRequest() -> CreateEventTypeRequest {
        CreateEventTypeRequest(
            name: trimmedName,
            slug: slug,
            description: detailDescription.isEmpty ? nil : detailDescription,
            color: swatch.hex,
            durations: normalizedDurations,
            defaultDuration: resolvedDefault,
            locationMode: location.rawValue,
            locationDetail: locationDetail.isEmpty ? nil : locationDetail,
            assignmentMode: showsAssignment ? assignment.rawValue : nil,
            requiresApproval: requiresApproval,
            visibility: visibilitySecret ? "secret" : "public",
            bufferBeforeMin: bufferBeforeMin,
            bufferAfterMin: bufferAfterMin,
            minNoticeMin: minNoticeHours * 60,
            maxHorizonDays: maxHorizonDays,
            seatCap: seatCap,
            priceCents: chargeEnabled ? parsedPriceCents : 0,
            currency: currency.uppercased(),
            depositCents: depositCents
        )
    }

    private func updateRequest() -> UpdateEventTypeRequest {
        UpdateEventTypeRequest(
            name: trimmedName,
            slug: slug,
            description: detailDescription,
            color: swatch.hex,
            durations: normalizedDurations,
            defaultDuration: resolvedDefault,
            locationMode: location.rawValue,
            locationDetail: locationDetail,
            assignmentMode: showsAssignment ? assignment.rawValue : nil,
            requiresApproval: requiresApproval,
            visibility: visibilitySecret ? "secret" : "public",
            bufferBeforeMin: bufferBeforeMin,
            bufferAfterMin: bufferAfterMin,
            minNoticeMin: minNoticeHours * 60,
            maxHorizonDays: maxHorizonDays,
            dailyCap: dailyCap == 0 ? nil : dailyCap,
            seatCap: seatCap,
            priceCents: chargeEnabled ? parsedPriceCents : 0,
            currency: currency.uppercased(),
            depositCents: depositCents,
            isActive: isActiveField
        )
    }

    static func dollarString(_ cents: Int) -> String {
        cents % 100 == 0 ? "\(cents / 100)" : String(format: "%.2f", Double(cents) / 100)
    }
}
