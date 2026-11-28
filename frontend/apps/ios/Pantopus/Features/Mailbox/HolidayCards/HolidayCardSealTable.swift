//
//  HolidayCardSealTable.swift
//  Pantopus
//
//  The send flow's side of sealing a card by hand (plan Part 2, launch key
//  `card_table`): "Seal and send" on Seal it for the day or on Look it over
//  opens the table over the flow, the seal sends the card with the draft's
//  request ID, and step 5's Done, Take it back and Share this card answer
//  from the flow. The table's own moves are in `CardTableSending.swift`.
//

import SwiftUI

extension HolidayCardFlowViewModel {
    /// "Seal and send": with the table on, it opens to seal the card by hand (the seal sends it); otherwise it goes.
    func sealOrSend() {
        // A card that travels needs the sender's town first (travelling card plan Part 2).
        if askTownFirst(then: { [weak self] in self?.sealOrSend() }) { return }
        if LaunchFeatures.cardTable {
            sealsAtTable = true
        } else if recipient?.entries != nil {
            Task { await sendList() }
        } else {
            Task { await send() }
        }
    }

    /// "Seal and send" on Seal it for the day (experience plan 5.1): the check Look it over runs, then straight to the
    /// sealing table, where the card is sealed by hand as from Look it over. A refusal stays under the choices; a list
    /// with a card that won't go opens Look it over instead; a server that can't show the look still lets it be sealed.
    func sealFromChoices() async {
        if askTownFirst(then: { [weak self] in Task { await self?.sealFromChoices() } }) { return }
        let passed = await lookItOver(opens: false)
        guard passed || (lookUnavailable && recipient?.entries == nil) else { return }
        sealOrSend()
    }

    /// The card on the sending table as the other person will find it: as Look it over lays it out, or for a list,
    /// the first person's.
    func sealContent() -> CardTableContent? {
        guard let design, let cards, let recipient else { return nil }
        if recipient.entries == nil, let preview {
            // As Look it over lays it out: the name it will really carry, the postmark by their clock, the note.
            let envelope = MailPieceModel(
                mail: preview.piece,
                recipient: MailPieceRecipient(name: envelopeName(recipient), addressLine: nil),
                opened: false
            )
            let card = preview.piece.item.card
            var content = CardTableContent(
                design: design.id,
                number: design.number,
                caption: card?.caption ?? design.caption,
                paper: card?.paper ?? design.paper,
                table: card?.table ?? design.table,
                slug: design.slug,
                year: card?.year ?? cards.year,
                mailedOn: envelope.postmarkDate,
                note: MailPieceModel.firstText(preview.piece.item.content, message) ?? "",
                fromName: envelope.from,
                toName: envelopeName(recipient),
                sealed: false,
                sealedUntil: nil,
                sealedInDays: "",
                sealedDayCount: 0,
                verse: design.verse,
                signature: cards.signature == nil ? nil : signature,
                mood: card?.mood ?? design.mood
            )
            // A card that travels: the look's one postmark, the sender's town, struck at the seal's thump (Part 2).
            if let stops = card?.travel?.postmarks, !stops.isEmpty {
                content.travel = CardTravelEnvelope(sealing: CardTravelEnvelope.marks(stops, year: content.year))
            }
            // A photo card (cards-next 4.2): sealed with its photo as the front.
            content.photoFront = photoFrontSpec
            return content
        }
        var content = CardTableContent(
            design: design.id,
            number: design.number,
            caption: design.caption,
            paper: design.paper,
            table: design.table,
            slug: design.slug,
            year: cards.year,
            mailedOn: MailDates.postmarkDay(Date(), calendar: .current),
            note: message.trimmingCharacters(in: .whitespacesAndNewlines),
            fromName: fromName,
            toName: envelopeName(recipient),
            sealed: false,
            sealedUntil: nil,
            sealedInDays: "",
            sealedDayCount: 0,
            verse: design.verse,
            signature: cards.signature == nil ? nil : signature,
            mood: design.mood
        )
        content.photoFront = photoFrontSpec
        return content
    }
}

/// The sealing table over the send flow, from the tab's root where it has a place for it (as Look it over's table).
struct CardTableSendCover: ViewModifier {
    let viewModel: HolidayCardFlowViewModel
    /// Done: back to the Mailbox.
    let onDone: () -> Void

    @Environment(\.cardTableCoverSlot) private var slot
    @State private var item: Item?

    private struct Item: Identifiable {
        let id = UUID()
        let model: CardTableModel
    }

