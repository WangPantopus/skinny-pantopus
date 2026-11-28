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
    /// Whether cards cost digital stamps for this person, as the cards were
    /// last read (the Mailbox row or the card flow): Sent's "Take your card
    /// back?" then says the card's stamp comes back.
    @MainActor static var postageOn = false

    /// "Take your card back?" with digital stamps on.
    static let stampComesBack = "Its stamp comes back to you."

    /// "Take your card back?" for a card by email whose email hasn't gone out: it waits for the time chosen
    /// (`email_send_at`), or Sent says it didn't go (`email_status`; taking it back stops the tries).
    static let notEmailedYet = "We haven’t emailed them yet, so nothing will go out."

    // MARK: Days and times

    /// "Sat, Dec 19".
    static func shortDay(_ iso: String?, calendar: Calendar = .current) -> String {
        format(iso, "EEE, MMM d", calendar: calendar)
    }

    /// "Friday, December 25".
    static func longDay(_ iso: String?, calendar: Calendar = .current) -> String {
        format(iso, "EEEE, MMMM d", calendar: calendar)
    }

    /// "December 10, 2026", as the card's link page says it.
    static func dayWithYear(_ iso: String?, calendar: Calendar = .current) -> String {
        format(iso, "MMMM d, yyyy", calendar: calendar)
    }

    /// "Mon, Nov 16 at 7 a.m." on this phone's clock: when a card's email goes.
    static func dayAndTime(_ iso: String?, calendar: Calendar = .current) -> String {
        "\(shortDay(iso, calendar: calendar)) at \(clockTime(iso, calendar: calendar))"
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
        return inDays(count: MailDates.daysBetween(now, date, calendar: calendar))
    }

    /// "today", "tomorrow" or "in 6 days".
    static func inDays(count: Int) -> String {
        switch max(0, count) {
        case 0: "today"
        case 1: "tomorrow"
        default: "in \(count) days"
        }
    }

    /// A time, or a calendar day ("2026-10-31", at noon so no zone moves it a day).
    private static func format(_ iso: String?, _ pattern: String, calendar: Calendar) -> String {
        guard let iso, let date = iso.count == 10 ? MailDates.parseDay(iso) : MailDates.parse(iso) else { return "" }
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

    /// "Maya’s".
    static func possessive(_ name: String) -> String {
        "\(name)’s"
    }

    /// A name without its closing period, for a sentence that ends in one.
    static func withoutPeriod(_ name: String) -> String {
        name.hasSuffix(".") ? String(name.dropLast()) : name
    }

    /// "Maya and Theo", "Maya, Theo and 2 others".
    static func listNames(_ names: [String]) -> String {
        guard names.count > 2 else { return names.joined(separator: " and ") }
        let rest = names.count - 2
        return "\(names[0]), \(names[1]) and \(rest) \(rest == 1 ? "other" : "others")"
    }

    // MARK: A sent card

    /// How a sent card comes, in a sentence. `improved` (the card round's switch, from the cards' read): a link or an
    /// email opens before joining, so its words say so (the web's `arrivalLine`).
    static func arrivalLine(_ card: SentHolidayCard, improved: Bool = false, calendar: Calendar = .current) -> String {
        let who = MailPieceModel.firstText(card.toName) ?? "They"
        if card.status == "withdrawn" { return "You took this card back." }
        if improved, card.byLink || card.byEmail, let line = openBeforeJoiningLine(card, who: who, calendar: calendar) {
            return line
        }
        if card.byLink {
            if card.status == "claimed" { return "\(who) opened your link and has your card." }
            if card.status == "expired" { return "Nobody opened your link in 90 days." }
            return card.arrival == .sealedChristmas
                ? "It waits for someone to open your link and join. Then it’s in their mailbox and opens on Christmas morning."
                : "It waits for someone to open your link and join."
        }
        if card.byEmail {
            if card.status == "claimed" { return "\(who) joined Pantopus and has your card." }
            if let sendAt = card.emailSendAt {
                return "We’ll email them \(dayAndTime(sendAt, calendar: calendar)), your time. "
                    + "Once they join with that address, it waits in their mailbox."
            }
            return card.arrival == .sealedChristmas
                ? "We emailed them. Once they join with that address, it waits in their mailbox and opens on Christmas morning."
                : "We emailed them. It waits for them to join with that address and open it."
        }
        let day = shortDay(card.arrivesOn ?? card.arrivesAt, calendar: calendar)
        if card.status == "delivered" {
            return card.opensAt != nil ? "It’s in \(who)’s mailbox, sealed until Christmas morning." : "It’s in \(who)’s mailbox."
        }
        switch card.arrival {
        case .christmasMorning: return "\(who) gets it on Christmas morning with their 7 a.m. mail."
        case .sealedChristmas: return "It comes with their 7 a.m. mail on \(day), sealed until Christmas morning."
        default: return "\(who) gets it with their 7 a.m. mail on \(day)."
        }
    }

    /// A sent card by link or email with `improved`: it opens before they join. Nil where the words are as before.
    private static func openBeforeJoiningLine(_ card: SentHolidayCard, who: String, calendar: Calendar) -> String? {
        if card.byLink {
            if card.status == "claimed" || card.status == "expired" { return nil }
            return card.arrival == .sealedChristmas
                ? "Ready to share. It stays sealed until Christmas morning, and anyone with your link can save it to their mailbox."
                : "Ready to share. Anyone with your link can open and read it right away, and save it to keep it."
        }
        if card.status == "claimed" { return "\(who) saved your card to their Pantopus mailbox." }
        if let sendAt = card.emailSendAt {
            return "We’ll email them \(dayAndTime(sendAt, calendar: calendar)), your time. "
                + "They can open and read it right in their browser."
        }
        return card.arrival == .sealedChristmas
            ? "We emailed them. It stays sealed until Christmas morning, when we’ll send a reminder to open it."
            : "We emailed them. They can open and read it right in their browser, and join free to keep it or write back."
    }

    /// Until when it can be taken back, on this phone's clock; nil once it can't.
    static func takeBackLine(_ card: SentHolidayCard, calendar: Calendar = .current) -> String? {
        guard card.canTakeBack else { return nil }
        if card.byEmail { return card.byLink ? "You can take it back until someone opens it." : "You can take it back until they open it." }
        let until = "\(clockTime(card.takeBackUntil, calendar: calendar)) \(shortDay(card.takeBackUntil, calendar: calendar))"
        return "You can take it back until \(until), when the carrier picks it up."
    }

    /// With digital stamps on: what's left to send with.
    static func stampsLine(_ stamps: HolidayCardStamps?) -> String {
        guard let stamps else { return "Pick a picture and write a note." }
        if stamps.available == 0 { return "You’re out of stamps. Get a stamp book to send more." }
        if stamps.freeRemaining > 0, stamps.paidRemaining <= 0 {
            return "Pick a picture and write a note. \(stamps.freeRemaining) free \(stamps.freeRemaining == 1 ? "card" : "cards") left."
        }
        return "Pick a picture and write a note. \(stamps.available) \(stamps.available == 1 ? "stamp" : "stamps") left."
    }

    /// The Mailbox row's second line: the invitation, or how today's card comes.
    static func rowLine(
        today: SentHolidayCard?,
        postageEnabled: Bool = false,
        stamps: HolidayCardStamps? = nil,
        calendar: Calendar = .current
    ) -> String {
        guard let today else {
            return postageEnabled ? stampsLine(stamps) : "Pick a picture and write a note. One card a day."
        }
        if today.byLink {
            return today.status == "claimed" ? "Someone opened your link and has it." : "Waiting for someone to open your link."
        }
        if today.byEmail {
            return today.status == "claimed" ? "They joined Pantopus and have it." : "Waiting for them to open the email."
        }
        if today.status == "delivered" { return "In their mailbox now." }
        if today.arrival == .christmasMorning { return "Arrives on Christmas morning." }
        let sealed = today.opensAt != nil ? ", sealed until Christmas" : ""
        return "Arrives with their 7 a.m. mail on \(shortDay(today.arrivesOn ?? today.arrivesAt, calendar: calendar))\(sealed)."
    }

    /// Today's card while it still counts (one taken back doesn't).
    static func today(_ cards: HolidayCardsResponse?) -> SentHolidayCard? {
        guard cards?.postageEnabled != true, let today = cards?.today, today.status != "withdrawn" else { return nil }
        return today
    }

    // MARK: Choosing when it comes

    /// A choice on "Seal it for the day": its title and what it means.
    /// `theirDay` is the day of their 7 a.m. mail by their clock (from the
    /// server once it's read; until then, the sender's next morning).
    static func arrivalChoice(
        _ arrival: HolidayCardArrival,
        cards: HolidayCardsResponse,
        recipient: HolidayCardRecipient,
        theirDay: String?,
        calendar: Calendar = .current
    ) -> (title: String, detail: String) {
        if case let .list(entries) = recipient { return listArrivalChoice(arrival, cards: cards, entries: entries, calendar: calendar) }
        if recipient.isEmail, let later = emailLaterChoice(arrival, cards: cards, calendar: calendar) { return later }
        // Their mail comes at 7 a.m. where they live: never turned into this phone's time.
        let day = shortDay(theirDay ?? cards.nextRoundAt, calendar: calendar)
        let name = switch recipient {
        case let .person(_, full): firstName(full)
        case .email, .link, .list: "they"
        }
        switch arrival {
        case .nextMorning:
            return ("With the morning mail", "\(day), about 7 a.m. where \(name) lives. They can open it right away.")
        case .sealedChristmas:
            return sealedChoice(recipient, cards: cards, day: day)
        case .christmasMorning:
            return ("On Christmas morning", "\(shortDay(cards.christmasMorningAt, calendar: calendar)), with the 7 a.m. mail.")
        case .now:
            // One person on Pantopus, right away (cards-next 3.3; only offered with `improved`).
            if case .person = recipient { return ("Right away", "Drops into their mailbox now, with a gentle notice.") }
            if recipient.isLink {
                return (
                    "Right away",
                    cards.improved
                        ? "Whoever opens your link can open and read the card right away — no account needed."
                        : "Whoever opens your link can open the card as soon as they join."
                )
            }
            return rightAwayByEmail(cards)
        }
    }

    /// A list's one choice, as each card reads it: every person's by their
    /// own clock (the days differ, so none is named), and an address's card
    /// waits for them to open the email, sealed until Christmas for both
    /// Christmas choices.
    static func listArrivalChoice(
        _ arrival: HolidayCardArrival,
        cards: HolidayCardsResponse,
        entries: [HolidayCardRecipient],
        calendar: Calendar = .current
    ) -> (title: String, detail: String) {
        let people = entries.contains { !$0.isEmail }
        let emails = entries.contains(where: \.isEmail)
        if !people {
            if let later = emailLaterChoice(arrival, cards: cards, calendar: calendar) { return later }
            if cards.improved {
                return arrival == .sealedChristmas
                    ? (
                        "Sealed until Christmas",
                        "They get an email now with a “Do not open until Christmas” seal, and a reminder on Christmas morning "
                            + "when it opens."
                    )
                    : rightAwayByEmail(cards)
            }
            return arrival == .sealedChristmas
                ? (
                    "Sealed until Christmas",
                    "They get an email now. Once they join with that address, it waits in their mailbox with a "
                        + "“Do not open until Christmas” seal. It opens on December 25."
                )
                : ("Right away, by email", "They get an email now and can open it once they join with that address.")
        }
        let byEmail = emails ? listEmailSentence(arrival, cards: cards, calendar: calendar) : ""
        switch arrival {
        case .sealedChristmas:
            return (
                "Sealed until Christmas",
                "It comes with each person’s next 7 a.m. mail and waits in their mailbox with a “Do not open "
                    + "until Christmas” seal. It opens on December 25.\(byEmail)"
            )
        case .christmasMorning:
            return (
                "On Christmas morning",
                "\(shortDay(cards.christmasMorningAt, calendar: calendar)), with the 7 a.m. mail where each person lives.\(byEmail)"
            )
        case .nextMorning, .now:
            return ("With the morning mail", "With each person’s next 7 a.m. mail, where they live. They can open it right away.\(byEmail)")
        }
    }

    /// A card to an address (or a list of only addresses) set for later: its
    /// email goes at the sender's next 7 a.m. or at 7 a.m. on Christmas
    /// morning, said on this phone's clock (their time zone isn't known).
    /// Nil for the choices worded as before.
    private static func emailLaterChoice(
        _ arrival: HolidayCardArrival,
        cards: HolidayCardsResponse,
        calendar: Calendar
    ) -> (title: String, detail: String)? {
        guard arrival == .nextMorning || arrival == .christmasMorning else { return nil }
        let morning = arrival == .nextMorning
        let at = dayAndTime(morning ? cards.nextRoundAt : cards.christmasMorningAt, calendar: calendar)
        return (
            morning ? "With the morning mail" : "On Christmas morning",
            "We email them \(at), your time. " + (cards.improved
                ? "They can open and read it right in their browser."
                : "They can open it once they join with that address.")
        )
    }

    /// A list with people and addresses: when the addresses' emails go, after
    /// the people's words. Without `arrivals.email_all` an address's email
    /// goes now (its card sealed for both Christmas choices), as before.
    private static func listEmailSentence(_ arrival: HolidayCardArrival, cards: HolidayCardsResponse, calendar: Calendar) -> String {
        guard cards.emailAllArrivals != nil, arrival == .nextMorning || arrival == .christmasMorning else {
            return arrival == .nextMorning
                ? " People not on Pantopus get the email right away."
                : " People not on Pantopus get the email now; their card opens on Christmas morning."
        }
        let at = dayAndTime(arrival == .nextMorning ? cards.nextRoundAt : cards.christmasMorningAt, calendar: calendar)
        return " People not on Pantopus get the email \(at), your time."
    }

    /// The take-back note under the choices. Before it's sent their clock
    /// isn't known here; the sent card says the time on this one.
    static func sealNote(byEmail: Bool) -> String {
        byEmail ? "You can take it back until they open it." : "You can take it back until the carrier picks it up at 7 a.m. their time."
    }

    /// The take-back note for a list: each card comes back on its own.
    static func sealNote(list entries: [HolidayCardRecipient]) -> String {
        let people = entries.contains { !$0.isEmail }
        let emails = entries.contains(where: \.isEmail)
        if people, emails {
            return "You can take each card back until the carrier picks it up at 7 a.m. their time, or by email until they open it."
        }
        guard people else { return "You can take each card back until they open it." }
        return "You can take each card back until the carrier picks it up at 7 a.m. their time."
    }

    /// What will happen to one card on a list's look, in a line.
    static func listLine(_ line: HolidayCardListLine, calendar: Calendar = .current) -> String {
        switch line.status {
        case "refused": return "\(line.error ?? "It can’t go.") Won’t be sent."
        case "already_sent": return "Already sent."
        default: break
        }
        if line.byEmail {
            if let sendAt = line.emailSendAt { return "Gets an email \(dayAndTime(sendAt, calendar: calendar)), your time." }
            return line.arrival == .sealedChristmas ? "Gets an email now. The card opens on Christmas morning." : "Gets an email now."
        }
        let day = shortDay(line.arrivesOn, calendar: calendar)
        switch line.arrival {
        case .christmasMorning: return "On Christmas morning, with their 7 a.m. mail."
        case .sealedChristmas: return "Comes with their 7 a.m. mail on \(day), sealed until Christmas."
        default: return "With their 7 a.m. mail on \(day)."
        }
    }

    static let sealNoteByLink = "You can take it back until someone opens it."

    /// A card to a person that comes right away (cards-next 3.3).
    static let rightAwayNote = "This card delivers right away, so it can’t be taken back after you seal it."

    /// A caption as a sentence for VoiceOver: most end in a full stop or a
    /// question mark already.
    static func captionSentence(_ caption: String?) -> String {
        let text = MailPieceModel.firstText(caption) ?? "A Christmas picture"
        return text.last.map { ".!?".contains($0) } == true ? text : text + "."
    }
}

