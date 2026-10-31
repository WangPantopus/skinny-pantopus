//
//  MailPieceModel.swift
//  Pantopus
//
//  What a piece of mail looks like in the Mailbox (Mail tab drawings, boards
//  "MailPiece" and "Main"): the object it is (Mail build contract `kind`),
//  how its sender was checked, its stamp or printed postage, its postmark,
//  the return address and the address it came to, sealed or torn open, and
//  how old it is. Built from a drawer row; `MailPieceView` draws it.
//

import Foundation

/// What a piece is drawn as.
enum MailPieceKind: String, CaseIterable {
    case letter, bill, notice, postcard, booklet, parcel, bundle

    /// The server's `kind` first. An older server sends none, so the stored
    /// type decides the same way the server does; anything else is a letter.
    static func of(_ item: MailItem) -> MailPieceKind {
        if let kind = item.kind {
            return MailPieceKind(rawValue: kind.lowercased()) ?? .letter
        }
        switch (item.mailType ?? item.type).lowercased() {
        case "bill", "statement": return .bill
        case "notice": return .notice
        case "promotion", "ad": return .postcard
        case "book", "booklet": return .booklet
        case "package", "packet": return .parcel
        default: return .letter
        }
    }

    /// What VoiceOver calls it.
    var spokenName: String {
        switch self {
        case .letter: "Letter"
        case .bill: "Bill"
        case .notice: "Notice"
        case .postcard: "Postcard"
        case .booklet: "Booklet"
        case .parcel: "Parcel"
        case .bundle: "Bundle"
        }
    }

    /// Envelopes are sealed until opened; a postcard, a booklet and a parcel aren't.
    var isEnvelope: Bool {
        switch self {
        case .letter, .bill, .notice, .bundle: true
        case .postcard, .booklet, .parcel: false
        }
    }
}

/// How Pantopus checked the sender, as the piece shows it.
enum MailPieceTrust {
    /// `pantopusBusiness`: a business with a Pantopus account that isn't verified.
    case business, government, utility, pantopus, pantopusBusiness, neighbor, unknown

    init(senderTrust: String?, fromPantopus: Bool, fromBusiness: Bool = false) {
        if fromPantopus {
            self = .pantopus
            return
        }
        switch senderTrust {
        case "verified_business": self = .business
        case "verified_gov": self = .government
        case "verified_utility": self = .utility
        case "pantopus_user": self = fromBusiness ? .pantopusBusiness : .neighbor
        default: self = .unknown
        }
    }

    var label: String {
        switch self {
        case .business: "Verified business"
        case .government: "Verified government"
        case .utility: "Verified utility"
        case .pantopus: "From Pantopus"
        case .pantopusBusiness: "Business on Pantopus"
        case .neighbor: "Pantopus neighbor"
        case .unknown: "Unverified sender"
        }
    }

    /// The label inside a sentence ("verified business", "a Pantopus
    /// neighbor"); nil for Pantopus's own mail, which its sender already says.
    var spokenLabel: String? {
        switch self {
        case .pantopus: nil
        case .pantopusBusiness: "a business on Pantopus"
        case .neighbor: "a Pantopus neighbor"
        default: label.lowercased()
        }
    }

    /// The line on verified senders' printed postage.
    var indicia: String? {
        switch self {
        case .business: "BUSINESS"
        case .government: "GOVERNMENT"
        case .utility: "UTILITY"
        case .pantopus, .pantopusBusiness, .neighbor, .unknown: nil
        }
    }

    /// People and unverified senders stamp their mail; verified senders and
    /// Pantopus print postage.
    var usesStamp: Bool {
        self == .neighbor || self == .pantopusBusiness || self == .unknown
    }
}

/// The three stamp designs (board "Parts"), picked steadily per piece.
enum MailStampArt: CaseIterable {
    case fir, peak, river

    static func forPiece(_ id: String) -> MailStampArt {
        let sum = id.unicodeScalars.reduce(0) { $0 &+ Int($1.value) }
        return allCases[abs(sum) % allCases.count]
    }

    /// A Christmas card's stamp comes from its picture's number, the same on
    /// every app and before it's sent: 1, 4, 7 … fir; 2, 5, 8 … peak; 3, 6,
    /// 9 … river.
    static func forCard(number: Int) -> MailStampArt {
        allCases[((number - 1) % allCases.count + allCases.count) % allCases.count]
    }
}

