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

// swiftlint:disable file_length type_body_length

import SwiftUI

struct HolidayCardLookStep: View {
    let viewModel: HolidayCardFlowViewModel
    let cards: HolidayCardsResponse
    /// The picture chosen on step 2, should the answer leave anything out.
    let design: HolidayCardDesign
    let recipient: HolidayCardRecipient
    let preview: HolidayCardPreview
    /// On an iPad, what ends the page (until when it can be taken back, the postage, a list's lines), at the foot of its
    /// second column when it has two; nil where the page's own stack puts it under the step (phones).
    var end: AnyView?
    /// The envelope as their Mailbox draws it, and torn open on the morning
    /// they open it (a sealed card's seal lifted).
    private let envelope: MailPieceModel
    private let openedEnvelope: MailPieceModel

    @State private var showBack = false
    /// A long note's first leaf: 0 on the back, 1 lifted by Read on (plan Part 9).
    @State private var leafLift = 0.0
    /// "Open it again": the card rises out of its envelope once more.
    @State private var rises = false
    @State private var replays = 0
    /// "Open it the way they will": the real moment, full screen.
    @State private var tableContent: CardTableContent?
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(
        viewModel: HolidayCardFlowViewModel,
        cards: HolidayCardsResponse,
        design: HolidayCardDesign,
        recipient: HolidayCardRecipient,
        preview: HolidayCardPreview,
        end: AnyView? = nil
    ) {
        self.viewModel = viewModel
        self.cards = cards
        self.design = design
        self.recipient = recipient
        self.preview = preview
        self.end = end
        // Their name, or the address typed: never their own address.
        let shut = MailPieceModel(
            mail: preview.piece,
            recipient: MailPieceRecipient(name: viewModel.envelopeName(recipient), addressLine: nil),
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
        Group {
            if WideLayout.isPad {
                // On an iPad window wide enough, two columns: their Mailbox and the card coming out of it on the left,
                // the back and the end of the page on the right (an email: the email and its page, then their Mailbox
                // once they join). One column, in this order, in a narrower window and at the accessibility sizes.
                WideColumns {
                    VStack(alignment: .leading, spacing: Spacing.s0) {
                        heading
                        if recipient.isEmail {
                            emailLeading
                        } else {
                            personLeading
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .placeColumn(.leading, order: 0)
                    VStack(alignment: .leading, spacing: Spacing.s0) {
                        if recipient.isEmail {
                            emailTrailing
                        } else {
                            personTrailing
                        }
                        end
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .placeColumn(.trailing, order: 1, trimsTop: recipient.isEmail ? 26 : Spacing.s6)
                }
            } else {
                VStack(alignment: .leading, spacing: Spacing.s0) {
                    heading
                    if recipient.isEmail {
                        emailSections
                    } else {
                        personSections
                    }
                }
            }
        }
        .modifier(CardTablePreviewCover(content: $tableContent, owner: viewModel, closeLabel: "Back to Look it over"))
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
        // With `improved` and guest opening on, they can read it before joining (the web's words).
        if recipient.isEmail, viewModel.improved, let page = preview.linkPage, page.guestOpen {
            if recipient.isLink {
                return "Anyone with your link can open and read the card"
                    + (page.sealed ? " once Christmas morning arrives" : " right away")
                    + " — no account needed. The first person to save it keeps it."
            }
            let after = page.sealed
                ? "they get a reminder on Christmas morning when it opens."
                : "they can open and read the card right away without an account, and join free to keep it or write back."
            return "They aren’t on Pantopus yet. The email never shows your note; " + after
        }
        if recipient.isEmail {
            if recipient.isLink {
                return "The first person to open your link keeps the card. "
                    + "The page it opens never shows the card; they open it in Pantopus once they join."
            }
            return "They aren’t on Pantopus yet. The email never shows your note; "
                + "they read it in Pantopus once they join with this address."
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
            personLeading
            personTrailing
        }
    }

    /// Their Mailbox on the day, the sealed notice, and the card coming out of its envelope.
    @ViewBuilder
    private var personLeading: some View {
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
    }

    /// The back with its note, and the sender's own photo and greeting.
    @ViewBuilder
    private var personTrailing: some View {
        sectionLabel("On the back")
            .padding(.top, Spacing.s6)
        backOnly
            .rotationEffect(.degrees(1))
            .frame(maxWidth: .infinity)
            .padding(.top, 14)
        ownMedia
    }

    /// The card as it first comes out of its envelope, picture side up; it
    /// turns over to its back.
    private var risingCard: some View {
        HolidayCardRiseOut(envelope: openedEnvelope, rises: rises) {
            HolidayCardFlip(showBack: showBack) {
                front
            } back: {
                HolidayCardTurningBack(note: note, lift: leafLift) { backFace($0) }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(
                "Card from \(from): \(HolidayCardWords.captionSentence(card?.caption ?? design.caption)) On the back: \(note)"
            )
        }
        // A fresh one plays the rise again.
        .id(replays)
        .rotationEffect(.degrees(-1))
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.s4)
    }

    private var cardButtons: some View {
        HStack(spacing: Spacing.s2) {
            HolidayCardTurnButton(showBack: $showBack, leafLift: $leafLift, note: note)
                .accessibilityIdentifier("sendCardLookTurn")
            Button {
                if LaunchFeatures.cardTable {
                    tableContent = lookContent
                } else {
                    openAgain()
                }
            } label: {
                Text(LaunchFeatures.cardTable ? "Open it the way they will" : "Open it again")
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
            emailLeading
            emailTrailing
        }
    }

    /// The email they get and the page its link opens.
    @ViewBuilder
    private var emailLeading: some View {
        if !recipient.isLink {
            sectionLabel(emailHeading)
                .padding(.top, 18)
        }
        if let email = preview.email {
            HolidayCardEmailPicture(email: email, to: recipient.name, senderName: preview.linkPage?.senderName ?? from)
                .padding(.top, Spacing.s2)
        }
        if let page = preview.linkPage {
            sectionLabel(recipient.isLink ? "The page your link opens" : "The page its link opens")
                .padding(.top, 26)
            Group {
                if LaunchFeatures.cardTable {
                    CardTableLinkPagePicture(page: page)
                } else {
                    HolidayCardLinkPagePicture(page: page)
                }
            }
            .padding(.top, Spacing.s2)
        }
    }

    /// The card in their Mailbox once they join.
    @ViewBuilder
    private var emailTrailing: some View {
        sectionLabel(recipient.isLink ? "After they join" : "After they join with that address")
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
            ownMedia
            if LaunchFeatures.cardTable {
                openOnTable
            }
        }
        .padding(.top, Spacing.s2)
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
        backFace(.whole)
            .shadow(color: MailPaper.cardShadow.opacity(0.28), radius: 15, x: 0, y: 14)
    }

    private func backFace(_ leaf: CardTableLeaf) -> some View {
        HolidayCardBack(
            paper: card?.paper ?? design.paper,
            fromName: from,
            year: card?.year ?? cards.year,
            signature: card?.signature,
            noteText: note,
            leaf: leaf
        ) { width in
            HolidayCardReadNote(text: note, number: design.number, cardWidth: width, leaf: leaf)
        }
        .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
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
}

// MARK: - The footer

private extension HolidayCardLookStep {
    func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold))
            .tracking(0.66)
            .textCase(.uppercase)
            .foregroundStyle(HolidayCardDesk.label(scheme))
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, Spacing.s1)
            .accessibilityAddTraits(.isHeader)
    }

    /// When the email goes: at the sender's 7 a.m. or on Christmas morning (this phone's clock), else now.
    var emailHeading: String {
        if let sendAt = preview.emailSendAt { return "The email they get \(HolidayCardWords.dayAndTime(sendAt)), your time" }
        return arrival == .sealedChristmas ? "The email they get, now" : "The email they get, right away"
    }

    /// The sender's own photo beside the card, never covered (memories plan step 4).
    @ViewBuilder
    var ownMedia: some View {
        if card?.photo != nil || card?.voice != nil {
            CardMediaBeside(
                photo: card?.photo,
                voice: card?.voice,
                from: .own,
                number: card?.number ?? design.number,
                moodName: card?.mood ?? design.mood,
                day: preview.piece.item.postmark?.date ?? preview.piece.item.createdAt,
                fromName: from,
                forName: viewModel.envelopeName(recipient)
            )
            .padding(.top, -Spacing.s4)
            .accessibilityIdentifier("sendCardLookPhoto")
        }
    }

    /// "Open it the way they will", on a card by email or by link.
    var openOnTable: some View {
        Button {
            tableContent = lookContent
        } label: {
            Text("Open it the way they will")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(HolidayCardDesk.link(scheme))
                .frame(maxWidth: .infinity, minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("sendCardLookOnTable")
    }

    /// The card as it'll lie on the table, for "Open it the way they will".
    var lookContent: CardTableContent {
        CardTableContent(
            design: design.id,
            number: design.number,
            caption: card?.caption ?? design.caption,
            paper: card?.paper ?? design.paper,
            table: card?.table ?? design.table,
            slug: design.slug,
            year: card?.year ?? cards.year,
            mailedOn: envelope.postmarkDate,
            note: note,
            fromName: from,
            toName: viewModel.envelopeName(recipient),
            sealed: false,
            sealedUntil: nil,
            sealedInDays: "",
            sealedDayCount: 0,
            verse: design.verse,
            signature: card?.signature,
            photo: card?.photo,
            voice: card?.voice,
            mediaFrom: .own,
            mood: card?.mood ?? design.mood
        )
    }
}

/// The end of Look it over, scrolling with the page (experience plan 5.2): until when it can be taken back, and the
/// postage. "Seal it for the day" says both too.
struct HolidayCardLookEnd: View {
    let viewModel: HolidayCardFlowViewModel
    let byEmail: Bool

    /// A card to a person that comes right away (cards-next 3.3): it can't be taken back.
    private var rightAway: Bool {
        guard case .person = viewModel.recipient else { return false }
        return viewModel.arrival == .now
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HolidayCardLookNote(
                text: viewModel.recipient?.isLink == true ? HolidayCardWords.sealNoteByLink
                    : rightAway ? HolidayCardWords.rightAwayNote : HolidayCardWords.sealNote(byEmail: byEmail)
            )
            if viewModel.cards?.postageEnabled == true, let design = viewModel.design {
                StampPostageLine(store: viewModel.stamps, design: design.id, media: viewModel.mediaSpendsBoughtStamp)
            }
        }
        .padding(.top, Spacing.s3)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("sendCardLookEnd")
    }
}

/// The take-back line on its cream note.
struct HolidayCardLookNote: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 13))
            .foregroundStyle(MailPaper.cardTextSoft)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(MailPaper.cardNote, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).strokeBorder(MailPaper.cardRowLine, lineWidth: 1))
    }
}

