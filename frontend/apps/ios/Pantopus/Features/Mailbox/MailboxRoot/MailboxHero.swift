//
//  MailboxHero.swift
//  Pantopus
//
//  The top of the Mailbox (Mail tab drawings, boards "Main", "R1-Before",
//  "R2-Delivery", "R4-NoMail"): your mailbox, your verified address, and the
//  morning round. Before the round: "Your mail comes this morning". After
//  it: "Today's mail came at 7:42 a.m." with how many pieces came and how
//  many are still unopened. After an empty round: "No mail today" with the
//  next delivery. The first time the Mailbox shows after a round, the door
//  opens and the stack slides out, once per round, in under 2 seconds;
//  Reduce Motion skips it. While a card waits for the 7 a.m. pickup the
//  flag is up ("Your flag is up"), and the hero opens Sent.
//

import SwiftUI

/// What the hero says, from `GET /api/mailbox/v2/drawers`' `delivery` and `homes`.
struct MailboxHeroModel: Equatable {
    enum Round: Equatable {
        /// Today's round brought mail.
        case cameToday(time: String, count: Int, unopened: Int)
        /// Today's round hasn't come yet.
        case comesThisMorning
        /// Today's round brought nothing; the next one's day.
        case noMailToday(next: String)
        /// An older server sends no round.
        case unknown
    }

    let round: Round
    /// The `last_at` of today's round, to play its delivery once.
    let roundKey: String?
    let addressLine: String?
    let addressVerified: Bool
    /// The number on the mailbox's plate.
    let houseNumber: String?
    /// Cards to a person still waiting for the 7 a.m. pickup (Sent).
    var waitingCards = 0

    /// The flag is up while a card waits for the carrier.
    var flagUp: Bool {
        waitingCards > 0
    }

    static func make(
        delivery: DrawerListResponse.MailDelivery?,
        homes: [DrawerListResponse.MailboxHome],
        waitingCards: Int = 0,
        now: Date = Date()
    ) -> MailboxHeroModel {
        var model = roundModel(delivery: delivery, homes: homes, now: now)
        model.waitingCards = waitingCards
        return model
    }

    private static func roundModel(
        delivery: DrawerListResponse.MailDelivery?,
        homes: [DrawerListResponse.MailboxHome],
        now: Date
    ) -> MailboxHeroModel {
        let home = homes.first(where: \.isOpen) ?? homes.first
        let address = home.flatMap { MailPieceModel.firstText($0.addressLine, $0.name) }
        let firstWord = address?.split(separator: " ").first.map(String.init)
        let number = firstWord.flatMap { Int($0) == nil ? nil : $0 }
        let verified = home?.isOpen == true
        guard let delivery else {
            return MailboxHeroModel(round: .unknown, roundKey: nil, addressLine: address, addressVerified: verified, houseNumber: number)
        }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = delivery.timeZone.flatMap(TimeZone.init(identifier:)) ?? .current
        let last = MailDates.parse(delivery.lastAt)
        let next = MailDates.parse(delivery.nextAt)
        let round: Round
        var key: String?
        if let last, calendar.isDate(last, inSameDayAs: now) {
            round = .cameToday(time: MailDates.time(last, calendar: calendar), count: delivery.lastCount, unopened: delivery.lastUnopened)
            key = delivery.lastAt
        } else if let next, calendar.isDate(next, inSameDayAs: now) {
            round = .comesThisMorning
        } else {
            let day = next.map { MailDates.dueDay($0, calendar: calendar) } ?? "Tomorrow"
            round = .noMailToday(next: day)
        }
        return MailboxHeroModel(round: round, roundKey: key, addressLine: address, addressVerified: verified, houseNumber: number)
    }

    var title: String {
        if flagUp { return "Your flag is up" }
        return switch round {
        case let .cameToday(time, _, _): "Today's mail came at \(time)"
        case .comesThisMorning: "Your mail comes this morning"
        case .noMailToday: "No mail today"
        case .unknown: "Your mailbox"
        }
    }

    var detail: String? {
        if flagUp {
            // "7 a.m." stays on one line.
            let pickup = "the 7\u{00A0}a.m. pickup"
            return waitingCards == 1 ? "1 card waits for \(pickup)" : "\(waitingCards) cards wait for \(pickup)"
        }
        switch round {
        case let .cameToday(_, count, unopened):
            let pieces = count == 1 ? "1 piece" : "\(count) pieces"
            if unopened == 0 { return count == 1 ? "\(pieces), opened" : "\(pieces), all opened" }
            return "\(pieces) · \(unopened) unopened"
        case .comesThisMorning:
            return "Usually by 8 a.m. You'll get one notification."
        case .noMailToday:
            return "Your next delivery is tomorrow morning."
        case .unknown:
            return nil
        }
    }

    var nextChip: String? {
        if !flagUp, case let .noMailToday(next) = round { return "\(next) · usually by 8 a.m." }
        return nil
    }

