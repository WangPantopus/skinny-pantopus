//
//  HolidayCardFlowViewModel.swift
//  Pantopus
//
//  Send a Christmas card (launch keys `holiday_cards` + `mailbox`; the web's
//  `SendCardFlow`): who it's for → pick a card → write on the back → seal it
//  for the day → look it over, exactly as the other person will see it,
//  then seal and send. One card a day: once it's sent, the screen shows
//  today's card, which can be taken back until the 7 a.m. pickup (by email:
//  until they open it). `GET`/`POST /api/mailbox/cards`, `POST
//  /api/mailbox/cards/preview`, `POST /api/mailbox/cards/:id/take-back`, and
//  the Mail recipient search for people only.
//

// swiftlint:disable file_length

import Foundation
import Observation

enum HolidayCardFlowState {
    case loading
    case loaded(HolidayCardsResponse)
    case error(message: String)
}

/// The flow's five steps, then the card on its way.
enum HolidayCardStep: Int, CaseIterable {
    case to, pick, write, seal, look, sent

    /// The five steps the dots count.
    static let counted: [HolidayCardStep] = [.to, .pick, .write, .seal, .look]

    var title: String {
        switch self {
        case .to: "Who it’s for"
        case .pick: "Pick a card"
        case .write: "Write on the back"
        case .seal: "Seal it for the day"
        case .look: "Look it over"
        case .sent: "On its way"
        }
    }
}

/// Who the card is for: a person found by name, or an email address.
enum HolidayCardRecipient: Hashable {
    case person(userId: String, name: String)
    case email(String)
    /// Whoever opens the link (`card_table`). It comes the way a card by email does.
    case link
    /// Two or more people or addresses (digital stamps on): a card each
    /// (`POST /api/mailbox/cards/batch`).
    case list([HolidayCardRecipient])

    var name: String {
        switch self {
        case let .person(_, name): name
        case let .email(address): address
        case .link: "whoever opens your link"
        case let .list(entries): HolidayCardWords.listNames(entries.map(\.name))
        }
    }

    /// By email (a list of addresses only comes that way too).
    var isEmail: Bool {
        switch self {
        case .person: false
        case .email, .link: true
        case let .list(entries): entries.allSatisfy(\.isEmail)
        }
    }

    var isLink: Bool {
        self == .link
    }

    /// The people and addresses on a list; nil for one card.
    var entries: [HolidayCardRecipient]? {
        guard case let .list(entries) = self else { return nil }
        return entries
    }

    /// The same person or address, however it was typed.
    var key: String {
        switch self {
        case let .person(userId, _): "person:\(userId)"
        case let .email(address): "email:\(address.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())"
        case .link: "link"
        case let .list(entries): entries.map(\.key).joined(separator: ",")
        }
    }

    /// The name on the envelope: a card by link has none until someone opens
    /// it; a list's first card shows.
    var envelopeName: String {
        switch self {
        case .link: "Their name"
        case let .list(entries): entries.first?.envelopeName ?? ""
        default: name
        }
    }
}

/// The stamp books opened because a list's cards need more stamps than are left.
struct StampShort: Equatable {
    let cards: Int
    let missing: Int
}

/// The name search under "Who it's for".
enum HolidayCardSearch: Equatable {
    /// Fewer than two letters typed.
    case idle
    case looking
    case found([MailRecipientDTO])
    case failed(String)
}

@Observable
@MainActor
// swiftlint:disable:next type_body_length
final class HolidayCardFlowViewModel {
    private(set) var state: HolidayCardFlowState = .loading
    private(set) var step: HolidayCardStep = .to
    private(set) var recipient: HolidayCardRecipient?
    var designId: String?
    /// The card rack over Pick a card (plan Part 5): the picture it opened at, nil when it's closed.
    var largeDesign: HolidayCardDesign?
    var message = "" {
        didSet {
            sendError = nil
            previewError = nil
        }
    }

    /// Signed beside FROM with a finger (plan 8.2); nil keeps the typed first name. Kept for every look and retry of
    /// this card, like its note.
    var signature: CardSignature? {
        didSet {
            sendError = nil
            previewError = nil
        }
    }

    /// The card's own photo beside its note (memories plan step 4, `holiday_card_memories`), uploaded as it's chosen.
    let attachments = HolidayCardAttachments()

