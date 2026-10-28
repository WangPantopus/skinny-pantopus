//
//  MailCounterItem.swift
//  Pantopus
//
//  A piece on the Counter (Mail tab drawings, board "R9-Counter"): its
//  manila due tag ("DUE NOV 7", "DUE TODAY", "OVERDUE", "SIGN"), the line
//  under it ("Pay $184.00 · due Fri, Nov 7") and its one button.
//

import Foundation

struct MailCounterItem: Identifiable {
    enum Action {
        case pay(invoiceId: String)
        case open
    }

    let piece: MailPieceModel
    /// The tag's words, one or two lines.
    let tag: String
    let lineTitle: String
    let lineDetail: String?
    /// Due today or overdue: the detail reads in the warning colour.
    let isPressing: Bool
    let action: Action
    let actionLabel: String

    var id: String {
        piece.id
    }

    /// One sentence for VoiceOver.
    var spokenLabel: String {
        [piece.accessibilityLabel, [lineTitle, lineDetail].compactMap(\.self).joined(separator: ", ")]
            .joined(separator: " ")
    }

    static func make(piece: MailPieceModel, mail: DrawerItemsResponse.DrawerMail, clock: MailClock) -> MailCounterItem {
        let item = mail.item
        let calendar = clock.calendar
        let dueDay = (item.invoice?.dueDate ?? mail.dueDate).flatMap(MailDates.parseDay)
        let daysLeft = dueDay.map { MailDates.daysBetween(clock.now, $0, calendar: calendar) }
        let payable = item.invoice.flatMap { ["sent", "viewed", "overdue"].contains($0.status ?? "") ? $0 : nil }
        let asksAcknowledgement = ((item.ackRequired ?? false) || item.certified) && item.acknowledgedAt == nil
        let isPressing = (daysLeft ?? 1) <= 0

        let tag: String = if let dueDay, let daysLeft {
            daysLeft < 0 ? "OVERDUE" : daysLeft == 0 ? "DUE\nTODAY" : "DUE\n\(MailDates.postmarkDay(dueDay, calendar: calendar))"
        } else if asksAcknowledgement {
            "SIGN"
        } else {
            "TO DO"
        }
        let detail: String? = if let dueDay, let daysLeft {
            switch daysLeft {
            case ..<0: "overdue since \(MailDates.dueDay(dueDay, calendar: calendar))"
            case 0: "due today"
            case 1: "due tomorrow"
            default: "due \(MailDates.dueDay(dueDay, calendar: calendar))"
            }
        } else {
            nil
        }

        if let payable {
            let amount = payable.totalCents.map { MailDates.money(cents: $0, currency: payable.currency) }
            return MailCounterItem(
                piece: piece,
                tag: tag,
                lineTitle: amount.map { "Pay \($0)" } ?? "Pay this bill",
                lineDetail: detail,
                isPressing: isPressing,
                action: .pay(invoiceId: payable.id),
                actionLabel: "Pay"
            )
        }
        if asksAcknowledgement {
            let delivered = MailDates.parse(item.deliveredAt) ?? MailDates.parse(item.createdAt) ?? clock.now
            let arrived = MailDates.daysBetween(delivered, clock.now, calendar: calendar) == 0
                ? "arrived today"
                : "arrived \(MailDates.dueDay(delivered, calendar: calendar))"
            return MailCounterItem(
                piece: piece,
                tag: tag,
                lineTitle: "Acknowledge it",
                lineDetail: detail ?? arrived,
                isPressing: true,
                action: .open,
                actionLabel: "Acknowledge"
            )
        }
        return MailCounterItem(
            piece: piece,
            tag: tag,
            lineTitle: MailPieceModel.firstText(item.displayTitle, item.subject) ?? "Read it",
            lineDetail: detail,
            isPressing: isPressing,
            action: .open,
            actionLabel: "Open"
        )
    }
}
