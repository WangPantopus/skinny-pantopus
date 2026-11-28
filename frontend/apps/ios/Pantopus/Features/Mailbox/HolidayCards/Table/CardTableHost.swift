//
//  CardTableHost.swift
//  Pantopus
//
//  A received card on the table over its Mail screen (launch key `card_table`):
//  a full-screen cover with no system animation, which also spans side-by-side
//  Mail on the iPhone Duo. Who sent it, the Vault, Shred, Report and Block come
//  up from the cover, not the screen under it. Closing it goes back.
//

import SwiftUI

extension CardTableContent {
    /// A card from the Mailbox.
    @MainActor
    init(letter: MailLetter, card: HolidayCardLetter, now: Date = Date()) {
        design = card.card.design
        number = card.card.number
        caption = card.card.caption ?? ""
        paper = card.card.paper
        table = card.card.table
        slug = card.card.slug
        year = card.card.year
        mailedOn = card.mailedOn
        note = card.note
        fromName = letter.senderName
        toName = card.envelope.to
        sealed = card.card.sealed
        sealedUntil = card.card.sealedUntil
        sealedInDays = card.card.sealedUntil.map { HolidayCardWords.inDays($0, now: now) } ?? "soon"
        sealedDayCount = card.card.sealedUntil
            .flatMap { MailDates.parse($0) }
            .map { MailDates.daysBetween(now, $0, calendar: .current) } ?? 0
        verse = card.card.sealed ? nil : card.card.verse
        signature = card.card.sealed ? nil : card.card.signature
        photo = card.card.sealed ? nil : card.card.photo
        voice = card.card.sealed ? nil : card.card.voice
        mediaFrom = .piece(mailId: letter.piece.id)
        travel = CardTravelEnvelope(card.card.travel, year: card.card.year)
        mood = card.card.mood
    }
}

/// Where a tab's root shows the card table. On the open Duo a cover presented from inside side-by-side Mail is shown
/// again each time the halves redraw, and a sheet over it (Share, Who sent it) went and came back in a loop; the tab's
/// root stays put, so the Mail screens hand it their page. Without one (another tab) a screen presents it itself.
@MainActor @Observable
final class CardTableCoverSlot {
    struct Page: Identifiable {
        let id: String
        /// The model of the screen that opened it: the page goes when that screen leaves the stack.
        let owner: AnyObject
        let content: () -> AnyView
        var onDismiss: () -> Void = {}
    }

    private(set) var page: Page?

    /// Shows a page, or with nil takes down the one this owner put up.
    func show(_ page: Page?, owner: AnyObject) {
        if let page {
            self.page = page
        } else if let shown = self.page, shown.owner === owner {
            self.page = nil
            shown.onDismiss()
        }
    }

    /// Takes the page down once the screen that opened it is gone.
    func keep(while isKept: (AnyObject) -> Bool) {
        guard let page, !isKept(page.owner) else { return }
        var quiet = Transaction()
        quiet.disablesAnimations = true
        withTransaction(quiet) { self.page = nil }
    }

    fileprivate func dismissed() {
        guard let page else { return }
        show(nil, owner: page.owner)
    }
}

private struct CardTableCoverSlotKey: EnvironmentKey {
    static var defaultValue: CardTableCoverSlot? {
        nil
    }
}

extension EnvironmentValues {
    /// The tab root's place for the card table; nil where the screen presents it itself.
    var cardTableCoverSlot: CardTableCoverSlot? {
        get { self[CardTableCoverSlotKey.self] }
        set { self[CardTableCoverSlotKey.self] = newValue }
    }
}

extension View {
    /// A tab's root: the card table its screens open shows from here, with no system animation.
    func cardTableCoverSlot(_ slot: CardTableCoverSlot) -> some View {
        environment(\.cardTableCoverSlot, slot)
            .fullScreenCover(item: Binding(get: { slot.page }, set: { if $0 == nil { slot.dismissed() } })) { page in
                page.content()
            }
    }
}

