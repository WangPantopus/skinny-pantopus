//
//  HolidayCardLookStep.swift
//  Pantopus
//
//  Look it over, the fifth step of sending a Christmas card
//  (`holiday_cards`; the web's `LookItOver`): exactly what the other person
//  will see, drawn with the parts their own Mailbox and card page draw,
//  before "Seal and send". For a person on Pantopus: the envelope in their
//  Mailbox on the day it comes (their name only, never an address), the
//  sealed notice while it waits for Christmas, the card sliding out of its
//  envelope picture side up, and the note on its back. For an email
//  address: the email they get, the page its link opens, and the card in
//  their Mailbox once they join with that address. The server answers what
//  the card will really carry (`POST /api/mailbox/cards/preview`).
//

import SwiftUI

struct HolidayCardLookStep: View {
    let viewModel: HolidayCardFlowViewModel
    let cards: HolidayCardsResponse
    /// The picture chosen on step 2, should the answer leave anything out.
    let design: HolidayCardDesign
    let recipient: HolidayCardRecipient
    let preview: HolidayCardPreview
    /// The envelope as their Mailbox draws it, and torn open on the morning
    /// they open it (a sealed card's seal lifted).
    private let envelope: MailPieceModel
    private let openedEnvelope: MailPieceModel

    @State private var showBack = false
    /// "Open it again": the card rises out of its envelope once more.
    @State private var rises = false
    @State private var replays = 0
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(
        viewModel: HolidayCardFlowViewModel,
        cards: HolidayCardsResponse,
        design: HolidayCardDesign,
        recipient: HolidayCardRecipient,
        preview: HolidayCardPreview
    ) {
        self.viewModel = viewModel
        self.cards = cards
        self.design = design
        self.recipient = recipient
        self.preview = preview
        // Their name, or the address typed: never their own address.
        let shut = MailPieceModel(
            mail: preview.piece,
            recipient: MailPieceRecipient(name: recipient.name, addressLine: nil),
            opened: false
        )
        // Their mail comes at 7 a.m. where they live: the line their Mailbox
        // shows that morning, never turned into this phone's time.
        let sealed = preview.piece.item.card?.sealed == true
        envelope = shut.with(meta: MailPieceMeta(
            parts: ["7:00 a.m.", "Christmas card"] + (sealed ? ["Opens Christmas morning"] : []),
            due: nil,
            dueIsSettled: false
        ))
        openedEnvelope = shut.openedOnItsMorning
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            heading
            if recipient.isEmail {
                emailSections
            } else {
                personSections
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("sendCardLook")
    }

    // MARK: What it is

    private var card: MailCard? {
        preview.piece.item.card
    }

    private var arrival: HolidayCardArrival? {
        card?.arrival.flatMap(HolidayCardArrival.init(rawValue:)) ?? viewModel.arrival
    }

    /// The envelope comes sealed until Christmas morning.
    private var sealed: Bool {
        card?.sealed == true
    }

    /// "Maya" from "Maya O.", the name step 1 shows.
    private var first: String {
        HolidayCardWords.firstName(recipient.name)
    }

    /// Who it's from, as the card will really carry the name.
    private var from: String {
        envelope.from
    }

    private var note: String {
        MailPieceModel.firstText(preview.piece.item.content, viewModel.message) ?? ""
    }

    // MARK: Heading

    private var heading: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text(verbatim: recipient.isEmail ? "This is what they will see" : "This is what \(recipient.name) will see")
                .font(.system(size: 22, design: .serif))
                .foregroundStyle(HolidayCardDesk.text(scheme))
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text(verbatim: intro)
                .font(.system(size: 14))
                .foregroundStyle(HolidayCardDesk.muted(scheme))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.top, 2)
    }

    private var intro: String {
        if recipient.isEmail {
            return "They aren’t on Pantopus yet. The email never shows the card; they open it in Pantopus once they join with this address."
        }
        switch arrival {
        case .sealedChristmas:
            return "It comes sealed and stays shut until Christmas morning. Use Back to change anything."
        case .christmasMorning:
            return "It comes on Christmas morning with the 7 a.m. mail. Use Back to change anything."
        default:
            return "Open the envelope and turn the card over, the way \(first) will. Use Back to change anything."
        }
    }

    // MARK: A person on Pantopus

    private var personSections: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            let day = HolidayCardWords.longDay(preview.arrivesOn)
            sectionLabel("In \(HolidayCardWords.possessive(first)) Mailbox" + (day.isEmpty ? "" : " · \(day)"))
                .padding(.top, 18)
            mailboxFrame(label: "Today", showsLine: true) { EmptyView() }
                .padding(.top, Spacing.s2)
            if sealed {
                sectionLabel("If \(first) taps it before Christmas")
                    .padding(.top, 28)
                HolidayCardSealedNotice(
                    from: from,
                    opensOn: preview.opensOn ?? card?.sealedUntil,
                    inDays: preview.sealedDays.map { HolidayCardWords.inDays(count: $0) }
                )
                .padding(.top, 10)
            }
            sectionLabel(sealed ? "On Christmas morning" : "When \(first) opens it")
                .padding(.top, 28)
            Text(
                verbatim: sealed
                    ? "The seal lifts at 7 a.m. where \(first) lives. The card slides out of the envelope picture side up."
                    : "A Christmas card from \(HolidayCardWords.withoutPeriod(from)). It slides out of the envelope picture side up."
            )
            .font(.system(size: 15))
            .foregroundStyle(HolidayCardDesk.soft(scheme))
            .lineSpacing(3)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, 6)
            .padding(.horizontal, Spacing.s1)
            risingCard
            cardButtons
            sectionLabel("On the back")
                .padding(.top, Spacing.s6)
            backOnly
                .frame(maxWidth: 300)
                .rotationEffect(.degrees(1))
                .frame(maxWidth: .infinity)
                .padding(.top, 14)
        }
    }

    /// The card as it first comes out of its envelope, picture side up; it
    /// turns over to its back.
    private var risingCard: some View {
        HolidayCardRiseOut(envelope: openedEnvelope, rises: rises) {
            HolidayCardFlip(showBack: showBack) {
                front
            } back: {
                back
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(
                "Card from \(from): \(HolidayCardWords.captionSentence(card?.caption ?? design.caption)) On the back: \(note)"
            )
        }
        // A fresh one plays the rise again.
        .id(replays)
        .frame(maxWidth: 300)
        .rotationEffect(.degrees(-1))
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.s4)
    }

    private var cardButtons: some View {
        HStack(spacing: Spacing.s2) {
            HolidayCardPaperButton(title: showBack ? "Turn it back" : "Turn it over", isPressed: showBack) {
                showBack.toggle()
            }
            .accessibilityIdentifier("sendCardLookTurn")
            Button(action: openAgain) {
                Text("Open it again")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(HolidayCardDesk.link(scheme))
                    .padding(.horizontal, 14)
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint(reduceMotion ? "Shows the picture side again." : "Shows the card sliding out of its envelope again.")
            .accessibilityIdentifier("sendCardLookOpenAgain")
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 18)
    }

    /// The opening once more, picture side up; with Reduce Motion nothing moves.
    private func openAgain() {
        showBack = false
        rises = !reduceMotion
        replays += 1
    }

    // MARK: An email address

    private var emailSections: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            sectionLabel(arrival == .sealedChristmas ? "The email they get, now" : "The email they get, right away")
                .padding(.top, 18)
            if let email = preview.email {
                HolidayCardEmailPicture(email: email, to: recipient.name, senderName: preview.linkPage?.senderName ?? from)
                    .padding(.top, Spacing.s2)
            }
            if let page = preview.linkPage {
                sectionLabel("The page its link opens")
                    .padding(.top, 26)
                HolidayCardLinkPagePicture(page: page)
                    .padding(.top, Spacing.s2)
            }
            sectionLabel("After they join with that address")
                .padding(.top, 26)
            mailboxFrame(label: "In their Mailbox", showsLine: false) {
                HStack(alignment: .top, spacing: Spacing.s3) {
                    front
                        .accessibilityHidden(true)
                    backOnly
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("On the back: \(note)")
                }
                .padding(.top, 6)
            }
            .padding(.top, Spacing.s2)
        }
    }

    // MARK: Parts

    /// Their Mailbox: the day's heading and the envelope as their own app
    /// draws it, with the line under it; then anything more.
    private func mailboxFrame(label: String, showsLine: Bool, @ViewBuilder more: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.7)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            VStack(alignment: .leading, spacing: 6) {
                MailPieceView(model: envelope)
                if showsLine {
                    MailPieceMetaLine(meta: envelope.meta)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(showsLine ? envelope.spokenWithArrival : envelope.accessibilityLabel)
            more()
        }
        .padding(.horizontal, 14)
        .padding(.top, 14)
        .padding(.bottom, Spacing.s4)
        .background(Theme.Color.appBg, in: RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).strokeBorder(MailPaper.cardRowEdge, lineWidth: 1))
    }

    /// The picture side, postmarked the day it's mailed by their clock.
    private var front: some View {
        HolidayCardFront(
            design: card?.design ?? design.id,
            caption: card?.caption ?? design.caption,
            paper: card?.paper ?? design.paper,
            height: card?.height ?? design.height,
            year: card?.year ?? cards.year,
            mailedOn: envelope.postmarkDate
        )
        .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
        .shadow(color: MailPaper.cardShadow.opacity(0.28), radius: 15, x: 0, y: 14)
    }

    /// The back with the note and who it's from.
    private var back: some View {
        HolidayCardBack(paper: card?.paper ?? design.paper, fromName: from, year: card?.year ?? cards.year) { width in
            HolidayCardNoteText(text: .constant(note), cardWidth: width)
        }
        .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
        .shadow(color: MailPaper.cardShadow.opacity(0.28), radius: 15, x: 0, y: 14)
    }

    /// The back on its own, the size of the picture side.
    private var backOnly: some View {
        HolidayCardFront(
            design: card?.design ?? design.id,
            caption: nil,
            paper: card?.paper ?? design.paper,
            height: card?.height ?? design.height,
            year: cards.year
        )
        .hidden()
        .overlay { back }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("On the back: \(note) From \(HolidayCardWords.withoutPeriod(from)).")
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold))
            .tracking(0.66)
            .textCase(.uppercase)
            .foregroundStyle(HolidayCardDesk.label(scheme))
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, Spacing.s1)
            .accessibilityAddTraits(.isHeader)
    }
}

