//
//  CardTablePassOnModel.swift
//  Pantopus
//
//  Pass it on (server switch `card_travel`, travelling card plan Part 4): the same card goes on, free, with a note of
//  the reader's own, to someone on Pantopus, an email address, or by link. "Send it on" runs the server's checks, then
//  the card is sealed by hand on the table as any card is, and the seal sends it (NOTES "The server's shapes" 7, 8).
//

import SwiftUI

/// Who gets it next.
enum CardPassOnPick: Equatable {
    case person(userId: String, name: String)
    case email(String)
    case link

    var firstName: String? {
        if case let .person(_, name) = self { return HolidayCardWords.firstName(name) }
        return nil
    }

    var recipient: SendHolidayCardBody.Recipient {
        switch self {
        case let .person(userId, _): .person(userId: userId)
        case let .email(address): .email(address)
        case .link: .link
        }
    }

    /// The name the envelope carries.
    var envelopeName: String {
        switch self {
        case let .person(_, name): name
        case let .email(address): address
        case .link: "Their name"
        }
    }
}

@Observable
@MainActor
final class CardTablePassOnModel {
    /// The card the reader received.
    let cardId: String
    let content: CardTableContent
    let place: Int

    /// Who gets it next: the name search, an email address, or a link.
    var query = "" {
        didSet { if query != oldValue { scheduleSearch() } }
    }

    private(set) var search: HolidayCardSearch = .idle
    var byEmail = false
    var email = ""
    /// A name or an address is being typed.
    var searching = false
    var pick: CardPassOnPick? {
        didSet { if pick != oldValue { refusal = nil } }
    }

    var message = "" {
        didSet { refusal = nil }
    }

    private(set) var signature: CardSignature?
    private(set) var messageLimit = 300
    /// The reader's town ("Tampa, FL"); nil until they have one.
    var town: String?
    private(set) var readCards = false
    /// "Where does it start?" is up; `sendItOn` waits for its town.
    var asksTown = false
    private(set) var checking = false
    var refusal: String?
    /// The table where it's sealed by hand, once the server's checks pass.
    var sealing: CardTableModel?
    /// The card it went as, once sealed.
    private(set) var sent: SentHolidayCard?
    private(set) var sentLink: String?
    /// One request ID per draft, the same on every look and retry.
    private let requestId = UUID().uuidString.lowercased()
    private var searchTask: Task<Void, Never>?
    private let api: APIClient

    init(cardId: String, content: CardTableContent, place: Int, api: APIClient = .shared) {
        self.cardId = cardId
        self.content = content
        self.place = place
        self.api = api
    }

    // MARK: Words

    /// "Your note for Ivy", or "Your note" when it goes to an address or a link.
    var noteLabel: String {
        pick?.firstName.map { "Your note for \($0)" } ?? "Your note"
    }

    /// Under "Send it on": what it costs and how it goes.
    var freeLine: String {
        switch pick {
        case let .person(_, name):
            "Free. It leaves with the morning mail. Only \(HolidayCardWords.firstName(name)) reads your note."
        case .email:
            "Free. We email them now."
        case .link:
            "Free. Share the link yourself."
        case nil:
            "Free. It leaves with the morning mail."
        }
    }

    /// "Your town, Tampa, FL, goes on its journey. Never your name or address."
    var townLine: String? {
        town.map { "Your town, \($0), goes on its journey. Never your name or address." }
    }

    var emailIsValid: Bool {
        HolidayCardFlowViewModel.isEmail(email.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    var canSend: Bool {
        pick != nil && !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !checking
    }

    // MARK: Reading

    /// The saved signature signs it, as it signs a card and a reply; the town and the note's limit come with it.
    func load() async {
        guard !readCards else { return }
        let cards: HolidayCardsResponse? = try? await api.request(HolidayCardEndpoints.cards())
        readCards = true
        guard let cards else { return }
        signature = cards.signature?.saved
        messageLimit = cards.messageLimit
        if town == nil { town = cards.travel?.town }
    }

    private func scheduleSearch() {
        searchTask?.cancel()
        let text = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard text.count >= 2 else {
            search = .idle
            return
        }
        searchTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 250_000_000)
            guard !Task.isCancelled else { return }
            await self?.runSearch(text)
        }
    }

    private func runSearch(_ text: String) async {
        search = .looking
        do {
            let response: MailComposeRecipientsResponse = try await api.request(
                MailComposeEndpoints.recipients(query: text, peopleOnly: true)
            )
            guard !Task.isCancelled else { return }
            search = .found(response.recipients)
        } catch {
            guard !Task.isCancelled else { return }
            search = .failed("Couldn’t search just now. \(HolidayCardFlowViewModel.loadFailure(error))")
        }
    }

    func chooseEmail() {
        let address = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard HolidayCardFlowViewModel.isEmail(address) else { return }
        pick = .email(address)
    }

    /// "Change": back to the search.
    func changePick() {
        pick = nil
        query = ""
    }

    // MARK: Sending

    private func body() -> CardPassOnBody? {
        guard let pick else { return nil }
        return CardPassOnBody(
            to: pick.recipient,
            message: message.trimmingCharacters(in: .whitespacesAndNewlines),
            signature: signature,
            requestId: requestId,
            place: place
        )
    }