    /// When it comes. Changing it here keeps a sentence about a choice
    /// that closed; the person's own pick clears it (`pick(_:)`).
    var arrival: HolidayCardArrival? {
        didSet { sendError = nil }
    }

    /// When a card to the person chosen can come, by their clock; nil until
    /// it's read (the sender's next morning stands in meanwhile).
    private(set) var theirs: HolidayCardArrivalsFor?

    /// What the other person will see (step 5), read when "Look it over" is tapped.
    private(set) var preview: HolidayCardPreview?
    private(set) var previewing = false
    /// Why the card can't be looked over, or a choice that closed while it
    /// was: under the choices on "Seal it for the day".
    private(set) var previewError: String?
    /// The server can't show the look (it doesn't have Look it over yet, or
    /// its answer can't be read): step 4 says so and seals and sends itself.
    /// Each visit to step 4 asks for the look again.
    private(set) var lookUnavailable = false

    /// What step 4 says under its choices: why the card didn't go, or that
    /// the look can't be shown.
    var sealNotice: String? {
        previewError ?? (lookUnavailable ? "Pantopus can’t show how your card will look yet. You can still seal and send it." : nil)
    }

    /// The card just sent, shown as "On its way".
    private(set) var sent: SentHolidayCard?
    private(set) var sending = false
    /// Why "Seal and send" didn't go, on "Look it over".
    private(set) var sendError: String?
    private(set) var takingBack = false
    private(set) var takeBackError: String?
    /// A card was taken back: step 1 says the day is free again.
    private(set) var tookBack = false
    /// A retry of a card that was taken back meanwhile: the server's
    /// sentence, on a new card's first step.
    private(set) var takenBackNote: String?
    /// Asks "Take your card back?" first.
    var confirmsTakeBack = false
    /// "Seal and send" opened the table to seal it by hand (plan Part 2, `card_table`).
    var sealsAtTable = false
    /// One request ID per card, sent with every look and retry of it, so a
    /// send whose answer was lost is answered with the card it stored, never
    /// a second one. A new card starts once this one is sent or taken back.
    private var requestId: String?

    /// What step 1 says about a card taken back, if anything.
    var backNote: String? {
        guard !tookBack || takenBackNote != nil else {
            return cards?.postageEnabled == true
                ? "You took your card back, and its stamp is back with you."
                : "You took your card back. You can send a card again today."
        }
        return takenBackNote
    }

    /// Digital stamps (postage on): the balance, the books and buying them.
    let stamps = MailStampStore()
    /// The stamp books sheet is up (the header's count, "Get stamps to send", or a send the server refused for a stamp).
    var showsStampBooks = false {
        didSet { if !showsStampBooks { stampShort = nil } }
    }

    /// The stamp books opened for a list whose cards need more stamps than are left.
    var stampShort: StampShort?

    // A list (digital stamps on): who's on it, a request ID for each (kept
    // for the whole card, so every look and retry of the list finds the
    // cards it already sent), its look and what sending it did.
    private(set) var listed: [HolidayCardRecipient] = []
    private var listIds: [String: String] = [:]
    private(set) var listPreview: HolidayCardListPreview?
    private(set) var listResults: [HolidayCardListResult]?
    /// Cards taken back from On its way: their stamps came back.
    private(set) var listTakenBack: Set<String> = []
    private(set) var listTakingBack: String?
    /// Why a card on the list couldn't be taken back: its id and the sentence.
    private(set) var listTakeBackError: (id: String, message: String)?

    /// Who it's for: the name typed, the search, or an email address.
    var query = "" {
        didSet { if query != oldValue { scheduleSearch() } }
    }

    private(set) var search: HolidayCardSearch = .idle
    var byEmail = false
    /// The link to send, just after sending a card by link.
    private(set) var sentLink: String?
    var email = ""

    /// Who it's from, printed at the bottom of the back and on the envelope:
    /// the name neighbors see (the Local Profile), as the card will show it;
    /// the account's name until that answers.
    private(set) var fromName: String
    private var didReadOwnName = false

    private let api: APIClient
    private var searchTask: Task<Void, Never>?
    private var theirsTask: Task<Void, Never>?

    /// The person "Send {first name} a card" chose on a card's table (plan Part 3): the flow opens at Pick a card.
    @ObservationIgnored private var chosenAtStart: HolidayCardRecipient?

