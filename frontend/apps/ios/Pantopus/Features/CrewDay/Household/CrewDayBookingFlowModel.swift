//
//  CrewDayBookingFlowModel.swift
//  Pantopus
//
//  2. Your price and 3. Review and book (build kit 01-spec.md, boards
//  `Price` and `Review`), then 4. You're on the route (`Booked`): the home
//  (prefilled from the person's Home in Pantopus, or typed), the option and
//  add-ons, the quote (`POST /public/:code/quote`), the note for the crew,
//  the saved card, the approval, and `POST /:id/bookings`.
//

import Foundation

/// The address a booking is for, from a Home in Pantopus or typed.
struct CrewDayHomeAddress: Hashable {
    let line: String
    let city: String
    let state: String
    let zip: String
    let latitude: Double
    let longitude: Double
    /// The Home in Pantopus it came from.
    let homeId: String?

    /// "123 Maple Lane".
    var short: String {
        line
    }

    /// "123 Maple Lane, Camas, WA 98607".
    var full: String {
        [line, city, [state, zip].filter { !$0.isEmpty }.joined(separator: " ")].filter { !$0.isEmpty }.joined(separator: ", ")
    }
}

/// `{ booking }` from a booking write: the fields the flow needs.
struct CrewDayBookingWritten: Decodable {
    let booking: Booking

    struct Booking: Decodable {
        let id: String
        let status: String
        let priceCents: Int?
        /// The crew's one thing for households to do.
        let prepNote: String?

        private enum CodingKeys: String, CodingKey {
            case id, status
            case priceCents = "price_cents"
            case prepNote = "prep_note"
        }
    }
}

@Observable
@MainActor
final class CrewDayBookingFlowModel {
    enum Step { case price, review, booked }

    let code: String
    private(set) var invitation: CrewDayInvitationDTO?
    private(set) var loadError: String?
    private(set) var step: Step = .price

    // MARK: Your home

    /// The person's Homes in Pantopus that have a place on the map.
    private(set) var homes: [CrewDayHomeAddress] = []
    private(set) var address: CrewDayHomeAddress?
    var addressQuery = ""
    /// Typing another address instead of the Home's.
    var isTypingAddress = false

    // MARK: Choice and quote

    var optionId: String?
    var addOnIds: Set<String> = []
    private(set) var quote: CrewDayQuoteDTO?
    private(set) var isQuoting = false
    /// The address is outside this Crew Day.
    private(set) var outOfArea = false
    /// Counts quotes asked, so only the newest answer counts (an older one may arrive after the address changed).
    private var quoteRun = 0

    // MARK: Review

    var accessNote = ""
    let wallet = CrewDayCardWallet()
    var cardId: String?
    var approved = false
    private(set) var isBooking = false
    private(set) var booked: CrewDayBookingWritten.Booking?
    var error: String?
    /// One id for every try of this booking, so a retry never books twice.
    private let clientRequestId = UUID().uuidString.lowercased()

    init(code: String) {
        self.code = code
        invitation = CrewDayInvitationCache.shared.invitation(code)
    }

    // MARK: - Loading

    func load() async {
        if invitation == nil {
            do {
                let read: CrewDayInvitationDTO = try await APIClient.shared.request(CrewDayEndpoints.invitation(code: code))
                invitation = read
                CrewDayInvitationCache.shared.store(read)
            } catch {
                loadError = CrewDayErrors.sentence(for: error)
                return
            }
        }
        if optionId == nil { optionId = invitation?.priceOptions.first?.id }
        await loadHomes()
        // A Home in Pantopus filled in the address: say at once whether this day reaches it.
        if address != nil, quote == nil, !outOfArea { await checkArea() }
    }

    private func loadHomes() async {
        guard let response: MyHomesResponse = try? await APIClient.shared.request(HomesEndpoints.myHomes()) else { return }
        let usable: [CrewDayHomeAddress] = response.homes.compactMap { mine in
            guard let location = mine.location, let line = mine.home.address, !line.isEmpty else { return nil }
            return CrewDayHomeAddress(
                line: line,
                city: mine.home.city ?? "",
                state: mine.home.state ?? "",
                zip: mine.home.zipcode ?? "",
                latitude: location.latitude,
                longitude: location.longitude,
                homeId: mine.home.id
            )
        }
        homes = usable
        if address == nil {
            let preferred = response.defaultHomeId.flatMap { id in usable.first { $0.homeId == id } }
            address = preferred ?? usable.first
        }
    }

    // MARK: - Your price

    func useHome(_ home: CrewDayHomeAddress) {
        address = home
        isTypingAddress = false
        addressChanged()
    }

    func useTyped(_ normalized: NormalizedAddress) {
        guard let latitude = normalized.latitude, let longitude = normalized.longitude, let line = normalized.address else { return }
        address = CrewDayHomeAddress(
            line: line,
            city: normalized.city ?? "",
            state: normalized.state ?? "",
            zip: normalized.zipcode ?? "",
            latitude: latitude,
            longitude: longitude,
            homeId: nil
        )
        addressChanged()
    }

    func clearTyped() {
        if address?.homeId == nil { address = nil }
        addressChanged()
    }

    /// Change: type another address. What the old one was told goes with it.
    func changeAddress() {
        addressQuery = ""
        isTypingAddress = true
        addressChanged(checks: false)
    }

