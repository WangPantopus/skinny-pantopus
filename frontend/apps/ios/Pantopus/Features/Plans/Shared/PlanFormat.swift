//
//  PlanFormat.swift
//  Pantopus
//
//  How Plans says when and how far: "Sun 1:25" under a pin, "Sun, Oct 18 ·
//  1:25–4:45 PM" on a card, "Happening now · until 10:30" in a row, and
//  distance bands ("about 1 mi"), never an exact distance (brief section 6).
//  Times show in the plan's own time zone when the card names one.
//

import Foundation

enum PlanFormat {
    // MARK: - Distance

    /// "under 1 mi", "about 2 mi" (non-breaking spaces: a band never splits across lines).
    static func distance(_ band: PlanDistanceBand?) -> String? {
        switch band {
        case .under1Mi: "under\u{00A0}1\u{00A0}mi"
        case .about1Mi: "about\u{00A0}1\u{00A0}mi"
        case .about2Mi: "about\u{00A0}2\u{00A0}mi"
        case .about3Mi: "about\u{00A0}3\u{00A0}mi"
        case .about5Mi: "about\u{00A0}5\u{00A0}mi"
        case nil: nil
        }
    }

    /// What VoiceOver reads: "about 1 mile", "about 2 miles".
    static func spokenDistance(_ band: PlanDistanceBand?) -> String? {
        switch band {
        case .under1Mi: "under 1 mile"
        case .about1Mi: "about 1 mile"
        case .about2Mi: "about 2 miles"
        case .about3Mi: "about 3 miles"
        case .about5Mi: "about 5 miles"
        case nil: nil
        }
    }

    /// The band for a straight-line distance between two public points (an
    /// area and the viewer's own center), for pins that carry no band.
    static func band(meters: Double) -> PlanDistanceBand {
        let miles = meters / 1609.34
        switch miles {
        case ..<1: return .under1Mi
        case ..<1.5: return .about1Mi
        case ..<2.5: return .about2Mi
        case ..<4: return .about3Mi
        default: return .about5Mi
        }
    }

    // MARK: - Day parts

    static func dayPart(_ part: PlanDayPart) -> String {
        switch part {
        case .morning: "Morning"
        case .afternoon: "Afternoon"
        case .evening: "Evening"
        case .night: "Night"
        }
    }

    /// "This morning", "Tomorrow afternoon", "Saturday morning" for a
    /// playdate whose time is hidden; the day comes from `day`, when known.
    static func dayPartPhrase(_ part: PlanDayPart, day: Date?, now: Date = Date(), calendar: Calendar = .current) -> String {
        let word = dayPart(part).lowercased()
        guard let day else { return dayPart(part) }
        if calendar.isDate(day, inSameDayAs: now) { return part == .night ? "Tonight" : "This \(word)" }
        if let tomorrow = calendar.date(byAdding: .day, value: 1, to: now), calendar.isDate(day, inSameDayAs: tomorrow) {
            return "Tomorrow \(word)"
        }
        return "\(weekday(day, calendar: calendar)) \(word)"
    }

    // MARK: - Times

    /// The tag under a pin: "Now", "Full", "Morning", "5:30 PM" today, "Sun 1:25" later.
    static func pinTag(
        state: PlanState,
        isFull: Bool,
        startsAt: Date?,
        dayPart part: PlanDayPart,
        now: Date = Date(),
        calendar: Calendar = .current
    ) -> String {
        if state == .live { return "Now" }
        if isFull { return "Full" }
        guard let startsAt else { return dayPart(part) }
        if calendar.isDate(startsAt, inSameDayAs: now) { return time(startsAt, calendar: calendar) }
        return "\(shortWeekday(startsAt, calendar: calendar)) \(clock(startsAt, calendar: calendar))"
    }

    /// "Sun, Oct 18 · 1:25–4:45 PM" (`long`: "Sunday, Oct 18 · …"); "Today ·
    /// 5:30–7:30 PM" and "Tomorrow · …" when they apply (board J6, as on Android).
    static func when(start: Date, end: Date?, long: Bool = false, now: Date = Date(), calendar: Calendar = .current) -> String {
        let date = long ? longDay(start, calendar: calendar) : shortDay(start, calendar: calendar)
        let day = switch days(from: now, to: start, calendar: calendar) {
        case 0: "Today"
        case 1: "Tomorrow"
        default: date
        }
        guard let end else { return "\(day) · \(time(start, calendar: calendar))" }
        return "\(day) · \(range(start, end, calendar: calendar))"
    }