    func body(content view: Content) -> some View {
        view
            .onChange(of: viewModel.sealsAtTable) { _, seals in
                present(seals ? makeItem() : nil)
            }
            .fullScreenCover(item: $item, onDismiss: { viewModel.sealsAtTable = false }, content: { item in
                tablePage(item)
            })
    }

    private func makeItem() -> Item? {
        guard let content = viewModel.sealContent() else { return nil }
        let model = CardTableModel(content: content, startsOnTable: true)
        let entries = viewModel.recipient?.entries
        let first = HolidayCardWords.firstName(entries?.first?.envelopeName ?? content.toName)
        model.beginSending(CardTableSendingSetup(
            toFirstName: viewModel.recipient?.isLink == true ? "" : first,
            count: max(1, entries?.count ?? 1),
            sealedForChristmas: viewModel.arrival == .sealedChristmas,
            offersQuickSeal: viewModel.improved && CardTableQuickSeal.sealedOnce,
            seal: { [weak model, viewModel] in
                guard let model else { return .refused(nil) }
                return await Self.seal(viewModel, model: model)
            },
            // Done goes to the Mailbox.
            onDone: { [viewModel] in
                viewModel.sealsAtTable = false
                onDone()
            }
        ))
        return Item(model: model)
    }

    private func present(_ next: Item?) {
        var quiet = Transaction()
        quiet.disablesAnimations = true
        withTransaction(quiet) {
            guard let slot else {
                item = next
                return
            }
            let page = next.map { next in
                CardTableCoverSlot.Page(
                    id: next.id.uuidString,
                    owner: viewModel,
                    content: { AnyView(tablePage(next)) },
                    onDismiss: { viewModel.sealsAtTable = false }
                )
            }
            slot.show(page, owner: viewModel)
        }
    }

    private func tablePage(_ item: Item) -> CardTableSendPage {
        CardTableSendPage(viewModel: viewModel, model: item.model)
    }

    /// The seal is the send: one card or a list, with the draft's request IDs. A refusal the flow shows itself (the
    /// stamp books, an arrival that closed) takes the table away so it can.
    @MainActor
    private static func seal(_ viewModel: HolidayCardFlowViewModel, model: CardTableModel) async -> CardTableSealAnswer {
        let list = viewModel.recipient?.entries
        if list != nil { await viewModel.sendList() } else { await viewModel.send() }
        guard viewModel.step == .sent else {
            // Out of stamps: the seal doesn't take and the stamp books open over the table (as web).
            if viewModel.showsStampBooks { return .refused(nil) }
            // A card that travels and no town yet: the table goes so "Where does it start?" can ask.
            if viewModel.asksTown {
                viewModel.sealsAtTable = false
                return .refused(nil)
            }
            // An arrival that closed, or a card sealed from Seal it for the day that didn't go: back to its choices,
            // which say why. A list says why on the table.
            if viewModel.step != .look, viewModel.sendError == nil {
                viewModel.sealsAtTable = false
                return .refused(nil)
            }
            return .refused(viewModel.sendError ?? "Couldn’t send your card just now. Try again in a moment.")
        }
        let shareItem = CardTableMenuItem(title: "Share this card", identifier: "cardTableSendShare") { [weak model] in
            model?.isSharing = true
        }
        // A photo card (cards-next 4.2) is never shared as a picture or a video.
        let share = model.content.isPhotoCard ? [] : [shareItem]
        let again = await sendAgain(viewModel)
        if let results = viewModel.listResults {
            let sent = results.filter { $0.card != nil }.count
            let words = sent == 1 ? "1 card on its way." : "\(sent) cards on their way."
            return .sent(words: travelWords(words, viewModel), primary: "Done", buttons: share + again)
        }
        guard let card = viewModel.sent else { return .sent(words: "On its way.", primary: "Done", buttons: share + again) }
        if card.byLink, let link = viewModel.sentLink {
            let from = HolidayCardWords.firstName(viewModel.fromName)
            let copy = CardTableMenuItem(title: "Copy link", identifier: "cardTableSendCopyLink") { [weak model] in
                UIPasteboard.general.string = link
                model?.showToast("Link copied.")
            }
            let shareLink = CardTableMenuItem(title: "Share", identifier: "cardTableSendShareLink") { [weak model] in
                model?.linkShareText = "A Christmas card for you from \(from): \(link)"
            }
            return .sent(words: travelWords("Your card is ready.", viewModel), primary: "Done", buttons: [copy, shareLink] + again)
        }
        let first = MailPieceModel.firstText(card.toName).map(HolidayCardWords.firstName) ?? "them"
        let lines = [HolidayCardWords.arrivalLine(card), HolidayCardWords.takeBackLine(card)].compactMap(\.self)
        var buttons: [CardTableMenuItem] = []
        if card.canTakeBack {
            buttons.append(CardTableMenuItem(title: "Take it back", identifier: "cardTableSendTakeBack") { [weak model] in
                model?.asksTakeBack = true
            })
        }
        buttons += share
        let travels = viewModel.sentTravels ? [HolidayCardTravelWords.sentLine] : []
        let words = (["On its way to \(first)."] + travels + lines).joined(separator: "\n")
        return .sent(words: words, primary: "Done", buttons: buttons + again)
    }

