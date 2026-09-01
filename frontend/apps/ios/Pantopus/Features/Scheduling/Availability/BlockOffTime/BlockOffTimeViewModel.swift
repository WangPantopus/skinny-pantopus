//
//  BlockOffTimeViewModel.swift
//  Pantopus
//
//  Stream I3 — B9 Block Off Time / Personal busy override (sheet). The host's
//  quick "+ Busy time" action — drops an ad-hoc busy hold onto personal
//  availability so the engine stops offering that window. Creates a block via
//  `POST /api/scheduling/availability/blocks` (absolute ISO start/end +
//  optional RRULE). It does NOT create a bookable event. Personal only.
//

import Observation
import SwiftUI

/// Recurrence options for a busy hold.
enum BlockRepeat: String, CaseIterable, Identifiable {
    case never
    case daily
    case weekly
    case monthly

    var id: String {
        rawValue
    }

    var label: String {
        switch self {
        case .never: "Does not repeat"
        case .daily: "Daily"
        case .weekly: "Weekly"
        case .monthly: "Monthly"
        }
    }

    /// The RRULE the backend stores (nil = one-off).
    var rrule: String? {
        switch self {
        case .never: nil
        case .daily: "FREQ=DAILY"
        case .weekly: "FREQ=WEEKLY"
        case .monthly: "FREQ=MONTHLY"
        }
    }
}

/// A detected booking-overlap warning. Best-effort: the hold never cancels a
/// confirmed booking, so this only warns. Carries the conflicting booking id so
/// the "View booking" link can route to its detail (mirrors Android's
/// `BlockConflict`).
struct BlockConflictWarning: Equatable {
    /// Human label for the conflicting booking, e.g. "confirmed 2:30 PM booking".
    let bookingLabel: String
    /// The overlapping booking's id, for the "View booking" affordance.
    let bookingId: String
}

@Observable
@MainActor
final class BlockOffTimeViewModel {
    // Editable fields. Mutating the window or date re-runs best-effort overlap
    // detection (mirrors Android's checkConflict() on setStart/setEnd/setDate).
    var reason = ""
    var date = Date() {
        didSet { scheduleConflictCheck() }
    }

    var allDay = false {
        didSet {
            if allDay { conflict = nil } else { scheduleConflictCheck() }
        }
    }

    var startTime = TimeOfDay(hour: 14, minute: 0) {
        didSet { scheduleConflictCheck() }
    }

    var endTime = TimeOfDay(hour: 15, minute: 0) {
        didSet { scheduleConflictCheck() }
    }

    var repeats: BlockRepeat = .never

    /// Set when the chosen window overlaps an active booking. Drives the
    /// design's conflict-warning card.
    var conflict: BlockConflictWarning?

    private(set) var isSaving = false
    var saveError: String?

    private let client: SchedulingClient
    /// Routes to the conflicting booking's detail from the "View booking" link.
    private let onViewBooking: (@MainActor (String) -> Void)?
    private var conflictTask: Task<Void, Never>?

    init(client: SchedulingClient = .shared, onViewBooking: (@MainActor (String) -> Void)? = nil) {
        self.client = client
        self.onViewBooking = onViewBooking
    }

    /// Timed blocks need a positive window; all-day blocks are always valid.
    var isValid: Bool {
        allDay || TimeRange(start: startTime, end: endTime).isValid
    }

    /// Sub-caption under the repeat control. Weekday-specific for weekly, with
    /// the design's "· Ends never. Tap to add an end date." tail. `nil` for a
    /// one-off (mirrors the design's RepeatCard caption + Android).
    var repeatCaption: String? {
        let tail = "· Ends never. Tap to add an end date."
        switch repeats {
        case .never:
            return nil
        case .daily:
            return "Repeats every day \(tail)"
        case .weekly:
            let weekday = Calendar.current.component(.weekday, from: date) - 1
            return "Repeats every \(Weekday.longName(weekday)) \(tail)"
        case .monthly:
            let day = Calendar.current.component(.day, from: date)
            return "Repeats monthly on day \(day) \(tail)"
        }
    }

    /// Tapped from the conflict-warning card's "View booking" link — routes to
    /// the overlapping booking's detail (mirrors Android's OpenBooking event).
    func viewConflictingBooking() {
        guard let bookingId = conflict?.bookingId else { return }
        onViewBooking?(bookingId)
    }

    // MARK: Conflict detection

