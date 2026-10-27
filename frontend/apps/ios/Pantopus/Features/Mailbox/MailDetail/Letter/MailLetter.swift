//
//  MailLetter.swift
//  Pantopus
//
//  A piece as its letter page draws it (Mail tab drawings, boards "R5-Bill",
//  "R6-Envelope" and "R8-Ballot"; Mail build contract v1): the envelope it
//  came in, Pantopus's note on it, the letter on paper with what's enclosed,
//  where it stands (on the counter, filed, paid) and its trail from the
//  postmark to now.
//

import Foundation

struct MailLetter: Hashable {
    /// The envelope at the top of the page, drawn opened.
    let piece: MailPieceModel
    let kind: MailPieceKind
    let trust: MailPieceTrust
    /// "Pantopus read this for you": a few sentences and the key facts.
    let summary: MailSummary?
    /// The letterhead: who sent it and their address line.
    let senderName: String
    let senderLine: String?
    /// Who it came to, as the address block on the letter.
    let recipient: MailPieceRecipient
    /// "October 25, 2026".
    let dateLine: String
    /// A reference the sender printed ("Invoice 1042"); nil when they gave none.
    let reference: String?
    let paragraphs: [String]
    let enclosures: [MailEnclosure]
    /// Due, or put on the counter, and not done yet.
    let onCounter: Bool
    /// Filed in the Vault, or archived: it can come back to Incoming.
    let isFiled: Bool
    /// The bill's invoice, with its live status.
    let invoice: MailInvoiceRef?
    /// Asks to be acknowledged, and whether it has been.
    let asksAcknowledgement: Bool
    let isAcknowledged: Bool
    /// The Home it came to: its Vault folders are the Home's shared cabinet.
    let homeId: String?
    /// The drawer it's in (`personal`, `home`, `business`), for its folders.
    let drawer: String
    private(set) var trail: [MailTrailStep]

    /// Pay shows while the invoice is owed (contract: sent, viewed, overdue).
    var payable: MailInvoiceRef? {
        guard let invoice, ["sent", "viewed", "overdue"].contains(invoice.status ?? "") else { return nil }
        return invoice
    }

    /// "Pay $184.00".
    var payLabel: String {
        guard let cents = payable?.totalCents else { return "Pay" }
        return "Pay \(MailDates.money(cents: cents, currency: payable?.currency))"
    }

    var isPaid: Bool {
        invoice?.status == "paid"
    }

    /// The letter just opened on this page: its trail's Opened step gets the time.
    func opened(at date: Date, calendar: Calendar = .current) -> MailLetter {
        var copy = self
        copy.trail = trail.map { step in
            guard step.id == "opened", step.detail == nil else { return step }
            return MailTrailStep(
                id: step.id,
                title: step.title,
                detail: Self.stampMoment(date, calendar: calendar),
                isDone: true,
                isReaders: true
            )
        }
        return copy
    }
}

/// One step of a piece's trail: postmarked, delivered, opened, then where it
/// stands now.
struct MailTrailStep: Hashable, Identifiable {
    let id: String
    let title: String
    /// "SUN OCT 26 · VANCOUVER"; nil for a step that hasn't happened.
    let detail: String?
    let isDone: Bool
    /// The step the reader did (drawn in the reader's colour).
    let isReaders: Bool
}

extension MailLetter {
    /// The letter page's projection of a detail answer.
    @MainActor
    static func make(
        detail: MailDetailResponse.MailDetail,
        homes: [DrawerListResponse.MailboxHome],
        personName: String,
        clock: MailClock = .current
    ) -> MailLetter? {
        guard let row = detail.piece else { return nil }
        let item = detail.item
        let drawer = DrawerSlug.of(item)
        let recipient = MailPieceRecipient.of(row, homeMail: drawer == "home", homes: homes, personName: personName)
        let piece = MailPieceModel(mail: row, recipient: recipient, opened: true, clock: clock)
        let posted = item.postmark?.date.flatMap(MailDates.parseDay)
            ?? MailDates.parse(item.deliveredAt) ?? MailDates.parse(item.createdAt) ?? clock.now
        return MailLetter(
            piece: piece,
            kind: piece.kind,
            trust: piece.trust,
            summary: item.summary,
            senderName: piece.from,
            senderLine: piece.fromLine,
            recipient: recipient,
            dateLine: longDate(posted, calendar: clock.calendar),
            reference: reference(in: detail.object),
            paragraphs: paragraphs(item.content ?? item.previewText),
            enclosures: item.enclosures,
            onCounter: item.onCounter,
            isFiled: isFiled(item),
            invoice: item.invoice,
            // Certified mail asks to be acknowledged, as a letter with `ack_required` does.
            asksAcknowledgement: (item.ackRequired ?? false) || item.certified,
            isAcknowledged: item.acknowledgedAt != nil || (item.ackStatus ?? "").lowercased() == "acknowledged",
            homeId: item.recipientHomeId,
            drawer: drawer,
            trail: trail(item: item, posted: posted, homes: homes, clock: clock)
        )
    }