    init(api: APIClient = .shared, fromName: String, designId: String? = nil, to person: (id: String, name: String)? = nil) {
        self.api = api
        self.fromName = fromName
        self.designId = designId
        chosenAtStart = person.map { .person(userId: $0.id, name: $0.name) }
    }

    // MARK: - Reading

    var cards: HolidayCardsResponse? {
        if case let .loaded(cards) = state { return cards }
        return nil
    }

    /// The card sent today, while it still counts.
    var today: SentHolidayCard? {
        sent ?? HolidayCardWords.today(cards)
    }

    var design: HolidayCardDesign? {
        cards?.designs.first { $0.id == designId }
    }

    /// The arrivals open for who it's for: a person's by their clock once
    /// read, an email's by the sender's.
    var arrivals: [HolidayCardArrival] {
        guard let cards, let recipient else { return [] }
        if recipient.isEmail { return cards.emailArrivals }
        return theirs?.arrivals ?? cards.personArrivals
    }

    /// The day of the person's next 7 a.m. mail where they live, once read.
    var theirDay: String? {
        recipient?.isEmail == false ? theirs?.nextRoundOn : nil
    }

    var letterCount: Int {
        HolidayCardNote.letters(message)
    }

    var emailIsValid: Bool {
        Self.isEmail(email.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    /// "Dear Maya," on the back before anything's written.
    var placeholder: String {
        guard case let .person(_, name) = recipient else { return "Dear friend," }
        return "Dear \(HolidayCardWords.firstName(name)),"
    }

    static func isEmail(_ text: String) -> Bool {
        text.range(of: #"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$"#, options: .regularExpression) != nil
    }

    func load() async {
        if case .loaded = state { return }
        state = .loading
        await fetch()
        // Chosen on a card's table: straight to Pick a card while sending is open and today's card is free, or with
        // stamp books on, where a card uses a stamp instead (as web does).
        if let chosen = chosenAtStart, let cards, cards.open, HolidayCardWords.today(cards) == nil {
            chosenAtStart = nil
            choose(chosen)
        }
        await readOwnName()
    }

    /// The name the card goes out with (`sender_display`): the Local Profile's.
    private func readOwnName() async {
        guard !didReadOwnName else { return }
        let own: OwnLocalProfileResponse? = try? await api.request(LocalProfileEndpoints.me)
        guard let name = MailPieceModel.firstText(own?.profile.displayName) else { return }
        didReadOwnName = true
        fromName = name
    }

    func retry() async {
        state = .loading
        await fetch()
    }

    private func fetch() async {
        do {
            let response: HolidayCardsResponse = try await api.request(HolidayCardEndpoints.cards())
            // A link can name a picture that isn't one of this year's: nothing is chosen then.
            if let designId, !response.designs.contains(where: { $0.id == designId }) { self.designId = nil }
            state = .loaded(response)
            HolidayCardWords.postageOn = response.postageEnabled
        } catch {
            state = .error(message: Self.loadFailure(error))
        }
    }

    // MARK: - Steps

    /// Back a step; false on the first step and on a sent card, which leave.
    func back() -> Bool {
        guard step != .to, step != .sent, let previous = HolidayCardStep(rawValue: step.rawValue - 1) else { return false }
        step = previous
        sendError = nil
        previewError = nil
        return true
    }

    func choose(_ recipient: HolidayCardRecipient) {
        if recipient != self.recipient { theirs = nil }
        self.recipient = recipient
        readTheirs()
        // The arrival choices depend on who it's for: the first that's open.
        if arrival.map({ !arrivals.contains($0) }) ?? true { arrival = arrivals.first }
        step = .pick
    }

    func chooseEmail() {
        guard emailIsValid else { return }
        choose(.email(email.trimmingCharacters(in: .whitespacesAndNewlines)))
    }

    func toWrite() {
        guard design != nil else { return }
        step = .write
    }

    func toSeal() {
        guard !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, attachments.wait == nil else { return }
        if arrival.map({ !arrivals.contains($0) }) ?? true { arrival = arrivals.first }
        lookUnavailable = false
        step = .seal
        // Read their day again: it moves on at 7 a.m. where they live.
        readTheirs()
    }

    /// A choice on "Seal it for the day", picked by the person.
    func pick(_ arrival: HolidayCardArrival) {
        self.arrival = arrival
        previewError = nil
    }

    /// "Look it over": what the other person will see, from the same checks
    /// sending runs (nothing is stored or sent), then step 5. A refusal stays
    /// on step 4 with the server's sentence; a server that can't show the
    /// look leaves "Seal and send" on step 4.
    func lookItOver() async {
        guard !previewing else { return }
        if recipient?.entries != nil {
            await lookOverList()
            return
        }
        requestId = requestId ?? UUID().uuidString.lowercased()
        guard let body = sendBody else { return }
        previewing = true
        previewError = nil
        defer { previewing = false }
        do {
            let look: HolidayCardPreview = try await answer(HolidayCardEndpoints.preview(body))
            preview = look
            sendError = nil
            step = .look
        } catch {
            if await wentEarlier(error) { return }
            if Self.lookIsUnavailable(error) {
                lookUnavailable = true
                return
            }
            previewError = Self.refusal(error, fallback: "Couldn’t show your card just now. Try again in a moment.")
        }
    }

    /// When a card to the person chosen can come, by their clock. A failure
    /// keeps the sender's next morning; sending says why if it can't go.
    private func readTheirs() {
        theirsTask?.cancel()
        guard case let .person(userId, _) = recipient else { return }
        theirsTask = Task { [weak self] in
            guard let self else { return }
            let answer: HolidayCardArrivalsFor? = try? await api.request(HolidayCardEndpoints.arrivals(toUserId: userId))
            guard !Task.isCancelled, let answer, case let .person(current, _) = recipient, current == userId else { return }
            theirs = answer
            if arrival.map({ !arrivals.contains($0) }) ?? true { arrival = arrivals.first }
        }
    }

    // MARK: - Search

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
            search = .failed("Couldn’t search just now. \(Self.loadFailure(error))")
        }
    }

    // MARK: - Send and take back

    /// The card as it stands: what "Look it over" checks and "Seal and send" sends.
    private var sendBody: SendHolidayCardBody? {
        guard let recipient, let design, let arrival else { return nil }
        let to: SendHolidayCardBody.Recipient
        switch recipient {
        case let .person(userId, _): to = .person(userId: userId)
        case let .email(address): to = .email(address)
        case .link: to = .link
        case .list: return nil
        }
        return SendHolidayCardBody(
            design: design.id,
            message: message.trimmingCharacters(in: .whitespacesAndNewlines),
            arrival: arrival,
            to: to,
            requestId: requestId,
            useStamp: cards?.postageEnabled == true ? true : nil,
            signature: cards?.signature == nil ? nil : signature,
            media: mediaPick
        )
    }

    /// The photo the card carries: one person's card only (a list goes without), and only while the server takes one.
    var mediaPick: HolidayCardMediaPick {
        guard recipient?.entries == nil, cards?.takesPhoto == true || cards?.takesVoice == true else { return .none }
        return attachments.pick
    }

    /// Who a greeting is for, on its label ("For Maya"): the person, or "you" for an address or a link.
    var greetingFor: String {
        if case let .person(_, name) = recipient { return name }
        return "you"
    }

    /// "Seal and send", from "Look it over" (or from step 4 when the look
    /// can't be shown). A refusal stays there with the server's sentence; a
    /// choice that closed meanwhile (the 7 a.m. pickup came) goes back to
    /// step 4 to pick again.
    func send() async {
        guard !sending else { return }
        requestId = requestId ?? UUID().uuidString.lowercased()
        guard let body = sendBody else { return }
        sending = true
        sendError = nil
        if step == .seal { previewError = nil }
        defer { sending = false }
        do {
            let response: SendHolidayCardResponse = try await answer(HolidayCardEndpoints.send(body))
            requestId = nil
            sent = response.card
            sentLink = response.link
            step = .sent
            tookBack = false
        } catch {
            if await wentEarlier(error) { return }
            // The stamps ran out meanwhile (another device sent a card): the stamp books open; the card stays as it is.
            if Self.refusalCode(error) == "STAMPS_REQUIRED" {
                showsStampBooks = true
                await stamps.refresh()
                return
            }
            let sentence = Self.refusal(error, fallback: "Couldn’t send your card just now. Try again in a moment.")
            let closed = Self.refusalCode(error) == "CARD_ARRIVAL_CLOSED"
            guard closed || step == .seal else {
                sendError = sentence
                return
            }
            // Step 4 says why, under its choices.
            previewError = sentence
            step = .seal
            if closed { await readOpenArrivals() }
        }
    }

    /// The arrivals open now, read again after one closed: a person's by
    /// their clock, an email's from the season's answer. A failure keeps
    /// what's shown.
    private func readOpenArrivals() async {
        if recipient?.isEmail == false {
            readTheirs()
            return
        }
        guard let response: HolidayCardsResponse = try? await api.request(HolidayCardEndpoints.cards()) else { return }
        state = .loaded(response)
        if arrival.map({ !arrivals.contains($0) }) ?? true { arrival = arrivals.first }
    }

    func takeBack() async {
        confirmsTakeBack = false
        guard let card = today, !takingBack else { return }
        takingBack = true
        takeBackError = nil
        defer { takingBack = false }
        do {
            let _: TakeBackHolidayCardResponse = try await answer(HolidayCardEndpoints.takeBack(cardId: card.id))
            tookBack = true
            takenBackNote = nil
            startOver()
            // Today's card is free again.
            await fetch()
        } catch {
            takeBackError = Self.refusal(error, fallback: "Couldn’t take your card back just now. Try again in a moment.")
        }
    }

    /// Everything written goes, and the next card starts on step 1 with a
    /// request ID of its own.
    func startOver() {
        requestId = nil
        listIds = [:]
        listed = []
        listPreview = nil
        listResults = nil
        listTakenBack = []
        listTakeBackError = nil
        sent = nil
        preview = nil
        lookUnavailable = false
        recipient = nil
        theirs = nil
        designId = nil
        message = ""
        attachments.reset()
        arrival = nil
        query = ""
        email = ""
        byEmail = false
        step = .to
    }

    /// This card already went with an earlier try whose answer was lost: show
    /// the card it sent, or, once it was taken back, say so and start a new
    /// card. True when it was one of those.
    private func wentEarlier(_ error: any Error) async -> Bool {
        switch Self.refusalCode(error) {
        case "CARD_REQUEST_SENT":
            guard let card = Self.storedCard(error) else { return false }
            requestId = nil
            sent = card
            preview = nil
            tookBack = false
            step = .sent
        case "CARD_TAKEN_BACK":
            takenBackNote = Self.refusal(error, fallback: "You took this card back.")
            startOver()
            await fetch()
        default:
            return false
        }
        sendError = nil
        previewError = nil
        return true
    }

    /// A card answer (`answer(_:api:)`).
    private func answer<Response: Decodable>(_ endpoint: Endpoint) async throws -> Response {
        try await Self.answer(endpoint, api: api)
    }
}

// MARK: - A list (digital stamps on)

extension HolidayCardFlowViewModel {
    /// How many one card can go to at once; more than one: a list.
    var maxRecipients: Int {
        cards?.maxRecipients ?? 1
    }