    /// A card that travels: its sent words gain "It can travel. You'll hear when it reaches a town." (plan Part 2).
    @MainActor
    private static func travelWords(_ words: String, _ viewModel: HolidayCardFlowViewModel) -> String {
        viewModel.sentTravels ? "\(words)\n\(HolidayCardTravelWords.sentLine)" : words
    }

    /// "Send this card to someone else" under the sent card (experience plan Part 6), when another card can go now: the
    /// table goes, and the flow starts again at Who it's for with the same picture.
    @MainActor
    private static func sendAgain(_ viewModel: HolidayCardFlowViewModel) async -> [CardTableMenuItem] {
        if viewModel.cards?.postageEnabled == true { await viewModel.stamps.refresh() }
        guard viewModel.canSendAnother, viewModel.design != nil else { return [] }
        let again = CardTableMenuItem(title: "Send this card to someone else", identifier: "cardTableSendAgain") { [viewModel] in
            viewModel.sealsAtTable = false
            viewModel.sendThisCardAgain()
        }
        return [again]
    }
}

/// The table while a card is sealed, and Take it back's question over it.
struct CardTableSendPage: View {
    @Bindable var viewModel: HolidayCardFlowViewModel
    let model: CardTableModel

    var body: some View {
        CardTableScreen(
            model: model,
            menuItems: [],
            isSender: true,
            sharesSealed: model.sendingSetup?.sealedForChristmas == true,
            closeLabel: closeLabel,
            onClose: close
        )
        // The stamp books over the table when the seal didn't take for a stamp (the flow's own stand aside meanwhile).
        .sheet(isPresented: Binding(
            get: { viewModel.showsStampBooks && viewModel.sealsAtTable },
            set: { viewModel.showsStampBooks = $0 }
        )) {
            StampBooksSheet(store: viewModel.stamps, short: viewModel.stampShort, forMedia: viewModel.stampsForMedia)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        // Its own question: the Sent page under the table asks with the flow's.
        .sheet(isPresented: Binding(get: { model.linkShareText != nil }, set: { if !$0 { model.linkShareText = nil } })) {
            SystemShareSheet(items: [model.linkShareText ?? ""])
        }
        .confirmationDialog(
            "Take your card back?",
            isPresented: Binding(get: { model.asksTakeBack }, set: { model.asksTakeBack = $0 }),
            titleVisibility: .visible
        ) {
            Button("Take it back", role: .destructive) {
                Task {
                    await viewModel.takeBack()
                    if viewModel.takeBackError == nil {
                        viewModel.sealsAtTable = false
                    } else if let error = viewModel.takeBackError {
                        model.showToast(error)
                    }
                }
            }
            .accessibilityIdentifier("cardTableTakeBackConfirm")
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(takeBackMessage)
        }
    }

    /// As the Sent page says it.
    private var takeBackMessage: String {
        let after = viewModel.cards?.postageEnabled == true ? HolidayCardWords.stampComesBack : "You can send a card again today."
        if viewModel.sent?.emailSendAt != nil { return "\(HolidayCardWords.notEmailedYet) \(after)" }
        if viewModel.sent?.byEmail == true { return "The link in their email will say you took it back. \(after)" }
        return "It won’t go out with the morning mail. \(after)"
    }

    private var closeLabel: String {
        switch model.sending {
        case .addressing, .gone: "Done"
        default: viewModel.step == .look ? "Back to Look it over" : "Back to \(viewModel.step.title)"
        }
    }

    /// ✕: before the seal, back to the page it was opened from with nothing sent; once it's sent, the same as Done.
    private func close() {
        switch model.sending {
        case .sealing:
            break
        case .addressing, .gone:
            model.sendingSetup?.onDone()
        default:
            viewModel.sealsAtTable = false
        }
    }
}
