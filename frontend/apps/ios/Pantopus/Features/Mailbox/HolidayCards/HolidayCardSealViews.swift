//
//  HolidayCardSealViews.swift
//  Pantopus
//
//  Sealing a Christmas card and what follows (the web's `SendCardFlow`):
//  seal it for the day (when it arrives, until when it can be taken back,
//  the postage; "Seal and send" with "Look it over" under it pinned at the
//  bottom), the card on its way or today's card, and the season once sending
//  has closed.
//

import SwiftUI

// MARK: - Step 4: seal it for the day

struct HolidayCardSealStep: View {
    @Bindable var viewModel: HolidayCardFlowViewModel
    let cards: HolidayCardsResponse
    let design: HolidayCardDesign
    let recipient: HolidayCardRecipient
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        if WideLayout.isPad {
            // On an iPad window wide enough the envelope as it will go in one column, and when it arrives beside it in the
            // other; one column, in this order, in a narrower window and at the accessibility sizes.
            WideColumns {
                VStack(alignment: .leading, spacing: Spacing.s0) { envelope }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .placeColumn(.leading, order: 0)
                VStack(alignment: .leading, spacing: Spacing.s0) { choices }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .placeColumn(.trailing, order: 1, trimsTop: Spacing.s6)
            }
        } else {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                envelope
                choices
            }
        }
    }

    /// The red envelope as it will go, and how many go on a list.
    @ViewBuilder
    private var envelope: some View {
        MailPieceView(model: preview)
            .frame(maxWidth: 380)
            .rotationEffect(.degrees(1))
            .frame(maxWidth: .infinity)
            .accessibilityIdentifier("sendCardEnvelopePreview")
        if let entries = recipient.entries {
            Text("One envelope for each of the \(entries.count) people.")
                .font(.system(size: 14))
                .foregroundStyle(HolidayCardDesk.muted(scheme))
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .padding(.top, Spacing.s3)
                .accessibilityIdentifier("sendCardEnvelopeCount")
        }
    }

    /// When it should arrive, until when it can be taken back, and the postage.
    @ViewBuilder
    private var choices: some View {
        arrivalChoices
            .padding(.top, Spacing.s6)
        Text(sealNote)
            .font(.system(size: 13))
            .foregroundStyle(MailPaper.cardTextSoft)
            .lineSpacing(2)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 14)
            .padding(.vertical, Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(MailPaper.cardNote, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).strokeBorder(MailPaper.cardRowLine, lineWidth: 1))
            .padding(.top, 14)
        // The postage is read here too, so a sender who skips Look it over has read it (experience plan 5.1).
        if cards.postageEnabled {
            StampPostageLine(
                store: viewModel.stamps,
                design: design.id,
                count: recipient.entries?.count ?? 1,
                media: viewModel.mediaSpendsBoughtStamp
            )
            .padding(.top, Spacing.s3)
        }
        // "Seal and send" and "Look it over" are pinned under the page (`HolidayCardSealFooter`); the page's own
        // end leaves room for the last line to scroll clear of them.
    }

    /// "When should it arrive?" and its three choices; at the table (plan Part 9) on a cream slip lying on the cloth.
    @ViewBuilder
    private var arrivalChoices: some View {
        let choices = VStack(alignment: .leading, spacing: Spacing.s0) {
            Text("When should it arrive?")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(LaunchFeatures.cardTable ? MailPaper.cardText : HolidayCardDesk.text(scheme))
                .accessibilityAddTraits(.isHeader)
            VStack(spacing: 10) {
                ForEach(viewModel.arrivals, id: \.self) { arrival in
                    choice(arrival)
                }
                // Under the arrival choices, on the same paper (travelling card plan Part 2).
                if viewModel.travelOffered {
                    HolidayCardTravelRow(
                        isOn: Binding(get: { viewModel.travels }, set: { viewModel.setTravels($0) }),
                        firstName: travelFirstName,
                        improved: viewModel.improved
                    )
                }
            }
            .padding(.top, 10)
        }
        if LaunchFeatures.cardTable {
            choices
                .environment(\.colorScheme, .light)
                .padding(14)
                .background(MailPaper.letter, in: RoundedRectangle(cornerRadius: 3, style: .continuous))
                .shadow(color: .black.opacity(0.28), radius: 10, x: 0, y: 6)
                .rotationEffect(.degrees(-0.6))
                .accessibilityIdentifier("sendCardArrivalSlip")
        } else {
            choices
        }
    }

    /// Who can pass it on, by first name: the person chosen; nil for an address, a link or a list ("They").
    private var travelFirstName: String? {
        guard case let .person(_, name) = recipient else { return nil }
        return HolidayCardWords.firstName(name)
    }

    /// Until when it can be taken back (each card on a list on its own).
    private var sealNote: String {
        if let entries = recipient.entries { return HolidayCardWords.sealNote(list: entries) }
        if case .person = recipient, viewModel.arrival == .now { return HolidayCardWords.rightAwayNote }
        return recipient.isLink ? HolidayCardWords.sealNoteByLink : HolidayCardWords.sealNote(byEmail: recipient.isEmail)
    }

    /// The red envelope as it will go: from the sender, to them, sealed when
    /// sealed is chosen.
    private var preview: MailPieceModel {
        let calendar = Calendar.current
        let now = Date()
        return MailPieceModel(
            id: "preview-\(design.id)",
            kind: .letter,
            isSpecialDelivery: false,
            trust: .neighbor,
            from: viewModel.fromName,
            fromLine: nil,
            to: viewModel.envelopeName(recipient),
            toLine: nil,
            note: nil,
            postmarkTown: nil,
            postmarkDate: MailDates.postmarkDay(now, calendar: calendar),
            postmarkYear: String(calendar.component(.year, from: now)),
            isOpened: false,
            isFaded: false,
            stamp: MailStampArt.forCard(number: design.number),
            peekLine: nil,
            meta: MailPieceMeta(parts: [], due: nil, dueIsSettled: false),
            card: MailCard(design: design, year: cards.year, sealed: viewModel.arrival == .sealedChristmas)
        )
    }

    private func choice(_ arrival: HolidayCardArrival) -> some View {
        let words = HolidayCardWords.arrivalChoice(arrival, cards: cards, recipient: recipient, theirDay: viewModel.theirDay)
        let checked = viewModel.arrival == arrival
        return Button {
            viewModel.pick(arrival)
        } label: {
            HStack(alignment: .top, spacing: Spacing.s3) {
                Circle()
                    .strokeBorder(checked ? MailPaper.wax : MailPaper.cardFieldEdge, lineWidth: checked ? 5 : 1.5)
                    .frame(width: 18, height: 18)
                    .padding(.top, 1)
                VStack(alignment: .leading, spacing: 2) {
                    Text(words.title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(MailPaper.cardText)
                    Text(words.detail)
                        .font(.system(size: 13))
                        .foregroundStyle(MailPaper.cardTextMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(14)
            .background(MailPaper.cardField, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .strokeBorder(checked ? MailPaper.wax : MailPaper.cardRowEdge, lineWidth: checked ? 2 : 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(checked ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("sendCardArrival.\(arrival.rawValue)")
    }
}

/// Step 4's buttons, pinned at the bottom on the soft fade Look it over's button has, so both show the moment the step
/// opens (design check, Nov 17, Fix 2): "Seal and send" (or "Seal it and get the link", "Seal and send 4 cards", "Get
/// stamps to send"), and under it "Look it over" as a quiet button. Why the card didn't go shows in one line over them.
struct HolidayCardSealFooter: View {
    let viewModel: HolidayCardFlowViewModel
    let cards: HolidayCardsResponse
    let recipient: HolidayCardRecipient
    /// "Look it over" was pressed (its button shows the wait, not "Seal and send").
    @State private var looking = false

    /// "Seal and send" goes straight to the sealing table after the same check Look it over runs; "Look it over" under
    /// it shows exactly what they'll see first (experience plan 5.1). With no stamp left, the stamp books.
    var body: some View {
        HolidayCardPinnedButton(error: viewModel.sealNotice, quietUnder: !viewModel.lookUnavailable) {
            VStack(spacing: Spacing.s1) {
                HolidayCardWaxButton(
                    title: needsStamps ? "Get stamps to send" : sealTitle,
                    isLoading: (viewModel.previewing && !looking) || viewModel.sending,
                    isEnabled: viewModel.arrival != nil,
                    height: 52
                ) {
                    if needsBoughtStamp {
                        viewModel.openStampsForMedia()
                    } else if needsStamps {
                        getStamps()
                    } else {
                        looking = false
                        Task { await viewModel.sealFromChoices() }
                    }
                }
                .accessibilityIdentifier("sendCardSend")
                // Nothing to show when the server can't show the look; the card can still be sealed.
                if !viewModel.lookUnavailable {
                    HolidayCardQuietButton(title: "Look it over", isLoading: viewModel.previewing && looking) {
                        looking = true
                        Task { await viewModel.lookItOver() }
                    }
                    .disabled(viewModel.arrival == nil || viewModel.previewing || viewModel.sending)
                    .accessibilityIdentifier("sendCardLookItOver")
                }
            }
        }
    }

    /// Look it over's main words: "Seal and send", "Seal it and get the link", or "Seal and send 4 cards".
    private var sealTitle: String {
        if let entries = recipient.entries { return "Seal and send \(entries.count == 1 ? "1 card" : "\(entries.count) cards")" }
        return recipient.isLink ? "Seal it and get the link" : "Seal and send"
    }

    /// Postage on and too few stamps left for this card (or each card on the list), or no bought stamp for the card's
    /// photo or greeting.
    private var needsStamps: Bool {
        guard cards.postageEnabled else { return false }
        if let entries = recipient.entries { return (viewModel.stamps.balance?.available ?? entries.count) < entries.count }
        return viewModel.stamps.isOut || needsBoughtStamp
    }

    private var needsBoughtStamp: Bool {
        viewModel.mediaNeedsBoughtStamp
    }

    /// The stamp books, saying how many more a list's cards need.
    private func getStamps() {
        if let entries = recipient.entries {
            let missing = entries.count - (viewModel.stamps.balance?.available ?? 0)
            viewModel.stampShort = StampShort(cards: entries.count, missing: max(1, missing))
        }
        viewModel.showsStampBooks = true
    }
}

// MARK: - On its way, or today's card

struct HolidayCardSentView: View {
    @Bindable var viewModel: HolidayCardFlowViewModel
    let card: SentHolidayCard
    let cards: HolidayCardsResponse
    /// "On its way" just after sending, "Today's card" after that.
    let title: String
    let onDone: () -> Void
    /// "See it in Sent", just after sending.
    var onSeeInSent: (() -> Void)?
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        VStack(spacing: Spacing.s0) {
            HStack(alignment: .top, spacing: Spacing.s4) {
                if let design = card.design {
                    let known = cards.designs.first { $0.id == design }
                    HolidayCardPictureView(design: design, paper: known?.paper, height: known?.height, thumb: true)
                        .frame(width: 84)
                        .clipShape(RoundedRectangle(cornerRadius: 2, style: .continuous))
                        .shadow(color: MailPaper.cardShadow.opacity(0.25), radius: 7, x: 0, y: 6)
                        .rotationEffect(.degrees(-2))
                }
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(title)
                        .font(.system(size: 13, weight: .semibold))
                        .tracking(0.8)
                        .textCase(.uppercase)
                        .foregroundStyle(MailPaper.cardTextMuted)
                    Text(card.byLink && card
                        .status != "claimed" ? "To whoever opens your link" : "To \(MailPieceModel.firstText(card.toName) ?? "them")")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(MailPaper.cardText)
                        .lineLimit(1)
                    Text(HolidayCardWords.arrivalLine(card))
                        .font(.system(size: 14))
                        .foregroundStyle(MailPaper.cardTextSoft)
                        .fixedSize(horizontal: false, vertical: true)
                    if viewModel.sentTravels {
                        Text(HolidayCardTravelWords.sentLine)
                            .font(.system(size: 14))
                            .foregroundStyle(MailPaper.cardTextSoft)
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityIdentifier("sendCardTravels")
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(Spacing.s4)
            .background(MailPaper.cardField, in: RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).strokeBorder(MailPaper.cardRowEdge, lineWidth: 1))
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("sendCardSent")
            if card.byLink, card.canTakeBack {
                CardTableLinkActions(cardId: card.id, link: viewModel.sentLink, fromName: viewModel.fromName)
                    .padding(.top, Spacing.s4)
            }
            if let line = HolidayCardWords.takeBackLine(card) {
                muted(line).padding(.top, Spacing.s3)
            }
            if let error = viewModel.takeBackError {
                Text(error)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(MailPaper.warningInk)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, Spacing.s2)
            }
            VStack(spacing: 10) {
                if card.canTakeBack {
                    HolidayCardPaperButton(title: "Take it back", isLoading: viewModel.takingBack, fullWidth: true) {
                        viewModel.confirmsTakeBack = true
                    }
                    .accessibilityIdentifier("sendCardTakeBack")
                }
                HolidayCardWaxButton(title: "Back to your mail", action: onDone)
                    .accessibilityIdentifier("sendCardBackToMail")
                if let onSeeInSent {
                    Button(action: onSeeInSent) {
                        HStack(spacing: 6) {
                            Icon(.send, size: 16, color: HolidayCardDesk.link(scheme))
                            Text("See it in Sent")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(HolidayCardDesk.link(scheme))
                        }
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityElement(children: .combine)
                    .accessibilityAddTraits(.isButton)
                    .accessibilityIdentifier("sendCardSeeInSent")
                }
            }
            .padding(.top, Spacing.s4)
            muted(cards
                .postageEnabled ? "One digital stamp per card. Receiving and replies are free." :
                "One card a day. You can send another tomorrow.").padding(
                .top,
                Spacing.s3
            )
        }
        .confirmationDialog("Take your card back?", isPresented: $viewModel.confirmsTakeBack, titleVisibility: .visible) {
            Button("Take it back", role: .destructive) { Task { await viewModel.takeBack() } }
                .accessibilityIdentifier("sendCardTakeBackConfirm")
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(card.byLink
                ? "Your link will say you took it back. \(afterTakeBack)"
                : card.emailSendAt != nil
                ? "\(HolidayCardWords.notEmailedYet) \(afterTakeBack)"
                : card.byEmail
                ? "The link in their email will say you took it back. \(afterTakeBack)"
                : "It won’t go out with the morning mail. \(afterTakeBack)")
        }
    }

    /// What taking it back gives back: the card's stamp with digital stamps on, else today's card.
    private var afterTakeBack: String {
        cards.postageEnabled ? HolidayCardWords.stampComesBack : "You can send a card again today."
    }

    private func muted(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 13))
            .foregroundStyle(HolidayCardDesk.muted(scheme))
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
    }
}

// MARK: - Closed for the year

struct HolidayCardsClosedView: View {
    let onDone: () -> Void
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        VStack(spacing: Spacing.s2) {
            Text("Christmas cards are done for this year")
                .font(.system(size: 22, design: .serif))
                .foregroundStyle(MailPaper.wax)
            Text("The cards you received stay in your mailbox.")
                .font(.system(size: 15))
                .foregroundStyle(HolidayCardDesk.muted(scheme))
            HolidayCardWaxButton(title: "Back to your mail", action: onDone)
                .padding(.top, Spacing.s4)
        }
        .multilineTextAlignment(.center)
        .fixedSize(horizontal: false, vertical: true)
        .padding(.horizontal, Spacing.s2)
        .padding(.top, Spacing.s8)
        .accessibilityIdentifier("sendCardClosed")
    }
}
