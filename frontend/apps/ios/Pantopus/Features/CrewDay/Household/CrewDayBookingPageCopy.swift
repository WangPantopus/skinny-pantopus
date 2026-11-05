//
//  CrewDayBookingPageCopy.swift
//  Pantopus
//
//  5. Your Crew Day's words (build kit 01-spec.md screen 5's table, boards
//  `CrewDay` and `Cd*`): which state card a booking shows, its status line
//  in honest words ("Requested" isn't "Booked", "Paused" isn't "Refunded"),
//  the booking card's lines and the case so far. The web's booking page and
//  Android say the same.
//

import Foundation

/// The state card a booking shows, in the order the page checks them.
enum CrewDayBookingPhase: String, Equatable {
    case attention, resolved, confirming, priceOffered, newDates, onTheWay, done, paid, cardFailed, refunded, ended
    case today, evening, booked
}

/// One step of the status line, with the word the booking is stuck on.
struct CrewDayBookingStep: Identifiable, Equatable {
    enum Tone { case normal, warning, error }

    let id: String
    let label: String
    /// `done`, `current` or `todo`.
    let state: String
    let tone: Tone

    /// What VoiceOver adds after the word.
    var spoken: String {
        switch (state, tone) {
        case (_, .warning): ", on hold"
        case (_, .error): ", needs payment"
        case ("done", _): ", done"
        case ("current", _): ", now"
        default: ", not yet"
        }
    }
}

/// One line of the case timeline.
struct CrewDayCaseLine: Identifiable, Equatable {
    let id: String
    let at: String
    let text: String
}

enum CrewDayBookingPageCopy {
    static let problemKinds: [(key: String, label: String)] = [
        ("missed", "The crew missed something"),
        ("damage", "Something was damaged"),
        ("no_show", "The crew didn't come"),
        ("charge", "A problem with the charge"),
        ("other", "Something else")
    ]

    static func problemLabel(_ kind: String?) -> String {
        problemKinds.first { $0.key == kind }?.label ?? "Something needs attention"
    }

    static func crewName(_ booking: CrewDayBookingDTO) -> String {
        booking.crewDay.crew?.name ?? "The crew"
    }

    static func isEnded(_ booking: CrewDayBookingDTO) -> Bool {
        ["cancelled", "declined", "refunded"].contains(booking.status)
    }

    // MARK: - Which card

    /// The status's own card; a booked home's card depends on the day (below).
    private static let statusPhases: [String: CrewDayBookingPhase] = [
        "price_pending": .confirming, "price_offered": .priceOffered, "on_the_way": .onTheWay, "done": .done,
        "paid": .paid, "payment_failed": .cardFailed, "refunded": .refunded, "cancelled": .ended, "declined": .ended
    ]

    static func phase(_ booking: CrewDayBookingDTO, now: Date = Date()) -> CrewDayBookingPhase {
        if booking.problem?.status == "open" { return .attention }
        if booking.problem?.status == "resolved", booking.problem?.resolution != nil { return .resolved }
        if booking.status == "new_dates", booking.proposal != nil { return .newDates }
        if let phase = statusPhases[booking.status] { return phase }
        switch dayPhase(booking, now: now) {
        case .today: return .today
        case .evening: return .evening
        case .before: return .booked
        }
    }

    enum DayPhase { case before, evening, today }

    /// "Today" on the day, "Tomorrow" from 6 PM the evening before (the Crew Day's own time).
    static func dayPhase(_ booking: CrewDayBookingDTO, now: Date = Date()) -> DayPhase {
        let tz = booking.crewDay.timezone
        let calendar = CrewDayFormat.calendar(tz)
        guard let day = CrewDayFormat.day(booking.serviceDate, timezone: tz) else { return .before }
        if calendar.isDate(now, inSameDayAs: day) { return .today }
        guard let start = CrewDayFormat.instant(booking.windowStartsAt) else { return .before }
        let eveningBefore = start.addingTimeInterval(-24 * 3600)
        let hour = calendar.component(.hour, from: now)
        return now >= eveningBefore && now < start && hour >= 18 ? .evening : .before
    }

    // MARK: - The status line

