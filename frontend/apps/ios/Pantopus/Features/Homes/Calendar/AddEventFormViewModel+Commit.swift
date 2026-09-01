//
//  AddEventFormViewModel+Commit.swift
//  Pantopus
//
//  P2.7 — Commit helpers + static parsing for `AddEventFormViewModel`.
//  Pulled out into an extension so the host file stays inside SwiftLint's
//  type-length budget. Behaviour and visibility are identical to the
//  inline equivalents.
//

import Foundation

extension AddEventFormViewModel {
    // MARK: - Commit

    func commitCreate() async -> Bool {
        setSaving(true)
        defer { setSaving(false) }
        let request = buildCreateRequest()
        do {
            let response: HomeEventResponse = try await api.request(
                HomesEndpoints.createHomeEvent(homeId: homeId, request: request)
            )
            recordCreated(eventId: response.event.id)
            return true
        } catch {
            recordCommitError(error, isUpdate: false)
            return false
        }
    }

    func commitUpdate(eventId: String) async -> Bool {
        setSaving(true)
        defer { setSaving(false) }
        let request = buildUpdateRequest()
        do {
            _ = try await api.request(
                HomesEndpoints.updateHomeEvent(
                    homeId: homeId,
                    eventId: eventId,
                    request: request
                )
            ) as HomeEventResponse
            recordUpdated(eventId: eventId)
            return true
        } catch {
            recordCommitError(error, isUpdate: true)
            return false
        }
    }

    // MARK: - Validation

    func validator(for field: AddEventField) -> FormValidator {
        switch field {
        case .title:
            Self.titleValidator
        case .location:
            FormValidator { _ in nil }
        case .notes:
            .maxLength(2000)
        }
    }

    /// Force-validate all fields; returns true when **all** field-level
    /// validators + the end-date relationship pass.
    func validateAll() -> Bool {
        var allValid = true
        for field in AddEventField.allCases {
            guard var snapshot = fields[field] else { continue }
            let message = validator(for: field).validate(snapshot.value)
            snapshot.error = message
            snapshot.touched = true
            fields[field] = snapshot
            if message != nil { allValid = false }
        }
        if let end = endDate, end < startDate { allValid = false }
        return allValid
    }

    // MARK: - Request shaping

    private func buildCreateRequest() -> CreateHomeEventRequest {
        let title = (fields[.title]?.value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let location = nilIfEmpty((fields[.location]?.value ?? "").trimmingCharacters(in: .whitespacesAndNewlines))
        let notes = nilIfEmpty((fields[.notes]?.value ?? "").trimmingCharacters(in: .whitespacesAndNewlines))
        let assignedIds = sortedAttendeeIds()
        return CreateHomeEventRequest(
            eventType: category.rawValue,
            title: title,
            startAt: Self.iso8601(from: startDate, allDay: allDay),
            description: notes,
            endAt: allDay ? nil : endDate.map { Self.iso8601(from: $0, allDay: false) },
            locationNotes: location,
            recurrenceRule: recurrence.rrule,
            assignedTo: assignedIds.isEmpty ? nil : assignedIds,
            alertsEnabled: !reminderOffsets.isEmpty,
            requestRsvp: requestRsvp,
            reminders: Self.remindersJSON(from: reminderOffsets)
        )
    }

    private func buildUpdateRequest() -> UpdateHomeEventRequest {
        let title = (fields[.title]?.value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let location = nilIfEmpty((fields[.location]?.value ?? "").trimmingCharacters(in: .whitespacesAndNewlines))
        let notes = nilIfEmpty((fields[.notes]?.value ?? "").trimmingCharacters(in: .whitespacesAndNewlines))
        let assignedIds = sortedAttendeeIds()
        return UpdateHomeEventRequest(
            eventType: category.rawValue,
            title: title,
            description: notes ?? "",
            startAt: Self.iso8601(from: startDate, allDay: allDay),
            endAt: allDay ? "" : (endDate.map { Self.iso8601(from: $0, allDay: false) } ?? ""),
            locationNotes: location ?? "",
            recurrenceRule: recurrence.rrule ?? "",
            assignedTo: assignedIds,
            alertsEnabled: !reminderOffsets.isEmpty,
            requestRsvp: requestRsvp,
            reminders: Self.remindersJSON(from: reminderOffsets)
        )
    }

    private func sortedAttendeeIds() -> [String] {
        attendees.map(\.id).filter(selectedAttendeeIds.contains)
    }

    private func nilIfEmpty(_ value: String) -> String? {
        value.isEmpty ? nil : value
    }

    // MARK: - Static helpers

    /// Bucket validator used internally + for hydration round-tripping.
    /// The required-message matches the design's invalid-frame helper
    /// ("Add a title to save this event" — `add-event-frames.jsx:101`).
    static let titleValidator: FormValidator = .all([
        FormValidator { value in
            value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                ? "Add a title to save this event"
                : nil
        },
        .maxLength(120)
    ])

    /// Default start time when creating an event from scratch — the next
    /// quarter-hour, on today's day.
    static func defaultStart(from now: Date) -> Date {
        let cal = Calendar.current
        var comps = cal.dateComponents([.year, .month, .day, .hour, .minute], from: now)
        let minute = comps.minute ?? 0
        let rounded = ((minute / 15) + 1) * 15
        if rounded >= 60 {
            comps.hour = (comps.hour ?? 0) + 1
            comps.minute = 0
        } else {
            comps.minute = rounded
        }
        return cal.date(from: comps) ?? now
    }

    /// Backend stores all-day events as midnight UTC + nil end.
    static func isAllDayHeuristic(start: Date, end: Date?, endIso: String?) -> Bool {
        let cal = utcCalendar()
        let parts = cal.dateComponents([.hour, .minute, .second], from: start)
        let startIsMidnight = (parts.hour ?? 0) == 0 && (parts.minute ?? 0) == 0 && (parts.second ?? 0) == 0
        return startIsMidnight && end == nil && endIso == nil
    }

    /// ISO-8601 instant in UTC. For all-day events the time portion is
    /// 00:00:00 so the agenda's all-day heuristic recognises it.
    static func iso8601(from date: Date, allDay: Bool) -> String {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime]
        let stamp: Date = if allDay {
            utcCalendar().startOfDay(for: date)
        } else {
            date
        }
        return fmt.string(from: stamp)
    }

    private static func utcCalendar() -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        if let utc = TimeZone(secondsFromGMT: 0) {
            calendar.timeZone = utc
        }
        return calendar
    }

