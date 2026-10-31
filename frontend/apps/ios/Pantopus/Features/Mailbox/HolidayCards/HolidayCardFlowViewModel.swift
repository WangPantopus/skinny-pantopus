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

    var name: String {
        switch self {
        case let .person(_, name): name
        case let .email(address): address
        }
    }

    var isEmail: Bool {
        if case .email = self { return true }
        return false
    }
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
final class HolidayCardFlowViewModel {
    private(set) var state: HolidayCardFlowState = .loading
    private(set) var step: HolidayCardStep = .to
    private(set) var recipient: HolidayCardRecipient?
    var designId: String?
    var message = "" {
        didSet {
            sendError = nil
            previewError = nil
        }
    }

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
    /// Asks "Take your card back?" first.
    var confirmsTakeBack = false

    /// Who it's for: the name typed, the search, or an email address.
    var query = "" {
        didSet { if query != oldValue { scheduleSearch() } }
    }

    private(set) var search: HolidayCardSearch = .idle
    var byEmail = false
    var email = ""

    /// Who it's from, printed at the bottom of the back and on the envelope:
    /// the name neighbors see (the Local Profile), as the card will show it;
    /// the account's name until that answers.
    private(set) var fromName: String
    private var didReadOwnName = false

    private let api: APIClient
    private var searchTask: Task<Void, Never>?
    private var theirsTask: Task<Void, Never>?

    init(api: APIClient = .shared, fromName: String) {
        self.api = api
        self.fromName = fromName
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
            state = .loaded(response)
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
        guard !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
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
        guard let body = sendBody, !previewing else { return }
        previewing = true
        previewError = nil
        defer { previewing = false }
        do {
            let look: HolidayCardPreview = try await answer(HolidayCardEndpoints.preview(body))
            preview = look
            sendError = nil
            step = .look
        } catch {
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
        let to: SendHolidayCardBody.Recipient = switch recipient {
        case let .person(userId, _): .person(userId: userId)
        case let .email(address): .email(address)
        }
        return SendHolidayCardBody(
            design: design.id,
            message: message.trimmingCharacters(in: .whitespacesAndNewlines),
            arrival: arrival,
            to: to
        )
    }

    /// "Seal and send", from "Look it over" (or from step 4 when the look
    /// can't be shown). A refusal stays there with the server's sentence; a
    /// choice that closed meanwhile (the 7 a.m. pickup came) goes back to
    /// step 4 to pick again.
    func send() async {
        guard let body = sendBody, !sending else { return }
        sending = true
        sendError = nil
        if step == .seal { previewError = nil }
        defer { sending = false }
        do {
            let response: SendHolidayCardResponse = try await answer(HolidayCardEndpoints.send(body))
            sent = response.card
            step = .sent
            tookBack = false
        } catch {
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
            sent = nil
            preview = nil
            lookUnavailable = false
            tookBack = true
            recipient = nil
            theirs = nil
            designId = nil
            message = ""
            arrival = nil
            query = ""
            email = ""
            byEmail = false
            step = .to
            // Today's card is free again.
            await fetch()
        } catch {
            takeBackError = Self.refusal(error, fallback: "Couldn’t take your card back just now. Try again in a moment.")
        }
    }

    /// A card answer (`answer(_:api:)`).
    private func answer<Response: Decodable>(_ endpoint: Endpoint) async throws -> Response {
        try await Self.answer(endpoint, api: api)
    }
}

extension HolidayCardFlowViewModel {
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