    /// "1:25–4:45 PM", or "11:30 AM–1:00 PM" across noon, or "11:00 PM–Mon 1:00 AM" across days.
    static func range(_ start: Date, _ end: Date, calendar: Calendar = .current) -> String {
        if !calendar.isDate(start, inSameDayAs: end) {
            return "\(time(start, calendar: calendar))–\(shortWeekday(end, calendar: calendar)) \(time(end, calendar: calendar))"
        }
        if meridiem(start, calendar: calendar) == meridiem(end, calendar: calendar) {
            return "\(clock(start, calendar: calendar))–\(time(end, calendar: calendar))"
        }
        return "\(time(start, calendar: calendar))–\(time(end, calendar: calendar))"
    }

    /// A row's "when": "Happening now · until 10:30", "Today 5:30 PM",
    /// "Tomorrow 9:00 AM", "Sun 1:25 PM" this week, "Sun, Oct 25 1:25 PM" a
    /// week or more out (as on Android: two Sundays never read alike).
    static func rowWhen(state: PlanState, start: Date?, end: Date?, now: Date = Date(), calendar: Calendar = .current) -> String? {
        if state == .live {
            guard let end else { return "Happening now" }
            return "Happening now · until \(clock(end, calendar: calendar))"
        }
        guard let start else { return nil }
        switch days(from: now, to: start, calendar: calendar) {
        case 0: return "Today \(time(start, calendar: calendar))"
        case 1: return "Tomorrow \(time(start, calendar: calendar))"
        case ..<oneWeek: return "\(shortWeekday(start, calendar: calendar)) \(time(start, calendar: calendar))"
        default: return "\(shortDay(start, calendar: calendar)) \(time(start, calendar: calendar))"
        }
    }

    /// When something happened: "9:42 AM" today, "Yesterday 8:11 PM", "Mon 8:11 PM"
    /// earlier this week, else "Oct 12" (as on Android).
    static func past(_ date: Date, now: Date = Date(), calendar: Calendar = .current) -> String {
        switch days(from: date, to: now, calendar: calendar) {
        case ...0: time(date, calendar: calendar)
        case 1: "Yesterday \(time(date, calendar: calendar))"
        case ..<(oneWeek - 1): "\(shortWeekday(date, calendar: calendar)) \(time(date, calendar: calendar))"
        default: formatted(date, template: "MMM d", calendar: calendar)
        }
    }

    /// The host's own distance to a public place: "0.4 mi", or "here" next
    /// door (as on Android).
    static func placeDistance(_ meters: Double) -> String {
        let miles = meters / 1609.34
        return miles < 0.03 ? "here" : String(format: "%.1f mi", max(miles, 0.1))
    }

    /// "just now", "12 min ago", "3 hours ago", else as [past] ("Mon 9:42 AM"): when
    /// someone answered (J7), as on Android.
    static func ago(_ date: Date, now: Date = Date(), calendar: Calendar = .current) -> String {
        let minutes = Int(now.timeIntervalSince(date) / 60)
        if minutes < 2 { return "just now" }
        if minutes < 60 { return "\(minutes) min ago" }
        if minutes < 12 * 60 { return "\(minutes / 60) hour\(minutes / 60 == 1 ? "" : "s") ago" }
        return past(date, now: now, calendar: calendar)
    }

    /// "Sunday 1:25 PM" for VoiceOver ("today 5:30 PM", "Thursday, Oct 22 5:15 PM" a week or more out).
    static func spokenWhen(_ start: Date, now: Date = Date(), calendar: Calendar = .current) -> String {
        "\(dayPhrase(start, now: now, calendar: calendar)) \(time(start, calendar: calendar))"
    }

