//
//  HolidayCardListViews.swift
//  Pantopus
//
//  One Christmas card to a list of people and addresses (digital stamps on;
//  the web's `SendCardFlow` list): the list on "Who it's for" and its
//  button on, Look it over's line for every card and its footer ("Postage ·
//  4 people · 4 stamps", "Seal and send 4 cards"), and On its way, where
//  each card can be taken back on its own and the cards that didn't go say
//  why. Each person gets a card of their own; nobody sees who else got one.
//

import SwiftUI

// MARK: - Step 1: the list

/// Who's on the list, each taken off with its ×, and what a list means.
struct HolidayCardListChips: View {
    let viewModel: HolidayCardFlowViewModel
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if !viewModel.listed.isEmpty {
                ExtrasFlowLayout(horizontalSpacing: Spacing.s2, verticalSpacing: Spacing.s2) {
                    ForEach(viewModel.listed, id: \.key) { entry in
                        Button { viewModel.toggle(entry) } label: {
                            HStack(spacing: 6) {
                                Text(entry.name)
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(MailPaper.cardText)
                                    .lineLimit(1)
                                    .frame(maxWidth: 240, alignment: .leading)
                                    .fixedSize(horizontal: true, vertical: false)
                                Icon(.x, size: 14, color: MailPaper.cardTextMuted)
                            }
                            .padding(.leading, 14)
                            .padding(.trailing, 10)
                            .frame(height: 36)
                            .background(MailPaper.cardField, in: Capsule())
                            .overlay(Capsule().strokeBorder(MailPaper.cardFieldEdge, lineWidth: 1))
                            .contentShape(Capsule())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Take \(entry.name) off the list")
                        .accessibilityIdentifier("sendCardListChip.\(entry.key)")
                    }
                }
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("sendCardList")
            }
            Text((viewModel.listIsFull ? "That’s \(viewModel.maxRecipients), the most for one send. " : "")
                + "Each person gets their own card. No one sees who else got one.")
                .font(.system(size: 13))
                .foregroundStyle(HolidayCardDesk.muted(scheme))
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// Step 1's button on, pinned under the list: "Continue with 4 people".
struct HolidayCardListContinueBar: View {
    let viewModel: HolidayCardFlowViewModel
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let listed = viewModel.listed
        let title = listed.count == 1
            ? "Continue with \(HolidayCardWords.firstName(listed[0].name))"
            : "Continue with \(listed.count) people"
        HolidayCardWaxButton(title: title) { viewModel.continueWithList() }
            .accessibilityIdentifier("sendCardContinue")
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

// MARK: - Step 5: look it over

/// Look it over for a list: the first card that can go, exactly as its
/// person will see it, then every card's line (when it comes, or why it
/// won't go).
struct HolidayCardListLookStep: View {
    let viewModel: HolidayCardFlowViewModel
    let cards: HolidayCardsResponse
    let design: HolidayCardDesign
    let look: HolidayCardListPreview

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s6) {
            if let preview = look.look, let first = viewModel.listFirst {
                HolidayCardLookStep(viewModel: viewModel, cards: cards, design: design, recipient: first, preview: preview)
            }
            HolidayCardListLines(viewModel: viewModel, lines: look.recipients)
        }
    }
}

/// "Going to 4 people": every card on the list in a line.
struct HolidayCardListLines: View {
    let viewModel: HolidayCardFlowViewModel
    let lines: [HolidayCardListLine]
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let ready = lines.filter { $0.status == "ready" }.count
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Going to \(ready) \(ready == 1 ? "person" : "people")")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(HolidayCardDesk.text(scheme))
                .accessibilityAddTraits(.isHeader)
            VStack(spacing: Spacing.s0) {
                ForEach(Array(lines.enumerated()), id: \.element.requestId) { index, line in
                    if index > 0 { Rectangle().fill(MailPaper.cardRowLine).frame(height: 1) }
                    row(line)
                }
            }
            .background(MailPaper.cardField, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).strokeBorder(MailPaper.cardRowEdge, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("sendCardListLook")
    }