    var listIsFull: Bool {
        listed.count >= maxRecipients
    }

    func isListed(_ entry: HolidayCardRecipient) -> Bool {
        listed.contains { $0.key == entry.key }
    }

    /// A person from the search onto the list, or off it again (also a chip's ×).
    func toggle(_ entry: HolidayCardRecipient) {
        if let index = listed.firstIndex(where: { $0.key == entry.key }) {
            listed.remove(at: index)
        } else if !listIsFull {
            listed.append(entry)
        }
    }

    /// The address typed onto the list, and back to the name search.
    func addEmail() {
        let address = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard Self.isEmail(address) else { return }
        if !isListed(.email(address)), !listIsFull { listed.append(.email(address)) }
        email = ""
        byEmail = false
    }

    /// Step 1 done: one on the list goes as today's single card, two or more as a list.
    func continueWithList() {
        guard let first = listed.first else { return }
        choose(listed.count == 1 ? first : .list(listed))
    }

    /// The request ID of this person's or address's card on the list.
    func listId(_ entry: HolidayCardRecipient) -> String {
        if let id = listIds[entry.key] { return id }
        let id = UUID().uuidString.lowercased()
        listIds[entry.key] = id
        return id
    }

    /// The person or address on the list whose card has this request ID (once the list was looked over or sent).
    func listEntry(requestId: String) -> HolidayCardRecipient? {
        recipient?.entries?.first { listIds[$0.key] == requestId }
    }

