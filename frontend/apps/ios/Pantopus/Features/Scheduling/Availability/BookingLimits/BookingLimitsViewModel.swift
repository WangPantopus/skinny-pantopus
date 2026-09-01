//
//  BookingLimitsViewModel.swift
//  Pantopus
//
//  Stream I3 — B7 Booking Limits & Notice Rules (sheet). Booking limits live
//  on the EVENT TYPE (not the schedule), so this reads `GET /event-types/:id`
//  and saves the limit/notice subset via the partial `PUT /event-types/:id`.
//  Owner-scoped (personal sky by default, or the event type's pillar when
//  opened as a per-type override from I2).
//
//  Per the design these are always-present numeric steppers (no on/off
//  toggles). Saving is PER-FIELD-DIRTY: only the fields the user actually
//  changed are put in the request body, so (a) opening the sheet to tweak one
//  control can't silently rewrite an untouched value the UI can't faithfully
//  represent (a sub-hour `min_notice_min` or a non-60/30/15 `slot_interval_min`),
//  and (b) a freshly-created event type with no cap (null) isn't given a cap
//  just because the stepper shows a default — we only send a cap once the user
//  moves it.
//
//  NOTE: the design also shows a weekly cap ("20 per week"), but the backend
//  has no weekly-cap field (only daily_cap + per_booker_cap), so it is omitted
//  — flagged for a backend follow-up.
//

import Observation
import SwiftUI

/// Slot-granularity options for the "Start times" control.
enum SlotInterval: Int, CaseIterable, Identifiable {
    case everyHour = 60
    case halfHour = 30
    case every15 = 15

    var id: Int {
        rawValue
    }

    var label: String {
        switch self {
        case .everyHour: ":00 only"
        case .halfHour: ":00 & :30"
        case .every15: "every 15 min"
        }
    }

    static func from(minutes: Int?) -> SlotInterval {
        switch minutes {
        case 60: .everyHour
        case 30: .halfHour
        default: .every15
        }
    }
}

@Observable
@MainActor
final class BookingLimitsViewModel {
    enum Phase {
        case loading
        case ready
        case error(message: String)
    }

    private(set) var phase: Phase = .loading

    let owner: SchedulingOwner
    let eventTypeId: String

    // Editable fields (always-present steppers, per the design).
    var minNoticeHours = 4
    var horizonDays = 60
    var dailyCap = 8
    var perBookerCap = 2
    var slotInterval: SlotInterval = .every15

    var eventTypeName = ""
    private(set) var isSaving = false
    var saveError: String?

    private let client: SchedulingClient
    private var baselineSignature: String?

    // Raw loaded values + the stepper values shown at load, so per-field-dirty
    // save never clobbers an untouched value (and never imposes a cap the
    // backend didn't have). Notice/interval MUST be compared against the
    // value-shown-at-load (initial*) rather than the raw wire value — the UI
    // projection is lossy (90 min rounds to 2 h; a 20-min interval snaps to
    // the 15-min chip), so comparing the re-derived value to the raw one made
    // untouched fields look dirty and silently rewrote them server-side.
    private var loadedMinNoticeMin: Int?
    private var loadedHorizonDays: Int?
    private var loadedSlotIntervalMin: Int?
    private var initialMinNoticeHours = 4
    private var initialSlotInterval: SlotInterval = .every15
    private var initialDailyCap = 8
    private var initialPerBookerCap = 2

    init(owner: SchedulingOwner, eventTypeId: String, client: SchedulingClient = .shared) {
        self.owner = owner
        self.eventTypeId = eventTypeId
        self.client = client
    }

    // MARK: Derived

    /// The booking window can't be shorter than the minimum notice, or no
    /// times would ever show.
    var windowConflict: Bool {
        minNoticeHours > horizonDays * 24
    }

    var isValid: Bool {
        !windowConflict
    }

    var isDirty: Bool {
        signature() != baselineSignature
    }

    var canSave: Bool {
        isValid && isDirty && !isSaving
    }

    // MARK: Load