    /// Best-effort overlap detection: fetch the chosen day's bookings and warn
    /// if the busy window intersects an active (confirmed/pending) booking. The
    /// hold never cancels a booking — this only surfaces the design's warning.
    private func scheduleConflictCheck() {
        conflictTask?.cancel()
        if allDay {
            conflict = nil
            return
        }
        let day = date
        let window = TimeRange(start: startTime, end: endTime)
        conflictTask = Task { [weak self] in
            // Debounce inside the task: the wheel picker fires a didSet per
            // detent, and dispatching a GET /bookings for each one was a
            // request storm. Cancellation (the next detent) lands here first.
            try? await Task.sleep(nanoseconds: 300_000_000)
            guard !Task.isCancelled else { return }
            await self?.detectConflict(day: day, window: window)
        }
    }

    private func detectConflict(day: Date, window: TimeRange) async {
        guard window.isValid else {
            conflict = nil
            return
        }
        let calendar = Calendar.current
        let dayStart = calendar.startOfDay(for: day)
        guard let dayEnd = calendar.date(byAdding: .day, value: 1, to: dayStart) else { return }
        let blockStart = combine(day, window.start, calendar: calendar)
        let blockEnd = combine(day, window.end, calendar: calendar)
        do {
            let response: BookingsResponse = try await client.request(
                SchedulingEndpoints.getBookings(
                    owner: .personal,
                    from: Self.iso(dayStart),
                    to: Self.iso(dayEnd)
                )
            )
            if Task.isCancelled { return }
            let overlap = response.bookings.first { booking in
                guard Self.activeStatuses.contains(booking.status),
                      let bStart = booking.startAt.flatMap(Self.parseISO),
                      let bEnd = booking.endAt.flatMap(Self.parseISO)
                else { return false }
                return bStart < blockEnd && bEnd > blockStart
            }
            if let overlap {
                // "confirmed 2:30 PM booking" (matches Android + the design copy).
                let time = overlap.startAt.flatMap(Self.parseISO).map(Self.timeLabel)
                let label = time.map { "confirmed \($0) booking" } ?? "confirmed booking"
                conflict = BlockConflictWarning(
                    bookingLabel: label,
                    bookingId: overlap.id
                )
            } else {
                conflict = nil
            }
        } catch {
            // A cancelled check (superseded by a newer detent) must not touch
            // state — URLError.cancelled lands here in nondeterministic order
            // and could erase the warning a fresher task just set.
            if Task.isCancelled { return }
            // Detection is best-effort; never block the user on a fetch failure.
            conflict = nil
        }
    }

    private static func parseISO(_ value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: value) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }

    private static func timeLabel(_ date: Date) -> String {
        // User copy ("This overlaps a confirmed 2:30 PM booking"): use the
        // locale-aware short time style. A fixed "h:mm a" with `Locale.current`
        // is rewritten by the 24-hour override (QA1480) and would render
        // non-latn digits mid-sentence. Device zone matches the sheet's pickers.
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    /// Returns true on success so the View can dismiss.
    func save() async -> Bool {
        guard isValid, !isSaving else { return false }
        isSaving = true
        defer { isSaving = false }
        let trimmed = reason.trimmingCharacters(in: .whitespacesAndNewlines)
        let request = CreateBlockRequest(
            startAt: Self.iso(startInstant()),
            endAt: Self.iso(endInstant()),
            title: trimmed.isEmpty ? nil : trimmed,
            recurrenceRule: repeats.rrule
        )
        do {
            _ = try await client.request(SchedulingEndpoints.createBlock(request), as: AvailabilityBlockResponse.self)
            return true
        } catch let error as SchedulingError {
            saveError = error.userMessage ?? "Couldn't block off this time."
            return false
        } catch {
            saveError = "Couldn't block off this time."
            return false
        }
    }

    // MARK: Instant building

    private func startInstant(calendar: Calendar = .current) -> Date {
        if allDay { return calendar.startOfDay(for: date) }
        return combine(date, startTime, calendar: calendar)
    }

    private func endInstant(calendar: Calendar = .current) -> Date {
        if allDay {
            return calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: date))
                ?? calendar.startOfDay(for: date)
        }
        return combine(date, endTime, calendar: calendar)
    }

    private func combine(_ day: Date, _ time: TimeOfDay, calendar: Calendar) -> Date {
        calendar.date(
            bySettingHour: time.hour,
            minute: time.minute,
            second: 0,
            of: calendar.startOfDay(for: day)
        ) ?? day
    }

    private static func iso(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: date)
    }

    /// Booking statuses that count as an active overlap (mirrors Android).
    private static let activeStatuses: Set<String> = ["confirmed", "pending"]
}
