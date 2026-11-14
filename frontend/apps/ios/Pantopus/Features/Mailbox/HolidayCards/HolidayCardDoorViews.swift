//
//  HolidayCardDoorViews.swift
//  Pantopus
//
//  What the ways into a Christmas card look like outside the flow (TABCARD,
//  drawings Main, Today, MailEmptyDay): the Mail tab's red envelope, Today's
//  countdown and Mail's top card on a day with no mail. They use the paper
//  and red of Mail's "Send a Christmas card" row (`MailPaper`), in light and
//  dark alike, and every button opens the one send flow.
//

import SwiftUI

/// The Mail tab's icon from November 1 to Christmas while cards are open: a
/// red envelope with a small gold seal. Selected or not, it stays red.
struct ChristmasMailIcon: View {
    var size: CGFloat = 23

    var body: some View {
        Icon(.mail, size: size, color: MailPaper.seasonEnvelope)
            .symbolVariant(.fill)
            .overlay {
                Circle()
                    .fill(MailPaper.seasonSeal)
                    .frame(width: size * 0.3, height: size * 0.3)
                    .offset(y: size * 0.05)
            }
            .accessibilityHidden(true)
    }
}

/// Today's countdown (drawing Today): Christmas 1 to 45 days away, while cards
/// are open. The button opens the send flow in the Mail tab.
struct ChristmasCountdownCard: View {
    let days: Int
    let onSend: () -> Void

    /// Shown while cards are open and Christmas is 1 to 45 days away on the device's date.
    static func days(open: Bool, now: Date = ChristmasClock.now) -> Int? {
        let days = daysToChristmas(now)
        return open && (1...45).contains(days) ? days : nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text("CHRISTMAS")
                .font(.system(size: 11, weight: .bold))
                .tracking(1.4)
                .foregroundStyle(MailPaper.cardLabel)
            HStack(alignment: .center, spacing: Spacing.s3) {
                VStack(spacing: 0) {
                    Text("\(days)")
                        .font(.system(size: 28, weight: .bold))
                        .monospacedDigit()
                    Text(days == 1 ? "day" : "days")
                        .font(.system(size: 12, weight: .semibold))
                }
                .foregroundStyle(MailPaper.waxText)
                .frame(width: 64, height: 64)
                .background(MailPaper.wax, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(days == 1 ? "1 day to Christmas" : "\(days) days to Christmas")
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text("Who is far away this year?")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(MailPaper.wax)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("A card from you will mean more than you think.")
                        .font(.system(size: 14))
                        .foregroundStyle(MailPaper.cardTextSoft)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            HolidayCardWaxButton(title: "Send a Christmas card", action: onSend)
                .accessibilityIdentifier("today.christmasCountdown.send")
        }
        .padding(Spacing.s4)
        .background(MailPaper.cardNote, in: RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).strokeBorder(MailPaper.cardRowLine, lineWidth: 1))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("today.christmasCountdown")
    }
}

/// Mail's top card on a day with no mail, on your own mailbox, while cards are
/// open (drawing MailEmptyDay): the empty mailbox, an invitation, the stamps
/// you hold, "Send a Christmas card", then the next delivery and your address.
struct MailEmptyDayCard: View {
    let hero: MailboxHeroModel
    let cards: HolidayCardsResponse
    let onSend: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(alignment: .center, spacing: 14) {
                MailboxDrawing(doorOpen: true, showsStack: false, stackOut: false, houseNumber: hero.houseNumber)
                    .frame(width: 64, height: 64)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Nothing came today.")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(MailPaper.wax)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("Put something in someone else’s mailbox.")
                        .font(.system(size: 14))
                        .foregroundStyle(MailPaper.cardTextSoft)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            if let stamps = shownStamps {
                stampsLine(stamps)
            }
            HolidayCardWaxButton(title: "Send a Christmas card", action: onSend)
                .accessibilityIdentifier("mail.emptyDayCard.send")
            if let next = hero.nextDeliveryLine {
                Text(next)
                    .font(.system(size: 12.5))
                    .foregroundStyle(MailPaper.cardTextMuted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                    .frame(maxWidth: .infinity)
            }
            if let address = hero.addressLine {
                HStack(spacing: Spacing.s1) {
                    Icon(hero.addressVerified ? .badgeCheck : .home, size: 13, strokeWidth: 2.25, color: addressColor)
                    Text(hero.addressVerified ? "\(address) · verified home" : "\(address) · not verified yet")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(addressColor)
                        .lineLimit(2)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(Spacing.s4)
        .background(MailPaper.cardNote, in: RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).strokeBorder(MailPaper.cardRowLine, lineWidth: 1))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("mail.emptyDayCard")
    }

    /// The stamps line shows only with stamp books on and the count known.
    private var shownStamps: HolidayCardStamps? {
        cards.postageEnabled ? cards.stamps : nil
    }

    private func stampsLine(_ stamps: HolidayCardStamps) -> some View {
        HStack(spacing: Spacing.s3) {
            HStack(spacing: Spacing.s1) {
                ForEach(0..<min(max(stamps.available, 0), 3), id: \.self) { index in
                    if let art = StampArt.image(index) {
                        Image(uiImage: art)
                            .resizable()
                            .scaledToFit()
                            .frame(width: 28, height: 34)
                            .shadow(color: MailPaper.cardShadow.opacity(0.22), radius: 1, y: 1)
                    }
                }
            }
            .accessibilityHidden(true)
            Text(stampsHeldLine(free: stamps.freeRemaining, paid: stamps.paidRemaining))
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(MailPaper.cardText)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var addressColor: Color {
        hero.addressVerified ? MailPaper.verifiedInk : MailPaper.cardTextMuted
    }
}

/// The stamps someone holds, in the stamp screens' words: "3 free cards",
/// "2 stamps", "1 free card and 2 stamps".
func stampsHeldLine(free: Int, paid: Int) -> String {
    let paid = max(0, paid)
    let free = max(0, free)
    func plural(_ count: Int, _ one: String) -> String {
        "\(count) \(count == 1 ? one : one + "s")"
    }
    if paid == 0, free == 0 { return "You’re out of stamps" }
    if paid > 0, free > 0 { return "\(plural(free, "free card")) and \(plural(paid, "stamp"))" }
    return paid > 0 ? plural(paid, "stamp") : plural(free, "free card")
}
