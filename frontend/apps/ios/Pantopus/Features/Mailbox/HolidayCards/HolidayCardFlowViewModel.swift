//
//  HolidayCardFlowViewModel.swift
//  Pantopus
//
//  Send a Christmas card (launch keys `holiday_cards` + `mailbox`; the web's
//  `SendCardFlow`): who it's for → pick a card → write on the back → seal it
//  for the day. One card a day: once it's sent, the screen shows today's
//  card, which can be taken back until the 7 a.m. pickup (by email: until
//  they open it). `GET`/`POST /api/mailbox/cards`, `POST
//  /api/mailbox/cards/:id/take-back`, and the Mail recipient search for
//  people only.
//

import Foundation
import Observation

enum HolidayCardFlowState {
    case loading
    case loaded(HolidayCardsResponse)
    case error(message: String)
}

/// The flow's four steps, then the card on its way.
enum HolidayCardStep: Int, CaseIterable {
    case to, pick, write, seal, sent

    /// The four steps the dots count.
    static let counted: [HolidayCardStep] = [.to, .pick, .write, .seal]

    var title: String {
        switch self {
        case .to: "Who it’s for"
        case .pick: "Pick a card"
        case .write: "Write on the back"
        case .seal: "Seal it for the day"
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
        didSet { sendError = nil }
    }

    var arrival: HolidayCardArrival? {
        didSet { sendError = nil }
    }

    /// The card just sent, shown as "On its way".
    private(set) var sent: SentHolidayCard?
    private(set) var sending = false
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

    /// The arrivals open for who it's for.
    var arrivals: [HolidayCardArrival] {
        guard let cards, let recipient else { return [] }
        return recipient.isEmail ? cards.emailArrivals : cards.personArrivals
    }

    var letterCount: Int {
        HolidayCardNote.letters(message)
    }

    var emailIsValid: Bool {
        Self.isEmail(email.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    /// "Dear Maya," on the back before anything's written.
    var placeholder: String {
        guard case let .person(_, name) = recipient else { return "Dear," }
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
        return true
    }

    func choose(_ recipient: HolidayCardRecipient) {
        self.recipient = recipient
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
        step = .seal
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

    func send() async {
        guard let recipient, let design, let arrival, !sending else { return }
        sending = true
        sendError = nil
        defer { sending = false }
        let to: SendHolidayCardBody.Recipient = switch recipient {
        case let .person(userId, _): .person(userId: userId)
        case let .email(address): .email(address)
        }
        let body = SendHolidayCardBody(
            design: design.id,
            message: message.trimmingCharacters(in: .whitespacesAndNewlines),
            arrival: arrival,
            to: to
        )
        do {
            let response: SendHolidayCardResponse = try await answer(HolidayCardEndpoints.send(body))
            sent = response.card
            step = .sent
            tookBack = false
        } catch {
            sendError = Self.refusal(error, fallback: "Couldn’t send your card just now. Try again in a moment.")
        }
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
            tookBack = true
            recipient = nil
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

    /// A card answer: the decoded body, or the server's own sentence for a
    /// card it turned down (a limit, a choice that closed, someone it can't
    /// reach), which a 403 or 404 carries too.
    private func answer<Response: Decodable>(_ endpoint: Endpoint) async throws -> Response {
        let reply = try await api.requestDataResponse(endpoint, includingForbidden: true, includingNotFound: true)
        guard (200..<300).contains(reply.response.statusCode) else {
            throw HolidayCardRefusal(sentence: Self.serverSentence(String(data: reply.data, encoding: .utf8)))
        }
        do {
            return try JSONDecoder().decode(Response.self, from: reply.data)
        } catch {
            throw APIError.decoding(underlying: error)
        }
    }

    // MARK: - Words

    /// The server's sentence from a card's error answer (`{ error, code }`).
    static func serverSentence(_ body: String?) -> String? {
        guard let data = body?.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              json["code"] is String,
              let sentence = (json["error"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
              !sentence.isEmpty else { return nil }
        return sentence
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

/// A card the server turned down, with its sentence when it gave one.
struct HolidayCardRefusal: Error {
    let sentence: String?
}