    /// "Starts in 7 hours", "Starts in 25 minutes", "Starts tomorrow",
    /// "Starts Saturday", "Starts Sunday, Oct 25" a week or more out.
    static func startsIn(_ start: Date, now: Date = Date(), calendar: Calendar = .current) -> String {
        let minutes = Int(start.timeIntervalSince(now) / 60)
        if minutes <= 0 { return "Starting now" }
        if minutes < 60 { return "Starts in \(minutes) minute\(minutes == 1 ? "" : "s")" }
        let hours = minutes / 60
        if hours < 24 { return "Starts in \(hours) hour\(hours == 1 ? "" : "s")" }
        return "Starts \(dayPhrase(start, now: now, calendar: calendar))"
    }

    /// The day inside a sentence: "today", "tomorrow", "Saturday", "Sunday,
    /// Oct 25" a week or more out (as on Android).
    static func dayPhrase(_ date: Date, now: Date = Date(), calendar: Calendar = .current) -> String {
        switch days(from: now, to: date, calendar: calendar) {
        case 0: "today"
        case 1: "tomorrow"
        case ..<oneWeek: weekday(date, calendar: calendar)
        default: longDay(date, calendar: calendar)
        }
    }

    /// The list's section for a day: "Today", "Tomorrow", "Saturday", and
    /// "Later" a week or more out (as on Android), so two Sundays never merge.
    static func listSection(_ date: Date, now: Date = Date(), calendar: Calendar = .current) -> String {
        days(from: now, to: date, calendar: calendar) >= oneWeek ? "Later" : dayHeading(date, now: now, calendar: calendar)
    }

    /// The day heading in the list: "Today", "Tomorrow", "Saturday".
    static func dayHeading(_ date: Date, now: Date = Date(), calendar: Calendar = .current) -> String {
        if calendar.isDate(date, inSameDayAs: now) { return "Today" }
        if let tomorrow = calendar.date(byAdding: .day, value: 1, to: now), calendar.isDate(date, inSameDayAs: tomorrow) {
            return "Tomorrow"
        }
        return weekday(date, calendar: calendar)
    }

    /// "9:42 AM".
    static func time(_ date: Date, calendar: Calendar = .current) -> String {
        formatted(date, template: "h:mm a", calendar: calendar)
    }

    /// A calendar set to the plan's own time zone, when it names one.
    static func calendar(for timezone: String?) -> Calendar {
        var calendar = Calendar.current
        if let timezone, let zone = TimeZone(identifier: timezone) { calendar.timeZone = zone }
        return calendar
    }

    // MARK: - Pieces

    /// A week or more out, a day is named with its date.
    private static let oneWeek = 7

    /// Calendar days from one date to another ("tomorrow" is 1), in the plan's time zone.
    private static func days(from: Date, to: Date, calendar: Calendar) -> Int {
        calendar.dateComponents([.day], from: calendar.startOfDay(for: from), to: calendar.startOfDay(for: to)).day ?? 0
    }

    private static func clock(_ date: Date, calendar: Calendar) -> String {
        formatted(date, template: "h:mm", calendar: calendar)
    }

    private static func meridiem(_ date: Date, calendar: Calendar) -> Int {
        calendar.component(.hour, from: date) < 12 ? 0 : 1
    }

    private static func shortWeekday(_ date: Date, calendar: Calendar) -> String {
        formatted(date, template: "EEE", calendar: calendar)
    }

    private static func weekday(_ date: Date, calendar: Calendar) -> String {
        formatted(date, template: "EEEE", calendar: calendar)
    }

    private static func shortDay(_ date: Date, calendar: Calendar) -> String {
        formatted(date, template: "EEE, MMM d", calendar: calendar)
    }

    private static func longDay(_ date: Date, calendar: Calendar) -> String {
        formatted(date, template: "EEEE, MMM d", calendar: calendar)
    }

    private static func formatted(_ date: Date, template: String, calendar: Calendar) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = template
        return formatter.string(from: date)
    }
}

/// "Verify your address": the postcard flow for the viewer's home, or the
/// Place tab to add a home first.
@MainActor
enum PlanVerification {
    static func open() {
        Task { @MainActor in
            let homes = try? await HomesStoreReads.myHomes().value.homes
            if let home = homes?.first(where: { $0.showsCopyBeforeRecheck }) ?? homes?.first {
                DeepLinkRouter.shared.handle(path: "/homes/\(home.home.id)/verify-postcard")
            } else {
                DeepLinkRouter.shared.handle(path: "/place")
            }
        }
    }
}