    static func parseIsoInstant(_ iso: String) -> Date? {
        let withFrac = ISO8601DateFormatter()
        withFrac.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = withFrac.date(from: iso) { return d }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        if let d = plain.date(from: iso) { return d }
        let dayFmt = DateFormatter()
        dayFmt.locale = Locale(identifier: "en_US_POSIX")
        dayFmt.timeZone = TimeZone(identifier: "UTC")
        dayFmt.dateFormat = "yyyy-MM-dd"
        return dayFmt.date(from: iso)
    }

    /// Project a household occupant into the attendee picker row shape.
    static func buildAttendee(from occupant: OccupantDTO) -> AddEventAttendee {
        let trimmed = occupant.displayName?.trimmingCharacters(in: .whitespaces) ?? ""
        let name = trimmed.isEmpty
            ? (occupant.username ?? "Member")
            : (occupant.displayName ?? trimmed)
        return AddEventAttendee(
            id: occupant.userId,
            displayName: name,
            initials: initials(from: name)
        )
    }

    static func initials(from name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        let chars = parts.compactMap { $0.first.map(String.init) }
        return chars.joined().uppercased()
    }

    // MARK: - Reminders (Stream I10)

    /// Serialize the selected lead-times to the `reminders` jsonb array as
    /// minutes-before integers (ascending). `nil` when none are set so the
    /// field is omitted from the request.
    static func remindersJSON(from offsets: Set<AddEventReminderOffset>) -> [JSONValue]? {
        guard !offsets.isEmpty else { return nil }
        return offsets
            .map(\.rawValue)
            .sorted()
            .map { JSONValue.number(Double($0)) }
    }

    /// Parse the `reminders` jsonb array back into lead-times for edit
    /// hydration. Falls back to a single 10-minute reminder when the array is
    /// absent but `alerts_enabled` is set (legacy events).
    static func reminderOffsets(
        from reminders: [JSONValue]?,
        alertsEnabled: Bool
    ) -> Set<AddEventReminderOffset> {
        if let reminders, !reminders.isEmpty {
            let parsed = reminders.compactMap { value -> AddEventReminderOffset? in
                guard let minutes = value.numberValue.map({ Int($0) }) else { return nil }
                return AddEventReminderOffset(rawValue: minutes)
            }
            if !parsed.isEmpty { return Set(parsed) }
        }
        return alertsEnabled ? [.tenMin] : []
    }
}
