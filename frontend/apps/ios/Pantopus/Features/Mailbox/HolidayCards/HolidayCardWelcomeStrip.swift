//
//  HolidayCardWelcomeStrip.swift
//  Pantopus
//
//  The welcome strip under the mantel (cards-next 4.1, only while GET /api/mailbox/cards says `improved` and carries
//  `welcome`): a new account that joined for a card and has sent none is told its card stays on the mantel, with
//  "Write back to {first name}" and "Send a Christmas card". A × puts it away on this phone for this account; it also
//  goes once they send a card or write back (the server stops sending `welcome`).
//

import SwiftUI

struct HolidayCardWelcomeStrip: View {
    let welcome: HolidayCardWelcome
    /// The stamps the cards' read carried, to word "free" (none bought) or not.
    let stamps: HolidayCardStamps?
    let onWriteBack: () -> Void
    let onSendCard: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(alignment: .top, spacing: Spacing.s2) {
                Text(verbatim: "\(welcome.fromFirstName)’s card is on your mantel")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(MailPaper.cardText)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityAddTraits(.isHeader)
                Button(action: onDismiss) {
                    Icon(.x, size: 18, color: MailPaper.cardTextMuted)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(.top, -12)
                .padding(.trailing, -12)
                .accessibilityLabel("Dismiss")
                .accessibilityIdentifier("cardWelcomeDismiss")
            }
            Text(verbatim: line(welcome.stamps))
                .font(.system(size: 14))
                .foregroundStyle(MailPaper.cardTextSoft)
                .fixedSize(horizontal: false, vertical: true)
            ViewThatFits(in: .horizontal) {
                HStack(spacing: Spacing.s2) { buttons }
                VStack(spacing: Spacing.s2) { buttons }
            }
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(MailPaper.cardNote, in: RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).strokeBorder(MailPaper.cardRowEdge, lineWidth: 1))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("cardWelcomeStrip")
    }

    @ViewBuilder
    private var buttons: some View {
        if welcome.canWriteBack {
            HolidayCardWaxButton(title: "Write back to \(welcome.fromFirstName)", height: 44, action: onWriteBack)
                .accessibilityIdentifier("cardWelcomeWriteBack")
        }
        HolidayCardPaperButton(title: "Send a Christmas card", fullWidth: true, action: onSendCard)
            .accessibilityIdentifier("cardWelcomeSendCard")
    }

    /// "Your cards stay here all season. You have 7 free stamps ready…": "stamp" for one, no "free" once some are
    /// bought, and no number when the balance couldn't be read.
    private func line(_ count: Int?) -> String {
        let stay = "Your cards stay here all season."
        guard let count else { return "\(stay) Send one back whenever you like." }
        let free = (stamps?.paidRemaining ?? 0) > 0 ? "" : "free "
        let noun = count == 1 ? "stamp" : "stamps"
        return "\(stay) You have \(count) \(free)\(noun) ready whenever you want to send one back."
    }
}

/// The strip's ×, kept on this phone per account (no server state).
@MainActor
enum HolidayCardWelcomeDismissal {
    private static func key(_ account: String) -> String {
        "pantopus.cards.welcomeDismissed.\(account)"
    }

    static func isDismissed(account: String?) -> Bool {
        guard let account else { return false }
        return UserDefaults.standard.bool(forKey: key(account))
    }

    static func dismiss(account: String?) {
        guard let account else { return }
        UserDefaults.standard.set(true, forKey: key(account))
    }
}

/// "Write back to {first name}" on the Mailbox's welcome strip (cards-next 4.1): the card opens on its table and its reply
/// comes up as soon as the table knows a reply can be written.
@MainActor
enum CardTableWriteBackIntent {
    private static var mailId: String?

    static func set(_ id: String) {
        mailId = id
    }

    /// True once, for the card the strip asked about.
    static func take(_ id: String) -> Bool {
        guard mailId == id else { return false }
        mailId = nil
        return true
    }
}