    /// The four steps, with the board's words for a step the booking is stuck on.
    static func steps(_ booking: CrewDayBookingDTO) -> [CrewDayBookingStep] {
        booking.steps.map { step in
            if booking.status == "new_dates", step.key == "booked" {
                return CrewDayBookingStep(id: step.key, label: "Pick a date", state: "current", tone: .warning)
            }
            if booking.problem?.status == "open", step.key == "paid" {
                return CrewDayBookingStep(id: step.key, label: "Paused", state: "current", tone: .warning)
            }
            if booking.status == "payment_failed", step.key == "paid" {
                return CrewDayBookingStep(id: step.key, label: "Payment due", state: "current", tone: .error)
            }
            if ["price_pending", "price_offered"].contains(booking.status), step.key == "booked" {
                return CrewDayBookingStep(id: step.key, label: step.label, state: "current", tone: .normal)
            }
            return CrewDayBookingStep(id: step.key, label: step.label, state: step.state, tone: .normal)
        }
    }

    // MARK: - Lines

    /// "Visa ending 4242", or "Your card" when the page doesn't name one.
    static func cardLabel(_ booking: CrewDayBookingDTO) -> String {
        guard let card = booking.card, let last4 = card.last4 else { return "Your card" }
        return "\((card.brand ?? "Card").capitalized) ending \(last4)"
    }

    /// After a failed charge the household paid the invoice in Pantopus, maybe with another card.
    static func paidInApp(_ booking: CrewDayBookingDTO) -> Bool {
        booking.events.contains { $0.kind == "paid_by_household" }
    }

    /// The price as booked: "$180", nil while the crew hasn't priced it.
    static func price(_ booking: CrewDayBookingDTO) -> String? {
        booking.priceCents.map(CrewDayFormat.price)
    }

    /// "Tuesday, Nov 17 · 9 AM–1 PM".
    static func when(_ booking: CrewDayBookingDTO) -> String {
        let day = CrewDayFormat.longDay(booking.serviceDate, timezone: booking.crewDay.timezone)
        let window = CrewDayFormat.window(booking.windowStart, booking.windowEnd)
        return [day, window].filter { !$0.isEmpty }.joined(separator: " · ")
    }

    /// "Sun, Nov 15, 9 AM" for an instant in the Crew Day's zone.
    static func dayAndTime(_ value: String?, _ booking: CrewDayBookingDTO) -> String {
        CrewDayFormat.dayAndTime(CrewDayFormat.instant(value), timezone: booking.crewDay.timezone)
    }

    static func time(_ value: String?, _ booking: CrewDayBookingDTO) -> String {
        CrewDayFormat.time(CrewDayFormat.instant(value), timezone: booking.crewDay.timezone)
    }

    static func shortDay(_ value: String?, _ booking: CrewDayBookingDTO) -> String {
        CrewDayFormat.shortDay(instant: CrewDayFormat.instant(value), timezone: booking.crewDay.timezone)
    }

    /// The card row's second line: where the money stands, in honest words.
    static func cardLine(_ booking: CrewDayBookingDTO) -> String {
        let charge = booking.charge
        switch booking.status {
        case "cancelled", "declined": return "Nothing was charged."
        case "refunded": return "Charged, then refunded in full."
        case "price_pending", "price_offered": return "Saved. Nothing is charged yet."
        case "new_dates": return "Saved. No payment has been taken."
        default: break
        }
        if booking.problem?.status == "open" { return "Charge paused" }
        if booking.status == "done", let due = charge?.dueAt { return "Charges \(dayAndTime(due, booking))" }
        if booking.status == "paid", paidInApp(booking) { return "Didn't go through. You paid in Pantopus." }
        if booking.status == "paid", let paid = charge?.paidAt { return "Charged \(shortDay(paid, booking))" }
        if booking.status == "payment_failed" { return "Didn't go through" }
        return "Saved. Charged only after the work."
    }

    /// "Free cancellation until Sun, Nov 15, 9 AM", while cancelling is free.
    static func cutoffLine(_ booking: CrewDayBookingDTO) -> String? {
        if booking.status == "new_dates", let deadline = booking.proposal?.deadlineAt {
            return "Cancel at no charge until \(dayAndTime(deadline, booking))"
        }
        guard booking.canCancel, let cutoff = booking.cancelCutoffAt else { return nil }
        return "Free cancellation until \(dayAndTime(cutoff, booking))"
    }