/// The cards waiting in the Mailbox list a card was opened from (experience plan Part 4): delivered, not opened, and
/// not sealed (or its seal has lifted), oldest first. Handed over by the list as it opens a piece; a card opened from a
/// notice or a link finds none, so "Open the next card" doesn't show there.
@MainActor
enum HolidayCardWaiting {
    private static var handed: (from: String, waiting: [String])?

    /// The list opens `mailId`, with these others waiting.
    static func hand(from mailId: String, waiting: [String]) {
        handed = (mailId, waiting.filter { $0 != mailId })
    }

    /// The cards still waiting after this one; none when it wasn't opened from the list.
    static func after(_ mailId: String) -> [String] {
        guard let handed, handed.from == mailId else { return [] }
        return handed.waiting
    }

    /// The next card to open after this one, which the list then counts as opened from.
    static func next(after mailId: String) -> String? {
        guard let handed, handed.from == mailId, let next = handed.waiting.first else { return nil }
        self.handed = (next, Array(handed.waiting.dropFirst()))
        return next
    }
}

/// Which card the cover shows.
private struct CardTableCoverItem: Identifiable {
    let id: String
    let model: CardTableModel
}

struct MailCardTableCover: ViewModifier {
    let viewModel: MailDetailViewModel
    let senderLink: (MailDetailContent) -> (title: String, open: () -> Void)?
    var onSendCard: (@MainActor (_ userId: String, _ name: String) -> Void)?
    /// "Open the next card": this page gives way to the next card's (experience plan Part 4).
    var onOpenNextCard: (@MainActor (String) -> Void)?
    let onClose: () -> Void

    @Environment(\.cardTableCoverSlot) private var slot
    @State private var item: CardTableCoverItem?

    func body(content: Content) -> some View {
        content
            .onChange(
                of: viewModel.cardTable == nil || viewModel.cardTableClosed,
                initial: true
            ) { _, hidden in
                present(hidden ? nil : viewModel.cardTable.map { CardTableCoverItem(id: viewModel.mailId, model: $0) })
            }
            .fullScreenCover(item: $item) { item in
                tablePage(item)
            }
    }

    private func present(_ next: CardTableCoverItem?) {
        var quiet = Transaction()
        quiet.disablesAnimations = true
        withTransaction(quiet) {
            guard let slot else {
                item = next
                return
            }
            let page = next.map { next in
                CardTableCoverSlot.Page(id: next.id, owner: viewModel) { AnyView(tablePage(next)) }
            }
            slot.show(page, owner: viewModel)
        }
    }

    private func tablePage(_ item: CardTableCoverItem) -> MailCardTablePage {
        MailCardTablePage(
            viewModel: viewModel,
            model: item.model,
            senderLink: senderLink,
            onSendCard: onSendCard,
            onOpenNextCard: onOpenNextCard,
            onClose: close
        )
    }

    private func close() {
        viewModel.cardTableClosed = true
        onClose()
    }
}

/// The table, and what comes up from its ⋯.
private struct MailCardTablePage: View {
    let viewModel: MailDetailViewModel
    let model: CardTableModel
    let senderLink: (MailDetailContent) -> (title: String, open: () -> Void)?
    let onSendCard: (@MainActor (_ userId: String, _ name: String) -> Void)?
    let onOpenNextCard: (@MainActor (String) -> Void)?
    let onClose: () -> Void

    @State private var reportsSender = false
    @State private var confirmsBlock = false
    @State private var blockInFlight = false
    /// This reader has blocked the card's sender (just now, or before it opened): no Write back and no Block, as on the
    /// web.
    @State private var senderBlocked = false
    /// Write back (experience plan Part 3): the sheet to write on, and the joined card once written.
    @State private var writingBack = false
    @State private var joined: CardReplyPair?

    private var letter: MailLetter? {
        if case let .loaded(content) = viewModel.state { return content.letter }
        return nil
    }

    private var senderContent: MailDetailContent? {
        if case let .loaded(content) = viewModel.state { return content }
        return nil
    }