    /// The list's first card that can go: who it's for (Look it over shows it as they'll see it).
    var listFirst: HolidayCardRecipient? {
        guard let ready = listPreview?.recipients.first(where: { $0.status == "ready" }) else { return nil }
        return listEntry(requestId: ready.requestId)
    }

    /// The list as it stands, every card with its own request ID.
    private func listBody() -> SendHolidayCardListBody? {
        guard let entries = recipient?.entries, let design, let arrival else { return nil }
        let recipients: [SendHolidayCardListBody.Recipient] = entries.compactMap { entry in
            switch entry {
            case let .person(userId, _): .init(to: .person(userId: userId), requestId: listId(entry))
            case let .email(address): .init(to: .email(address), requestId: listId(entry))
            case .link, .list: nil
            }
        }
        return SendHolidayCardListBody(
            design: design.id,
            message: message.trimmingCharacters(in: .whitespacesAndNewlines),
            arrival: arrival,
            recipients: recipients,
            signature: cards?.signature == nil ? nil : signature
        )
    }

    /// "Look it over" for a list: every card's line, and the first card that
    /// can go as its person will see it. A refusal of the whole list (the
    /// season closed, say) stays on step 4.
    private func lookOverList() async {
        guard let body = listBody() else { return }
        previewing = true
        previewError = nil
        defer { previewing = false }
        do {
            let look: HolidayCardListPreview = try await answer(HolidayCardEndpoints.previewList(body))
            listPreview = look
            sendError = nil
            step = .look
        } catch {
            previewError = Self.refusal(error, fallback: "Couldn’t show your cards just now. Try again in a moment.")
        }
    }