// MARK: - The footer

/// Under Look it over, pinned: until when it can be taken back, why sending
/// didn't go, and "Seal and send".
struct HolidayCardLookFooter: View {
    let viewModel: HolidayCardFlowViewModel
    let byEmail: Bool
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(HolidayCardWords.sealNote(byEmail: byEmail))
                .font(.system(size: 13))
                .foregroundStyle(MailPaper.cardTextSoft)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, 10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(MailPaper.cardNote, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).strokeBorder(MailPaper.cardRowLine, lineWidth: 1))
            if let error = viewModel.sendError {
                Text(error)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(HolidayCardDesk.error(scheme))
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("sendCardError")
            }
            HolidayCardWaxButton(title: "Seal and send", isLoading: viewModel.sending) {
                Task { await viewModel.send() }
            }
            .accessibilityIdentifier("sendCardLookSend")
        }
        .frame(maxWidth: 560)
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity)
        .background(HolidayCardDesk.background(scheme).ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) {
            Rectangle().fill(MailPaper.cardRowLine).frame(height: 1)
        }
    }
}

// MARK: - The envelope, drawn another way

private extension MailPieceModel {
    /// The same envelope with another line under it.
    func with(meta: MailPieceMeta) -> MailPieceModel {
        copy(meta: meta, isOpened: isOpened, card: card)
    }

    /// Torn open on the morning it's opened, its picture peeking out: a
    /// sealed card's seal has lifted by then.
    var openedOnItsMorning: MailPieceModel {
        copy(meta: meta, isOpened: true, card: card?.unsealed())
    }

    private func copy(meta: MailPieceMeta, isOpened: Bool, card: MailCard?) -> MailPieceModel {
        MailPieceModel(
            id: id,
            kind: kind,
            isSpecialDelivery: isSpecialDelivery,
            trust: trust,
            from: from,
            fromLine: fromLine,
            to: to,
            toLine: toLine,
            note: note,
            postmarkTown: postmarkTown,
            postmarkDate: postmarkDate,
            postmarkYear: postmarkYear,
            isOpened: isOpened,
            isFaded: isFaded,
            stamp: stamp,
            peekLine: peekLine,
            meta: meta,
            card: card,
            isPostmarked: isPostmarked
        )
    }
}