    /// The card in sentences for VoiceOver, without the "·" separators.
    var spokenLabel: String {
        var parts = [title, detail, nextChip].compactMap(\.self)
        if let addressLine { parts.append(addressVerified ? "\(addressLine), verified home" : "\(addressLine), not verified yet") }
        return parts
            .map { $0.replacingOccurrences(of: " · ", with: ", ") }
            .map { $0.hasSuffix(".") ? $0 : $0 + "." }
            .joined(separator: " ")
    }

    /// The door hangs open after an empty round, as in the drawing.
    var doorOpen: Bool {
        if case .noMailToday = round { return true }
        return false
    }
}

struct MailboxHero: View {
    let model: MailboxHeroModel
    /// The account whose round this is (the once-per-round memory is per account).
    let accountId: String
    /// With the flag up, the hero opens Sent.
    var onFlag: (() -> Void)?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var doorOpen = false
    @State private var stackOut = false

    var body: some View {
        Group {
            if model.flagUp, let onFlag {
                Button(action: onFlag) {
                    card.contentShape(Rectangle())
                }
                .buttonStyle(MailPieceButtonStyle())
                .accessibilityHint("Opens Sent.")
                .accessibilityAddTraits(.isButton)
            } else {
                card
            }
        }
        .accessibilityIdentifier(model.flagUp ? "mailboxHeroFlag" : "mailboxHero")
        .task(id: model.roundKey) { await playDeliveryIfNew() }
    }