    func load() async {
        if case .ready = phase { return }
        await fetch()
    }

    func reload() async {
        await fetch()
    }

    private func fetch() async {
        phase = .loading
        do {
            let detail: EventTypeDetailResponse = try await client.request(
                SchedulingEndpoints.getEventType(owner: owner, id: eventTypeId)
            )
            apply(detail.eventType)
            baselineSignature = signature()
            phase = .ready
        } catch let error as SchedulingError {
            phase = .error(message: error.userMessage ?? "Couldn't load these limits.")
        } catch {
            phase = .error(message: "Couldn't load these limits.")
        }
    }

    private func apply(_ eventType: EventTypeDTO) {
        eventTypeName = eventType.name
        loadedMinNoticeMin = eventType.minNoticeMin
        loadedHorizonDays = eventType.maxHorizonDays
        loadedSlotIntervalMin = eventType.slotIntervalMin

        // Round (not truncate) so a 90-min notice reads as ~2h rather than 1h.
        if let notice = eventType.minNoticeMin {
            minNoticeHours = max(0, Int((Double(notice) / 60).rounded()))
        }
        if let horizon = eventType.maxHorizonDays { horizonDays = max(1, horizon) }
        if let cap = eventType.dailyCap { dailyCap = max(1, cap) }
        if let cap = eventType.perBookerCap { perBookerCap = max(1, cap) }
        slotInterval = SlotInterval.from(minutes: eventType.slotIntervalMin)

        initialMinNoticeHours = minNoticeHours
        initialSlotInterval = slotInterval
        initialDailyCap = dailyCap
        initialPerBookerCap = perBookerCap
    }

    // MARK: Save

    /// Returns true on a successful save so the View can dismiss. Builds the
    /// request from only the fields the user changed.
    func save() async -> Bool {
        guard canSave else { return false }
        isSaving = true
        defer { isSaving = false }

        var request = UpdateEventTypeRequest()
        var hasChanges = false

        // Compare against the value SHOWN at load (not the raw wire value):
        // the hour/chip projection is lossy, so re-deriving minutes from an
        // untouched stepper can differ from the server value (90 → 2 h → 120)
        // and must not count as a user change.
        if minNoticeHours != initialMinNoticeHours {
            request.minNoticeMin = minNoticeHours * 60
            hasChanges = true
        }
        if horizonDays != loadedHorizonDays {
            request.maxHorizonDays = horizonDays
            hasChanges = true
        }
        if slotInterval != initialSlotInterval {
            request.slotIntervalMin = slotInterval.rawValue
            hasChanges = true
        }
        // Only send a cap once the user moves it off the value shown at load —
        // so a freshly-created event type (no cap) isn't capped by default.
        if dailyCap != initialDailyCap {
            request.dailyCap = dailyCap
            hasChanges = true
        }
        if perBookerCap != initialPerBookerCap {
            request.perBookerCap = perBookerCap
            hasChanges = true
        }

        do {
            if hasChanges {
                _ = try await client.request(
                    SchedulingEndpoints.updateEventType(owner: owner, id: eventTypeId, request),
                    as: EventTypeResponse.self
                )
            }
            // Advance the raw baselines only for fields we actually sent —
            // untouched lossy values stay at the server's truth.
            if let sent = request.minNoticeMin { loadedMinNoticeMin = sent }
            if let sent = request.slotIntervalMin { loadedSlotIntervalMin = sent }
            loadedHorizonDays = horizonDays
            initialMinNoticeHours = minNoticeHours
            initialSlotInterval = slotInterval
            initialDailyCap = dailyCap
            initialPerBookerCap = perBookerCap
            baselineSignature = signature()
            return true
        } catch let error as SchedulingError {
            saveError = error.userMessage ?? "Couldn't save these limits."
            return false
        } catch {
            saveError = "Couldn't save these limits."
            return false
        }
    }

    private func signature() -> String {
        [
            String(minNoticeHours),
            String(horizonDays),
            String(dailyCap),
            String(perBookerCap),
            String(slotInterval.rawValue)
        ].joined(separator: "|")
    }
}