    /// A person's id, for Report and Block; a business has its own page for those.
    private var senderPersonId: String? {
        guard let content = senderContent, !content.senderIsBusiness else { return nil }
        return content.senderUserId
    }

    var body: some View {
        CardTableScreen(model: model, menuItems: menuItems, sharesQuietly: false, onClose: onClose)
            .sheet(isPresented: Binding(get: { viewModel.showsSenderSheet }, set: { viewModel.showsSenderSheet = $0 })) {
                if let letter, let content = senderContent {
                    MailSenderSheet(letter: letter, senderLink: leavingLink(content))
                        .presentationDetents([.medium, .large])
                        .presentationDragIndicator(.visible)
                }
            }
            .modifier(MailVaultFolderPickers(viewModel: viewModel))
            .confirmationDialog(
                "Shred this?",
                isPresented: Binding(get: { viewModel.confirmsShred }, set: { viewModel.confirmsShred = $0 }),
                titleVisibility: .visible
            ) {
                Button("Shred", role: .destructive) { Task { await viewModel.act(.shred) } }
                    .accessibilityIdentifier("cardTableShredConfirm")
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("It's gone from your mailbox. You can bring it back for 30 days.")
            }
            .confirmationDialog(
                "Block \(model.content.firstName)?",
                isPresented: $confirmsBlock,
                titleVisibility: .visible
            ) {
                Button("Block", role: .destructive) { Task { await block() } }
                    .accessibilityIdentifier("cardTableBlockConfirm")
                Button("Cancel", role: .cancel) {}
            } message: {
                // A block withdraws what's on its way between them (memories contract section 8; wave 4 drawing 8).
                Text(
                    LaunchFeatures.holidayCardMemories
                        ? "They won't be able to send you mail. Cards and replies on their way between you are withdrawn. "
                        + "This card stays until you shred it."
                        : "They won't be able to send you mail. This card stays until you shred it."
                )
            }
            .sheet(isPresented: $reportsSender) {
                if let senderPersonId {
                    ReportUserSheet(
                        userId: senderPersonId,
                        handle: nil,
                        displayName: model.content.fromName,
                        // "Report this card" shares that card, and only that card, with Pantopus admins.
                        card: LaunchFeatures.holidayCardMemories
                            ? ReportedCard(mailId: viewModel.mailId, senderFirstName: model.content.firstName)
                            : nil,
                        onClose: { reportsSender = false },
                        onSubmitted: {
                            reportsSender = false
                            model.showToast("Report sent. Thanks for telling us.")
                        }
                    )
                }
            }
            // A sheet over the table holds the mail still.
            .onChange(of: viewModel.showsSenderSheet || reportsSender) { _, covered in model.setPaused(covered) }
            // A fold rebuilds this page, and any report form on it is gone: only the sender sheet comes back.
            .onAppear { model.setPaused(viewModel.showsSenderSheet) }
            .onChange(of: viewModel.toast) { _, toast in
                if let toast { model.showToast(toast) }
            }
            // Send one back (plan Part 3): only when a card can go to them now. Hidden while it's sealed, when the
            // season is closed, when either has blocked the other, and when their account is gone.
            // Share this card (plan 11.1) comes under it too, so the room is kept for any card that isn't sealed.
            .onAppear { model.reservesSecondary = sendBackPerson != nil || !model.content.sealed }
            .task(id: sendBackPerson?.id) { await checkSendBack() }
            .onAppear(perform: offerNextCard)
            .task(id: model.content.sealed) { await readExchange() }
            // The reader joined Pantopus for this card (cards-next 4.1): guidance cards and the briefings notice wait.
            .onChange(of: letter?.card?.card.joinedFor == true, initial: true) { GuidanceCenter.shared.joinedForCardOnScreen = $1 }
            .onDisappear { GuidanceCenter.shared.joinedForCardOnScreen = false }
            .task(id: senderPersonId) { await readBlocked() }
            .fullScreenCover(isPresented: $writingBack) {
                CardTableReplySheet(cardId: viewModel.mailId, content: model.content) { sent in
                    writingBack = false
                    if sent { Task { await readExchange() } }
                }
            }
            .fullScreenCover(item: $joined) { pair in
                CardTableJoinedPage(pair: pair, closeLabel: "Back to the card") { joined = nil }
            }
            .modifier(CardTableTravelReader(viewModel: viewModel, model: model))
    }