    private func row(_ line: HolidayCardListLine) -> some View {
        let name = viewModel.listEntry(requestId: line.requestId)?.name ?? line.toName ?? ""
        return HStack(alignment: .top, spacing: Spacing.s3) {
            Text(String(name.prefix(1)).uppercased())
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(MailPaper.cardAvatarInk)
                .frame(width: 32, height: 32)
                .background(MailPaper.cardAvatar, in: Circle())
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                Text(name)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(MailPaper.cardText)
                    .lineLimit(1)
                Text(HolidayCardWords.listLine(line))
                    .font(.system(size: 13))
                    .foregroundStyle(line.status == "refused" ? MailPaper.warningInk : MailPaper.cardTextMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .accessibilityElement(children: .combine)
    }
}

/// Under a list's Look it over, pinned: until when each card can be taken
/// back, what the cards cost, why sending didn't go, and "Seal and send 4
/// cards" (or, with too few stamps, "Get stamps to send").
struct HolidayCardListLookFooter: View {
    let viewModel: HolidayCardFlowViewModel
    let entries: [HolidayCardRecipient]
    let look: HolidayCardListPreview
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let needed = look.needed
        let needsStamps = (viewModel.stamps.balance?.available ?? needed) < needed
        let cardsWord = needed == 1 ? "1 card" : "\(needed) cards"
        VStack(alignment: .leading, spacing: 10) {
            Text(HolidayCardWords.sealNote(list: entries))
                .font(.system(size: 13))
                .foregroundStyle(MailPaper.cardTextSoft)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, 10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(MailPaper.cardNote, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).strokeBorder(MailPaper.cardRowLine, lineWidth: 1))
            if needed > 0, let design = viewModel.design {
                StampPostageLine(store: viewModel.stamps, design: design.id, count: needed)
            } else if needed == 0 {
                Text("None of these cards can go now.")
                    .font(.system(size: 14))
                    .foregroundStyle(HolidayCardDesk.muted(scheme))
                    .frame(maxWidth: .infinity)
            }
            if let error = viewModel.sendError {
                Text(error)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(HolidayCardDesk.error(scheme))
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("sendCardError")
            }
            HolidayCardWaxButton(
                title: needsStamps ? "Get stamps to send" : viewModel.sending ? "Sending \(cardsWord)…" : "Seal and send \(cardsWord)",
                isLoading: viewModel.sending,
                isEnabled: needed > 0
            ) {
                if needsStamps { viewModel.getStampsForList() } else { Task { await viewModel.sendList() } }
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

// MARK: - On its way

/// A list on its way: each card in a row with its own "Take it back", the
/// cards that didn't go and why (no stamp used), and "Send the rest" when
/// only a hiccup kept some back.
struct HolidayCardListSentView: View {
    let viewModel: HolidayCardFlowViewModel
    let results: [HolidayCardListResult]
    let cards: HolidayCardsResponse
    let onDone: () -> Void
    /// "See them in Sent".
    var onSeeInSent: (() -> Void)?
    @State private var confirming: SentHolidayCard?
    @Environment(\.colorScheme) private var scheme

    /// A card that didn't go only because of a hiccup (or the stamps ran out meanwhile): sending again can work.
    private static let sendAgain: Set<String> = ["CARD_UNAVAILABLE", "BLOCK_CHECK_UNAVAILABLE", "STAMPS_REQUIRED"]

    var body: some View {
        let went = results.compactMap { $0.status == "not_sent" ? nil : $0.card }
        let stayed = results.filter { $0.status == "not_sent" }
        let onTheirWay = went.filter { !viewModel.listTakenBack.contains($0.id) }.count
        let again = stayed.contains { Self.sendAgain.contains($0.code ?? "") }
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text(onTheirWay == 1 ? "1 card is on its way." : "\(onTheirWay) cards are on their way.")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(HolidayCardDesk.text(scheme))
                .accessibilityIdentifier("sendCardListSentCount")
            ForEach(went) { card in
                row(card)
            }
            if !stayed.isEmpty {
                Text("Not sent")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(HolidayCardDesk.text(scheme))
                    .padding(.top, Spacing.s1)
                    .accessibilityAddTraits(.isHeader)
                ForEach(stayed, id: \.requestId) { result in
                    notSent(result)
                }
            }
            if let error = viewModel.sendError {
                Text(error)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(HolidayCardDesk.error(scheme))
                    .frame(maxWidth: .infinity)
                    .multilineTextAlignment(.center)
            }
            VStack(spacing: 10) {
                if again {
                    HolidayCardWaxButton(title: "Send the rest", isLoading: viewModel.sending) {
                        Task { await viewModel.sendList() }
                    }
                    .accessibilityIdentifier("sendCardSendRest")
                    HolidayCardPaperButton(title: "Back to your mail", fullWidth: true, action: onDone)
                        .accessibilityIdentifier("sendCardBackToMail")
                } else {
                    HolidayCardWaxButton(title: "Back to your mail", action: onDone)
                        .accessibilityIdentifier("sendCardBackToMail")
                }
                if let onSeeInSent {
                    Button(action: onSeeInSent) {
                        HStack(spacing: 6) {
                            Icon(.send, size: 16, color: HolidayCardDesk.link(scheme))
                            Text("See them in Sent")
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
            .padding(.top, Spacing.s1)
            Text("One digital stamp per card. Receiving and replies are free.")
                .font(.system(size: 13))
                .foregroundStyle(HolidayCardDesk.muted(scheme))
                .frame(maxWidth: .infinity)
                .multilineTextAlignment(.center)
        }
        .confirmationDialog(
            "Take your card back?",
            isPresented: Binding(get: { confirming != nil }, set: { if !$0 { confirming = nil } }),
            titleVisibility: .visible,
            presenting: confirming
        ) { card in
            Button("Take it back", role: .destructive) { Task { await viewModel.takeBackFromList(card) } }
                .accessibilityIdentifier("sendCardTakeBackConfirm")
            Button("Cancel", role: .cancel) {}
        } message: { card in
            Text(card.byEmail
                ? "The link in their email will say you took it back. \(HolidayCardWords.stampComesBack)"
                : "It won’t go out with the morning mail. \(HolidayCardWords.stampComesBack)")
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("sendCardListSent")
    }

    private func row(_ card: SentHolidayCard) -> some View {
        let back = viewModel.listTakenBack.contains(card.id)
        return HStack(alignment: .top, spacing: Spacing.s3) {
            if let design = card.design {
                let known = cards.designs.first { $0.id == design }
                HolidayCardPictureView(design: design, paper: known?.paper, height: known?.height, thumb: true)
                    .frame(width: 48)
                    .clipShape(RoundedRectangle(cornerRadius: 2, style: .continuous))
                    .shadow(color: MailPaper.cardShadow.opacity(0.22), radius: 5, x: 0, y: 4)
                    .rotationEffect(.degrees(-2))
                    .accessibilityHidden(true)
            }
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("To \(MailPieceModel.firstText(card.toName) ?? "them")")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(MailPaper.cardText)
                    .lineLimit(1)
                Text(back ? "You took this card back, and its stamp is back with you." : HolidayCardWords.arrivalLine(card))
                    .font(.system(size: 13))
                    .foregroundStyle(MailPaper.cardTextSoft)
                    .fixedSize(horizontal: false, vertical: true)
                if let error = viewModel.listTakeBackError, error.id == card.id {
                    Text(error.message)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(MailPaper.warningInk)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if card.canTakeBack, !back {
                    HolidayCardPaperButton(title: "Take it back", isLoading: viewModel.listTakingBack == card.id) {
                        confirming = card
                    }
                    .padding(.top, 2)
                    .accessibilityIdentifier("sendCardTakeBack.\(card.id)")
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Spacing.s3)
        .background(MailPaper.cardField, in: RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).strokeBorder(MailPaper.cardRowEdge, lineWidth: 1))
    }

    private func notSent(_ result: HolidayCardListResult) -> some View {
        let name = viewModel.listEntry(requestId: result.requestId)?.name ?? "them"
        let stamp = result.code == "CARD_TAKEN_BACK" ? "Its stamp came back." : "No stamp was used."
        return (Text("Not sent to \(name): ").fontWeight(.semibold).foregroundColor(MailPaper.cardText)
            + Text("\(result.error ?? "") \(stamp)").foregroundColor(MailPaper.cardTextSoft))
            .font(.system(size: 13))
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(MailPaper.cardNote, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).strokeBorder(MailPaper.cardRowLine, lineWidth: 1))
            .accessibilityIdentifier("sendCardNotSent.\(result.requestId)")
    }
}