    /// "Seal and send" for a list, card by card; again ("Send the rest") with
    /// the same request IDs, so only the cards that didn't go can go. Too few
    /// stamps: nothing went, and the stamp books open saying how many more
    /// these cards need.
    func sendList() async {
        guard !sending, let body = listBody() else { return }
        sending = true
        sendError = nil
        defer { sending = false }
        do {
            let response: SendHolidayCardListResponse = try await answer(HolidayCardEndpoints.sendList(body))
            listResults = response.results
            listPreview = nil
            tookBack = false
            step = .sent
        } catch {
            guard Self.refusalCode(error) == "STAMPS_REQUIRED" else {
                sendError = Self.refusal(error, fallback: "Couldn’t send your cards just now. Try again in a moment.")
                return
            }
            let counts = Self.stampCounts(error)
            await stamps.refresh()
            let needed = counts.needed ?? body.recipients.count
            stampShort = StampShort(cards: needed, missing: max(1, needed - (counts.available ?? stamps.balance?.available ?? 0)))
            showsStampBooks = true
        }
    }

    /// "Get stamps to send" on a list's look: the stamp books, saying how many more these cards need.
    func getStampsForList() {
        let needed = listPreview?.needed ?? 0
        stampShort = StampShort(cards: needed, missing: max(1, needed - (stamps.balance?.available ?? 0)))
        showsStampBooks = true
    }

    /// One card on a sent list taken back: its stamp comes back.
    func takeBackFromList(_ card: SentHolidayCard) async {
        guard listTakingBack == nil else { return }
        listTakingBack = card.id
        listTakeBackError = nil
        defer { listTakingBack = nil }
        do {
            let _: TakeBackHolidayCardResponse = try await answer(HolidayCardEndpoints.takeBack(cardId: card.id))
            listTakenBack.insert(card.id)
            await stamps.refresh()
        } catch {
            listTakeBackError = (card.id, Self.refusal(error, fallback: "Couldn’t take your card back just now. Try again in a moment."))
        }
    }
}

extension HolidayCardFlowViewModel {
    /// `needed` and `available` from a list's 402 STAMPS_REQUIRED answer.
    static func stampCounts(_ error: any Error) -> (needed: Int?, available: Int?) {
        let body: String? = switch error as? APIError {
        case let .clientError(_, body): body
        case let .server(_, body): body
        default: nil
        }
        guard let data = body?.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return (nil, nil) }
        return (json["needed"] as? Int, json["available"] as? Int)
    }

    /// A card answer: the decoded body, or the server's own sentence for a
    /// card it turned down (a limit, a choice that closed, someone it can't
    /// reach), which a 403 or 404 carries too. Sent's take-back reads it too.
    static func answer<Response: Decodable>(_ endpoint: Endpoint, api: APIClient) async throws -> Response {
        let reply = try await api.requestDataResponse(endpoint, includingForbidden: true, includingNotFound: true)
        guard (200..<300).contains(reply.response.statusCode) else {
            let text = String(data: reply.data, encoding: .utf8)
            throw HolidayCardRefusal(
                sentence: Self.serverSentence(text), code: Self.serverCode(text), status: reply.response.statusCode
            )
        }
        do {
            return try JSONDecoder().decode(Response.self, from: reply.data)
        } catch {
            throw APIError.decoding(underlying: error)
        }
    }