/// Under Look it over, pinned: only "Seal and send" on a soft fade, so nothing else covers the card (experience plan
/// 5.2), with why sending didn't go in one line above it.
struct HolidayCardLookFooter: View {
    let viewModel: HolidayCardFlowViewModel
    let byEmail: Bool
    @Environment(\.colorScheme) private var scheme

    /// Postage on and no stamps left, or no bought stamp for the card's photo or greeting: the button opens the stamp
    /// books.
    private var needsStamps: Bool {
        viewModel.cards?.postageEnabled == true && (viewModel.stamps.isOut || needsBoughtStamp)
    }

    private var needsBoughtStamp: Bool {
        viewModel.mediaNeedsBoughtStamp
    }

    var body: some View {
        HolidayCardPinnedButton(error: viewModel.sendError) {
            HolidayCardWaxButton(
                title: needsStamps ? "Get stamps to send" : viewModel.recipient?
                    .isLink == true ? "Seal it and get the link" : "Seal and send",
                isLoading: viewModel.sending,
                height: 52
            ) {
                if needsBoughtStamp {
                    viewModel.openStampsForMedia()
                } else if needsStamps {
                    viewModel.showsStampBooks = true
                } else {
                    viewModel.sealOrSend()
                }
            }
            .accessibilityIdentifier("sendCardLookSend")
        }
    }
}

