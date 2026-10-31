//
//  MailSentWords.swift
//  Pantopus
//
//  What Sent says (launch key `mailbox`): who a card went to, where it is
//  now, the day groups on the sender's own clock, and its trail. Only what
//  a sender may know: when it arrives, never when it was opened. Their mail
//  comes at 7 a.m. where they live, so a card says "their 7 a.m. mail" and
//  never turns their 7 a.m. into this phone's time.
//

import Foundation

enum MailSentWords {
    /// "To Maya O. · Christmas card", or "To m***@example.com · by email".
    static func toLine(_ piece: MailSentPiece) -> String {
        "To \(piece.toName) · \(piece.byEmail ? "by email" : "Christmas card")"
    }

    /// Where it is now, as its row and its page say it.
    static func statusLine(_ piece: MailSentPiece, calendar: Calendar = .current) -> String {
        let day = HolidayCardWords.shortDay(piece.arrivesOn ?? piece.arrivesAt, calendar: calendar)
        switch piece.status {
        case .waiting:
            if piece.arrival == .christmasMorning { return "Arrives on Christmas morning" }
            return "Arrives with their 7 a.m. mail on \(day)" + (piece.sealed ? ", sealed until Christmas" : "")
        case .pickedUp:
            return "Arrives on Christmas morning"
        case .delivered:
            return piece.sealed ? "In their mailbox, sealed until Christmas" : "In their mailbox since \(day)"
        case .emailWaiting:
            return "Waiting for them to open the email"
        case .claimed:
            return "They joined Pantopus and have it"
        case .expired:
            return "They didn’t open the email in 90 days"
        }
    }

    /// The day group a card was sent in, on this phone's clock: "Today",
    /// "Yesterday", a weekday within the week, else "Wednesday, December 2".
    static func dayTitle(_ sentAt: String?, now: Date = Date(), calendar: Calendar = .current) -> String {
        guard let date = MailDates.parse(sentAt) else { return "Earlier" }
        switch MailDates.daysBetween(date, now, calendar: calendar) {
        case ..<1: return "Today"
        case 1: return "Yesterday"
        case 2..<7: return format(date, "EEEE", calendar: calendar)
        default: return format(date, "EEEE, MMMM d", calendar: calendar)
        }
    }

    /// "Sent Wed, Dec 9 · In their mailbox since Thu, Dec 10".
    static func sentLine(_ piece: MailSentPiece, calendar: Calendar = .current) -> String {
        let sent = HolidayCardWords.shortDay(piece.sentAt, calendar: calendar)
        return (sent.isEmpty ? "" : "Sent \(sent) · ") + statusLine(piece, calendar: calendar)
    }

    /// Until when it can be taken back.
    static func takeBackLine(_ piece: MailSentPiece, calendar: Calendar = .current) -> String {
        guard !piece.byEmail, let until = MailDates.parse(piece.takeBackUntil) else {
            return "You can take it back until they open it."
        }
        let when = "\(MailDates.time(until, calendar: calendar)) \(HolidayCardWords.shortDay(piece.takeBackUntil, calendar: calendar))"
        return "It waits for the carrier until \(when) (your clock)."
    }

    /// The confirm's words: the card's own, and the day freed again only
    /// for a card sent today.
    static func takeBackConfirm(_ piece: MailSentPiece, now: Date = Date(), calendar: Calendar = .current) -> String {
        let first = piece.byEmail
            ? "The link in their email will say you took it back."
            : "It won’t go out with the morning mail."
        let sentToday = MailDates.parse(piece.sentAt).map { calendar.isDate($0, inSameDayAs: now) } ?? false
        return sentToday ? "\(first) You can send a card again today." : first
    }

    // MARK: Its trail

    /// A step's words: "Sealed by you", "Delivered with Maya’s 7 a.m. mail" …
    static func trailTitle(_ step: MailSentPiece.TrailStep, piece: MailSentPiece) -> String {
        let first = HolidayCardWords.possessive(HolidayCardWords.firstName(piece.toName))
        let title = switch step.step {
        case "sealed": "Sealed by you"
        case "delivered" where piece.arrival == .christmasMorning: "Delivered with \(first) Christmas morning mail"
        case "delivered": "Delivered with \(first) 7 a.m. mail"
        case "picked_up": "Picked up by the carrier"
        case "opens": "Opens on Christmas morning"
        // Once claimed, the name is whoever joined, not the address it went to.
        case "emailed": "Emailed to \(piece.status == .claimed ? "them" : piece.toName)"
        // Not yet: the drawing's words, as on the web and Android.
        case "joined" where !step.done: "They join Pantopus and have it"
        case "joined": "They joined Pantopus and have it"
        case "returned": "They didn’t open the email in 90 days"
        default: step.step.replacingOccurrences(of: "_", with: " ").capitalized
        }
        return step.done ? title : "\(title) · not yet"
    }

    /// "WED DEC 9 · 6:12 PM" for a moment (this phone's clock), "THU DEC 10"
    /// for a day (theirs); nil for a step not reached yet.
    static func trailDetail(_ step: MailSentPiece.TrailStep, calendar: Calendar = .current) -> String? {
        guard step.done else { return nil }
        if let at = MailDates.parse(step.at) {
            return format(at, "EEE MMM d · h:mm a", calendar: calendar, posix: true).uppercased()
        }
        if let on = step.on.flatMap(MailDates.parseDay) {
            return format(on, "EEE MMM d", calendar: calendar, posix: true).uppercased()
        }
        return nil
    }

    private static func format(_ date: Date, _ pattern: String, calendar: Calendar, posix: Bool = false) -> String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.locale = Locale(identifier: posix ? "en_US_POSIX" : "en_US")
        formatter.dateFormat = pattern
        return formatter.string(from: date)
    }
}

extension MailPieceModel {
    /// A sent card's envelope as they got it: postmarked by their clock
    /// (none while it waits for the pickup), sealed while it's sealed, never
    /// torn open. Addressed to the name it went to, never an address.
    static func sent(_ piece: MailSentPiece, calendar: Calendar = .current) -> MailPieceModel {
        let posted = piece.envelope.postmarkedOn.flatMap(MailDates.parseDay)
        let design = HolidayCardDesign(
            id: piece.card.design,
            number: piece.card.number ?? 0,
            caption: piece.card.caption ?? "",
            paper: piece.card.paper ?? "",
            height: piece.card.height
        )
        return MailPieceModel(
            id: piece.id,
            kind: .letter,
            isSpecialDelivery: false,
            trust: .neighbor,
            from: MailPieceModel.firstText(piece.envelope.from) ?? "You",
            fromLine: nil,
            to: piece.toName,
            toLine: nil,
            note: nil,
            postmarkTown: nil,
            postmarkDate: posted.map { MailDates.postmarkDay($0, calendar: calendar) } ?? "",
            postmarkYear: String(piece.card.year),
            isOpened: false,
            isFaded: false,
            stamp: piece.card.number.map(MailStampArt.forCard(number:)) ?? MailStampArt.forPiece(piece.id),
            peekLine: nil,
            meta: MailPieceMeta(parts: [], due: nil, dueIsSettled: false),
            card: MailCard(design: design, year: piece.card.year, sealed: piece.sealed),
            isPostmarked: posted != nil
        )
    }
}