/// Who a piece came to: the person, or the Home for Home mail.
struct MailPieceRecipient: Hashable {
    let name: String
    let addressLine: String?

    /// Who a piece came to: Home mail to the Home at its address, the rest to
    /// the person at their home's address.
    static func of(
        _ mail: DrawerItemsResponse.DrawerMail,
        homeMail: Bool,
        homes: [DrawerListResponse.MailboxHome],
        personName: String
    ) -> MailPieceRecipient {
        let ownHome = homes.first(where: \.isOpen)
        if homeMail || mail.item.recipientHomeId != nil {
            let home = homes.first { $0.homeId == mail.item.recipientHomeId } ?? ownHome
            let name = MailPieceModel.firstText(mail.item.attnLabel, home?.name) ?? "Current resident"
            return MailPieceRecipient(name: name, addressLine: home?.addressLine)
        }
        return MailPieceRecipient(name: personName, addressLine: ownHome?.addressLine)
    }

    /// The signed-in person's name, as an envelope is addressed.
    @MainActor static var personName: String {
        if case let .signedIn(user) = AuthManager.shared.state,
           let name = MailPieceModel.firstText(user.displayName) {
            return name
        }
        return "You"
    }
}

/// The moment and calendar the pieces are drawn for ("today", "Mon", fading).
struct MailClock {
    let now: Date
    let calendar: Calendar

    static var current: MailClock {
        MailClock(now: Date(), calendar: .current)
    }
}

/// One drawn piece.
struct MailPieceModel: Identifiable, Hashable {
    let id: String
    let kind: MailPieceKind
    let isSpecialDelivery: Bool
    let trust: MailPieceTrust
    let from: String
    let fromLine: String?
    let to: String
    let toLine: String?
    /// Printed on the outside: a bill's "Statement enclosed", a postcard's
    /// message, a booklet's title, a parcel's label note.
    let note: String?
    let postmarkTown: String?
    /// "OCT 27" and "2026".
    let postmarkDate: String
    let postmarkYear: String
    let isOpened: Bool
    /// Older mail that's been read fades, as paper does.
    let isFaded: Bool
    let stamp: MailStampArt
    /// The subject, on the sheet that peeks out of an opened envelope.
    let peekLine: String?
    /// The words under the piece: when it came, opened or not, what's due.
    let meta: MailPieceMeta
    /// A Christmas card (`holiday_cards`): the red envelope, sealed until
    /// Christmas morning or with its picture peeking out once opened.
    var card: MailCard?

    /// One sentence: "Bill from Alder Creek Water, verified utility, sealed,
    /// $42.10 due Fri, Nov 7."
    var accessibilityLabel: String {
        if let card {
            let state = card.sealed ? ", sealed until Christmas morning" : isOpened ? ", opened" : ", in its envelope"
            return "Christmas card from \(from)\(state)."
        }
        let what = isSpecialDelivery ? "Special delivery, \(kind.spokenName.lowercased())" : kind.spokenName
        var parts = ["\(what) from \(from)"]
        if let trust = trust.spokenLabel { parts.append(trust) }
        if kind.isEnvelope { parts.append(isOpened ? "opened" : "sealed") }
        // What the piece shows besides its sender: an opened envelope's subject,
        // a postcard's words, a booklet's or parcel's title, a bundle's band.
        let shownNote = [.postcard, .booklet, .parcel, .bundle].contains(kind) ? note : nil
        if let shown = peekLine ?? shownNote {
            parts.append(shown.replacingOccurrences(of: " · ", with: ", "))
        }
        if let due = meta.due { parts.append(due) }
        let sentence = parts.joined(separator: ", ")
        // A postcard's own words may already end the sentence.
        return sentence.last.map { ".!?".contains($0) } == true ? sentence : sentence + "."
    }

    /// The sentence, then when it came ("7:42 a.m." already ends one).
    var spokenWithArrival: String {
        guard let when = meta.parts.first else { return accessibilityLabel }
        return "\(accessibilityLabel) Came \(when)\(when.hasSuffix(".") ? "" : ".")"
    }
}

/// The line under a piece: "7:42 a.m. · Opened · $184.00 due Fri, Nov 7".
struct MailPieceMeta: Hashable {
    let parts: [String]
    /// A due amount or date, drawn in the warning ink; "Paid" in the verified one.
    let due: String?
    let dueIsSettled: Bool
}