// MARK: - Sealed until Christmas, and right away by email

extension HolidayCardWords {
    /// "Sealed until Christmas" for one card, by how it reaches them (with `improved`, a link or email card opens
    /// before they join).
    static func sealedChoice(
        _ recipient: HolidayCardRecipient,
        cards: HolidayCardsResponse,
        day: String
    ) -> (title: String, detail: String) {
        let title = "Sealed until Christmas"
        if recipient.isLink, cards.improved {
            return (
                title,
                "It waits with a “Do not open until Christmas” seal and opens on December 25. "
                    + "They can save it to their mailbox anytime."
            )
        }
        if recipient.isEmail, cards.improved {
            return (
                title,
                "They get an email now with a “Do not open until Christmas” seal, and a reminder on Christmas morning when it opens."
            )
        }
        if recipient.isLink {
            return (
                title,
                "Whoever opens your link and joins gets it now, with a “Do not open until Christmas” seal. It opens on December 25."
            )
        }
        if recipient.isEmail {
            return (
                title,
                "They get an email now. Once they join with that address, it waits in their mailbox with a “Do not open "
                    + "until Christmas” seal. It opens on December 25."
            )
        }
        return (
            title,
            "It comes with the \(day) morning mail and waits in their mailbox with a “Do not open until Christmas” seal. "
                + "It opens on December 25."
        )
    }

    /// "Right away, by email": with `improved` they read it in their browser before joining.
    static func rightAwayByEmail(_ cards: HolidayCardsResponse) -> (title: String, detail: String) {
        (
            "Right away, by email",
            cards.improved
                ? "They get an email now and can open and read it right in their browser — no account needed."
                : "They get an email now and can open it once they join with that address."
        )
    }

    /// Under "Send it by link": with `improved` it opens before they join.
    static func linkLine(improved: Bool) -> String {
        improved
            ? "Text it, or paste it anywhere. They can open it right away, and save it to keep it."
            : "Text it, or paste it anywhere. The first person to open it keeps the card."
    }

    /// Under their email address: with `improved` they read it before joining.
    static func emailLine(improved: Bool) -> String {
        guard improved else {
            return "They get an email saying you sent them a Christmas card. They join Pantopus with this address to open it. "
                + "The email never shows your note."
        }
        return "They get an email saying you sent them a Christmas card. They can open and read it right away — no account "
            + "needed — and join free anytime to keep it or write back. The email never shows your note."
    }
}