    /// The card and its reply (experience plan Part 3): "Write back to {first name}" when the server says this reader
    /// can, "You wrote back · {day}" once they have, nothing otherwise (replies off, a sealed card, a block).
    private func readExchange() async {
        guard LaunchFeatures.holidayCardMemories, !model.content.sealed, !model.content.isLetter else {
            model.writeBack = nil
            return
        }
        let exchange: HolidayCardExchange? = try? await APIClient.shared.request(HolidayCardEndpoints.exchange(cardId: viewModel.mailId))
        guard let exchange, !Task.isCancelled else { return }
        let first = model.content.firstName
        if exchange.canReply, !senderBlocked {
            model.writeBack = CardTableMenuItem(
                title: CardReplyWords.writeBack(first),
                identifier: "cardTableWriteBack",
                short: "Write back"
            ) {
                writingBack = true
            }
            // Opened from the welcome strip's "Write back" (cards-next 4.1): straight to the reply.
            if CardTableWriteBackIntent.take(viewModel.mailId) { writingBack = true }
        } else if let reply = exchange.reply, let pair = CardReplyPair(exchange) {
            // The row drops the day (the joined card shows it); VoiceOver still hears it.
            model.writeBack = CardTableMenuItem(
                title: "You wrote back",
                identifier: "cardTableWroteBack",
                spoken: CardReplyWords.wroteBack(on: reply.sentOn)
            ) {
                joined = pair
            }
        } else {
            model.writeBack = nil
        }
    }

    /// "Open the next card (2 more)", when this card came from the Mailbox list and others wait there (experience plan
    /// Part 4; the count in its own words since the design check, Nov 17). It closes this card and brings the next
    /// envelope onto the table.
    private func offerNextCard() {
        let waiting = HolidayCardWaiting.after(viewModel.mailId)
        guard onOpenNextCard != nil, !waiting.isEmpty else {
            model.nextCard = nil
            model.reservesNext = false
            return
        }
        model.reservesNext = true
        model.nextCard = CardTableMenuItem(
            title: "Open the next card (\(waiting.count) more)",
            identifier: "cardTableNextCard",
            short: "Next card (\(waiting.count) more)",
            spoken: "Open the next card, \(waiting.count) more waiting"
        ) { [viewModel] in
            guard let next = HolidayCardWaiting.next(after: viewModel.mailId) else { return }
            onOpenNextCard?(next)
        }
    }

    /// Who "Send {first name} a card" goes to: the person who sent it, on an opened card, when this page can open
    /// the send flow.
    private var sendBackPerson: (id: String, name: String)? {
        guard onSendCard != nil, !model.content.sealed, let id = senderPersonId else { return nil }
        return (id, model.content.fromName)
    }

    private func checkSendBack() async {
        guard let person = sendBackPerson, model.sendBack == nil else { return }
        guard await HolidayCardSendBack.isOpen(to: person.id), !Task.isCancelled else { return }
        model.sendBack = CardTableMenuItem(
            title: "Send \(model.content.firstName) a card",
            identifier: "cardTableSendBack",
            short: "Send a card"
        ) {
            sendCard(to: person)
        }
    }