    /// "Send it on": with no town yet, the town sheet first; then the server's checks; then the table to seal it.
    func sendItOn() async {
        guard canSend, let body = body() else { return }
        Keyboard.close()
        if town == nil, readCards {
            asksTown = true
            return
        }
        checking = true
        refusal = nil
        defer { checking = false }
        do {
            let look: CardPassOnPreview = try await api.request(HolidayCardEndpoints.passOnPreview(cardId: cardId, body))
            if let kept = look.passOn.town { town = kept }
            openSealing()
        } catch {
            if HolidayCardFlowViewModel.refusalCode(error) == "CARD_TRAVEL_NEEDS_TOWN" {
                town = nil
                asksTown = true
                return
            }
            refusal = HolidayCardFlowViewModel.refusal(error, fallback: "Couldn’t pass it on just now. Try again in a moment.")
        }
    }

    /// The town sheet kept a town: on with "Send it on".
    func townChosen(_ match: CardTownMatch) {
        town = match.label
        asksTown = false
        Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 450_000_000)
            await self?.sendItOn()
        }
    }

    /// The table, note side up on its open envelope: the sealing moment as it is for a card.
    private func openSealing() {
        guard let pick else { return }
        var card = content
        card.travel = nil
        let sealed = CardTableContent(
            design: card.design,
            number: card.number,
            caption: card.caption,
            paper: card.paper,
            table: card.table,
            slug: card.slug,
            year: card.year,
            mailedOn: MailDates.postmarkDay(Date(), calendar: .current),
            note: message.trimmingCharacters(in: .whitespacesAndNewlines),
            fromName: content.toName,
            toName: pick.envelopeName,
            sealed: false,
            sealedUntil: nil,
            sealedInDays: "",
            sealedDayCount: 0,
            verse: card.verse,
            signature: signature
        )
        let model = CardTableModel(content: sealed, startsOnTable: true)
        model.beginSending(CardTableSendingSetup(
            toFirstName: pick.firstName ?? "",
            count: 1,
            sealedForChristmas: false,
            seal: { [weak self, weak model] in
                guard let self, let model else { return .refused(nil) }
                return await seal(model)
            },
            onDone: { [weak self] in self?.done?() }
        ))
        sealing = model
    }

    /// Done on the table: back to the reader's card, which reads its places again.
    @ObservationIgnored var done: (() -> Void)?

    /// The seal is the send.
    private func seal(_ model: CardTableModel) async -> CardTableSealAnswer {
        guard let body = body() else { return .refused(nil) }
        do {
            let answer: SendHolidayCardResponse = try await api.request(HolidayCardEndpoints.passOn(cardId: cardId, body))
            sent = answer.card
            sentLink = answer.link
            return sentWords(answer.card, model: model)
        } catch {
            if HolidayCardFlowViewModel.refusalCode(error) == "CARD_REQUEST_SENT" {
                // Sent by an earlier try whose answer was lost.
                return .sent(words: "On its way.", primary: "Done", buttons: [])
            }
            return .refused(HolidayCardFlowViewModel.refusal(error, fallback: "Couldn’t pass it on just now. Try again in a moment."))
        }
    }

    /// "On its way to Ivy." and when it comes, with Take it back; by link, the link to share.
    private func sentWords(_ card: SentHolidayCard, model: CardTableModel) -> CardTableSealAnswer {
        if card.byLink, let link = sentLink {
            let from = HolidayCardWords.firstName(content.toName)
            let copy = CardTableMenuItem(title: "Copy link", identifier: "cardPassOnCopyLink") { [weak model] in
                UIPasteboard.general.string = link
                model?.showToast("Link copied.")
            }
            let share = CardTableMenuItem(title: "Share", identifier: "cardPassOnShareLink") { [weak model] in
                model?.linkShareText = "A Christmas card for you from \(from): \(link)"
            }
            return .sent(words: "Your card is ready.", primary: "Done", buttons: [copy, share])
        }
        let first = pick?.firstName ?? MailPieceModel.firstText(card.toName).map(HolidayCardWords.firstName) ?? "them"
        let lines = [HolidayCardWords.arrivalLine(card), HolidayCardWords.takeBackLine(card)].compactMap(\.self)
        var buttons: [CardTableMenuItem] = []
        if card.canTakeBack {
            buttons.append(CardTableMenuItem(title: "Take it back", identifier: "cardPassOnTakeBack") { [weak model] in
                model?.asksTakeBack = true
            })
        }
        return .sent(words: (["On its way to \(first)."] + lines).joined(separator: "\n"), primary: "Done", buttons: buttons)
    }

    /// Take it back, from the table once it's sealed: its place is free again.
    func takeBack() async -> String? {
        guard let sent else { return nil }
        do {
            let _: CardPassOnTakeBack = try await api.request(HolidayCardEndpoints.takeBackPassOn(cardId: sent.id))
            return nil
        } catch {
            return HolidayCardFlowViewModel.refusal(error, fallback: "Couldn’t take it back just now. Try again in a moment.")
        }
    }
}