    private var card: some View {
        HStack(alignment: .center, spacing: 14) {
            MailboxDrawing(
                doorOpen: doorOpen || model.doorOpen,
                showsStack: doorOpen,
                stackOut: stackOut,
                houseNumber: model.houseNumber,
                flagUp: model.flagUp
            )
            .frame(width: 72, height: 72)
            VStack(alignment: .leading, spacing: 2) {
                Text(model.title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                if let detail = model.detail {
                    Text(detail)
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let chip = model.nextChip {
                    HStack(spacing: 6) {
                        Icon(.calendarClock, size: 14, color: Theme.Color.appTextStrong)
                        Text(chip)
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.Color.appTextStrong)
                    }
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, 6)
                    .background(Theme.Color.appSurfaceSunken, in: Capsule())
                    .padding(.top, Spacing.s1)
                }
                if let address = model.addressLine {
                    HStack(spacing: Spacing.s1) {
                        Icon(model.addressVerified ? .badgeCheck : .home, size: 13, strokeWidth: 2.25, color: addressColor)
                        Text(model.addressVerified ? "\(address) · verified home" : "\(address) · not verified yet")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(addressColor)
                            .lineLimit(2)
                    }
                    .padding(.top, Spacing.s1)
                }
            }
            Spacer(minLength: Spacing.s0)
            if model.flagUp, onFlag != nil {
                Icon(.chevronRight, size: 18, color: Theme.Color.appTextMuted)
            }
        }
        .padding(.leading, Spacing.s4)
        .padding(.trailing, model.flagUp && onFlag != nil ? Spacing.s3 : Spacing.s4)
        .padding(.vertical, 14)
        .background(Theme.Color.appSurface, in: RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
        .shadow(color: .black.opacity(0.04), radius: 3, x: 0, y: 1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(model.spokenLabel)
    }

    private var addressColor: Color {
        model.addressVerified ? Theme.Color.home : Theme.Color.appTextSecondary
    }

    /// Whether this account hasn't seen this round's delivery yet.
    static func isNew(roundKey: String?, accountId: String) -> Bool {
        guard let roundKey, !accountId.isEmpty else { return false }
        return UserDefaults.standard.string(forKey: playedKey(accountId)) != roundKey
    }

    private static func playedKey(_ accountId: String) -> String {
        "mail.delivery.played.\(accountId)"
    }

    /// The first time after a round: the door opens and the stack slides out
    /// (under 2 seconds), once per round and account. Reduce Motion skips it.
    private func playDeliveryIfNew() async {
        guard let key = model.roundKey, Self.isNew(roundKey: key, accountId: accountId) else { return }
        UserDefaults.standard.set(key, forKey: Self.playedKey(accountId))
        guard !reduceMotion else { return }
        // A beat for the list to come back to the top.
        try? await Task.sleep(for: .milliseconds(250))
        withAnimation(.easeOut(duration: 0.45)) { doorOpen = true }
        try? await Task.sleep(for: .milliseconds(380))
        withAnimation(.spring(response: 0.5, dampingFraction: 0.78)) { stackOut = true }
        try? await Task.sleep(for: .milliseconds(900))
        withAnimation(.easeInOut(duration: 0.3)) {
            stackOut = false
            doorOpen = false
        }
    }
}

/// The mailbox from the drawings: a blue arched box on its post, the house
/// number plate and the red flag. Open, the door drops and today's stack
/// slides out. The flag stands up while a card waits for the carrier.
struct MailboxDrawing: View {
    let doorOpen: Bool
    /// Today's stack shows only when it's delivered; after an empty round the
    /// open box is empty.
    let showsStack: Bool
    let stackOut: Bool
    let houseNumber: String?
    var flagUp = false

    var body: some View {
        GeometryReader { geo in
            let unit = min(geo.size.width, geo.size.height) / 120
            ZStack(alignment: .topLeading) {
                Rectangle()
                    .fill(MailPaper.mailboxPost)
                    .frame(width: 12 * unit, height: 28 * unit)
                    .clipShape(RoundedRectangle(cornerRadius: 2 * unit))
                    .offset(x: 54 * unit, y: 92 * unit)
                MailboxArch(inset: 0)
                    .fill(MailPaper.mailboxBody)
                    .frame(width: 84 * unit, height: 86 * unit)
                    .offset(x: 18 * unit, y: 8 * unit)
                if doorOpen {
                    MailboxArch(inset: 0)
                        .fill(MailPaper.mailboxInside)
                        .frame(width: 66 * unit, height: 70 * unit)
                        .offset(x: 27 * unit, y: 20 * unit)
                    if showsStack { stack(unit: unit) }
                    MailboxDoorDown()
                        .fill(MailPaper.mailboxDoor)
                        .frame(width: 88 * unit, height: 20 * unit)
                        .offset(x: 16 * unit, y: 90 * unit)
                } else {
                    MailboxArch(inset: 0)
                        .fill(MailPaper.mailboxDoor)
                        .frame(width: 66 * unit, height: 70 * unit)
                        .offset(x: 27 * unit, y: 20 * unit)
                    Capsule()
                        .fill(MailPaper.mailboxHandle)
                        .frame(width: 18 * unit, height: 6 * unit)
                        .offset(x: 51 * unit, y: 38 * unit)
                    if let houseNumber {
                        Text(houseNumber)
                            .font(.system(size: 9 * unit, weight: .bold, design: .monospaced))
                            .foregroundStyle(MailPaper.handInk)
                            .lineLimit(1)
                            .minimumScaleFactor(0.5)
                            .frame(width: 40 * unit, height: 13 * unit)
                            .background(MailPaper.mailboxPlate, in: RoundedRectangle(cornerRadius: 2 * unit))
                            .offset(x: 40 * unit, y: 68 * unit)
                    }
                }
                if flagUp {
                    // Raised: its arm stands up beside the box, the flag at the top.
                    Rectangle()
                        .fill(MailPaper.mailboxFlag)
                        .frame(width: 6 * unit, height: 46 * unit)
                        .clipShape(RoundedRectangle(cornerRadius: 1.5 * unit))
                        .offset(x: 104 * unit, y: 20 * unit)
                    Rectangle()
                        .fill(MailPaper.mailboxFlag)
                        .frame(width: 16 * unit, height: 12 * unit)
                        .clipShape(RoundedRectangle(cornerRadius: 1.5 * unit))
                        .offset(x: 104 * unit, y: 20 * unit)
                } else {
                    Rectangle()
                        .fill(MailPaper.mailboxFlag)
                        .frame(width: 16 * unit, height: 7 * unit)
                        .clipShape(RoundedRectangle(cornerRadius: 1.5 * unit))
                        .rotationEffect(.degrees(stackOut ? -70 : 0), anchor: .leading)
                        .offset(x: 102 * unit, y: 64 * unit)
                }
            }
        }
        .accessibilityHidden(true)
    }

    /// Today's stack, inside the open box, sliding out over the door.
    private func stack(unit: CGFloat) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 1.5 * unit).fill(MailPaper.letter)
                .frame(width: 50 * unit, height: 16 * unit)
                .rotationEffect(.degrees(-4))
            RoundedRectangle(cornerRadius: 1.5 * unit).fill(MailPaper.envelope)
                .frame(width: 46 * unit, height: 14 * unit)
                .rotationEffect(.degrees(3))
                .offset(y: 6 * unit)
            RoundedRectangle(cornerRadius: 1.5 * unit).fill(MailPaper.bookletCover)
                .frame(width: 44 * unit, height: 10 * unit)
                .offset(y: 11 * unit)
        }
        .frame(width: 66 * unit, height: 40 * unit)
        .offset(x: 27 * unit, y: (stackOut ? 78 : 58) * unit)
        .opacity(stackOut ? 1 : 0.9)
    }
}

/// The mailbox's arched front.
struct MailboxArch: Shape {
    let inset: CGFloat

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let radius = rect.width / 2
        path.move(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY + radius))
        path.addArc(
            center: CGPoint(x: rect.midX, y: rect.minY + radius),
            radius: radius,
            startAngle: .degrees(180),
            endAngle: .degrees(0),
            clockwise: false
        )
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}

/// The door, dropped open in front of the box.
private struct MailboxDoorDown: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let inset = rect.width * 0.125
        path.move(to: CGPoint(x: rect.minX + inset, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX - inset, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}