    /// In the Vault (filed, with or without a folder) or archived: it can come back to Incoming.
    static func isFiled(_ item: MailItem) -> Bool {
        item.vaultFolderId != nil || item.lifecycle == "filed" || item.archived
    }

    /// "October 25, 2026".
    static func longDate(_ date: Date, calendar: Calendar) -> String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.locale = Locale(identifier: "en_US")
        formatter.dateFormat = "MMMM d, yyyy"
        return formatter.string(from: date)
    }

    /// The letter's text in paragraphs; single line breaks stay inside one.
    static func paragraphs(_ text: String?) -> [String] {
        (text ?? "")
            .components(separatedBy: "\n\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    /// A reference the sender printed on the letter, never one made up here.
    private static func reference(in object: JSONValue?) -> String? {
        let dict = object?.dictValue
        for key in ["reference", "reference_number", "invoice_number", "case_number", "account_number"] {
            if let value = dict?[key]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty {
                return value
            }
        }
        return nil
    }

    private static func trail(
        item: MailItem,
        posted: Date,
        homes: [DrawerListResponse.MailboxHome],
        clock: MailClock
    ) -> [MailTrailStep] {
        var steps: [MailTrailStep] = []
        let town = MailPieceModel.firstText(item.postmark?.town)?.uppercased()
        steps.append(MailTrailStep(
            id: "postmarked",
            title: "Postmarked",
            detail: [stampDay(posted, calendar: clock.calendar), town].compactMap(\.self).joined(separator: " · "),
            isDone: true,
            isReaders: false
        ))
        let delivered = MailDates.parse(item.deliveredAt) ?? MailDates.parse(item.createdAt)
        let home = item.recipientHomeId.flatMap { id in homes.first { $0.homeId == id } }
        steps.append(MailTrailStep(
            id: "delivered",
            title: home.map { "Delivered to \(MailPieceModel.firstText($0.name) ?? "your home")'s mailbox" }
                ?? "Delivered to your mailbox",
            detail: delivered.map { stampMoment($0, calendar: clock.calendar) },
            isDone: true,
            isReaders: false
        ))
        let opened = [item.firstOpenedAt, item.openedAt, item.viewedAt].lazy.compactMap { MailDates.parse($0) }.first
        steps.append(MailTrailStep(
            id: "opened",
            title: "Opened",
            detail: opened.map { stampMoment($0, calendar: clock.calendar) },
            isDone: true,
            isReaders: true
        ))
        if let acknowledged = MailDates.parse(item.acknowledgedAt) {
            steps.append(MailTrailStep(
                id: "acknowledged",
                title: "Acknowledged",
                detail: stampMoment(acknowledged, calendar: clock.calendar),
                isDone: true,
                isReaders: true
            ))
        }
        steps.append(standing(item: item))
        return steps
    }

    /// Where it stands now: paid, filed, on the counter, or nothing yet.
    private static func standing(item: MailItem) -> MailTrailStep {
        if item.invoice?.status == "paid" {
            return MailTrailStep(id: "standing", title: "Paid", detail: nil, isDone: true, isReaders: true)
        }
        if item.vaultFolderId != nil || item.lifecycle == "filed" {
            return MailTrailStep(id: "standing", title: "Filed in the Vault", detail: nil, isDone: true, isReaders: true)
        }
        if item.archived {
            return MailTrailStep(id: "standing", title: "Archived", detail: nil, isDone: true, isReaders: true)
        }
        if item.onCounter {
            return MailTrailStep(id: "standing", title: "On the counter", detail: nil, isDone: true, isReaders: true)
        }
        let what = item.invoice == nil ? "Filed" : "Paid or filed"
        return MailTrailStep(id: "standing", title: "\(what) · not yet", detail: nil, isDone: false, isReaders: false)
    }

    /// "SUN OCT 26".
    private static func stampDay(_ date: Date, calendar: Calendar) -> String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "EEE MMM d"
        return formatter.string(from: date).uppercased()
    }

    /// "MON OCT 27 · 7:42 AM".
    private static func stampMoment(_ date: Date, calendar: Calendar) -> String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "EEE MMM d · h:mm a"
        return formatter.string(from: date).uppercased()
    }
}

/// The drawer a piece is in, as the server names it.
enum DrawerSlug {
    static func of(_ item: MailItem) -> String {
        if item.recipientHomeId != nil { return "home" }
        if let drawer = item.drawer, ["personal", "home", "business"].contains(drawer) { return drawer }
        return "personal"
    }
}