    /// The table closes and the send flow opens at Pick a card, that person chosen.
    private func sendCard(to person: (id: String, name: String)) {
        onClose()
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 300_000_000)
            onSendCard?(person.id, person.name)
        }
    }

    /// The sender's page takes the card's place: Back from it goes to the Mailbox, and the card opens again from there.
    private func leavingLink(_ content: MailDetailContent) -> (title: String, open: () -> Void)? {
        senderLink(content).map { link in
            (link.title, { leave(then: link.open) })
        }
    }

    /// The sheet closes first: a cover can't leave while a sheet is on its way out of it.
    private func leave(then open: @escaping () -> Void) {
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 500_000_000)
            onClose()
            open()
        }
    }

    private var menuItems: [CardTableMenuItem] {
        var items: [CardTableMenuItem] = []
        // Only two quiet buttons show under the card (the design check, Nov 17), so the next card and Write back lead
        // the menu whenever they apply, as on Android.
        if let next = model.nextCard, !model.content.sealed {
            items.append(CardTableMenuItem(title: next.title, identifier: "cardTableMenuNextCard", action: next.action))
        }
        if let writeBack = model.writeBack {
            let identifier = writeBack.identifier == "cardTableWroteBack" ? "cardTableMenuWroteBack" : "cardTableMenuWriteBack"
            items.append(CardTableMenuItem(title: writeBack.title, identifier: identifier, action: writeBack.action))
        }
        // A travelling card: "See its journey" (travelling card plan Part 4), as the quiet row may not show it.
        items += model.travelButtons.menu
        items.append(CardTableMenuItem(title: "Who sent it and its trail", identifier: "cardTableMenuWho") {
            viewModel.showsSenderSheet = true
        })
        if letter?.isFiled == true {
            items.append(CardTableMenuItem(title: "Take out of the Vault", identifier: "cardTableMenuUnfile") {
                Task { await viewModel.tapLetterAction(.unfile) }
            })
        } else {
            items.append(CardTableMenuItem(title: "File in the Vault", identifier: "cardTableMenuVault") {
                Task { await viewModel.tapLetterAction(.file) }
            })
        }
        items.append(CardTableMenuItem(title: "Shred", identifier: "cardTableMenuShred") {
            Task { await viewModel.tapLetterAction(.shred) }
        })
        if !model.content.sealed {
            items.append(CardTableMenuItem(title: "Open it again", identifier: "cardTableMenuAgain") {
                model.restart(animated: true)
            })
            // Share keeps its corner button, and its line here, now that it's no longer a quiet button on a reader's card.
            items.append(CardTableMenuItem(title: "Share this card", identifier: "cardTableMenuShare") {
                model.isSharing = true
            })
        }
        if let sendBack = model.sendBack {
            items.append(CardTableMenuItem(title: sendBack.title, identifier: "cardTableMenuSendBack", action: sendBack.action))
        }
        if senderPersonId != nil {
            // As drawn for the card memories (wave 4 drawing 6): the card itself is reported, and the person is named.
            let memories = LaunchFeatures.holidayCardMemories
            items.append(CardTableMenuItem(title: memories ? "Report this card" : "Report", identifier: "cardTableMenuReport") {
                reportsSender = true
            })
            if !senderBlocked {
                items.append(CardTableMenuItem(
                    title: memories ? "Block \(model.content.firstName)" : "Block",
                    identifier: "cardTableMenuBlock"
                ) {
                    confirmsBlock = true
                })
            }
        }
        return items
    }

    /// Whether this reader already blocked the card's sender, so a card opened again offers no Block (the exchange read
    /// already leaves out Write back then). A failed read leaves Block offered: blocking again changes nothing.
    private func readBlocked() async {
        guard let senderPersonId, !senderBlocked else { return }
        let blocks = try? await APIClient.shared.request(BlocksEndpoints.blocked, as: UserBlocksResponse.self)
        guard let blocks, !Task.isCancelled, blocks.blocked.contains(where: { $0.userId == senderPersonId }) else { return }
        senderBlocked = true
    }

    private func block() async {
        guard let senderPersonId, !blockInFlight else { return }
        blockInFlight = true
        defer { blockInFlight = false }
        do {
            _ = try await APIClient.shared.request(BlocksEndpoints.block(userId: senderPersonId))
            // Nothing can go to them now: no Send a card, no Write back (the server refuses a reply after a block), and
            // no second Block. The web does the same.
            senderBlocked = true
            model.sendBack = nil
            model.writeBack = nil
            model.showToast("\(model.content.firstName) is blocked.")
        } catch {
            model.showToast("Couldn't block \(model.content.firstName). Check your connection and try again.")
        }
    }
}
