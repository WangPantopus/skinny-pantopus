//
//  HolidayCardWords.swift
//  Pantopus
//
//  What the Christmas card screens say (the web's `SendCardFlow`,
//  `SendCardRow` and `cardArt`): days and times on this phone's clock, how
//  a sent card comes, and until when it can be taken back. Their mail comes
//  at 7 a.m. where they live, so a card's arrival says "their 7 a.m. mail"
//  and never turns their 7 a.m. into this phone's time.
//

import Foundation

enum HolidayCardWords {
    // MARK: Days and times

    /// "Sat, Dec 19".
    static func shortDay(_ iso: String?, calendar: Calendar = .current) -> String {
        format(iso, "EEE, MMM d", calendar: calendar)
    }

    /// "Friday, December 25".
    static func longDay(_ iso: String?, calendar: Calendar = .current) -> String {
        format(iso, "EEEE, MMMM d", calendar: calendar)
    }

    /// "7 a.m.", or "7:30 a.m." when it isn't on the hour.
    static func clockTime(_ iso: String?, calendar: Calendar = .current) -> String {
        guard let date = MailDates.parse(iso) else { return "" }
        let onTheHour = calendar.component(.minute, from: date) == 0
        return format(iso, onTheHour ? "h a" : "h:mm a", calendar: calendar)
            .replacingOccurrences(of: "AM", with: "a.m.")
            .replacingOccurrences(of: "PM", with: "p.m.")
    }

    /// "today", "tomorrow" or "in 6 days", counted by calendar day here.
    static func inDays(_ iso: String?, now: Date = Date(), calendar: Calendar = .current) -> String {
        guard let date = MailDates.parse(iso) else { return "" }
        let days = max(0, MailDates.daysBetween(now, date, calendar: calendar))
        switch days {
        case 0: return "today"
        case 1: return "tomorrow"
        default: return "in \(days) days"
        }
    }

    private static func format(_ iso: String?, _ pattern: String, calendar: Calendar) -> String {
        guard let date = MailDates.parse(iso) else { return "" }
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.locale = Locale(identifier: "en_US")
        formatter.dateFormat = pattern
        return formatter.string(from: date)
    }

    // MARK: People

    /// "Maya" from "Maya O.".
    static func firstName(_ name: String) -> String {
        name.split(whereSeparator: \.isWhitespace).first.map(String.init) ?? name
    }

    /// A name without its closing period, for a sentence that ends in one.
    static func withoutPeriod(_ name: String) -> String {
        name.hasSuffix(".") ? String(name.dropLast()) : name
    }

    // MARK: A sent card

    /// How a sent card comes, in a sentence.
    static func arrivalLine(_ card: SentHolidayCard, calendar: Calendar = .current) -> String {
        let who = MailPieceModel.firstText(card.toName) ?? "They"
        if card.status == "withdrawn" { return "You took this card back." }
        if card.byEmail {
            if card.status == "claimed" { return "\(who) joined Pantopus and has your card." }
            return card.arrival == .sealedChristmas
                ? "We emailed them. Once they join with that address, it waits in their mailbox and opens on Christmas morning."
                : "We emailed them. It waits for them to join with that address and open it."
        }
        let day = shortDay(card.arrivesAt, calendar: calendar)
        if card.status == "delivered" {
            return card.opensAt != nil ? "It’s in \(who)’s mailbox, sealed until Christmas morning." : "It’s in \(who)’s mailbox."
        }
        switch card.arrival {
        case .christmasMorning: return "\(who) gets it on Christmas morning with their 7 a.m. mail."
        case .sealedChristmas: return "It comes with their 7 a.m. mail on \(day), sealed until Christmas morning."
        default: return "\(who) gets it with their 7 a.m. mail on \(day)."
        }
    }

    /// Until when it can be taken back, on this phone's clock; nil once it can't.
    static func takeBackLine(_ card: SentHolidayCard, calendar: Calendar = .current) -> String? {
        guard card.canTakeBack else { return nil }
        if card.byEmail { return "You can take it back until they open it." }
        let until = "\(clockTime(card.takeBackUntil, calendar: calendar)) \(shortDay(card.takeBackUntil, calendar: calendar))"
        return "You can take it back until \(until), when the carrier picks it up."
    }

    /// The Mailbox row's second line: the invitation, or how today's card comes.
    static func rowLine(today: SentHolidayCard?, calendar: Calendar = .current) -> String {
        guard let today else { return "Pick a picture and write a note. One card a day." }
        if today.byEmail {
            return today.status == "claimed" ? "They joined Pantopus and have it." : "Waiting for them to open the email."
        }
        if today.status == "delivered" { return "In their mailbox now." }
        if today.arrival == .christmasMorning { return "Arrives on Christmas morning." }
        let sealed = today.opensAt != nil ? ", sealed until Christmas" : ""
        return "Arrives with their 7 a.m. mail on \(shortDay(today.arrivesAt, calendar: calendar))\(sealed)."
    }

    /// Today's card while it still counts (one taken back doesn't).
    static func today(_ cards: HolidayCardsResponse?) -> SentHolidayCard? {
        guard let today = cards?.today, today.status != "withdrawn" else { return nil }
        return today
    }

    // MARK: Choosing when it comes

    /// A choice on "Seal it for the day": its title and what it means.
    static func arrivalChoice(
        _ arrival: HolidayCardArrival,
        cards: HolidayCardsResponse,
        name: String,
        calendar: Calendar = .current
    ) -> (title: String, detail: String) {
        // Their mail comes at 7 a.m. where they live: never turned into this phone's time.
        let day = shortDay(cards.nextRoundAt, calendar: calendar)
        switch arrival {
        case .nextMorning:
            return ("With the morning mail", "\(day), about 7 a.m. where \(name) lives. They can open it right away.")
        case .sealedChristmas:
            return (
                "Sealed until Christmas",
                "It comes with the \(day) morning mail and waits in their mailbox with a “Do not open until Christmas” seal. "
                    + "It opens on December 25."
            )
        case .christmasMorning:
            return ("On Christmas morning", "\(shortDay(cards.christmasMorningAt, calendar: calendar)), with the 7 a.m. mail.")
        case .now:
            return ("Right away, by email", "They get an email now and can open it once they join with that address.")
        }
    }

    /// The take-back note under the choices. Before it's sent their clock
    /// isn't known here; the sent card says the time on this one.
    static func sealNote(byEmail: Bool) -> String {
        byEmail ? "You can take it back until they open it." : "You can take it back until the carrier picks it up at 7 a.m. their time."
    }

    /// A caption as a sentence for VoiceOver: most end in a full stop or a
    /// question mark already.
    static func captionSentence(_ caption: String?) -> String {
        let text = MailPieceModel.firstText(caption) ?? "A Christmas picture"
        return text.last.map { ".!?".contains($0) } == true ? text : text + "."
    }
}