    func select(option id: String) {
        optionId = id
        resetQuote()
    }

    func toggle(addOn id: String) {
        if addOnIds.contains(id) { addOnIds.remove(id) } else { addOnIds.insert(id) }
        resetQuote()
    }

    var option: CrewDayPriceOption? {
        invitation?.priceOptions.first { $0.id == optionId }
    }

    var chosenAddOns: [CrewDayAddOn] {
        invitation?.addOns.filter { addOnIds.contains($0.id) } ?? []
    }

    /// The option's look-first: the crew sets the price before anything is booked.
    var needsLook: Bool {
        quote?.needsLook ?? option?.needsLook ?? false
    }

    /// The home's own price: the server's quote once there is one.
    var priceCents: Int? {
        if let quoted = quote?.priceCents { return quoted }
        guard let option, !option.needsLook, let base = option.priceCents else { return nil }
        return base + chosenAddOns.reduce(0) { $0 + $1.priceCents }
    }

    var canContinue: Bool {
        address != nil && option != nil && !isQuoting
    }

    /// As soon as the address is known (01-spec.md screen 2, as the web does): whether this day reaches it, through
    /// the quote. An address outside it shows "Ask for one on your street" under Your home instead of the options.
    func checkArea() async {
        guard let address, let optionId = optionId ?? invitation?.priceOptions.first?.id else { return }
        quoteRun += 1
        let run = quoteRun
        isQuoting = true
        defer { if run == quoteRun { isQuoting = false } }
        // A failure here says nothing: Continue asks again and says what failed.
        guard let answer: CrewDayQuoteDTO = try? await APIClient.shared.request(
            CrewDayEndpoints.quote(code: code, quoteBody(address, optionId: optionId))
        ), run == quoteRun else { return }
        quote = answer
        outOfArea = !answer.inArea
    }

    /// Continue: the server checks the area and prices the home.
    func continueToReview() async {
        guard let address, let optionId else { return }
        quoteRun += 1
        let run = quoteRun
        isQuoting = true
        error = nil
        defer { if run == quoteRun { isQuoting = false } }
        do {
            let answer: CrewDayQuoteDTO = try await APIClient.shared.request(
                CrewDayEndpoints.quote(code: code, quoteBody(address, optionId: optionId))
            )
            guard run == quoteRun else { return }
            quote = answer
            outOfArea = !answer.inArea
            guard answer.inArea else { return }
            step = .review
            if !wallet.loaded {
                await wallet.load()
                cardId = cardId ?? wallet.preferred?.id
            }
        } catch {
            if run == quoteRun { self.error = CrewDayErrors.sentence(for: error) }
        }
    }

    func backToPrice() {
        error = nil
        step = .price
    }

    private func quoteBody(_ address: CrewDayHomeAddress, optionId: String) -> CrewDayQuoteBody {
        CrewDayQuoteBody(
            latitude: address.latitude,
            longitude: address.longitude,
            addressLine: address.line,
            optionId: optionId,
            addOnIds: Array(addOnIds).sorted()
        )
    }

    /// Another option or add-on: the price is asked again at Continue (the area stays as it was).
    private func resetQuote() {
        quote = nil
    }

    /// A new address, or none: the old answers go, a late one is dropped, and the new address is checked at once.
    private func addressChanged(checks: Bool = true) {
        quote = nil
        outOfArea = false
        quoteRun += 1
        isQuoting = false
        guard checks, address != nil else { return }
        Task { await checkArea() }
    }

    // MARK: - Review and book

    var card: CrewDaySavedCard? {
        wallet.cards.first { $0.id == cardId }
    }

    func addCard() async {
        if let added = await wallet.addCard() { cardId = added.id }
    }

    var canBook: Bool {
        approved && card?.stripeId != nil && address != nil && !isBooking
    }

    func book() async {
        guard let invitation, let address, let optionId, let stripeId = card?.stripeId else { return }
        isBooking = true
        error = nil
        defer { isBooking = false }
        let note = accessNote.trimmingCharacters(in: .whitespacesAndNewlines)
        let body = CrewDayBookingBody(
            clientRequestId: clientRequestId,
            homeId: address.homeId,
            address: CrewDayAddressBody(
                line: address.line,
                city: address.city,
                state: address.state,
                zip: address.zip,
                latitude: address.latitude,
                longitude: address.longitude
            ),
            optionId: optionId,
            addOnIds: Array(addOnIds).sorted(),
            accessNote: note.isEmpty ? nil : note,
            paymentMethodId: stripeId
        )
        do {
            let written: CrewDayBookingWritten = try await APIClient.shared.request(
                CrewDayEndpoints.book(crewDayId: invitation.id, body)
            )
            booked = written.booking
            step = .booked
            NotificationCenter.default.post(name: .crewDayChanged, object: nil)
        } catch {
            self.error = CrewDayBookingCopy.bookingError(error, invitation: invitation)
        }
    }
}

enum CrewDayBookingCopy {
    /// What failed and what to do (01-spec.md screen 3 "Errors").
    static func bookingError(_ error: any Error, invitation: CrewDayInvitationDTO) -> String {
        switch CrewDayErrors.code(for: error) {
        case "BOOKING_CLOSED":
            "Booking closed on \(CrewDayInvitationCopy.closes(invitation))."
        default:
            CrewDayErrors.sentence(for: error)
        }
    }
}
