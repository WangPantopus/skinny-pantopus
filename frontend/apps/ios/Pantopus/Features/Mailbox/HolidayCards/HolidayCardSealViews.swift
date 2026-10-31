//
//  HolidayCardSealViews.swift
//  Pantopus
//
//  Sealing a Christmas card and what follows (the web's `SendCardFlow`):
//  seal it for the day (when it arrives, until when it can be taken back,
//  then "Look it over"), the card on its way or today's card, and the
//  season once sending has closed.
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
        VStack(alignment: .leading, spacing: Spacing.s0) {
            MailPieceView(model: preview)
                .frame(maxWidth: 380)
                .rotationEffect(.degrees(1))
                .frame(maxWidth: .infinity)
                .accessibilityIdentifier("sendCardEnvelopePreview")
            Text("When should it arrive?")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(HolidayCardDesk.text(scheme))
                .accessibilityAddTraits(.isHeader)
                .padding(.top, Spacing.s6)
            VStack(spacing: 10) {
                ForEach(viewModel.arrivals, id: \.self) { arrival in
                    choice(arrival)
                }
            }
            .padding(.top, 10)
            Text(HolidayCardWords.sealNote(byEmail: recipient.isEmail))
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
            if let error = viewModel.previewError {
                Text(error)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(HolidayCardDesk.error(scheme))
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, Spacing.s3)
                    .accessibilityIdentifier("sendCardError")
            }
            // Step 5 shows exactly what they'll see; "Seal and send" is there.
            HolidayCardWaxButton(title: "Look it over", isLoading: viewModel.previewing, isEnabled: viewModel.arrival != nil) {
                Task { await viewModel.lookItOver() }
            }
            .padding(.top, Spacing.s5)
            .accessibilityIdentifier("sendCardSend")
        }
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
            to: recipient.name,
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
                    HolidayCardPictureView(design: design, thumb: true)
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
                    Text("To \(MailPieceModel.firstText(card.toName) ?? "them")")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(MailPaper.cardText)
                        .lineLimit(1)
                    Text(HolidayCardWords.arrivalLine(card))
                        .font(.system(size: 14))
                        .foregroundStyle(MailPaper.cardTextSoft)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(Spacing.s4)
            .background(MailPaper.cardField, in: RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).strokeBorder(MailPaper.cardRowEdge, lineWidth: 1))
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("sendCardSent")
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
            muted("One card a day. You can send another tomorrow.").padding(.top, Spacing.s3)
        }
        .confirmationDialog("Take your card back?", isPresented: $viewModel.confirmsTakeBack, titleVisibility: .visible) {
            Button("Take it back", role: .destructive) { Task { await viewModel.takeBack() } }
                .accessibilityIdentifier("sendCardTakeBackConfirm")
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(card.byEmail
                ? "The link in their email will say you took it back. You can send a card again today."
                : "It won’t go out with the morning mail. You can send a card again today.")
        }
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