/// A day's mail in the list ("Today", "Yesterday", "This past week", "Earlier").
struct MailPieceSection: Identifiable, Hashable {
    let id: String
    let title: String
    let pieces: [MailPieceModel]
}

extension MailPieceModel {
    /// A drawer row as a piece. `opened` is the row's read state, or a letter
    /// opened since the list loaded.
    init(
        mail: DrawerItemsResponse.DrawerMail,
        recipient: MailPieceRecipient,
        opened: Bool,
        clock: MailClock = .current
    ) {
        let now = clock.now
        let calendar = clock.calendar
        let item = mail.item
        let kind = MailPieceKind.of(item)
        // A sealed Christmas card stays shut until Christmas morning, whatever was marked.
        let sealedCard = item.card?.sealed == true
        let trust = MailPieceTrust(
            senderTrust: mail.senderTrust,
            fromPantopus: item.fromPantopus,
            fromBusiness: Self.firstText(item.senderBusinessName) != nil || item.senderEntityId != nil
        )
        let from = Self.firstText(mail.senderDisplay, item.senderBusinessName, mail.sender?.name) ?? "Unknown sender"
        let delivered = MailDates.parse(item.deliveredAt) ?? MailDates.parse(item.createdAt) ?? now
        let postmarked = item.postmark?.date.flatMap(MailDates.parseDay) ?? delivered
        let isOpened = kind.isEnvelope ? opened && !sealedCard : true
        let ageDays = MailDates.daysBetween(delivered, now, calendar: calendar)
        let subject = Self.firstText(item.displayTitle, item.subject)
        let meta = MailPieceMeta.make(for: mail, kind: kind, delivered: delivered, opened: opened, clock: clock)

        id = item.id
        self.kind = kind
        isSpecialDelivery = item.specialDelivery
        self.trust = trust
        self.from = from
        fromLine = Self.firstText(item.senderAddress)
        to = recipient.name
        toLine = recipient.addressLine
        note = Self.note(kind: kind, item: item, subject: subject)
        postmarkTown = Self.firstText(item.postmark?.town)?.uppercased()
        postmarkDate = MailDates.postmarkDay(postmarked, calendar: calendar)
        postmarkYear = String(calendar.component(.year, from: postmarked))
        self.isOpened = isOpened
        // Mail from before today that's been read (or never sealed) fades;
        // a sealed envelope stays bright until it's opened.
        isFaded = ageDays >= 1 && isOpened
        stamp = item.card?.number.map(MailStampArt.forCard(number:)) ?? MailStampArt.forPiece(item.id)
        // An opened card shows its picture over the torn top, not a line.
        peekLine = isOpened && kind.isEnvelope && item.card == nil ? subject : nil
        self.meta = meta
        card = item.card
    }

    private static func note(kind: MailPieceKind, item: MailItem, subject: String?) -> String? {
        switch kind {
        case .bill:
            item.invoice == nil ? "Statement enclosed" : "Invoice enclosed"
        case .notice:
            "Important notice"
        case .postcard:
            // A postcard reads without opening.
            firstText(item.previewText, item.content, subject)
        case .booklet, .parcel:
            subject
        case .bundle:
            firstText(item.bundleLabel) ?? item.bundleItemCount.map { "\($0) pieces" } ?? subject
        case .letter:
            nil
        }
    }

    static func firstText(_ values: String?...) -> String? {
        values.lazy
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first { !$0.isEmpty }
    }
}

extension MailPieceMeta {
    static func make(
        for mail: DrawerItemsResponse.DrawerMail,
        kind: MailPieceKind,
        delivered: Date,
        opened: Bool,
        clock: MailClock
    ) -> MailPieceMeta {
        let item = mail.item
        let dueDate = mail.dueDate
        let calendar = clock.calendar
        var parts = [MailDates.arrivalLabel(delivered, now: clock.now, calendar: calendar)]
        if let card = item.card {
            // "7:42 a.m. · Christmas card · Opens Christmas morning" (or "· Opened").
            parts.append("Christmas card")
            if card.sealed {
                parts.append("Opens Christmas morning")
            } else if opened {
                parts.append("Opened")
            }
            return MailPieceMeta(parts: parts, due: nil, dueIsSettled: false)
        }
        if kind.isEnvelope, opened { parts.append("Opened") }
        if kind == .postcard { parts.append("Postcard") }
        if item.onCounter { parts.append("On the Counter") }
        if let invoice = item.invoice, let status = invoice.status {
            switch status {
            case "paid":
                return MailPieceMeta(parts: parts, due: "Paid", dueIsSettled: true)
            case "void":
                return MailPieceMeta(parts: parts, due: "Cancelled by the sender", dueIsSettled: true)
            default:
                let amount = invoice.totalCents.map { MailDates.money(cents: $0, currency: invoice.currency) }
                let day = (invoice.dueDate ?? dueDate).flatMap(MailDates.parseDay)
                return MailPieceMeta(parts: parts, due: dueText(amount: amount, day: day, clock: clock), dueIsSettled: false)
            }
        }
        let day = dueDate.flatMap(MailDates.parseDay)
        let amount = item.keyFacts.first { $0.field.lowercased().contains("amount") }?.value
        return MailPieceMeta(parts: parts, due: dueText(amount: amount, day: day, clock: clock), dueIsSettled: false)
    }