    /// Who ended the booking and what it cost (nothing).
    static func endedTitle(_ booking: CrewDayBookingDTO) -> String {
        let crew = crewName(booking)
        if booking.status == "declined" { return "\(crew) can't take your home this time. Nothing was charged." }
        switch booking.cancelledBy {
        case "household":
            return "You cancelled. Nothing was charged."
        case "crew":
            return booking.crewDay.status == "cancelled"
                ? "\(crew) cancelled this day. Nothing was charged."
                : "\(crew) released your home. Nothing was charged."
        case "operator":
            return "Pantopus cancelled this Crew Day. Nothing was charged."
        default:
            let reason = booking.events.last { $0.kind == "booking_cancelled" }?.reason
            return reason == "price_not_answered"
                ? "The price wasn't approved before booking closed, so this booking was cancelled. Nothing was charged."
                : "No new date was picked, so this booking was cancelled. Nothing was charged."
        }
    }

    /// The outcome of a closed case, in words.
    static func resolvedTitle(_ booking: CrewDayBookingDTO) -> String {
        let total = booking.priceCents ?? 0
        let refunded = booking.problem?.refundedCents ?? booking.charge?.refundedCents ?? 0
        switch booking.problem?.resolution {
        case "released": return "Charge released: \(CrewDayFormat.price(total)) paid"
        case "refunded": return "Refunded \(CrewDayFormat.price(refunded > 0 ? refunded : total)) to \(cardLabel(booking))"
        case "partial_refund": return "Refunded \(CrewDayFormat.price(refunded)) of \(CrewDayFormat.price(total))"
        default: return "Pantopus support resolved this"
        }
    }

    /// "We'll remind you Monday evening." (the evening before the home's date).
    static func reminderLine(_ booking: CrewDayBookingDTO) -> String {
        let tz = booking.crewDay.timezone
        guard let day = CrewDayFormat.day(booking.serviceDate, timezone: tz),
              let before = CrewDayFormat.calendar(tz).date(byAdding: .day, value: -1, to: day) else {
            return "We'll remind you the evening before."
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = CrewDayFormat.calendar(tz).timeZone
        formatter.dateFormat = "EEEE"
        return "We'll remind you \(formatter.string(from: before)) evening."
    }

    /// "Book Thursday" for a picked new date.
    static func bookDayButton(_ date: String, _ booking: CrewDayBookingDTO) -> String {
        "Book \(CrewDayFormat.weekday(date, timezone: booking.crewDay.timezone))"
    }

    // MARK: - The case so far (board `CdAttention`)

    private static let resolvedLines: [String: String] = [
        "released": "Pantopus support released the charge.",
        "refunded": "Pantopus support refunded you.",
        "partial_refund": "Pantopus support refunded part of the charge.",
        "resolved": "Pantopus support closed this case."
    ]

    /// From the report on: what the household did, what Pantopus support said and did.
    static func caseTimeline(_ booking: CrewDayBookingDTO) -> [CrewDayCaseLine] {
        guard let start = booking.events.firstIndex(where: { $0.kind == "problem_opened" }) else { return [] }
        return booking.events[start...].compactMap { event in
            let note = event.note?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
            let text: String? = switch event.kind {
            case "problem_opened": "You reported a problem. Your charge paused."
            case "problem_note": note.map { "You added: \u{201C}\($0)\u{201D}" } ?? "You added photos."
            case "operator_note": note.map { "Pantopus support: \($0)" }
            case "refunded": event.amountCents.map { "Refunded \(CrewDayFormat.price($0))." }
            case "problem_resolved":
                [resolvedLines[event.resolution ?? ""] ?? resolvedLines["resolved"], note].compactMap { $0 }.joined(separator: " ")
            case "charged", "paid_by_household": "Your charge went through."
            default: nil
            }
            guard let text else { return nil }
            let at = "\(shortDay(event.createdAt, booking)) · \(time(event.createdAt, booking))"
            return CrewDayCaseLine(id: event.id, at: at, text: text)
        }
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