/// A page's pinned buttons on a soft fade: 12 pt above them, the safe area below, and a refusal right over them. The
/// refusal lies on its own cream slip in dark ink, so it reads over whatever scrolls under the fade (the arrival
/// choices, the card), as Android shows it (design check, Nov 17).
struct HolidayCardPinnedButton<Content: View>: View {
    let error: String?
    /// A quiet button lies under the main one (step 4's "Look it over"): the page behind it is solid, the fade running
    /// from clear at the top edge to full at the main button's middle, so no word of the page reads behind the quiet
    /// one (the design session's re-check, Nov 17). Look it over's own page, with its one button, keeps its fade.
    var quietUnder = false
    @ViewBuilder let button: Content
    @Environment(\.colorScheme) private var scheme
    /// From the pinned area's top edge to the main button's middle (the main button is the 52 pt one on top).
    @State private var toMainMiddle: CGFloat = 0

    var body: some View {
        if quietUnder {
            pinned
                .holidayCardSolidUnder(scheme, atTable: LaunchFeatures.cardTable, fadeHeight: toMainMiddle)
        } else {
            pinned
                .holidayCardButtonFade(scheme, atTable: LaunchFeatures.cardTable)
        }
    }

    private var pinned: some View {
        VStack(spacing: Spacing.s2) {
            if let error {
                Text(error)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(HolidayCardDesk.error(.light))
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, Spacing.s2)
                    .frame(maxWidth: .infinity)
                    .background(MailPaper.letter, in: RoundedRectangle(cornerRadius: 3, style: .continuous))
                    .shadow(color: .black.opacity(0.22), radius: 6, x: 0, y: 3)
                    .environment(\.colorScheme, .light)
                    .accessibilityIdentifier("sendCardError")
            }
            button
                .onGeometryChange(for: CGFloat.self) { $0.frame(in: .named(holidayCardPinnedArea)).minY + 26 } action: {
                    toMainMiddle = $0
                }
        }
        .frame(maxWidth: 560)
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s1)
        .frame(maxWidth: .infinity)
        .coordinateSpace(.named(holidayCardPinnedArea))
    }
}

/// The pinned area's own coordinates, to place where its background turns solid.
private let holidayCardPinnedArea = "holidayCardPinnedArea"

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