    // MARK: Words

    /// The server's sentence from a card's error answer (`{ error, code }`),
    /// or what's wrong when the card failed its field checks (an email
    /// address the server doesn't take, say `name@example.test`).
    static func serverSentence(_ body: String?) -> String? {
        guard let data = body?.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        if let field = (json["details"] as? [[String: Any]])?.first {
            if field["field"] as? String == "to.email" {
                return "That email address doesn’t look right. Go back to “Who it’s for” and check it."
            }
            if let message = (field["message"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines), !message.isEmpty {
                return message
            }
        }
        guard json["code"] is String,
              let sentence = (json["error"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
              !sentence.isEmpty else { return nil }
        return sentence
    }

    /// The code of a card's error answer (`CARD_ARRIVAL_CLOSED`, …).
    static func serverCode(_ body: String?) -> String? {
        guard let data = body?.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return json["code"] as? String
    }

    /// The code of a refusal, however it came (a 403 or 404 the card
    /// answer reads, or another 4xx or 5xx the client throws).
    static func refusalCode(_ error: any Error) -> String? {
        if let refusal = error as? HolidayCardRefusal { return refusal.code }
        switch error as? APIError {
        case let .clientError(_, body):
            return serverCode(body)
        case let .server(_, body):
            return serverCode(body)
        default:
            return nil
        }
    }

    /// The card a `CARD_REQUEST_SENT` answer carries: the one an earlier try
    /// of this draft sent.
    static func storedCard(_ error: any Error) -> SentHolidayCard? {
        guard case let .clientError(_, body) = error as? APIError, let data = body?.data(using: .utf8) else { return nil }
        return (try? JSONDecoder().decode(SendHolidayCardResponse.self, from: data))?.card
    }

    /// The server can't show the look: it has no Look it over yet (a 404
    /// without the server's code, as a server from before it answers), or
    /// its answer can't be read. Sending still works there.
    static func lookIsUnavailable(_ error: any Error) -> Bool {
        if let refusal = error as? HolidayCardRefusal { return refusal.status == 404 && refusal.code == nil }
        if case .decoding = error as? APIError { return true }
        return false
    }

    /// What to say when a send or a take-back didn't go: the server's own
    /// sentence when it gave one, else offline or "try again".
    static func refusal(_ error: any Error, fallback: String) -> String {
        if let refusal = error as? HolidayCardRefusal { return refusal.sentence ?? fallback }
        switch error as? APIError {
        case .transport:
            return "You’re offline. Check your connection and try again."
        case let .clientError(_, body):
            return serverSentence(body) ?? fallback
        case let .server(_, body):
            return serverSentence(body) ?? fallback
        default:
            return fallback
        }
    }

    /// Why the cards couldn't load, or a search didn't answer.
    static func loadFailure(_ error: any Error) -> String {
        switch error as? APIError {
        case .transport:
            "You’re offline. Check your connection and try again."
        case .notFound:
            "Christmas cards aren’t available right now. Try again later."
        default:
            "Pantopus is having trouble just now. Try again in a moment."
        }
    }
}

/// A card the server turned down, with its sentence and code when it gave them.
struct HolidayCardRefusal: Error {
    let sentence: String?
    var code: String?
    /// The answer's status (a 403 or a 404).
    var status: Int?
}

/// Whether "Send {first name} a card" shows on a card's table (plan Part 3): sending is open for the season, and the
/// server would take a card to them now (the arrivals check runs the send's own person checks: neither has blocked
/// the other, and their account is still here).
enum HolidayCardSendBack {
    static func isOpen(to userId: String, api: APIClient = .shared) async -> Bool {
        guard let cards: HolidayCardsResponse = try? await api.request(HolidayCardEndpoints.cards()), cards.open else {
            return false
        }
        let arrivals: HolidayCardArrivalsFor? = try? await api.request(HolidayCardEndpoints.arrivals(toUserId: userId))
        return arrivals != nil
    }
}
