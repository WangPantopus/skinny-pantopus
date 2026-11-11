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
    }
}

extension CardTableContent {
    /// A card in Sent, as the other person gets it.
    init(sent piece: MailSentPiece, from: String, mailedOn: String?) {
        design = piece.card.design
        number = piece.card.number
        caption = piece.card.caption ?? ""
        paper = piece.card.paper
        table = piece.card.table
        slug = piece.card.slug
        year = piece.card.year
        self.mailedOn = mailedOn
        note = MailPieceModel.firstText(piece.note) ?? ""
        fromName = from
        toName = piece.byLink && piece.status != .claimed ? "Their name" : piece.toName
        sealed = false
        sealedUntil = nil
        sealedInDays = ""
        sealedDayCount = 0
        signature = piece.card.signature
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

/// Which card the cover shows.
private struct CardTableCoverItem: Identifiable {
    let id: String
    let model: CardTableModel
}

struct MailCardTableCover: ViewModifier {
    let viewModel: MailDetailViewModel
    let senderLink: (MailDetailContent) -> (title: String, open: () -> Void)?
    var onSendCard: (@MainActor (_ userId: String, _ name: String) -> Void)?
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
        MailCardTablePage(viewModel: viewModel, model: item.model, senderLink: senderLink, onSendCard: onSendCard, onClose: close)
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
    let onClose: () -> Void

    @State private var reportsSender = false
    @State private var confirmsBlock = false
    @State private var blockInFlight = false

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
        CardTableScreen(model: model, menuItems: menuItems, onClose: onClose)
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
                Text("They won't be able to send you mail. This card stays until you shred it.")
            }
            .sheet(isPresented: $reportsSender) {
                if let senderPersonId {
                    ReportUserSheet(
                        userId: senderPersonId,
                        handle: nil,
                        displayName: model.content.fromName,
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
            .onAppear { model.reservesSecondary = sendBackPerson != nil }
            .task(id: sendBackPerson?.id) { await checkSendBack() }
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
        model.sendBack = CardTableMenuItem(title: "Send \(model.content.firstName) a card", identifier: "cardTableSendBack") {
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
        var items = [
            CardTableMenuItem(title: "Who sent it and its trail", identifier: "cardTableMenuWho") {
                viewModel.showsSenderSheet = true
            }
        ]
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
        }
        if let sendBack = model.sendBack {
            items.append(CardTableMenuItem(title: sendBack.title, identifier: "cardTableMenuSendBack", action: sendBack.action))
        }
        if senderPersonId != nil {
            items.append(CardTableMenuItem(title: "Report", identifier: "cardTableMenuReport") {
                reportsSender = true
            })
            items.append(CardTableMenuItem(title: "Block", identifier: "cardTableMenuBlock") {
                confirmsBlock = true
            })
        }
        return items
    }

    private func block() async {
        guard let senderPersonId, !blockInFlight else { return }
        blockInFlight = true
        defer { blockInFlight = false }
        do {
            _ = try await APIClient.shared.request(BlocksEndpoints.block(userId: senderPersonId))
            model.sendBack = nil
            model.showToast("\(model.content.firstName) is blocked.")
        } catch {
            model.showToast("Couldn't block \(model.content.firstName). Check your connection and try again.")
        }
    }
}