    /// "$184.00 due Fri, Nov 7", "Due today", "Overdue since Mon, Oct 26", or nil.
    private static func dueText(amount: String?, day: Date?, clock: MailClock) -> String? {
        guard let day else { return nil }
        let daysLeft = MailDates.daysBetween(clock.now, day, calendar: clock.calendar)
        let when = switch daysLeft {
        case 0: "today"
        case 1: "tomorrow"
        default: MailDates.dueDay(day, calendar: clock.calendar)
        }
        guard daysLeft >= 0 else {
            guard let amount, !amount.isEmpty else { return "Overdue since \(when)" }
            return "\(amount) overdue since \(when)"
        }
        guard let amount, !amount.isEmpty else { return "Due \(when)" }
        return "\(amount) due \(when)"
    }

    /// The parts and the due text as one line.
    var line: String {
        (parts + [due].compactMap(\.self)).joined(separator: " · ")
    }
}

/// Date reading and the postal date words.
enum MailDates {
    static func parse(_ iso: String?) -> Date? {
        guard let iso, !iso.isEmpty else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    }

    /// A calendar day ("2026-11-07"), at noon so no zone moves it a day.
    static func parseDay(_ day: String) -> Date? {
        let parts = day.prefix(10).split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        var components = DateComponents()
        components.year = parts[0]
        components.month = parts[1]
        components.day = parts[2]
        components.hour = 12
        return Calendar.current.date(from: components)
    }

    static func daysBetween(_ start: Date, _ end: Date, calendar: Calendar) -> Int {
        let from = calendar.startOfDay(for: start)
        let to = calendar.startOfDay(for: end)
        return calendar.dateComponents([.day], from: from, to: to).day ?? 0
    }

    /// "OCT 27".
    static func postmarkDay(_ date: Date, calendar: Calendar) -> String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date).uppercased()
    }

    /// "7:42 a.m." today, "Mon" within the week, "Oct 12" before that.
    static func arrivalLabel(_ date: Date, now: Date, calendar: Calendar) -> String {
        let days = daysBetween(date, now, calendar: calendar)
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.locale = Locale(identifier: "en_US")
        switch days {
        case ..<1:
            return time(date, calendar: calendar)
        case 1..<7:
            formatter.dateFormat = "EEE"
        default:
            formatter.dateFormat = "MMM d"
        }
        return formatter.string(from: date)
    }

    /// "7:42 a.m."
    static func time(_ date: Date, calendar: Calendar) -> String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.locale = Locale(identifier: "en_US")
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: date)
            .replacingOccurrences(of: "AM", with: "a.m.")
            .replacingOccurrences(of: "PM", with: "p.m.")
    }

    /// "Fri, Nov 7".
    static func dueDay(_ date: Date, calendar: Calendar) -> String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US")
        formatter.dateFormat = "EEE, MMM d"
        return formatter.string(from: date)
    }

    /// "$184.00".
    static func money(cents: Int, currency: String?) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = (currency ?? "usd").uppercased()
        formatter.locale = Locale(identifier: "en_US")
        return formatter.string(from: NSNumber(value: Double(cents) / 100)) ?? "$\(cents / 100)"
    }

    /// The list's day sections, newest first.
    static func sectionTitle(for date: Date, now: Date, calendar: Calendar) -> (id: String, title: String) {
        switch daysBetween(date, now, calendar: calendar) {
        case ..<1: ("today", "Today")
        case 1: ("yesterday", "Yesterday")
        case 2..<7: ("week", "This past week")
        default: ("earlier", "Earlier")
        }
    }
}
